import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LOCAL_CONVERSATIONS,
  conversationTitle,
  parseConversationHistory,
  renameLocalConversation,
  upsertLocalConversation,
  type LocalConversation,
} from "../lib/conversation-history.ts";

test("本机历史以首个问题生成紧凑标题", () => {
  assert.equal(conversationTitle([{ role: "user", content: "  请介绍一下你的 RAG 项目  " }]), "请介绍一下你的 RAG 项目");
  assert.match(conversationTitle([{ role: "user", content: "这是一个明显超过二十八个字符并需要被截断的面试问题标题示例文本" }]), /…$/);
});

test("会话更新后置顶并最多保留十条", () => {
  let history: LocalConversation[] = [];
  for (let index = 0; index < MAX_LOCAL_CONVERSATIONS + 2; index += 1) {
    history = upsertLocalConversation(
      history,
      `conversation-${index}`,
      [{ role: "user", content: `问题 ${index}` }, { role: "assistant", content: `回答 ${index}`, responseStatus: "completed" }],
      new Date(2026, 0, index + 1).toISOString(),
    );
  }
  assert.equal(history.length, MAX_LOCAL_CONVERSATIONS);
  assert.equal(history[0]?.id, "conversation-11");

  history = upsertLocalConversation(
    history,
    "conversation-5",
    [{ role: "user", content: "问题 5" }, { role: "assistant", content: "更新后的回答", responseStatus: "completed" }],
    new Date(2026, 1, 1).toISOString(),
  );
  assert.equal(history[0]?.id, "conversation-5");
  assert.equal(history[0]?.messages.at(-1)?.content, "更新后的回答");
});

test("损坏的本地数据不会阻断页面，重命名保留其他会话", () => {
  assert.deepEqual(parseConversationHistory("{not-json"), []);
  assert.deepEqual(parseConversationHistory(JSON.stringify([{ id: "empty", messages: [] }])), []);

  const history = upsertLocalConversation([], "one", [{ role: "user", content: "原问题" }]);
  const renamed = renameLocalConversation(history, "one", "  新标题  ");
  assert.equal(renamed[0]?.title, "新标题");
  assert.equal(renamed[0]?.messages[0]?.content, "原问题");
});
