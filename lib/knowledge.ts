import { contentCatalog } from "./content.ts";
import { buildLocalQuestionFrame, findQuestionContract, frameFromContract } from "./question-contracts.ts";
import { normalizeSearchText, rankKnowledge } from "./retrieval.ts";
import type { ChatMessage, Claim, FAQ, KnowledgeItem, QuestionFrame, Source, StableAnswer, StarStory } from "./types.ts";

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
const referencePattern = /(这个|该项目|其中|它|上述|前者|后者|那个项目|(?:这套|这种|这些)(?:系统|方法|思路|做法|实践|能力|项目|经验))/;
const implicitFollowupPattern = /你(?:本人)?做了什么|你负责什么|具体做了什么|你的贡献|遇到(?:什么)?(?:挑战|困难)|有什么结果|现在怎么样/;
const followupPrefixes = ["如果", "要是", "那", "那么", "继续", "进一步"];
const followupCues = ["下一步", "没有改善", "没改善", "优先排查", "先看什么", "接下来怎么", "为什么没有"];

function usesRecentContext(question: string, history: ChatMessage[]) {
  if (history.length === 0) return false;
  const normalized = normalizeSearchText(question);
  const hasFollowupCue = followupPrefixes.some((prefix) => normalized.startsWith(prefix))
    || followupCues.some((cue) => normalized.includes(cue));
  return referencePattern.test(normalized) || implicitFollowupPattern.test(normalized) || hasFollowupCue;
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
  frame?: QuestionFrame;
}

export function resolveRetrievalQuery(question: string, history: ChatMessage[] = []) {
  const contextApplied = usesRecentContext(question, history);
  const recentContext = contextApplied
    ? history.slice(-8).map((message) => message.content.slice(0, 300)).join(" ")
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
    contextApplied,
  };
}

export function retrieveKnowledge(question: string, limit?: number): KnowledgeItem[];
export function retrieveKnowledge(question: string, options?: RetrievalOptions): KnowledgeItem[];
export function retrieveKnowledge(question: string, limitOrOptions: number | RetrievalOptions = 4) {
  const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const resolved = resolveRetrievalQuery(question, options.history);
  const limit = Math.max(1, Math.min(options.limit ?? 4, 8));
  const frame = options.frame ?? (() => {
    const contract = findQuestionContract(question);
    if (contract) return frameFromContract(contract);
    const local = buildLocalQuestionFrame(question, options.history);
    return local.topic === "unknown" ? undefined : local;
  })();
  const retrievable = knowledge.filter(isRetrievable);

  if (frame?.routeSource === "contract" && frame.requiredKnowledgeIds.length) {
    const byId = new Map(retrievable.map((item) => [item.id, item]));
    return frame.requiredKnowledgeIds
      .map((id) => byId.get(id))
      .filter((item): item is KnowledgeItem => Boolean(item))
      .slice(0, limit);
  }

  const frameProjects = frame?.activeProject ? [frame.activeProject] : [];
  const matchedProjects = frameProjects.length ? frameProjects : resolved.matchedProjects;
  const candidates = frame?.requiredKnowledgeIds.length
    ? retrievable.filter((item) => frame.requiredKnowledgeIds.includes(item.id))
    : matchedProjects.length
      ? retrievable.filter((item) => item.relatedProject && matchedProjects.includes(item.relatedProject))
      : retrievable;

  const ranked = rankKnowledge({
    query: resolved.text,
    candidates,
    matchedProjects,
    limit: matchedProjects.length > 1 ? 8 : limit,
  }).map(({ item }) => item);
  if (matchedProjects.length <= 1) return ranked.slice(0, limit);
  const projectRepresentatives = matchedProjects
    .map((project) => ranked.find((item) => item.relatedProject === project))
    .filter((item): item is KnowledgeItem => Boolean(item));
  return [...new Map([...projectRepresentatives, ...ranked].map((item) => [item.id, item])).values()].slice(0, limit);
}

export function matchStableAnswer(question: string, history: ChatMessage[] = [], frame?: QuestionFrame) {
  const normalizedQuestion = normalizeSearchText(question);
  const resolved = resolveRetrievalQuery(question, history);
  const usesReference = usesRecentContext(question, history);
  const asksForOutcomeEvidence = /用户测试|满意度|用户规模|真实用户|增长|留存|生产状态|商业化|结果数据/.test(question);
  if (resolved.matchedProjects.length > 1) return undefined;
  const ranked = stableAnswers
    .filter(isStableAnswerRetrievable)
    .map((item) => {
      if (frame?.activeProject && item.relatedProject !== frame.activeProject) return { item, score: 0, hasAnswerMatch: false };
      if (usesReference && item.relatedProject && !resolved.matchedProjects.includes(item.relatedProject)) return { item, score: 0 };
      const exact = normalizeSearchText(item.question) === normalizedQuestion ? 100 : 0;
      const keywordScore = item.matchKeywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeSearchText(keyword);
        return score + (normalizedQuestion.includes(normalizedKeyword) ? Math.max(4, normalizedKeyword.length * 2) : 0);
      }, 0);
      const projectScore = item.relatedProject && resolved.matchedProjects.includes(item.relatedProject) ? 20 : 0;
      const outcomeEvidenceScore = item.id === "A19" && asksForOutcomeEvidence ? 80 : 0;
      return { item, score: exact + keywordScore + projectScore + outcomeEvidenceScore, hasAnswerMatch: exact > 0 || keywordScore >= 4 || outcomeEvidenceScore > 0 };
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

export function getStarStoriesByIds(ids: readonly string[]) {
  const wanted = new Set(ids);
  return starStories.filter((story) => wanted.has(story.id) && isPublicActive(story));
}

export function serializeKnowledgeItems(items: KnowledgeItem[]) {
  return items.map((item) => {
    const serialized = { ...item };
    delete serialized.provenance;
    return serialized;
  });
}
