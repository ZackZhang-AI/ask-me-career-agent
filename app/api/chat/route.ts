import { NextRequest } from "next/server";
import { buildContext, demoAnswer, systemPrompt } from "@/lib/answer";
import { assessQuestion } from "@/lib/guardrails";
import { getSources, retrieveKnowledge } from "@/lib/knowledge";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const line = (payload: object) => encoder.encode(`${JSON.stringify(payload)}\n`);

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.every((message) =>
    message && typeof message === "object" &&
    ["user", "assistant"].includes((message as ChatMessage).role) &&
    typeof (message as ChatMessage).content === "string" &&
    (message as ChatMessage).content.length <= 2000
  );
}

export async function POST(request: NextRequest) {
  if (process.env.CHAT_DISABLED === "true") {
    return Response.json({ error: "问答服务暂时关闭，请稍后再试。" }, { status: 503 });
  }

  const rate = checkRateLimit(clientIp(request));
  if (!rate.ok) return Response.json({ error: rate.message }, { status: rate.status });

  let body: { sessionId?: string; messages?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "请求格式不正确。" }, { status: 400 }); }

  if (!body.sessionId || body.sessionId.length > 100 || !isMessages(body.messages)) {
    return Response.json({ error: "会话数据不正确。" }, { status: 400 });
  }
  if (body.messages.length > 39 || body.messages.filter((message) => message.role === "user").length > 20) {
    return Response.json({ error: "本次会话已达到 20 个问题上限。" }, { status: 429 });
  }

  const latest = [...body.messages].reverse().find((message) => message.role === "user");
  if (!latest) return Response.json({ error: "没有找到有效问题。" }, { status: 400 });
  const assessment = assessQuestion(latest.content);
  if (!assessment.allowed) {
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(line({ type: "meta", sources: [], mode: "guardrail" }));
      controller.enqueue(line({ type: "delta", content: assessment.reason }));
      controller.enqueue(line({ type: "done" }));
      controller.close();
    }}), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const items = retrieveKnowledge(assessment.question);
  const sourceIds = [...new Set(items.flatMap((item) => item.sourceIds))];
  const matchedSources = getSources(sourceIds);
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const answer = demoAnswer(assessment.question, items);
    return new Response(new ReadableStream({ async start(controller) {
      controller.enqueue(line({ type: "meta", sources: matchedSources, items, mode: "demo" }));
      for (let index = 0; index < answer.length; index += 10) {
        controller.enqueue(line({ type: "delta", content: answer.slice(index, index + 10) }));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(line({ type: "done" }));
      controller.close();
    }}), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });

  let upstream: Response;
  try {
    upstream = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: `可用公开知识：\n${buildContext(items) || "没有匹配的公开知识，必须拒答。"}` },
          ...body.messages.slice(-8),
        ],
        thinking: { type: "disabled" },
        stream: true,
        max_tokens: 1100,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error && error.name === "AbortError" ? "回答超时，请重试。" : "暂时无法连接问答服务，请稍后重试。";
    return Response.json({ error: message }, { status: 504 });
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    const errors: Record<number, string> = { 401: "模型服务配置无效。", 402: "模型服务余额不足。", 429: "模型服务繁忙，请稍后重试。", 503: "模型服务暂时过载。" };
    return Response.json({ error: errors[upstream.status] ?? "问答服务暂时不可用。" }, { status: upstream.status >= 500 ? 503 : 502 });
  }

  const stream = new ReadableStream({
    async start(output) {
      output.enqueue(line({ type: "meta", sources: matchedSources, items, mode: "live" }));
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const rows = buffer.split("\n");
          buffer = rows.pop() ?? "";
          for (const row of rows) {
            if (!row.startsWith("data:")) continue;
            const data = row.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const payload = JSON.parse(data);
              const content = payload.choices?.[0]?.delta?.content;
              if (content) output.enqueue(line({ type: "delta", content }));
            } catch { /* Ignore incomplete or non-JSON keep-alive frames. */ }
          }
        }
        output.enqueue(line({ type: "done" }));
      } catch {
        output.enqueue(line({ type: "error", message: "流式回答中断，请重试。" }));
      } finally {
        clearTimeout(timeout);
        output.close();
      }
    },
    cancel() { controller.abort(); clearTimeout(timeout); },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
