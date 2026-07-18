import { createHash } from "node:crypto";

export const ANALYTICS_EVENTS = [
  "page_viewed",
  "summary_viewed",
  "question_sent",
  "suggestion_clicked",
  "answer_completed",
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

export interface AnalyticsEventInput {
  event: AnalyticsEventName;
  sessionId: string;
  responseStatus?: string;
  claimIds?: string[];
  sourceIds?: string[];
  latencyMs?: number;
  questionCategory?: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}

export interface SanitizedAnalyticsEvent {
  event: AnalyticsEventName;
  sessionHash: string;
  responseStatus: string | null;
  claimIds: string[];
  sourceIds: string[];
  latencyMs: number | null;
  questionCategory: string | null;
  targetType: string | null;
  targetId: string | null;
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
  const targetTypeCandidate = typeof input.targetType === "string" && TARGET_TYPES.has(input.targetType) ? input.targetType : inferredTargetType(event);
  const legacyTarget = input.targetId ?? input.detail;

  return {
    event,
    sessionHash: privacyHash(input.sessionId),
    responseStatus,
    claimIds: safeIds(input.claimIds, "C"),
    sourceIds: safeIds(input.sourceIds, "S"),
    latencyMs: latency === null ? null : Math.max(0, Math.min(latency, 300_000)),
    questionCategory,
    targetType: targetTypeCandidate,
    targetId: safeTarget(legacyTarget),
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
          question_category TEXT,
          target_type TEXT,
          target_id TEXT,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
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
        latency_ms, question_category, target_type, target_id
      ) VALUES (
        ${event.event}, ${event.sessionHash}, ${event.responseStatus}, ${event.claimIds}, ${event.sourceIds},
        ${event.latencyMs}, ${event.questionCategory}, ${event.targetType}, ${event.targetId}
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
