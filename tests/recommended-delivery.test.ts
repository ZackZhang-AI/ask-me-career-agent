import assert from "node:assert/strict";
import test from "node:test";
import { buildChatDelivery } from "../lib/chat-pipeline.ts";
import { hasBlockingLocalQualityTriggers } from "../lib/answer-quality.ts";
import { findQuestionContract, questionContracts } from "../lib/question-contracts.ts";
import { getFollowUpQuestions, getHrFollowUpQuestions } from "../lib/question-suggestions.ts";
import type { ChatMessage } from "../lib/types.ts";

function answer(question: string, history: ChatMessage[] = []) {
  return buildChatDelivery({
    question, messages: [...history, { role: "user", content: question }],
    sessionId: "recommended-delivery-test", signal: new AbortController().signal,
    modelConfigured: false, estimatedTokens: 0, initialTokenReservation: 0, onStage: () => {},
  });
}

test("截图可信度问题经过真实稳定答案匹配后完成，不被首段同义表达误拦", async () => {
  for (const question of ["你如何证明自动评测结果可信？", "Evaluator Agent的评分可靠吗", "你如何证明自动评测结果可信？ ”"]) {
    const result = await answer(question);
    assert.equal(result.responseStatus, "completed", question);
    assert.match(result.answer, /校准/);
    assert.doesNotMatch(result.answer, /没有成功生成/);
  }
});

test("同义追问和重新回答保留安全答案，不把重复误报为服务故障", async () => {
  for (const previous of ["你如何评估 RAG 回答质量？", "你如何定义并验收 AI 产品效果？", "你如何评估并改进 AI 产品效果？"]) {
    const first = await answer(previous);
    assert.equal(first.responseStatus, "completed");
    const result = await answer("你如何评估并改进 AI 产品效果？", [
      { role: "user", content: previous }, { role: "assistant", content: first.answer },
    ]);
    assert.equal(result.responseStatus, "completed");
    assert.ok(result.diagnostic.semanticWarningCount! > 0);
    assert.match(result.answer, /Bad Case/);
  }
});

test("推荐按答案契约去重，不用另一种问法再次推荐同一答案", () => {
  const previous = "你如何评估 RAG 回答质量？";
  const recommendations = [
    ...getFollowUpQuestions(previous, [previous]),
    ...getHrFollowUpQuestions(previous, [previous]).map((item) => item.question),
  ];
  assert.ok(recommendations.length);
  assert.ok(recommendations.every((question) => findQuestionContract(question)?.id !== "evaluation"));
});

test("连续八轮点击三类推荐，使用实际回答历史逐条验收", async () => {
  const history: ChatMessage[] = [];
  let question = "你在百度实习中具体负责什么？";
  for (let turn = 0; turn < 8; turn++) {
    const result = await answer(question, history);
    assert.equal(result.responseStatus, "completed", `${turn}: ${question}`);
    history.push({ role: "user", content: question }, { role: "assistant", content: result.answer });
    const asked = history.filter((message) => message.role === "user").map((message) => message.content);
    const suggestions = getHrFollowUpQuestions(question, asked, result.followUpQuestions);
    assert.ok(suggestions.length);
    for (const suggestion of suggestions) {
      const next = await answer(suggestion.question, history);
      assert.equal(next.responseStatus, "completed", `${turn}: ${suggestion.question}`);
      assert.ok(next.answer.trim());
    }
    question = suggestions[turn % suggestions.length].question;
  }
});

test("本地质量策略只放行表达与重复提示，不放宽事实和相关性", () => {
  assert.equal(hasBlockingLocalQualityTriggers(["repetitive_answer", "repeated_closing", "insufficient_emphasis"]), false);
  for (const trigger of ["unsupported_number", "unsupported_organization", "unsupported_event", "forbidden:客户上线", "indirect_opening", "missing_required:1", "answer_too_short"]) {
    assert.equal(hasBlockingLocalQualityTriggers(["repetitive_answer", trigger]), true, trigger);
  }
});

test("全部本地契约经过实际稳定答案优先级后仍可完成", async () => {
  for (const contract of questionContracts.filter((item) => item.generationMode !== "realtime")) {
    const result = await answer(contract.question);
    assert.equal(result.responseStatus, "completed", contract.id);
  }
});
