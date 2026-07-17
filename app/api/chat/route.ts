import { NextRequest } from "next/server";
import { buildContext, demoAnswer, systemPrompt } from "@/lib/answer";
import { assessQuestion } from "@/lib/guardrails";
import { getClaims, getSources, matchStableAnswer, retrieveKnowledge, serializeKnowledgeItems } from "@/lib/knowledge";
import { checkRequestLimits, extractClientIp, recordTokenUsage } from "@/lib/rate-limit";
import type { ChatMessage, ResponseStatus } from "@/lib/types";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const line = (payload: object) => encoder.encode(`${JSON.stringify(payload)}\n`);

function isMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.every((message) =>
    message && typeof message === "object" &&
    ["user", "assistant"].includes((message as ChatMessage).role) &&
    typeof (message as ChatMessage).content === "string" &&
    (message as ChatMessage).content.length <= 2000
  );
}

function errorResponse(code: ResponseStatus, message: string, status: number, retryAfterSeconds?: number) {
  const response = Response.json({ code, error: message }, { status });
  if (retryAfterSeconds) response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

function textStream(input: {
  answer: string;
  mode: "stable" | "demo" | "guardrail";
  responseStatus: ResponseStatus;
  claimIds: string[];
  sourceIds: string[];
  sources: ReturnType<typeof getSources>;
  items: ReturnType<typeof retrieveKnowledge>;
  startedAt: number;
  tokenReservation: number;
}) {
  return new Response(new ReadableStream({ async start(controller) {
    controller.enqueue(line({
      type: "meta",
      mode: input.mode,
      responseStatus: input.responseStatus,
      claimIds: input.claimIds,
      sourceIds: input.sourceIds,
      sources: input.sources,
      items: serializeKnowledgeItems(input.items),
    }));
    for (let index = 0; index < input.answer.length; index += 12) {
      controller.enqueue(line({ type: "delta", content: input.answer.slice(index, index + 12) }));
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
    await recordTokenUsage({ actualTokens: 0, tokenReservation: input.tokenReservation });
    controller.enqueue(line({ type: "done", responseStatus: input.responseStatus, latencyMs: Date.now() - input.startedAt }));
    controller.close();
  }}), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (process.env.CHAT_DISABLED === "true") {
    return errorResponse("upstream_error", "问答服务暂时关闭，公开资料和项目链接仍可查看。", 503);
  }

  let body: { sessionId?: string; messages?: unknown };
  try { body = await request.json(); }
  catch { return errorResponse("upstream_error", "请求格式不正确。", 400); }

  if (!body.sessionId || body.sessionId.length > 100 || !isMessages(body.messages)) {
    return errorResponse("upstream_error", "会话数据不正确。", 400);
  }
  if (body.messages.length > 39 || body.messages.filter((message) => message.role === "user").length > 20) {
    return errorResponse("rate_limited", "本次会话已达到 20 个问题上限。", 429);
  }

  const latest = [...body.messages].reverse().find((message) => message.role === "user");
  if (!latest) return errorResponse("upstream_error", "没有找到有效问题。", 400);

  const estimatedTokens = Math.min(4_000, Math.ceil(JSON.stringify(body.messages.slice(-8)).length / 3) + 1_100);
  const rate = await checkRequestLimits({ ip: extractClientIp(request), sessionId: body.sessionId, estimatedTokens });
  if (!rate.ok) return errorResponse(rate.code, rate.message, rate.code === "rate_limited" ? 429 : 503, rate.retryAfterSeconds);

  const assessment = assessQuestion(latest.content);
  if (!assessment.allowed) {
    return textStream({
      answer: assessment.reason,
      mode: "guardrail",
      responseStatus: "refused",
      claimIds: [],
      sourceIds: [],
      sources: [],
      items: [],
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  const history = body.messages.slice(0, -1).slice(-8);
  const items = retrieveKnowledge(assessment.question, { history, limit: 4 });
  const stableAnswer = matchStableAnswer(assessment.question, history);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  const matchedSources = getSources(sourceIds);

  if (stableAnswer) {
    return textStream({
      answer: demoAnswer(assessment.question, items, stableAnswer),
      mode: "stable",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  if (!items.length || !claimIds.length || !sourceIds.length) {
    return textStream({
      answer: demoAnswer(assessment.question, []),
      mode: "demo",
      responseStatus: "insufficient_evidence",
      claimIds: [],
      sourceIds: [],
      sources: [],
      items: [],
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return textStream({
      answer: demoAnswer(assessment.question, items),
      mode: "demo",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
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
          { role: "system", content: `以下是本轮检索到的公开证据，只能据此回答：\n${buildContext(items)}` },
          ...body.messages.slice(-8),
        ],
        thinking: { type: "disabled" },
        stream: true,
        max_tokens: 1_100,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    await recordTokenUsage({ actualTokens: 0, tokenReservation: rate.tokenReservation });
    const message = error instanceof Error && error.name === "AbortError" ? "回答超时，请重试。" : "暂时无法连接问答服务，请稍后重试。";
    return errorResponse("upstream_error", message, 504);
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    await recordTokenUsage({ actualTokens: 0, tokenReservation: rate.tokenReservation });
    const errors: Record<number, string> = { 401: "模型服务配置无效。", 402: "模型服务余额不足。", 429: "模型服务繁忙，请稍后重试。", 503: "模型服务暂时过载。" };
    return errorResponse(upstream.status === 402 ? "budget_exhausted" : "upstream_error", errors[upstream.status] ?? "问答服务暂时不可用。", upstream.status >= 500 ? 503 : 502);
  }

  const claims = getClaims(claimIds);
  const stream = new ReadableStream({
    async start(output) {
      output.enqueue(line({ type: "meta", sources: matchedSources, items: serializeKnowledgeItems(items), claims, mode: "live", responseStatus: "completed", claimIds, sourceIds }));
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let actualTokens = rate.tokenReservation;
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
              if (payload.usage?.total_tokens) actualTokens = Number(payload.usage.total_tokens);
            } catch { /* Ignore incomplete or keep-alive frames. */ }
          }
        }
        output.enqueue(line({ type: "done", responseStatus: "completed", latencyMs: Date.now() - startedAt }));
      } catch {
        output.enqueue(line({ type: "error", code: "upstream_error", message: "流式回答中断，请重试。" }));
      } finally {
        clearTimeout(timeout);
        await recordTokenUsage({ actualTokens, tokenReservation: rate.tokenReservation });
        output.close();
      }
    },
    cancel() { controller.abort(); clearTimeout(timeout); },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
