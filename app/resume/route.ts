import { NextRequest } from "next/server";
import { extractClientIp } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resumeUrl = process.env.RESUME_BLOB_URL;
  if (!resumeUrl) return Response.json({ error: "resume_not_configured", message: "最新版简历尚未配置，请通过邮箱联系候选人。" }, { status: 404 });

  let destination: URL;
  try {
    destination = new URL(resumeUrl);
    if (destination.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    return Response.json({ error: "resume_url_invalid", message: "简历地址配置无效。" }, { status: 500 });
  }

  const sessionId = request.cookies.get("ask-me-session")?.value || `resume:${extractClientIp(request)}`;
  recordEvent({ event: "resume_opened", sessionId, targetType: "resume", targetId: "latest" });
  const response = Response.redirect(destination, 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
