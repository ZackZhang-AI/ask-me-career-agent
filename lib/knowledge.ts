import type { Claim, KnowledgeItem, Source } from "./types";

export const strengths = [
  { title: "数据分析与评测", description: "应用统计学背景，能用指标、评测集和 Badcase 分析驱动 AI 产品迭代。" },
  { title: "审计与业务理解", description: "具备财务审计和 IT 审计经历，理解流程、风险、证据和企业数据边界。" },
  { title: "AI 产品工程落地", description: "持续构建 RAG、Multi-Agent 与本地优先工具，把产品判断转化为公开代码。" },
] as const;

export const sources: Source[] = [
  { id: "S1", title: "个人能力汇总（候选人维护）", sourceType: "self_report", public: true, lastChecked: "2026-07-15", verification: "self_attested", supports: "教育、技能、经历、项目角色与个人贡献陈述。", limitations: "由候选人维护，关键数字、任职细节和贡献范围仍需面试或正式材料核实。" },
  { id: "S2", title: "Ask Me 产品需求文档 v1.1", sourceType: "document", public: true, lastChecked: "2026-07-15", verification: "self_attested", projectStatus: "in_progress", supports: "Ask Me 的需求、信息架构、可信回答与评测设计。", limitations: "证明产品设计过程，不等同于真实用户效果。" },
  { id: "S3", title: "RAG Knowledge Base System", sourceType: "repository", url: "https://github.com/ZackZhang-AI/RAG-Knowledge-Base-System", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开仓库存在，README 展示文档解析、混合检索、引用溯源和评测设计。", limitations: "仓库可验证代码与设计存在，但本人独立贡献比例仍需结合提交记录核实。" },
  { id: "S4", title: "DeepFlow", sourceType: "repository", url: "https://github.com/ZackZhang-AI/DeepFlow", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开仓库存在，README 展示多 Agent 研究流程、联网检索与报告生成。", limitations: "公开仓库不自动证明生产规模、长期稳定性或全部功能均由本人独立实现。" },
  { id: "S5", title: "Thirty-Minute Brain", sourceType: "repository", url: "https://github.com/ZackZhang-AI/thirty-minute-brain", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开仓库存在，可验证 Tauri、React、Rust 与本地数据设计。", limitations: "实际用户规模与长期使用效果尚无外部数据。" },
  { id: "S6", title: "Read-Later Regret", sourceType: "repository", url: "https://github.com/ZackZhang-AI/read-later-regret", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开 Chrome 扩展仓库存在，可验证信息债分类与本地数据管理实现。", limitations: "推荐效果和使用价值主要来自候选人自测。" },
  { id: "S7", title: "Downloads Butler", sourceType: "repository", url: "https://github.com/ZackZhang-AI/downloads-butler", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开桌面工具仓库存在，可验证文件分类、移动建议与安全操作设计。", limitations: "仓库存在不等同于大规模用户验证。" },
  { id: "S8", title: "审计资料智能归档助手", sourceType: "repository", url: "https://github.com/ZackZhang-AI/audit-intern-assistant", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开仓库存在，可验证审计资料字段抽取、归档与辅助生成方案。", limitations: "不包含真实客户数据，业务提效结果未经过第三方测量。" },
  { id: "S9", title: "IT 审计日志抽查助手", sourceType: "repository", url: "https://github.com/ZackZhang-AI/it-audit-log-sampling-assistant", public: true, lastChecked: "2026-07-15", verification: "externally_verified", projectStatus: "completed", supports: "公开仓库存在，可验证日志规则检查和审计关注点输出。", limitations: "使用的是可公开演示数据，不代表企业生产环境验证。" },
  { id: "S10", title: "ZackZhang-AI GitHub 主页", sourceType: "repository", url: "https://github.com/ZackZhang-AI", public: true, lastChecked: "2026-07-15", verification: "externally_verified", supports: "公开账号与项目索引。", limitations: "只能验证公开活动与仓库，不能验证非公开工作经历。" },
];

export const claims: Claim[] = [
  { id: "C1", statement: "张倬玮就读于东北大学应用统计学专业，预计 2027 年毕业。", claimType: "background", candidateContribution: "本人提供并授权公开。", aiAssistance: "无。", verification: "self_attested", sourceIds: ["S1"], limitations: "需以学籍或正式简历核实。" },
  { id: "C2", statement: "具备 SQL、Python、RAGAS、FastAPI 与 AI 产品评测相关能力。", claimType: "skill", candidateContribution: "本人提供技能陈述，并有公开项目佐证部分技术实践。", aiAssistance: "AI 工具参与开发与资料整理。", verification: "self_attested", sourceIds: ["S1", "S3", "S4"], limitations: "熟练程度需通过面试或现场任务核实。" },
  { id: "C3", statement: "公开实现了具备文档解析、混合检索、引用溯源和自动评测的 RAG 系统。", claimType: "project", candidateContribution: "产品定位、检索策略、评测设计与全栈落地由候选人主导。", aiAssistance: "AI 编程工具辅助实现与调试。", verification: "externally_verified", sourceIds: ["S1", "S3"], limitations: "生产规模和独立贡献比例需进一步核实。" },
  { id: "C4", statement: "公开实现了多 Agent 深度研究工作台 DeepFlow。", claimType: "project", candidateContribution: "设计 Agent 分工、研究流程、观测字段和成果物链路。", aiAssistance: "模型负责研究生成，AI 编程工具辅助工程实现。", verification: "externally_verified", sourceIds: ["S1", "S4"], limitations: "真实引用数量、时延和成本会随任务变化。" },
  { id: "C5", statement: "构建了三个本地优先或浏览器效率工具，覆盖上下文恢复、信息债和文件整理。", claimType: "project", candidateContribution: "候选人提供产品定义、安全规则与实现。", aiAssistance: "AI 编程工具参与开发。", verification: "externally_verified", sourceIds: ["S1", "S5", "S6", "S7"], limitations: "用户规模和留存数据尚未公开。" },
  { id: "C6", statement: "有财务审计、IT 审计和校园大使经历。", claimType: "experience", candidateContribution: "本人提供经历与工作内容。", aiAssistance: "无。", verification: "self_attested", sourceIds: ["S1"], limitations: "企业任职和量化成果需正式材料或面试核实。" },
  { id: "C7", statement: "将审计业务痛点转化为公开的资料归档与日志抽查工具。", claimType: "project", candidateContribution: "场景抽象、规则设计和原型实现。", aiAssistance: "OCR、LLM 与 AI 编程工具参与实现。", verification: "externally_verified", sourceIds: ["S1", "S8", "S9"], limitations: "未使用或公开企业客户敏感数据。" },
  { id: "C8", statement: "当前公开证据不足以证明大规模线上 AI 产品商业化和长期团队管理经验。", claimType: "boundary", candidateContribution: "候选人确认当前公开能力边界。", aiAssistance: "无。", verification: "self_attested", sourceIds: ["S1", "S10"], limitations: "应在面试中进一步核实实习和团队协作范围。" },
];

export const knowledge: KnowledgeItem[] = [
  { id: "K1", title: "候选人定位", keywords: ["介绍", "60秒", "背景", "优势", "张倬玮", "定位"], content: "张倬玮是东北大学应用统计学 2027 届学生，目标方向为 AI 产品经理。他的差异化主线是数据与评测、审计与企业业务、RAG 与 Agent 实践，以及用 AI 编程工具快速落地产品。", verification: "self_attested", candidateContribution: "候选人整理并确认公开定位。", aiAssistance: "AI 用于结构化表达，不作为个人事实来源。", limitations: "教育和经历信息来自候选人维护文档，需正式材料核实。", claimIds: ["C1", "C2", "C6"], sourceIds: ["S1", "S10"] },
  { id: "K2", title: "AI 产品岗位匹配", keywords: ["匹配", "岗位", "ai产品经理", "能力", "短板", "缺口", "核实", "为什么"], content: "匹配证据包括应用统计学与评测意识、财务及 IT 审计的业务理解、多项公开 RAG 与 Agent 项目，以及持续把个人痛点转化为可运行工具。当前证据缺口是大规模商业化、真实用户增长和长期跨职能团队管理。", verification: "self_attested", candidateContribution: "候选人负责项目问题定义、产品取舍、评测与工程审核。", aiAssistance: "AI 编程工具广泛参与代码实现，候选人负责需求、验证和边界管理。", limitations: "这是岗位证据分析，不是录用结论；贡献范围与业务结果需面试核实。", claimIds: ["C2", "C3", "C4", "C6", "C8"], sourceIds: ["S1", "S3", "S4", "S10"] },
  { id: "K3", title: "教育与技能", keywords: ["教育", "学校", "东北大学", "专业", "统计", "技能", "证书", "英语", "acca"], content: "就读于东北大学应用统计学专业，预计 2027 年毕业。技能覆盖 SQL、Python、FastAPI、Milvus、RAGAS、Prompt 与工作流设计；CET-4 619、CET-6 520，并完成部分 ACCA 科目。", verification: "self_attested", candidateContribution: "候选人提供并授权公开。", aiAssistance: "无。", limitations: "课程、成绩和证书应以正式材料核实。", claimIds: ["C1", "C2"], sourceIds: ["S1"] },
  { id: "K4", title: "企业级 RAG 知识库系统", keywords: ["rag", "知识库", "检索", "ragas", "milvus", "代表项目", "项目"], content: "从审计非结构化文档检索痛点出发，设计并实现支持多格式解析、混合检索、Rerank、引用溯源和自动评测的 RAG 知识库系统。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "主导产品定位、检索策略、评测体系与全栈落地。", aiAssistance: "AI 编程工具辅助开发、调试与文档整理。", limitations: "长期记忆在仓库 README 中标记为规划项，不能描述为已完成；生产规模需核实。", claimIds: ["C3"], sourceIds: ["S1", "S3"] },
  { id: "K5", title: "DeepFlow 多 Agent 研究工作台", keywords: ["deepflow", "agent", "多agent", "研究", "planner", "researcher", "报告"], content: "DeepFlow 通过 Coordinator、Planner、Researcher、Coder 和 Reporter 等角色完成研究计划、资料检索、分析和报告生成，并支持人审确认与成果物输出。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "设计 Agent 分工、过程可解释性、观测字段与报告资产链路。", aiAssistance: "模型承担研究生成，AI 编程工具辅助工程实现。", limitations: "引用数量、时延和成本取决于具体任务，不能视为稳定 SLA。", claimIds: ["C4"], sourceIds: ["S1", "S4"] },
  { id: "K6", title: "本地优先效率工具", keywords: ["thirty", "brain", "read later", "downloads", "本地", "桌面", "浏览器", "效率工具", "tauri"], content: "公开项目包括 Thirty-Minute Brain、Read-Later Regret 和 Downloads Butler，分别解决短期上下文恢复、信息债管理和下载文件夹整理问题。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "完成产品定义、安全规则、数据模型与原型实现。", aiAssistance: "AI 编程工具参与实现和测试。", limitations: "目前缺少公开的用户规模、留存和长期价值数据。", claimIds: ["C5"], sourceIds: ["S1", "S5", "S6", "S7"] },
  { id: "K7", title: "审计业务工具", keywords: ["审计工具", "归档", "日志", "底稿", "ocr", "streamlit", "it审计"], content: "将审计资料整理和 IT 日志抽查场景转化为两个公开工具，覆盖字段抽取、归档建议、异常规则检查和审计关注点生成。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "负责场景抽象、规则设计、原型实现与测试。", aiAssistance: "OCR、LLM 与 AI 编程工具参与实现。", limitations: "不公开真实客户或企业数据，提效结果尚无第三方测量。", claimIds: ["C7"], sourceIds: ["S1", "S8", "S9"] },
  { id: "K8", title: "实习与业务经历", keywords: ["实习", "德勤", "容诚", "审计", "经历", "校园大使", "业务"], content: "公开确认的主要经历包括容诚审计实习、德勤 IT 审计实习和德勤校园大使，涉及底稿、函证、盘点、IPE、日志核查、流程主持与校招推广。", verification: "self_attested", candidateContribution: "候选人提供并确认职责描述。", aiAssistance: "无。", limitations: "不回答客户名称、底稿内容或其他企业机密；量化成果需面试核实。", claimIds: ["C6"], sourceIds: ["S1"] },
  { id: "K9", title: "能力边界", keywords: ["短板", "不足", "边界", "缺口", "风险", "待核实"], content: "当前公开证据的主要缺口是大规模商业化 AI 产品、真实用户增长与留存、长期跨职能团队管理，以及公开项目在生产环境中的稳定性数据。", verification: "self_attested", candidateContribution: "候选人主动标记证据边界。", aiAssistance: "无。", limitations: "能力边界会随实习和项目进展更新。", claimIds: ["C8"], sourceIds: ["S1", "S10"] },
  { id: "K10", title: "Ask Me 项目", keywords: ["ask me", "数字分身", "求职agent", "本项目"], content: "Ask Me 是面向 AI 产品经理招聘场景的求职数字分身，通过静态摘要、可追问对话、事实引用和状态管理，帮助招聘方快速获得可验证信息。", projectStatus: "in_progress", verification: "self_attested", candidateContribution: "负责需求洞察、PRD、信息架构、Claim-Source 模型、安全边界和工程验收。", aiAssistance: "AI 编程 Agent 参与代码生成、资料整理和测试。", limitations: "仍在持续更新，尚未提供招聘转化或大规模使用数据。", claimIds: [], sourceIds: ["S2"] },
];

export const suggestedQuestions = [
  "60 秒了解张倬玮。",
  "他与 AI 产品经理岗位的匹配证据是什么？",
  "哪个公开项目最能代表他的 AI 产品能力？",
  "他的主要短板和待核实问题是什么？",
] as const;

export function retrieveKnowledge(question: string, limit = 4) {
  const normalized = question.toLowerCase().replace(/\s/g, "");
  return knowledge
    .map((item) => ({ item, score: item.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.replace(/\s/g, "").toLowerCase()) ? Math.max(2, keyword.length) : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getSources(ids: string[]) {
  return sources.filter((source) => ids.includes(source.id) && source.public);
}
