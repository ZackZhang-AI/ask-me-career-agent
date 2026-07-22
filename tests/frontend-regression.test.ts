import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("回答首字出现前保留可感知的加载状态", () => {
  assert.match(chatSource, /className="thinking-state"/);
  assert.match(chatSource, /正在准备回答/);
  assert.match(globalStyles, /@keyframes thinking-wave/);
  assert.match(globalStyles, /\.message\.assistant\.streaming/);
});

test("每轮回答后保留三栏推荐问题卡片", () => {
  assert.match(chatSource, /className="contextual-suggestions"/);
  assert.match(chatSource, /继续了解张倬玮/);
  assert.match(chatSource, /getFollowUpQuestions\(lastQuestion, askedQuestions, 3, latestAssistant\?\.followUpQuestions\)/);
  assert.match(globalStyles, /\.contextual-suggestions-list\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
});
