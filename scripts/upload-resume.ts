import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const source = process.argv[2];
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!source) throw new Error("用法：node --env-file=.env.local --experimental-strip-types scripts/upload-resume.ts <简历.pdf>");
  if (!token) throw new Error("缺少 BLOB_READ_WRITE_TOKEN，请先同步 Vercel 环境变量。");

  const file = await readFile(resolve(source));
  if (file.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("只允许上传有效的 PDF 简历。");
  const { put } = await import("@vercel/blob");
  const blob = await put("resume/latest.pdf", file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/pdf",
    token,
  });
  console.info(`简历已上传：${blob.url}`);
  console.info("请将 RESUME_BLOB_URL 更新为以上地址；站内 /resume 链接无需变化。");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "简历上传失败");
  process.exitCode = 1;
});
