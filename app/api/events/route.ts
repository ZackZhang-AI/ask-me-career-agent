import { NextRequest } from "next/server";
import { redactForLog } from "@/lib/guardrails";

const allowedEvents = new Set(["question_sent", "suggestion_clicked", "answer_completed", "source_opened", "chat_error"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!allowedEvents.has(body.event) || typeof body.sessionId !== "string") return new Response(null, { status: 204 });
    console.info("ask-me-event", { event: body.event, sessionId: body.sessionId.slice(0, 40), detail: redactForLog(String(body.detail ?? "")), at: new Date().toISOString() });
  } catch { /* Analytics must never block the product flow. */ }
  return new Response(null, { status: 204 });
}
