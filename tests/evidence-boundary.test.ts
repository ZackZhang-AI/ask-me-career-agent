import assert from "node:assert/strict";
import test from "node:test";
import { buildContext } from "../lib/answer.ts";
import { claims, knowledge, matchStableAnswer, serializeKnowledgeItems, sources } from "../lib/knowledge.ts";

test("RAG 回答区分当前 Dense Retrieval 与待复核的高级能力", () => {
  const answer = matchStableAnswer("RAG 项目解决了什么问题？");
  const rag = knowledge.find((item) => item.id === "K4");
  const source = sources.find((item) => item.id === "S3");
  assert.ok(answer && rag && source);
  assert.match(answer.standardAnswer, /Dense Retrieval/);
  assert.match(answer.standardAnswer, /持续优化/);
  assert.equal(rag.projectStatus, "in_progress");
  assert.equal(source.projectStatus, "in_progress");
  assert.equal(answer.standardAnswer.includes("公开实现多格式解析、混合检索"), false);
});

test("DeepFlow 公开口径是可演示 MVP，不冒充生产完成", () => {
  const answer = matchStableAnswer("DeepFlow 是什么？");
  const deepFlow = knowledge.find((item) => item.id === "K5");
  const source = sources.find((item) => item.id === "S4");
  assert.ok(answer && deepFlow && source);
  assert.match(answer.standardAnswer, /可演示 MVP/);
  assert.equal(deepFlow.projectStatus, "in_progress");
  assert.equal(source.projectStatus, "in_progress");
  assert.match(answer.limitations, /生产并发|长期稳定/);
});

test("模型上下文只提供自然事实材料，不暴露内部证据标签", () => {
  const context = buildContext(knowledge.filter((item) => ["K1", "K4", "K11"].includes(item.id)));
  assert.match(context, /主题：候选人定位/);
  assert.match(context, /事实：张倬玮是东北大学/);
  assert.doesNotMatch(context, /Claim|Source|验证状态|\[C\d+\]/);
  assert.equal(claims.some((claim) => claim.evidenceBasis === "inference" && claim.claimType !== "boundary"), false);
});

test("API 序列化不向浏览器暴露 Obsidian 审核溯源", () => {
  const item = knowledge.find((entry) => entry.id === "K4");
  assert.ok(item);
  const serialized = serializeKnowledgeItems([{
    ...item,
    provenance: {
      provider: "obsidian",
      candidateId: "obs_0123456789abcdef",
      sourceSha256: "a".repeat(64),
      section: "当前状态边界",
      reviewedAt: "2026-07-16",
    },
  }]);
  assert.equal("provenance" in serialized[0], false);
});
