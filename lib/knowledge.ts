import type { KnowledgeItem, Source } from "./types";

export const strengths = [
  { title: "数据分析与证据意识", description: "具备统计与数据分析背景，关注指标定义、评测稳定性，以及证据是否真正支持结论。" },
  { title: "审计与企业业务理解", description: "理解风险、流程和非结构化信息场景，能把 AI 能力放进真实业务约束中判断。" },
  { title: "AI 产品快速落地", description: "能使用 AI 编程与工程工具，将产品假设快速转化为可运行、可验证的原型。" },
] as const;

export const sources: Source[] = [
  { id: "S1", title: "Ask Me 产品需求文档 v1.1", sourceType: "document", public: true, lastChecked: "2026-07-15" },
  { id: "S2", title: "Ask Me 重构与实施计划", sourceType: "document", public: true, lastChecked: "2026-07-15" },
];

export const knowledge: KnowledgeItem[] = [
  {
    id: "K1", title: "候选人定位", keywords: ["介绍", "60秒", "背景", "优势", "张倬玮", "定位"],
    content: "张倬玮的差异化主线是数据分析、审计与企业业务、AI 产品、Agent 实践和快速执行。他的目标方向是 AI 产品经理。",
    verification: "self_attested", candidateContribution: "候选人整理并确认公开定位与能力边界。", aiAssistance: "AI 用于结构化表达，不作为事实来源。", limitations: "目前来源为候选人自述与本项目 PRD，教育和任职细节仍需以正式简历核实。", sourceIds: ["S1", "S2"],
  },
  {
    id: "K2", title: "AI 产品岗位匹配", keywords: ["匹配", "岗位", "ai产品经理", "能力", "短板", "缺口", "核实"],
    content: "匹配证据包括数据分析与指标意识、企业流程与风险理解、RAG 与 Agent 产品方法，以及使用 AI 编程工具实现原型的执行能力。当前公开资料不足以证明大规模线上 AI 产品的商业化和跨职能团队管理经验。",
    verification: "self_attested", candidateContribution: "候选人定义产品问题、信息架构、可信回答机制和评测框架。", aiAssistance: "AI 编程工具辅助实现，产品判断与验收标准由候选人负责。", limitations: "岗位匹配是证据分析，不是录用结论；规模化经验需面试核实。", sourceIds: ["S1", "S2"],
  },
  {
    id: "K3", title: "Ask Me 项目", keywords: ["项目", "ask me", "rag", "agent", "代表", "产品能力", "贡献"],
    content: "Ask Me 是面向 AI 产品经理招聘场景的求职数字分身，通过静态摘要、可追问对话、事实引用和内容状态管理，帮助招聘方快速获得可验证的候选人信息。",
    projectStatus: "in_progress", verification: "self_attested", candidateContribution: "候选人完成需求洞察、PRD、信息架构、Claim-Source 模型、安全边界、评测方案与工程实现。", aiAssistance: "AI 编程 Agent 参与代码生成、资料整理和测试，候选人负责需求、取舍、审核与发布。", limitations: "项目处于开发与验证阶段，尚未提供真实招聘转化或大规模使用数据。", sourceIds: ["S1", "S2"],
  },
];

export const suggestedQuestions = [
  "60 秒了解张倬玮。",
  "他与 AI 产品经理岗位的匹配证据是什么？",
  "哪个项目最能代表他的 AI 产品能力？",
  "他的主要短板和待核实问题是什么？",
] as const;

export function retrieveKnowledge(question: string, limit = 3) {
  const normalized = question.toLowerCase().replace(/\s/g, "");
  return knowledge
    .map((item) => ({ item, score: item.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.replace(/\s/g, "").toLowerCase()) ? 2 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getSources(ids: string[]) {
  return sources.filter((source) => ids.includes(source.id) && source.public);
}
