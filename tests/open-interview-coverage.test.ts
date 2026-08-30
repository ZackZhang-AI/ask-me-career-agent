import assert from "node:assert/strict";
import test from "node:test";
import { buildAnswerPlan } from "../lib/answer.ts";
import { decideAnswerability } from "../lib/answerability.ts";
import { classifyInterviewQuestion } from "../lib/interview-question.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import { buildLocalQuestionFrame, findQuestionContract, mergePlannedFrame } from "../lib/question-contracts.ts";
import { multiTurnInterviewCases, openInterviewCases } from "./evals/open-interview-cases.ts";

test("开放面试评测覆盖 150 道单轮题和 50 道多轮追问", () => {
  assert.equal(openInterviewCases.length, 150);
  assert.equal(multiTurnInterviewCases.length, 50);
  assert.equal(new Set(openInterviewCases.map((item) => item.question)).size, 150);
  const counts = openInterviewCases.reduce<Record<string, number>>((result, item) => ({
    ...result,
    [item.family]: (result[item.family] ?? 0) + 1,
  }), {});
  for (const family of ["candidate_fact", "behavioral", "situational", "product_case", "business_case", "estimation", "motivation", "work_style", "career_logistics", "current_topic"] as const) {
    assert.ok((counts[family] ?? 0) >= 15, family);
  }
  assert.ok(new Set(multiTurnInterviewCases.map((item) => item.dialogueId)).size >= 10);
});

test("单轮开放题获得稳定的本地题型和事实风险初判", () => {
  for (const fixture of openInterviewCases) {
    const frame = buildLocalQuestionFrame(fixture.question);
    const classification = classifyInterviewQuestion(fixture.question, frame.answerIntent, frame.questionMode);
    assert.equal(classification.questionFamily, fixture.family, fixture.question);
    if (fixture.family === "career_logistics") {
      assert.equal(classification.factRisk, "unsupported_personal", fixture.question);
      assert.equal(classification.answerStrategy, "boundary_bridge", fixture.question);
    }
    if (fixture.family === "current_topic") assert.equal(classification.factRisk, "freshness_sensitive", fixture.question);
  }
});

test("未记录求职安排使用边界承接，低风险方法题保持可回答", () => {
  for (const fixture of openInterviewCases.filter((item) => ["career_logistics", "situational", "product_case", "business_case", "estimation"].includes(item.family))) {
    const frame = buildLocalQuestionFrame(fixture.question);
    const contract = findQuestionContract(fixture.question);
    const items = retrieveKnowledge(fixture.question, { frame, limit: 4 });
    const stableAnswer = matchStableAnswer(fixture.question, [], frame);
    const plan = buildAnswerPlan(fixture.question, items, stableAnswer, [], frame, contract);
    const decision = decideAnswerability({
      question: fixture.question,
      history: [],
      frame,
      plan,
      items,
      claimIds: stableAnswer ? stableAnswer.requiredClaimIds : [...new Set(items.flatMap((item) => item.claimIds))],
      sourceIds: stableAnswer ? stableAnswer.requiredSourceIds : [...new Set(items.flatMap((item) => item.sourceIds))],
      stableAnswer,
      contract,
    });
    if (fixture.family === "career_logistics") {
      assert.equal(decision.disposition, "decline", fixture.question);
      assert.match(decision.message ?? "", /谨慎回答|没有.*准确|不希望.*承诺/, fixture.question);
    } else {
      assert.ok(["answer", "scoped_answer"].includes(decision.disposition), fixture.question);
    }
  }
});

test("模型规划器不能把工作风格题降成缺少个人证据的事实题", () => {
  const question = "你平时如何面对压力和不确定性？";
  const local = buildLocalQuestionFrame(question);
  const merged = mergePlannedFrame(local, {
    topic: "profile",
    facet: "overview",
    answerIntent: "work_style",
    questionMode: "candidate_fact",
    evidencePolicy: "required",
    questionFamily: "work_style",
    factRisk: "supported_personal",
    answerStrategy: "evidence_answer",
    focusTerms: ["压力处理"],
    requestedDimensions: ["工作方式"],
    useHistory: false,
    confidence: 0.9,
  }, question);
  assert.equal(merged.questionMode, "candidate_reasoning");
  assert.equal(merged.factRisk, "low");
  assert.equal(merged.answerStrategy, "reasoned_answer");
});
