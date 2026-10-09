import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerPlan } from "../lib/answer.ts";
import { validateAnswerFragment } from "../lib/answer-quality.ts";
import { buildInterviewConversationContext } from "../lib/interview-context.ts";
import { retrieveKnowledge } from "../lib/knowledge.ts";
import { buildLocalQuestionFrame, findQuestionContract, mergePlannedFrame, plannedQuestionFrameSchema } from "../lib/question-contracts.ts";
import type { ChatMessage, QuestionTopic } from "../lib/types.ts";

const directQuestions: Array<[string, QuestionTopic, string]> = [
  ["你目前在哪实习？", "didi", "didi-internship"],
  ["你最近的一段实习是什么？", "didi", "didi-internship"],
  ["你目前在做什么？", "didi", "didi-internship"],
  ["介绍你在滴滴 ABC 智能一组的工作", "didi", "didi-internship"],
  ["“请介绍一下 DiVA。”\u200b", "diva", "didi-diva"],
  ["你在滴滴的 DiVA 中做了什么产品取舍？", "diva", "didi-diva"],
  ["营销素材工作台为什么需要人工审核？", "diva", "didi-diva"],
  ["DiVA 首次验收通过率意味着什么？", "diva", "didi-diva"],
  ["请介绍一下机票竞品比价 Skill。", "flight_compare", "didi-flight-compare"],
  ["滴滴比价 Skill 的覆盖率和低价率怎么定义？", "flight_compare", "didi-flight-compare"],
  ["航班匹配时机场和时间如何核验？", "flight_compare", "didi-flight-compare"],
  ["航线分析为什么不能把缺价按零处理？", "flight_compare", "didi-flight-compare"],
  ["你在百度实习中具体负责什么？", "baidu", "baidu-ai-coding-evaluation"],
];

for (const [question, topic, activeProject] of directQuestions) {
  test(`滴滴内容路由：${question}`, () => {
    const frame = buildLocalQuestionFrame(question);
    assert.equal(frame.topic, topic);
    assert.equal(frame.activeProject, activeProject);
    const items = retrieveKnowledge(question, { frame });
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => frame.requiredKnowledgeIds.includes(item.id)));
    if (["didi", "diva", "flight_compare"].includes(topic)) {
      assert.ok(frame.requiredKnowledgeIds.every((id) => /^K(?:5[4-9]|6[01])$/.test(id)));
      assert.notEqual(frame.questionFamily, "unrelated");
    }
  });
}

const divaHistory: ChatMessage[] = [
  { role: "user", content: "请介绍滴滴的 DiVA 项目。" },
  { role: "assistant", content: "DiVA 将主视觉生成、元素复用和人工审核组织成营销素材交付流程。" },
];

test("当前实习是个人事实，不当成最新行业新闻", () => {
  const frame = buildLocalQuestionFrame("你最近实习主要负责什么？");
  assert.equal(frame.topic, "didi");
  assert.equal(frame.answerIntent, "experience");
  assert.equal(frame.factRisk, "supported_personal");
  assert.equal(frame.questionFamily, "candidate_fact");
});

test("当前实习别名不误命中体现在哪里这类能力表达", () => {
  const frame = buildLocalQuestionFrame("你的学习能力体现在哪里？");
  assert.notEqual(frame.topic, "didi");
  assert.equal(frame.questionFamily, "work_style");
});

test("滴滴方法追问使用推理范围，不默认背诵项目介绍", () => {
  for (const question of ["DiVA 如何安排规则和人工审核？", "比价 Skill 的覆盖率和低价率怎么定义？"]) {
    const frame = buildLocalQuestionFrame(question);
    assert.equal(frame.questionMode, "candidate_reasoning");
    assert.equal(frame.evidencePolicy, "supporting");
    assert.notEqual(frame.answerIntent, "project_overview");
  }
});

test("DiVA 的泛指贡献追问不会命中旧 RAG 固定答案", () => {
  const question = "这个项目中你本人做了什么？";
  assert.equal(findQuestionContract(question, divaHistory), undefined);
  const frame = buildLocalQuestionFrame(question, divaHistory);
  assert.equal(frame.topic, "diva");
  assert.equal(frame.useHistory, true);
  const items = retrieveKnowledge(question, { frame, history: divaHistory });
  assert.ok(items.every((item) => item.relatedProject === "didi-diva" || item.id === "K61"));
});

test("短句和指标追问沿用 DiVA，而非统计学或通用技能", () => {
  for (const question of ["然后呢？", "具体怎么做？", "那这个指标如何验收？", "这段经历最难的取舍是什么？"]) {
    assert.equal(buildLocalQuestionFrame(question, divaHistory).topic, "diva", question);
  }
});

test("明确切换比价项目覆盖 DiVA 历史，下一轮沿用比价", () => {
  const question = "那比价 Skill 的指标怎么定义？";
  const frame = buildLocalQuestionFrame(question, divaHistory);
  assert.equal(frame.topic, "flight_compare");
  assert.equal(frame.useHistory, false);
  const history: ChatMessage[] = [...divaHistory, { role: "user", content: question }, { role: "assistant", content: "覆盖率与低价率需要明确分母。" }];
  const followup = buildLocalQuestionFrame("那这些分母为什么不同？", history);
  assert.equal(followup.topic, "flight_compare");
  assert.equal(followup.activeProject, "didi-flight-compare");
});

test("明确切换百度后不继承滴滴故事和深挖轮次", () => {
  const frame = buildLocalQuestionFrame("那百度的 WebDev 评测怎么做？", divaHistory);
  const context = buildInterviewConversationContext({ history: divaHistory, frame, items: [], stories: [] });
  assert.equal(frame.topic, "baidu");
  assert.equal(context.activeProject, "baidu-ai-coding-evaluation");
  assert.equal(context.depth, "overview");
  assert.deepEqual(context.askedDimensions, []);
});

test("结构化规划接受三个新主题和项目标识", () => {
  for (const topic of ["didi", "diva", "flight_compare"] as const) {
    const question = topic === "didi" ? "介绍你的滴滴实习" : topic === "diva" ? "DiVA 如何审核" : "比价 Skill 如何核验";
    const frame = buildLocalQuestionFrame(question);
    const parsed = plannedQuestionFrameSchema.safeParse({ ...frame, focusTerms: ["本人职责"], requestedDimensions: ["本人职责"] });
    assert.equal(parsed.success, true, topic);
  }
});

test("模型错误项目规划不能覆盖原问题明确对象或历史指代", () => {
  for (const question of ["DiVA 的产品取舍是什么？", "那这个指标如何验收？"]) {
    const local = buildLocalQuestionFrame(question, divaHistory);
    const planned = { ...local, topic: "rag" as const, activeProject: "rag-knowledge-base" as const, confidence: 0.99 };
    const resolved = mergePlannedFrame(local, planned, question);
    assert.equal(resolved.topic, "diva");
    assert.equal(resolved.activeProject, "didi-diva");
    assert.ok(!resolved.requiredKnowledgeIds.includes("K4"));
  }
});

test("滴滴贡献和复盘不会借用百度或医疗项目的真实事件故事", () => {
  const question = "讲一个 DiVA 项目里的困难和复盘";
  const frame = buildLocalQuestionFrame(question);
  assert.deepEqual(frame.allowedStoryIds, []);
  const items = retrieveKnowledge(question, { frame });
  const plan = buildAnswerPlan(question, items, undefined, [], frame);
  assert.equal(plan.relatedStoryId, undefined);
  assert.ok(plan.allowedEventFacts.every((fact) => !/导师|搜索回流|百度|百川|盲评/.test(fact)));
});

test("组织授权来自本题材料，新增滴滴不放宽其他项目事实边界", () => {
  const question = "请介绍一下你的 RAG 知识库项目。";
  const frame = buildLocalQuestionFrame(question);
  const plan = buildAnswerPlan(question, retrieveKnowledge(question, { frame }), undefined, [], frame);
  assert.ok(!plan.allowedOrganizations.includes("滴滴"));
  assert.ok(!plan.allowedOrganizations.includes("携程"));
  const gate = validateAnswerFragment("我在滴滴和携程负责这个项目。", plan, true);
  assert.equal(gate.passed, false);
  assert.ok(gate.triggers.some((trigger) => trigger.includes("organization")));
});

test("滴滴及比价组织只在有相关依据时获授权", () => {
  const question = "滴滴比价 Skill 如何定义对携程的覆盖率？";
  const frame = buildLocalQuestionFrame(question);
  const items = retrieveKnowledge(question, { frame });
  const plan = buildAnswerPlan(question, items, undefined, [], frame);
  assert.ok(plan.allowedOrganizations.includes("滴滴"));
  assert.ok(plan.allowedOrganizations.includes("携程"));
});

test("专业价值、职业转型与商业化匹配继续各用正确意图", () => {
  const cases = [
    ["你的专业对你做 AI 产品有什么帮助？", "experience_value"],
    ["为什么从财会转向 AI 产品？", "career_transition"],
    ["你和商业化产品经理这个岗有什么匹配之处？", "role_fit"],
    ["你有经过验证的商业化结果吗？", "result"],
  ];
  for (const [question, intent] of cases) assert.equal(buildLocalQuestionFrame(question).answerIntent, intent, question);
});

for (const question of [
  "如果 DiVA 素材投放后转化不佳，你会怎么分析？",
  "如果机票比价 Skill 的结果不可靠，你会怎么排查？",
  "DiVA 的交付效果没有改善，你会先排查什么？",
  "如何验证 DiVA 的素材交付质量？",
]) {
  test(`滴滴业务排查不带入 RAG 模板：${question}`, () => {
    const local = buildLocalQuestionFrame(question);
    assert.equal(local.answerIntent, "situational_judgment");
    const planned = { ...local, answerIntent: "diagnosis" as const, topic: "rag" as const, activeProject: "rag-knowledge-base" as const, confidence: 0.99 };
    const frame = mergePlannedFrame(local, planned, question);
    assert.equal(frame.answerIntent, "situational_judgment");
    assert.equal(frame.topic, local.topic);
    const plan = buildAnswerPlan(question, retrieveKnowledge(question, { frame }), undefined, [], frame);
    assert.doesNotMatch([...plan.allowedFacts, ...plan.exclusivePoints, plan.thesis, plan.fallbackAnswer].join("\n"), /知识摄入|召回证据|引用链路|检索策略|同一组 Bad Case/);
  });
}

test("同一项目的假设追问保持业务方法而不是 RAG 排查", () => {
  const question = "如果这个项目投放后转化不佳，你会怎么分析？";
  const frame = buildLocalQuestionFrame(question, divaHistory);
  assert.equal(frame.topic, "diva");
  assert.equal(frame.answerIntent, "situational_judgment");
});

test("实际 RAG 故障排查继续保留检索诊断能力", () => {
  const question = "如果 RAG 召回结果不相关，你会怎么排查？";
  const frame = buildLocalQuestionFrame(question);
  assert.equal(frame.answerIntent, "diagnosis");
  const plan = buildAnswerPlan(question, retrieveKnowledge(question, { frame }), undefined, [], frame);
  assert.match(plan.allowedFacts.join("\n"), /召回证据|检索/);
});
