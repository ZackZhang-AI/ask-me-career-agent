export const FEEDBACK_REASONS = ["helpful", "not_relevant", "not_specific", "repetitive", "missing_evidence"] as const;

export interface QualityEventRow {
  event_name: string;
  response_status: string | null;
  latency_ms: number | null;
  first_token_latency_ms?: number | null;
  delivery_path?: string | null;
  target_id: string | null;
  answer_path: string | null;
  rewrite_count: number | null;
  retrieval_count: number | null;
  disposition?: string | null;
  boundary_reason?: string | null;
  review_path?: string | null;
  first_stage_latency_ms?: number | null;
  topic?: string | null;
  facet?: string | null;
  delivery_mode?: string | null;
  model_path?: string | null;
  question_family?: string | null;
  fact_risk?: string | null;
  answer_strategy?: string | null;
  semantic_warning_count?: number | null;
  visual_finish_latency_ms?: number | null;
  stream_failure_type?: string | null;
}

export interface QualitySegment {
  count: number;
  completionRate: number | null;
  serviceUnavailableRate: number | null;
  latencyP50Ms: number | null;
}

export interface QualityReport {
  days: number;
  sample: { questions: number; clientCompleted: number; presetCompleted: number; generated: number; feedback: number };
  outcomes: { completionRate: number | null; nonFallbackRate: number | null; insufficientEvidenceRate: number | null; answerRate: number | null; clarifyRate: number | null; declineRate: number | null; serviceUnavailableRate: number | null; helpfulRate: number | null };
  diagnostics: { repairRate: number | null; fallbackRate: number | null; proReviewRate: number | null; proRewriteRate: number | null; semanticWarningRate: number | null; hardSafetyWithdrawalRate: number | null; averageRetrievalCount: number | null; latencyP50Ms: number | null; latencyP95Ms: number | null; firstTokenP50Ms: number | null; firstTokenP95Ms: number | null; firstStageP95Ms: number | null; visualFinishP50Ms: number | null; visualFinishP95Ms: number | null; presetFirstTokenP95Ms: number | null };
  segments: { byQuestionFamily: Record<string, QualitySegment>; byTopic: Record<string, QualitySegment>; byFacet: Record<string, QualitySegment>; byDeliveryMode: Record<string, QualitySegment>; byModelPath: Record<string, QualitySegment> };
  feedbackReasons: Record<string, number>;
  targets: { completionRate: number; nonFallbackRate: number; minimumFeedbackSample: number; firstStageP95Ms: number; presetFirstTokenP95Ms: number };
}

function rate(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function buildSegments(rows: QualityEventRow[], select: (row: QualityEventRow) => string | null | undefined) {
  const keys = [...new Set(rows.map(select).filter((value): value is string => Boolean(value)))];
  return Object.fromEntries(keys.map((key) => {
    const group = rows.filter((row) => select(row) === key);
    const latencies = group.flatMap((row) => typeof row.latency_ms === "number" ? [row.latency_ms] : []);
    return [key, {
      count: group.length,
      completionRate: rate(group.filter((row) => row.response_status === "completed").length, group.length),
      serviceUnavailableRate: rate(group.filter((row) => row.disposition === "service_unavailable").length, group.length),
      latencyP50Ms: percentile(latencies, 0.5),
    } satisfies QualitySegment];
  }));
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
  const firstStageLatencies = generatedRows.flatMap((row) => typeof row.first_stage_latency_ms === "number" ? [row.first_stage_latency_ms] : []);
  const visualFinishLatencies = rows.flatMap((row) => row.event_name === "answer_completed" && typeof row.visual_finish_latency_ms === "number" ? [row.visual_finish_latency_ms] : []);
  const dispositions = generatedRows.filter((row) => row.disposition);
  const reviewedRows = generatedRows.filter((row) => row.review_path && row.review_path !== "none");
  return {
    days,
    sample: { questions, clientCompleted, presetCompleted: presetCompletedRows.length, generated: generatedRows.length, feedback: feedbackRows.length },
    outcomes: {
      completionRate: rate(clientCompleted, questions),
      nonFallbackRate: rate(modelRows.filter((row) => row.answer_path !== "fallback").length, modelRows.length),
      insufficientEvidenceRate: rate(generatedRows.filter((row) => row.response_status === "insufficient_evidence").length, generatedRows.length),
      answerRate: rate(dispositions.filter((row) => row.disposition === "answer" || row.disposition === "scoped_answer").length, dispositions.length),
      clarifyRate: rate(dispositions.filter((row) => row.disposition === "clarify").length, dispositions.length),
      declineRate: rate(dispositions.filter((row) => row.disposition === "decline").length, dispositions.length),
      serviceUnavailableRate: rate(dispositions.filter((row) => row.disposition === "service_unavailable").length, dispositions.length),
      helpfulRate: feedbackRows.length >= 30 ? rate(feedbackReasons.helpful, feedbackRows.length) : null,
    },
    diagnostics: {
      repairRate: rate(modelRows.filter((row) => row.answer_path === "repaired").length, modelRows.length),
      fallbackRate: rate(modelRows.filter((row) => row.answer_path === "fallback").length, modelRows.length),
      proReviewRate: rate(reviewedRows.length, generatedRows.filter((row) => row.answer_path === "generated" || row.answer_path === "repaired" || row.answer_path === "service_unavailable").length),
      proRewriteRate: rate(reviewedRows.filter((row) => row.review_path === "pro_rewrite").length, reviewedRows.length),
      semanticWarningRate: rate(generatedRows.filter((row) => (row.semantic_warning_count ?? 0) > 0).length, generatedRows.length),
      hardSafetyWithdrawalRate: rate(rows.filter((row) => row.stream_failure_type === "hard_safety").length, questions),
      averageRetrievalCount: retrievalCounts.length ? Number((retrievalCounts.reduce((sum, value) => sum + value, 0) / retrievalCounts.length).toFixed(2)) : null,
      latencyP50Ms: percentile(latencies, 0.5),
      latencyP95Ms: percentile(latencies, 0.95),
      firstTokenP50Ms: percentile(firstTokenLatencies, 0.5),
      firstTokenP95Ms: percentile(firstTokenLatencies, 0.95),
      firstStageP95Ms: percentile(firstStageLatencies, 0.95),
      visualFinishP50Ms: percentile(visualFinishLatencies, 0.5),
      visualFinishP95Ms: percentile(visualFinishLatencies, 0.95),
      presetFirstTokenP95Ms: percentile(presetFirstTokenLatencies, 0.95),
    },
    segments: {
      byQuestionFamily: buildSegments(generatedRows, (row) => row.question_family),
      byTopic: buildSegments(generatedRows, (row) => row.topic),
      byFacet: buildSegments(generatedRows, (row) => row.facet),
      byDeliveryMode: buildSegments(generatedRows, (row) => row.delivery_mode),
      byModelPath: buildSegments(generatedRows, (row) => row.model_path),
    },
    feedbackReasons,
    targets: { completionRate: 0.95, nonFallbackRate: 0.85, minimumFeedbackSample: 30, firstStageP95Ms: 100, presetFirstTokenP95Ms: 200 },
  };
}
