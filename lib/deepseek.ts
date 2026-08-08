import type { ChatMessage } from "./types";
import { plannedQuestionFrameSchema } from "./question-contracts";

export class DeepSeekUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "DeepSeekUpstreamError";
  }
}

export class DeepSeekPlannerError extends Error {
  constructor(public readonly reason: "empty" | "invalid_json" | "invalid_frame", message: string) {
    super(message);
    this.name = "DeepSeekPlannerError";
  }
}

interface GenerateInput {
  apiKey: string;
  messages: Array<ChatMessage | { role: "system"; content: string }>;
  signal: AbortSignal;
}

interface PlanQuestionInput {
  apiKey: string;
  question: string;
  history: ChatMessage[];
  signal: AbortSignal;
}

export async function planDeepSeekQuestion(input: PlanQuestionInput) {
  const recentQuestions = input.history
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.content.slice(0, 180));
  const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: `你只负责把面试问题分类为 JSON，不回答问题，也不生成候选人事实。先判断提问动作 answerIntent，再识别讨论对象 topic 和 targetRole；不能因为“商业化”一个词就把岗位匹配题判成结果题。\n可选 answerIntent：agent_identity, capability_scope, introduction, career_transition, role_fit, representative_project, project_overview, project_problem, contribution, ai_collaboration, challenge, diagnosis, result, limitation, skills, experience, experience_value, privacy, education, credentials, hiring_recommendation, general。\n可选 topic：profile, role_fit, baidu, rag, deepflow, ask_me, local_tools, audit, statistics, skills, enterprise_ai, agent, unknown。\n可选 facet：overview, problem, method, contribution, architecture, collaboration, evaluation, transfer, example, result, boundary, fit。\nactiveProject 只能省略或选择 baidu-ai-coding-evaluation, rag-knowledge-base, deepflow, ask-me, local-first-tools, audit-tools。\nfocusTerms 与 requestedDimensions 各写本题需要的 1-4 项；targetRole 仅在问题明确提到岗位时填写；confidence 是 0-1。必须输出完整 JSON。`,
        },
        {
          role: "user",
          content: `最近问题：${recentQuestions.length ? recentQuestions.join("｜") : "无"}\n当前问题：${input.question}\nJSON 示例：{"topic":"rag","facet":"evaluation","answerIntent":"skills","focusTerms":["RAG评测","失败定位"],"requestedDimensions":["评测目标","失败定位"],"activeProject":"rag-knowledge-base","useHistory":false,"confidence":0.92}`,
        },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      stream: false,
      temperature: 0.1,
      max_tokens: 420,
    }),
    signal: input.signal,
  });

  if (!response.ok) throw new DeepSeekUpstreamError(response.status, "问题规划服务返回异常");
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new DeepSeekPlannerError("empty", "问题规划返回空内容");

  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch { throw new DeepSeekPlannerError("invalid_json", "问题规划返回无效 JSON"); }
  const validated = plannedQuestionFrameSchema.safeParse(parsed);
  if (!validated.success) throw new DeepSeekPlannerError("invalid_frame", "问题规划字段不在允许范围内");
  return { frame: validated.data, totalTokens: Number(payload.usage?.total_tokens ?? 0) };
}

export async function generateDeepSeekAnswer(input: GenerateInput) {
  const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: input.messages,
      thinking: { type: "disabled" },
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 1_100,
    }),
    signal: input.signal,
  });

  if (!response.ok || !response.body) {
    throw new DeepSeekUpstreamError(response.status, "模型服务返回异常");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let totalTokens = 0;

  const consume = (row: string) => {
    if (!row.startsWith("data:")) return;
    const data = row.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data);
      text += payload.choices?.[0]?.delta?.content ?? "";
      if (payload.usage?.total_tokens) totalTokens = Number(payload.usage.total_tokens);
    } catch {
      // Keep-alive 与不完整帧不属于回答内容。
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) consume(row);
  }
  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer.trim());

  if (!text.trim()) throw new DeepSeekUpstreamError(502, "模型返回空回答");
  return { text: text.trim(), totalTokens };
}
