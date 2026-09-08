import assert from "node:assert/strict";
import { test } from "node:test";
import { matchReviewedInterviewAnswerId } from "../content/reviewed-interview-answers.ts";
import { classifyInterviewQuestion } from "../lib/interview-question.ts";
import { matchStableAnswer, retrieveKnowledge } from "../lib/knowledge.ts";
import { normalizeInterviewQuestion } from "../lib/question-normalization.ts";
import { buildLocalQuestionFrame, findQuestionContract } from "../lib/question-contracts.ts";
import { takeStreamUnits } from "../lib/stream-answer.ts";

const baiduDutyVariants = [
  "你在百度实习中具体负责什么？",
  "你在百度实习中具体负责什么？ ”",
  "“你在百度实习中具体负责什么？”",
  "'你在百度实习中具体负责什么?'",
  "【你在百度实习中具体负责什么】",
  " 你在百度实习中具体负责什么？ ",
  "你在百度实习中具体负责什么？！",
  "你在百度实习中具体负责什么……",
  "你在百度实习中具体负责什么；",
  "你在百度实习中具体负责什么：",
  "你在百度实习中具体负责什么\u200b？",
  "你在百度实习中具体负责什么\ufeff？",
  "你在百度实习中具体负责什么\n？",
  "你在百度实习中具体负责什么\t？",
  "你在百度实习中具体负责什么 ( )？",
  "你在百度实习中具体负责什么——",
  "你在百度实习中具体负责什么 /",
  "你在百度实习中具体负责什么\\",
  "你在百度实习中具体负责什么，",
  "你在百度实习中具体负责什么。",
] as const;

test("20 个复制与标点扰动都命中同一百度职责原稿", () => {
  const canonical = normalizeInterviewQuestion(baiduDutyVariants[0]);
  assert.equal(baiduDutyVariants.length, 20);
  for (const question of baiduDutyVariants) {
    assert.equal(normalizeInterviewQuestion(question), canonical, question);
    assert.equal(findQuestionContract(question)?.id, "baidu_contribution", question);
    assert.equal(matchStableAnswer(question)?.id, "A28", question);
  }
});

const answerableOpenQuestions = [
  "如果让你设计商业化产品，怎么提高营收？",
  "你会怎么拆解一个增长问题？",
  "说服不了别人怎么办？",
  "同事不同意你的方案时怎么处理？",
  "如果产品上线后留存下降，你会先看什么？",
  "如何为老年用户设计一款 AI 助手？",
  "估算北京每天卖出多少杯咖啡。",
  "面对陌生业务，你会如何快速理解？",
  "资源不足时你如何排优先级？",
  "需求频繁变化时你怎么推进？",
  "你怎么看 AI 产品中的人工复核？",
  "跨团队协作卡住时怎么办？",
  "如果研发认为需求价值不高，你怎么沟通？",
  "如何设计一个付费转化漏斗？",
  "怎么判断一个 MVP 值得继续投入？",
  "工作压力很大时你如何保证质量？",
  "你如何处理多个紧急任务？",
  "一个新功能应该看哪些核心指标？",
  "如果没有足够数据，你会怎样做产品判断？",
  "你会如何复盘一次没有达到目标的项目？",
] as const;

test("20 个常见面试开放题不会因宽泛词被拒答", () => {
  assert.equal(answerableOpenQuestions.length, 20);
  for (const question of answerableOpenQuestions) {
    const frame = buildLocalQuestionFrame(question);
    const classification = classifyInterviewQuestion(question, frame.answerIntent, frame.questionMode);
    assert.notEqual(classification.questionFamily, "unrelated", question);
    assert.notEqual(classification.factRisk, "unsupported_personal", question);
    assert.notEqual(classification.answerStrategy, "decline", question);
  }
});

test("说服与分歧题会携带可公开的沟通证据", () => {
  const question = "说服不了别人怎么办？";
  const frame = buildLocalQuestionFrame(question);
  assert.ok(retrieveKnowledge(question, { frame, limit: 4 }).some((item) => item.id === "K49"));
});

const reviewedAnswerCases = [
  ["请用60秒介绍张倬玮。", "A01"],
  ["“60 秒了解张倬玮？”", "A01"],
  ["请介绍一下你自己", "A01"],
  ["你为什么适合 AI 产品经理岗位？", "A02"],
  ["为什么选择你来做这个岗位？", "A02"],
  ["“百度实习你具体做了什么？”", "A28"],
  ["AI 编程占比多少？", "A07"],
  ["AI 写了代码，你的价值在哪里？", "A07"],
  ["请介绍一下你的百度 AI 产品经理实习。", "A25"],
  ["介绍一下你的百度实习", "A25"],
  ["你在百度实习期间主要做了什么？", "A25"],
  ["你在百度实习中具体负责了什么？", "A28"],
  ["你在百度实习中具体负责了哪些工作？", "A28"],
  ["百度实习你具体做了什么？", "A28"],
  ["模型评测发现问题后你怎么归因？", "A29"],
  ["Evaluator Agent 的评分可靠吗？", "A30"],
  ["请介绍一下你的 RAG 知识库项目。", "A31"],
  ["介绍一下你的百川实习。", "A35"],
  ["你的经历是怎么串联起来的？", "A36"],
  ["为什么做这些项目？", "A36"],
] as const;

test("20 个已审核面试稿问法只引用统一答案来源", () => {
  assert.equal(reviewedAnswerCases.length, 20);
  for (const [question, answerId] of reviewedAnswerCases) {
    assert.equal(matchReviewedInterviewAnswerId(question), answerId, question);
    assert.equal(matchStableAnswer(question)?.id, answerId, question);
  }
});

const boundaryCases = [
  ["你拿到过亿元融资吗？", "unsupported_personal"],
  ["你真实创造过多少营收？", "unsupported_personal"],
  ["你带领过多少人的正式团队？", "unsupported_personal"],
  ["你最喜欢哪支球队？", "unsupported_personal"],
  ["你的期望薪资是多少？", "unsupported_personal"],
  ["你什么时候可以到岗？", "unsupported_personal"],
  ["你是否独立训练过千亿参数模型？", "unsupported_personal"],
  ["你有多少付费用户？", "unsupported_personal"],
  ["你是否完成过客户生产交付？", "supported_personal"],
  ["你在项目中真实实现了多少增长？", "supported_personal"],
  ["如果目标是提高营收，你会怎么分析？", "low"],
  ["假设要做融资信息产品，你会怎么设计？", "low"],
  ["如果需要带一个临时项目组，你会怎么推进？", "low"],
  ["如何估算一个新产品的付费用户？", "low"],
  ["如果让你设计自动驾驶产品，你会先判断什么？", "low"],
  ["假设客户要求上线，你如何设计验收？", "low"],
  ["怎样设计一款提升收入的商业化产品？", "low"],
  ["如果产品没有增长，你会排查什么？", "low"],
  ["面对薪资问题时你会如何沟通？", "unsupported_personal"],
  ["你怎么看最新融资环境？", "freshness_sensitive"],
] as const;

test("20 个事实与方法边界区分真实业绩和假设推演", () => {
  assert.equal(boundaryCases.length, 20);
  for (const [question, expectedRisk] of boundaryCases) {
    const frame = buildLocalQuestionFrame(question);
    assert.equal(frame.factRisk, expectedRisk, question);
    if (expectedRisk === "low") assert.notEqual(frame.answerStrategy, "decline", question);
  }
});

test("流式切片可在完整回答结束前释放安全的首个短句", () => {
  const text = "我的处理思路是先明确商业目标和目标用户，再拆解收入、转化与留存之间的关系，之后建立指标树继续验证。";
  const firstPass = takeStreamUnits(text.slice(0, 46));
  assert.ok(firstPass.units.length >= 1);
  assert.equal(firstPass.units[0].sentenceComplete, false);
  assert.ok(firstPass.rest.length > 0);
});
