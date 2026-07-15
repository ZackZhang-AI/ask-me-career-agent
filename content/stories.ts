const draft = {
  visibility: "private",
  status: "draft",
  verification: "unverified",
  lastUpdated: "2026-07-15",
} as const;

export const starStoryContent = [
  { ...draft, id: "ST1", title: "从审计文档痛点到 RAG 知识库", relatedProject: "rag-knowledge-base", situation: "审计等场景的非结构化文档检索和答案溯源存在困难。", task: "设计一套可检索、可引用、可评测的知识库方案。", action: "拆解解析、混合检索、Rerank、引用溯源与 RAGAS 评测链路，并完成公开实现。", result: "形成公开的 RAG Knowledge Base System 仓库。", limitations: "生产规模、用户效果与独立贡献比例需面试核实。", claimIds: ["C3"], supportsClaimIds: ["C3"], sourceIds: ["S1", "S3"] },
  { ...draft, id: "ST2", title: "设计 DeepFlow 多 Agent 研究流程", relatedProject: "deepflow", situation: "复杂研究任务需要在计划、检索、分析和报告之间形成可检查链路。", task: "将研究过程拆分为明确角色和成果物。", action: "设计 Coordinator、Planner、Researcher、Coder、Reporter 等角色及人审确认环节。", result: "形成公开的 DeepFlow 研究工作台仓库。", limitations: "生产稳定性、时延与成本没有统一外部测量。", claimIds: ["C4"], supportsClaimIds: ["C4"], sourceIds: ["S1", "S4"] },
  { ...draft, id: "ST3", title: "用本地优先工具恢复工作上下文", relatedProject: "thirty-minute-brain", situation: "任务切换后重新建立短期工作上下文会消耗时间。", task: "设计不依赖云端数据的上下文恢复工具。", action: "采用 Tauri、React、Rust 与本地数据能力实现桌面原型。", result: "形成公开的 Thirty-Minute Brain 仓库。", limitations: "真实节省时间和长期使用效果尚无外部数据。", claimIds: ["C5"], supportsClaimIds: ["C5"], sourceIds: ["S1", "S5"] },
  { ...draft, id: "ST4", title: "将审计资料整理抽象为归档助手", relatedProject: "audit-tools", situation: "审计资料字段分散，整理与归档依赖重复操作。", task: "在不使用真实客户数据的前提下验证辅助归档思路。", action: "抽象字段提取、归档建议与辅助生成流程并实现公开原型。", result: "形成审计资料智能归档助手公开仓库。", limitations: "未使用真实客户数据，提效结果无第三方测量。", claimIds: ["C7"], supportsClaimIds: ["C7"], sourceIds: ["S1", "S8"] },
  { ...draft, id: "ST5", title: "把 IT 日志核查规则产品化", relatedProject: "audit-tools", situation: "IT 审计日志抽查需要把关注点转成可重复执行的规则。", task: "构建可公开演示的日志抽查辅助工具。", action: "设计规则检查、异常提示与审计关注点输出。", result: "形成 IT 审计日志抽查助手公开仓库。", limitations: "演示数据不代表企业生产环境验证。", claimIds: ["C7"], supportsClaimIds: ["C7"], sourceIds: ["S1", "S9"] },
  { ...draft, id: "ST6", title: "德勤 IT 审计实习中的证据核查", situation: "IT 审计工作需要围绕系统输出和日志形成可复核证据。", task: "参与 IPE 与日志核查相关工作。", action: "按候选人材料所述执行资料核对与日志检查。", result: "完成候选人材料中记录的实习职责。", limitations: "故事细节、个人决策权限与工作结果需本人逐条确认；不得披露客户或底稿。", claimIds: ["C9"], supportsClaimIds: ["C9"], sourceIds: ["S1"] },
  { ...draft, id: "ST7", title: "容诚财务审计实习中的现场协作", situation: "财务审计项目需要围绕底稿、函证和盘点协作。", task: "参与候选人材料记录的审计基础工作。", action: "按职责参与底稿、函证与盘点。", result: "完成候选人材料中记录的实习职责。", limitations: "项目背景、个人贡献与结果需本人逐条确认；不得披露客户或底稿。", claimIds: ["C10"], supportsClaimIds: ["C10"], sourceIds: ["S1"] },
  { ...draft, id: "ST8", title: "为招聘场景建立 Ask Me 证据模型", relatedProject: "ask-me", situation: "简历难以在短时间内提供可追问且可验证的候选人信息。", task: "设计一个受证据约束的求职数字分身。", action: "完成 PRD、信息架构、Claim-Source 模型、回答边界与工程验收设计。", result: "形成持续迭代中的 Ask Me 项目。", limitations: "尚无招聘转化或大规模使用数据。", claimIds: ["C12"], supportsClaimIds: ["C12"], sourceIds: ["S2"] },
] as const;
