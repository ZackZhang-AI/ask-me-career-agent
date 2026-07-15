import { contentCatalog } from "./content.ts";
import type { ChatMessage, Claim, FAQ, KnowledgeItem, Source, StableAnswer, StarStory } from "./types.ts";

export const strengths = contentCatalog.strengths;
export const sources: Source[] = contentCatalog.sources;
export const claims: Claim[] = contentCatalog.claims;
export const knowledge: KnowledgeItem[] = contentCatalog.knowledge;
export const starStories: StarStory[] = contentCatalog.starStories;
export const faqs: FAQ[] = contentCatalog.faqs;
export const stableAnswers: StableAnswer[] = contentCatalog.stableAnswers;
export const suggestedQuestions = contentCatalog.suggestedQuestions;

const sourceById = new Map(sources.map((source) => [source.id, source]));
const claimById = new Map(claims.map((claim) => [claim.id, claim]));
const referencePattern = /(这个|该项目|其中|它|上述|前者|后者|那个项目|这套系统)/;

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、：；,.!?:;（）()\-_]/g, "");
}

function isPublicActive(item: { visibility: string; status: string; verification: string; projectStatus?: string }) {
  return item.visibility === "public"
    && item.status === "active"
    && item.verification !== "unverified"
    && item.projectStatus !== "archived";
}

function isRetrievable(item: KnowledgeItem) {
  if (!isPublicActive(item)) return false;
  return item.claimIds.every((id) => {
    const claim = claimById.get(id);
    return claim ? isPublicActive(claim) : false;
  }) && item.sourceIds.every((id) => {
    const source = sourceById.get(id);
    return source ? isPublicActive(source) && source.public : false;
  });
}

export interface RetrievalOptions {
  history?: ChatMessage[];
  limit?: number;
}

export function resolveRetrievalQuery(question: string, history: ChatMessage[] = []) {
  const recentContext = referencePattern.test(question)
    ? history.slice(-4).map((message) => message.content.slice(0, 300)).join(" ")
    : "";
  const base = `${question} ${recentContext}`;
  const normalized = normalize(base);
  const matchedProjects = Object.entries(contentCatalog.aliases)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalize(alias))))
    .map(([project]) => project);
  return {
    text: base.trim(),
    normalized,
    matchedProjects,
  };
}

export function retrieveKnowledge(question: string, limit?: number): KnowledgeItem[];
export function retrieveKnowledge(question: string, options?: RetrievalOptions): KnowledgeItem[];
export function retrieveKnowledge(question: string, limitOrOptions: number | RetrievalOptions = 4) {
  const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const resolved = resolveRetrievalQuery(question, options.history);
  const limit = Math.max(1, Math.min(options.limit ?? 4, 8));

  return knowledge
    .filter(isRetrievable)
    .map((item) => {
      const keywordScore = item.keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalize(keyword);
        return score + (resolved.normalized.includes(normalizedKeyword) ? Math.max(3, normalizedKeyword.length * 2) : 0);
      }, 0);
      const titleScore = resolved.normalized.includes(normalize(item.title)) ? 12 : 0;
      const projectScore = item.relatedProject && resolved.matchedProjects.includes(item.relatedProject) ? 20 : 0;
      return { item, score: keywordScore + titleScore + projectScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function matchStableAnswer(question: string, history: ChatMessage[] = []) {
  const normalizedQuestion = normalize(question);
  const resolved = resolveRetrievalQuery(question, history);
  const usesReference = referencePattern.test(question);
  const ranked = stableAnswers
    .filter(isPublicActive)
    .map((item) => {
      if (usesReference && item.relatedProject && !resolved.matchedProjects.includes(item.relatedProject)) return { item, score: 0 };
      const exact = normalize(item.question) === normalizedQuestion ? 100 : 0;
      const keywordScore = item.matchKeywords.reduce((score, keyword) => {
        const normalizedKeyword = normalize(keyword);
        return score + (normalizedQuestion.includes(normalizedKeyword) ? Math.max(4, normalizedKeyword.length * 2) : 0);
      }, 0);
      const projectScore = item.relatedProject && resolved.matchedProjects.includes(item.relatedProject) ? 20 : 0;
      return { item, score: exact + keywordScore + projectScore };
    })
    .filter(({ score }) => score >= 4)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
  return ranked[0]?.item;
}

export function getSources(ids: string[]) {
  return sources.filter((source) => ids.includes(source.id) && source.public && isPublicActive(source));
}

export function getClaims(ids: string[]) {
  return claims.filter((claim) => ids.includes(claim.id) && isPublicActive(claim));
}
