import type { KnowledgeItem } from "./types.ts";

const genericTerms = new Set([
  "他的", "什么", "哪些", "怎么", "如何", "介绍", "一下", "这个", "那个",
  "项目", "能力", "公开", "相关", "可以", "是否", "以及", "还有", "情况",
  "请问", "详细", "说明", "候选", "候选人",
]);

const queryExpansions: Array<[RegExp, string[]]> = [
  [/做了什么|负责什么|贡献|参与/, ["负责", "贡献", "职责", "本人"]],
  [/怎么做|如何实现|方案|架构|流程/, ["设计", "实现", "工作流", "检索"]],
  [/优点|优势|适合|匹配/, ["优势", "匹配", "岗位"]],
  [/缺点|短板|不足|风险/, ["短板", "不足", "边界", "缺口"]],
  [/技术栈|会什么|技能/, ["技能", "技术", "工具"]],
  [/证据|真假|可信|靠谱|验证/, ["证据", "验证", "来源", "核实"]],
  [/经历|任职/, ["实习", "职责", "背景"]],
];

export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、：；,.!?:;（）()\-_]/g, "");
}

function terms(value: string) {
  const normalized = value.toLowerCase();
  const result = new Set<string>();

  for (const token of normalized.match(/[a-z0-9][a-z0-9.+#-]*/g) ?? []) {
    if (token.length >= 2) result.add(token);
  }

  for (const sequence of normalized.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (sequence.length <= 6 && !genericTerms.has(sequence)) result.add(sequence);
    for (const size of [2, 3]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        const token = sequence.slice(index, index + size);
        if (!genericTerms.has(token)) result.add(token);
      }
    }
  }

  return result;
}

function expandedQuery(value: string) {
  const additions = queryExpansions
    .filter(([pattern]) => pattern.test(value))
    .flatMap(([, expansion]) => expansion);
  return `${value} ${additions.join(" ")}`;
}

function fieldTerms(item: KnowledgeItem) {
  return {
    title: terms(item.title),
    keywords: terms(item.keywords.join(" ")),
    content: terms(item.content),
    contribution: terms(`${item.candidateContribution} ${item.aiAssistance}`),
    limitations: terms(item.limitations),
  };
}

export interface RankedKnowledge {
  item: KnowledgeItem;
  score: number;
  matchedTerms: string[];
}

export function rankKnowledge(input: {
  query: string;
  candidates: KnowledgeItem[];
  matchedProjects: string[];
  limit: number;
}): RankedKnowledge[] {
  const normalizedQuery = normalizeSearchText(input.query);
  const queryTerms = terms(expandedQuery(input.query));
  const indexed = input.candidates.map((item) => ({ item, fields: fieldTerms(item) }));
  const documentTerms = indexed.map(({ fields }) => new Set(Object.values(fields).flatMap((field) => [...field])));

  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(term, documentTerms.filter((tokens) => tokens.has(term)).length);
  }

  const ranked = indexed
    .map(({ item, fields }) => {
      let score = 0;
      let hasStrongPhrase = false;
      const matchedTerms: string[] = [];

      for (const term of queryTerms) {
        const frequency = documentFrequency.get(term) ?? 0;
        const inverseFrequency = Math.log(1 + (input.candidates.length + 1) / (frequency + 1));
        const fieldWeight = fields.keywords.has(term) ? 5
          : fields.title.has(term) ? 4
            : fields.content.has(term) ? 2
              : fields.contribution.has(term) ? 1.4
                : fields.limitations.has(term) ? 1
                  : 0;
        if (fieldWeight > 0) {
          score += fieldWeight * inverseFrequency;
          matchedTerms.push(term);
        }
      }

      for (const keyword of item.keywords) {
        const normalizedKeyword = normalizeSearchText(keyword);
        if (normalizedKeyword.length >= 2 && !genericTerms.has(normalizedKeyword) && normalizedQuery.includes(normalizedKeyword)) {
          score += 8 + Math.min(normalizedKeyword.length, 10);
          hasStrongPhrase = true;
        }
      }

      if (normalizedQuery.includes(normalizeSearchText(item.title))) {
        score += 18;
        hasStrongPhrase = true;
      }
      if (item.relatedProject && input.matchedProjects.includes(item.relatedProject)) score += 24;

      return { item, score, matchedTerms: [...new Set(matchedTerms)], hasStrongPhrase };
    })
    .filter(({ score, matchedTerms, item, hasStrongPhrase }) => score >= 5
      && (hasStrongPhrase || matchedTerms.length >= 2 || Boolean(item.relatedProject && input.matchedProjects.includes(item.relatedProject))))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));

  const relativeCutoff = (ranked[0]?.score ?? 0) * 0.45;
  return ranked.filter(({ score }) => score >= relativeCutoff).slice(0, input.limit);
}
