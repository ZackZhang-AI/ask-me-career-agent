import { NextRequest } from "next/server";
import { buildAnswerCitations } from "@/lib/answer-citations";
import { persistEvent } from "@/lib/analytics";
import { buildChatDelivery, type ChatDelivery, type ChatStreamMetadata } from "@/lib/chat-pipeline";
import { assessQuestion } from "@/lib/guardrails";
import { getClaims, serializeKnowledgeItems } from "@/lib/knowledge";
import { getFollowUpQuestions } from "@/lib/question-suggestions";
import { checkRequestLimits, extractClientIp, recordTokenUsage } from "@/lib/rate-limit";
import { serviceUnavailableMessage } from "@/lib/answerability";
import type { ChatMessage, ProcessingStage, ResponseStatus } from "@/lib/types";
import { isFeedbackImprovementReason, type FeedbackImprovementReason } from "@/lib/feedback-improvement";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const line = (payload: object) => encoder.encode(`${JSON.stringify(payload)}\n`);

function isMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.every((message) =>
    message && typeof message === "object"
    && ["user", "assistant"].includes((message as ChatMessage).role)
    && typeof (message as ChatMessage).content === "string"
    && (message as ChatMessage).content.length <= 2000,
  );
}

function errorResponse(code: ResponseStatus, message: string, status: number, retryAfterSeconds?: number) {
  const response = Response.json({ code, error: message }, { status });
  if (retryAfterSeconds) response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

async function emitDelivery(
  controller: ReadableStreamDefaultController<Uint8Array>,
  delivery: ChatDelivery,
  input: { sessionId: string; startedAt: number; stageLatencies: Partial<Record<ProcessingStage, number>> },
) {
  const answer = delivery.answer.trim() || serviceUnavailableMessage();
  const citations = buildAnswerCitations(answer, delivery.claims ?? getClaims(delivery.claimIds));
  controller.enqueue(line({
    type: "meta",
    phase: delivery.streamed ? "final" : "initial",
    mode: delivery.mode,
    responseStatus: delivery.responseStatus,
    disposition: delivery.disposition,
    claimIds: delivery.claimIds,
    sourceIds: delivery.sourceIds,
    citations,
    sources: delivery.sources,
    items: serializeKnowledgeItems(delivery.items),
    followUpQuestions: delivery.followUpQuestions,
    modelPath: delivery.modelPath,
    degraded: delivery.degraded,
    deliveryMode: delivery.deliveryMode,
    ...(delivery.claims ? { claims: delivery.claims } : {}),
  }));
  if (!delivery.streamed) {
    controller.enqueue(line({ type: "delta", content: answer }));
  }
  await recordTokenUsage({ actualTokens: delivery.actualTokens, tokenReservation: delivery.tokenReservation });
  const latencyMs = Date.now() - input.startedAt;
  controller.enqueue(line({
    type: "done",
    responseStatus: delivery.responseStatus,
    disposition: delivery.disposition,
    latencyMs,
    modelPath: delivery.modelPath,
    degraded: delivery.degraded,
    deliveryMode: delivery.deliveryMode,
  }));
  controller.close();
  await persistEvent({
    event: "answer_generated",
    sessionId: input.sessionId,
    responseStatus: delivery.responseStatus,
    claimIds: delivery.claimIds,
    sourceIds: delivery.sourceIds,
    latencyMs,
    contractId: delivery.diagnostic.contractId,
    topic: delivery.diagnostic.topic,
    facet: delivery.diagnostic.facet,
    answerMode: delivery.mode,
    answerPath: delivery.diagnostic.answerPath,
    rewriteCount: delivery.diagnostic.rewriteCount,
    retrievalCount: delivery.diagnostic.retrievalCount,
    qualityTriggerCount: delivery.diagnostic.qualityTriggerCount,
    modelPath: delivery.diagnostic.modelPath,
    degraded: delivery.diagnostic.degraded,
    disposition: delivery.disposition,
    boundaryReason: delivery.diagnostic.boundaryReason,
    reviewPath: delivery.diagnostic.reviewPath,
    firstStageLatencyMs: input.stageLatencies.understanding,
    checkingEvidenceLatencyMs: input.stageLatencies.checking_evidence,
    reviewingAnswerLatencyMs: input.stageLatencies.reviewing_answer,
    firstTokenLatencyMs: delivery.diagnostic.firstChunkLatencyMs,
    deliveryMode: delivery.deliveryMode,
    questionFamily: delivery.diagnostic.questionFamily,
    factRisk: delivery.diagnostic.factRisk,
    answerStrategy: delivery.diagnostic.answerStrategy,
    semanticWarningCount: delivery.diagnostic.semanticWarningCount,
  });
}

function streamResponse(input: {
  sessionId: string;
  startedAt: number;
  task: (callbacks: {
    onStage: (stage: ProcessingStage) => void;
    onPrepared: (metadata: ChatStreamMetadata) => void;
    onDelta: (chunk: string) => void;
  }) => Promise<ChatDelivery>;
}) {
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const stageLatencies: Partial<Record<ProcessingStage, number>> = {};
      const onStage = (stage: ProcessingStage) => {
        if (stageLatencies[stage] !== undefined) return;
        const latencyMs = Date.now() - input.startedAt;
        stageLatencies[stage] = latencyMs;
        controller.enqueue(line({ type: "stage", stage, latencyMs }));
      };
      const onPrepared = (metadata: ChatStreamMetadata) => {
        controller.enqueue(line({ type: "meta", phase: "initial", ...metadata }));
      };
      const onDelta = (chunk: string) => {
        controller.enqueue(line({ type: "delta", content: chunk }));
      };
      onStage("understanding");
      try {
        const delivery = await input.task({ onStage, onPrepared, onDelta });
        console.info("ask-me-stage-latency", JSON.stringify({
          understandingMs: stageLatencies.understanding,
          checkingEvidenceMs: stageLatencies.checking_evidence,
          writingAnswerMs: stageLatencies.writing_answer,
          reviewingAnswerMs: stageLatencies.reviewing_answer,
        }));
        await emitDelivery(controller, delivery, { sessionId: input.sessionId, startedAt: input.startedAt, stageLatencies });
      } catch (error) {
        const failureType = error instanceof Error && error.name === "StreamInterruptedError"
          ? (error as Error & { failureType?: string }).failureType ?? "transport_interrupted"
          : error instanceof Error && error.name === "AbortError"
            ? "transport_interrupted"
            : "service_unavailable";
        if (error instanceof Error && error.name === "StreamInterruptedError") {
          console.warn("ask-me-stream-interrupted", JSON.stringify({
            stage: "writing_answer",
            discardPartial: true,
            retryable: true,
            failureType,
            visible: true,
            metric: "visible_answer_withdrawal",
            semanticWithdrawal: false,
            reason: error.message.slice(0, 120),
          }));
        }
        controller.enqueue(line({
          type: "error",
          message: error instanceof Error && error.name === "AbortError"
            ? "回答已停止。"
            : serviceUnavailableMessage(),
          retryable: true,
          discardPartial: true,
          failureType,
        }));
        controller.close();
      }
    },
  }), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (process.env.CHAT_DISABLED === "true") {
    return errorResponse("upstream_error", "问答服务暂时关闭，公开资料和项目链接仍可查看。", 503);
  }

  let body: { sessionId?: string; messages?: unknown; improvementReason?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("upstream_error", "请求格式不正确。", 400);
  }

  if (!body.sessionId || body.sessionId.length > 100 || !isMessages(body.messages)) {
    return errorResponse("upstream_error", "会话数据不正确。", 400);
  }
  const messages = body.messages;
  if (messages.length > 39 || messages.filter((message) => message.role === "user").length > 20) {
    return errorResponse("rate_limited", "本次会话已达到 20 个问题上限。", 429);
  }

  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest) return errorResponse("upstream_error", "没有找到有效问题。", 400);

  const recentModelMessages = messages.slice(-10);
  const estimatedTokens = Math.min(7_000, Math.ceil(JSON.stringify(recentModelMessages).length / 3) + 3_000);
  const rate = await checkRequestLimits({ ip: extractClientIp(request), sessionId: body.sessionId, estimatedTokens });
  if (!rate.ok) return errorResponse(rate.code, rate.message, rate.code === "rate_limited" ? 429 : 503, rate.retryAfterSeconds);

  const assessment = assessQuestion(latest.content);
  if (!assessment.allowed) {
    return streamResponse({
      sessionId: body.sessionId,
      startedAt,
      task: async () => ({
        answer: assessment.reason,
        mode: "guardrail",
        responseStatus: "refused",
        disposition: "decline",
        boundaryReason: "unsafe_request",
        claimIds: [],
        sourceIds: [],
        sources: [],
        items: [],
        followUpQuestions: getFollowUpQuestions(
          latest.content,
          messages.filter((message) => message.role === "user").map((message) => message.content),
        ),
        tokenReservation: rate.tokenReservation,
        actualTokens: 0,
        modelPath: "local_fallback",
        degraded: false,
        diagnostic: {
          topic: "unknown",
          facet: "boundary",
          answerPath: "guardrail",
          rewriteCount: 0,
          retrievalCount: 0,
          qualityTriggerCount: 0,
          modelPath: "local_fallback",
          degraded: false,
          boundaryReason: "unsafe_request",
          reviewPath: "none",
          plannerUsed: false,
          deliveryMode: "local_reveal",
          questionFamily: "unrelated",
          factRisk: "unsupported_personal",
          answerStrategy: "decline",
        },
        deliveryMode: "local_reveal",
        streamed: false,
      }),
    });
  }

  const modelConfigured = Boolean(process.env.DEEPSEEK_API_KEY);
  const improvementReason: FeedbackImprovementReason | undefined = isFeedbackImprovementReason(body.improvementReason) ? body.improvementReason : undefined;
  return streamResponse({
    sessionId: body.sessionId,
    startedAt,
    task: ({ onStage, onPrepared, onDelta }) => buildChatDelivery({
      question: assessment.question,
      messages,
      sessionId: body.sessionId!,
      signal: request.signal,
      modelConfigured,
      estimatedTokens,
      initialTokenReservation: rate.tokenReservation,
      onStage,
      onPrepared,
      onDelta,
      startedAt,
      improvementReason,
    }),
  });
}
