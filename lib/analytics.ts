import { createHash } from "node:crypto";
import { buildQualityReport, FEEDBACK_REASONS, type QualityReport } from "./analytics-report";
import { deleteExpiredAnalyticsEvents, loadQualityEventRows, persistSanitizedEvent, resetAnalyticsStoreForTests } from "./analytics-store";

export { buildQualityReport } from "./analytics-report";
export type { QualityReport, QualitySegment } from "./analytics-report";

export const ANALYTICS_EVENTS = [
  "page_viewed",
  "summary_viewed",
  "question_sent",
  "suggestion_clicked",
  "answer_completed",
  "answer_generated",
  "followup_sent",
  "source_opened",
  "project_opened",
  "resume_opened",
  "contact_opened",
  "chat_error",
  "answer_feedback",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const EVENT_NAMES = new Set<string>(ANALYTICS_EVENTS);
const RESPONSE_STATUSES = new Set(["completed", "needs_clarification", "insufficient_evidence", "refused", "rate_limited", "budget_exhausted", "upstream_error"]);
const QUESTION_CATEGORIES = new Set(["profile", "fit", "project", "experience", "skills", "gaps", "security", "other"]);
const TARGET_TYPES = new Set(["source", "project", "resume", "email", "phone", "github", "suggestion", "feedback"]);
const ANSWER_MODES = new Set(["live", "stable", "demo", "guardrail", "boundary"]);
const ANSWER_PATHS = new Set(["generated", "repaired", "fallback", "stable", "demo", "guardrail", "boundary", "service_unavailable"]);
const ANSWER_DISPOSITIONS = new Set(["answer", "scoped_answer", "clarify", "decline", "service_unavailable"]);
const BOUNDARY_REASONS = new Set(["none", "ambiguous_role", "ambiguous_project", "missing_personal_evidence", "outside_supported_scope", "unrelated_to_interview", "unsafe_request", "quality_review_failed", "upstream_unavailable"]);
const REVIEW_PATHS = new Set(["none", "pro_pass", "pro_rewrite", "pro_reject"]);
const DELIVERY_MODES = new Set(["local_reveal", "realtime_stream", "reviewed_buffer"]);
const MODEL_PATHS = new Set(["flash", "pro", "local_fallback"]);
const QUESTION_TOPICS = new Set(["profile", "role_fit", "rag", "deepflow", "ask_me", "local_tools", "audit", "statistics", "skills", "enterprise_ai", "agent", "unknown"]);
const QUESTION_FACETS = new Set(["overview", "problem", "method", "contribution", "architecture", "collaboration", "evaluation", "transfer", "example", "result", "boundary", "fit"]);
const DELIVERY_PATHS = new Set(["preset", "api"]);
const INTERVIEW_FAMILIES = new Set(["candidate_fact", "behavioral", "situational", "product_case", "business_case", "estimation", "motivation", "work_style", "career_logistics", "current_topic", "agent_meta", "unrelated"]);
const FACT_RISKS = new Set(["low", "supported_personal", "unsupported_personal", "freshness_sensitive"]);
const ANSWER_STRATEGIES = new Set(["evidence_answer", "reasoned_answer", "clarify_then_answer", "boundary_bridge", "decline"]);
const STREAM_FAILURE_TYPES = new Set(["hard_safety", "transport_interrupted", "service_unavailable", "semantic_warning"]);
const FEEDBACK_REASON_SET = new Set<string>(FEEDBACK_REASONS);

export interface AnalyticsEventInput {
  event: AnalyticsEventName;
  sessionId: string;
  responseStatus?: string;
  claimIds?: string[];
  sourceIds?: string[];
  latencyMs?: number;
  firstTokenLatencyMs?: number;
  deliveryPath?: string;
  questionCategory?: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  contractId?: string;
  topic?: string;
  facet?: string;
  answerMode?: string;
  answerPath?: string;
  rewriteCount?: number;
  retrievalCount?: number;
  qualityTriggerCount?: number;
  disposition?: string;
  boundaryReason?: string;
  reviewPath?: string;
  firstStageLatencyMs?: number;
  checkingEvidenceLatencyMs?: number;
  reviewingAnswerLatencyMs?: number;
  deliveryMode?: string;
  modelPath?: string;
  questionFamily?: string;
  factRisk?: string;
  answerStrategy?: string;
  semanticWarningCount?: number;
  visualFinishLatencyMs?: number;
  streamFailureType?: string;
}

export interface SanitizedAnalyticsEvent {
  event: AnalyticsEventName;
  sessionHash: string;
  responseStatus: string | null;
  claimIds: string[];
  sourceIds: string[];
  latencyMs: number | null;
  firstTokenLatencyMs: number | null;
  deliveryPath: string | null;
  questionCategory: string | null;
  targetType: string | null;
  targetId: string | null;
  contractId: string | null;
  topic: string | null;
  facet: string | null;
  answerMode: string | null;
  answerPath: string | null;
  rewriteCount: number | null;
  retrievalCount: number | null;
  qualityTriggerCount: number | null;
  disposition: string | null;
  boundaryReason: string | null;
  reviewPath: string | null;
  firstStageLatencyMs: number | null;
  checkingEvidenceLatencyMs: number | null;
  reviewingAnswerLatencyMs: number | null;
  deliveryMode: string | null;
  modelPath: string | null;
  questionFamily: string | null;
  factRisk: string | null;
  answerStrategy: string | null;
  semanticWarningCount: number | null;
  visualFinishLatencyMs: number | null;
  streamFailureType: string | null;
}

function privacyHash(value: string): string {
  const salt = process.env.PRIVACY_HASH_SALT || "ask-me-local-development";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function safeIds(value: unknown, prefix: "C" | "S"): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && new RegExp(`^${prefix}\\d{1,4}$`).test(id)))].slice(0, 20);
}

function safeTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/@/.test(trimmed) || /\b1[3-9]\d{9}\b/.test(trimmed) || /sk-[a-zA-Z0-9_-]{8,}/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) return null;
  if (!/^[a-zA-Z0-9_:-]{1,80}$/.test(trimmed)) return null;
  return trimmed;
}

function safeCount(value: unknown, max = 100): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(Math.round(value), max))
    : null;
}

function inferredTargetType(event: AnalyticsEventName): string | null {
  if (event === "source_opened") return "source";
  if (event === "project_opened") return "project";
  if (event === "resume_opened") return "resume";
  if (event === "suggestion_clicked") return "suggestion";
  if (event === "answer_feedback") return "feedback";
  return null;
}

export function sanitizeAnalyticsEvent(value: unknown): SanitizedAnalyticsEvent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.event !== "string" || !EVENT_NAMES.has(input.event)) return null;
  if (typeof input.sessionId !== "string" || input.sessionId.length < 1 || input.sessionId.length > 128) return null;
  const event = input.event as AnalyticsEventName;
  const responseStatus = typeof input.responseStatus === "string" && RESPONSE_STATUSES.has(input.responseStatus) ? input.responseStatus : null;
  const questionCategory = typeof input.questionCategory === "string" && QUESTION_CATEGORIES.has(input.questionCategory) ? input.questionCategory : null;
  const latency = typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs) ? Math.round(input.latencyMs) : null;
  const firstTokenLatency = typeof input.firstTokenLatencyMs === "number" && Number.isFinite(input.firstTokenLatencyMs)
    ? Math.round(input.firstTokenLatencyMs)
    : null;
  const targetTypeCandidate = typeof input.targetType === "string" && TARGET_TYPES.has(input.targetType) ? input.targetType : inferredTargetType(event);
  const legacyTarget = input.targetId ?? input.detail;
  const safeTargetId = safeTarget(legacyTarget);

  return {
    event,
    sessionHash: privacyHash(input.sessionId),
    responseStatus,
    claimIds: safeIds(input.claimIds, "C"),
    sourceIds: safeIds(input.sourceIds, "S"),
    latencyMs: latency === null ? null : Math.max(0, Math.min(latency, 300_000)),
    firstTokenLatencyMs: firstTokenLatency === null ? null : Math.max(0, Math.min(firstTokenLatency, 300_000)),
    deliveryPath: typeof input.deliveryPath === "string" && DELIVERY_PATHS.has(input.deliveryPath) ? input.deliveryPath : null,
    questionCategory,
    targetType: targetTypeCandidate,
    targetId: event === "answer_feedback" && safeTargetId && !FEEDBACK_REASON_SET.has(safeTargetId) ? null : safeTargetId,
    contractId: typeof input.contractId === "string" && /^[a-z0-9_:-]{1,80}$/.test(input.contractId) ? input.contractId : null,
    topic: typeof input.topic === "string" && QUESTION_TOPICS.has(input.topic) ? input.topic : null,
    facet: typeof input.facet === "string" && QUESTION_FACETS.has(input.facet) ? input.facet : null,
    answerMode: typeof input.answerMode === "string" && ANSWER_MODES.has(input.answerMode) ? input.answerMode : null,
    answerPath: typeof input.answerPath === "string" && ANSWER_PATHS.has(input.answerPath) ? input.answerPath : null,
    rewriteCount: safeCount(input.rewriteCount, 2),
    retrievalCount: safeCount(input.retrievalCount, 20),
    qualityTriggerCount: safeCount(input.qualityTriggerCount, 50),
    disposition: typeof input.disposition === "string" && ANSWER_DISPOSITIONS.has(input.disposition) ? input.disposition : null,
    boundaryReason: typeof input.boundaryReason === "string" && BOUNDARY_REASONS.has(input.boundaryReason) ? input.boundaryReason : null,
    reviewPath: typeof input.reviewPath === "string" && REVIEW_PATHS.has(input.reviewPath) ? input.reviewPath : null,
    firstStageLatencyMs: safeCount(input.firstStageLatencyMs, 300_000),
    checkingEvidenceLatencyMs: safeCount(input.checkingEvidenceLatencyMs, 300_000),
    reviewingAnswerLatencyMs: safeCount(input.reviewingAnswerLatencyMs, 300_000),
    deliveryMode: typeof input.deliveryMode === "string" && DELIVERY_MODES.has(input.deliveryMode) ? input.deliveryMode : null,
    modelPath: typeof input.modelPath === "string" && MODEL_PATHS.has(input.modelPath) ? input.modelPath : null,
    questionFamily: typeof input.questionFamily === "string" && INTERVIEW_FAMILIES.has(input.questionFamily) ? input.questionFamily : null,
    factRisk: typeof input.factRisk === "string" && FACT_RISKS.has(input.factRisk) ? input.factRisk : null,
    answerStrategy: typeof input.answerStrategy === "string" && ANSWER_STRATEGIES.has(input.answerStrategy) ? input.answerStrategy : null,
    semanticWarningCount: safeCount(input.semanticWarningCount, 50),
    visualFinishLatencyMs: safeCount(input.visualFinishLatencyMs, 300_000),
    streamFailureType: typeof input.streamFailureType === "string" && STREAM_FAILURE_TYPES.has(input.streamFailureType) ? input.streamFailureType : null,
  };
}

export async function persistEvent(value: unknown): Promise<boolean> {
  const event = sanitizeAnalyticsEvent(value);
  if (!event) return false;
  return persistSanitizedEvent(event);
}

export function recordEvent(event: AnalyticsEventInput): void {
  void persistEvent(event).catch(() => undefined);
}

export async function getQualityReport(days = 7): Promise<QualityReport | null> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 30));
  const rows = await loadQualityEventRows(safeDays);
  if (!rows) return null;
  return buildQualityReport(rows, safeDays);
}

export async function deleteExpiredEvents(retentionDays = 30): Promise<{ deleted: number; disabled: boolean }> {
  const days = Math.max(1, Math.min(Math.floor(retentionDays), 365));
  return deleteExpiredAnalyticsEvents(days);
}

export function resetAnalyticsForTests(): void {
  resetAnalyticsStoreForTests();
}
