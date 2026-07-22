import assert from "node:assert/strict";
import test from "node:test";
import { isNearScrollBottom, prepareQuestionMessages, presetRevealChunks } from "../lib/chat-session.ts";
import type { ChatMessage } from "../lib/types.ts";

test("普通追问保留上下文并追加一条用户消息", () => {
  const messages: ChatMessage[] = [
    { role: "user", content: "先介绍 RAG 项目" },
    { role: "assistant", content: "这是项目介绍" },
  ];

  assert.deepEqual(prepareQuestionMessages(messages, "它有什么限制？"), [
    ...messages,
    { role: "user", content: "它有什么限制？" },
  ]);
});

test("重新生成替换末轮内容且不会复制用户问题", () => {
  const messages: ChatMessage[] = [
    { role: "user", content: "先介绍 RAG 项目" },
    { role: "assistant", content: "这是项目介绍" },
    { role: "user", content: "它有什么限制？" },
    { role: "assistant", content: "未完整回答" },
  ];

  const retried = prepareQuestionMessages(messages, "它有什么限制？", true);
  assert.equal(retried.filter((message) => message.content === "它有什么限制？").length, 1);
  assert.deepEqual(retried.at(-1), { role: "user", content: "它有什么限制？" });
  assert.equal(retried.some((message) => message.content === "未完整回答"), false);
});

test("仅在接近滚动区底部时继续自动跟随回答", () => {
  assert.equal(isNearScrollBottom(1000, 400, 480), true);
  assert.equal(isNearScrollBottom(1000, 300, 480), false);
});

test("预设回答先展示完整首句再快速补齐余文", () => {
  const content = "第一句立即展示。第二段继续解释产品取舍与评测方式。最后总结。";
  const chunks = presetRevealChunks(content, 3);
  assert.equal(chunks[0], "第一句立即展示。");
  assert.equal(chunks.join(""), content);
  assert.equal(chunks.length <= 4, true);
});
