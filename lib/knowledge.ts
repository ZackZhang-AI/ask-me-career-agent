import { contentCatalog } from "./content.ts";
import { normalizeSearchText, rankKnowledge } from "./retrieval.ts";
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
const implicitFollowupPattern = /你(?:本人)?做了什么|你负责什么|具体做了什么|你的贡献|遇到(?:什么)?(?:挑战|困难)|有什么结果|现在怎么样/;

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

function isStableAnswerRetrievable(item: StableAnswer) {
  if (!isPublicActive(item)) return false;
  const claimIds = [...item.claimIds, ...item.requiredClaimIds];
  const sourceIds = [...item.sourceIds, ...item.requiredSourceIds];
  return claimIds.every((id) => {
    const claim = claimById.get(id);
    return claim ? isPublicActive(claim) : false;
  }) && sourceIds.every((id) => {
    const source = sourceById.get(id);
    return source ? isPublicActive(source) && source.public : false;
  });
}

export interface RetrievalOptions {
  history?: ChatMessage[];
  limit?: number;
}

export function resolveRetrievalQuery(question: string, history: ChatMessage[] = []) {
  const recentContext = (referencePattern.test(question) || implicitFollowupPattern.test(question))
    ? history.slice(-4).map((message) => message.content.slice(0, 300)).join(" ")
    : "";
  const base = `${question} ${recentContext}`;
  const normalized = normalizeSearchText(base);
  const matchedProjects = Object.entries(contentCatalog.aliases)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeSearchText(alias))))
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

  const ranked = rankKnowledge({
    query: resolved.text,
    candidates: knowledge.filter(isRetrievable),
    matchedProjects: resolved.matchedProjects,
    limit: resolved.matchedProjects.length > 1 ? 8 : limit,
  }).map(({ item }) => item);
  if (resolved.matchedProjects.length < 2) return ranked.slice(0, limit);
  const projectRepresentatives = resolved.matchedProjects
    .map((project) => ranked.find((item) => item.relatedProject === project))
    .filter((item): item is KnowledgeItem => Boolean(item));
  return [...new Map([...projectRepresentatives, ...ranked].map((item) => [item.id, item])).values()].slice(0, limit);
}

export function matchStableAnswer(question: string, history: ChatMessage[] = []) {
  const normalizedQuestion = normalizeSearchText(question);
  const resolved = resolveRetrievalQuery(question, history);
  const usesReference = referencePattern.test(question) || implicitFollowupPattern.test(question);
  if (resolved.matchedProjects.length > 1) return undefined;
  const ranked = stableAnswers
    .filter(isStableAnswerRetrievable)
    .map((item) => {
      if (usesReference && item.relatedProject && !resolved.matchedProjects.includes(item.relatedProject)) return { item, score: 0 };
      const exact = normalizeSearchText(item.question) === normalizedQuestion ? 100 : 0;
      const keywordScore = item.matchKeywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeSearchText(keyword);
        return score + (normalizedQuestion.includes(normalizedKeyword) ? Math.max(4, normalizedKeyword.length * 2) : 0);
      }, 0);
      const projectScore = item.relatedProject && resolved.matchedProjects.includes(item.relatedProject) ? 20 : 0;
      return { item, score: exact + keywordScore + projectScore, hasAnswerMatch: exact > 0 || keywordScore >= 4 };
    })
    .filter(({ hasAnswerMatch }) => hasAnswerMatch)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
  return ranked[0]?.item;
}

export function getSources(ids: string[]) {
  return sources.filter((source) => ids.includes(source.id) && source.public && isPublicActive(source));
}

export function getClaims(ids: string[]) {
  return claims.filter((claim) => ids.includes(claim.id) && isPublicActive(claim));
}

export function getRelatedStarStories(items: KnowledgeItem[], limit = 2) {
  const projects = new Set(items.map((item) => item.relatedProject).filter(Boolean));
  const claimIds = new Set(items.flatMap((item) => item.claimIds));
  return starStories
    .filter(isPublicActive)
    .map((story) => ({
      story,
      score: (story.relatedProject && projects.has(story.relatedProject) ? 20 : 0)
        + story.claimIds.filter((id) => claimIds.has(id)).length * 4,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.story.id.localeCompare(right.story.id))
    .slice(0, Math.max(1, Math.min(limit, 4)))
    .map(({ story }) => story);
}

export function serializeKnowledgeItems(items: KnowledgeItem[]) {
  return items.map((item) => {
    const serialized = { ...item };
    delete serialized.provenance;
    return serialized;
  });
}
