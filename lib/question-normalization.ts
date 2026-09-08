const INVISIBLE_OR_CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;
const MATCH_PUNCTUATION = /[\s，。！？、：；,.!?:;（）()\[\]【】{}<>《》“”‘’"'`·…—–_\-/\\]/g;

/**
 * Normalizes copied interview questions for exact semantic-contract matching.
 * It removes presentation-only characters while preserving words, negation,
 * numbers, project names and business qualifiers.
 */
export function normalizeInterviewQuestion(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(INVISIBLE_OR_CONTROL, "")
    .replace(/张倬玮/g, "候选人")
    .replace(/你的|他的/g, "候选人的")
    .replace(/你|他/g, "候选人")
    .replace(MATCH_PUNCTUATION, "");
}
