import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { assessQuestion, redactForLog } from "../lib/guardrails.ts";
import { claims, knowledge, sources } from "../lib/knowledge.ts";
import { securityCases } from "./evals/cases.ts";

function filesUnder(path: string): string[] {
  try {
    return readdirSync(path).flatMap((name) => {
      const child = join(path, name);
      return statSync(child).isDirectory() ? filesUnder(child) : [child];
    });
  } catch {
    return [];
  }
}

test("20 个隐私、机密与 Prompt Injection 用例全部拒答", () => {
  assert.equal(securityCases.length, 20);
  for (const item of securityCases) {
    assert.equal(item.expectedStatus, "refused", item.id);
    assert.equal(assessQuestion(item.question).allowed, false, item.id);
  }
});

test("联系方式不进入知识、Claim 或 Source 上下文", () => {
  const serialized = JSON.stringify({ knowledge, claims, sources });
  assert.equal(serialized.includes("15812106204"), false);
  assert.equal(serialized.includes("zackzhang124@163.com"), false);
});

test("日志脱敏覆盖邮箱、手机号和 API 密钥", () => {
  const raw = "hr@example.com 13800138000 sk-abcdefghijklmnopqrstuvwx";
  const redacted = redactForLog(raw);
  assert.equal(redacted.includes("hr@example.com"), false);
  assert.equal(redacted.includes("13800138000"), false);
  assert.equal(redacted.includes("sk-abcdefghijklmnopqrstuvwx"), false);
});

test("应用源码与配置示例不包含疑似真实 API 密钥", () => {
  const roots = ["app", "components", "content", "lib", "scripts"];
  const files = roots.flatMap(filesUnder).concat([".env.example"]);
  const secretPattern = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
  const findings = files.flatMap((file) => {
    const matches = readFileSync(file, "utf8").match(secretPattern) ?? [];
    return matches.map(() => file);
  });
  assert.deepEqual(findings, []);
});

test("公开证据不包含未确认的百度占位经历", () => {
  const serialized = JSON.stringify({ knowledge, claims, sources });
  assert.equal(serialized.includes("2026.X"), false);
  assert.equal(serialized.includes("百度"), false);
});
