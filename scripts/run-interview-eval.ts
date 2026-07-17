import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildContext, demoAnswer, systemPrompt } from "../lib/answer.ts";
import { assessQuestion } from "../lib/guardrails.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import type { ResponseStatus } from "../lib/types.ts";

export type EvaluationMode = "local" | "deepseek";

export const interviewRoles = [
  { id: "ai_pm_strategy", name: "AI 产品经理·策略型", focus: "用户价值、产品取舍和岗位匹配" },
  { id: "ai_pm_delivery", name: "AI 产品经理·交付型", focus: "MVP、协作、落地和复盘" },
  { id: "hr_screening", name: "HR·初筛", focus: "定位、经历可信度和沟通效率" },
  { id: "hr_business", name: "HR·业务招聘", focus: "岗位适配、动机、短板和风险" },
  { id: "ai_practitioner_agent", name: "AI 产品从业者·Agent", focus: "Agent 工作流、人审和工程边界" },
  { id: "ai_practitioner_eval", name: "AI 产品从业者·评测", focus: "RAG、评测、证据和失败分析" },
] as const;

export const questionCategories = [
  { id: "sixty_second_intro", name: "60秒介绍", question: "请用 60 秒介绍张倬玮，并说明最值得继续面试的三个差异点。", anchors: ["AI 产品", "数据", "业务"] },
  { id: "role_fit", name: "岗位匹配", question: "他为什么适合初级 AI 产品经理岗位，哪些岗位要求目前还缺少证据？", anchors: ["匹配", "短板", "证据"] },
  { id: "representative_project", name: "代表项目", question: "哪个项目最能代表他的 AI 产品能力？请说明项目价值和当前完成边界。", anchors: ["RAG", "项目", "边界"] },
  { id: "personal_contribution", name: "个人贡献", question: "他在 RAG 项目中具体做了什么？请区分本人贡献、AI 辅助和待核实部分。", anchors: ["贡献", "AI", "核实"] },
  { id: "ai_coding_share", name: "AI编程占比", question: "这些项目里 AI 编程工具承担了多少工作？请说明候选人本人判断与 AI 辅助的边界。", anchors: ["AI 编程", "本人", "边界"] },
  { id: "challenge_or_failure", name: "挑战或失败", question: "请讲一个项目中的真实挑战或失败，并说明如何定位、调整和验证。", anchors: ["挑战", "失败", "验证"] },
  { id: "user_business_value", name: "用户与业务价值", question: "这些项目具体服务什么用户、解决什么业务问题，目前有哪些价值证据？", anchors: ["用户", "业务", "价值"] },
  { id: "next_round_recommendation", name: "是否建议进入下一轮", question: "只基于当前公开证据，你是否建议安排下一轮初步面试？请给出支持理由和必须核实的问题，不要给录用结论。", anchors: ["下一轮", "理由", "核实"] },
] as const;

export const scoreDimensions = [
  "清晰度",
  "差异化",
  "可信度",
  "追问承受力",
  "面试转化意愿",
] as const;

export type ScoreDimension = typeof scoreDimensions[number];
export type ScoreCard = Record<ScoreDimension, number> & { total: number };

export interface InterviewCase {
  id: string;
  roleId: string;
  roleName: string;
  roleFocus: string;
  categoryId: string;
  categoryName: string;
  question: string;
  anchors: readonly string[];
}

export interface EvaluationAnswer {
  text: string;
  responseStatus: ResponseStatus;
  claimIds: string[];
  sourceIds: string[];
  answerMode: "stable" | "retrieval" | "deepseek" | "guardrail";
}

export interface InterviewEvaluationResult extends InterviewCase {
  syntheticSimulation: true;
  answer: EvaluationAnswer;
  scores: ScoreCard;
  passed: boolean;
}

export interface InterviewEvaluationReport {
  schemaVersion: 1;
  reportId: string;
  generatedAt: string;
  simulation: {
    synthetic: true;
    label: string;
    replacesHumanTesting: false;
    roleCount: number;
    categoryCount: number;
    caseCount: number;
  };
  execution: {
    requestedMode: "local" | "deepseek" | "auto";
    effectiveMode: EvaluationMode;
    model?: string;
  };
  scoring: {
    scale: "0-5";
    dimensions: readonly ScoreDimension[];
    casePassThreshold: number;
    recommendedRoleThreshold: 5;
    qualityAverageThreshold: 4;
  };
  summary: {
    passedCases: number;
    failedCases: number;
    passRate: number;
    averageScore: number;
    averageByDimension: Record<ScoreDimension, number>;
    recommendedRoleCount: number;
    passedRecommendationGate: boolean;
    passedQualityGate: boolean;
    passedLaunchGate: boolean;
  };
  roleRecommendations: Array<{
    roleId: string;
    roleName: string;
    averageScore: number;
    averageCredibility: number;
    recommendsNextRound: boolean;
  }>;
  results: InterviewEvaluationResult[];
}

export function buildInterviewCases(): InterviewCase[] {
  return interviewRoles.flatMap((role) => questionCategories.map((category) => ({
    id: `${role.id}__${category.id}`,
    roleId: role.id,
    roleName: role.name,
    roleFocus: role.focus,
    categoryId: category.id,
    categoryName: category.name,
    question: `${category.question}（${role.name}重点关注：${role.focus}。）`,
    anchors: category.anchors,
  })));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function scoreAnswer(testCase: InterviewCase, answer: EvaluationAnswer): ScoreCard {
  const normalized = answer.text.toLowerCase();
  const boundaryTerms = ["边界", "核实", "尚未", "不足", "缺少", "不能", "不等同", "复核", "风险"];
  const differentiationTerms = ["数据", "评测", "审计", "业务", "rag", "agent", "产品", "工程"];
  const specificTerms = ["dense retrieval", "rerank", "ragas", "badcase", "mvp", "工作流", "检索", "人审", "引用"];
  const anchorMatches = testCase.anchors.filter((anchor) => normalized.includes(anchor.toLowerCase())).length;
  const differentiationHits = differentiationTerms.filter((term) => normalized.includes(term)).length;
  const boundaryHits = boundaryTerms.filter((term) => normalized.includes(term)).length;
  const specificHits = specificTerms.filter((term) => normalized.includes(term)).length;

  const clarity = clampScore((answer.responseStatus === "completed" ? 2 : 0) + (answer.text.length >= 60 && answer.text.length <= 1_200 ? 1 : 0) + (anchorMatches > 0 ? 1 : 0) + (/\n\s*(?:\d+\.|-|一是|首先)/.test(answer.text) ? 1 : 0));
  const differentiation = differentiationHits >= 6 ? 5
    : differentiationHits >= 4 ? 4
      : differentiationHits >= 2 ? 3
        : 2;
  const credibility = clampScore(1 + (answer.claimIds.length ? 1 : 0) + (answer.sourceIds.length ? 1 : 0) + (boundaryHits ? 1 : 0) + (answer.responseStatus === "completed" ? 1 : 0));
  const followupResilience = clampScore(1 + Math.min(specificHits, 2) + (boundaryHits ? 1 : 0) + (answer.claimIds.length && answer.sourceIds.length ? 1 : 0));
  const interviewConversionIntent = clampScore(1 + (clarity >= 4 ? 1 : 0) + (differentiation >= 3 ? 1 : 0) + (credibility >= 4 ? 1 : 0) + (followupResilience >= 3 ? 1 : 0));
  const total = clarity + differentiation + credibility + followupResilience + interviewConversionIntent;

  return {
    清晰度: clarity,
    差异化: differentiation,
    可信度: credibility,
    追问承受力: followupResilience,
    面试转化意愿: interviewConversionIntent,
    total,
  };
}

function localAnswer(question: string): EvaluationAnswer {
  const assessment = assessQuestion(question);
  if (!assessment.allowed) {
    return { text: assessment.reason, responseStatus: "refused", claimIds: [], sourceIds: [], answerMode: "guardrail" };
  }
  const items = retrieveKnowledge(assessment.question, { limit: 4 });
  const stableAnswer = matchStableAnswer(assessment.question);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  const responseStatus = items.length || stableAnswer ? "completed" : "insufficient_evidence";
  return {
    text: demoAnswer(assessment.question, items, stableAnswer),
    responseStatus,
    claimIds,
    sourceIds,
    answerMode: stableAnswer ? "stable" : "retrieval",
  };
}

async function deepSeekAnswer(testCase: InterviewCase, apiKey: string): Promise<EvaluationAnswer> {
  const fallback = localAnswer(testCase.question);
  if (fallback.responseStatus !== "completed") return fallback;
  const items = retrieveKnowledge(testCase.question, { limit: 4 });
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: `这是合成面试预演。模拟角色：${testCase.roleName}；关注点：${testCase.roleFocus}。只能依据以下公开证据回答：\n${buildContext(items)}` },
        { role: "user", content: testCase.question },
      ],
      thinking: { type: "disabled" },
      stream: false,
      max_tokens: 1_100,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DeepSeek 请求失败（HTTP ${response.status}），未输出任何密钥。`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("DeepSeek 返回空回答。");
  return { ...fallback, text, answerMode: "deepseek" };
}

function average(values: number[]) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
}

function stableReportId(results: InterviewEvaluationResult[], mode: EvaluationMode) {
  const stable = results.map((item) => ({ id: item.id, answer: item.answer, scores: item.scores, passed: item.passed }));
  return createHash("sha256").update(JSON.stringify({ mode, stable })).digest("hex").slice(0, 16);
}

export async function runInterviewEvaluation(options: {
  requestedMode?: "local" | "deepseek" | "auto";
  apiKey?: string;
  generatedAt?: Date;
} = {}): Promise<InterviewEvaluationReport> {
  const requestedMode = options.requestedMode ?? "local";
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  const effectiveMode: EvaluationMode = requestedMode === "deepseek" || (requestedMode === "auto" && apiKey) ? "deepseek" : "local";
  if (requestedMode === "deepseek" && !apiKey) throw new Error("显式 deepseek 模式需要服务端 API 密钥；密钥不会写入报告或日志。");

  const results: InterviewEvaluationResult[] = [];
  for (const testCase of buildInterviewCases()) {
    const answer = effectiveMode === "deepseek" ? await deepSeekAnswer(testCase, apiKey!) : localAnswer(testCase.question);
    const scores = scoreAnswer(testCase, answer);
    results.push({ ...testCase, syntheticSimulation: true, answer, scores, passed: scores.total >= 17 && scores.可信度 >= 3 });
  }

  const averageByDimension = Object.fromEntries(scoreDimensions.map((dimension) => [
    dimension,
    average(results.map((item) => item.scores[dimension])),
  ])) as Record<ScoreDimension, number>;
  const passedCases = results.filter((item) => item.passed).length;
  const roleRecommendations = interviewRoles.map((role) => {
    const roleResults = results.filter((item) => item.roleId === role.id);
    const averageScore = average(roleResults.map((item) => item.scores.total));
    const averageCredibility = average(roleResults.map((item) => item.scores.可信度));
    return {
      roleId: role.id,
      roleName: role.name,
      averageScore,
      averageCredibility,
      recommendsNextRound: averageScore >= 17 && averageCredibility >= 3,
    };
  });
  const recommendedRoleCount = roleRecommendations.filter((item) => item.recommendsNextRound).length;
  const passedRecommendationGate = recommendedRoleCount >= 5;
  const passedQualityGate = averageByDimension.清晰度 >= 4 && averageByDimension.差异化 >= 4;
  const reportId = stableReportId(results, effectiveMode);
  return {
    schemaVersion: 1,
    reportId,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    simulation: {
      synthetic: true,
      label: "AI 合成面试预演，不代表真实招聘方意见，不能替代 5 人真人软测试。",
      replacesHumanTesting: false,
      roleCount: interviewRoles.length,
      categoryCount: questionCategories.length,
      caseCount: results.length,
    },
    execution: {
      requestedMode,
      effectiveMode,
      ...(effectiveMode === "deepseek" ? { model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash" } : {}),
    },
    scoring: { scale: "0-5", dimensions: scoreDimensions, casePassThreshold: 17, recommendedRoleThreshold: 5, qualityAverageThreshold: 4 },
    summary: {
      passedCases,
      failedCases: results.length - passedCases,
      passRate: Number((passedCases / results.length).toFixed(4)),
      averageScore: average(results.map((item) => item.scores.total)),
      averageByDimension,
      recommendedRoleCount,
      passedRecommendationGate,
      passedQualityGate,
      passedLaunchGate: passedRecommendationGate && passedQualityGate,
    },
    roleRecommendations,
    results,
  };
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function resolveReportOutputPath(value = "output/ai-interview-simulation.json") {
  const outputRoot = path.resolve("output");
  const resolved = path.resolve(value);
  const relative = path.relative(outputRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("面试预演报告只能写入已忽略的 output/ 目录。");
  }
  return resolved;
}

export function launchExitCode(report: Pick<InterviewEvaluationReport, "summary">) {
  return report.summary.passedLaunchGate ? 0 : 1;
}

async function main() {
  const requestedMode = (argument("--mode") ?? "local") as "local" | "deepseek" | "auto";
  if (!(["local", "deepseek", "auto"] as const).includes(requestedMode)) throw new Error("--mode 仅支持 local、deepseek 或 auto。");
  const outputPath = resolveReportOutputPath(argument("--output"));
  const report = await runInterviewEvaluation({ requestedMode });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.info(`AI 面试预演完成：${report.simulation.caseCount} 个合成用例，${report.summary.recommendedRoleCount}/6 个模拟角色建议进入下一轮。`);
  console.info(`质量门禁：清晰度 ${report.summary.averageByDimension.清晰度}/5，差异化 ${report.summary.averageByDimension.差异化}/5，要求均不低于 ${report.scoring.qualityAverageThreshold}/5。`);
  console.info(`最终上线门禁：${report.summary.passedLaunchGate ? "通过" : "未通过"}。`);
  console.info(report.simulation.label);
  console.info(`报告：${path.relative(process.cwd(), outputPath) || path.basename(outputPath)}`);
  process.exitCode = launchExitCode(report);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "AI 面试预演失败。");
    process.exitCode = 1;
  });
}
