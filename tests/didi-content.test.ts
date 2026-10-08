import assert from "node:assert/strict";
import test from "node:test";
import { candidateNarrative } from "../content/narrative.ts";
import { didiClaims, didiKnowledge } from "../content/didi-evidence.ts";
import { didiAnswerInputs } from "../content/didi-answers.ts";
import { buildAnswerPlan } from "../lib/answer.ts";
import { validateAnswer } from "../lib/answer-quality.ts";
import { contentCatalog, contentCatalogSchema } from "../lib/content.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import { buildLocalQuestionFrame } from "../lib/question-contracts.ts";

for (const [length, introduction] of Object.entries(candidateNarrative.introductions)) {
  test(`新版自我介绍 ${length} 保留核心判断、删除数字堆叠`, () => {
    assert.match(introduction, /滴滴/);
    assert.match(introduction, /百川/);
    assert.match(introduction, /六个旗舰模型/);
    assert.match(introduction, /Bad Case/);
    assert.doesNotMatch(introduction, /36\s*次|18\s*次|V0\.[12]|希望加入/);
  });
}

for (const input of didiAnswerInputs) {
  test(`${input.id} 已审核答案能通过线上同一质量门禁`, () => {
    const frame = buildLocalQuestionFrame(input.question);
    const stable = matchStableAnswer(input.question, [], frame);
    assert.equal(stable?.id, input.id);
    const plan = buildAnswerPlan(input.question, retrieveKnowledge(input.question, { frame }), stable, [], frame);
    const result = validateAnswer(input.standardAnswer, plan);
    assert.equal(result.passed, true, JSON.stringify(result));
    assert.equal(stable?.requiredSourceIds.includes("S15"), true);
    assert.doesNotMatch(input.standardAnswer, /16\s*小时|4\s*小时|3108|37\s*条|5\s*分钟|数仓回流|导师让我/);
  });
}

const factChecks = [
  ["C39", /2026 年 9 月至今.*滴滴 ABC/],
  ["C40", /主导.*产品设计.*人工审核/],
  ["C41", /11 个.*60\+.*2 小时.*40 分钟.*80%/],
  ["C42", /数据清洗.*同期采集.*航班匹配.*报告导出/],
  ["C43", /80 组航线分析.*75%.*供给缺口/],
  ["C44", /处理方法.*假设题/],
] as const;
for (const [id, expected] of factChecks) {
  test(`${id} 确认事实有来源且不混入演练样本`, () => {
    const claim = didiClaims.find((item) => item.id === id);
    assert.ok(claim);
    assert.match(claim.statement, expected);
    assert.ok(claim.sourceIds.length);
    assert.doesNotMatch(claim.statement, /3108|37 条|16 小时|4 小时|75 份|5 批/);
  });
}

test("新增内容保持目录引用完整并保留原有故事", () => {
  assert.doesNotThrow(() => contentCatalogSchema.parse(contentCatalog));
  assert.equal(contentCatalog.starStories.length, 11);
  assert.ok(contentCatalog.knowledge.some((item) => item.id === "K22"));
  assert.ok(contentCatalog.knowledge.some((item) => item.id === "K61"));
});

test("百度结束时间和滴滴当前任职不冲突", () => {
  const baidu = contentCatalog.claims.find((item) => item.id === "C13");
  assert.match(baidu?.statement ?? "", /2026 年 6 月至 9 月/);
  assert.doesNotMatch(baidu?.statement ?? "", /至今/);
  assert.match(didiClaims[0].statement, /2026 年 9 月至今/);
});

for (const id of ["K57", "K60", "K61"]) {
  test(`${id} 方法和待确认信息不授权真实历史事件`, () => {
    const item = didiKnowledge.find((entry) => entry.id === id);
    assert.equal(item?.evidenceKind, "method");
    assert.ok(item?.limitations);
  });
}

test("公开知识不包含原始面试稿本地路径或模拟台账", () => {
  const publicText = JSON.stringify(didiKnowledge);
  assert.doesNotMatch(publicText, /FileStorage|wxid_|Users\/didi|3108|115.*38|16 小时.*4 小时/);
});
