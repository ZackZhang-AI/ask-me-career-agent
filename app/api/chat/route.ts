import { NextRequest } from "next/server";
import { buildAnswerPlan, buildContext, demoAnswer, systemPrompt } from "@/lib/answer";
import { repairInstruction, validateAnswer } from "@/lib/answer-quality";
import { DeepSeekUpstreamError, generateDeepSeekAnswer } from "@/lib/deepseek";
import { assessQuestion } from "@/lib/guardrails";
import { getClaims, getSources, matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge, serializeKnowledgeItems } from "@/lib/knowledge";
import { getFollowUpQuestions } from "@/lib/question-suggestions";
import { checkRequestLimits, extractClientIp, recordTokenUsage, reserveAdditionalModelCall } from "@/lib/rate-limit";
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
  mode: "stable" | "demo" | "guardrail" | "live";
  responseStatus: ResponseStatus;
  claimIds: string[];
  sourceIds: string[];
  sources: ReturnType<typeof getSources>;
  items: ReturnType<typeof retrieveKnowledge>;
  startedAt: number;
  tokenReservation: number;
  actualTokens?: number;
  claims?: ReturnType<typeof getClaims>;
  followUpQuestions?: string[];
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
      followUpQuestions: input.followUpQuestions ?? [],
      ...(input.claims ? { claims: input.claims } : {}),
    }));
    for (let index = 0; index < input.answer.length; index += 12) {
      controller.enqueue(line({ type: "delta", content: input.answer.slice(index, index + 12) }));
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
    await recordTokenUsage({ actualTokens: input.actualTokens ?? 0, tokenReservation: input.tokenReservation });
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

  const recentModelMessages = body.messages.slice(-10);
  const estimatedTokens = Math.min(7_000, Math.ceil(JSON.stringify(recentModelMessages).length / 3) + 3_000);
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
      followUpQuestions: getFollowUpQuestions(
        latest.content,
        body.messages.filter((message) => message.role === "user").map((message) => message.content),
      ),
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  const history = body.messages.slice(0, -1).slice(-12);
  const items = retrieveKnowledge(assessment.question, { history, limit: 4 });
  const stableAnswer = matchStableAnswer(assessment.question, history);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  const matchedSources = getSources(sourceIds);
  const plan = buildAnswerPlan(assessment.question, items, stableAnswer, history);
  const retrievalTrace = resolveRetrievalQuery(assessment.question, history);
  console.info("ask-me-retrieval", JSON.stringify({
    version: "context-v3",
    historyCount: history.length,
    contextApplied: retrievalTrace.contextApplied,
    matchedProjects: retrievalTrace.matchedProjects,
    itemIds: items.map((item) => item.id),
    stableAnswerId: stableAnswer?.id,
  }));

  if (!stableAnswer && !plan.answerableWithoutRetrievedEvidence && (!items.length || !claimIds.length || !sourceIds.length)) {
    return textStream({
      answer: demoAnswer(assessment.question, [], undefined, history),
      mode: "demo",
      responseStatus: "insufficient_evidence",
      claimIds: [],
      sourceIds: [],
      sources: [],
      items: [],
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return textStream({
      answer: demoAnswer(assessment.question, items, stableAnswer, history),
      mode: stableAnswer ? "stable" : "demo",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: rate.tokenReservation,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const contextMessage = `以下是本轮回答计划和公开事实，只能据此回答：\n${buildContext(items, plan)}`;
  let totalTokens = 0;
  let totalReservation = rate.tokenReservation;
  let firstTriggers: string[] = [];
  try {
    const first = await generateDeepSeekAnswer({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextMessage },
        ...recentModelMessages,
      ],
      signal: controller.signal,
    });
    totalTokens += first.totalTokens;
    const firstGate = validateAnswer(first.text, plan);
    firstTriggers = firstGate.triggers;

    let answer = first.text;
    let path: "generated" | "repaired" | "fallback" = "generated";
    let rewriteCount = 0;
    let finalTriggers = firstGate.triggers;

    if (!firstGate.passed) {
      rewriteCount = 1;
      const retryBudget = await reserveAdditionalModelCall(estimatedTokens);
      if (!retryBudget.ok) {
        answer = plan.fallbackAnswer;
        path = "fallback";
        finalTriggers = [...firstGate.triggers, "repair_budget_exhausted"];
      } else {
        totalReservation += retryBudget.tokenReservation;
        const repaired = await generateDeepSeekAnswer({
          apiKey,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: contextMessage },
            { role: "system", content: repairInstruction(plan, firstGate.triggers) },
            ...recentModelMessages,
          ],
          signal: controller.signal,
        });
        totalTokens += repaired.totalTokens;
        const repairedGate = validateAnswer(repaired.text, plan);
        finalTriggers = repairedGate.triggers;
        if (repairedGate.passed) {
          answer = repaired.text;
          path = "repaired";
        } else {
          answer = plan.fallbackAnswer;
          path = "fallback";
        }
      }
    }

    clearTimeout(timeout);
    console.info("ask-me-quality", JSON.stringify({ intent: plan.intent, depth: plan.conversationDepth, path, rewriteCount, initialTriggers: firstTriggers, finalTriggers }));
    return textStream({
      answer,
      mode: path === "fallback" ? (stableAnswer ? "stable" : "demo") : "live",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      claims: getClaims(claimIds),
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: totalReservation,
      actualTokens: totalTokens,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (stableAnswer || plan.answerableWithoutRetrievedEvidence) {
      return textStream({
        answer: plan.fallbackAnswer,
        mode: stableAnswer ? "stable" : "demo",
        responseStatus: "completed",
        claimIds,
        sourceIds,
        sources: matchedSources,
        items,
        followUpQuestions: plan.followUpQuestions,
        startedAt,
        tokenReservation: totalReservation,
        actualTokens: totalTokens,
      });
    }
    await recordTokenUsage({ actualTokens: totalTokens, tokenReservation: totalReservation });
    const status = error instanceof DeepSeekUpstreamError ? error.status : 504;
    const errors: Record<number, string> = { 401: "模型服务配置无效。", 402: "模型服务余额不足。", 429: "模型服务繁忙，请稍后重试。", 503: "模型服务暂时过载。" };
    const timeoutMessage = error instanceof Error && error.name === "AbortError" ? "回答超时，请重试。" : undefined;
    const message = timeoutMessage ?? errors[status] ?? "问答服务暂时不可用。";
    return errorResponse(status === 402 ? "budget_exhausted" : "upstream_error", message, status >= 500 ? (status === 504 ? 504 : 503) : 502);
  } finally {
    clearTimeout(timeout);
  }
}
