import { after, NextRequest } from "next/server";
import { persistEvent } from "@/lib/analytics";

const MAX_EVENT_BYTES = 16_384;

export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_EVENT_BYTES) return new Response(null, { status: 413 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES) return new Response(null, { status: 413 });
    const body: unknown = JSON.parse(raw);
    after(() => persistEvent(body));
  } catch { /* Analytics must never block the product flow. */ }
  return new Response(null, { status: 204 });
}
