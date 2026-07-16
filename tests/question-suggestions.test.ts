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

test("项目问题推荐贡献和证据追问", () => {
  const questions = getFollowUpQuestions("哪个项目最能代表他的 AI 产品能力？");
  assert.equal(inferQuestionCategory("哪个项目最能代表他的 AI 产品能力？"), "project");
  assert.match(questions.join(" "), /个人贡献/);
  assert.match(questions.join(" "), /AI 编程工具/);
});

test("动态追问不会重复已提问题", () => {
  const asked = ["他的主要短板是什么？", "面试中最应该核实什么？"];
  const questions = getFollowUpQuestions(asked[0], asked);
  for (const question of questions) assert.equal(asked.includes(question), false);
  assert.equal(questions.length, 3);
});
