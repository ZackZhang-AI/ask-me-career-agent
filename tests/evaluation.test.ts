import assert from "node:assert/strict";
import test from "node:test";
import { demoAnswer } from "../lib/answer.ts";
import { claims, knowledge, retrieveKnowledge, sources } from "../lib/knowledge.ts";
import { coreCases, evaluationCases, regressionCases, securityCases } from "./evals/cases.ts";

test("完整评测集包含 20 个核心题、20 个安全题和 50 个总用例", () => {
  assert.equal(coreCases.length, 20);
  assert.equal(securityCases.length, 20);
  assert.equal(regressionCases.length, 10);
  assert.equal(evaluationCases.length, 50);
  assert.equal(new Set(evaluationCases.map((item) => item.id)).size, evaluationCases.length);
});

test("每个评测用例都声明所需证据、禁止事实和预期状态", () => {
  const validStatuses = new Set(["answered", "insufficient_evidence", "refused"]);
  for (const item of evaluationCases) {
    assert.match(item.id, /^(CORE|SEC|REG)-\d{2}$/);
    assert.ok(item.question.trim().length >= 4, item.id);
    assert.ok(Array.isArray(item.requiredClaimIds), item.id);
    assert.ok(Array.isArray(item.requiredSourceIds), item.id);
    assert.ok(item.forbiddenFacts.length > 0, item.id);
    assert.equal(validStatuses.has(item.expectedStatus), true, item.id);
  }
});

test("评测集引用的 Claim 和 Source 均存在", () => {
  const claimIds = new Set(claims.map((claim) => claim.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  for (const item of evaluationCases) {
    for (const claimId of item.requiredClaimIds) assert.equal(claimIds.has(claimId), true, `${item.id}:${claimId}`);
    for (const sourceId of item.requiredSourceIds) assert.equal(sourceIds.has(sourceId), true, `${item.id}:${sourceId}`);
  }
});

test("核心 20 题全部召回必需 Claim 和 Source", () => {
  for (const item of coreCases) {
    assert.equal(item.expectedStatus, "answered", item.id);
    assert.ok(item.requiredClaimIds.length > 0, item.id);
    assert.ok(item.requiredSourceIds.length > 0, item.id);
    const retrieved = retrieveKnowledge(item.question);
    const claimIds = new Set(retrieved.flatMap((entry) => entry.claimIds));
    const sourceIds = new Set(retrieved.flatMap((entry) => entry.sourceIds));
    for (const claimId of item.requiredClaimIds) assert.equal(claimIds.has(claimId), true, `${item.id}:${claimId}`);
    for (const sourceId of item.requiredSourceIds) assert.equal(sourceIds.has(sourceId), true, `${item.id}:${sourceId}`);
  }
});

test("开放问题不会输出 fixture 标记的禁止事实", () => {
  for (const item of evaluationCases.filter((entry) => entry.expectedStatus !== "refused")) {
    const retrieved = retrieveKnowledge(item.question);
    const answer = demoAnswer(item.question, retrieved);
    for (const forbidden of item.forbiddenFacts) {
      assert.equal(answer.includes(forbidden), false, `${item.id}:${forbidden}`);
    }
  }
});

test("证据不足问题均无知识召回且使用拒绝推测回答", () => {
  const unknownCases = evaluationCases.filter((item) => item.expectedStatus === "insufficient_evidence");
  assert.equal(unknownCases.length, 5);
  for (const item of unknownCases) {
    const retrieved = retrieveKnowledge(item.question);
    assert.equal(retrieved.length, 0, item.id);
    assert.match(demoAnswer(item.question, retrieved), /资料不足|公开资料不足|不会.*推测/, item.id);
  }
});

test("上线核心门槛可由 fixture 计算且当前静态检索为 100%", () => {
  const passed = coreCases.filter((item) => {
    const retrieved = retrieveKnowledge(item.question);
    const claimIds = new Set(retrieved.flatMap((entry) => entry.claimIds));
    const sourceIds = new Set(retrieved.flatMap((entry) => entry.sourceIds));
    return item.requiredClaimIds.every((id) => claimIds.has(id)) && item.requiredSourceIds.every((id) => sourceIds.has(id));
  }).length;
  assert.equal(passed / coreCases.length, 1);
  assert.equal(knowledge.length >= 8, true);
});
