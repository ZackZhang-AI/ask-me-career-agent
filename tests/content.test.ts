import assert from "node:assert/strict";
import test from "node:test";
import { contentCatalog, contentCatalogSchema } from "../lib/content.ts";
import { claims, faqs, knowledge, matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge, sources, stableAnswers, starStories } from "../lib/knowledge.ts";

test("内容目录通过 Zod 与引用完整性校验", () => {
  assert.doesNotThrow(() => contentCatalogSchema.parse(contentCatalog));
  const claimIds = new Set(claims.map((item) => item.id));
  const sourceIds = new Set(sources.map((item) => item.id));
  for (const item of [...knowledge, ...starStories, ...stableAnswers]) {
    assert.equal(item.claimIds.every((id) => claimIds.has(id)), true, item.id);
    assert.equal(item.sourceIds.every((id) => sourceIds.has(id)), true, item.id);
  }
});

test("达到上线内容最低数量且经历与项目可单独定位", () => {
  assert.equal(starStories.length >= 8, true);
  assert.equal(faqs.length >= 15, true);
  assert.equal(stableAnswers.length >= 20, true);
  assert.equal(knowledge.filter((item) => item.relatedProject && item.projectStatus === "completed").length >= 3, true);
  assert.equal(knowledge.filter((item) => item.claimIds.some((id) => ["C9", "C10", "C11"].includes(id))).length >= 3, true);
});

test("STAR 草稿在确认前保持私有且不参与公开检索", () => {
  assert.equal(starStories.every((item) => item.visibility === "private" && item.status === "draft" && item.verification === "unverified"), true);
  const resultIds = new Set(retrieveKnowledge("德勤 IT 审计实习").map((item) => item.id));
  assert.equal([...resultIds].some((id) => id.startsWith("ST")), false);
});

test("核心问题稳定匹配标准答案和评测要求", () => {
  const matched = matchStableAnswer("哪个项目最能代表他的 AI 产品能力？");
  assert.equal(matched?.id, "A03");
  assert.match(matched?.standardAnswer ?? "", /RAG Knowledge Base System/);
  assert.deepEqual(matched?.requiredClaimIds, ["C3", "C4"]);
  assert.equal(matched?.requiredSourceIds.includes("S3"), true);
});

test("项目别名和最近上下文可解析多轮指代", () => {
  const explicit = resolveRetrievalQuery("DeepFlow 有什么限制？");
  assert.equal(explicit.matchedProjects.includes("deepflow"), true);
  const result = retrieveKnowledge("这个项目有什么限制？", {
    history: [{ role: "assistant", content: "刚才介绍的是 DeepFlow 多 Agent 研究工作台。" }],
  });
  assert.equal(result[0]?.id, "K5");
});

test("检索只返回公开、有效且非未验证内容", () => {
  for (const item of retrieveKnowledge("项目 审计 技能 介绍", { limit: 8 })) {
    assert.equal(item.visibility, "public");
    assert.equal(item.status, "active");
    assert.notEqual(item.verification, "unverified");
    assert.notEqual(item.projectStatus, "archived");
  }
});

test("百度占位经历与联系方式不进入内容目录", () => {
  const serialized = JSON.stringify(contentCatalog);
  assert.equal(serialized.includes("2026.X"), false);
  assert.equal(serialized.includes("百度"), false);
  assert.equal(serialized.includes("zackzhang124@163.com"), false);
  assert.equal(serialized.includes("15812106204"), false);
});
