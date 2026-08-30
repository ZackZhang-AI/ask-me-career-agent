import assert from "node:assert/strict";
import test from "node:test";
import { candidateNarrative } from "../content/narrative.ts";
import { buildAnswerPlan, systemPrompt } from "../lib/answer.ts";
import { splitQualityTriggers, validateAnswer } from "../lib/answer-quality.ts";
import { parseAnswerEmphasis } from "../lib/answer-format.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import { buildLocalQuestionFrame } from "../lib/question-contracts.ts";

const question = "哪个项目最能代表他的 AI 产品能力？";
const stable = matchStableAnswer(question);
assert.ok(stable);
const plan = buildAnswerPlan(question, retrieveKnowledge(question), stable);

test("60 秒自我介绍以个人特质总结收尾", () => {
  const introductionQuestion = "请用 60 秒介绍张倬玮。";
  const introduction = matchStableAnswer(introductionQuestion);
  assert.ok(introduction);
  const introductionPlan = buildAnswerPlan(
    introductionQuestion,
    retrieveKnowledge(introductionQuestion),
    introduction,
  );

  assert.match(introductionPlan.fallbackAnswer, /持之以恒/);
  assert.match(introductionPlan.fallbackAnswer, /学习能力/);
  assert.match(introductionPlan.fallbackAnswer, /抗压能力/);
  assert.doesNotMatch(introductionPlan.fallbackAnswer, /希望(?:加入|进入).*团队/);
  for (const answer of Object.values(candidateNarrative.introductions)) {
    assert.doesNotMatch(answer, /希望(?:加入|进入).*团队/);
  }
});

test("质量门禁拒绝资料外的项目、数字与业务结果", () => {
  const result = validateAnswer(
    "我做过校园数据门户。\n\n**用户调研**：访谈了 30 人。\n\n**业务结果**：满意度从 40% 提升到 90%。",
    plan,
  );
  assert.equal(result.passed, false);
  assert.equal(result.triggers.includes("unsupported_number"), true);
  assert.equal(result.triggers.some((item) => item.includes("校园数据门户")), true);
});

test("质量门禁拒绝内部审计措辞和模板化开头", () => {
  const result = validateAnswer(
    `好的，我来讲一下。${plan.fallbackAnswer}需要面试核实。`,
    plan,
  );
  assert.equal(result.passed, false);
  assert.equal(result.triggers.some((item) => item.startsWith("boilerplate:")), true);
});

test("结构化事实骨架回退使用 RAG 代表项目且不包含内部标签", () => {
  assert.match(plan.fallbackAnswer, /RAG Knowledge Base System/);
  assert.match(plan.fallbackAnswer, /\*\*医疗私有文档可信问答\*\*/);
  assert.doesNotMatch(plan.fallbackAnswer, /进一步判断|实践依据|落地方式/);
  assert.match(plan.fallbackAnswer, /Dense Retrieval/);
  assert.doesNotMatch(plan.fallbackAnswer, /AI Coding Evaluator Agent|百度实习/);
  assert.doesNotMatch(plan.fallbackAnswer, /Claim ID|Source ID|证据边界/);
  assert.equal(plan.fallbackAnswer.length >= 390 && plan.fallbackAnswer.length <= 540, true);
  assert.equal(validateAnswer(plan.fallbackAnswer, plan).passed, true);
});

test("质量门禁要求模型覆盖事实骨架中的必答语义", () => {
  const repeated = `${plan.thesis}\n\n**项目定位**：${plan.thesis}\n\n**岗位价值**：${plan.thesis}\n\n${plan.thesis}`;
  const result = validateAnswer(repeated, plan);
  assert.equal(result.passed, false);
  assert.equal(result.triggers.some((item) => item.startsWith("missing_required:")), true);
});

test("质量门禁拒绝未记录的组织协作和交付事件", () => {
  const fabricated = `${plan.fallbackAnswer}\n\n**额外成果**：我协调工程团队完成客户交付，并获得了积极反馈。`;
  const result = validateAnswer(fabricated, plan);
  assert.equal(result.passed, false);
  assert.equal(result.triggers.includes("unsupported_event") || result.triggers.includes("unsupported_organization"), true);
});

test("实时流只将事实安全问题视为可撤回失败", () => {
  const triggers = splitQualityTriggers([
    "intent_mismatch:career_transition",
    "missing_required:3",
    "forbidden_topic:RAG",
    "unsupported_number",
  ]);

  assert.deepEqual(triggers.hardSafety, ["unsupported_number"]);
  assert.deepEqual(triggers.semantic, [
    "intent_mismatch:career_transition",
    "missing_required:3",
    "forbidden_topic:RAG",
  ]);
});

test("回答重点会被安全解析为粗体片段", () => {
  const segments = parseAnswerEmphasis("<script>不会执行</script>。\n\n**产品判断**：先定义问题。\n\n**岗位价值**：形成闭环。");
  assert.deepEqual(
    segments.filter((segment) => segment.emphasized).map((segment) => segment.text),
    ["产品判断", "岗位价值"],
  );
  assert.equal(segments.some((segment) => !segment.emphasized && segment.text.includes("<script>")), true);
});

test("质量门禁拒绝过度加粗和整句加粗", () => {
  const overformatted = `${plan.fallbackAnswer}\n\n**额外重点一**、**额外重点二**、**额外重点三**。`;
  const longEmphasis = plan.fallbackAnswer.replace("**可运行、可核验、可迭代**", "**这是一个明显超过长度限制而且不应该被整段加粗的标题文本因为它仍在继续扩展**");
  assert.equal(validateAnswer(overformatted, plan).triggers.includes("excessive_emphasis"), true);
  assert.equal(validateAnswer(longEmphasis, plan).triggers.includes("long_emphasis"), true);
  assert.equal(validateAnswer(longEmphasis, plan).passed, true);
});

test("假设题的方法表达不被误判为未记录事件", () => {
  const hypotheticalQuestion = "如果一个 AI 产品上线后用户反馈效果不好，你会怎么排查？";
  const frame = buildLocalQuestionFrame(hypotheticalQuestion);
  const hypotheticalPlan = buildAnswerPlan(
    hypotheticalQuestion,
    retrieveKnowledge(hypotheticalQuestion, { frame }),
    undefined,
    [],
    frame,
  );
  const result = validateAnswer(
    "我的处理思路是先确认问题影响的用户任务和成功标准。如果产品上线后效果不好，我会先核对数据口径与样本，再按模型、Prompt、检索、工具和交互环节分类 Bad Case，最后固定评测集做单变量复测，用结果决定下一轮优先级。",
    hypotheticalPlan,
  );
  assert.equal(result.triggers.includes("unsupported_event"), false);
});

test("质量门禁拒绝只有栏目作用的加黑词语", () => {
  const lowInformation = plan.fallbackAnswer.replace("**医疗私有文档可信问答**", "**核心项目**");
  assert.equal(validateAnswer(lowInformation, plan).triggers.includes("low_information_emphasis"), true);
});

test("主项目公开事实中允许出现关联技术主题", () => {
  const deepFlowQuestion = "介绍 DeepFlow 多 Agent 研究项目。";
  const deepFlow = matchStableAnswer(deepFlowQuestion);
  assert.ok(deepFlow);
  const deepFlowPlan = buildAnswerPlan(
    deepFlowQuestion,
    retrieveKnowledge(deepFlowQuestion),
    deepFlow,
  );
  const triggers = validateAnswer(deepFlow.standardAnswer, deepFlowPlan).triggers;
  assert.equal(triggers.includes("forbidden_topic:rag"), false);
});

test("长篇契约回答至少保留两个阅读重点", () => {
  const underformatted = plan.fallbackAnswer
    .replace("**医疗私有文档可信问答**", "医疗私有文档可信问答")
    .replace("**质量基线**", "质量基线");
  assert.equal(validateAnswer(underformatted, plan).triggers.includes("insufficient_emphasis"), true);
});

test("回答长度按问题弹性组织而不是机械卡字数", () => {
  const artificiallyNarrowPlan = { ...plan, targetLength: { min: 800, max: 820 } };
  const result = validateAnswer(plan.fallbackAnswer, artificiallyNarrowPlan);
  assert.equal(result.triggers.includes("answer_too_short"), false);
  assert.match(systemPrompt, /正式面试/);
  assert.match(systemPrompt, /适度美化/);
  assert.match(systemPrompt, /未被问到的限制不要主动展开或放大/);
});

test("深度开放题缺少证据层次时触发厚度修复", () => {
  const question = "你的过往经历怎样支持你做 AI 产品？";
  const deepPlan = buildAnswerPlan(question, retrieveKnowledge(question));
  assert.equal(deepPlan.detailLevel, "deep");
  const result = validateAnswer("我的过往经历让我形成了数据判断和产品落地能力，我认为这些能力可以支持我做好 AI 产品。", deepPlan);
  assert.equal(result.triggers.includes("insufficient_depth"), true);
});

test("有序列表编号不会被误判为候选人的业务数字", () => {
  const numbered = `1. ${plan.fallbackAnswer}`;
  assert.equal(validateAnswer(numbered, plan).triggers.includes("unsupported_number"), false);
});

test("开放题质量门禁按题型检查关键推理结构", () => {
  const fixtures = [
    { question: "如果资源只够做一个功能，你会怎么选？", intent: "situational_judgment", expected: ["missing_situation_constraints", "missing_situation_tradeoff", "missing_situation_validation"] },
    { question: "请设计一款面向应届生的 AI 求职产品。", intent: "product_design", expected: ["missing_product_user", "missing_product_mvp", "missing_product_metric"] },
    { question: "如何分析一款 AI 产品的商业模式？", intent: "business_analysis", expected: ["missing_business_journey", "missing_business_metrics", "missing_business_validation"] },
    { question: "估算国内 AI 求职工具市场规模。", intent: "estimation", expected: ["missing_estimation_assumption", "missing_estimation_calculation", "missing_estimation_check"] },
  ] as const;

  for (const fixture of fixtures) {
    const frame = { ...buildLocalQuestionFrame(fixture.question), answerIntent: fixture.intent };
    const currentPlan = buildAnswerPlan(fixture.question, retrieveKnowledge(fixture.question, { frame }), undefined, [], frame);
    const triggers = validateAnswer("我的处理思路是先理解问题，再结合情况给出一个合适方案。", currentPlan).triggers;
    for (const expected of fixture.expected) assert.equal(triggers.includes(expected), true, `${fixture.question}: ${expected}`);
  }
});

test("时效问题必须声明知识范围，行为题必须落到真实行动和复盘", () => {
  const currentQuestion = "你怎么看最近的 AI Agent 行业趋势？";
  const currentFrame = buildLocalQuestionFrame(currentQuestion);
  const currentPlan = buildAnswerPlan(currentQuestion, retrieveKnowledge(currentQuestion, { frame: currentFrame }), undefined, [], currentFrame);
  assert.equal(validateAnswer("我认为 Agent 会持续发展，产品经理需要理解模型和工具协作。", currentPlan).triggers.includes("missing_freshness_boundary"), true);

  const behavioralQuestion = "请讲一个你推动项目取得进展的真实经历。";
  const behavioralFrame = buildLocalQuestionFrame(behavioralQuestion);
  const behavioralPlan = buildAnswerPlan(behavioralQuestion, retrieveKnowledge(behavioralQuestion, { frame: behavioralFrame }), undefined, [], behavioralFrame);
  const triggers = validateAnswer("我在项目中遇到挑战，也积累了很多经验。", behavioralPlan).triggers;
  assert.equal(triggers.includes("missing_behavior_action"), true);
  assert.equal(triggers.includes("missing_behavior_result_review"), true);
});
