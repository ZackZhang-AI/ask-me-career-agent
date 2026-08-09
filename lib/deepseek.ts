import { APICallError, generateText, gateway, Output, type ModelMessage } from "ai";
import type { ChatMessage } from "./types";
import { plannedQuestionFrameSchema } from "./question-contracts";
import { buildReviewPrompt, interviewReviewSchema } from "./interview-review";
import type { AnswerPlan } from "./types";

export type ModelPath = "flash" | "pro";

const PRIMARY_MODEL = process.env.AI_PRIMARY_MODEL ?? "deepseek/deepseek-v4-flash";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL ?? "deepseek/deepseek-v4-pro";

export class DeepSeekUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "DeepSeekUpstreamError";
  }
}

export class DeepSeekPlannerError extends Error {
  constructor(public readonly reason: "empty", message: string) {
    super(message);
    this.name = "DeepSeekPlannerError";
  }
}

interface GenerateInput {
  messages: Array<ChatMessage | { role: "system"; content: string }>;
  signal: AbortSignal;
  userId?: string;
}

interface PlanQuestionInput {
  question: string;
  history: ChatMessage[];
  signal: AbortSignal;
  userId?: string;
}

interface ReviewAnswerInput {
  question: string;
  candidate: string;
  plan: AnswerPlan;
  localTriggers: string[];
  signal: AbortSignal;
  userId?: string;
}

function toModelPrompt(messages: GenerateInput["messages"]) {
  const instructions = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversational = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content })) as ModelMessage[];
  return { instructions, messages: conversational };
}

function gatewayProviderOptions(feature: string, userId?: string) {
  return {
    gateway: {
      models: [FALLBACK_MODEL],
      ...(userId ? { user: userId } : {}),
      tags: [`feature:${feature}`, `env:${process.env.VERCEL_ENV ?? "development"}`],
    },
  };
}

function modelPathFrom(result: unknown): ModelPath {
  const modelId = (result as { response?: { modelId?: unknown } }).response?.modelId;
  return typeof modelId === "string" && modelId.includes("deepseek-v4-pro") ? "pro" : "flash";
}

function upstreamError(error: unknown, fallbackMessage: string) {
  if (error instanceof DeepSeekUpstreamError) return error;
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? (error as { statusCode?: unknown }).statusCode
    : undefined;
  const status = typeof statusCode === "number"
    ? statusCode
    : APICallError.isInstance(error) && typeof error.statusCode === "number"
      ? error.statusCode
      : 502;
  return new DeepSeekUpstreamError(status, fallbackMessage);
}

export async function planDeepSeekQuestion(input: PlanQuestionInput) {
  const recentQuestions = input.history
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.content.slice(0, 180));
  let result;
  try {
    result = await generateText({
      model: gateway(PRIMARY_MODEL),
      output: Output.object({ schema: plannedQuestionFrameSchema }),
      instructions: `你只负责把面试问题分类为 JSON，不回答问题，也不生成候选人事实。先判断提问动作 answerIntent，再判断 questionMode 和 evidencePolicy，最后识别讨论对象 topic、targetRole 与 focusTerms。不能因为“商业化”一个词就把岗位匹配题判成结果题；不能因为“问题、产品、项目”等弱词召回单个项目。
可选 questionMode：agent_meta（询问 Agent 能力或质疑回答方式）、candidate_fact（候选人的真实经历、结果或任职事实）、candidate_reasoning（面试中的方法、动机、假设和判断）。
可选 evidencePolicy：required（必须有公开事实）、supporting（事实用于增强但不限制方法论）、none（Agent 能力说明或通用回答）。
可选 answerIntent：agent_identity, capability_scope, introduction, career_transition, role_fit, representative_project, project_overview, project_problem, contribution, ai_collaboration, challenge, diagnosis, result, limitation, skills, experience, experience_value, privacy, education, credentials, hiring_recommendation, general。
可选 topic：profile, role_fit, baidu, rag, deepflow, ask_me, local_tools, audit, statistics, skills, enterprise_ai, agent, unknown。
可选 facet：overview, problem, method, contribution, architecture, collaboration, evaluation, transfer, example, result, boundary, fit。
activeProject 只能省略或选择 baidu-ai-coding-evaluation, rag-knowledge-base, deepflow, ask-me, local-first-tools, audit-tools。focusTerms 与 requestedDimensions 各写本题需要的 1-4 项；targetRole 仅在问题明确提到岗位时填写；confidence 是 0-1。必须输出完整 JSON。`,
      prompt: `最近问题：${recentQuestions.length ? recentQuestions.join("｜") : "无"}\n当前问题：${input.question}\n结构示例：{"topic":"profile","facet":"transfer","answerIntent":"career_transition","questionMode":"candidate_fact","evidencePolicy":"required","focusTerms":["职业转型动机","能力连续性"],"requestedDimensions":["选择原因","经历迁移"],"useHistory":true,"confidence":0.92}`,
      providerOptions: gatewayProviderOptions("question-planning", input.userId),
      temperature: 0.1,
      maxOutputTokens: 520,
      abortSignal: input.signal,
    });
  } catch (error) {
    throw upstreamError(error, "问题规划服务返回异常");
  }

  if (!result.output) throw new DeepSeekPlannerError("empty", "问题规划返回空内容");
  return {
    frame: result.output,
    totalTokens: Number(result.usage?.totalTokens ?? 0),
    modelPath: modelPathFrom(result),
  };
}

export async function generateDeepSeekAnswer(input: GenerateInput) {
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: gateway(PRIMARY_MODEL),
      ...toModelPrompt(input.messages),
      providerOptions: gatewayProviderOptions("interview-answer", input.userId),
      temperature: 0.45,
      maxOutputTokens: 1_100,
      abortSignal: input.signal,
    });
  } catch (error) {
    throw upstreamError(error, "模型服务返回异常");
  }

  if (!result.text.trim()) throw new DeepSeekUpstreamError(502, "模型返回空回答");
  return {
    text: result.text.trim(),
    totalTokens: Number(result.usage?.totalTokens ?? 0),
    modelPath: modelPathFrom(result),
  };
}

export async function reviewDeepSeekAnswer(input: ReviewAnswerInput) {
  let result;
  try {
    result = await generateText({
      model: gateway(FALLBACK_MODEL),
      output: Output.object({ schema: interviewReviewSchema }),
      instructions: buildReviewPrompt(input.question, input.candidate, input.plan, input.localTriggers),
      prompt: "请完成最终面试质量审校，并严格返回结构化结果。",
      providerOptions: {
        gateway: {
          tags: [`feature:interview-review`, `env:${process.env.VERCEL_ENV ?? "development"}`],
          ...(input.userId ? { user: input.userId } : {}),
        },
      },
      temperature: 0.2,
      maxOutputTokens: 1_400,
      abortSignal: input.signal,
    });
  } catch (error) {
    throw upstreamError(error, "最终审校模型服务返回异常");
  }

  if (!result.output) throw new DeepSeekUpstreamError(502, "最终审校模型返回空结果");
  return {
    review: result.output,
    totalTokens: Number(result.usage?.totalTokens ?? 0),
    modelPath: "pro" as const,
  };
}

export function gatewayModelConfig() {
  return { primary: PRIMARY_MODEL, fallback: FALLBACK_MODEL };
}
