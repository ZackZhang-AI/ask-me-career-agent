const updated = "2026-07-17";
const publicActive = { visibility: "public", status: "active", lastUpdated: updated } as const;

type AnswerInput = {
  id: string;
  question: string;
  standardAnswer: string;
  details?: string[];
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
  answer({
    id: "A01",
    question: "请用 60 秒介绍张倬玮。",
    matchKeywords: ["60秒", "介绍", "自我介绍", "候选人定位", "简单说说自己"],
    standardAnswer: "我是张倬玮，一名把数据评测、企业业务理解和 AI 产品落地结合起来的 2027 届 AI 产品经理候选人。我的特点不是只会写需求文档或调用模型，而是能把一个模糊的 AI 场景拆成产品流程、评测方法和可运行原型。",
    details: [
      "数据与评测：东北大学应用统计学背景，具备 SQL、Python、指标设计、评测集与 Badcase 分析基础，适合参与 AI 产品效果定义和迭代验证。",
      "业务与风险：财务审计和 IT 审计经历，使他更关注业务流程、证据、风险与企业数据边界，能够把模糊问题拆成可核验需求。",
      "产品与工程：我围绕 RAG Knowledge Base System 和 DeepFlow 持续搭建作品集，覆盖文档检索、Multi-Agent 工作流、人工确认节点和可演示 MVP。",
      "岗位价值：我适合需要快速原型、AI 工作流、效果评测和 B 端场景理解的 AI 产品岗位，能够较快进入具体问题并产出可验证方案。",
    ],
    limitations: "教育与实习信息需以正式材料核实；公开仓库可验证项目实现，但独立贡献比例、生产规模和真实用户效果仍应在面试中追问。",
    claimIds: ["C1", "C2", "C3", "C4", "C6", "C8"],
    sourceIds: ["S1", "S3", "S4", "S10"],
  }),
  answer({
    id: "A02",
    question: "他为什么适合 AI 产品经理岗位？",
    matchKeywords: ["为什么适合", "岗位匹配", "ai产品经理", "为什么选择你", "你的优势", "岗位优势", "如果入职", "入职能做什么"],
    standardAnswer: "我适合 AI 产品经理岗位，核心原因是我同时具备数据评测、企业业务理解和产品工程落地三种能力，能把模型能力真正转化成可验证的产品方案。",
    details: [
      "数据评测：应用统计学背景和评测实践，有助于把模型效果拆成指标、评测集、Badcase 与迭代动作，而不是只讨论主观体验。",
      "业务理解：财务审计和 IT 审计经历强化了流程、风险、证据和数据边界意识，适合知识库、企业工作流等 B 端 AI 场景。",
      "产品落地：RAG Knowledge Base System 与 DeepFlow 展示了我如何定义问题、设计工作流、组织检索和人工确认节点，并把判断快速转成代码与可演示原型。",
      "岗位适配：我尤其适合初级 AI 产品经理、AI 解决方案产品，以及偏评测、知识库和工作流的岗位。",
    ],
    limitations: "这是基于公开证据的岗位匹配分析，不是录用结论；项目独立贡献、用户结果和跨职能协作深度仍需面试核实。",
    claimIds: ["C2", "C3", "C4", "C6", "C8"],
    sourceIds: ["S1", "S3", "S4", "S10"],
  }),
  answer({
    id: "A03",
    question: "哪个项目最能代表他的 AI 产品能力？",
    matchKeywords: ["代表项目", "最能代表", "ai产品能力"],
    standardAnswer: "最能代表我 AI 产品能力的是 RAG Knowledge Base System。它不是单纯的技术 Demo，而是围绕专业文档难检索、回答难追溯的问题，完整体现了我从问题定义、检索链路设计到评测规划的思考。",
    details: [
      "问题定义：从审计等场景的非结构化文档难检索、答案难溯源出发，而不是先有技术再寻找用途。",
      "当前链路：知识库证据支持以 Dense Retrieval 为主的文档摄入、检索与生成链路。",
      "方案取舍：在 Dense Retrieval 主链路基础上，我继续围绕混合检索、Rerank、引用溯源和 RAGAS 评测设计迭代方向。",
      "能力延伸：DeepFlow 则补充展示了我对 Multi-Agent 分工、人工确认和复杂研究流程产品化的理解。",
    ],
    limitations: "公开仓库可验证项目与部分代码产物存在，但不自动证明 README 所列功能均已跑通；个人贡献、生产规模和真实用户效果需面试确认。",
    claimIds: ["C3", "C4"],
    sourceIds: ["S1", "S3", "S4"],
    verification: "externally_verified",
    relatedProject: "rag-knowledge-base",
  }),
  answer({ id: "A04", question: "RAG 项目解决了什么问题？", matchKeywords: ["rag解决", "rag项目", "知识库问题"], standardAnswer: "这个项目解决的是专业文档“找得到但用不好”的问题：资料分散、检索效率低、生成答案缺少上下文。我的设计以文档摄入、切片、Embedding、Dense Retrieval 和回答生成为主链路，并围绕混合检索、Rerank、引用溯源和自动评测持续优化。", limitations: "公开 README 可以证明设计声明，不等同于所有功能已通过独立验证。", claimIds: ["C3"], sourceIds: ["S1", "S3"], verification: "externally_verified", relatedProject: "rag-knowledge-base" }),
  answer({ id: "A05", question: "他在 RAG 项目中的个人贡献是什么？", matchKeywords: ["rag贡献", "rag个人贡献", "rag负责", "具体做了什么", "个人具体完成", "你做了什么", "你负责什么", "你的贡献", "如何评测", "评测设计"], standardAnswer: "我在 RAG 项目里重点负责产品定位、检索策略、评测设计和整体落地推进。具体来说，我先定义专业文档问答的核心问题，再设计摄入—检索—生成链路，并把 Bad Case、引用质量和后续评测纳入迭代。AI 编程工具主要帮助我加快代码实现、调试和文档整理，需求判断、方案取舍和最终验收由我负责。", limitations: "当前仍缺少按功能对应的提交记录、任务记录或运行证据，因此不把“参与”扩大为已验证的独立主导。", claimIds: ["C3"], sourceIds: ["S1", "S3"], relatedProject: "rag-knowledge-base" }),
  answer({ id: "A06", question: "DeepFlow 是什么？", matchKeywords: ["deepflow是什么", "deepflow介绍", "研究工作台"], standardAnswer: "DeepFlow 是我围绕复杂研究任务设计的多 Agent 工作台。它通过 Coordinator、Planner、Researcher、Coder 和 Reporter 等角色，把需求澄清、计划确认、资料检索、分析和报告生成组织成一条可追踪流程，目前已经形成可演示 MVP。", limitations: "真实用户、生产并发、权限审计、工具状态持久化与长期稳定性尚未独立验证。", claimIds: ["C4"], sourceIds: ["S4"], verification: "externally_verified", relatedProject: "deepflow" }),
  answer({ id: "A07", question: "他如何使用 AI 编程工具？", matchKeywords: ["ai编程", "如何使用ai", "ai辅助", "ai编程占比", "ai写了多少", "代码是不是ai写的"], standardAnswer: "我把 AI 编程工具当作高效率的工程协作者，而不是替我做产品判断。我负责定义需求、拆解任务、做方案取舍、设计验收标准和判断结果是否可用；AI 主要参与代码实现、调试、测试和资料整理。这让我能用更短时间把产品想法变成可以运行和验证的原型。", limitations: "不同项目中的具体贡献比例仍应逐项核实。", claimIds: ["C2", "C3", "C4", "C5", "C7", "C12"], sourceIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"] }),
  answer({ id: "A08", question: "他的核心技术能力有哪些？", matchKeywords: ["技术能力", "技术栈", "会什么"], standardAnswer: "我的技术能力主要服务于 AI 产品落地：能使用 SQL、Python 做数据处理和分析，能基于 FastAPI、Milvus 等组件理解并搭建 RAG 链路，也具备 Prompt、工作流、评测集和 RAGAS 相关实践。我的优势不是和纯工程师比底层深度，而是能理解技术约束，并把它转化成产品方案和验收标准。", limitations: "熟练程度需通过现场任务或面试核实。", claimIds: ["C2", "C3", "C4", "C5"], sourceIds: ["S1", "S3", "S4", "S5"] }),
  answer({ id: "A09", question: "审计经历如何帮助他做 AI 产品？", matchKeywords: ["审计经历", "审计帮助", "业务理解"], standardAnswer: "审计经历让我形成了很强的流程、风险和证据意识。做 AI 产品时，我会自然关注数据从哪里来、结果能否追溯、异常如何发现、权限和边界怎么控制。这也是我做知识库、日志抽查和资料归档类产品时，能比单纯技术视角更快理解企业真实需求的原因。", limitations: "客户、底稿与企业机密不在公开回答范围内。", claimIds: ["C6", "C7", "C9", "C10"], sourceIds: ["S1", "S8", "S9"] }),
  answer({ id: "A10", question: "他的德勤 IT 审计实习做了什么？", matchKeywords: ["德勤实习", "it审计实习", "ipe"], standardAnswer: "我在 2026 年 1 月至 4 月参与德勤 IT 审计实习，主要接触 IPE 与日志核查等工作。这段经历让我更熟悉企业系统中的数据来源、流程控制和异常验证，也强化了我做 B 端 AI 产品时对可靠性和数据边界的敏感度。", limitations: "不披露客户、底稿或企业机密；任职信息需正式材料核实。", claimIds: ["C9"], sourceIds: ["S1"] }),
  answer({ id: "A11", question: "他的容诚审计实习做了什么？", matchKeywords: ["容诚实习", "财务审计实习", "函证盘点"], standardAnswer: "我在 2025 年 1 月至 3 月参与容诚财务审计实习，主要接触底稿、函证和盘点工作。这让我对真实业务流程、证据链和一线执行有了更具体的理解，也帮助我在设计企业产品时更关注实际使用成本，而不是只看功能是否成立。", limitations: "不披露客户、底稿或企业机密；任职信息需正式材料核实。", claimIds: ["C10"], sourceIds: ["S1"] }),
  answer({ id: "A12", question: "他有哪些本地优先产品？", matchKeywords: ["本地优先", "效率工具", "桌面产品"], standardAnswer: "我做过 Thirty-Minute Brain、Read-Later Regret 和 Downloads Butler 三个本地优先工具，分别解决短期上下文恢复、信息债管理和下载文件整理。它们共同体现了我的产品习惯：从高频的小摩擦出发，用轻量方案快速完成闭环，而不是一开始就做复杂平台。", limitations: "暂无公开用户规模、留存或长期价值数据。", claimIds: ["C5"], sourceIds: ["S1", "S5", "S6", "S7"], verification: "externally_verified", relatedProject: "local-first-tools" }),
  answer({ id: "A13", question: "他如何处理隐私和企业数据？", matchKeywords: ["隐私", "企业数据", "数据边界", "机密"], standardAnswer: "现有项目说明强调本地优先、公开演示数据和证据边界；Ask Me 不应回答审计客户、底稿、企业机密或未公开个人信息。", limitations: "这是公开设计原则，不等同于第三方安全认证。", claimIds: ["C7", "C12"], sourceIds: ["S1", "S2", "S8", "S9"] }),
  answer({
    id: "A14",
    question: "他的主要短板是什么？",
    matchKeywords: ["短板", "不足", "能力缺口"],
    standardAnswer: "我目前最需要补强的是把原型能力进一步转化成真实用户结果和更完整的跨团队协作经验。不过我的优势是学习和落地速度快，能够先把复杂问题做成可运行方案，再通过反馈持续迭代。",
    details: [
      "商业结果不足：暂未看到可公开核验的用户增长、留存、收入或成本改善数据。",
      "生产验证不足：公开仓库能够证明方案和实现，但无法自动证明大规模流量、长期稳定性或 SLA。",
      "协作证据不足：尚缺少长期跨职能团队协作、资源协调和复杂利益相关方管理的公开案例。",
      "当前阶段：我是一名原型与分析能力较强的初级候选人，下一步重点是积累更完整的商业化和跨职能项目经验。",
    ],
    limitations: "这些是当前公开证据缺口，不等同于断言候选人完全不具备相关能力。",
    claimIds: ["C8"],
    sourceIds: ["S1", "S10"],
  }),
  answer({
    id: "A15",
    question: "面试中最应该核实什么？",
    matchKeywords: ["面试核实", "待核实", "追问", "遇到什么困难", "项目困难", "失败案例", "项目挑战"],
    standardAnswer: "最值得深入聊的是三个问题：我如何做产品取舍、如何定位 AI 项目的失败案例，以及能否把现有方法迁移到新的企业场景。这三类问题最容易看出我的真实能力。",
    details: [
      "贡献边界：任选一个公开项目，请他现场拆解由本人决定、由 AI 工具辅助和由现成框架提供的部分。",
      "取舍能力：追问一次检索、评测或 Agent 工作流中的失败案例，观察他如何定位原因并调整方案。",
      "结果真实性：核实真实用户数量、使用频率、生产稳定性及是否存在可展示的反馈或数据。",
      "岗位迁移：给出一个新的企业 AI 场景，让他现场定义用户、目标指标、风险和最小验证方案。",
    ],
    limitations: "这些问题来自现有证据边界，用于验证能力而不是预设正面或负面结论。",
    claimIds: ["C2", "C3", "C4", "C8"],
    sourceIds: ["S1", "S3", "S4", "S10"],
  }),
  answer({ id: "A16", question: "他的教育背景是什么？", matchKeywords: ["教育背景", "学校专业", "东北大学"], standardAnswer: "我就读于东北大学应用统计学专业，预计 2027 年毕业。统计学训练让我在做 AI 产品时更习惯从数据、指标和验证方法出发，而不是只依赖主观体验。", limitations: "需以学籍或正式简历核实。", claimIds: ["C1"], sourceIds: ["S1"] }),
  answer({ id: "A17", question: "他的英语和证书情况如何？", matchKeywords: ["英语", "四六级", "acca", "证书"], standardAnswer: "我的 CET-4 成绩是 619、CET-6 是 520，并完成了部分 ACCA 科目。英语能力能够支持我阅读海外 AI 产品、模型和工程资料，ACCA 学习则补充了财务与企业业务理解。", limitations: "成绩和科目完成情况应以正式材料核实。", claimIds: ["C1", "C2"], sourceIds: ["S1"] }),
  answer({ id: "A18", question: "Ask Me 项目体现了什么能力？", matchKeywords: ["ask me能力", "数字分身", "本项目能力"], standardAnswer: "Ask Me 体现的是我把招聘需求转化成 AI 产品的能力。我不仅做了一个聊天页面，还设计了个人知识结构、核心问题稳定回答、多轮检索、安全边界、匿名分析和自动评测，让它能够像数字分身一样帮助面试官快速理解我。", limitations: "项目仍在更新，暂无招聘转化或大规模使用数据。", claimIds: ["C12"], sourceIds: ["S2"], relatedProject: "ask-me" }),
  answer({ id: "A19", question: "公开项目是否有真实用户增长数据？", matchKeywords: ["用户增长", "用户规模", "留存数据"], standardAnswer: "目前这些项目主要处在产品闭环和技术验证阶段，重点成果是把问题定义、核心流程和可演示原型跑通，还没有进入大规模用户增长阶段。下一步我会通过真实任务测试、使用反馈和转化数据继续验证价值。", limitations: "这是公开证据不足，不代表项目没有任何使用者。", claimIds: ["C5", "C8"], sourceIds: ["S1", "S5", "S6", "S7", "S10"] }),
  answer({
    id: "A20",
    question: "可以根据这些材料直接给出录用结论吗？",
    matchKeywords: ["录用结论", "是否录用", "值得录用", "进入下一轮", "继续面试"],
    standardAnswer: "我认为自己值得进入下一轮初步面试。我的价值不只是会使用 AI 工具，而是能把数据评测、企业业务理解和产品工程落地结合起来，把模糊问题推进成可验证的原型。",
    details: [
      "数据与评测：我能把模型效果拆成指标、评测集和 Bad Case，并据此形成迭代动作。",
      "业务与风险：审计经历让我更重视流程、证据、权限和数据边界，适合 B 端 AI 场景。",
      "产品与工程：RAG、DeepFlow 和 Ask Me 展示了我从问题定义、方案取舍到原型验收的完整推进方式。",
    ],
    limitations: "下一轮最值得核实的是单个项目中的个人贡献、失败复盘，以及把现有方法迁移到具体岗位场景的能力。",
    claimIds: ["C2", "C3", "C4", "C6", "C8", "C12"],
    sourceIds: ["S1", "S2", "S3", "S4", "S10"],
  }),
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
