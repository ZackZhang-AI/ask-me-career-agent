import { createHash } from "node:crypto";

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
const RESPONSE_STATUSES = new Set(["completed", "insufficient_evidence", "refused", "rate_limited", "budget_exhausted", "upstream_error"]);
const QUESTION_CATEGORIES = new Set(["profile", "fit", "project", "experience", "skills", "gaps", "security", "other"]);
const TARGET_TYPES = new Set(["source", "project", "resume", "email", "phone", "github", "suggestion", "feedback"]);
const ANSWER_MODES = new Set(["live", "stable", "demo", "guardrail"]);
const ANSWER_PATHS = new Set(["generated", "repaired", "fallback", "stable", "demo", "guardrail"]);
const QUESTION_TOPICS = new Set(["profile", "role_fit", "rag", "deepflow", "ask_me", "local_tools", "audit", "statistics", "skills", "enterprise_ai", "agent", "unknown"]);
const QUESTION_FACETS = new Set(["overview", "problem", "method", "contribution", "architecture", "collaboration", "evaluation", "transfer", "example", "result", "boundary", "fit"]);
const DELIVERY_PATHS = new Set(["preset", "api"]);
export const FEEDBACK_REASONS = ["helpful", "not_relevant", "not_specific", "repetitive", "missing_evidence"] as const;
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
}

interface NeonQuery {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

interface NeonModule {
  neon(url: string): NeonQuery;
}

let sqlPromise: Promise<NeonQuery | null> | null = null;
let schemaPromise: Promise<void> | null = null;

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
  };
}

async function getSql(): Promise<NeonQuery | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  if (!sqlPromise) {
    sqlPromise = import("@neondatabase/serverless")
      .then((module) => (module as unknown as NeonModule).neon(databaseUrl))
      .catch((error: unknown) => {
        console.warn("ask-me-analytics: Neon unavailable; analytics disabled", error instanceof Error ? error.message : "unknown error");
        return null;
      });
  }
  return sqlPromise;
}

async function ensureSchema(sql: NeonQuery): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS ask_me_events (
          id BIGSERIAL PRIMARY KEY,
          event_name TEXT NOT NULL,
          session_hash CHAR(64) NOT NULL,
          response_status TEXT,
          claim_ids TEXT[] NOT NULL DEFAULT '{}',
          source_ids TEXT[] NOT NULL DEFAULT '{}',
          latency_ms INTEGER,
          first_token_latency_ms INTEGER,
          delivery_path TEXT,
          question_category TEXT,
          target_type TEXT,
          target_id TEXT,
          contract_id TEXT,
          topic TEXT,
          facet TEXT,
          answer_mode TEXT,
          answer_path TEXT,
          rewrite_count INTEGER,
          retrieval_count INTEGER,
          quality_trigger_count INTEGER,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS contract_id TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS topic TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS facet TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS answer_mode TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS answer_path TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS rewrite_count INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS retrieval_count INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS quality_trigger_count INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS first_token_latency_ms INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS delivery_path TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS ask_me_events_occurred_at_idx ON ask_me_events (occurred_at)`;
      await sql`CREATE INDEX IF NOT EXISTS ask_me_events_funnel_idx ON ask_me_events (event_name, occurred_at)`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function persistEvent(value: unknown): Promise<boolean> {
  const event = sanitizeAnalyticsEvent(value);
  if (!event) return false;
  const sql = await getSql();
  if (!sql) return false;
  try {
    await ensureSchema(sql);
    await sql`
      INSERT INTO ask_me_events (
        event_name, session_hash, response_status, claim_ids, source_ids,
        latency_ms, first_token_latency_ms, delivery_path, question_category, target_type, target_id
        , contract_id, topic, facet, answer_mode, answer_path, rewrite_count, retrieval_count, quality_trigger_count
      ) VALUES (
        ${event.event}, ${event.sessionHash}, ${event.responseStatus}, ${event.claimIds}, ${event.sourceIds},
        ${event.latencyMs}, ${event.firstTokenLatencyMs}, ${event.deliveryPath}, ${event.questionCategory}, ${event.targetType}, ${event.targetId}
        , ${event.contractId}, ${event.topic}, ${event.facet}, ${event.answerMode}, ${event.answerPath}, ${event.rewriteCount}, ${event.retrievalCount}, ${event.qualityTriggerCount}
      )
    `;
    return true;
  } catch (error) {
    console.warn("ask-me-analytics: event write failed", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export function recordEvent(event: AnalyticsEventInput): void {
  void persistEvent(event).catch(() => undefined);
}

interface QualityEventRow {
  event_name: string;
  response_status: string | null;
  latency_ms: number | null;
  first_token_latency_ms?: number | null;
  delivery_path?: string | null;
  target_id: string | null;
  answer_path: string | null;
  rewrite_count: number | null;
  retrieval_count: number | null;
}

export interface QualityReport {
  days: number;
  sample: { questions: number; clientCompleted: number; presetCompleted: number; generated: number; feedback: number };
  outcomes: { completionRate: number | null; nonFallbackRate: number | null; insufficientEvidenceRate: number | null; helpfulRate: number | null };
  diagnostics: { repairRate: number | null; fallbackRate: number | null; averageRetrievalCount: number | null; latencyP50Ms: number | null; latencyP95Ms: number | null; firstTokenP50Ms: number | null; firstTokenP95Ms: number | null; presetFirstTokenP95Ms: number | null };
  feedbackReasons: Record<string, number>;
  targets: { completionRate: number; nonFallbackRate: number; minimumFeedbackSample: number; presetFirstTokenP95Ms: number };
}

function rate(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

export function buildQualityReport(rows: QualityEventRow[], days: number): QualityReport {
  const questions = rows.filter((row) => row.event_name === "question_sent" || row.event_name === "suggestion_clicked").length;
  const clientCompleted = rows.filter((row) => row.event_name === "answer_completed").length;
  const presetCompletedRows = rows.filter((row) => row.event_name === "answer_completed" && row.delivery_path === "preset");
  const generatedRows = rows.filter((row) => row.event_name === "answer_generated");
  const modelRows = generatedRows.filter((row) => ["generated", "repaired", "fallback"].includes(row.answer_path ?? ""));
  const feedbackRows = rows.filter((row) => row.event_name === "answer_feedback" && row.target_id);
  const feedbackReasons = Object.fromEntries(FEEDBACK_REASONS.map((reason) => [reason, feedbackRows.filter((row) => row.target_id === reason).length]));
  const latencies = generatedRows.flatMap((row) => typeof row.latency_ms === "number" ? [row.latency_ms] : []);
  const firstTokenLatencies = rows.flatMap((row) => row.event_name === "answer_completed" && typeof row.first_token_latency_ms === "number" ? [row.first_token_latency_ms] : []);
  const presetFirstTokenLatencies = presetCompletedRows.flatMap((row) => typeof row.first_token_latency_ms === "number" ? [row.first_token_latency_ms] : []);
  const retrievalCounts = generatedRows.flatMap((row) => typeof row.retrieval_count === "number" ? [row.retrieval_count] : []);
  return {
    days,
    sample: { questions, clientCompleted, presetCompleted: presetCompletedRows.length, generated: generatedRows.length, feedback: feedbackRows.length },
    outcomes: {
      completionRate: rate(clientCompleted, questions),
      nonFallbackRate: rate(modelRows.filter((row) => row.answer_path !== "fallback").length, modelRows.length),
      insufficientEvidenceRate: rate(generatedRows.filter((row) => row.response_status === "insufficient_evidence").length, generatedRows.length),
      helpfulRate: feedbackRows.length >= 30 ? rate(feedbackReasons.helpful, feedbackRows.length) : null,
    },
    diagnostics: {
      repairRate: rate(modelRows.filter((row) => row.answer_path === "repaired").length, modelRows.length),
      fallbackRate: rate(modelRows.filter((row) => row.answer_path === "fallback").length, modelRows.length),
      averageRetrievalCount: retrievalCounts.length ? Number((retrievalCounts.reduce((sum, value) => sum + value, 0) / retrievalCounts.length).toFixed(2)) : null,
      latencyP50Ms: percentile(latencies, 0.5),
      latencyP95Ms: percentile(latencies, 0.95),
      firstTokenP50Ms: percentile(firstTokenLatencies, 0.5),
      firstTokenP95Ms: percentile(firstTokenLatencies, 0.95),
      presetFirstTokenP95Ms: percentile(presetFirstTokenLatencies, 0.95),
    },
    feedbackReasons,
    targets: { completionRate: 0.95, nonFallbackRate: 0.85, minimumFeedbackSample: 30, presetFirstTokenP95Ms: 200 },
  };
}

export async function getQualityReport(days = 7): Promise<QualityReport | null> {
  const sql = await getSql();
  if (!sql) return null;
  const safeDays = Math.max(1, Math.min(Math.floor(days), 30));
  await ensureSchema(sql);
  const rows = await sql`
    SELECT event_name, response_status, latency_ms, first_token_latency_ms, delivery_path, target_id, answer_path, rewrite_count, retrieval_count
    FROM ask_me_events
    WHERE occurred_at >= NOW() - (${safeDays} * INTERVAL '1 day')
    ORDER BY occurred_at ASC
  ` as QualityEventRow[];
  return buildQualityReport(rows, safeDays);
}

export async function deleteExpiredEvents(retentionDays = 30): Promise<{ deleted: number; disabled: boolean }> {
  const sql = await getSql();
  if (!sql) return { deleted: 0, disabled: true };
  const days = Math.max(1, Math.min(Math.floor(retentionDays), 365));
  await ensureSchema(sql);
  const rows = await sql`
    WITH deleted AS (
      DELETE FROM ask_me_events
      WHERE occurred_at < NOW() - (${days} * INTERVAL '1 day')
      RETURNING 1
    )
    SELECT COUNT(*)::INTEGER AS deleted FROM deleted
  `;
  const first = rows[0] as { deleted?: number | string } | undefined;
  return { deleted: Number(first?.deleted ?? 0), disabled: false };
}

export function resetAnalyticsForTests(): void {
  sqlPromise = null;
  schemaPromise = null;
}
