import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { obsidianApprovedKnowledgeSchema } from "../lib/content.ts";
import { assertObsidianApprovalGate, syncObsidianVault } from "../lib/obsidian/sync.ts";
import type { ObsidianSyncConfig } from "../lib/obsidian/types.ts";

const sourcePath = "02-知识库/项目/测试项目.md";

const config: ObsidianSyncConfig = {
  version: 1,
  includeFiles: [sourcePath],
  excludePathPrefixes: [".git", ".obsidian", "01-原始资料", "90-系统"],
  excludePathContains: ["百度"],
  restrictedTerms: ["百度", "Baidu"],
  maxFileBytes: 128_000,
  maxCandidateChars: 300,
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-me-obsidian-"));
  const vault = path.join(root, "vault");
  const output = path.join(root, "output", "review.json");
  const approvals = path.join(root, "approvals.json");
  const source = path.join(vault, ...sourcePath.split("/"));
  await mkdir(path.dirname(source), { recursive: true });
  await mkdir(path.join(vault, "01-原始资料"), { recursive: true });
  const markdown = `---
type: project
status: growing
updated: 2026-07-16
confidence: medium
sources: ["[[公开项目仓库]]"]
aliases: [测试项目]
---
# 测试项目

## 已确认事实

- 该项目使用结构化评测记录失败案例，内容只用于同步测试。

## 待验证问题

- 当前没有资料证明该项目准确率提升 25%。

## 安全记录

- 这条测试数据不包含敏感信息，可进入人工审核。
`;
  await writeFile(source, markdown, "utf8");
  await writeFile(path.join(vault, "01-原始资料", "不得读取.md"), "# 原始内容\n\n不得进入同步结果。", "utf8");
  await writeFile(approvals, "[]\n", "utf8");
  return { root, vault, output, approvals, source };
}

test("Obsidian 同步只读取精确白名单并脱离本机绝对路径", async () => {
  const files = await fixture();
  try {
    const manifest = await syncObsidianVault({
      vaultPath: files.vault,
      outputPath: files.output,
      approvalsPath: files.approvals,
      config,
      now: new Date("2026-07-16T00:00:00.000Z"),
    });
    assert.equal(manifest.stats.scannedDocuments, 1);
    assert.deepEqual(manifest.documents.map((item) => item.sourcePath), [sourcePath]);
    assert.equal(manifest.candidates.some((item) => item.evidenceKind === "confirmed_fact" && item.publicationStatus === "review_required"), true);
    assert.equal(manifest.candidates.some((item) => item.risks.includes("quantitative_claim")), true);
    const serialized = await readFile(files.output, "utf8");
    assert.equal(serialized.includes(files.root), false);
    assert.equal(serialized.includes("不得读取"), false);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("Obsidian 同步在分块前扫描全文，并清除阻断项的敏感元数据", async () => {
  const files = await fixture();
  const secret = ["sk", "example-only-value-1234567890"].join("-");
  try {
    const markdown = `---
type: project
status: growing
updated: 2026-07-16
confidence: medium
sources: ["${secret}"]
aliases: ["机密别名"]
---
# ${secret}

## 已确认事实

- 这是一段长度足够的普通正文，用来验证标题和来源中的敏感信息也会阻断整份文档。
`;
    await writeFile(files.source, markdown, "utf8");
    const manifest = await syncObsidianVault({ vaultPath: files.vault, outputPath: files.output, approvalsPath: files.approvals, config });
    assert.equal(manifest.stats.blocked > 0, true);
    assert.equal(manifest.candidates.every((item) => item.publicationStatus === "blocked"), true);
    assert.equal(manifest.candidates.every((item) => item.documentTitle === "[已阻断标题]" && item.sources.length === 0 && item.aliases.length === 0), true);
    const serialized = await readFile(files.output, "utf8");
    assert.equal(serialized.includes(secret), false);
    assert.equal(serialized.includes("机密别名"), false);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("Obsidian 同步拒绝路径穿越、无效分块配置和写回 Vault", async () => {
  const files = await fixture();
  try {
    await assert.rejects(() => syncObsidianVault({
      vaultPath: files.vault,
      outputPath: files.output,
      config: { ...config, includeFiles: ["../outside.md"] },
    }));
    await assert.rejects(() => syncObsidianVault({
      vaultPath: files.vault,
      outputPath: files.output,
      config: { ...config, maxCandidateChars: 0 },
    }));
    await assert.rejects(() => syncObsidianVault({
      vaultPath: files.vault,
      outputPath: path.join(files.vault, "review.json"),
      config,
    }), /不得写入 Obsidian Vault/);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("Obsidian 发布门禁拒绝阻断、重复和孤立批准", async () => {
  const files = await fixture();
  try {
    await writeFile(files.source, `---
type: project
status: growing
updated: 2026-07-16
confidence: medium
sources: ["[[公开项目仓库]]"]
---
# 测试项目

## Codex 推断

- 这是一条不得直接公开的模型推断，必须经过证据转换和人工确认。
`, "utf8");
    const first = await syncObsidianVault({ vaultPath: files.vault, outputPath: files.output, approvalsPath: files.approvals, config });
    const blocked = first.candidates[0];
    assert.ok(blocked);
    const approval = { provenance: { candidateId: blocked.id, sourceSha256: blocked.sourceSha256 } };
    await writeFile(files.approvals, `${JSON.stringify([
      approval,
      approval,
      { provenance: { candidateId: "obs_ffffffffffffffff", sourceSha256: "a".repeat(64) } },
    ])}\n`, "utf8");
    const manifest = await syncObsidianVault({ vaultPath: files.vault, outputPath: files.output, approvalsPath: files.approvals, config });
    assert.equal(manifest.stats.blockedApprovals, 1);
    assert.equal(manifest.stats.duplicateApprovals, 1);
    assert.equal(manifest.stats.orphanApprovals, 1);
    assert.throws(() => assertObsidianApprovalGate(manifest), /发布门禁未通过/);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("缺少必要 frontmatter 的知识文档必须阻断", async () => {
  const files = await fixture();
  try {
    await writeFile(files.source, "# 测试项目\n\n## 已确认事实\n\n- 缺少元数据的内容不能进入人工批准流程。\n", "utf8");
    const manifest = await syncObsidianVault({ vaultPath: files.vault, outputPath: files.output, approvalsPath: files.approvals, config });
    assert.equal(manifest.candidates.every((item) => item.risks.includes("invalid_metadata") && item.publicationStatus === "blocked"), true);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("Obsidian 同步识别未变更、已变更与过期批准", async () => {
  const files = await fixture();
  try {
    const first = await syncObsidianVault({ vaultPath: files.vault, outputPath: files.output, approvalsPath: files.approvals, config });
    const candidate = first.candidates.find((item) => item.publicationStatus === "review_required");
    assert.ok(candidate);
    await writeFile(files.approvals, `${JSON.stringify([{
      provenance: {
        candidateId: candidate.id,
        sourceSha256: candidate.sourceSha256,
      },
    }])}\n`, "utf8");
    const unchanged = await syncObsidianVault({
      vaultPath: files.vault,
      outputPath: files.output,
      previousManifestPath: files.output,
      approvalsPath: files.approvals,
      config,
    });
    assert.equal(unchanged.stats.unchangedDocuments, 1);
    assert.equal(unchanged.stats.approvedCurrent, 1);

    await writeFile(files.source, `${await readFile(files.source, "utf8")}\n## 新证据\n\n- 新增内容必须触发文档版本变更。\n`, "utf8");
    const changed = await syncObsidianVault({
      vaultPath: files.vault,
      outputPath: files.output,
      previousManifestPath: files.output,
      approvalsPath: files.approvals,
      config,
    });
    assert.equal(changed.stats.changedDocuments, 1);
    assert.equal(changed.stats.approvedStale, 1);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("Obsidian 公开快照不得保留 Vault 路径，且必须有完整审核溯源", () => {
  const result = obsidianApprovedKnowledgeSchema.safeParse([{
    id: "K100",
    title: "非法快照",
    content: "不应允许绝对路径进入公开内容。",
    keywords: ["测试"],
    visibility: "public",
    status: "active",
    verification: "self_attested",
    lastUpdated: "2026-07-16",
    supportsClaimIds: ["C3"],
    candidateContribution: "本人确认。",
    aiAssistance: "无。",
    limitations: "仅用于测试。",
    claimIds: ["C3"],
    sourceIds: ["S3"],
    provenance: {
      provider: "obsidian",
      candidateId: "obs_0123456789abcdef",
      sourcePath: "C:\\private\\note.md",
      sourceSha256: "a".repeat(64),
      section: "已确认事实",
      reviewedAt: "2026-07-16",
    },
  }]);
  assert.equal(result.success, false);
});

test("Obsidian 公开快照不得重复批准同一候选项", () => {
  const item = {
    id: "K100",
    title: "测试快照",
    content: "这是一条经过人工审核的测试内容。",
    keywords: ["测试"],
    visibility: "public",
    status: "active",
    verification: "self_attested",
    lastUpdated: "2026-07-16",
    supportsClaimIds: ["C3"],
    candidateContribution: "本人确认。",
    aiAssistance: "无。",
    limitations: "仅用于测试。",
    claimIds: ["C3"],
    sourceIds: ["S3"],
    provenance: {
      provider: "obsidian",
      candidateId: "obs_0123456789abcdef",
      sourceSha256: "a".repeat(64),
      section: "已确认事实",
      reviewedAt: "2026-07-16",
    },
  } as const;
  const result = obsidianApprovedKnowledgeSchema.safeParse([item, { ...item, id: "K101" }]);
  assert.equal(result.success, false);
});
