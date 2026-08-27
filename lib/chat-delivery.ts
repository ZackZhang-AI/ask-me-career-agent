import { splitQualityTriggers, validateAnswer, validateAnswerFragment } from "./answer-quality";
import { streamDeepSeekAnswer } from "./deepseek";
import { takeStreamUnits } from "./stream-answer";
import type { AnswerPlan, ChatMessage, DeliveryMode, QuestionFrame, StreamFailureType } from "./types";

const reviewedIntents = new Set([
  "result", "contribution", "experience", "education", "credentials", "project_overview", "project_problem", "ai_collaboration",
]);

export function selectDeliveryMode(input: {
  frame: QuestionFrame;
  plan: AnswerPlan;
  shouldGenerate: boolean;
  hasLocalResponse: boolean;
  hasEvidence: boolean;
  canStream: boolean;
}): DeliveryMode {
  if (input.hasLocalResponse || input.frame.questionMode === "agent_meta" || !input.shouldGenerate) return "local_reveal";
  if (!input.canStream || reviewedIntents.has(input.plan.intent)) return "reviewed_buffer";
  if (input.frame.evidencePolicy === "required" && !input.hasEvidence) return "reviewed_buffer";
  if (input.frame.questionMode === "candidate_reasoning") return "realtime_stream";
  if (["career_transition", "experience_value", "role_fit", "skills", "challenge", "diagnosis", "limitation", "hiring_recommendation"].includes(input.plan.intent)) return "realtime_stream";
  return "reviewed_buffer";
}

export class StreamInterruptedError extends Error {
  constructor(
    public readonly stage: "writing_answer" | "checking_evidence",
    public readonly failureType: Exclude<StreamFailureType, "semantic_warning" | "service_unavailable">,
    message = "流式回答未完整生成",
  ) {
    super(message);
    this.name = "StreamInterruptedError";
  }
}

export async function streamInterviewAnswer(input: {
  messages: Array<ChatMessage | { role: "system"; content: string }>;
  signal: AbortSignal;
  plan: AnswerPlan;
  userId: string;
  startedAt: number;
  onDelta: (chunk: string) => Promise<void> | void;
}) {
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
          if (visible) throw new StreamInterruptedError("writing_answer", "transport_interrupted", "stream_protocol_error");
          throw new Error("stream_protocol_error");
        }
        if (part.type === "finish") {
          streamFinished = true;
          continue;
        }
        if (part.type !== "text-delta") continue;
        pending += typeof part.text === "string" ? part.text : "";
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
          const { hardSafety } = splitQualityTriggers(validateAnswerFragment(candidate, input.plan, unit.sentenceComplete).triggers);
          if (hardSafety.length) {
            if (visible) throw new StreamInterruptedError("writing_answer", "hard_safety", hardSafety.join("；"));
            throw new Error(`stream_safety:${hardSafety.join(",")}`);
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
        if (visible) throw new StreamInterruptedError("writing_answer", "transport_interrupted", "stream_incomplete");
        throw new Error("stream_incomplete");
      }

      for (const unit of takeStreamUnits(`${held}${pending}`, true).units) {
        const candidate = `${answer}${unit.text}`;
        const { hardSafety } = splitQualityTriggers(validateAnswerFragment(candidate, input.plan, true).triggers);
        if (hardSafety.length) {
          if (visible) throw new StreamInterruptedError("writing_answer", "hard_safety", hardSafety.join("；"));
          throw new Error(`stream_safety:${hardSafety.join(",")}`);
        }
        answer = candidate;
        if (!visible) {
          visible = true;
          firstChunkLatencyMs = Date.now() - input.startedAt;
        }
        await input.onDelta(unit.text);
      }
      if (!answer.trim()) throw new Error("stream_empty");
      const finalTriggers = splitQualityTriggers(validateAnswer(answer, input.plan).triggers);
      if (finalTriggers.hardSafety.length) {
        if (visible) throw new StreamInterruptedError("writing_answer", "hard_safety", finalTriggers.hardSafety.join("；"));
        throw new Error(`stream_safety:${finalTriggers.hardSafety.join(",")}`);
      }
      const usage = await generated.usage;
      return {
        answer,
        totalTokens: Number(usage.totalTokens ?? 0),
        modelPath,
        firstChunkLatencyMs: firstChunkLatencyMs ?? Date.now() - input.startedAt,
        semanticWarnings: finalTriggers.semantic,
      };
    } catch (error) {
      if (error instanceof StreamInterruptedError || (error instanceof Error && error.name === "AbortError")) throw error;
      if (visible || modelPath === "pro") throw error;
    }
  }
  throw new Error("stream_unavailable");
}
