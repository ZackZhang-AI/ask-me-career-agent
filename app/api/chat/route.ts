import { NextRequest } from "next/server";
import { buildAnswerPlan, buildContext, systemPrompt } from "@/lib/answer";
import { buildAnswerCitations } from "@/lib/answer-citations";
import { repairInstruction, validateAnswer } from "@/lib/answer-quality";
import { persistEvent } from "@/lib/analytics";
import { presetRevealChunks } from "@/lib/chat-session";
import { DeepSeekPlannerError, DeepSeekUpstreamError, generateDeepSeekAnswer, generateDeepSeekRepair, planDeepSeekQuestion, type ModelPath } from "@/lib/deepseek";
import { assessQuestion } from "@/lib/guardrails";
import { getClaims, getSources, matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge, serializeKnowledgeItems } from "@/lib/knowledge";
import { getFollowUpQuestions } from "@/lib/question-suggestions";
import { buildLocalQuestionFrame, findQuestionContract, mergePlannedFrame } from "@/lib/question-contracts";
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
  modelPath?: ModelPath | "local_fallback";
  degraded?: boolean;
  claims?: ReturnType<typeof getClaims>;
  followUpQuestions?: string[];
  diagnostic?: {
    sessionId: string;
    contractId?: string;
    topic?: string;
    facet?: string;
    answerPath: "generated" | "repaired" | "fallback" | "stable" | "demo" | "guardrail";
    rewriteCount?: number;
    retrievalCount?: number;
    qualityTriggerCount?: number;
    modelPath?: ModelPath | "local_fallback";
    degraded?: boolean;
  };
}) {
  const answer = input.answer.trim() || "这次回答没有完整生成。我可以继续根据已经公开的经历，从岗位匹配、项目实践或能力迁移的角度回答，请重新发送刚才的问题。";
  const citations = buildAnswerCitations(answer, input.claims ?? getClaims(input.claimIds));
  return new Response(new ReadableStream({ async start(controller) {
    controller.enqueue(line({
      type: "meta",
      mode: input.mode,
      responseStatus: input.responseStatus,
      claimIds: input.claimIds,
      sourceIds: input.sourceIds,
      citations,
      sources: input.sources,
      items: serializeKnowledgeItems(input.items),
      followUpQuestions: input.followUpQuestions ?? [],
      modelPath: input.modelPath ?? "local_fallback",
      degraded: input.degraded ?? false,
      ...(input.claims ? { claims: input.claims } : {}),
    }));
    for (const chunk of presetRevealChunks(answer)) {
      controller.enqueue(line({ type: "delta", content: chunk }));
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    await recordTokenUsage({ actualTokens: input.actualTokens ?? 0, tokenReservation: input.tokenReservation });
    const latencyMs = Date.now() - input.startedAt;
    controller.enqueue(line({ type: "done", responseStatus: input.responseStatus, latencyMs, modelPath: input.modelPath ?? "local_fallback", degraded: input.degraded ?? false }));
    controller.close();
    if (input.diagnostic) await persistEvent({
      event: "answer_generated",
      sessionId: input.diagnostic.sessionId,
      responseStatus: input.responseStatus,
      claimIds: input.claimIds,
      sourceIds: input.sourceIds,
      latencyMs,
      contractId: input.diagnostic.contractId,
      topic: input.diagnostic.topic,
      facet: input.diagnostic.facet,
      answerMode: input.mode,
      answerPath: input.diagnostic.answerPath,
      rewriteCount: input.diagnostic.rewriteCount,
      retrievalCount: input.diagnostic.retrievalCount,
      qualityTriggerCount: input.diagnostic.qualityTriggerCount,
      modelPath: input.diagnostic.modelPath,
      degraded: input.diagnostic.degraded,
    });
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
      diagnostic: { sessionId: body.sessionId, answerPath: "guardrail", retrievalCount: 0 },
    });
  }

  const history = body.messages.slice(0, -1).slice(-12);
  const gatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
  const contract = findQuestionContract(assessment.question);
  const localFrame = buildLocalQuestionFrame(assessment.question, history);
  let frame = localFrame;
  let plannerUsed = false;
  let plannerFallbackReason: string | undefined;
  let plannerTokens = 0;
  let plannerReservation = 0;
  let plannerModelPath: ModelPath | undefined;

  if (!contract && localFrame.questionMode !== "agent_meta" && gatewayConfigured) {
    const plannerBudget = await reserveAdditionalModelCall(1_200);
    if (!plannerBudget.ok) {
      plannerFallbackReason = "planner_budget_exhausted";
    } else {
      plannerReservation = plannerBudget.tokenReservation;
      const plannerController = new AbortController();
      const plannerTimeout = setTimeout(() => plannerController.abort(), 8_000);
      request.signal.addEventListener("abort", () => plannerController.abort(), { once: true });
      try {
        const planned = await planDeepSeekQuestion({
          question: assessment.question,
          history,
          signal: plannerController.signal,
          userId: body.sessionId,
        });
        frame = mergePlannedFrame(localFrame, planned.frame);
        plannerTokens = planned.totalTokens;
        plannerUsed = true;
        plannerModelPath = planned.modelPath;
      } catch (error) {
        plannerFallbackReason = error instanceof DeepSeekPlannerError
          ? error.reason
          : error instanceof DeepSeekUpstreamError
            ? `upstream_${error.status}`
            : error instanceof Error && error.name === "AbortError" ? "aborted" : "planner_failed";
      } finally {
        clearTimeout(plannerTimeout);
      }
    }
  }

  const items = retrieveKnowledge(assessment.question, { history, limit: 4, frame });
  const stableAnswer = matchStableAnswer(assessment.question, history, frame);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  const matchedSources = getSources(sourceIds);
  const plan = buildAnswerPlan(assessment.question, items, stableAnswer, history, frame, contract);
  const deliveryFallback = frame.topic === "unknown" && frame.answerIntent === "general"
    ? "回答服务暂时不可用，我没有找到与这个问题直接相关的公开资料。请点击重新生成，或换一种方式描述你想了解的面试问题。"
    : plan.fallbackAnswer;
  const retrievalTrace = resolveRetrievalQuery(assessment.question, history);
  const diagnosticBase = {
    sessionId: body.sessionId,
    contractId: plan.contractId,
    topic: plan.topic,
    facet: plan.facet,
    retrievalCount: items.length,
  };
  console.info("ask-me-retrieval", JSON.stringify({
    version: "question-frame-v1",
    contractId: contract?.id,
    topic: frame.topic,
    facet: frame.facet,
    answerIntent: frame.answerIntent,
    hasTargetRole: Boolean(frame.targetRole),
    plannerUsed,
    plannerModelPath,
    plannerFallbackReason,
    historyCount: history.length,
    contextApplied: retrievalTrace.contextApplied,
    matchedProjects: retrievalTrace.matchedProjects,
    itemIds: items.map((item) => item.id),
    stableAnswerId: stableAnswer?.id,
  }));

  if (!stableAnswer && !plan.answerableWithoutRetrievedEvidence && (!items.length || !claimIds.length || !sourceIds.length)) {
    return textStream({
      answer: deliveryFallback,
      mode: "demo",
      responseStatus: "insufficient_evidence",
      claimIds: [],
      sourceIds: [],
      sources: [],
      items: [],
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: rate.tokenReservation + plannerReservation,
      actualTokens: plannerTokens,
      modelPath: "local_fallback",
      degraded: false,
      diagnostic: { ...diagnosticBase, answerPath: "demo" },
    });
  }

  if (!gatewayConfigured) {
    return textStream({
      answer: deliveryFallback,
      mode: stableAnswer ? "stable" : "demo",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: rate.tokenReservation + plannerReservation,
      actualTokens: plannerTokens,
      modelPath: "local_fallback",
      degraded: !stableAnswer,
      diagnostic: { ...diagnosticBase, answerPath: stableAnswer ? "stable" : "demo" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const contextMessage = `以下是本轮回答计划和公开事实，只能据此回答：\n${buildContext(items, plan)}`;
  let totalTokens = plannerTokens;
  let totalReservation = rate.tokenReservation + plannerReservation;
  let firstTriggers: string[] = [];
  try {
    const first = await generateDeepSeekAnswer({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextMessage },
        ...recentModelMessages,
      ],
      signal: controller.signal,
      userId: body.sessionId,
    });
    totalTokens += first.totalTokens;
    const firstGate = validateAnswer(first.text, plan);
    firstTriggers = firstGate.triggers;

    let answer = first.text;
    let answerModelPath: ModelPath | "local_fallback" = first.modelPath;
    let path: "generated" | "repaired" | "fallback" = "generated";
    let rewriteCount = 0;
    let finalTriggers = firstGate.triggers;

    if (!firstGate.passed) {
      rewriteCount = 1;
      const retryBudget = await reserveAdditionalModelCall(estimatedTokens);
      if (!retryBudget.ok) {
        answer = deliveryFallback;
        path = "fallback";
        answerModelPath = "local_fallback";
        finalTriggers = [...firstGate.triggers, "repair_budget_exhausted"];
      } else {
        totalReservation += retryBudget.tokenReservation;
        const repaired = await generateDeepSeekRepair({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: contextMessage },
            { role: "system", content: repairInstruction(plan, firstGate.triggers) },
            ...recentModelMessages,
          ],
          signal: controller.signal,
          userId: body.sessionId,
        });
        totalTokens += repaired.totalTokens;
        const repairedGate = validateAnswer(repaired.text, plan);
        finalTriggers = repairedGate.triggers;
        if (repairedGate.passed) {
          answer = repaired.text;
          path = "repaired";
          answerModelPath = repaired.modelPath;
        } else {
          answer = deliveryFallback;
          path = "fallback";
          answerModelPath = "local_fallback";
        }
      }
    }

    clearTimeout(timeout);
    console.info("ask-me-quality", JSON.stringify({
      contractId: plan.contractId,
      topic: plan.topic,
      facet: plan.facet,
      answerIntent: plan.intent,
      hasTargetRole: Boolean(plan.targetRole),
      plannerUsed,
      plannerModelPath,
      modelPath: answerModelPath,
      retrievalItemIds: items.map((item) => item.id),
      answerPath: path,
      rewriteCount,
      relevanceTriggers: [...new Set([...firstTriggers, ...finalTriggers])],
      plannerFallbackReason,
    }));
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
      modelPath: answerModelPath,
      degraded: answerModelPath === "local_fallback",
      diagnostic: {
        ...diagnosticBase,
        answerPath: path,
        rewriteCount,
        qualityTriggerCount: [...new Set([...firstTriggers, ...finalTriggers])].length,
        modelPath: answerModelPath,
        degraded: answerModelPath === "local_fallback",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    console.warn("ask-me-answer-fallback", JSON.stringify({
      answerIntent: plan.intent,
      topic: plan.topic,
      hasTargetRole: Boolean(plan.targetRole),
      plannerModelPath,
      modelPath: "local_fallback",
      reason: error instanceof DeepSeekUpstreamError ? `upstream_${error.status}` : error instanceof Error ? error.name : "unknown",
    }));
    return textStream({
      answer: deliveryFallback,
      mode: stableAnswer ? "stable" : "demo",
      responseStatus: items.length || plan.answerableWithoutRetrievedEvidence ? "completed" : "insufficient_evidence",
      claimIds,
      sourceIds,
      sources: matchedSources,
      items,
      followUpQuestions: plan.followUpQuestions,
      startedAt,
      tokenReservation: totalReservation,
      actualTokens: totalTokens,
      modelPath: "local_fallback",
      degraded: !stableAnswer,
      diagnostic: { ...diagnosticBase, answerPath: "fallback", qualityTriggerCount: firstTriggers.length, modelPath: "local_fallback", degraded: !stableAnswer },
    });
  } finally {
    clearTimeout(timeout);
  }
}
