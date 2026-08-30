import type { AnswerPlan } from "./types";
import { extractAnswerEmphasis, isHighSignalEmphasis } from "./answer-format";

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

function forbiddenTopicLeak(topic: AnswerPlan["topic"], candidate: string, allowedText: string) {
  const terms = TOPIC_TERMS[topic] ?? [];
  const allowedLower = allowedText.toLowerCase();
  if (terms.some((term) => allowedLower.includes(term.toLowerCase()))) return undefined;
  const candidateLower = candidate.toLowerCase();
  return terms.find((term) => candidateLower.includes(term.toLowerCase()));
}

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

const KNOWN_ORGANIZATIONS = ["东北大学", "百川智能", "德勤", "容诚", "ACCA", "百度"];

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

function containsAllowedOrganization(phrase: string, allowedText: string) {
  if (containsAllowedPhrase(phrase, allowedText)) return true;
  const bare = phrase.replace(/^(?:我是|来自|就读于|毕业于|曾在|目前在)/, "");
  return bare !== phrase && containsAllowedPhrase(bare, allowedText);
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

const HARD_SAFETY_TRIGGER_PREFIXES = [
  "unsupported_claim:",
  "unsupported_organization:",
  "unsupported_organization",
  "unsupported_event",
  "unsupported_relative_date",
  "unsupported_number",
  "forbidden:",
  "reasoning_presented_as_fact",
];

export function isHardSafetyTrigger(trigger: string) {
  return HARD_SAFETY_TRIGGER_PREFIXES.some((prefix) => trigger === prefix || trigger.startsWith(prefix));
}

export function splitQualityTriggers(triggers: readonly string[]) {
  return {
    hardSafety: triggers.filter(isHardSafetyTrigger),
    semantic: triggers.filter((trigger) => !isHardSafetyTrigger(trigger)),
  };
}

export function hasHardSafetyTriggers(triggers: readonly string[]) {
  return triggers.some(isHardSafetyTrigger);
}

const ADVISORY_TRIGGERS = new Set([
  "excessive_emphasis",
  "insufficient_emphasis",
  "long_emphasis",
  "low_information_emphasis",
  "weak_structure",
]);

export function hasBlockingQualityTriggers(triggers: readonly string[]) {
  return triggers.some((trigger) => !ADVISORY_TRIGGERS.has(trigger));
}

export function validateAnswer(candidate: string, plan: AnswerPlan): QualityGateResult {
  const triggers: string[] = [];
  const clean = candidate.trim();
  const enforceGenericOrganizationGate = plan.questionMode !== "candidate_reasoning"
    || ["project_arc", "contribution", "star"].includes(plan.responseShape);
  const allowedText = [
    ...plan.allowedFacts,
    ...plan.allowedOrganizations,
    ...plan.allowedProjectStatuses,
    plan.limitations ?? "",
  ].join("\n");
  const allowedNumbers = normalizedNumbers(allowedText);

  // 计划长度只用于组织信息，不把不同问题强行压进同一字数区间。
  const minimumUsableLength = plan.responseShape === "direct" ? 80 : 120;
  if (clean.length < minimumUsableLength) triggers.push("answer_too_short");
  if (clean.length > 900) triggers.push("answer_too_long");
  const emphasized = extractAnswerEmphasis(clean);
  if (emphasized.length > 3) triggers.push("excessive_emphasis");
  if (plan.contractId && clean.length > 240 && emphasized.length < 2) triggers.push("insufficient_emphasis");
  if (emphasized.some((text) => text.length > 32 || /[。！？；：]/.test(text))) triggers.push("long_emphasis");
  if (emphasized.some((text) => !isHighSignalEmphasis(text))) triggers.push("low_information_emphasis");
  const paragraphs = clean.split(/\n\s*\n/).filter((item) => item.trim()).length;
  if (["project_arc", "contribution", "star"].includes(plan.responseShape) && paragraphs < 3) triggers.push("weak_structure");
  if (!plan.contractId && plan.detailLevel === "deep") {
    const coveredDimensions = plan.mustInclude.filter((required) => semanticallyCovered(required, clean)).length;
    const sentences = clean.split(/[。！？!?]+/).filter((item) => item.trim()).length;
    const hasLayeredStructure = paragraphs >= 3 || sentences >= 4;
    if (clean.length < 240 || !hasLayeredStructure || (plan.mustInclude.length >= 2 && coveredDimensions < 2)) {
      triggers.push("insufficient_depth");
    }
  }
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
  if (plan.targetRole && !clean.toLowerCase().includes(plan.targetRole.toLowerCase())) triggers.push("missing_target_role");
  if (plan.questionMode === "agent_meta" && !/(?:可以|能够|回答|帮助|能力|范围|开放问题|面试)/.test(firstParagraph)) {
    triggers.push("intent_mismatch:agent_meta");
  }
  if (plan.questionMode === "candidate_reasoning" && /(?:我曾经|我负责过|我已经上线|真实用户增长|客户营收)/.test(clean)) {
    triggers.push("reasoning_presented_as_fact");
  }
  if (plan.questionMode === "candidate_reasoning" && !plan.contractId && !/(?:我的处理思路|我的做法|我会|我理解|我通常|我倾向|如果.{0,18}我会|面对.{0,18}我会)/.test(firstParagraph)) {
    triggers.push("missing_reasoning_scope");
  }
  if (plan.intent === "role_fit" && !plan.contractId) {
    const fitDimensions = [
      /业务|流程|用户|场景/,
      /数据|指标|评测|样本|Bad\s*Case/i,
      /需求|方案|原型|落地|推进|验收/,
      /学习|协作|沟通|抗压|韧性/,
    ].filter((pattern) => pattern.test(clean)).length;
    if (!/匹配|适合|胜任|契合/.test(firstParagraph)) triggers.push("intent_mismatch:role_fit");
    if (fitDimensions < 2) triggers.push("weak_role_evidence_mapping");
  }
  if (plan.intent === "career_transition" && !plan.contractId) {
    if (!/转|转向|选择|走向/.test(firstParagraph) || !/产品/.test(firstParagraph)) triggers.push("intent_mismatch:career_transition");
    if (!/(?:财会|财务|会计|审计|统计)/.test(clean)) triggers.push("missing_transition_origin");
    if (!/(?:逐步|连续|积累|迁移|收敛|确认)/.test(clean)) triggers.push("missing_transition_continuity");
    if (!/(?:更适合|更擅长|愿意|选择|因为|符合|一致)/.test(clean)) triggers.push("missing_transition_motivation");
  }
  if (!plan.contractId && plan.intent === "behavioral_experience") {
    if (!plan.relatedStoryId) triggers.push("missing_real_story");
    if (!/(?:当时|背景|情境|项目|实习)/.test(clean)) triggers.push("missing_behavior_context");
    if (!/(?:我先|我负责|我推动|我选择|我的行动|具体做法|我把)/.test(clean)) triggers.push("missing_behavior_action");
    if (!/(?:结果|最终|验证|复盘|后来|边界)/.test(clean)) triggers.push("missing_behavior_result_review");
  }
  if (!plan.contractId && plan.intent === "situational_judgment") {
    if (!/(?:目标|约束)/.test(clean)) triggers.push("missing_situation_constraints");
    if (!/(?:取舍|权衡|优先级|比较)/.test(clean)) triggers.push("missing_situation_tradeoff");
    if (!/(?:验证|试点|小范围|指标)/.test(clean)) triggers.push("missing_situation_validation");
  }
  if (!plan.contractId && plan.intent === "product_design") {
    if (!/(?:用户|使用者|人群)/.test(clean)) triggers.push("missing_product_user");
    if (!/(?:痛点|问题|需求)/.test(clean)) triggers.push("missing_product_problem");
    if (!/(?:MVP|最小|首版|核心功能)/i.test(clean)) triggers.push("missing_product_mvp");
    if (!/(?:指标|验证|成功标准)/.test(clean)) triggers.push("missing_product_metric");
    if (!/(?:风险|取舍|迭代)/.test(clean)) triggers.push("missing_product_tradeoff");
  }
  if (!plan.contractId && plan.intent === "business_analysis") {
    if (!/(?:业务目标|增长目标|效率|收入|成本)/.test(clean)) triggers.push("missing_business_goal");
    if (!/(?:用户链路|漏斗|路径|环节)/.test(clean)) triggers.push("missing_business_journey");
    if (!/(?:指标|变量|转化|留存)/.test(clean)) triggers.push("missing_business_metrics");
    if (!/(?:验证|对照|实验|试点)/.test(clean)) triggers.push("missing_business_validation");
  }
  if (!plan.contractId && plan.intent === "estimation") {
    if (!/(?:假设|口径)/.test(clean)) triggers.push("missing_estimation_assumption");
    if (!/(?:分层|拆成|乘以|除以|计算|数量级)/.test(clean)) triggers.push("missing_estimation_calculation");
    if (!/(?:交叉校验|反推|校验|敏感性)/.test(clean)) triggers.push("missing_estimation_check");
  }
  if (!plan.contractId && plan.intent === "industry_view" && !/(?:无法核验|不能核验|不掌握.{0,8}实时|知识时效|基于.{0,8}(?:框架|已知信息))/.test(clean)) {
    triggers.push("missing_freshness_boundary");
  }
  if (plan.intent === "company_motivation" && !plan.targetRole && /(?:贵公司|你们公司|这家公司)/.test(clean) && /领先|优秀|非常认可|行业头部/.test(clean)) {
    triggers.push("generic_company_flattery");
  }

  const enforceRequiredSemantics = Boolean(plan.contractId)
    || plan.evidencePolicy === "required"
    || plan.questionMode !== "candidate_reasoning";
  if (enforceRequiredSemantics) {
    plan.mustInclude.forEach((required, index) => {
      if (!semanticallyCovered(required, clean)) triggers.push(`missing_required:${index + 1}`);
    });
  }

  for (const phrase of BOILERPLATE) {
    if (clean.includes(phrase) && !(phrase === "核心判断是" && plan.questionMode === "candidate_reasoning")) {
      triggers.push(`boilerplate:${phrase}`);
    }
  }

  for (const phrase of RAW_FIELD_PHRASES) {
    if (clean.includes(phrase)) triggers.push(`raw_field:${phrase}`);
  }

  for (const topic of plan.forbiddenTopics) {
    const leaked = forbiddenTopicLeak(topic, clean, allowedText);
    if (leaked) triggers.push(`forbidden_topic:${topic}`);
  }

  for (const detail of plan.forbiddenDetails) {
    if (detail && clean.includes(detail)) triggers.push(`forbidden:${detail}`);
  }

  for (const phrase of RISKY_CLAIMS) {
    if (clean.includes(phrase)
      && !(phrase === "满意度" && plan.questionMode === "candidate_reasoning")
      && !containsAllowedPhrase(phrase, allowedText)) triggers.push(`unsupported_claim:${phrase}`);
  }

  for (const organization of KNOWN_ORGANIZATIONS) {
    if (clean.includes(organization) && !containsAllowedOrganization(organization, allowedText)) triggers.push(`unsupported_organization:${organization}`);
  }

  if (enforceGenericOrganizationGate) {
    for (const organization of clean.match(ORGANIZATION_PATTERN) ?? []) {
      if (!containsAllowedOrganization(organization, allowedText)) triggers.push("unsupported_organization");
    }
  }

  for (const sentence of clean.split(/[。！？\n]+/).map((item) => item.trim()).filter(Boolean)) {
    const explicitPastClaim = /我(?:之前|曾经|曾|实际|以前|过去)[^。！？\n]{0,12}(?:负责|主导|参与|完成|推动|交付|上线|遇到|发现|验证)|我[^。！？\n]{0,8}(?:负责过|主导过|参与过|做过|遇到过|发现过|验证过)/.test(sentence);
    if (EVENT_SIGNAL.test(sentence)
      && groundingScore(sentence, allowedText) < 0.3
      // Supporting-evidence answers are allowed to synthesize the supplied
      // facts in natural language. High-risk fact answers still require an
      // explicitly grounded past-event sentence.
      && explicitPastClaim) {
      triggers.push("unsupported_event");
    }
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

  const uniqueTriggers = [...new Set(triggers)];
  return { passed: !hasBlockingQualityTriggers(uniqueTriggers), triggers: uniqueTriggers };
}

/**
 * Incremental hard-fact gate used before a streamed fragment becomes visible.
 * It intentionally skips whole-answer structure and length checks; those run
 * once the model finishes so short fragments are not rejected prematurely.
 */
export function validateAnswerFragment(candidate: string, plan: AnswerPlan, sentenceComplete = false): QualityGateResult {
  const triggers: string[] = [];
  const enforceGenericOrganizationGate = plan.questionMode !== "candidate_reasoning"
    || ["project_arc", "contribution", "star"].includes(plan.responseShape);
  const allowedText = [
    ...plan.allowedFacts,
    ...plan.allowedOrganizations,
    ...plan.allowedProjectStatuses,
    plan.limitations ?? "",
  ].join("\n");
  const allowedNumbers = normalizedNumbers(allowedText);
  const firstParagraph = candidate.split(/\n\s*\n/)[0] ?? candidate;

  if (plan.directAnswerTerms.length && sentenceComplete && !plan.directAnswerTerms.some((term) => firstParagraph.toLowerCase().includes(term.toLowerCase()))) {
    triggers.push("indirect_opening");
  }
  for (const phrase of RISKY_CLAIMS) {
    if (candidate.includes(phrase)
      && !(phrase === "满意度" && plan.questionMode === "candidate_reasoning")
      && !containsAllowedPhrase(phrase, allowedText)) triggers.push(`unsupported_claim:${phrase}`);
  }
  for (const organization of KNOWN_ORGANIZATIONS) {
    if (candidate.includes(organization) && !containsAllowedOrganization(organization, allowedText)) triggers.push(`unsupported_organization:${organization}`);
  }
  if (enforceGenericOrganizationGate) {
    for (const organization of candidate.match(ORGANIZATION_PATTERN) ?? []) {
      if (!containsAllowedOrganization(organization, allowedText)) triggers.push("unsupported_organization");
    }
  }
  for (const number of normalizedNumbers(candidate)) {
    if (!allowedNumbers.has(number)) triggers.push("unsupported_number");
  }
  for (const topic of plan.forbiddenTopics) {
    const leaked = forbiddenTopicLeak(topic, candidate, allowedText);
    if (leaked) triggers.push(`forbidden_topic:${topic}`);
  }
  for (const detail of plan.forbiddenDetails) {
    if (detail && candidate.includes(detail)) triggers.push(`forbidden:${detail}`);
  }
  if (sentenceComplete) {
    for (const sentence of candidate.split(/[。！？\n]+/).map((item) => item.trim()).filter(Boolean)) {
      const explicitPastClaim = /我(?:之前|曾经|曾|实际|以前|过去)[^。！？\n]{0,12}(?:负责|主导|参与|完成|推动|交付|上线|遇到|发现|验证)|我[^。！？\n]{0,8}(?:负责过|主导过|参与过|做过|遇到过|发现过|验证过)/.test(sentence);
      if (EVENT_SIGNAL.test(sentence)
        && groundingScore(sentence, allowedText) < 0.3
        && explicitPastClaim) {
        triggers.push("unsupported_event");
      }
    }
  }
  const uniqueTriggers = [...new Set(triggers)];
  return { passed: !hasHardSafetyTriggers(uniqueTriggers), triggers: uniqueTriggers };
}

export function repairInstruction(plan: AnswerPlan, triggers: string[]) {
  return `上一版回答没有通过质量检查，请重新作答。\n
失败原因：${triggers.join("；")}\n
必须遵守：\n
1. 只能使用下方“允许事实”，不得补充合理猜测、过程细节、数字、用户反馈或完成状态。\n
2. 使用 ${plan.responseShape} 结构；回答厚度为 ${plan.detailLevel}。${plan.targetLength.min}-${plan.targetLength.max} 字只作为信息密度参考，根据问题复杂度自然长短。deep 回答必须形成直接判断、2-3 层互补证据、关键机制或取舍与面试判断，每段承担不同作用；其他问题不为凑字数重复。使用 1-3 个、不超过 12 字的加粗短词组突出核心结论、个人贡献、关键取舍、可验证结果或真实边界，超过 240 字时保留 2-3 个重点。加粗内容脱离上下文也应能传递判断，不要使用“核心项目”“方案设计”“我的贡献”“第一步”这类栏目标签，不要加粗完整句子，也不要强制套三段模板。\n
3. 不使用寒暄、Claim/Source、证据边界、核实提醒或免责声明。\n
4. 第一段直接回答 ${plan.facet} 维度，并自然包含以下关键词之一：${plan.directAnswerTerms.join("、") || "当前问题关键词"}。始终使用第一人称；本轮必须带来新信息：${plan.newInformationGoal.join("；")}\n
5. 避免重复：${plan.avoidPoints.join("；") || "无"}；结尾任务：${plan.closingPurpose}\n
6. 必答点：${plan.mustInclude.join("；")}\n
7. 允许事实：${plan.allowedFacts.join("；")}。可以像正式面试一样概括、重组并适度美化表达，优先讲清本人判断、行动、结果与岗位价值，不要机械复述材料。\n
8. 禁止内容：${plan.forbiddenDetails.join("；") || "任何未提供的事实"}；禁止混入主题：${plan.forbiddenTopics.join("、") || "无"}`;
}
