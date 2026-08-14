import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerCitations, validateAnswerCitations } from "../lib/answer-citations.ts";
import { getClaims } from "../lib/knowledge.ts";

test("只为能被公开 Claim 支持的事实段落绑定来源", () => {
  const claims = getClaims(["C3", "C4"]);
  const citations = buildAnswerCitations(
    "我在 RAG Knowledge Base System 中负责需求定义、方案取舍和评测验收。\n\n这段经历也让我更重视持续学习和面对压力时的推进节奏。",
    claims,
  );

  assert.equal(citations.some((citation) => citation.paragraphIndex === 0), true);
  assert.equal(citations.some((citation) => citation.paragraphIndex === 1), false);
  assert.equal(validateAnswerCitations(citations, claims), true);
});

test("引用不能越过本轮允许的 Claim 与 Source", () => {
  const claims = getClaims(["C3"]);
  assert.equal(validateAnswerCitations([{ paragraphIndex: 0, claimIds: ["C4"], sourceIds: ["S4"] }], claims), false);
  assert.equal(validateAnswerCitations([{ paragraphIndex: 0, claimIds: ["C3"], sourceIds: ["S4"] }], claims), false);
});
