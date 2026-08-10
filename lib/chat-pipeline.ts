import { buildAnswerPlan, buildContext, systemPrompt } from "./answer";
import { hasBlockingQualityTriggers, validateAnswer, validateAnswerFragment } from "./answer-quality";
import { decideAnswerability, serviceUnavailableMessage, unresolvedReferenceReason } from "./answerability";
import {
  DeepSeekPlannerError,
  DeepSeekUpstreamError,
  generateDeepSeekAnswer,
  planDeepSeekQuestion,
  reviewDeepSeekAnswer,
  streamDeepSeekAnswer,
  type ModelPath,
} from "./deepseek";
import { getClaims, getSources, matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge } from "./knowledge";
import { getFollowUpQuestions } from "./question-suggestions";
import { buildLocalQuestionFrame, findQuestionContract, mergePlannedFrame } from "./question-contracts";
import { reserveAdditionalModelCall } from "./rate-limit";
import { takeStreamUnits } from "./stream-answer";
import type {
  AnswerDisposition,
  AnswerPlan,
  BoundaryReason,
  ChatMessage,
  DeliveryMode,
  ProcessingStage,
  QuestionFrame,
  ResponseStatus,
  ReviewPath,
} from "./types";

export type AnswerMode = "stable" | "demo" | "guardrail" | "live" | "boundary";
export type AnswerPath = "generated" | "repaired" | "fallback" | "stable" | "demo" | "guardrail" | "boundary" | "service_unavailable";

export interface ChatStreamMetadata {
  mode: AnswerMode;
  disposition: AnswerDisposition;
  claimIds: string[];
  sourceIds: string[];
  sources: ReturnType<typeof getSources>;
  items: ReturnType<typeof retrieveKnowledge>;
  claims?: ReturnType<typeof getClaims>;
  followUpQuestions: string[];
  modelPath: ModelPath | "local_fallback";
  degraded: boolean;
  deliveryMode: DeliveryMode;
}

export interface ChatDelivery {
  answer: string;
  mode: AnswerMode;
  responseStatus: ResponseStatus;
  disposition: AnswerDisposition;
  boundaryReason: BoundaryReason;
  claimIds: string[];
  sourceIds: string[];
  sources: ReturnType<typeof getSources>;
  items: ReturnType<typeof retrieveKnowledge>;
  claims?: ReturnType<typeof getClaims>;
  followUpQuestions: string[];
  tokenReservation: number;
  actualTokens: number;
  modelPath: ModelPath | "local_fallback";
  degraded: boolean;
  deliveryMode: DeliveryMode;
  streamed: boolean;
  diagnostic: {
    contractId?: string;
    topic: string;
    facet: string;
    answerPath: AnswerPath;
    rewriteCount: number;
    retrievalCount: number;
    qualityTriggerCount: number;
    modelPath: ModelPath | "local_fallback";
    degraded: boolean;
    boundaryReason: BoundaryReason;
    reviewPath: ReviewPath;
    plannerUsed: boolean;
    plannerModelPath?: ModelPath;
    plannerFallbackReason?: string;
    deliveryMode?: DeliveryMode;
    firstChunkLatencyMs?: number;
    streamFailureStage?: string;
  };
}

interface PipelineInput {
  question: string;
  messages: ChatMessage[];
  sessionId: string;
  signal: AbortSignal;
  modelConfigured: boolean;
  estimatedTokens: number;
  initialTokenReservation: number;
  onStage: (stage: ProcessingStage) => void;
  onPrepared?: (metadata: ChatStreamMetadata) => void;
  onDelta?: (chunk: string) => Promise<void> | void;
  startedAt?: number;
}

function emptyDelivery(input: {
  message: string;
  disposition: AnswerDisposition;
  responseStatus: ResponseStatus;
  boundaryReason: BoundaryReason;
  followUpQuestions: string[];
  tokenReservation: number;
  actualTokens: number;
  diagnostic: ChatDelivery["diagnostic"];
  deliveryMode?: DeliveryMode;
}): ChatDelivery {
  return {
    answer: input.message,
    mode: "boundary",
    responseStatus: input.responseStatus,
    disposition: input.disposition,
    boundaryReason: input.boundaryReason,
    claimIds: [],
    sourceIds: [],
    sources: [],
    items: [],
    followUpQuestions: input.followUpQuestions,
    tokenReservation: input.tokenReservation,
    actualTokens: input.actualTokens,
    modelPath: "local_fallback",
    degraded: false,
    deliveryMode: input.deliveryMode ?? "local_reveal",
    streamed: false,
    diagnostic: input.diagnostic,
  };
}

class StreamInterruptedError extends Error {
  constructor(public readonly stage: "writing_answer" | "checking_evidence", message = "流式回答未完整生成") {
    super(message);
    this.name = "StreamInterruptedError";
  }
}

const reviewedIntents = new Set([
  "result",
  "contribution",
  "experience",
  "education",
  "credentials",
  "project_overview",
  "project_problem",
  "ai_collaboration",
]);

function chooseDeliveryMode(input: {
  frame: QuestionFrame;
  plan: AnswerPlan;
  decision: { shouldGenerate: boolean; disposition: AnswerDisposition };
  stableAnswer?: unknown;
  contract?: unknown;
  hasEvidence: boolean;
  canStream: boolean;
}) : DeliveryMode {
  if (input.stableAnswer || input.contract || input.frame.questionMode === "agent_meta" || !input.decision.shouldGenerate) return "local_reveal";
  if (!input.canStream || reviewedIntents.has(input.plan.intent)) return "reviewed_buffer";
  if (input.frame.evidencePolicy === "required" && !input.hasEvidence) return "reviewed_buffer";
  if (input.frame.questionMode === "candidate_reasoning") return "realtime_stream";
  if (["career_transition", "experience_value", "role_fit", "skills", "challenge", "diagnosis", "limitation", "hiring_recommendation"].includes(input.plan.intent)) return "realtime_stream";
  return "reviewed_buffer";
}

interface StreamAnswerInput {
  messages: Array<ChatMessage | { role: "system"; content: string }>;
  signal: AbortSignal;
  plan: AnswerPlan;
  userId: string;
  startedAt: number;
  onDelta: (chunk: string) => Promise<void> | void;
}

async function streamAnswer(input: StreamAnswerInput) {
  for (const modelPath of ["flash", "pro"] as const) {
    let visible = false;
    let answer = "";
    let pending = "";
    let held = "";
    let firstChunkLatencyMs: number | undefined;
    try {
      const generated = streamDeepSeekAnswer({ messages: input.messages, signal: input.signal, userId: input.userId }, modelPath);
      let streamFinished = false;
      for await (const part of generated.fullStream) {
        if (part.type === "error") {
          if (visible) throw new StreamInterruptedError("writing_answer", "stream_protocol_error");
          throw new Error("stream_protocol_error");
        }
        if (part.type === "finish") {
          streamFinished = true;
          continue;
        }
        if (part.type !== "text-delta") continue;
        const rawChunk = typeof part.text === "string" ? part.text : "";
        pending += rawChunk;
        const extracted = takeStreamUnits(pending);
        pending = extracted.rest;
        for (const unit of extracted.units) {
          if (!visible && !unit.sentenceComplete) {
            held += unit.text;
            continue;
          }
          const chunk = `${held}${unit.text}`;
          held = "";
          const candidate = `${answer}${chunk}`;
          const gate = validateAnswerFragment(candidate, input.plan, unit.sentenceComplete);
          if (!gate.passed) {
            if (visible) throw new StreamInterruptedError("writing_answer", gate.triggers.join("；"));
            throw new Error(`stream_quality:${gate.triggers.join(",")}`);
          }
          answer = candidate;
          if (!visible) {
            visible = true;
            firstChunkLatencyMs = Date.now() - input.startedAt;
          }
          await input.onDelta(chunk);
        }
      }
      if (!streamFinished) {
        if (visible) throw new StreamInterruptedError("writing_answer", "stream_incomplete");
        throw new Error("stream_incomplete");
      }

      const finalUnits = takeStreamUnits(`${held}${pending}`, true).units;
      for (const unit of finalUnits) {
        const candidate = `${answer}${unit.text}`;
        const gate = validateAnswerFragment(candidate, input.plan, true);
        if (!gate.passed) {
          if (visible) throw new StreamInterruptedError("writing_answer", gate.triggers.join("；"));
          throw new Error(`stream_quality:${gate.triggers.join(",")}`);
        }
        answer = candidate;
        if (!visible) {
          visible = true;
          firstChunkLatencyMs = Date.now() - input.startedAt;
        }
        await input.onDelta(unit.text);
      }
      if (!answer.trim()) throw new Error("stream_empty");
      const finalGate = validateAnswer(answer, input.plan);
      if (!finalGate.passed) {
        if (visible) throw new StreamInterruptedError("writing_answer", finalGate.triggers.join("；"));
        throw new Error(`stream_quality:${finalGate.triggers.join(",")}`);
      }
      const usage = await generated.usage;
      return {
        answer,
        totalTokens: Number(usage.totalTokens ?? 0),
        modelPath,
        firstChunkLatencyMs: firstChunkLatencyMs ?? Date.now() - input.startedAt,
      };
    } catch (error) {
      if (error instanceof StreamInterruptedError || (error instanceof Error && error.name === "AbortError")) throw error;
      if (visible || modelPath === "pro") throw error;
    }
  }
  throw new Error("stream_unavailable");
}

export async function buildChatDelivery(input: PipelineInput): Promise<ChatDelivery> {
  const history = input.messages.slice(0, -1).slice(-12);
  const recentModelMessages = input.messages.slice(-10);
  const contract = findQuestionContract(input.question);
  const localFrame = buildLocalQuestionFrame(input.question, history);
  const localStableAnswer = matchStableAnswer(input.question, history, localFrame);
  const hasUnresolvedReference = Boolean(unresolvedReferenceReason({ question: input.question, history, frame: localFrame, contract }));
  let frame = localFrame;
  let plannerUsed = false;
  let plannerFallbackReason: string | undefined;
  let plannerTokens = 0;
  let plannerReservation = 0;
  let plannerModelPath: ModelPath | undefined;

  if (!contract && !localStableAnswer && !hasUnresolvedReference && localFrame.confidence < 0.82 && localFrame.questionMode !== "agent_meta" && input.modelConfigured) {
    const plannerBudget = await reserveAdditionalModelCall(1_200);
    if (!plannerBudget.ok) {
      plannerFallbackReason = "planner_budget_exhausted";
    } else {
      plannerReservation = plannerBudget.tokenReservation;
      const plannerController = new AbortController();
      const plannerTimeout = setTimeout(() => plannerController.abort(), 8_000);
      input.signal.addEventListener("abort", () => plannerController.abort(), { once: true });
      try {
        const planned = await planDeepSeekQuestion({
          question: input.question,
          history,
          signal: plannerController.signal,
          userId: input.sessionId,
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

  input.onStage("checking_evidence");
  const items = retrieveKnowledge(input.question, { history, limit: 4, frame });
  const stableAnswer = localStableAnswer ?? matchStableAnswer(input.question, history, frame);
  const claimIds = stableAnswer ? [...stableAnswer.requiredClaimIds] : [...new Set(items.flatMap((item) => item.claimIds))];
  const sourceIds = stableAnswer ? [...stableAnswer.requiredSourceIds] : [...new Set(items.flatMap((item) => item.sourceIds))];
  const sources = getSources(sourceIds);
  const plan = buildAnswerPlan(input.question, items, stableAnswer, history, frame, contract);
  const followUpQuestions = plan.followUpQuestions.length
    ? plan.followUpQuestions
    : getFollowUpQuestions(input.question, input.messages.filter((message) => message.role === "user").map((message) => message.content));
  const hasEvidence = items.length > 0 && claimIds.length > 0 && sourceIds.length > 0;
  const decision = decideAnswerability({
    question: input.question,
    history,
    frame,
    plan,
    items,
    claimIds,
    sourceIds,
    stableAnswer,
    contract,
  });
  const retrievalTrace = resolveRetrievalQuery(input.question, history);
  const deliveryMode = chooseDeliveryMode({
    frame,
    plan,
    decision,
    stableAnswer,
    contract,
    hasEvidence,
    canStream: Boolean(input.onPrepared && input.onDelta),
  });
  const diagnosticBase = {
    contractId: plan.contractId,
    topic: plan.topic,
    facet: plan.facet,
    rewriteCount: 0,
    retrievalCount: items.length,
    qualityTriggerCount: 0,
    modelPath: "local_fallback" as const,
    degraded: false,
    boundaryReason: decision.boundaryReason,
    reviewPath: "none" as const,
    plannerUsed,
    plannerModelPath,
    plannerFallbackReason,
    deliveryMode,
  };

  console.info("ask-me-retrieval", JSON.stringify({
    version: "answerability-v2",
    contractId: contract?.id,
    topic: frame.topic,
    facet: frame.facet,
    answerIntent: frame.answerIntent,
    questionMode: frame.questionMode,
    evidencePolicy: frame.evidencePolicy,
    disposition: decision.disposition,
    boundaryReason: decision.boundaryReason,
    capabilityIds: decision.capabilityIds,
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

  const baseReservation = input.initialTokenReservation + plannerReservation;
  if (!decision.shouldGenerate && decision.disposition !== "answer") {
    return emptyDelivery({
      message: decision.message ?? "这个问题目前无法可靠回答。",
      disposition: decision.disposition,
      responseStatus: decision.responseStatus,
      boundaryReason: decision.boundaryReason,
      followUpQuestions,
      tokenReservation: baseReservation,
      actualTokens: plannerTokens,
      diagnostic: { ...diagnosticBase, answerPath: "boundary" },
    });
  }

  if (!decision.shouldGenerate) {
    const localGate = validateAnswer(plan.fallbackAnswer, plan);
    if (!localGate.passed) {
      return emptyDelivery({
        message: serviceUnavailableMessage(),
        disposition: "service_unavailable",
        responseStatus: "upstream_error",
        boundaryReason: "quality_review_failed",
        followUpQuestions,
        tokenReservation: baseReservation,
        actualTokens: plannerTokens,
        diagnostic: {
          ...diagnosticBase,
          answerPath: "service_unavailable",
          qualityTriggerCount: localGate.triggers.length,
          boundaryReason: "quality_review_failed",
        },
      });
    }
    return {
      answer: plan.fallbackAnswer,
      mode: stableAnswer || contract ? "stable" : "demo",
      responseStatus: "completed",
      disposition: "answer",
      boundaryReason: "none",
      claimIds,
      sourceIds,
      sources,
      items,
      claims: getClaims(claimIds),
      followUpQuestions,
      tokenReservation: baseReservation,
      actualTokens: plannerTokens,
      modelPath: "local_fallback",
      degraded: false,
      deliveryMode: "local_reveal",
      streamed: false,
      diagnostic: {
        ...diagnosticBase,
        answerPath: stableAnswer || contract ? "stable" : "demo",
        boundaryReason: "none",
      },
    };
  }

  if (!input.modelConfigured) {
    return emptyDelivery({
      message: serviceUnavailableMessage(),
      disposition: "service_unavailable",
      responseStatus: "upstream_error",
      boundaryReason: "upstream_unavailable",
      followUpQuestions,
      tokenReservation: baseReservation,
      actualTokens: plannerTokens,
      diagnostic: { ...diagnosticBase, answerPath: "service_unavailable", boundaryReason: "upstream_unavailable" },
    });
  }

  const contextMessage = `以下是本轮回答计划和公开事实，只能据此回答：\n${buildContext(items, plan)}`;
  if (deliveryMode === "realtime_stream") {
    input.onStage("writing_answer");
    input.onPrepared?.({
      mode: "live",
      disposition: decision.disposition,
      claimIds,
      sourceIds,
      sources,
      items,
      claims: getClaims(claimIds),
      followUpQuestions,
      modelPath: "flash",
      degraded: false,
      deliveryMode,
    });
    try {
      const streamed = await streamAnswer({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: contextMessage },
          ...recentModelMessages,
        ],
        signal: input.signal,
        plan,
        userId: input.sessionId,
        startedAt: input.startedAt ?? Date.now(),
        onDelta: input.onDelta!,
      });
      console.info("ask-me-stream", JSON.stringify({
        topic: plan.topic,
        answerIntent: plan.intent,
        deliveryMode,
        modelPath: streamed.modelPath,
        firstChunkLatencyMs: streamed.firstChunkLatencyMs,
        actualTokens: streamed.totalTokens,
      }));
      return {
        answer: streamed.answer,
        mode: "live",
        responseStatus: "completed",
        disposition: decision.disposition,
        boundaryReason: "none",
        claimIds,
        sourceIds,
        sources,
        items,
        claims: getClaims(claimIds),
        followUpQuestions,
        tokenReservation: baseReservation,
        actualTokens: streamed.totalTokens,
        modelPath: streamed.modelPath,
        degraded: false,
        deliveryMode,
        streamed: true,
        diagnostic: {
          ...diagnosticBase,
          answerPath: "generated",
          qualityTriggerCount: 0,
          modelPath: streamed.modelPath,
          deliveryMode,
          firstChunkLatencyMs: streamed.firstChunkLatencyMs,
        },
      };
    } catch (error) {
      if (error instanceof StreamInterruptedError || (error instanceof Error && error.name === "AbortError")) throw error;
      console.warn("ask-me-stream-unavailable", JSON.stringify({
        answerIntent: plan.intent,
        topic: plan.topic,
        deliveryMode,
        boundaryReason: "upstream_unavailable",
        reason: error instanceof DeepSeekUpstreamError ? `upstream_${error.status}` : error instanceof Error ? error.message.slice(0, 120) : "unknown",
      }));
      return emptyDelivery({
        message: serviceUnavailableMessage(),
        disposition: "service_unavailable",
        responseStatus: "upstream_error",
        boundaryReason: "upstream_unavailable",
        followUpQuestions,
        tokenReservation: baseReservation,
        actualTokens: 0,
        deliveryMode: "local_reveal",
        diagnostic: { ...diagnosticBase, answerPath: "service_unavailable", boundaryReason: "upstream_unavailable", deliveryMode: "local_reveal" },
      });
    }
  }

  const reviewBudget = await reserveAdditionalModelCall(input.estimatedTokens);
  if (!reviewBudget.ok) {
    return emptyDelivery({
      message: serviceUnavailableMessage(),
      disposition: "service_unavailable",
      responseStatus: "budget_exhausted",
      boundaryReason: "upstream_unavailable",
      followUpQuestions,
      tokenReservation: baseReservation,
      actualTokens: plannerTokens,
      diagnostic: { ...diagnosticBase, answerPath: "service_unavailable", boundaryReason: "upstream_unavailable" },
    });
  }

  const totalReservation = baseReservation + reviewBudget.tokenReservation;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  input.signal.addEventListener("abort", () => controller.abort(), { once: true });
  let totalTokens = plannerTokens;

  try {
    const first = await generateDeepSeekAnswer({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextMessage },
        ...recentModelMessages,
      ],
      signal: controller.signal,
      userId: input.sessionId,
    });
    totalTokens += first.totalTokens;
    const firstGate = validateAnswer(first.text, plan);

    input.onStage("reviewing_answer");
    const reviewed = await reviewDeepSeekAnswer({
      question: input.question,
      candidate: first.text,
      plan,
      localTriggers: firstGate.triggers,
      signal: controller.signal,
      userId: input.sessionId,
    });
    totalTokens += reviewed.totalTokens;

    let answer = first.text;
    let answerModelPath: ModelPath = first.modelPath;
    let answerPath: AnswerPath = "generated";
    let reviewPath: ReviewPath = "pro_pass";
    let finalTriggers = firstGate.triggers;

    if (reviewed.review.decision === "rewrite" && reviewed.review.revisedAnswer?.trim()) {
      answer = reviewed.review.revisedAnswer.trim();
      answerModelPath = "pro";
      answerPath = "repaired";
      reviewPath = "pro_rewrite";
      finalTriggers = validateAnswer(answer, plan).triggers;
    } else if (reviewed.review.decision === "reject") {
      reviewPath = "pro_reject";
      finalTriggers = [...finalTriggers, ...reviewed.review.failedDimensions.map((dimension) => `review:${dimension}`)];
    }

    const accepted = reviewed.review.decision !== "reject" && !hasBlockingQualityTriggers(finalTriggers);
    console.info("ask-me-quality", JSON.stringify({
      contractId: plan.contractId,
      topic: plan.topic,
      facet: plan.facet,
      answerIntent: plan.intent,
      disposition: decision.disposition,
      hasTargetRole: Boolean(plan.targetRole),
      plannerUsed,
      plannerModelPath,
      modelPath: accepted ? answerModelPath : "local_fallback",
      retrievalItemIds: items.map((item) => item.id),
      answerPath: accepted ? answerPath : "service_unavailable",
      reviewPath,
      rewriteCount: answerPath === "repaired" ? 1 : 0,
      qualityTriggers: [...new Set(finalTriggers)],
      reviewFailures: reviewed.review.failedDimensions,
      plannerFallbackReason,
    }));

    if (!accepted) {
      return emptyDelivery({
        message: serviceUnavailableMessage(),
        disposition: "service_unavailable",
        responseStatus: "upstream_error",
        boundaryReason: "quality_review_failed",
        followUpQuestions,
        tokenReservation: totalReservation,
        actualTokens: totalTokens,
        diagnostic: {
          ...diagnosticBase,
          answerPath: "service_unavailable",
          qualityTriggerCount: [...new Set(finalTriggers)].length,
          boundaryReason: "quality_review_failed",
          reviewPath,
        },
      });
    }

    return {
      answer,
      mode: "live",
      responseStatus: "completed",
      disposition: decision.disposition,
      boundaryReason: "none",
      claimIds,
      sourceIds,
      sources,
      items,
      claims: getClaims(claimIds),
      followUpQuestions,
      tokenReservation: totalReservation,
      actualTokens: totalTokens,
      modelPath: answerModelPath,
      degraded: false,
      deliveryMode: "reviewed_buffer",
      streamed: false,
      diagnostic: {
        ...diagnosticBase,
        answerPath,
        rewriteCount: answerPath === "repaired" ? 1 : 0,
        qualityTriggerCount: 0,
        modelPath: answerModelPath,
        boundaryReason: "none",
        reviewPath,
      },
    };
  } catch (error) {
    console.warn("ask-me-answer-unavailable", JSON.stringify({
      answerIntent: plan.intent,
      topic: plan.topic,
      plannerModelPath,
      boundaryReason: "upstream_unavailable",
      reason: error instanceof DeepSeekUpstreamError ? `upstream_${error.status}` : error instanceof Error ? error.message.slice(0, 120) : "unknown",
    }));
    return emptyDelivery({
      message: serviceUnavailableMessage(),
      disposition: "service_unavailable",
      responseStatus: "upstream_error",
      boundaryReason: "upstream_unavailable",
      followUpQuestions,
      tokenReservation: totalReservation,
      actualTokens: totalTokens,
      diagnostic: { ...diagnosticBase, answerPath: "service_unavailable", boundaryReason: "upstream_unavailable" },
    });
  } finally {
    clearTimeout(timeout);
  }
}
