import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assessCandidate, scanSensitiveText, shouldExcludePath } from "./policy.ts";
import { classifyEvidence, parseObsidianDocument, sha256 } from "./parser.ts";
import type { ObsidianCandidate, ObsidianSyncConfig, ObsidianSyncManifest } from "./types.ts";

const relativeMarkdownPath = z.string().min(1).refine((value) => {
  if (path.isAbsolute(value) || !value.toLowerCase().endsWith(".md")) return false;
  return !value.split(/[\\/]/).some((segment) => segment === "." || segment === "..");
}, "includeFiles 只能包含 Vault 内的相对 Markdown 路径");

const syncConfigSchema = z.object({
  version: z.literal(1),
  includeFiles: z.array(relativeMarkdownPath).min(1).max(50),
  excludePathPrefixes: z.array(z.string().min(1)),
  excludePathContains: z.array(z.string().min(1)),
  restrictedTerms: z.array(z.string().min(1)),
  maxFileBytes: z.number().int().positive().max(2_000_000),
  maxCandidateChars: z.number().int().min(100).max(5_000),
}).strict();

const approvedEntrySchema = z.object({
  provenance: z.object({
    candidateId: z.string().regex(/^obs_[a-f0-9]{16}$/),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).passthrough(),
}).passthrough();

const approvedEntriesSchema = z.array(approvedEntrySchema);
type ApprovedEntry = z.infer<typeof approvedEntrySchema>;

interface VaultFile {
  sourcePath: string;
  absolutePath: string;
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function listMarkdownFiles(root: string, config: ObsidianSyncConfig) {
  const vaultRealPath = await realpath(root);
  const results = new Map<string, VaultFile>();
  for (const includeFile of config.includeFiles) {
    const normalized = includeFile.replace(/\\/g, "/");
    if (shouldExcludePath(normalized, config)) throw new Error(`白名单路径被排除策略拒绝：${includeFile}`);

    const absolute = path.resolve(vaultRealPath, ...normalized.split("/"));
    if (!isInside(vaultRealPath, absolute)) throw new Error(`非法同步文件：${includeFile}`);
    let info;
    try {
      info = await stat(absolute);
    } catch {
      throw new Error(`白名单文件不存在：${includeFile}`);
    }
    if (!info.isFile()) throw new Error(`白名单项不是文件：${includeFile}`);

    const resolved = await realpath(absolute);
    if (!isInside(vaultRealPath, resolved)) throw new Error(`同步文件越界：${includeFile}`);
    const canonicalPath = path.relative(vaultRealPath, resolved).split(path.sep).join("/");
    if (canonicalPath.toLowerCase() !== normalized.toLowerCase()) {
      throw new Error(`白名单文件不得通过符号链接或目录联接跳转：${includeFile}`);
    }
    if (shouldExcludePath(canonicalPath, config)) throw new Error(`规范化路径被排除策略拒绝：${includeFile}`);
    results.set(canonicalPath.toLowerCase(), { sourcePath: canonicalPath, absolutePath: resolved });
  }
  return { vaultRealPath, files: [...results.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath, "zh-CN")) };
}

function splitContent(content: string, maxChars: number) {
  if (content.length <= maxChars) return [content];
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of content.split(/\n\s*\n/)) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current.trim());
      current = "";
    }
    if (paragraph.length > maxChars) {
      for (let index = 0; index < paragraph.length; index += maxChars) chunks.push(paragraph.slice(index, index + maxChars).trim());
    } else {
      current += `${current ? "\n\n" : ""}${paragraph}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((chunk) => chunk.length >= 20);
}

async function readJson<T>(file: string | undefined, fallback: T): Promise<T> {
  if (!file) return fallback;
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomically(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

function blockedPath(sourcePath: string) {
  return `blocked/${sha256(sourcePath).slice(0, 16)}.md`;
}

export async function syncObsidianVault(input: {
  vaultPath: string;
  outputPath: string;
  config: ObsidianSyncConfig;
  approvalsPath?: string;
  previousManifestPath?: string;
  now?: Date;
}) {
  const config = syncConfigSchema.parse(input.config);
  const { vaultRealPath, files } = await listMarkdownFiles(input.vaultPath, config);
  const resolvedOutput = path.resolve(input.outputPath);
  if (input.approvalsPath && resolvedOutput === path.resolve(input.approvalsPath)) throw new Error("同步报告不得覆盖公开批准快照。");
  if (resolvedOutput === vaultRealPath || isInside(vaultRealPath, resolvedOutput)) throw new Error("同步报告不得写入 Obsidian Vault。");

  const approvals = approvedEntriesSchema.parse(await readJson<ApprovedEntry[]>(input.approvalsPath, []));
  const approvalCounts = new Map<string, number>();
  const approvalsByCandidate = new Map<string, ApprovedEntry>();
  for (const approval of approvals) {
    const candidateId = approval.provenance.candidateId;
    approvalCounts.set(candidateId, (approvalCounts.get(candidateId) ?? 0) + 1);
    if (!approvalsByCandidate.has(candidateId)) approvalsByCandidate.set(candidateId, approval);
  }
  const duplicateApprovals = [...approvalCounts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);

  const previous = await readJson<ObsidianSyncManifest | undefined>(input.previousManifestPath, undefined);
  const previousDocuments = new Map(previous?.documents.map((item) => [item.sourcePath, item.sourceSha256]) ?? []);
  const documents: ObsidianSyncManifest["documents"] = [];
  const candidates: ObsidianCandidate[] = [];

  for (const file of files) {
    const info = await stat(file.absolutePath);
    if (info.size > config.maxFileBytes) continue;
    const markdown = await readFile(file.absolutePath, "utf8");
    const document = parseObsidianDocument(file.sourcePath, markdown);
    const safeDocumentPath = scanSensitiveText(file.sourcePath, config).length ? blockedPath(file.sourcePath) : file.sourcePath;
    documents.push({ sourcePath: safeDocumentPath, sourceSha256: document.sourceSha256 });

    for (const section of document.sections) {
      const evidenceKind = classifyEvidence(section.heading);
      for (const [chunkIndex, content] of splitContent(section.content, config.maxCandidateChars).entries()) {
        const assessment = assessCandidate({ document, heading: section.heading, content, evidenceKind, config, documentText: markdown });
        const contentSha256 = sha256(content);
        const id = `obs_${sha256(`${file.sourcePath}\n${section.heading}\n${chunkIndex}\n${content}`).slice(0, 16)}`;
        const approval = approvalsByCandidate.get(id);
        const approvalState = !approval ? "not_approved" as const
          : assessment.publicationStatus === "blocked" ? "approved_blocked" as const
            : approval.provenance.sourceSha256 === document.sourceSha256 ? "approved_current" as const
              : "approved_stale" as const;
        const blocked = assessment.publicationStatus === "blocked";
        candidates.push({
          id,
          sourcePath: blocked ? blockedPath(file.sourcePath) : file.sourcePath,
          sourceSha256: document.sourceSha256,
          documentTitle: blocked ? "[已阻断标题]" : document.title,
          section: blocked ? "[已阻断章节]" : section.heading,
          evidenceKind,
          content: blocked ? "[内容因敏感或证据策略被阻断]" : content,
          contentSha256,
          sources: blocked ? [] : document.sources,
          aliases: blocked ? [] : document.aliases,
          risks: assessment.risks,
          publicationStatus: assessment.publicationStatus,
          approvalState,
        });
      }
    }
  }

  const currentCandidateIds = new Set(candidates.map((candidate) => candidate.id));
  const newDocuments = documents.filter((item) => !previousDocuments.has(item.sourcePath)).length;
  const changedDocuments = documents.filter((item) => previousDocuments.has(item.sourcePath) && previousDocuments.get(item.sourcePath) !== item.sourceSha256).length;
  const unchangedDocuments = documents.length - newDocuments - changedDocuments;
  const manifest: ObsidianSyncManifest = {
    schemaVersion: 1,
    generatedAt: (input.now ?? new Date()).toISOString(),
    policyVersion: config.version,
    documents,
    candidates,
    stats: {
      scannedDocuments: documents.length,
      newDocuments,
      changedDocuments,
      unchangedDocuments,
      reviewRequired: candidates.filter((item) => item.publicationStatus === "review_required").length,
      blocked: candidates.filter((item) => item.publicationStatus === "blocked").length,
      approvedCurrent: candidates.filter((item) => item.approvalState === "approved_current").length,
      approvedStale: candidates.filter((item) => item.approvalState === "approved_stale").length,
      blockedApprovals: candidates.filter((item) => item.approvalState === "approved_blocked").length,
      duplicateApprovals,
      orphanApprovals: approvals.filter((item) => !currentCandidateIds.has(item.provenance.candidateId)).length,
    },
  };
  await writeJsonAtomically(resolvedOutput, manifest);
  return manifest;
}

export function assertObsidianApprovalGate(manifest: ObsidianSyncManifest) {
  const failures = [
    manifest.stats.approvedStale ? `过期批准 ${manifest.stats.approvedStale} 条` : "",
    manifest.stats.blockedApprovals ? `已批准但被策略阻断 ${manifest.stats.blockedApprovals} 条` : "",
    manifest.stats.duplicateApprovals ? `重复批准 ${manifest.stats.duplicateApprovals} 条` : "",
    manifest.stats.orphanApprovals ? `无对应候选项的批准 ${manifest.stats.orphanApprovals} 条` : "",
  ].filter(Boolean);
  if (failures.length) throw new Error(`Obsidian 发布门禁未通过：${failures.join("；")}。请重新审核 content/obsidian-approved.json。`);
}
