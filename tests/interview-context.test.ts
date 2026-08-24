import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerPlan, buildContext } from "../lib/answer.ts";
import { retrieveKnowledge } from "../lib/knowledge.ts";

test("多轮面试上下文显式记录当前项目、已问维度与已用证据", () => {
  const items = retrieveKnowledge("这个项目中你具体负责了什么？", {
    history: [
      { role: "user", content: "介绍一下你的 RAG 项目。" },
      { role: "assistant", content: "RAG Knowledge Base System 重点解决医疗私有文档的检索、回答和引用问题。" },
    ],
  });
  const plan = buildAnswerPlan("这个项目中你具体负责了什么？", items, undefined, [
    { role: "user", content: "介绍一下你的 RAG 项目。" },
    { role: "assistant", content: "RAG Knowledge Base System 重点解决医疗私有文档的检索、回答和引用问题。" },
  ]);

  assert.equal(plan.conversationContext.activeProject, "rag-knowledge-base");
  assert.equal(plan.conversationContext.depth, "follow_up");
  assert.ok(plan.conversationContext.askedDimensions.includes("overview"));
  assert.ok(plan.brief.primaryEvidenceId);
  assert.ok(plan.brief.supportingEvidenceIds.length <= 1);
});

test("开放题模型上下文只聚焦一项主证据和最多一项补充证据", () => {
  const question = "你之前的经历对你求职 AI 产品有什么帮助？";
  const items = retrieveKnowledge(question, { limit: 4 });
  const plan = buildAnswerPlan(question, items);
  const context = buildContext(items, plan);

  assert.equal((context.match(/<material>/g) ?? []).length <= 2, true);
  assert.ok(plan.brief.primaryEvidenceId);
  assert.equal(plan.brief.newInformationGoal.length > 0, true);
  assert.match(context, /优先讲主证据/);
});

test("深层追问只补充新信息，不因轮次增加而机械扩写", () => {
  const history = [
    { role: "user" as const, content: "介绍一下 RAG 项目。" },
    { role: "assistant" as const, content: "我介绍了产品目标和主链路。" },
    { role: "user" as const, content: "你具体负责什么？" },
    { role: "assistant" as const, content: "我介绍了需求、检索策略和评测。" },
    { role: "user" as const, content: "最大的取舍是什么？" },
    { role: "assistant" as const, content: "我介绍了召回、忠实度和实现复杂度的取舍。" },
  ];
  const question = "如果效果没有改善，你下一步先看什么？";
  const plan = buildAnswerPlan(question, retrieveKnowledge(question, { history }), undefined, history);

  assert.equal(plan.conversationContext.depth, "deep_dive");
  assert.equal(plan.targetLength.max <= 500, true);
  assert.equal(plan.newInformationGoal.length > 0, true);
});
