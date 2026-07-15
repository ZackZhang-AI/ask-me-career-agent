const updated = "2026-07-15";
const publicActive = { visibility: "public", status: "active", lastUpdated: updated } as const;

type AnswerInput = {
  id: string;
  question: string;
  standardAnswer: string;
  limitations: string;
  claimIds: string[];
  sourceIds: string[];
  matchKeywords: string[];
  verification?: "externally_verified" | "self_attested";
  relatedProject?: string;
};

function answer(input: AnswerInput) {
  return {
    ...publicActive,
    ...input,
    verification: input.verification ?? "self_attested",
    supportsClaimIds: input.claimIds,
    requiredClaimIds: input.claimIds,
    requiredSourceIds: input.sourceIds,
  };
}

export const stableAnswerContent = [
  answer({ id: "A01", question: "请用 60 秒介绍张倬玮。", matchKeywords: ["60秒", "介绍", "候选人定位"], standardAnswer: "张倬玮是东北大学应用统计学 2027 届学生，目标方向为 AI 产品经理。他的差异化主线是数据分析与评测、审计业务理解，以及把 RAG、Agent 和效率工具想法落为公开代码。", limitations: "教育与经历来自候选人维护材料，需以正式简历或面试核实。", claimIds: ["C1", "C2", "C6"], sourceIds: ["S1", "S10"] }),
  answer({ id: "A02", question: "他为什么适合 AI 产品经理岗位？", matchKeywords: ["为什么适合", "岗位匹配", "ai产品经理"], standardAnswer: "匹配证据来自三方面：应用统计学与评测实践、财务及 IT 审计形成的业务和证据意识、多个公开 RAG 与 Agent 项目的产品与工程落地。", limitations: "这是证据匹配分析，不是录用结论。", claimIds: ["C2", "C3", "C4", "C6"], sourceIds: ["S1", "S3", "S4"] }),
  answer({ id: "A03", question: "哪个项目最能代表他的 AI 产品能力？", matchKeywords: ["代表项目", "最能代表", "ai产品能力"], standardAnswer: "RAG Knowledge Base System 最能综合体现其 AI 产品能力：问题来自审计文档检索，方案覆盖解析、混合检索、Rerank、引用溯源和自动评测设计。DeepFlow 则补充体现多 Agent 流程设计。", limitations: "生产规模、真实用户效果与独立贡献比例仍需核实。", claimIds: ["C3", "C4"], sourceIds: ["S1", "S3", "S4"], verification: "externally_verified", relatedProject: "rag-knowledge-base" }),
  answer({ id: "A04", question: "RAG 项目解决了什么问题？", matchKeywords: ["rag解决", "rag项目", "知识库问题"], standardAnswer: "该项目针对审计等场景中非结构化文档难检索、答案难溯源的问题，公开实现多格式解析、混合检索、Rerank、引用溯源和 RAGAS 评测设计。", limitations: "长期记忆在 README 中仍是规划项，不能视为已完成。", claimIds: ["C3"], sourceIds: ["S1", "S3"], verification: "externally_verified", relatedProject: "rag-knowledge-base" }),
  answer({ id: "A05", question: "他在 RAG 项目中的个人贡献是什么？", matchKeywords: ["rag贡献", "rag个人贡献", "rag负责"], standardAnswer: "候选人陈述其主导产品定位、检索策略、评测体系与全栈落地，AI 编程工具辅助开发、调试与文档整理。", limitations: "个人贡献范围属于候选人陈述，需结合提交记录或面试核实。", claimIds: ["C3"], sourceIds: ["S1", "S3"], relatedProject: "rag-knowledge-base" }),
  answer({ id: "A06", question: "DeepFlow 是什么？", matchKeywords: ["deepflow是什么", "deepflow介绍", "研究工作台"], standardAnswer: "DeepFlow 是公开的多 Agent 深度研究工作台，通过 Coordinator、Planner、Researcher、Coder 和 Reporter 等角色组织计划、检索、分析与报告生成。", limitations: "仓库不能自动证明生产规模或长期稳定性。", claimIds: ["C4"], sourceIds: ["S4"], verification: "externally_verified", relatedProject: "deepflow" }),
  answer({ id: "A07", question: "他如何使用 AI 编程工具？", matchKeywords: ["ai编程", "如何使用ai", "ai辅助"], standardAnswer: "公开材料将分工描述为：候选人负责需求、产品取舍、验证和证据边界，AI 编程工具参与代码实现、调试、测试与资料整理。", limitations: "不同项目中的具体贡献比例仍应逐项核实。", claimIds: ["C2", "C3", "C4", "C5", "C7", "C12"], sourceIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"] }),
  answer({ id: "A08", question: "他的核心技术能力有哪些？", matchKeywords: ["技术能力", "技术栈", "会什么"], standardAnswer: "候选人材料列出 SQL、Python、FastAPI、Milvus、RAGAS、Prompt 与工作流设计；公开 RAG、DeepFlow 和本地工具仓库可佐证部分实践。", limitations: "熟练程度需通过现场任务或面试核实。", claimIds: ["C2", "C3", "C4", "C5"], sourceIds: ["S1", "S3", "S4", "S5"] }),
  answer({ id: "A09", question: "审计经历如何帮助他做 AI 产品？", matchKeywords: ["审计经历", "审计帮助", "业务理解"], standardAnswer: "财务与 IT 审计经历使他关注业务流程、风险、证据和数据边界；公开的资料归档与日志抽查工具体现了把审计痛点转成产品原型的尝试。", limitations: "客户、底稿与企业机密不在公开回答范围内。", claimIds: ["C6", "C7", "C9", "C10"], sourceIds: ["S1", "S8", "S9"] }),
  answer({ id: "A10", question: "他的德勤 IT 审计实习做了什么？", matchKeywords: ["德勤实习", "it审计实习", "ipe"], standardAnswer: "候选人材料显示其在 2026 年 1 月至 4 月参与德勤 IT 审计实习，公开职责涉及 IPE 与日志核查。", limitations: "不披露客户、底稿或企业机密；任职信息需正式材料核实。", claimIds: ["C9"], sourceIds: ["S1"] }),
  answer({ id: "A11", question: "他的容诚审计实习做了什么？", matchKeywords: ["容诚实习", "财务审计实习", "函证盘点"], standardAnswer: "候选人材料显示其在 2025 年 1 月至 3 月参与容诚财务审计实习，公开职责涉及底稿、函证与盘点。", limitations: "不披露客户、底稿或企业机密；任职信息需正式材料核实。", claimIds: ["C10"], sourceIds: ["S1"] }),
  answer({ id: "A12", question: "他有哪些本地优先产品？", matchKeywords: ["本地优先", "效率工具", "桌面产品"], standardAnswer: "公开项目包括 Thirty-Minute Brain、Read-Later Regret 和 Downloads Butler，分别处理短期上下文恢复、信息债管理和下载文件整理。", limitations: "暂无公开用户规模、留存或长期价值数据。", claimIds: ["C5"], sourceIds: ["S1", "S5", "S6", "S7"], verification: "externally_verified", relatedProject: "local-first-tools" }),
  answer({ id: "A13", question: "他如何处理隐私和企业数据？", matchKeywords: ["隐私", "企业数据", "数据边界", "机密"], standardAnswer: "现有项目说明强调本地优先、公开演示数据和证据边界；Ask Me 不应回答审计客户、底稿、企业机密或未公开个人信息。", limitations: "这是公开设计原则，不等同于第三方安全认证。", claimIds: ["C7", "C12"], sourceIds: ["S1", "S2", "S8", "S9"] }),
  answer({ id: "A14", question: "他的主要短板是什么？", matchKeywords: ["短板", "不足", "能力缺口"], standardAnswer: "当前公开证据不足以证明大规模商业化 AI 产品、真实用户增长与留存、长期跨职能团队管理，以及公开项目的生产稳定性。", limitations: "这些是证据缺口，不等同于断言候选人完全不具备相关能力。", claimIds: ["C8"], sourceIds: ["S1", "S10"] }),
  answer({ id: "A15", question: "面试中最应该核实什么？", matchKeywords: ["面试核实", "待核实", "追问"], standardAnswer: "建议重点核实：公开项目中的独立贡献比例、真实用户与生产稳定性、实习中的决策权限，以及技能熟练程度。", limitations: "核实问题来自现有证据边界，不预设结论。", claimIds: ["C2", "C3", "C4", "C8"], sourceIds: ["S1", "S3", "S4", "S10"] }),
  answer({ id: "A16", question: "他的教育背景是什么？", matchKeywords: ["教育背景", "学校专业", "东北大学"], standardAnswer: "候选人材料显示其就读于东北大学应用统计学专业，预计 2027 年毕业。", limitations: "需以学籍或正式简历核实。", claimIds: ["C1"], sourceIds: ["S1"] }),
  answer({ id: "A17", question: "他的英语和证书情况如何？", matchKeywords: ["英语", "四六级", "acca", "证书"], standardAnswer: "候选人材料记录 CET-4 619、CET-6 520，并完成部分 ACCA 科目。", limitations: "成绩和科目完成情况应以正式材料核实。", claimIds: ["C1", "C2"], sourceIds: ["S1"] }),
  answer({ id: "A18", question: "Ask Me 项目体现了什么能力？", matchKeywords: ["ask me能力", "数字分身", "本项目能力"], standardAnswer: "Ask Me 体现了招聘场景需求拆解、Claim-Source 证据建模、回答边界设计和工程验收能力。", limitations: "项目仍在更新，暂无招聘转化或大规模使用数据。", claimIds: ["C12"], sourceIds: ["S2"], relatedProject: "ask-me" }),
  answer({ id: "A19", question: "公开项目是否有真实用户增长数据？", matchKeywords: ["用户增长", "用户规模", "留存数据"], standardAnswer: "当前公开资料没有足够证据证明真实用户增长、留存或大规模商业化结果。", limitations: "这是公开证据不足，不代表项目没有任何使用者。", claimIds: ["C5", "C8"], sourceIds: ["S1", "S5", "S6", "S7", "S10"] }),
  answer({ id: "A20", question: "可以根据这些材料直接给出录用结论吗？", matchKeywords: ["录用结论", "是否录用", "值得录用"], standardAnswer: "不能。Ask Me 只提供可定位的公开证据和待核实边界，不替招聘方作录用判断。", limitations: "录用仍需结合岗位要求、面试、背调与组织判断。", claimIds: ["C8"], sourceIds: ["S1", "S10"] }),
] as const;

export const faqContent = stableAnswerContent.slice(0, 15).map((item, index) => ({
  ...publicActive,
  id: `F${String(index + 1).padStart(2, "0")}`,
  question: item.question,
  answerId: item.id,
  keywords: item.matchKeywords,
  verification: item.verification,
  relatedProject: item.relatedProject,
  supportsClaimIds: item.requiredClaimIds,
}));
