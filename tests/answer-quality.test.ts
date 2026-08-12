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
  assert.match(plan.fallbackAnswer, /\*\*可信专业问答\*\*/);
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
  const longEmphasis = plan.fallbackAnswer.replace("**可信专业问答**", "**这是一个明显超过长度限制而且不应该被整段加粗的标题文本因为它仍在继续扩展**");
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
  const lowInformation = plan.fallbackAnswer.replace("**可信专业问答**", "**核心项目**");
  assert.equal(validateAnswer(lowInformation, plan).triggers.includes("low_information_emphasis"), true);
});

test("长篇契约回答至少保留两个阅读重点", () => {
  const underformatted = plan.fallbackAnswer.replace("**可信专业问答**", "可信专业问答");
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

test("有序列表编号不会被误判为候选人的业务数字", () => {
  const numbered = `1. ${plan.fallbackAnswer}`;
  assert.equal(validateAnswer(numbered, plan).triggers.includes("unsupported_number"), false);
});
