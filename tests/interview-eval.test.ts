import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInterviewCases,
  interviewRoles,
  launchExitCode,
  questionCategories,
  resolveReportOutputPath,
  runInterviewEvaluation,
  scoreDimensions,
} from "../scripts/run-interview-eval.ts";

test("AI 面试预演覆盖 6 个模拟角色与 8 类问题", () => {
  const cases = buildInterviewCases();
  assert.equal(interviewRoles.length, 6);
  assert.equal(questionCategories.length, 8);
  assert.equal(cases.length, 48);
  assert.equal(new Set(cases.map((item) => item.id)).size, 48);
  assert.equal(new Set(cases.map((item) => item.question)).size, 48);
  assert.deepEqual(questionCategories.map((item) => item.name), [
    "60秒介绍",
    "岗位匹配",
    "代表项目",
    "个人贡献",
    "AI编程占比",
    "挑战或失败",
    "用户与业务价值",
    "是否建议进入下一轮",
  ]);
  for (const role of interviewRoles) assert.equal(cases.filter((item) => item.roleId === role.id).length, 8);
  for (const category of questionCategories) assert.equal(cases.filter((item) => item.categoryId === category.id).length, 6);
});

test("无 API Key 时生成确定性的本地合成报告", async () => {
  const generatedAt = new Date("2026-07-17T00:00:00.000Z");
  const first = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt });
  const second = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt });
  assert.deepEqual(first, second);
  assert.equal(first.execution.effectiveMode, "local");
  assert.equal(first.simulation.synthetic, true);
  assert.equal(first.simulation.replacesHumanTesting, false);
  assert.match(first.simulation.label, /不能替代.*真人/);
  assert.equal(first.results.length, 48);
  assert.equal(first.results.every((item) => item.syntheticSimulation), true);
  assert.equal(JSON.stringify(first).includes("DEEPSEEK_API_KEY"), false);
});

test("五维评分均在 0 至 5 分且总分可复算", async () => {
  const report = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt: new Date("2026-07-17T00:00:00.000Z") });
  assert.deepEqual(scoreDimensions, ["清晰度", "差异化", "可信度", "追问承受力", "面试转化意愿"]);
  for (const result of report.results) {
    const values = scoreDimensions.map((dimension) => result.scores[dimension]);
    assert.equal(values.every((value) => Number.isInteger(value) && value >= 0 && value <= 5), true, result.id);
    assert.equal(result.scores.total, values.reduce((sum, value) => sum + value, 0), result.id);
    assert.equal(result.answer.text.length > 0, true, result.id);
    assert.equal(result.answer.claimIds.every((id) => /^C\d+$/.test(id)), true, result.id);
    assert.equal(result.answer.sourceIds.every((id) => /^S\d+$/.test(id)), true, result.id);
  }
});

test("通过门槛是至少 5/6 个模拟角色建议进入下一轮", async () => {
  const report = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt: new Date("2026-07-17T00:00:00.000Z") });
  assert.equal(report.scoring.recommendedRoleThreshold, 5);
  assert.equal(report.roleRecommendations.length, 6);
  assert.equal(report.summary.recommendedRoleCount, report.roleRecommendations.filter((item) => item.recommendsNextRound).length);
  assert.equal(report.summary.passedRecommendationGate, report.summary.recommendedRoleCount >= 5);
  assert.equal(report.summary.recommendedRoleCount >= 5, true);
});

test("上线还要求清晰度与差异化平均分均不低于 4", async () => {
  const report = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt: new Date("2026-07-17T00:00:00.000Z") });
  assert.equal(report.scoring.qualityAverageThreshold, 4);
  const expectedQualityGate = report.summary.averageByDimension.清晰度 >= 4
    && report.summary.averageByDimension.差异化 >= 4;
  assert.equal(report.summary.passedQualityGate, expectedQualityGate);
  assert.equal(report.summary.passedLaunchGate, report.summary.passedRecommendationGate && report.summary.passedQualityGate);
  assert.equal(launchExitCode(report), report.summary.passedLaunchGate ? 0 : 1);

  const failed = structuredClone(report);
  failed.summary.passedQualityGate = false;
  failed.summary.passedLaunchGate = false;
  assert.equal(launchExitCode(failed), 1);

  const passed = structuredClone(report);
  passed.summary.passedRecommendationGate = true;
  passed.summary.passedQualityGate = true;
  passed.summary.passedLaunchGate = true;
  assert.equal(launchExitCode(passed), 0);
});

test("显式 DeepSeek 模式在无密钥时安全失败", async () => {
  await assert.rejects(
    runInterviewEvaluation({ requestedMode: "deepseek", apiKey: "" }),
    /需要服务端 API 密钥.*不会写入报告或日志/,
  );
});

test("报告路径被强制限制在已忽略的 output 目录", () => {
  assert.match(resolveReportOutputPath("output/custom/interview.json"), /output[\\/]custom[\\/]interview\.json$/);
  assert.throws(() => resolveReportOutputPath("content/interview.json"), /只能写入.*output/);
  assert.throws(() => resolveReportOutputPath("output"), /只能写入.*output/);
});
