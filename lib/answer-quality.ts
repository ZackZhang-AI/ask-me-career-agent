import type { AnswerPlan } from "./types";

const BOILERPLATE = [
  "好的，我来讲一下",
  "好的，我讲一个",
  "核心判断是",
  "候选人材料称",
  "公开证据显示",
  "需要面试核实",
  "证据边界",
  "Claim ID",
  "Source ID",
  "这个问题更值得看我的判断方法",
  "进一步判断",
  "实践依据",
  "落地方式",
];

const RAW_FIELD_PHRASES = [
  "我提供并确认任职时间与职责描述",
  "我提供并授权公开",
  "候选人维护",
  "公开职责描述涉及",
];

const TOPIC_TERMS: Partial<Record<AnswerPlan["topic"], string[]>> = {
  rag: ["RAG", "Dense Retrieval", "Rerank", "Milvus", "向量检索"],
  deepflow: ["DeepFlow", "Coordinator", "Planner", "Researcher", "Reporter"],
  audit: ["审计", "德勤", "容诚", "底稿", "函证", "盘点"],
  local_tools: ["Thirty-Minute Brain", "Read-Later Regret", "Downloads Butler"],
  statistics: ["应用统计学", "统计学背景"],
};

const RISKY_CLAIMS = [
  "校园数据门户",
  "满意度",
  "贡献点",
  "跳出率",
  "转化率",
  "准确率提升",
  "效率提升",
  "节省了",
  "用户访谈",
  "用户调研",
  "真实用户反馈",
  "生产环境",
  "生产上线",
  "正式上线",
  "大规模上线",
  "商业化",
  "百度",
];

const KNOWN_ORGANIZATIONS = ["东北大学", "德勤", "容诚", "ACCA", "百度"];

const NUMBER_PATTERN = /\d+(?:\.\d+)?(?:%|％|万|亿|倍|个|人|次|天|小时|分钟|条|项|分)?/g;
const EVENT_SIGNAL = /(?:我|本人).{0,12}(?:负责|主导|参与|完成|推动|组织|协调|交付|上线|服务|访谈|调研|获得|实现|搭建|开发|经历|遇到|发现|验证过|尝试过)|(?:已|已经).{0,12}(?:上线|交付|落地|服务|完成)|(?:用户|客户).{0,12}(?:反馈|认可|满意|使用)|(?:提升|降低|增长|节省|改善)/;
const ORGANIZATION_PATTERN = /[\u4e00-\u9fa5A-Za-z·-]{2,24}(?:大学|公司|集团|银行|事务所|研究院|团队)/g;
const DOMAIN_TERMS = [
  "AI 产品", "数据", "评测", "统计", "业务", "审计", "风险", "产品", "工程", "原型", "RAG", "DeepFlow",
  "Dense Retrieval", "Rerank", "RAGAS", "Bad Case", "检索", "引用", "工作流", "Agent", "MVP", "人工确认",
  "SQL", "Python", "FastAPI", "Milvus", "需求", "取舍", "验收", "贡献", "用户", "结果", "岗位价值",
];

function normalizedNumbers(value: string) {
  const withoutListMarkers = value.replace(/^\s*\d{1,2}[.)、]\s*/gm, "");
  return new Set((withoutListMarkers.match(NUMBER_PATTERN) ?? []).map((item) => item.replace(/％/g, "%")));
}

function containsAllowedPhrase(phrase: string, allowedText: string) {
  return allowedText.includes(phrase);
}

function normalizedGroundingText(value: string) {
  return value
    .toLowerCase()
    .replace(/\*\*|[#>`]/g, "")
    .replace(/候选人|具体来说|这也是|我的|本人|其中|通过|能够|可以|相关|当前/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function bigrams(value: string) {
  const normalized = normalizedGroundingText(value);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
  return result;
}

function trigrams(value: string) {
  const normalized = normalizedGroundingText(value);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 2; index += 1) result.add(normalized.slice(index, index + 3));
  return result;
}

export function answerSimilarity(left: string, right: string) {
  const leftGrams = trigrams(left);
  const rightGrams = trigrams(right);
  if (!leftGrams.size || !rightGrams.size) return 0;
  const intersection = [...leftGrams].filter((item) => rightGrams.has(item)).length;
  return intersection / Math.min(leftGrams.size, rightGrams.size);
}

function closingSentence(value: string) {
  return normalizeSentence(value.split(/[。！？\n]+/).filter((item) => item.trim()).at(-1) ?? "");
}

function normalizeSentence(value: string) {
  return normalizedGroundingText(value).slice(0, 80);
}

function groundingScore(statement: string, allowedText: string) {
  const statementBigrams = bigrams(statement);
  if (!statementBigrams.size) return 0;
  const allowedBigrams = bigrams(allowedText);
  const matches = [...statementBigrams].filter((item) => allowedBigrams.has(item)).length;
  return matches / statementBigrams.size;
}

function semanticallyCovered(required: string, candidate: string) {
  const normalizedRequired = normalizedGroundingText(required);
  const normalizedCandidate = normalizedGroundingText(candidate);
  if (normalizedRequired && normalizedCandidate.includes(normalizedRequired)) return true;
  const terms = DOMAIN_TERMS.filter((term) => required.toLowerCase().includes(term.toLowerCase()));
  if (terms.length) {
    const hits = terms.filter((term) => candidate.toLowerCase().includes(term.toLowerCase())).length;
    if (hits >= Math.min(2, terms.length)) return true;
  }
  return groundingScore(required, candidate) >= 0.28;
}

export interface QualityGateResult {
  passed: boolean;
  triggers: string[];
}

export function validateAnswer(candidate: string, plan: AnswerPlan): QualityGateResult {
  const triggers: string[] = [];
  const clean = candidate.trim();
  const allowedText = [
    ...plan.allowedFacts,
    ...plan.allowedOrganizations,
    ...plan.allowedProjectStatuses,
    plan.limitations ?? "",
  ].join("\n");
  const allowedNumbers = normalizedNumbers(allowedText);

  if (clean.length < plan.targetLength.min) triggers.push("answer_too_short");
  if (clean.length > plan.targetLength.max) triggers.push("answer_too_long");
  const emphasized = [...clean.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1].trim());
  if (emphasized.length > 3) triggers.push("excessive_emphasis");
  if (emphasized.some((text) => text.length > 32 || /[。！？；：]/.test(text))) triggers.push("long_emphasis");
  const paragraphs = clean.split(/\n\s*\n/).filter((item) => item.trim()).length;
  if (["project_arc", "contribution", "star"].includes(plan.responseShape) && paragraphs < 3) triggers.push("weak_structure");
  if (/(?:^|[，。！？；\s])他(?:的|是|能|在|具备|适合|做|有)/.test(clean)) triggers.push("third_person_voice");

  const currentClosing = closingSentence(clean);
  for (const previous of plan.recentAnswers) {
    if (clean.length >= 120 && previous.length >= 120 && answerSimilarity(clean, previous) >= 0.62) triggers.push("repetitive_answer");
    if (currentClosing.length >= 12 && currentClosing === closingSentence(previous)) triggers.push("repeated_closing");
    const currentLabels = [...clean.matchAll(/\*\*([^*]+)\*\*\s*[：:]/g)].map((match) => match[1]).join("|");
    const previousLabels = [...previous.matchAll(/\*\*([^*]+)\*\*\s*[：:]/g)].map((match) => match[1]).join("|");
    if (currentLabels && currentLabels === previousLabels) triggers.push("repeated_label_sequence");
  }

  const firstParagraph = clean.split(/\n\s*\n/)[0] ?? clean;
  if (plan.directAnswerTerms.length && !plan.directAnswerTerms.some((term) => firstParagraph.toLowerCase().includes(term.toLowerCase()))) {
    triggers.push("indirect_opening");
  }

  plan.mustInclude.forEach((required, index) => {
    if (!semanticallyCovered(required, clean)) triggers.push(`missing_required:${index + 1}`);
  });

  for (const phrase of BOILERPLATE) {
    if (clean.includes(phrase)) triggers.push(`boilerplate:${phrase}`);
  }

  for (const phrase of RAW_FIELD_PHRASES) {
    if (clean.includes(phrase)) triggers.push(`raw_field:${phrase}`);
  }

  for (const topic of plan.forbiddenTopics) {
    const leaked = (TOPIC_TERMS[topic] ?? []).find((term) => clean.toLowerCase().includes(term.toLowerCase()));
    if (leaked) triggers.push(`forbidden_topic:${topic}`);
  }

  for (const detail of plan.forbiddenDetails) {
    if (detail && clean.includes(detail)) triggers.push(`forbidden:${detail}`);
  }

  for (const phrase of RISKY_CLAIMS) {
    if (clean.includes(phrase) && !containsAllowedPhrase(phrase, allowedText)) triggers.push(`unsupported_claim:${phrase}`);
  }

  for (const organization of KNOWN_ORGANIZATIONS) {
    if (clean.includes(organization) && !containsAllowedPhrase(organization, allowedText)) triggers.push(`unsupported_organization:${organization}`);
  }

  for (const organization of clean.match(ORGANIZATION_PATTERN) ?? []) {
    if (!containsAllowedPhrase(organization, allowedText)) triggers.push("unsupported_organization");
  }

  for (const sentence of clean.split(/[。！？\n]+/).map((item) => item.trim()).filter(Boolean)) {
    if (EVENT_SIGNAL.test(sentence) && groundingScore(sentence, allowedText) < 0.3) triggers.push("unsupported_event");
  }

  if (/(?:去年|前年|今年|上个月|近期)/.test(clean) && !/(?:去年|前年|今年|上个月|近期)/.test(allowedText)) {
    triggers.push("unsupported_relative_date");
  }

  for (const number of normalizedNumbers(clean)) {
    if (!allowedNumbers.has(number)) triggers.push("unsupported_number");
  }

  if (!plan.shouldMentionLimitations && /需要补充的是|需要说明的是|证据不足|待核实|尚未独立验证/.test(clean)) {
    triggers.push("unrequested_limitation");
  }

  return { passed: triggers.length === 0, triggers: [...new Set(triggers)] };
}

export function repairInstruction(plan: AnswerPlan, triggers: string[]) {
  return `上一版回答没有通过质量检查，请重新作答。\n
失败原因：${triggers.join("；")}\n
必须遵守：\n
1. 只能使用下方“允许事实”，不得补充合理猜测、过程细节、数字、用户反馈或完成状态。\n
2. 使用 ${plan.responseShape} 结构，控制在 ${plan.targetLength.min}–${plan.targetLength.max} 个中文字符；使用 1–3 个、不超过 12 字的加粗短词组突出个人贡献、关键取舍、核心结果或岗位价值。不要加粗完整句子，也不要强制套三段模板。\n
3. 不使用寒暄、Claim/Source、证据边界、核实提醒或免责声明。\n
4. 第一段直接回答 ${plan.facet} 维度，并自然包含以下关键词之一：${plan.directAnswerTerms.join("、") || "当前问题关键词"}。始终使用第一人称；本轮必须带来新信息：${plan.newInformationGoal.join("；")}\n
5. 避免重复：${plan.avoidPoints.join("；") || "无"}；结尾任务：${plan.closingPurpose}\n
6. 必答点：${plan.mustInclude.join("；")}\n
7. 允许事实：${plan.allowedFacts.join("；")}\n
8. 禁止内容：${plan.forbiddenDetails.join("；") || "任何未提供的事实"}；禁止混入主题：${plan.forbiddenTopics.join("、") || "无"}`;
}
