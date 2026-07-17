import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertObsidianApprovalGate, syncObsidianVault } from "../lib/obsidian/sync.ts";
import type { ObsidianSyncConfig } from "../lib/obsidian/types.ts";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const vaultPath = argument("--vault") ?? process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) throw new Error("缺少 Obsidian Vault 路径，请传入 --vault 或设置 OBSIDIAN_VAULT_PATH。");
  const configPath = path.resolve(argument("--config") ?? "config/obsidian-sync.json");
  const outputPath = path.resolve(argument("--output") ?? process.env.OBSIDIAN_SYNC_OUTPUT ?? "output/obsidian-review.json");
  const approvalsPath = path.resolve(argument("--approvals") ?? "content/obsidian-approved.json");
  const outputRoot = path.resolve("output");
  if (path.dirname(outputPath) !== outputRoot || path.extname(outputPath).toLowerCase() !== ".json") {
    throw new Error("同步报告只能写入当前仓库 output/ 根目录下的 JSON 文件。");
  }
  if ([configPath, approvalsPath].includes(outputPath)) throw new Error("同步报告不得覆盖配置或公开批准快照。");
  const config = JSON.parse(await readFile(configPath, "utf8")) as ObsidianSyncConfig;
  const manifest = await syncObsidianVault({
    vaultPath: path.resolve(vaultPath),
    outputPath,
    config,
    approvalsPath,
    previousManifestPath: outputPath,
  });
  console.info(`知识库同步完成：${manifest.stats.scannedDocuments} 份文档。`);
  console.info(`待审核 ${manifest.stats.reviewRequired} 条，阻断 ${manifest.stats.blocked} 条，已批准 ${manifest.stats.approvedCurrent} 条。`);
  console.info(`审核报告：${path.relative(process.cwd(), outputPath) || path.basename(outputPath)}`);
  assertObsidianApprovalGate(manifest);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Obsidian 知识库同步失败。");
  process.exitCode = 1;
});
