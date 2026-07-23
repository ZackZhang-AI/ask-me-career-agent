import assert from "node:assert/strict";
import test from "node:test";
import {
  getFollowUpQuestions,
  getHrFollowUpQuestions,
  inferQuestionCategory,
  questionGroups,
} from "../lib/question-suggestions.ts";
import { findQuestionContract } from "../lib/question-contracts.ts";

test("首屏问题按招聘关注点分组", () => {
  assert.deepEqual(questionGroups.map((group) => group.id), ["screening", "projects", "experience", "capabilities"]);
  for (const group of questionGroups) assert.equal(group.questions.length, 4);
  assert.doesNotMatch(questionGroups.flatMap((group) => group.questions).join(" "), /(^|\s)他|他的|帮助他|体现了他/);
});

test("项目问题推荐核心工作和效果追问", () => {
  const questions = getFollowUpQuestions("哪个项目最能代表他的 AI 产品能力？");
  assert.equal(inferQuestionCategory("哪个项目最能代表他的 AI 产品能力？"), "project");
  assert.match(questions.join(" "), /核心工作/);
  assert.match(questions.join(" "), /评估并改进/);
});

test("动态追问不会重复已提问题", () => {
  const asked = ["他的主要短板是什么？", "面试中最应该核实什么？"];
  const questions = getFollowUpQuestions(asked[0], asked);
  for (const question of questions) assert.equal(asked.includes(question), false);
  assert.equal(questions.length, 3);
});

test("服务端追问不足时会补足三个推荐", () => {
  const asked = ["哪个项目最能代表他的 AI 产品能力？", "你在这个项目中具体做了什么？"];
  const preferred = ["你在这个项目中具体做了什么？"];
  const questions = getFollowUpQuestions(asked[1], asked, 3, preferred);

  assert.equal(questions.length, 3);
  for (const question of questions) assert.equal(asked.includes(question), false);
});

test("推荐问题统一使用面向候选人的第二人称视角", () => {
  const questions = getFollowUpQuestions(
    "RAG 项目中有哪些产品取舍？",
    [],
    3,
    ["最难的产品取舍是什么？", "你如何评估 RAG 回答质量？", "你的核心贡献是什么？"],
  );

  assert.equal(questions.length, 3);
  for (const question of questions) {
    assert.equal(question.startsWith("他"), false);
    assert.doesNotMatch(question, /他的|帮助他|体现了他/);
  }
  assert.match(questions[0], /^你在这个项目中/);
  assert.match(questions[1], /^你如何评估/);
});

test("第三个追问跳出当前项目话题", () => {
  const projectQuestions = getFollowUpQuestions(
    "RAG 项目中有哪些产品取舍？",
    [],
    3,
    ["他在 RAG 项目中负责什么？", "他如何评估 RAG 回答质量？", "RAG 项目还有哪些取舍？"],
  );
  const experienceQuestions = getFollowUpQuestions("审计经历如何帮助他做 AI 产品？");

  assert.notEqual(inferQuestionCategory(projectQuestions[2]), "project");
  assert.notEqual(inferQuestionCategory(experienceQuestions[2]), "experience");
});

test("连续多轮提问后每轮仍提供三个未问追问", () => {
  const asked: string[] = ["60 秒了解张倬玮。"];

  for (let round = 0; round < 8; round += 1) {
    const currentQuestion = asked.at(-1) ?? "";
    const questions = getFollowUpQuestions(currentQuestion, asked);
    assert.equal(questions.length, 3, `第 ${round + 1} 轮没有补足三个追问`);
    for (const question of questions) assert.equal(asked.includes(question), false);
    const currentTopic = findQuestionContract(currentQuestion)?.frame.topic;
    const thirdTopic = findQuestionContract(questions[2])?.frame.topic;
    if (currentTopic && thirdTopic) assert.notEqual(thirdTopic, currentTopic);
    if (round < 7) asked.push(questions[0]);
  }
});

test("首页和动态追问不主动推荐刁难型问题", () => {
  const surfacedQuestions = [
    ...questionGroups.flatMap((group) => group.questions),
    ...getFollowUpQuestions("他的主要短板是什么？"),
    ...getFollowUpQuestions("可以直接录用他吗？"),
  ];
  assert.doesNotMatch(surfacedQuestions.join(" "), /短板|最应该核实|真实用户增长|独立训练大模型|录用结论/);
});

test("HR 追问固定覆盖证据、复盘和岗位匹配", () => {
  const suggestions = getHrFollowUpQuestions(
    "哪个项目最能代表你的 AI 产品能力？",
    ["哪个项目最能代表你的 AI 产品能力？"],
  );
  assert.deepEqual(suggestions.map((suggestion) => suggestion.kind), ["evidence", "retrospective", "fit"]);
  assert.deepEqual(suggestions.map((suggestion) => suggestion.label), ["证据追问", "项目复盘", "岗位匹配"]);
  assert.equal(new Set(suggestions.map((suggestion) => suggestion.question)).size, 3);
});
