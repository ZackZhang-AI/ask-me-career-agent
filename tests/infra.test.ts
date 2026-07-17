import assert from "node:assert/strict";
import test from "node:test";
import { ANALYTICS_EVENTS, sanitizeAnalyticsEvent } from "../lib/analytics.ts";
import { checkRequestLimits, extractClientIp, reserveAdditionalModelCall, resetLocalRateLimitsForTests } from "../lib/rate-limit.ts";
import { GET as getResume } from "../app/resume/route.ts";
import { NextRequest } from "next/server";

test("分析事件白名单完整且不保留会话原值", () => {
  for (const event of ANALYTICS_EVENTS) {
    const sanitized = sanitizeAnalyticsEvent({ event, sessionId: "session-secret" });
    assert.equal(sanitized?.event, event);
    assert.equal(sanitized?.sessionHash.length, 64);
    assert.equal(JSON.stringify(sanitized).includes("session-secret"), false);
  }
});

test("分析字段严格白名单并丢弃联系方式和非法引用", () => {
  const sanitized = sanitizeAnalyticsEvent({
    event: "answer_completed",
    sessionId: "session-1",
    responseStatus: "completed",
    claimIds: ["C1", "C1", "C99999", "not-a-claim"],
    sourceIds: ["S2", "https://example.com"],
    latencyMs: 999_999,
    questionCategory: "project",
    targetId: "zack@example.com",
    rawQuestion: "这是不应存储的原始问题",
  });
  assert.deepEqual(sanitized?.claimIds, ["C1"]);
  assert.deepEqual(sanitized?.sourceIds, ["S2"]);
  assert.equal(sanitized?.latencyMs, 300_000);
  assert.equal(sanitized?.targetId, null);
  assert.equal(JSON.stringify(sanitized).includes("原始问题"), false);
  assert.equal(sanitizeAnalyticsEvent({ event: "unknown", sessionId: "x" }), null);
});

test("未配置 Redis 时执行每 IP 分钟限流", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.RATE_LIMIT_PER_MINUTE = "2";
  process.env.SESSION_QUESTION_LIMIT = "20";
  resetLocalRateLimitsForTests();
  assert.equal((await checkRequestLimits({ ip: "203.0.113.1", sessionId: "s1", estimatedTokens: 1 })).ok, true);
  assert.equal((await checkRequestLimits({ ip: "203.0.113.1", sessionId: "s2", estimatedTokens: 1 })).ok, true);
  const denied = await checkRequestLimits({ ip: "203.0.113.1", sessionId: "s3", estimatedTokens: 1 });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, "rate_limited");
});

test("未配置 Redis 时执行会话与每日 Token 预算", async () => {
  process.env.RATE_LIMIT_PER_MINUTE = "50";
  process.env.SESSION_QUESTION_LIMIT = "1";
  process.env.DAILY_REQUEST_LIMIT = "50";
  process.env.DAILY_TOKEN_LIMIT = "10";
  resetLocalRateLimitsForTests();
  assert.equal((await checkRequestLimits({ ip: "203.0.113.2", sessionId: "fixed", estimatedTokens: 6 })).ok, true);
  const sessionDenied = await checkRequestLimits({ ip: "203.0.113.3", sessionId: "fixed", estimatedTokens: 1 });
  assert.equal(sessionDenied.ok, false);
  if (!sessionDenied.ok) assert.equal(sessionDenied.code, "rate_limited");
  const budgetDenied = await checkRequestLimits({ ip: "203.0.113.4", sessionId: "other", estimatedTokens: 5 });
  assert.equal(budgetDenied.ok, false);
  if (!budgetDenied.ok) assert.equal(budgetDenied.code, "budget_exhausted");
});

test("质量重写在第二次模型调用前再次检查请求与 Token 预算", async () => {
  process.env.RATE_LIMIT_PER_MINUTE = "50";
  process.env.SESSION_QUESTION_LIMIT = "20";
  process.env.DAILY_REQUEST_LIMIT = "2";
  process.env.DAILY_TOKEN_LIMIT = "10";
  resetLocalRateLimitsForTests();
  assert.equal((await checkRequestLimits({ ip: "203.0.113.5", sessionId: "retry", estimatedTokens: 6 })).ok, true);
  const tokenDenied = await reserveAdditionalModelCall(5);
  assert.equal(tokenDenied.ok, false);
  if (!tokenDenied.ok) assert.equal(tokenDenied.code, "budget_exhausted");

  process.env.DAILY_REQUEST_LIMIT = "1";
  process.env.DAILY_TOKEN_LIMIT = "100";
  resetLocalRateLimitsForTests();
  assert.equal((await checkRequestLimits({ ip: "203.0.113.6", sessionId: "retry-requests", estimatedTokens: 5 })).ok, true);
  const requestDenied = await reserveAdditionalModelCall(5);
  assert.equal(requestDenied.ok, false);
});

test("客户端 IP 只从代理头提取首个值", () => {
  const request = new Request("https://example.com", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
  assert.equal(extractClientIp(request), "203.0.113.8");
});

test("简历入口在未配置、非法和有效地址下返回可理解状态", async () => {
  delete process.env.RESUME_BLOB_URL;
  const missing = await getResume(new NextRequest("http://localhost/resume"));
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /最新版简历正在更新/);

  process.env.RESUME_BLOB_URL = "javascript:alert(1)";
  const invalid = await getResume(new NextRequest("http://localhost/resume"));
  assert.equal(invalid.status, 500);

  process.env.RESUME_BLOB_URL = "https://example.com/resume.pdf";
  const valid = await getResume(new NextRequest("http://localhost/resume"));
  assert.equal(valid.status, 307);
  assert.equal(valid.headers.get("location"), "https://example.com/resume.pdf");
  delete process.env.RESUME_BLOB_URL;
});
