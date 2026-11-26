import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");
const thinkingSource = readFileSync(new URL("../components/use-thinking-status.ts", import.meta.url), "utf8");
const appFrameSource = readFileSync(new URL("../components/app-frame.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("../components/answer-actions.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const revealSource = readFileSync(new URL("../components/use-stream-reveal.ts", import.meta.url), "utf8");
const revealCoreSource = readFileSync(new URL("../lib/stream-reveal.ts", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const topbarSource = readFileSync(new URL("../components/chat-topbar.tsx", import.meta.url), "utf8");
const themeToggleSource = readFileSync(new URL("../components/theme-toggle.tsx", import.meta.url), "utf8");
const formattedAnswerSource = readFileSync(new URL("../components/formatted-answer.tsx", import.meta.url), "utf8");
const evidencePanelSource = readFileSync(new URL("../components/evidence-panel.tsx", import.meta.url), "utf8");

test("回答首字出现前保留可感知的加载状态", () => {
  const loadingSources = `${chatSource}\n${thinkingSource}`;
  assert.match(chatSource, /className="thinking-state"/);
  assert.match(loadingSources, /正在组织面试回答/);
  assert.match(loadingSources, /正在理解这道面试问题/);
  assert.match(loadingSources, /正在核对相关经历与事实/);
  assert.match(loadingSources, /正在进行最终面试质量审校/);
  assert.match(loadingSources, /首个安全片段生成后会立即显示/);
  assert.match(loadingSources, /完成后再展示/);
  assert.match(chatSource, /event\.type === "stage"/);
  assert.match(chatSource, /event\.disposition === "clarify"/);
  assert.match(chatSource, /shouldFocusAfterCompletion = true/);
  assert.match(chatSource, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => inputRef\.current\?\.focus/);
  assert.match(globalStyles, /@keyframes thinking-wave/);
  assert.match(globalStyles, /\.message\.assistant\.streaming/);
  assert.match(chatSource, /if \(!answer\.trim\(\)\) throw new Error\("没有收到有效回答，请重试。"\)/);
  assert.match(chatSource, /if \(!receivedDone\) throw new Error\("回答连接提前结束，请重试。"\)/);
  assert.match(chatSource, /discardPartial = event\.discardPartial === true/);
  assert.match(chatSource, /event\.failureType === "hard_safety" \|\| event\.failureType === "transport_interrupted"/);
  assert.match(chatSource, /discardPartial \? current\.slice\(0, -1\)/);
  assert.match(chatSource, /if \(event\.type === "done"\)/);
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

test("安全语义片段通过独立队列转为自适应逐字展示", () => {
  assert.match(chatSource, /useStreamReveal/);
  assert.match(chatSource, /await finishReveal\(\)/);
  assert.match(chatSource, /aria-live="off" aria-busy=\{loading\}/);
  assert.match(revealSource, /prefers-reduced-motion: reduce/);
  assert.match(revealSource, /visibilitychange/);
  assert.match(revealCoreSource, /Intl\.Segmenter\("zh", \{ granularity: "grapheme" \}\)/);
  assert.match(revealCoreSource, /MAX_FINISHING_TAIL_MS = 1_500/);
  assert.doesNotMatch(chatSource, /PRESET_REVEAL_INTERVAL_MS/);
});

test("保持清爽现代白底绿accent风格、双主题切换、移动端抽屉与溯源微交互", () => {
  assert.match(globalStyles, /--page:\s*#ffffff/i);
  assert.match(globalStyles, /--accent:\s*#176b54/i);
  assert.match(globalStyles, /:root\[data-theme="dark"\]/);
  assert.match(layoutSource, /ask-me-theme/);
  assert.match(topbarSource, /<ThemeToggle/);
  assert.match(topbarSource, /profile\.portfolio/);
  assert.match(topbarSource, /href="\/resume"/);
  assert.match(topbarSource, /className="return-home"/);
  assert.match(themeToggleSource, /useSyncExternalStore/);
  assert.match(appFrameSource, /is-mobile-open/);
  assert.match(appFrameSource, /strength-panel/);
  assert.doesNotMatch(appFrameSource, /strength-flyout/);
  assert.match(chatSource, /event\.nativeEvent\.isComposing/);
  assert.doesNotMatch(chatSource, /disabled=\{loading\}\s*\/>/);
  assert.match(formattedAnswerSource, /\.sort\(\(left, right\) =>/);
  assert.match(evidencePanelSource, /className="source-index"/);
  assert.match(evidencePanelSource, /is-highlighted/);
});
