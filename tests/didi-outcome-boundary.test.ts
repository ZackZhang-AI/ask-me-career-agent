import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route.ts";
import { findQuestionContract } from "../lib/question-contracts.ts";
import { resetLocalRateLimitsForTests } from "../lib/rate-limit.ts";
import type { ChatMessage } from "../lib/types.ts";

const question = "你们已经把素材全部投放并提升转化了吗？";
const originalFetch = globalThis.fetch;
const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
  resetLocalRateLimitsForTests();
});

async function ask(messages: ChatMessage[]) {
  resetLocalRateLimitsForTests();
  process.env.DEEPSEEK_API_KEY = "test-no-upstream-calls";
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No model request expected"); };
  const response = await POST(new NextRequest("http://localhost/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.41" },
    body: JSON.stringify({ sessionId: "didi-boundary-test", messages }),
  }));
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(calls, 0);
  assert.ok(!events.some((event) => event.type === "error"));
  return {
    done: events.findLast((event) => event.type === "done"),
    answer: events.filter((event) => event.type === "delta").map((event) => event.content).join(""),
  };
}

test("无上下文的素材成果追问立即澄清，不调用规划或审校模型", async () => {
  assert.equal(findQuestionContract(question), undefined);
  const result = await ask([{ role: "user", content: question }]);
  assert.equal(result.done.disposition, "clarify");
  assert.equal(result.done.responseStatus, "needs_clarification");
  assert.match(result.answer, /哪个项目/);
});

for (const input of ["DiVA 素材已经全部投放并提升转化了吗？", "DiVA 已经带来转化提升了吗？", "“DiVA 的素材都投放了吗，转化提升了吗？”"]) {
  test(`明确素材成果对象使用已审核边界：${input}`, async () => {
    const result = await ask([{ role: "user", content: input }]);
    assert.equal(result.done.responseStatus, "completed");
    assert.equal(result.done.deliveryMode, "local_reveal");
    assert.match(result.answer, /还不能把它说成/);
    assert.match(result.answer, /不是曝光、点击或订单转化数据/);
  });
}

test("DiVA 后的素材追问沿用项目，不要求重复名称", async () => {
  const result = await ask([{ role: "user", content: "介绍一下 DiVA。" }, { role: "assistant", content: "它服务营销素材交付。" }, { role: "user", content: question }]);
  assert.equal(result.done.responseStatus, "completed");
  assert.match(result.answer, /业务采用和交付提效/);
});

test("澄清后只补充 DiVA 即继续回答原来的成果问题", async () => {
  const result = await ask([{ role: "user", content: question }, { role: "assistant", content: "您指的是哪个项目？" }, { role: "user", content: "DiVA" }]);
  assert.equal(result.done.responseStatus, "completed");
  assert.match(result.answer, /不是曝光、点击或订单转化数据/);
});

test("其他项目的同类追问不能借用 DiVA 交付结果", () => {
  for (const project of ["RAG", "DeepFlow", "机票比价 Skill"]) {
    const history: ChatMessage[] = [{ role: "user", content: `介绍一下 ${project}` }];
    assert.equal(findQuestionContract(question, history), undefined);
  }
});

test("假设投放方法和新增数字不命中已审核成果答案", () => {
  for (const input of ["如果 DiVA 素材投放后如何提高转化？", "DiVA 素材投放让转化提高 20% 了吗？", "比较 DiVA 和比价 Skill 的转化成果"]) {
    assert.notEqual(findQuestionContract(input)?.id, "diva_outcome_boundary");
  }
});
