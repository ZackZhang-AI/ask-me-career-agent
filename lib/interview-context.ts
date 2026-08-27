import type {
  AnswerBrief,
  AnswerDetailLevel,
  AnswerIntent,
  ChatMessage,
  InterviewConversationContext,
  KnowledgeItem,
  QuestionFacet,
  QuestionFrame,
  StarStory,
} from "./types";

function normalize(value: string) {
  return value.toLowerCase().replace(/\*\*|[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function meaningfulTerms(value: string) {
  return [...new Set(value.match(/[a-zA-Z][a-zA-Z-]{2,}|[\u4e00-\u9fa5]{2,6}/g) ?? [])]
    .map((term) => normalize(term))
    .filter((term) => term.length >= 2 && !/^(这个|项目|能力|产品|回答|可以|我的|进行|一个|通过|当前)$/.test(term));
}

function textCovers(reference: string, candidate: string) {
  const normalizedReference = normalize(reference);
  const normalizedCandidate = normalize(candidate);
  if (normalizedReference.length >= 8 && normalizedCandidate.includes(normalizedReference)) return true;
  const terms = meaningfulTerms(reference);
  return terms.length > 0 && terms.filter((term) => normalizedCandidate.includes(term)).length >= Math.min(2, terms.length);
}

const facetPatterns: Array<[QuestionFacet, RegExp]> = [
  ["contribution", /负责|贡献|你做了什么|本人做/],
  ["result", /结果|效果|数据|上线|完成情况/],
  ["method", /怎么|如何|方法|取舍|思路/],
  ["evaluation", /评测|指标|Bad\s*Case|验证/i],
  ["collaboration", /协作|合作|沟通|团队/],
  ["transfer", /迁移|帮助|价值|支持/],
  ["boundary", /边界|不足|限制|风险|短板/],
  ["fit", /匹配|适合|胜任|岗位/],
  ["problem", /问题|痛点|为什么做/],
];

function inferFacet(question: string): QuestionFacet {
  return facetPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? "overview";
}

export function buildInterviewConversationContext(input: {
  history: ChatMessage[];
  frame: QuestionFrame;
  items: KnowledgeItem[];
  stories: StarStory[];
}): InterviewConversationContext {
  const recentAnswers = input.history.filter((message) => message.role === "assistant").slice(-6).map((message) => message.content);
  const answerText = recentAnswers.join("\n");
  const askedDimensions = [...new Set(input.history
    .filter((message) => message.role === "user")
    .map((message) => inferFacet(message.content)))];
  const usedKnowledgeIds = input.items
    .filter((item) => textCovers(item.title, answerText) || textCovers(item.content, answerText))
    .map((item) => item.id);
  const usedStoryIds = input.stories
    .filter((story) => textCovers(story.action, answerText) || textCovers(story.result, answerText))
    .map((story) => story.id);
  const userTurns = input.history.filter((message) => message.role === "user").length;
  const activeProject = input.frame.activeProject
    ?? input.items.find((item) => item.relatedProject && input.history.slice(-4).some((message) => textCovers(item.title, message.content)))?.relatedProject
    ?? input.items.find((item) => item.relatedProject)?.relatedProject;
  const relatedTurns = activeProject
    ? input.history.filter((message) => normalize(message.content).includes(normalize(activeProject))).length
    : 0;
  const depth = userTurns >= 3 || relatedTurns >= 3 ? "deep_dive" : userTurns > 0 ? "follow_up" : "overview";

  return { activeProject, targetRole: input.frame.targetRole, depth, askedDimensions, usedKnowledgeIds, usedStoryIds };
}

export function buildAnswerBrief(input: {
  intent: AnswerIntent;
  frame: QuestionFrame;
  context: InterviewConversationContext;
  items: KnowledgeItem[];
  thesis: string;
  requiredDimensions: string[];
  newInformationGoal: string[];
  forbiddenClaims: string[];
  closingPurpose: string;
  detailLevel: AnswerDetailLevel;
}): AnswerBrief {
  const focus = input.frame.focusTerms.map(normalize);
  const ranked = input.items.map((item, index) => ({
    item,
    score: (input.context.usedKnowledgeIds.includes(item.id) ? 0 : 4)
      + (item.relatedProject && item.relatedProject === input.context.activeProject ? 3 : 0)
      + focus.filter((term) => normalize(`${item.title}${item.content}`).includes(term)).length
      + Math.max(0, 3 - index),
  })).sort((left, right) => right.score - left.score);
  const primary = ranked[0]?.item;
  const supportingLimit = input.detailLevel === "deep" ? 2 : input.detailLevel === "standard" ? 1 : 0;
  const supporting: KnowledgeItem[] = [];
  for (const { item } of ranked) {
    if (supporting.length >= supportingLimit) break;
    if (item.id === primary?.id) continue;
    const duplicatesExisting = [primary, ...supporting].some((selected) => selected
      && selected.relatedProject
      && item.relatedProject === selected.relatedProject
      && item.title === selected.title);
    if (!duplicatesExisting) supporting.push(item);
  }

  return {
    directThesis: input.thesis,
    requiredDimensions: input.requiredDimensions.slice(0, 4),
    primaryEvidenceId: primary?.id,
    supportingEvidenceIds: supporting.map((item) => item.id),
    newInformationGoal: input.newInformationGoal.slice(0, 3),
    forbiddenClaims: input.forbiddenClaims,
    closingPurpose: input.closingPurpose,
  };
}
