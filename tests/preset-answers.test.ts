import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateAnswerCitations } from "../lib/answer-citations.ts";
import { getClaims } from "../lib/knowledge.ts";
import { buildHomepagePresetAnswers, homepagePresetQuestions } from "../lib/preset-answers.ts";

const chatSource = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");

test("首屏四题都生成通过质量门禁的公开预设回答包", () => {
  const answers = buildHomepagePresetAnswers();
  assert.equal(answers.length, 4);
  assert.deepEqual(answers.map((answer) => answer.question), homepagePresetQuestions);

  for (const answer of answers) {
    assert.equal(answer.mode, "stable");
    assert.equal(answer.responseStatus, "completed");
    assert.equal(answer.content.length > 250, true);
    assert.equal(answer.followUpQuestions.length, 3);
    assert.equal(answer.sources.length > 0, true);
    assert.equal(answer.sources.every((source) => source.public && source.visibility === "public"), true);
    assert.equal(validateAnswerCitations(answer.citations, getClaims(answer.claimIds)), true);
  }
});

test("快速通道仅用于首轮且保留现有加载状态", () => {
  assert.match(chatSource, /!retry && messages\.length === 0/);
  assert.match(chatSource, /PRESET_THINKING_MS = 90/);
  assert.match(chatSource, /className="thinking-state"/);
  assert.match(chatSource, /fetch\("\/api\/chat"/);
});
