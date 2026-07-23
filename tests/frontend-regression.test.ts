import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");
const appFrameSource = readFileSync(new URL("../components/app-frame.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("../components/answer-actions.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("回答首字出现前保留可感知的加载状态", () => {
  assert.match(chatSource, /className="thinking-state"/);
  assert.match(chatSource, /正在检索相关经历与项目证据/);
  assert.match(chatSource, /正在组织正式面试回答/);
  assert.match(chatSource, /正在核验事实与表达/);
  assert.match(globalStyles, /@keyframes thinking-wave/);
  assert.match(globalStyles, /\.message\.assistant\.streaming/);
});

test("每轮回答后保留三栏推荐问题卡片", () => {
  assert.match(chatSource, /className="contextual-suggestions"/);
  assert.match(chatSource, /继续了解张倬玮/);
  assert.match(chatSource, /getHrFollowUpQuestions\(lastQuestion, askedQuestions, latestAssistant\?\.followUpQuestions\)/);
  assert.match(chatSource, /从证据、复盘和岗位匹配继续追问/);
  assert.match(globalStyles, /\.contextual-suggestions-list\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
});

test("保留首页内容并补齐历史、回答动作和回到底部", () => {
  assert.match(chatSource, /className="project-proof"/);
  assert.match(chatSource, /className="suggestions"/);
  assert.match(chatSource, /className="scroll-to-latest"/);
  assert.match(appFrameSource, /<ConversationHistoryList/);
  assert.match(actionsSource, /复制回答/);
  assert.match(actionsSource, /重新回答/);
  assert.match(actionsSource, /精简一点/);
  assert.match(actionsSource, /展开证据/);
});
