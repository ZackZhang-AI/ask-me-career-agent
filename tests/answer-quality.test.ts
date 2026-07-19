import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerPlan } from "../lib/answer.ts";
import { validateAnswer } from "../lib/answer-quality.ts";
import { parseAnswerEmphasis } from "../lib/answer-format.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";

const question = "哪个项目最能代表他的 AI 产品能力？";
const stable = matchStableAnswer(question);
assert.ok(stable);
const plan = buildAnswerPlan(question, retrieveKnowledge(question), stable);

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

test("结构化事实骨架回退不包含百度和内部标签", () => {
  assert.match(plan.fallbackAnswer, /\*\*RAG Knowledge Base System\*\*/);
  assert.doesNotMatch(plan.fallbackAnswer, /进一步判断|实践依据|落地方式/);
  assert.doesNotMatch(plan.fallbackAnswer, /百度|Claim ID|Source ID|证据边界/);
  assert.equal(plan.fallbackAnswer.length >= 300 && plan.fallbackAnswer.length <= 500, true);
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
  const longEmphasis = plan.fallbackAnswer.replace("**RAG Knowledge Base System**", "**这是一个明显超过长度限制而且不应该被整段加粗的标题文本因为它仍在继续扩展**");
  assert.equal(validateAnswer(overformatted, plan).triggers.includes("excessive_emphasis"), true);
  assert.equal(validateAnswer(longEmphasis, plan).triggers.includes("long_emphasis"), true);
});

test("有序列表编号不会被误判为候选人的业务数字", () => {
  const numbered = `1. ${plan.fallbackAnswer}`;
  assert.equal(validateAnswer(numbered, plan).triggers.includes("unsupported_number"), false);
});
