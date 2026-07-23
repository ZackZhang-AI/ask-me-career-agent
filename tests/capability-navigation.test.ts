import assert from "node:assert/strict";
import test from "node:test";
import { capabilityNavigation } from "../lib/capability-navigation";
import { retrieveKnowledge } from "../lib/knowledge";

test("侧栏能力索引提供三组招聘方可理解的能力证据", () => {
  assert.equal(capabilityNavigation.length, 3);
  assert.equal(new Set(capabilityNavigation.map(({ title }) => title)).size, 3);
  assert.equal(new Set(capabilityNavigation.map(({ question }) => question)).size, 3);

  for (const capability of capabilityNavigation) {
    assert.ok(capability.items.length >= 3);
    assert.ok(capability.summary.length > 10);
    assert.ok(retrieveKnowledge(capability.question).length > 0, capability.question);
  }
});

test("工程落地能力只使用现有材料可支持的表述", () => {
  const engineering = capabilityNavigation.find(({ title }) => title.includes("工程落地"));
  assert.ok(engineering);

  const evidence = engineering.items.join(" ");
  assert.match(evidence, /RAG/);
  assert.match(evidence, /Multi-Agent/);
  assert.match(evidence, /Web 与桌面原型/);
  assert.match(evidence, /AI 编程工具/);
  assert.doesNotMatch(evidence, /Codex|Claude Code|Cloud Code/);
});
