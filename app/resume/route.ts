import { NextRequest } from "next/server";
import { extractClientIp } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/analytics";
import { profile } from "@/lib/profile";

export const dynamic = "force-dynamic";

function resumeUnavailableHtml() {
  const subject = encodeURIComponent("索取张倬玮最新版简历");
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>最新版简历正在更新</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#f7f7f5;color:#20201f;display:grid;min-height:100vh;place-items:center}
.card{width:min(88vw,520px);padding:36px;border:1px solid #deded9;border-radius:20px;background:#fff;box-shadow:0 16px 50px #0000000d}
h1{font-size:28px;margin:0 0 12px}p{line-height:1.7;color:#666}a{display:inline-block;margin:16px 10px 0 0;padding:11px 16px;border-radius:10px;background:#20201f;color:#fff;text-decoration:none}.back{background:#ecece8;color:#20201f}
</style>
<main class="card">
  <h1>最新版简历正在更新</h1>
  <p>为避免展示过期信息，当前暂不提供旧版文件。你可以发送邮件索取最新版，或返回 Ask Me 继续查看公开项目与能力证据。</p>
  <a href="mailto:${profile.email}?subject=${subject}">发送邮件</a>
  <a class="back" href="/">返回 Ask Me</a>
</main>
</html>`;
}

export async function GET(request: NextRequest) {
  const resumeUrl = process.env.RESUME_BLOB_URL;
  if (!resumeUrl) return new Response(resumeUnavailableHtml(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

  let destination: URL;
  try {
    destination = new URL(resumeUrl);
    if (destination.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    return Response.json({ error: "resume_url_invalid", message: "简历地址配置无效。" }, { status: 500 });
  }

  const sessionId = request.cookies.get("ask-me-session")?.value || `resume:${extractClientIp(request)}`;
  recordEvent({ event: "resume_opened", sessionId, targetType: "resume", targetId: "latest" });
  return new Response(null, {
    status: 307,
    headers: { Location: destination.toString(), "Cache-Control": "private, no-store" },
  });
}
