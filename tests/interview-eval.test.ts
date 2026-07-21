import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInterviewCases,
  buildReleaseCases,
  evaluateAnswerQuality,
  interviewRoles,
  launchExitCode,
  questionCategories,
  resolveReportOutputPath,
  runInterviewEvaluation,
  scoreAnswer,
  scoreDimensions,
  type EvaluationAnswer,
  type InterviewCase,
} from "../scripts/run-interview-eval.ts";

const generatedAt = new Date("2026-07-17T00:00:00.000Z");
let cachedReport: Awaited<ReturnType<typeof runInterviewEvaluation>> | undefined;
async function localReport() {
  cachedReport ??= await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt });
  return cachedReport;
}

test("AI 面试预演覆盖 6 个模拟角色与 8 类问题", () => {
  const cases = buildInterviewCases();
  const releaseCases = buildReleaseCases();
  assert.equal(interviewRoles.length, 6);
  assert.equal(questionCategories.length, 8);
  assert.equal(cases.length, 48);
  assert.equal(new Set(cases.map((item) => item.id)).size, 48);
  assert.equal(new Set(cases.map((item) => item.question)).size, 8);
  assert.equal(new Set(cases.map((item) => `${item.roleId}:${item.categoryId}`)).size, 48);
  assert.equal(releaseCases.length, 8);
  assert.equal(new Set(releaseCases.map((item) => item.question)).size, 8);
  assert.deepEqual(questionCategories.map((item) => item.name), [
    "60 秒介绍", "岗位匹配", "代表项目", "个人贡献", "AI 编程占比", "挑战或失败", "用户与业务价值", "是否建议进入下一轮",
  ]);
});

test("本地合成报告确定且不包含 API Key", async () => {
  const first = await localReport();
  const second = await runInterviewEvaluation({ requestedMode: "local", apiKey: "", generatedAt });
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 4);
  assert.equal(first.execution.effectiveMode, "local");
  assert.equal(first.simulation.synthetic, true);
  assert.equal(first.simulation.replacesHumanTesting, false);
  assert.match(first.simulation.label, /不能替代真人/);
  assert.equal(first.results.length, 8);
  assert.equal(first.simulation.roleCount, 0);
  assert.equal(first.roleRecommendations.length, 0);
  assert.equal(JSON.stringify(first).includes("DEEPSEEK_API_KEY"), false);
});

test("可信度不再依赖 Claim、Source 或边界词", () => {
  const testCase: InterviewCase = {
    id: "unit", roleId: "unit", roleName: "unit", roleFocus: "unit", categoryId: "unit", categoryName: "unit",
    question: "介绍项目", anchors: ["RAG", "评测"],
    semanticGroups: [["RAG"], ["评测"]],
  };
  const base: EvaluationAnswer = { text: "RAG 评测。", responseStatus: "completed", claimIds: [], sourceIds: [], answerMode: "deepseek" };
  const metadataOnly: EvaluationAnswer = { ...base, text: "RAG 评测。证据边界需要面试核实。", claimIds: ["C3"], sourceIds: ["S3"] };
  const firstQuality = evaluateAnswerQuality(base.text, { anchors: testCase.anchors, forbiddenFacts: [], expectedStructure: "direct" });
  const secondQuality = evaluateAnswerQuality(metadataOnly.text, { anchors: testCase.anchors, forbiddenFacts: [], expectedStructure: "direct" });
  const first = scoreAnswer(testCase, base, firstQuality);
  const second = scoreAnswer(testCase, metadataOnly, secondQuality);
  assert.ok(second.可信度 <= first.可信度);
  assert.ok(secondQuality.internalWordingHits.length > 0);
});

test("已知幻觉一律触发硬事实失败且可信度归零", () => {
  const hallucinations = [
    "我做了校园数据门户，并完成 30 次测试评审。",
    "DeepFlow 的满意度从 40% 提升到 90%。",
    "RAG 的引用准确率提升了 25%。",
    "DeepFlow 已经正式上线并商业化。",
  ];
  const testCase = buildInterviewCases()[0];
  for (const text of hallucinations) {
    const quality = evaluateAnswerQuality(text, { anchors: [], forbiddenFacts: [], expectedStructure: "direct" });
    const answer: EvaluationAnswer = { text, responseStatus: "completed", claimIds: ["C3"], sourceIds: ["S3"], answerMode: "deepseek" };
    assert.equal(quality.hardFactsPassed, false, text);
    assert.equal(scoreAnswer(testCase, answer, quality).可信度, 0, text);
  }
});

test("报告包含核心覆盖、长度、结构、套话、硬事实与多轮指标", async () => {
  const report = await localReport();
  assert.equal(report.coreResults.length, 20);
  assert.equal(report.hallucinationResults.length, 5);
  assert.equal(report.multiTurnResults.length, 4);
  assert.equal(report.multiTurnResults.filter((item) => item.turns.length === 3).length, 3);
  assert.equal(report.multiTurnResults.some((item) => item.turns.length === 6), true);
  assert.equal(report.qualityGates.coreContentCoverage >= 0 && report.qualityGates.coreContentCoverage <= 1, true);
  assert.equal(report.qualityGates.lengthComplianceRate >= 0 && report.qualityGates.lengthComplianceRate <= 1, true);
  assert.equal(report.qualityGates.structureComplianceRate >= 0 && report.qualityGates.structureComplianceRate <= 1, true);
  assert.equal(Number.isInteger(report.qualityGates.hardFactViolationCount), true);
  assert.equal(typeof report.qualityGates.hallucinationRegressionPassed, "boolean");
  assert.equal(Number.isInteger(report.qualityGates.boilerplateCaseCount), true);
  assert.equal(Array.isArray(report.qualityGates.repeatedOpeningPairs), true);
  assert.equal(Array.isArray(report.qualityGates.repeatedClosingPairs), true);
  assert.equal(Array.isArray(report.qualityGates.similarDifferentIntentPairs), true);
  assert.equal(report.qualityGates.multiTurnNewInformationRate >= 0 && report.qualityGates.multiTurnNewInformationRate <= 1, true);
  assert.equal(report.roleRecommendations.every((item) => item.memorablePhrase && item.suggestedNextQuestion), true);
});

test("五维评分在 0 到 5 分且总分可复算", async () => {
  const report = await localReport();
  assert.deepEqual(scoreDimensions, ["清晰度", "差异化", "可信度", "追问承受力", "面试转化意愿"]);
  for (const result of report.results) {
    const values: number[] = scoreDimensions.map((dimension): number => result.scores[dimension]);
    assert.equal(values.every((value) => Number.isInteger(value) && value >= 0 && value <= 5), true, result.id);
    assert.equal(result.scores.total, values.reduce((sum, value) => sum + value, 0), result.id);
  }
});

test("上线门禁同时要求角色、质量与硬指标通过", async () => {
  const report = await localReport();
  assert.equal(report.scoring.recommendedRoleThreshold, 5);
  assert.equal(report.scoring.qualityAverageThreshold, 4.3);
  assert.equal(report.scoring.targetLength, "adaptive");
  const expectedQuality = report.summary.averageByDimension.清晰度 >= 4.3
    && report.summary.averageByDimension.差异化 >= 4.3
    && report.summary.averageByDimension.可信度 >= 4.3
    && report.summary.averageByDimension.追问承受力 >= 4
    && report.summary.averageByDimension.面试转化意愿 >= 4.3;
  assert.equal(report.summary.passedQualityGate, expectedQuality);
  if (!report.qualityGates.hardFactsPassed || !report.qualityGates.coreContentPassed || report.qualityGates.lengthComplianceRate < 0.9) {
    assert.equal(report.summary.passedLaunchGate, false);
  }
  assert.equal(launchExitCode(report), report.summary.passedLaunchGate ? 0 : 1);
});

test("显式 DeepSeek 模式在无密钥时安全失败", async () => {
  await assert.rejects(runInterviewEvaluation({ requestedMode: "deepseek", apiKey: "" }), /需要服务端 API 密钥.*不会写入报告或日志/);
});

test("报告路径强制限制在已忽略的 output 目录", () => {
  assert.match(resolveReportOutputPath("output/custom/interview.json"), /output[\\/]custom[\\/]interview\.json$/);
  assert.throws(() => resolveReportOutputPath("content/interview.json"), /只能写入.*output/);
  assert.throws(() => resolveReportOutputPath("output"), /只能写入.*output/);
});
