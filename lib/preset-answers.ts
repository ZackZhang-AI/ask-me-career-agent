import { buildAnswerPlan } from "./answer";
import { buildAnswerCitations, validateAnswerCitations } from "./answer-citations";
import { validateAnswer } from "./answer-quality";
import { getClaims, getSources, matchStableAnswer, retrieveKnowledge } from "./knowledge";
import { findQuestionContract, frameFromContract } from "./question-contracts";
import { questionGroups } from "./question-suggestions";
import type { PresetAnswerPacket } from "./types";

export const homepagePresetQuestions = [...questionGroups[0].questions];

export function buildHomepagePresetAnswers(): PresetAnswerPacket[] {
  return homepagePresetQuestions.map((question) => {
    const contract = findQuestionContract(question);
    if (!contract) throw new Error(`Homepage preset question has no contract: ${question}`);

    const frame = frameFromContract(contract);
    const items = retrieveKnowledge(question, { history: [], limit: 4, frame });
    const stableAnswer = matchStableAnswer(question, [], frame);
    const claimIds = stableAnswer
      ? [...stableAnswer.requiredClaimIds]
      : [...new Set(items.flatMap((item) => item.claimIds))];
    const sourceIds = stableAnswer
      ? [...stableAnswer.requiredSourceIds]
      : [...new Set(items.flatMap((item) => item.sourceIds))];
    const plan = buildAnswerPlan(question, items, stableAnswer, [], frame, contract);
    const claims = getClaims(claimIds);
    const citations = buildAnswerCitations(plan.fallbackAnswer, claims);
    const quality = validateAnswer(plan.fallbackAnswer, plan);

    if (!quality.passed) {
      throw new Error(`Homepage preset answer failed quality gate (${contract.id}): ${quality.triggers.join(", ")}`);
    }
    if (!validateAnswerCitations(citations, claims)) {
      throw new Error(`Homepage preset answer has invalid citations: ${contract.id}`);
    }

    return {
      contractId: contract.id,
      question,
      content: plan.fallbackAnswer,
      mode: "stable",
      responseStatus: "completed",
      claimIds,
      sourceIds,
      citations,
      sources: getSources(sourceIds),
      followUpQuestions: plan.followUpQuestions,
    };
  });
}
