import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

async function main() {
  const source = process.argv[2];
  const token = process.env.RESUME_READ_WRITE_TOKEN ?? process.env.RESUME_BLOB_READ_WRITE_TOKEN;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const storeId = process.env.RESUME_STORE_ID;
  if (!source) throw new Error("用法：npm run upload:resume -- <简历.pdf>");
  if (!token && (!oidcToken || !storeId)) throw new Error("缺少 Blob Token，或 OIDC 与 RESUME_STORE_ID，请先同步 Vercel 环境变量。");

  const file = await readFile(resolve(source));
  if (file.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("只允许上传有效的 PDF 简历。");
  const { put } = await import("@vercel/blob");
  // 内容寻址保留旧版本；预览更新不能覆盖生产环境仍引用的文件。
  const version = createHash("sha256").update(file).digest("hex").slice(0, 16);
  const blob = await put(`resume/${version}.pdf`, file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/pdf",
    ...(token ? { token } : { oidcToken, storeId }),
  });
  console.info(`简历已上传：${blob.url}`);
  console.info("请将 RESUME_BLOB_URL 更新为以上地址；站内 /resume 链接无需变化。");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "简历上传失败");
  process.exitCode = 1;
});
