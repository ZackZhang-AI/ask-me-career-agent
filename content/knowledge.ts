const updated = "2026-07-17";
const publicActive = { visibility: "public", status: "active", lastUpdated: updated } as const;

export const strengthContent = [
  { title: "数据分析与评测", description: "应用统计学背景，能用指标、评测集和 Badcase 分析驱动 AI 产品迭代。" },
  { title: "审计与业务理解", description: "具备财务审计和 IT 审计经历，理解流程、风险、证据和企业数据边界。" },
  { title: "AI 产品工程落地", description: "持续构建 RAG、Multi-Agent 与本地优先工具，把产品判断转化为公开代码。" },
] as const;

export const projectAliases = {
  "rag-knowledge-base": ["rag", "知识库", "企业级rag", "rag knowledge base", "代表项目"],
  deepflow: ["deepflow", "多agent", "multi-agent", "研究工作台", "深度研究"],
  "thirty-minute-brain": ["thirty-minute brain", "thirty minute brain", "30分钟大脑", "上下文恢复"],
  "local-first-tools": ["本地优先", "read later", "downloads butler", "效率工具"],
  "audit-tools": ["审计工具", "归档助手", "日志抽查", "audit assistant"],
  "ask-me": ["ask me", "数字分身", "求职agent", "本项目"],
} as const;

export const knowledgeContent = [
  { ...publicActive, id: "K1", title: "候选人定位", keywords: ["介绍", "60秒", "背景", "优势", "张倬玮", "定位"], content: "张倬玮是东北大学应用统计学 2027 届学生，目标方向为 AI 产品经理。差异化主线是数据与评测、审计与企业业务、RAG 与 Agent 实践，以及用 AI 编程工具快速落地产品。", verification: "self_attested", candidateContribution: "候选人整理并确认公开定位。", aiAssistance: "AI 用于结构化表达，不作为个人事实来源。", limitations: "教育和经历信息来自候选人维护文档，需正式材料核实。", claimIds: ["C1", "C2", "C6"], supportsClaimIds: ["C1", "C2", "C6"], sourceIds: ["S1", "S10"] },
  { ...publicActive, id: "K2", title: "AI 产品岗位匹配", keywords: ["匹配", "岗位", "ai产品经理", "能力", "短板", "缺口", "核实", "为什么"], content: "核心匹配点是应用统计学带来的数据评测意识、财务及 IT 审计形成的企业业务理解，以及通过 RAG 与 Agent 项目把问题快速转化为可运行工具的能力。", verification: "self_attested", candidateContribution: "候选人负责项目问题定义、产品取舍、评测设计与最终验收。", aiAssistance: "AI 编程工具参与代码实现，候选人负责需求、验证和边界管理。", limitations: "这是岗位证据分析，不是录用结论；贡献范围与业务结果需面试核实。", claimIds: ["C2", "C3", "C4", "C6", "C8"], supportsClaimIds: ["C2", "C3", "C4", "C6", "C8"], sourceIds: ["S1", "S3", "S4", "S10"] },
  { ...publicActive, id: "K3", title: "教育与技能", keywords: ["教育", "学校", "东北大学", "专业", "统计", "技能", "证书", "英语", "acca"], content: "就读于东北大学应用统计学专业，预计 2027 年毕业。技能覆盖 SQL、Python、FastAPI、Milvus、RAGAS、Prompt 与工作流设计；CET-4 619、CET-6 520，并完成部分 ACCA 科目。", verification: "self_attested", candidateContribution: "候选人提供并授权公开。", aiAssistance: "无。", limitations: "课程、成绩和证书应以正式材料核实。", claimIds: ["C1", "C2"], supportsClaimIds: ["C1", "C2"], sourceIds: ["S1"] },
  { ...publicActive, id: "K4", title: "企业级 RAG 知识库系统", keywords: ["rag", "知识库", "检索", "dense retrieval", "ragas", "milvus", "代表项目", "项目"], relatedProject: "rag-knowledge-base", content: "该项目面向专业文档问答，以 Dense Retrieval 为主完成文档摄入、检索与生成链路，并围绕混合检索、Rerank、引用溯源和自动评测设计持续迭代方案。", projectStatus: "in_progress", verification: "externally_verified", candidateContribution: "候选人负责产品定位、检索策略、评测设计与整体落地推进。", aiAssistance: "AI 编程工具辅助开发、调试与文档整理。", limitations: "不把 README 功能列表直接视为全部运行验证；个人贡献比例、生产规模与真实用户效果需面试核实。", claimIds: ["C3"], supportsClaimIds: ["C3"], sourceIds: ["S1", "S3"] },
  { ...publicActive, id: "K5", title: "DeepFlow 多 Agent 研究工作台", keywords: ["deepflow", "agent", "多agent", "研究", "planner", "researcher", "报告", "mvp"], relatedProject: "deepflow", content: "DeepFlow 通过 Coordinator、Planner、Researcher、Coder 和 Reporter 等角色组织研究计划、资料检索、分析和报告生成，已形成一条可演示 MVP 链路。", projectStatus: "in_progress", verification: "externally_verified", candidateContribution: "候选人负责 Agent 分工、人审节点、观测字段与报告资产链路设计。", aiAssistance: "模型承担研究生成，AI 编程工具辅助工程实现。", limitations: "真实用户、生产并发、权限审计、工具状态持久化、时延与成本尚未形成独立验证。", claimIds: ["C4"], supportsClaimIds: ["C4"], sourceIds: ["S1", "S4"] },
  { ...publicActive, id: "K6", title: "本地优先效率工具", keywords: ["thirty", "brain", "read later", "downloads", "本地", "桌面", "浏览器", "效率工具", "tauri"], relatedProject: "local-first-tools", content: "公开项目包括 Thirty-Minute Brain、Read-Later Regret 和 Downloads Butler，分别解决短期上下文恢复、信息债管理和下载文件夹整理问题。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "完成产品定义、安全规则、数据模型与原型实现。", aiAssistance: "AI 编程工具参与实现和测试。", limitations: "目前缺少公开的用户规模、留存和长期价值数据。", claimIds: ["C5"], supportsClaimIds: ["C5"], sourceIds: ["S1", "S5", "S6", "S7"] },
  { ...publicActive, id: "K7", title: "审计业务工具", keywords: ["审计工具", "归档", "日志", "底稿", "ocr", "streamlit", "it审计"], relatedProject: "audit-tools", content: "将审计资料整理和 IT 日志抽查场景转化为两个公开工具，覆盖字段抽取、归档建议、异常规则检查和审计关注点生成。", projectStatus: "completed", verification: "externally_verified", candidateContribution: "负责场景抽象、规则设计、原型实现与测试。", aiAssistance: "OCR、LLM 与 AI 编程工具参与实现。", limitations: "不公开真实客户或企业数据，提效结果尚无第三方测量。", claimIds: ["C7"], supportsClaimIds: ["C7"], sourceIds: ["S1", "S8", "S9"] },
  { ...publicActive, id: "K8", title: "德勤 IT 审计实习", keywords: ["德勤", "it审计", "ipe", "日志核查", "实习"], content: "2026 年 1 月至 4 月参与德勤 IT 审计实习，公开职责描述涉及 IPE 与日志核查。", verification: "self_attested", candidateContribution: "候选人提供并确认任职时间与职责描述。", aiAssistance: "无。", limitations: "不回答客户名称、底稿内容或企业机密；任职信息需正式材料核实。", claimIds: ["C6", "C9"], supportsClaimIds: ["C6", "C9"], sourceIds: ["S1"] },
  { ...publicActive, id: "K9", title: "容诚财务审计实习", keywords: ["容诚", "财务审计", "底稿", "函证", "盘点", "实习"], content: "2025 年 1 月至 3 月参与容诚财务审计实习，公开职责描述涉及底稿、函证与盘点。", verification: "self_attested", candidateContribution: "候选人提供并确认任职时间与职责描述。", aiAssistance: "无。", limitations: "不回答客户名称、底稿内容或企业机密；任职信息需正式材料核实。", claimIds: ["C6", "C10"], supportsClaimIds: ["C6", "C10"], sourceIds: ["S1"] },
  { ...publicActive, id: "K10", title: "德勤校园大使", keywords: ["德勤", "校园大使", "校招", "主持", "推广"], content: "曾担任德勤校园大使，公开职责描述包括流程主持与校招推广。", verification: "self_attested", candidateContribution: "候选人提供并确认职责描述。", aiAssistance: "无。", limitations: "活动范围与效果需面试核实。", claimIds: ["C6", "C11"], supportsClaimIds: ["C6", "C11"], sourceIds: ["S1"] },
  { ...publicActive, id: "K11", title: "能力边界", keywords: ["短板", "不足", "边界", "缺口", "风险", "待核实"], content: "当前公开证据的主要缺口是大规模商业化 AI 产品、真实用户增长与留存、长期跨职能团队管理，以及公开项目在生产环境中的稳定性数据。", verification: "self_attested", candidateContribution: "候选人主动标记证据边界。", aiAssistance: "无。", limitations: "能力边界会随实习和项目进展更新。", claimIds: ["C8"], supportsClaimIds: ["C8"], sourceIds: ["S1", "S10"] },
  { ...publicActive, id: "K12", title: "Ask Me 项目", keywords: ["ask me", "数字分身", "求职agent", "本项目"], relatedProject: "ask-me", content: "Ask Me 是面向 AI 产品经理招聘场景的求职数字分身，通过静态摘要、可追问对话、事实引用和状态管理，帮助招聘方快速获得可验证信息。", projectStatus: "in_progress", verification: "self_attested", candidateContribution: "负责需求洞察、PRD、信息架构、Claim-Source 模型、安全边界和工程验收。", aiAssistance: "AI 编程 Agent 参与代码生成、资料整理和测试。", limitations: "仍在持续更新，尚未提供招聘转化或大规模使用数据。", claimIds: ["C12"], supportsClaimIds: ["C12"], sourceIds: ["S2"] },
] as const;

export const suggestedQuestionContent = [
  "60 秒了解张倬玮。",
  "他与 AI 产品经理岗位的匹配证据是什么？",
  "哪个公开项目最能代表他的 AI 产品能力？",
  "他的主要短板和待核实问题是什么？",
] as const;
