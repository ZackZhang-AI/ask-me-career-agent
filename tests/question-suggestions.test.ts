import assert from "node:assert/strict";
import test from "node:test";
import {
  getFollowUpQuestions,
  inferQuestionCategory,
  questionGroups,
} from "../lib/question-suggestions.ts";

test("首屏问题按招聘关注点分组", () => {
  assert.deepEqual(questionGroups.map((group) => group.id), ["screening", "projects", "experience", "capabilities"]);
  for (const group of questionGroups) assert.equal(group.questions.length, 4);
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

test("首页和动态追问不主动推荐刁难型问题", () => {
  const surfacedQuestions = [
    ...questionGroups.flatMap((group) => group.questions),
    ...getFollowUpQuestions("他的主要短板是什么？"),
    ...getFollowUpQuestions("可以直接录用他吗？"),
  ];
  assert.doesNotMatch(surfacedQuestions.join(" "), /短板|最应该核实|真实用户增长|独立训练大模型|录用结论/);
});
