import assert from "node:assert/strict";
import test from "node:test";
import { candidateNarrative } from "../content/narrative.ts";
import { answerSimilarity } from "../lib/answer-quality.ts";
import { contentCatalog, contentCatalogSchema } from "../lib/content.ts";
import { claims, faqs, knowledge, matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge, sources, stableAnswers, starStories } from "../lib/knowledge.ts";
import { featuredProjects } from "../lib/profile.ts";

test("首页项目卡片如实区分当前完成度", () => {
  assert.equal(featuredProjects.every((project) => !project.status.includes("已完成")), true);
  assert.match(featuredProjects[0].summary, /Dense Retrieval/);
  assert.match(featuredProjects[1].status, /MVP/);
  assert.match(featuredProjects[2].status, /持续迭代/);
});

test("内容目录通过 Zod 与引用完整性校验", () => {
  assert.doesNotThrow(() => contentCatalogSchema.parse(contentCatalog));
  const claimIds = new Set(claims.map((item) => item.id));
  const sourceIds = new Set(sources.map((item) => item.id));
  for (const item of [...knowledge, ...starStories, ...stableAnswers]) {
    assert.equal(item.claimIds.every((id) => claimIds.has(id)), true, item.id);
    assert.equal(item.sourceIds.every((id) => sourceIds.has(id)), true, item.id);
  }
});

test("公开 Claim 和稳定回答不得引用已私有化证据", () => {
  const privateSourceCatalog = structuredClone(contentCatalog);
  const source = privateSourceCatalog.sources.find((item) => item.id === "S3");
  assert.ok(source);
  source.visibility = "private";
  source.public = false;
  assert.equal(contentCatalogSchema.safeParse(privateSourceCatalog).success, false);

  const privateClaimCatalog = structuredClone(contentCatalog);
  const claim = privateClaimCatalog.claims.find((item) => item.id === "C3");
  assert.ok(claim);
  claim.visibility = "private";
  assert.equal(contentCatalogSchema.safeParse(privateClaimCatalog).success, false);
});

test("达到上线内容最低数量且经历与项目可单独定位", () => {
  assert.equal(starStories.length >= 8, true);
  assert.equal(faqs.length >= 15, true);
  assert.equal(stableAnswers.length >= 20, true);
  assert.equal(knowledge.filter((item) => item.relatedProject && ["completed", "in_progress"].includes(item.projectStatus ?? "")).length >= 3, true);
  assert.equal(knowledge.filter((item) => item.claimIds.some((id) => ["C9", "C10", "C11"].includes(id))).length >= 3, true);
});

test("STAR 已确认公开且保持证据边界", () => {
  assert.equal(starStories.length, 8);
  assert.equal(starStories.every((item) => item.visibility === "public" && item.status === "active" && item.verification === "self_attested"), true);
  assert.equal(starStories.every((item) => item.limitations.length > 0 && item.claimIds.length > 0 && item.sourceIds.length > 0), true);
  const serialized = JSON.stringify(starStories);
  assert.equal(/\bsk-[A-Za-z0-9_-]{12,}\b/i.test(serialized), false);
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), false);
  assert.equal(/(?<!\d)1[3-9]\d{9}(?!\d)/.test(serialized), false);
});

test("Obsidian 审核通过的九条知识保留精确来源映射", () => {
  const approved = knowledge.filter((item) => /^K(?:1[3-9]|2[01])$/.test(item.id));
  assert.equal(approved.length, 9);
  assert.deepEqual(approved.map((item) => item.id), ["K13", "K14", "K15", "K16", "K17", "K18", "K19", "K20", "K21"]);
  assert.deepEqual(approved.map((item) => item.provenance?.candidateId), [
    "obs_eb2e2a404d29bbf2",
    "obs_e4e99c5f3491a3a0",
    "obs_0846a4cd8d4d3211",
    "obs_c85db12cace5e922",
    "obs_06a84085ecce723e",
    "obs_a94ccce57d3b1632",
    "obs_10214e20fec60266",
    "obs_14142e955e20379f",
    "obs_e9fe5247f697873a",
  ]);

  for (const item of approved) {
    assert.equal(item.visibility, "public");
    assert.equal(item.status, "active");
    assert.equal(item.verification, "self_attested");
    assert.equal(item.provenance?.provider, "obsidian");
    assert.equal(item.provenance?.reviewedAt, "2026-07-17");
    if (item.relatedProject === "rag-knowledge-base") {
      assert.deepEqual(item.claimIds, ["C3"]);
      assert.deepEqual(item.sourceIds, ["S3"]);
      assert.deepEqual(item.supportsClaimIds, ["C3"]);
      assert.equal(item.provenance?.sourceSha256, "e0d3d6f5342c5a0c444e0e15b62047d9c5d70845b1bcdcbca29d881b97e8975f");
    } else {
      assert.equal(item.relatedProject, "deepflow");
      assert.deepEqual(item.claimIds, ["C4"]);
      assert.deepEqual(item.sourceIds, ["S4"]);
      assert.deepEqual(item.supportsClaimIds, ["C4"]);
      assert.equal(item.provenance?.sourceSha256, "01d16fcb324fdfb078b130b6022d5b40e101233fd0ccd4bd4e12a577ddd9e34c");
    }
  }

  assert.equal(JSON.stringify(approved).includes("02-知识库/"), false);
});

test("核心问题稳定匹配标准答案和评测要求", () => {
  const matched = matchStableAnswer("哪个项目最能代表他的 AI 产品能力？");
  assert.equal(matched?.id, "A03");
  assert.match(matched?.standardAnswer ?? "", /RAG Knowledge Base System/);
  assert.deepEqual(matched?.requiredClaimIds, ["C3"]);
  assert.equal(matched?.requiredSourceIds.includes("S4"), false);
  assert.equal(matched?.requiredSourceIds.includes("S3"), true);
});

test("60 秒介绍提供招聘判断、核心证据与完整来源", () => {
  const matched = matchStableAnswer("60 秒了解张倬玮。");
  assert.equal(matched?.id, "A01");
  assert.equal((matched?.details?.length ?? 0) >= 4, true);
  assert.equal(matched?.requiredSourceIds.includes("S3"), true);
  assert.equal(matched?.requiredSourceIds.includes("S4"), true);
});

test("招聘方高频问题都有结构化证据", () => {
  const priorityIds = new Set(["A01", "A02", "A03", "A14", "A15"]);
  const priorityAnswers = stableAnswers.filter((answer) => priorityIds.has(answer.id));
  assert.equal(priorityAnswers.length, priorityIds.size);
  for (const answer of priorityAnswers) assert.equal((answer.details?.length ?? 0) >= 4, true, answer.id);
});

test("核心回答用克制的短词组突出招聘重点", () => {
  for (const answer of stableAnswers) {
    const emphasized = [...answer.standardAnswer.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1]);
    assert.equal(emphasized.length >= 1 && emphasized.length <= 3, true, answer.id);
    assert.equal(emphasized.every((text) => text.length <= 12 && !/[。！？；：]/.test(text)), true, answer.id);
  }
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

test("30、60、90 秒介绍独立成稿且时长层次清晰", () => {
  const introductions = candidateNarrative.introductions;
  assert.equal(introductions.seconds30.length >= 150 && introductions.seconds30.length < introductions.seconds60.length, true);
  assert.equal(introductions.seconds60.length >= 430 && introductions.seconds60.length <= 600, true);
  assert.equal(introductions.seconds90.length > introductions.seconds60.length, true);
  assert.equal(new Set(Object.values(introductions)).size, 3);
  for (const answer of Object.values(introductions)) assert.doesNotMatch(answer, /百度|Claim|Source|证据边界/);
});

test("核心问题拥有独立判断任务，不复用同一份回答", () => {
  assert.equal(stableAnswers.every((answer) => answer.evaluationGoal && answer.exclusivePoints.length && answer.followUpQuestions.length), true);
  const priority = ["A01", "A02", "A03", "A05", "A15"].map((id) => stableAnswers.find((answer) => answer.id === id)!);
  assert.equal(new Set(priority.map((answer) => answer.responseShape)).size >= 4, true);
  for (let left = 0; left < priority.length; left += 1) {
    for (let right = left + 1; right < priority.length; right += 1) {
      assert.equal(answerSimilarity(priority[left].standardAnswer, priority[right].standardAnswer) < 0.72, true, `${priority[left].id}/${priority[right].id}`);
    }
  }
});
