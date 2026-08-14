import type { AnswerCitation, Claim } from "./types";

const STOP_WORDS = new Set([
  "一个", "一种", "这个", "这些", "通过", "可以", "能够", "我的", "其中", "相关", "进行", "以及", "同时", "目前", "主要",
]);

export function answerParagraphs(answer: string) {
  return answer.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function terms(value: string) {
  const normalized = value
    .replace(/\*\*|[#>`]/g, "")
    .toLowerCase();
  const english = normalized.match(/[a-z][a-z0-9.+-]{1,}/g) ?? [];
  const chinese = normalized.replace(/[^\u4e00-\u9fa5]/g, "");
  const bigrams = Array.from({ length: Math.max(0, chinese.length - 1) }, (_, index) => chinese.slice(index, index + 2));
  return new Set([...english, ...bigrams].filter((term) => !STOP_WORDS.has(term)));
}

function overlapScore(paragraph: string, claim: Claim) {
  const paragraphTerms = terms(paragraph);
  const claimTerms = terms([
    claim.statement,
    claim.candidateContribution,
    claim.aiAssistance,
  ].join(" "));
  if (!paragraphTerms.size || !claimTerms.size) return 0;
  const matches = [...paragraphTerms].filter((term) => claimTerms.has(term)).length;
  return matches / Math.min(paragraphTerms.size, claimTerms.size);
}

export function buildAnswerCitations(answer: string, claims: Claim[]): AnswerCitation[] {
  if (!claims.length) return [];

  return answerParagraphs(answer).flatMap((paragraph, paragraphIndex) => {
    const ranked = claims
      .map((claim) => ({ claim, score: overlapScore(paragraph, claim) }))
      .filter(({ score }) => score >= 0.12)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
      .map(({ claim }) => claim);
    if (!ranked.length) return [];
    return [{
      paragraphIndex,
      claimIds: ranked.map((claim) => claim.id),
      sourceIds: [...new Set(ranked.flatMap((claim) => claim.sourceIds))],
    }];
  });
}

export function validateAnswerCitations(citations: AnswerCitation[], claims: Claim[]) {
  const allowedClaims = new Map(claims.map((claim) => [claim.id, claim]));
  return citations.every((citation) => citation.claimIds.length > 0
    && citation.claimIds.every((id) => allowedClaims.has(id))
    && citation.sourceIds.every((sourceId) => citation.claimIds.some((claimId) => allowedClaims.get(claimId)?.sourceIds.includes(sourceId))));
}
