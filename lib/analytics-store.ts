import type { QualityEventRow } from "./analytics-report";
import type { SanitizedAnalyticsEvent } from "./analytics";

interface NeonQuery {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

interface NeonModule {
  neon(url: string): NeonQuery;
}

let sqlPromise: Promise<NeonQuery | null> | null = null;
let schemaPromise: Promise<void> | null = null;

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
          disposition TEXT,
          boundary_reason TEXT,
          review_path TEXT,
          first_stage_latency_ms INTEGER,
          checking_evidence_latency_ms INTEGER,
          reviewing_answer_latency_ms INTEGER,
          delivery_mode TEXT,
          model_path TEXT,
          question_family TEXT,
          fact_risk TEXT,
          answer_strategy TEXT,
          semantic_warning_count INTEGER,
          visual_finish_latency_ms INTEGER,
          stream_failure_type TEXT,
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
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS disposition TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS boundary_reason TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS review_path TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS first_stage_latency_ms INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS checking_evidence_latency_ms INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS reviewing_answer_latency_ms INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS delivery_mode TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS model_path TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS question_family TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS fact_risk TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS answer_strategy TEXT`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS semantic_warning_count INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS visual_finish_latency_ms INTEGER`;
      await sql`ALTER TABLE ask_me_events ADD COLUMN IF NOT EXISTS stream_failure_type TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS ask_me_events_occurred_at_idx ON ask_me_events (occurred_at)`;
      await sql`CREATE INDEX IF NOT EXISTS ask_me_events_funnel_idx ON ask_me_events (event_name, occurred_at)`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function persistSanitizedEvent(event: SanitizedAnalyticsEvent): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;
  try {
    await ensureSchema(sql);
    await sql`
      INSERT INTO ask_me_events (
        event_name, session_hash, response_status, claim_ids, source_ids,
        latency_ms, first_token_latency_ms, delivery_path, question_category, target_type, target_id,
        contract_id, topic, facet, answer_mode, answer_path, rewrite_count, retrieval_count, quality_trigger_count,
        disposition, boundary_reason, review_path, first_stage_latency_ms, checking_evidence_latency_ms, reviewing_answer_latency_ms, delivery_mode, model_path,
        question_family, fact_risk, answer_strategy, semantic_warning_count, visual_finish_latency_ms, stream_failure_type
      ) VALUES (
        ${event.event}, ${event.sessionHash}, ${event.responseStatus}, ${event.claimIds}, ${event.sourceIds},
        ${event.latencyMs}, ${event.firstTokenLatencyMs}, ${event.deliveryPath}, ${event.questionCategory}, ${event.targetType}, ${event.targetId},
        ${event.contractId}, ${event.topic}, ${event.facet}, ${event.answerMode}, ${event.answerPath}, ${event.rewriteCount}, ${event.retrievalCount}, ${event.qualityTriggerCount},
        ${event.disposition}, ${event.boundaryReason}, ${event.reviewPath}, ${event.firstStageLatencyMs}, ${event.checkingEvidenceLatencyMs}, ${event.reviewingAnswerLatencyMs}, ${event.deliveryMode}, ${event.modelPath},
        ${event.questionFamily}, ${event.factRisk}, ${event.answerStrategy}, ${event.semanticWarningCount}, ${event.visualFinishLatencyMs}, ${event.streamFailureType}
      )
    `;
    return true;
  } catch (error) {
    console.warn("ask-me-analytics: event write failed", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export async function loadQualityEventRows(days: number): Promise<QualityEventRow[] | null> {
  const sql = await getSql();
  if (!sql) return null;
  await ensureSchema(sql);
  return await sql`
    SELECT event_name, response_status, latency_ms, first_token_latency_ms, delivery_path, target_id, answer_path, rewrite_count, retrieval_count, disposition, boundary_reason, review_path, first_stage_latency_ms, topic, facet, delivery_mode, model_path, question_family, fact_risk, answer_strategy, semantic_warning_count, visual_finish_latency_ms, stream_failure_type
    FROM ask_me_events
    WHERE occurred_at >= NOW() - (${days} * INTERVAL '1 day')
    ORDER BY occurred_at ASC
  ` as QualityEventRow[];
}

export async function deleteExpiredAnalyticsEvents(days: number): Promise<{ deleted: number; disabled: boolean }> {
  const sql = await getSql();
  if (!sql) return { deleted: 0, disabled: true };
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

export function resetAnalyticsStoreForTests() {
  sqlPromise = null;
  schemaPromise = null;
}
