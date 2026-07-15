import { deleteExpiredEvents } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await deleteExpiredEvents(30);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("ask-me-analytics: retention cleanup failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, error: "cleanup_failed" }, { status: 500 });
  }
}
