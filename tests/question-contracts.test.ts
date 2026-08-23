import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerPlan } from "../lib/answer.ts";
import { extractAnswerEmphasis, isHighSignalEmphasis } from "../lib/answer-format.ts";
import { answerSimilarity, validateAnswer } from "../lib/answer-quality.ts";
import { retrieveKnowledge } from "../lib/knowledge.ts";
import {
  buildLocalQuestionFrame,
  findQuestionContract,
  frameFromContract,
  questionContracts,
} from "../lib/question-contracts.ts";
import { getFollowUpQuestions, recommendationQuestionCandidates } from "../lib/question-suggestions.ts";

const screenshotCases = [
  { question: "请介绍一下你的百川智能实习。", contractId: "baichuan_internship", topic: "rag", facet: "overview", requiredIds: ["K27", "K4", "K28", "K31"], forbidden: /DeepFlow|Thirty-Minute Brain/ },
  { question: "RAG 项目体现了你哪些产品方法？", contractId: "rag_methods", topic: "rag", facet: "method", requiredIds: ["K28", "K29", "K31"], forbidden: /DeepFlow|审计|Thirty-Minute Brain/ },
  { question: "Evaluator Agent 项目具体做了什么？", contractId: "baidu_project", topic: "baidu", facet: "architecture", requiredIds: ["K23", "K24", "K25", "K32"], forbidden: /RAG|DeepFlow|审计/ },
  { question: "你如何证明自动评测结果可信？", contractId: "baidu_reliability", topic: "baidu", facet: "evaluation", requiredIds: ["K24", "K25"], forbidden: /RAG|DeepFlow|审计/ },
  { question: "应用统计学背景如何帮助你做 AI 产品？", contractId: "statistics_product", topic: "statistics", facet: "transfer", requiredIds: ["K3", "K17"], forbidden: /DeepFlow|Thirty-Minute Brain/ },
  { question: "你的实习经历沉淀了哪些可迁移能力？", contractId: "internship_transfer", topic: "profile", facet: "transfer", requiredIds: ["K1", "K8", "K27", "K19"], forbidden: /Thirty-Minute Brain/ },
  { question: "举一个审计问题转成产品的例子。", contractId: "audit_product_example", topic: "audit", facet: "example", requiredIds: ["K7"], forbidden: /RAG|DeepFlow|Thirty-Minute Brain/ },
  { question: "你的统计学背景能怎样支持产品决策？", contractId: "statistics_product", topic: "statistics", facet: "transfer", requiredIds: ["K3", "K17"], forbidden: /DeepFlow|Thirty-Minute Brain/ },
  { question: "你的专业对你做 AI 产品有什么帮助？", contractId: "profession_value", topic: "statistics", facet: "transfer", requiredIds: ["K3", "K17", "K8", "K9"], forbidden: /DeepFlow|Thirty-Minute Brain/ },
  { question: "Ask Me 项目体现了你什么能力？", contractId: "ask_me_capability", topic: "ask_me", facet: "method", requiredIds: ["K12", "K38"], forbidden: /百川|DeepFlow|审计|Thirty-Minute Brain/ },
  { question: "Agent 之间如何协作？", contractId: "agent_collaboration", topic: "deepflow", facet: "collaboration", requiredIds: ["K18", "K19", "K21"], forbidden: /RAG|审计|Thirty-Minute Brain/ },
] as const;

test("推荐候选全部拥有可执行的问题契约", () => {
  const uncovered = recommendationQuestionCandidates.filter((question) => !findQuestionContract(question));
  assert.deepEqual(uncovered, []);
});

test("核心深层对话问题按主题和维度定向检索", () => {
  for (const fixture of screenshotCases) {
    const contract = findQuestionContract(fixture.question);
    assert.equal(contract?.id, fixture.contractId);
    assert.equal(contract?.frame.topic, fixture.topic);
    assert.equal(contract?.frame.facet, fixture.facet);
    const frame = frameFromContract(contract!);
    const items = retrieveKnowledge(fixture.question, { frame, limit: 4 });
    assert.deepEqual(items.map((item) => item.id), [...fixture.requiredIds]);
  }
});

test("核心专属兜底直接回答且不泄漏无关主题", () => {
  for (const fixture of screenshotCases) {
    const contract = findQuestionContract(fixture.question)!;
    const frame = frameFromContract(contract);
    const items = retrieveKnowledge(fixture.question, { frame, limit: 4 });
    const plan = buildAnswerPlan(fixture.question, items, undefined, [], frame, contract);
    assert.doesNotMatch(plan.fallbackAnswer, fixture.forbidden);
    assert.doesNotMatch(plan.fallbackAnswer, /进一步判断|实践依据|落地方式|我提供并确认|我提供并授权/);
    assert.equal(validateAnswer(plan.fallbackAnswer, plan).passed, true, `${fixture.contractId}: ${validateAnswer(plan.fallbackAnswer, plan).triggers.join(", ")}`);
  }
});

test("长尾问题通过本地 Frame 限定主题，未知题保留规划入口", () => {
  const routed = buildLocalQuestionFrame("RAG 的引用质量出了问题时，你会先检查哪里？");
  assert.equal(routed.topic, "rag");
  assert.equal(routed.facet, "evaluation");
  assert.equal(routed.confidence >= 0.8, true);

  const unknown = buildLocalQuestionFrame("如果资源突然减半，你会怎么排优先级？");
  assert.equal(unknown.confidence >= 0.8, true);
  assert.equal(unknown.questionMode, "candidate_reasoning");
  assert.equal(unknown.routeSource, "local");
});

test("第 4 至 8 轮推荐仍由契约驱动并保持回答差异", () => {
  const asked: string[] = [];
  const answers: string[] = [];
  let current = "60 秒了解张倬玮。";
  for (let turn = 0; turn < 8; turn += 1) {
    const contract = findQuestionContract(current)!;
    const frame = frameFromContract(contract);
    const items = retrieveKnowledge(current, { frame, limit: 4 });
    const history = answers.flatMap((answer, index) => ([
      { role: "user" as const, content: asked[index] },
      { role: "assistant" as const, content: answer },
    ]));
    const plan = buildAnswerPlan(current, items, undefined, history, frame, contract);
    if (answers.length) assert.equal(answerSimilarity(plan.fallbackAnswer, answers.at(-1)!) < 0.62, true);
    asked.push(current);
    answers.push(plan.fallbackAnswer);
    const recommendations = getFollowUpQuestions(current, asked, 3);
    assert.equal(recommendations.length, 3);
    recommendations.forEach((question) => assert.ok(findQuestionContract(question)));
    current = recommendations[0];
  }
});

test("所有契约的稳定兜底均通过相关性与事实门禁", () => {
  const failures = questionContracts.flatMap((contract) => {
    const frame = frameFromContract(contract);
    const items = retrieveKnowledge(contract.question, { frame, limit: 4 });
    const plan = buildAnswerPlan(contract.question, items, undefined, [], frame, contract);
    const result = validateAnswer(plan.fallbackAnswer, plan);
    return result.passed ? [] : [`${contract.id}: ${result.triggers.join(", ")}`];
  });
  assert.deepEqual(failures, []);
});

test("长篇契约回答使用两到三个高信息量阅读重点", () => {
  for (const contract of questionContracts) {
    const emphasized = extractAnswerEmphasis(contract.fallbackAnswer);
    assert.equal(emphasized.length >= 2 && emphasized.length <= 3, true, contract.id);
    assert.equal(emphasized.every(isHighSignalEmphasis), true, `${contract.id}: ${emphasized.join(" | ")}`);
  }
});
