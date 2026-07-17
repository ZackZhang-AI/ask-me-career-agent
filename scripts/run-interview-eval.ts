import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAnswerPlan, buildContext, demoAnswer, systemPrompt } from "../lib/answer.ts";
import { repairInstruction, validateAnswer } from "../lib/answer-quality.ts";
import { assessQuestion } from "../lib/guardrails.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import type { ResponseStatus } from "../lib/types.ts";
import { coreCases, hallucinationCases, type EvaluationCase } from "../tests/evals/cases.ts";

export type EvaluationMode = "local" | "deepseek";

export const interviewRoles = [
  { id: "ai_pm_strategy", name: "AI 产品经理·策略型", focus: "用户价值、产品取舍和岗位匹配" },
  { id: "ai_pm_delivery", name: "AI 产品经理·交付型", focus: "MVP、协作、落地和复盘" },
  { id: "hr_screening", name: "HR·初筛", focus: "定位、经历可信度和沟通效率" },
  { id: "hr_business", name: "HR·业务招聘", focus: "岗位适配、动机、短板和风险" },
  { id: "ai_practitioner_agent", name: "AI 产品从业者·Agent", focus: "Agent 工作流、人审和工程边界" },
  { id: "ai_practitioner_eval", name: "AI 产品从业者·评测", focus: "RAG、评测、引用和失败分析" },
] as const;

export const questionCategories = [
  { id: "sixty_second_intro", name: "60 秒介绍", question: "请用 60 秒介绍张倬玮，并说明最值得继续面试的三个差异点。", anchors: ["AI 产品", "数据", "业务"] },
  { id: "role_fit", name: "岗位匹配", question: "他为什么适合初级 AI 产品经理岗位？", anchors: ["AI 产品", "评测", "业务"] },
  { id: "representative_project", name: "代表项目", question: "哪个项目最能代表他的 AI 产品能力？请说明项目价值。", anchors: ["RAG", "检索", "产品"] },
  { id: "personal_contribution", name: "个人贡献", question: "他在 RAG 项目中具体做了什么？请区分本人判断与 AI 辅助。", anchors: ["负责", "AI", "判断"] },
  { id: "ai_coding_share", name: "AI 编程占比", question: "这些项目里 AI 编程工具承担了多少工作？请说明候选人本人判断与 AI 辅助的边界。", anchors: ["AI", "负责", "工具"] },
  { id: "challenge_or_failure", name: "挑战或失败", question: "请讲一个项目中的真实挑战或失败，并说明如何定位、调整和验证。", anchors: ["问题", "取舍", "验证"] },
  { id: "user_business_value", name: "用户与业务价值", question: "这些项目服务什么用户、解决什么业务问题，目前有什么价值？", anchors: ["问题", "产品", "价值"] },
  { id: "next_round_recommendation", name: "是否建议进入下一轮", question: "基于当前公开信息，你是否建议安排下一轮初步面试？请给出理由，不要给录用结论。", anchors: ["下一轮", "价值", "能力"] },
] as const;

export const scoreDimensions = ["清晰度", "差异化", "可信度", "追问承受力", "面试转化意愿"] as const;
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
  forbiddenPatterns?: RegExp[];
  boundaryExpected?: boolean;
}

export interface EvaluationAnswer {
  text: string;
  responseStatus: ResponseStatus;
  claimIds: string[];
  sourceIds: string[];
  answerMode: "stable" | "retrieval" | "deepseek" | "guardrail";
}

export interface AnswerQuality {
  hardFactsPassed: boolean;
  hardFactViolations: string[];
  contentCoverage: number;
  missingSemanticGroups: string[][];
  length: number;
  lengthCompliant: boolean;
  structureCompliant: boolean;
  boilerplateHits: string[];
  internalWordingHits: string[];
  opening: string;
}

export interface InterviewEvaluationResult extends InterviewCase {
  syntheticSimulation: true;
  answer: EvaluationAnswer;
  quality: AnswerQuality;
  scores: ScoreCard;
  passed: boolean;
}

export interface MultiTurnResult {
  id: string;
  project: "RAG" | "DeepFlow";
  turns: Array<{ question: string; answer: EvaluationAnswer; quality: AnswerQuality }>;
  pronounResolved: boolean;
  passed: boolean;
}

export interface InterviewEvaluationReport {
  schemaVersion: 2;
  reportId: string;
  generatedAt: string;
  simulation: { synthetic: true; label: string; replacesHumanTesting: false; roleCount: number; categoryCount: number; caseCount: number };
  execution: { requestedMode: "local" | "deepseek" | "auto"; effectiveMode: EvaluationMode; model?: string };
  scoring: { scale: "0-5"; dimensions: readonly ScoreDimension[]; casePassThreshold: number; recommendedRoleThreshold: 5; qualityAverageThreshold: 4.3; targetLength: "300-500" };
  qualityGates: {
    hardFactsPassed: boolean;
    hallucinationRegressionPassed: boolean;
    hardFactViolationCount: number;
    coreContentCoverage: number;
    coreContentPassed: boolean;
    lengthComplianceRate: number;
    structureComplianceRate: number;
    boilerplateCaseCount: number;
    internalWordingCaseCount: number;
    repeatedOpeningPairs: string[];
    multiTurnPassed: boolean;
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
  roleRecommendations: Array<{ roleId: string; roleName: string; averageScore: number; averageCredibility: number; recommendsNextRound: boolean }>;
  coreResults: Array<{ id: string; answer: EvaluationAnswer; quality: AnswerQuality; passed: boolean }>;
  hallucinationResults: Array<{ id: string; answer: EvaluationAnswer; quality: AnswerQuality; passed: boolean }>;
  multiTurnResults: MultiTurnResult[];
  results: InterviewEvaluationResult[];
}

const knownHallucinations: Array<[string, RegExp]> = [
  ["虚构项目：校园数据门户", /校园数据门户/i],
  ["虚构测试评审数量", /30\s*(?:个|次|份)?(?:测试|评审|review)/i],
  ["虚构贡献点比例", /62\s*%/],
  ["虚构每日提交量", /22\s*(?:次|份|个)?\s*\/?\s*(?:天|日)/],
  ["虚构跳出率降幅", /跳出率.{0,12}(?:下降|降低|-).{0,6}40\s*%/i],
  ["虚构满意度提升", /满意度.{0,12}40\s*%.{0,12}90\s*%/i],
  ["虚构 DeepFlow 测试任务", /10\s*(?:个|次)?任务/i],
  ["虚构任务耗时降幅", /耗时.{0,12}(?:低于|少于|降至).{0,6}30\s*%/i],
  ["虚构全部任务效果", /全部任务.{0,12}(?:不再|没有).{0,6}(?:跑偏|偏题)/i],
  ["虚构引用准确率提升", /引用准确率.{0,12}(?:提升|提高|增长).{0,8}\d/i],
  ["虚构引用准确率显著提升", /引用准确率.{0,12}(?:明显|显著)(?:提升|提高|改善)/i],
  ["虚构生产或商业化状态", /(?:RAG|DeepFlow).{0,30}(?:已经|已).{0,8}(?:生产上线|正式上线|商业化)/i],
];

const boilerplate = ["好的，我来讲一下", "好的，我讲一个", "核心判断是", "需要面试核实", "证据边界"];
const internalWording = [/\bClaim\s*ID\b/i, /\bSource\s*ID\b/i, /\bC\d+\b/, /\bS\d+\b/, /证据边界/, /内部状态/, /需要面试核实/];

export function buildInterviewCases(): InterviewCase[] {
  return interviewRoles.flatMap((role) => questionCategories.map((category) => ({
    id: `${role.id}__${category.id}`,
    roleId: role.id,
    roleName: role.name,
    roleFocus: role.focus,
    categoryId: category.id,
    categoryName: category.name,
    question: category.question,
    anchors: category.anchors,
    boundaryExpected: category.id === "ai_coding_share",
  })));
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function semanticCoverage(text: string, groups: readonly (readonly string[])[]) {
  if (!groups.length) return { rate: 1, missing: [] as string[][] };
  const value = normalize(text);
  const missing = groups.filter((group) => !group.some((term) => value.includes(term.toLowerCase()))).map((group) => [...group]);
  return { rate: Number(((groups.length - missing.length) / groups.length).toFixed(4)), missing };
}

function openingOf(text: string) {
  return text.replace(/[#*_>`\-\d.、\s]/g, "").slice(0, 24);
}

function hasInterviewStructure(text: string) {
  const boldSections = text.match(/\*\*[^*\n]{2,20}\*\*/g)?.length ?? 0;
  const listSections = text.match(/(?:^|\n)\s*(?:[-•]|[一二三四五]|\d+[.、])\s*/g)?.length ?? 0;
  const paragraphs = text.split(/\n\s*\n/).filter((item) => item.trim()).length;
  return (boldSections >= 2 && boldSections <= 3) || (listSections >= 2 && listSections <= 3) || paragraphs >= 3;
}

export function evaluateAnswerQuality(
  text: string,
  fixture: Pick<EvaluationCase, "requiredSemanticGroups" | "forbiddenPatterns" | "forbiddenFacts" | "expectedStructure"> & { anchors?: readonly string[] },
): AnswerQuality {
  const groups = fixture.requiredSemanticGroups ?? fixture.anchors?.map((anchor) => [anchor]) ?? [];
  const coverage = semanticCoverage(text, groups);
  const violations: string[] = [];
  for (const [label, pattern] of knownHallucinations) if (pattern.test(text)) violations.push(label);
  for (const pattern of fixture.forbiddenPatterns ?? []) if (pattern.test(text)) violations.push(`用例禁止事实：${pattern.source}`);
  for (const fact of fixture.forbiddenFacts ?? []) {
    if (fact.length >= 4 && text.includes(fact)) violations.push(`禁止事实：${fact}`);
  }
  const boilerplateHits = boilerplate.filter((term) => text.includes(term));
  const internalWordingHits = internalWording.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  return {
    hardFactsPassed: violations.length === 0,
    hardFactViolations: [...new Set(violations)],
    contentCoverage: coverage.rate,
    missingSemanticGroups: coverage.missing,
    length: text.length,
    lengthCompliant: text.length >= 300 && text.length <= 500,
    structureCompliant: fixture.expectedStructure === "direct" ? text.trim().length > 0 : hasInterviewStructure(text),
    boilerplateHits,
    internalWordingHits,
    opening: openingOf(text),
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(5, Math.round(value)));
}

export function scoreAnswer(testCase: InterviewCase, answer: EvaluationAnswer, quality: AnswerQuality): ScoreCard {
  const normalized = normalize(answer.text);
  const differentiationTerms = ["数据", "评测", "审计", "业务", "rag", "agent", "产品", "工程", "取舍", "验收"];
  const specificTerms = ["dense retrieval", "rerank", "ragas", "badcase", "mvp", "工作流", "检索", "人审", "引用"];
  const differentiationHits = differentiationTerms.filter((term) => normalized.includes(term)).length;
  const specificHits = specificTerms.filter((term) => normalized.includes(term)).length;
  const clarity = clampScore((answer.responseStatus === "completed" ? 2 : 0) + (quality.contentCoverage === 1 ? 1 : 0) + (quality.structureCompliant ? 1 : 0) + (quality.lengthCompliant ? 1 : 0));
  const differentiation = differentiationHits >= 6 ? 5 : differentiationHits >= 4 ? 4 : differentiationHits >= 2 ? 3 : 2;
  // 可信度只由事实安全、正文覆盖和表达克制决定；Claim/Source 元数据和“边界”词不参与加分。
  const credibility = quality.hardFactsPassed
    ? clampScore(2 + (answer.responseStatus === "completed" ? 1 : 0) + (quality.contentCoverage === 1 ? 1 : 0) + (quality.internalWordingHits.length === 0 ? 1 : 0))
    : 0;
  const followupResilience = quality.hardFactsPassed
    ? clampScore(1 + Math.min(specificHits, 2) + (quality.contentCoverage === 1 ? 1 : 0) + (answer.text.length >= 220 ? 1 : 0))
    : 0;
  const interviewConversionIntent = clampScore(1 + (clarity >= 4 ? 1 : 0) + (differentiation >= 4 ? 1 : 0) + (credibility >= 4 ? 1 : 0) + (followupResilience >= 4 ? 1 : 0));
  return { 清晰度: clarity, 差异化: differentiation, 可信度: credibility, 追问承受力: followupResilience, 面试转化意愿: interviewConversionIntent, total: clarity + differentiation + credibility + followupResilience + interviewConversionIntent };
}

function localAnswer(question: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): EvaluationAnswer {
  const assessment = assessQuestion(question);
  if (!assessment.allowed) return { text: assessment.reason, responseStatus: "refused", claimIds: [], sourceIds: [], answerMode: "guardrail" };
  const items = retrieveKnowledge(assessment.question, { history, limit: 4 });
  const stableAnswer = matchStableAnswer(assessment.question, history);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  return {
    text: demoAnswer(assessment.question, items, stableAnswer),
    responseStatus: items.length || stableAnswer ? "completed" : "insufficient_evidence",
    claimIds,
    sourceIds,
    answerMode: stableAnswer ? "stable" : "retrieval",
  };
}

async function deepSeekAnswer(testCase: Pick<InterviewCase, "question" | "roleName" | "roleFocus">, apiKey: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<EvaluationAnswer> {
  const fallback = localAnswer(testCase.question, history);
  if (fallback.responseStatus !== "completed") return fallback;
  const items = retrieveKnowledge(testCase.question, { history, limit: 4 });
  const stableAnswer = matchStableAnswer(testCase.question, history);
  const plan = buildAnswerPlan(testCase.question, items, stableAnswer, history);
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const context = `这是合成面试预演。模拟角色：${testCase.roleName}；关注点：${testCase.roleFocus}。只能依据以下回答计划和公开事实作答：\n${buildContext(items, plan)}`;
  const generate = async (extraInstruction?: string) => {
    const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: context },
          ...(extraInstruction ? [{ role: "system" as const, content: extraInstruction }] : []),
          ...history,
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
    return text;
  };
  const first = await generate();
  const firstGate = validateAnswer(first, plan);
  if (firstGate.passed) return { ...fallback, text: first, answerMode: "deepseek" };
  const repaired = await generate(repairInstruction(plan, firstGate.triggers));
  const repairedGate = validateAnswer(repaired, plan);
  return { ...fallback, text: repairedGate.passed ? repaired : plan.fallbackAnswer, answerMode: repairedGate.passed ? "deepseek" : fallback.answerMode };
}

async function answerForCase(testCase: Pick<InterviewCase, "question" | "roleName" | "roleFocus">, mode: EvaluationMode, apiKey?: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) {
  if (mode === "deepseek") return deepSeekAnswer(testCase, apiKey!, history);
  return localAnswer(testCase.question, history);
}

function average(values: number[]) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
}

const multiTurnFixtures = [
  { id: "MT-RAG-CONTRIBUTION", project: "RAG" as const, questions: ["介绍一下你的 RAG 知识库项目。", "这个项目中你本人做了什么？", "其中最难的取舍是什么？"], required: [["RAG"], ["判断", "取舍", "验收"], ["检索", "引用", "评测"]] },
  { id: "MT-RAG-RESULT", project: "RAG" as const, questions: ["RAG 项目解决了什么问题？", "它现在取得了什么结果？", "那还有哪些短板？"], required: [["RAG", "知识库", "专业文档"], ["完成", "实现", "可演示"], ["生产", "规模", "短板", "不足"]] },
  { id: "MT-DEEPFLOW-CHALLENGE", project: "DeepFlow" as const, questions: ["介绍一下 DeepFlow。", "这个项目遇到的挑战是什么？", "你当时如何调整和验证？"], required: [["DeepFlow"], ["挑战", "跑偏", "漂移"], ["人审", "检查", "验证"]] },
] as const;

async function runMultiTurn(mode: EvaluationMode, apiKey?: string): Promise<MultiTurnResult[]> {
  const results: MultiTurnResult[] = [];
  for (const fixture of multiTurnFixtures) {
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    const turns: MultiTurnResult["turns"] = [];
    for (let index = 0; index < fixture.questions.length; index += 1) {
      const question = fixture.questions[index];
      const answer = await answerForCase({ question, roleName: "AI 产品面试官", roleFocus: "多轮追问和项目细节" }, mode, apiKey, history);
      const quality = evaluateAnswerQuality(answer.text, { requiredSemanticGroups: [[...fixture.required[index]]], expectedStructure: index === 0 ? "interview" : "direct", forbiddenFacts: [], forbiddenPatterns: [] });
      turns.push({ question, answer, quality });
      history.push({ role: "user", content: question }, { role: "assistant", content: answer.text });
    }
    const pronounResolved = turns.slice(1).every((turn) => normalize(turn.answer.text).includes(fixture.project.toLowerCase()) || turn.quality.contentCoverage === 1);
    results.push({ id: fixture.id, project: fixture.project, turns, pronounResolved, passed: pronounResolved && turns.every((turn) => turn.quality.hardFactsPassed && turn.quality.contentCoverage === 1) });
  }
  return results;
}

function repeatedOpenings(results: InterviewEvaluationResult[]) {
  const repeated: string[] = [];
  for (const role of interviewRoles) {
    const roleResults = results.filter((item) => item.roleId === role.id);
    for (let index = 1; index < roleResults.length; index += 1) {
      if (roleResults[index].quality.opening && roleResults[index].quality.opening === roleResults[index - 1].quality.opening) repeated.push(`${roleResults[index - 1].id} -> ${roleResults[index].id}`);
    }
  }
  return repeated;
}

function stableReportId(results: InterviewEvaluationResult[], mode: EvaluationMode) {
  return createHash("sha256").update(JSON.stringify({ mode, results })).digest("hex").slice(0, 16);
}

export async function runInterviewEvaluation(options: { requestedMode?: "local" | "deepseek" | "auto"; apiKey?: string; generatedAt?: Date } = {}): Promise<InterviewEvaluationReport> {
  const requestedMode = options.requestedMode ?? "local";
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  const effectiveMode: EvaluationMode = requestedMode === "deepseek" || (requestedMode === "auto" && apiKey) ? "deepseek" : "local";
  if (requestedMode === "deepseek" && !apiKey) throw new Error("显式 deepseek 模式需要服务端 API 密钥；密钥不会写入报告或日志。");

  const results: InterviewEvaluationResult[] = [];
  for (const testCase of buildInterviewCases()) {
    const answer = await answerForCase(testCase, effectiveMode, apiKey);
    const quality = evaluateAnswerQuality(answer.text, { anchors: testCase.anchors, forbiddenFacts: [], forbiddenPatterns: testCase.forbiddenPatterns, expectedStructure: "interview" });
    const scores = scoreAnswer(testCase, answer, quality);
    results.push({ ...testCase, syntheticSimulation: true, answer, quality, scores, passed: quality.hardFactsPassed && quality.contentCoverage === 1 && scores.total >= 18 && scores.可信度 >= 4 });
  }

  const coreResults = [] as InterviewEvaluationReport["coreResults"];
  for (const fixture of coreCases) {
    const answer = await answerForCase({ question: fixture.question, roleName: "AI 产品面试官", roleFocus: "核心事实和岗位表达" }, effectiveMode, apiKey);
    const quality = evaluateAnswerQuality(answer.text, fixture);
    const metadataCovered = fixture.requiredClaimIds.every((id) => answer.claimIds.includes(id)) && fixture.requiredSourceIds.every((id) => answer.sourceIds.includes(id));
    coreResults.push({ id: fixture.id, answer, quality, passed: metadataCovered && quality.contentCoverage === 1 && quality.hardFactsPassed });
  }
  const multiTurnResults = await runMultiTurn(effectiveMode, apiKey);
  const hallucinationResults = [] as InterviewEvaluationReport["hallucinationResults"];
  for (const fixture of hallucinationCases) {
    const answer = await answerForCase({ question: fixture.question, roleName: "事实核查面试官", roleFocus: "数字、结果与完成状态" }, effectiveMode, apiKey);
    const quality = evaluateAnswerQuality(answer.text, fixture);
    hallucinationResults.push({ id: fixture.id, answer, quality, passed: quality.hardFactsPassed && quality.contentCoverage === 1 });
  }

  const averageByDimension = Object.fromEntries(scoreDimensions.map((dimension) => [dimension, average(results.map((item) => item.scores[dimension]))])) as Record<ScoreDimension, number>;
  const passedCases = results.filter((item) => item.passed).length;
  const roleRecommendations = interviewRoles.map((role) => {
    const roleResults = results.filter((item) => item.roleId === role.id);
    const averageScore = average(roleResults.map((item) => item.scores.total));
    const averageCredibility = average(roleResults.map((item) => item.scores.可信度));
    return { roleId: role.id, roleName: role.name, averageScore, averageCredibility, recommendsNextRound: roleResults.every((item) => item.quality.hardFactsPassed) && averageScore >= 18 && averageCredibility >= 4.3 };
  });
  const recommendedRoleCount = roleRecommendations.filter((item) => item.recommendsNextRound).length;
  const repeatedOpeningPairs = repeatedOpenings(results);
  const allQualities = [...results.map((item) => item.quality), ...coreResults.map((item) => item.quality), ...hallucinationResults.map((item) => item.quality), ...multiTurnResults.flatMap((item) => item.turns.map((turn) => turn.quality))];
  const hardFactViolationCount = allQualities.reduce((sum, item) => sum + item.hardFactViolations.length, 0);
  const qualityGates = {
    hardFactsPassed: hardFactViolationCount === 0,
    hallucinationRegressionPassed: hallucinationResults.every((item) => item.passed),
    hardFactViolationCount,
    coreContentCoverage: Number((coreResults.filter((item) => item.passed).length / coreResults.length).toFixed(4)),
    coreContentPassed: coreResults.every((item) => item.passed),
    lengthComplianceRate: Number((allQualities.filter((item) => item.lengthCompliant).length / allQualities.length).toFixed(4)),
    structureComplianceRate: Number((allQualities.filter((item) => item.structureCompliant).length / allQualities.length).toFixed(4)),
    boilerplateCaseCount: allQualities.filter((item) => item.boilerplateHits.length).length,
    internalWordingCaseCount: allQualities.filter((item) => item.internalWordingHits.length).length,
    repeatedOpeningPairs,
    multiTurnPassed: multiTurnResults.every((item) => item.passed),
  };
  const passedRecommendationGate = recommendedRoleCount >= 5;
  const passedQualityGate = averageByDimension.清晰度 >= 4.3 && averageByDimension.差异化 >= 4.3 && averageByDimension.可信度 >= 4.3;
  const passedLaunchGate = passedRecommendationGate && passedQualityGate && qualityGates.hardFactsPassed && qualityGates.hallucinationRegressionPassed && qualityGates.coreContentPassed && qualityGates.lengthComplianceRate >= 0.9 && qualityGates.internalWordingCaseCount === 0 && qualityGates.repeatedOpeningPairs.length === 0 && qualityGates.multiTurnPassed;
  return {
    schemaVersion: 2,
    reportId: stableReportId(results, effectiveMode),
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    simulation: { synthetic: true, label: "AI 合成面试预演，不代表真实招聘方意见，不能替代真人测试。", replacesHumanTesting: false, roleCount: interviewRoles.length, categoryCount: questionCategories.length, caseCount: results.length },
    execution: { requestedMode, effectiveMode, ...(effectiveMode === "deepseek" ? { model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash" } : {}) },
    scoring: { scale: "0-5", dimensions: scoreDimensions, casePassThreshold: 18, recommendedRoleThreshold: 5, qualityAverageThreshold: 4.3, targetLength: "300-500" },
    qualityGates,
    summary: { passedCases, failedCases: results.length - passedCases, passRate: Number((passedCases / results.length).toFixed(4)), averageScore: average(results.map((item) => item.scores.total)), averageByDimension, recommendedRoleCount, passedRecommendationGate, passedQualityGate, passedLaunchGate },
    roleRecommendations,
    coreResults,
    hallucinationResults,
    multiTurnResults,
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
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("面试预演报告只能写入已忽略的 output/ 目录。");
  return resolved;
}

export function launchExitCode(report: Pick<InterviewEvaluationReport, "summary">) {
  return report.summary.passedLaunchGate ? 0 : 1;
}

async function main() {
  const requestedMode = (argument("--mode") ?? "local") as "local" | "deepseek" | "auto";
  if (!( ["local", "deepseek", "auto"] as const).includes(requestedMode)) throw new Error("--mode 仅支持 local、deepseek 或 auto。");
  const outputPath = resolveReportOutputPath(argument("--output"));
  const report = await runInterviewEvaluation({ requestedMode });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.info(`AI 面试预演完成：${report.simulation.caseCount} 个角色用例，${report.summary.recommendedRoleCount}/6 个模拟角色建议进入下一轮。`);
  console.info(`硬事实：${report.qualityGates.hardFactViolationCount} 个违规；核心覆盖：${(report.qualityGates.coreContentCoverage * 100).toFixed(0)}%；长度合规：${(report.qualityGates.lengthComplianceRate * 100).toFixed(0)}%。`);
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
