import { candidateNarrative } from "./narrative.ts";
import type { AnswerIntent, ResponseShape } from "../lib/types.ts";

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
  evaluationGoal: string;
  exclusivePoints: string[];
  avoidRepeating: string[];
  responseShape: ResponseShape;
  targetLength: { min: number; max: number };
  preferredStoryIds: string[];
  followUpQuestions: string[];
  closingPurpose: string;
  verification?: "externally_verified" | "self_attested";
  relatedProject?: string;
  intent?: AnswerIntent;
  mustInclude?: string[];
  allowedFacts?: string[];
  allowedNumbers?: string[];
  allowedOrganizations?: string[];
  allowedProjectStatuses?: string[];
  boundaryTriggers?: string[];
  forbiddenDetails?: string[];
};

const answerIntentById: Record<string, AnswerIntent> = {
  A01: "introduction", A02: "role_fit", A03: "representative_project", A04: "project_problem",
  A05: "contribution", A06: "project_overview", A07: "ai_collaboration", A08: "skills",
  A09: "experience_value", A10: "experience", A11: "experience", A12: "project_overview",
  A13: "privacy", A14: "limitation", A15: "challenge", A16: "education",
  A17: "credentials", A18: "project_overview", A19: "result", A20: "hiring_recommendation",
};

const knownOrganizations = ["东北大学", "德勤", "容诚", "ACCA"];
const defaultBoundaryTriggers = ["短板", "不足", "限制", "风险", "真实数据", "用户规模", "生产状态", "个人贡献", "未完成"];
const defaultForbiddenDetails = [
  "未在资料中出现的任职、日期或组织",
  "未在资料中出现的用户访谈、满意度、增长、效率或业务结果数字",
  "把规划中或待验证的能力描述为已经完成",
  "审计客户、底稿、企业机密或未公开个人信息",
  "未确认的占位经历",
];

function extractNumbers(values: string[]) {
  return [...new Set(values.flatMap((value) => value.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []))];
}

function answer(input: AnswerInput) {
  const facts = [input.standardAnswer, ...(input.details ?? [])];
  const allowedOrganizations = input.allowedOrganizations
    ?? knownOrganizations.filter((organization) => facts.some((fact) => fact.includes(organization)));
  return {
    ...publicActive,
    ...input,
    verification: input.verification ?? "self_attested",
    supportsClaimIds: input.claimIds,
    requiredClaimIds: input.claimIds,
    requiredSourceIds: input.sourceIds,
    factSkeleton: {
      intent: input.intent ?? answerIntentById[input.id] ?? "general",
      thesis: input.standardAnswer.split(/\n\n/)[0],
      mustInclude: input.mustInclude ?? input.exclusivePoints,
      allowedFacts: input.allowedFacts ?? facts,
      allowedNumbers: input.allowedNumbers ?? extractNumbers(facts),
      allowedOrganizations,
      allowedProjectStatuses: input.allowedProjectStatuses ?? facts.filter((fact) => /MVP|原型|规划|验证阶段|已实现|已完成|持续优化/.test(fact)),
      boundaryTriggers: input.boundaryTriggers ?? defaultBoundaryTriggers,
      forbiddenDetails: [...defaultForbiddenDetails, ...(input.forbiddenDetails ?? [])],
    },
  };
}

export const stableAnswerContent = [
  answer({
    id: "A01",
    question: "请用 60 秒介绍张倬玮。",
    matchKeywords: ["60秒", "介绍", "自我介绍", "候选人定位", "简单说说自己"],
    standardAnswer: candidateNarrative.introductions.seconds60,
    details: [
      "身份与方向：东北大学应用统计学 2027 届学生，求职方向是 AI 产品经理。",
      "成长主线：应用统计学训练、财务与 IT 审计业务，再到 AI 产品实践。",
      "差异化：数据评测、企业业务和产品落地三种视角。",
      "项目锚点：RAG Knowledge Base System 与 DeepFlow。",
    ],
    limitations: "不加入未确认的占位经历，也不在自我介绍中主动展开项目规模和未验证结果。",
    claimIds: ["C1", "C2", "C3", "C4", "C6"],
    sourceIds: ["S1", "S3", "S4"],
    evaluationGoal: "让面试官在一分钟内记住候选人的身份、成长路径、三项差异点和求职方向。",
    exclusivePoints: ["应用统计学到审计再到 AI 产品的成长主线", "数据评测、企业业务、产品落地", "AI 应用、知识库或企业工作流方向"],
    avoidRepeating: ["项目技术栈", "项目完成边界", "完整贡献分工"],
    responseShape: "narrative",
    targetLength: { min: 240, max: 340 },
    preferredStoryIds: [],
    followUpQuestions: ["哪个项目最能代表你的 AI 产品能力？", "审计经历如何帮助你做 AI 产品？", "为什么选择你而不是其他应届候选人？"],
    closingPurpose: "明确目标岗位和希望创造的产品价值。",
  }),
  answer({
    id: "A02",
    question: "他为什么适合 AI 产品经理岗位？",
    matchKeywords: ["为什么适合", "为什么选择你", "选择你", "岗位匹配", "ai产品经理", "岗位优势", "入职", "团队做什么", "团队带来什么"],
    standardAnswer: "我适合 AI 产品经理岗位，不是因为单纯会使用大模型，而是因为我的能力正好覆盖 AI 产品最关键的三类工作。\n\n**定义效果**：应用统计学和项目评测实践让我能够把“模型好不好”拆成指标、评测集、Bad Case 和迭代动作。\n\n**理解场景**：财务审计和 IT 审计经历让我更熟悉企业流程、风险、证据链和数据边界，能更快识别 B 端场景里真正需要解决的问题。\n\n**推动落地**：RAG 与 DeepFlow 项目训练了我从需求、流程和方案取舍推进到可运行原型，并对最终验收负责。对 AI 产品团队来说，我能在业务、模型效果和工程实现之间建立共同语言，帮助团队更快验证方向。",
    details: ["AI 产品效果定义与评测", "企业流程与数据边界理解", "从产品判断到可运行原型", "在业务、模型和工程之间建立共同语言"],
    limitations: "岗位匹配回答不主动讨论用户规模、生产状态或公开证据缺口。",
    claimIds: ["C2", "C3", "C4", "C6"],
    sourceIds: ["S1", "S3", "S4"],
    evaluationGoal: "把已有能力逐项映射到 AI 产品经理的实际工作，而不是重新介绍个人经历。",
    exclusivePoints: ["定义 AI 产品效果", "理解企业场景", "连接业务、模型与工程"],
    avoidRepeating: ["学校和毕业年份", "完整成长主线", "所有项目列表"],
    responseShape: "fit_mapping",
    targetLength: { min: 230, max: 360 },
    preferredStoryIds: [],
    followUpQuestions: ["你如何评估并改进 AI 产品效果？", "你能为 AI 产品团队承担什么具体工作？", "哪个项目最能证明这些能力？"],
    closingPurpose: "说明入职后如何帮助团队更快验证产品方向。",
  }),
  answer({
    id: "A03",
    question: "哪个项目最能代表他的 AI 产品能力？",
    matchKeywords: ["代表项目", "最能代表", "ai产品能力"],
    standardAnswer: "最能代表我 AI 产品能力的是 RAG Knowledge Base System，因为它体现的不是某一个技术组件，而是我如何把业务问题变成可以持续验证的产品链路。\n\n**问题判断**：我关注的是专业文档虽然很多，但检索、理解和引用都不够高效，生成答案也容易缺少可追溯依据。\n\n**方案取舍**：我先把文档摄入、Dense Retrieval 和回答生成作为主链路，再把混合检索、Rerank、引用溯源和评测拆成独立迭代项，避免为了展示技术栈一次堆入所有组件。\n\n**验收思路**：我把检索是否找到正确内容、回答是否忠于上下文、引用能否支持结论以及 Bad Case 如何回流作为评测重点。这个项目最能体现我从问题定义、方案取舍到评测闭环的产品思考。",
    details: ["专业文档检索与答案溯源问题", "以 Dense Retrieval 为当前主链路", "高级能力拆成独立迭代项", "用检索、回答、引用和 Bad Case 验收"],
    limitations: "项目当前处于持续迭代阶段，不主动声称生产规模或真实用户增长。",
    claimIds: ["C3"],
    sourceIds: ["S1", "S3"],
    verification: "externally_verified",
    relatedProject: "rag-knowledge-base",
    evaluationGoal: "用一个项目证明产品判断、取舍和评测能力。",
    exclusivePoints: ["业务问题而非技术展示", "先主链路后迭代项", "检索与引用评测闭环"],
    avoidRepeating: ["三项个人优势", "完整自我介绍", "DeepFlow 详细流程"],
    responseShape: "project_arc",
    targetLength: { min: 280, max: 430 },
    preferredStoryIds: ["ST1"],
    followUpQuestions: ["你在这个项目中具体做了什么？", "最难的产品取舍是什么？", "你如何评估 RAG 回答质量？"],
    closingPurpose: "落到问题定义、方案取舍和评测闭环。",
  }),
  answer({
    id: "A04",
    question: "RAG 项目解决了什么问题？",
    matchKeywords: ["rag解决", "rag项目", "知识库问题"],
    standardAnswer: "这个项目解决的不是“企业没有文档”，而是专业资料很多、真正需要答案时却很难快速找到正确内容，也很难判断生成结论依据了哪段原文。我的产品定义因此聚焦三件事：让文档能够被统一摄入和检索，让回答基于召回内容生成，并让后续引用与评测能够判断答案是否可靠。当前先跑通 Dense Retrieval 主链路，再逐步验证混合检索、Rerank 和引用溯源，核心目标始终是降低获取可信答案的成本。",
    details: ["专业资料难以快速找到正确内容", "生成结论缺少原文依据", "摄入、检索、生成和评测链路"],
    limitations: "公开仓库证明当前设计与部分实现，不等同于所有规划能力均已运行验证。",
    claimIds: ["C3"], sourceIds: ["S1", "S3"], verification: "externally_verified", relatedProject: "rag-knowledge-base",
    evaluationGoal: "讲清用户问题和产品目标，不展开个人贡献或技术选型细节。",
    exclusivePoints: ["资料多但可信答案获取成本高", "回答缺少可追溯依据", "降低可信答案获取成本"],
    avoidRepeating: ["个人三项优势", "完整评测方法", "AI 编程分工"],
    responseShape: "direct", targetLength: { min: 170, max: 280 }, preferredStoryIds: [],
    followUpQuestions: ["为什么先选择 Dense Retrieval？", "你如何判断回答是否可靠？", "这个项目目前做到什么阶段？"],
    closingPurpose: "回到用户获取可信答案的成本。",
  }),
  answer({
    id: "A05",
    question: "他在 RAG 项目中的个人贡献是什么？",
    matchKeywords: ["rag贡献", "rag个人贡献", "rag负责", "具体做了什么", "个人具体完成", "你做了什么", "你负责什么", "你的贡献", "如何评测", "用于评测", "ragas", "评测设计"],
    standardAnswer: "我在 RAG 项目中的核心贡献，不是把所有代码都归到自己名下，而是对产品判断和最终质量负责。\n\n**我做的判断**：我先定义专业文档问答的目标用户问题，决定以摄入—检索—生成为主链路，并把引用和评测作为可信度建设方向。\n\n**我做的取舍**：没有一开始堆满所有检索组件，而是先用 Dense Retrieval 建立基线，再把混合检索、Rerank 和 RAGAS 评测拆开验证，方便定位问题来自摄入、召回还是生成。\n\n**我如何验收**：我关注检索内容是否相关、回答是否忠于上下文、引用是否支持结论，以及 Bad Case 能否转化为下一轮迭代任务。AI 编程工具帮助我实现、调试和整理文档，但需求定义、方案取舍、测试设计与最终验收由我负责。",
    details: ["定义专业文档问答目标", "确定主链路和迭代顺序", "设计检索、回答、引用与 Bad Case 验收", "AI 辅助实现，本人负责判断和质量"],
    limitations: "不虚构固定的人工与 AI 代码贡献比例。",
    claimIds: ["C3"], sourceIds: ["S1", "S3"], relatedProject: "rag-knowledge-base",
    evaluationGoal: "区分产品决策、工程协作和最终责任，回答本人真正做了什么。",
    exclusivePoints: ["产品目标与主链路由本人定义", "迭代顺序和评测由本人设计", "AI 辅助实现但本人负责验收"],
    avoidRepeating: ["重新解释项目背景", "三项候选人优势", "虚构代码占比"],
    responseShape: "contribution", targetLength: { min: 280, max: 430 }, preferredStoryIds: ["ST1", "ST3"],
    followUpQuestions: ["你做过最关键的一次取舍是什么？", "如果检索效果不好，你会如何定位？", "AI 生成的代码你怎么验收？"],
    closingPurpose: "明确本人对产品判断和最终质量负责。",
  }),
  answer({
    id: "A06",
    question: "DeepFlow 是什么？",
    matchKeywords: ["deepflow", "deepflow是什么", "deepflow介绍", "研究工作台"],
    standardAnswer: "DeepFlow 是我围绕复杂研究任务设计的多 Agent 工作台。它要解决的问题是：如果把一个开放研究题一次性交给模型，过程容易跑偏，使用者也很难知道结论是怎么形成的。\n\n因此我把任务拆成计划、检索、分析和报告等阶段，由 Coordinator、Planner、Researcher、Coder 和 Reporter 等角色协作；在研究计划这类高成本节点加入人工确认，并通过过程事件和引用保留可追踪性。当前它已经形成从任务澄清到报告输出的可演示 MVP。它体现的是我对 Agent 产品可控性、协作边界和成果物沉淀的理解。",
    details: ["复杂研究任务容易失控", "按计划、检索、分析和报告拆分 Agent", "高成本节点加入人工确认", "形成可演示 MVP"],
    limitations: "不声称已经形成真实用户规模、生产并发或长期稳定性数据。",
    claimIds: ["C4"], sourceIds: ["S4"], verification: "externally_verified", relatedProject: "deepflow",
    evaluationGoal: "让面试官理解 DeepFlow 的用户问题、核心机制和产品价值。",
    exclusivePoints: ["开放研究任务容易跑偏", "Agent 分工与人工确认", "研究过程可追踪"],
    avoidRepeating: ["RAG 项目评测链路", "完整个人优势", "所有规划功能"],
    responseShape: "project_arc", targetLength: { min: 220, max: 350 }, preferredStoryIds: ["ST2"],
    followUpQuestions: ["为什么需要人工确认？", "Agent 之间如何协作？", "这个项目最大的挑战是什么？"],
    closingPurpose: "突出 Agent 产品的可控性和成果物沉淀。",
  }),
  answer({
    id: "A07",
    question: "他如何使用 AI 编程工具？",
    matchKeywords: ["ai编程", "如何使用ai", "ai辅助", "ai编程占比", "ai写了多少", "代码是不是ai写的"],
    standardAnswer: "我会直接承认 AI 编程工具深度参与了项目实现，但它没有替我承担产品责任。我的分工很明确：我负责定义要解决的问题、拆解任务、选择方案、制定验收标准，并判断结果是否真的可用；AI 主要作为工程协作者，帮助生成代码、补测试、定位错误和整理文档。\n\n我不会用“代码能运行”作为完成标准。每次关键改动都要经过功能检查、自动测试、Lint、Build 和实际流程验收；如果生成结果偏离需求，我会回到问题定义和接口约束重新拆解，而不是继续让模型盲目修改。我不虚构一个固定贡献比例，因为不同任务差异很大，但最终取舍和质量责任在我。",
    details: ["AI 深度参与实现但不承担产品责任", "本人负责问题、方案、验收和质量", "通过测试、Lint、Build 与流程检查验收", "不虚构固定贡献比例"],
    limitations: "不同项目的具体代码分工不同，没有统一百分比。",
    claimIds: ["C2", "C3", "C4", "C5", "C7", "C12"], sourceIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"],
    evaluationGoal: "坦诚说明 AI 参与程度，同时证明本人掌握产品判断和质量控制。",
    exclusivePoints: ["AI 深度参与工程实现", "本人负责需求、取舍和验收", "用工程门禁而非运行结果验收"],
    avoidRepeating: ["重新介绍所有项目", "回避 AI 参与", "虚构代码比例"],
    responseShape: "direct", targetLength: { min: 220, max: 340 }, preferredStoryIds: ["ST3"],
    followUpQuestions: ["举一个 AI 生成结果不符合预期的例子。", "你如何判断原型已经可以交付？", "你和工程师相比的定位是什么？"],
    closingPurpose: "把 AI 协作能力落到产品责任和质量控制。",
  }),
  answer({
    id: "A08",
    question: "他的核心技术能力有哪些？",
    matchKeywords: ["技术能力", "技术栈", "会什么", "技能如何", "sql", "python", "fastapi"],
    standardAnswer: "我的技术能力主要服务于产品判断和快速验证，而不是和纯工程师比较底层开发深度。数据侧，我可以用 SQL、Python 处理数据并理解指标；AI 应用侧，我熟悉 RAG、Prompt、工作流、评测集与 RAGAS 等方法；工程侧，我能理解 FastAPI、Milvus、前端和部署链路，并借助 AI 编程工具完成可运行原型。\n\n这意味着我和算法、工程同学沟通时能够理解约束，也能在需求阶段提前定义数据、接口和验收方式。我的技术价值，是把业务问题翻译成团队可以实现和验证的产品方案。",
    details: ["SQL 与 Python 数据处理", "RAG、Prompt、工作流和评测", "理解应用工程与部署链路", "把业务问题转成实现和验收要求"],
    limitations: "不把产品工程能力包装为纯工程师的底层技术深度。",
    claimIds: ["C2", "C3", "C4", "C5"], sourceIds: ["S1", "S3", "S4", "S5"],
    evaluationGoal: "说明技术能力如何服务产品工作，而不是罗列技术名词。",
    exclusivePoints: ["数据处理与指标理解", "AI 应用链路理解", "把技术约束转成产品和验收要求"],
    avoidRepeating: ["完整成长经历", "审计职责", "项目完成边界"],
    responseShape: "fit_mapping", targetLength: { min: 210, max: 330 }, preferredStoryIds: [],
    followUpQuestions: ["你如何设计 AI 产品评测？", "你能独立完成什么程度的原型？", "你如何与工程团队协作？"],
    closingPurpose: "明确技术能力在产品团队中的实际用途。",
  }),
  answer({
    id: "A09",
    question: "审计经历如何帮助他做 AI 产品？",
    matchKeywords: ["审计经历", "审计帮助", "业务理解"],
    standardAnswer: "审计经历给我的最大帮助，不是增加一个行业标签，而是让我习惯从真实流程和风险出发看产品。做审计时，我需要关注数据从哪里来、过程是否留下证据、异常如何被发现，以及结果能否被复核。\n\n这些习惯可以直接迁移到企业 AI 产品：设计知识库时，我会关注答案是否有引用支持；设计 Agent 工作流时，我会考虑哪些节点必须人工确认；处理企业数据时，我会先界定权限和输出边界。相比只从模型能力出发，我会更早看到一个方案在真实业务中是否可用、是否可控，以及一线执行成本是否合理。",
    details: ["从真实流程和风险看产品", "关注数据来源、证据、异常和复核", "迁移到引用、人审与权限设计", "提前识别企业落地成本"],
    limitations: "不披露审计客户、底稿和企业机密。",
    claimIds: ["C6", "C7", "C9", "C10"], sourceIds: ["S1", "S8", "S9"],
    evaluationGoal: "证明审计经验如何转化为企业 AI 产品方法。",
    exclusivePoints: ["流程与风险意识", "证据链和可复核性", "企业 AI 的人审与数据边界"],
    avoidRepeating: ["重新介绍学校", "完整项目列表", "任职数字"],
    responseShape: "fit_mapping", targetLength: { min: 220, max: 340 }, preferredStoryIds: ["ST4", "ST6"],
    followUpQuestions: ["举一个审计问题转成产品的例子。", "这如何影响你的 Agent 设计？", "你如何处理企业数据边界？"],
    closingPurpose: "突出企业方案的可用、可控和可复核。",
  }),
  answer({
    id: "A10",
    question: "他的德勤 IT 审计实习做了什么？",
    matchKeywords: ["德勤实习", "it审计实习", "ipe"],
    standardAnswer: "我在 2026 年 1 月至 4 月参与德勤 IT 审计实习，工作主要涉及 IPE 与日志核查。具体来说，我需要按照既定审计程序核对系统输出和相关资料、检查记录是否一致，并在不确定处确认口径。\n\n这段经历让我第一次比较具体地理解企业系统中的数据来源、流程控制和证据链，也让我意识到企业产品不能只追求功能可用，还要考虑结果是否可追溯、异常是否能被发现，以及敏感数据如何被限制使用。这些认识后来直接影响了我对知识库引用、Agent 人审和数据边界的设计。",
    details: ["2026 年 1 月至 4 月德勤 IT 审计实习", "IPE 与日志核查", "理解企业系统数据来源和证据链", "迁移到引用、人审和数据边界"],
    limitations: "不披露客户、系统明细、底稿或企业机密。",
    claimIds: ["C9"], sourceIds: ["S1"],
    evaluationGoal: "讲清职责和能力迁移，不把实习包装成 AI 产品任职。",
    exclusivePoints: ["IPE 与日志核查职责", "企业系统数据与证据链", "对 AI 产品可靠性的影响"],
    avoidRepeating: ["财务审计职责", "项目技术栈", "客户和底稿"],
    responseShape: "direct", targetLength: { min: 180, max: 300 }, preferredStoryIds: ["ST6"],
    followUpQuestions: ["IT 审计和财务审计最大的差异是什么？", "这段经历如何影响你的产品设计？", "你如何保护企业敏感数据？"],
    closingPurpose: "落到企业 AI 产品的可靠性意识。",
  }),
  answer({
    id: "A11",
    question: "他的容诚审计实习做了什么？",
    matchKeywords: ["容诚实习", "财务审计实习", "函证盘点"],
    standardAnswer: "我在 2025 年 1 月至 3 月参与容诚财务审计实习，主要接触底稿、函证和盘点等基础审计工作。现场工作让我看到，一项看起来简单的流程，背后往往包含资料收集、多人协作、异常确认和结果留痕。\n\n这段经历对我做产品最直接的影响，是让我更关注一线执行成本。设计企业工具时，我不会只问功能能不能实现，还会考虑资料如何进入系统、用户在哪一步最容易出错、哪些结果需要人工确认，以及工具是否真的减少了重复操作。它为我后来把审计资料整理和日志核查抽象成产品原型提供了业务基础。",
    details: ["2025 年 1 月至 3 月容诚财务审计实习", "底稿、函证和盘点", "理解现场协作和执行成本", "形成审计工具的业务基础"],
    limitations: "不披露客户、底稿或业务数据。",
    claimIds: ["C10"], sourceIds: ["S1"],
    evaluationGoal: "讲清财务审计的一线业务理解如何迁移到产品。",
    exclusivePoints: ["底稿、函证和盘点职责", "一线执行与协作成本", "审计工具的场景来源"],
    avoidRepeating: ["IT 审计职责", "技术组件", "客户和业务数据"],
    responseShape: "direct", targetLength: { min: 180, max: 300 }, preferredStoryIds: ["ST4"],
    followUpQuestions: ["你从审计中发现了什么产品机会？", "你如何判断一个流程值得被 AI 改造？", "你做过哪些审计工具？"],
    closingPurpose: "落到一线业务理解和产品机会识别。",
  }),
  answer({
    id: "A12",
    question: "他有哪些本地优先产品？",
    matchKeywords: ["本地优先", "效率工具", "桌面产品", "downloadsbutler", "downloadbutler", "thirtyminutebrain", "readlaterregret"],
    standardAnswer: "我做过 Thirty-Minute Brain、Read-Later Regret 和 Downloads Butler 三个本地优先工具，分别处理短期上下文恢复、信息债管理和下载文件整理。它们不是三个孤立的技术练习，而是同一种产品方法的不同验证：从自己高频遇到的小摩擦出发，先完成一个边界清楚的闭环。\n\n这类工具都把数据留在本地，并在文件移动、敏感内容或自动处理前保留用户控制。我从中形成的习惯是：对高频问题先用轻量方案验证价值，把隐私和误操作风险直接写进流程，而不是一开始就搭建复杂平台。",
    details: ["三个本地优先效率工具", "从高频小摩擦出发", "数据留在本地并保留用户控制", "先验证轻量闭环"],
    limitations: "不声称拥有公开用户规模、留存或长期价值数据。",
    claimIds: ["C5"], sourceIds: ["S1", "S5", "S6", "S7"], verification: "externally_verified", relatedProject: "local-first-tools",
    evaluationGoal: "展示从小问题快速验证产品闭环和隐私约束的能力。",
    exclusivePoints: ["三个具体小问题", "本地优先与用户控制", "轻量验证方法"],
    avoidRepeating: ["RAG 评测", "审计职责", "生产规模"],
    responseShape: "project_arc", targetLength: { min: 190, max: 310 }, preferredStoryIds: ["ST5"],
    followUpQuestions: ["为什么选择本地优先？", "哪个工具最值得继续做？", "你如何避免文件工具误操作？"],
    closingPurpose: "体现轻量验证和隐私默认设计。",
  }),
  answer({
    id: "A13",
    question: "他如何处理隐私和企业数据？",
    matchKeywords: ["隐私", "企业数据", "数据边界", "机密"],
    standardAnswer: "我处理隐私和企业数据的原则是：先确定数据能不能进入系统，再讨论模型能做什么。具体设计时，我会关注数据来源和授权、最小使用范围、处理位置、输出去向，以及出现异常后如何追溯。\n\n在本地优先工具中，我尽量让数据保留在设备内；在审计相关原型中只使用演示数据，不接触真实客户资料；在 Agent 或知识库流程中，则通过人工确认、引用和明确的输出边界降低误用风险。对企业 AI 产品来说，隐私不是上线前补充的一页说明，而是产品流程本身的一部分。",
    details: ["先判断数据能否进入系统", "关注授权、范围、位置和输出", "本地优先与演示数据", "隐私作为产品流程"],
    limitations: "不披露审计客户、底稿、企业机密或未公开个人信息。",
    claimIds: ["C7", "C12"], sourceIds: ["S1", "S2", "S8", "S9"],
    evaluationGoal: "说明可操作的隐私产品原则，而不是复述拒答政策。",
    exclusivePoints: ["先判断数据使用资格", "本地优先和演示数据", "隐私进入产品流程"],
    avoidRepeating: ["完整审计经历", "模型技术细节", "安全认证"],
    responseShape: "direct", targetLength: { min: 180, max: 300 }, preferredStoryIds: ["ST5"],
    followUpQuestions: ["Agent 产品中哪些节点需要人工确认？", "你如何处理模型输出风险？", "本地优先有什么取舍？"],
    closingPurpose: "强调隐私是产品设计约束。",
  }),
  answer({
    id: "A14",
    question: "他的主要短板是什么？",
    matchKeywords: ["短板", "不足", "能力缺口"],
    standardAnswer: "我目前最需要补强的，不是做出原型的速度，而是让产品在真实用户和长期协作中产生可以持续观察的结果。我的项目已经帮助我形成问题定义、快速验证和评测迭代能力，但在真实用户规模、长期生产稳定性和复杂跨团队推进方面，积累还不够完整。\n\n这个短板会影响我对商业优先级和长期运营问题的判断，所以我不会把原型完成当作产品成功。下一步我希望进入真实业务团队，主动承担用户访谈、指标跟踪、版本复盘和跨职能协作，同时继续发挥快速拆解问题和建立验证闭环的优势。对初级候选人来说，我的价值是上手快、能做出可验证方案，也清楚下一阶段要把能力补到哪里。",
    details: ["真实用户结果积累不足", "长期生产稳定性经验不足", "复杂跨团队推进经验仍需补强", "通过真实业务、指标和复盘补强"],
    limitations: "短板来自当前经历阶段，不等于完全不具备相关能力。",
    claimIds: ["C8"], sourceIds: ["S1", "S10"],
    evaluationGoal: "展现自我认知、影响判断和具体补强行动，不自我否定。",
    exclusivePoints: ["真实用户与长期协作积累不足", "原型完成不等于产品成功", "进入真实团队补强"],
    avoidRepeating: ["再次罗列全部优势", "公开证据措辞", "免责声明"],
    responseShape: "shortcoming", targetLength: { min: 230, max: 360 }, preferredStoryIds: [],
    followUpQuestions: ["你准备如何验证真实用户价值？", "你希望入职后优先补哪项能力？", "你如何看待原型和产品成功的差别？"],
    closingPurpose: "把短板转成明确的成长计划和初级岗位价值。",
  }),
  answer({
    id: "A15",
    question: "请讲一个项目挑战或失败案例。",
    matchKeywords: ["面试核实", "追问", "遇到什么困难", "项目困难", "失败案例", "项目挑战", "挑战", "失败"],
    standardAnswer: "RAG 项目中一个很典型的挑战，是我早期容易把“功能更多”误认为“产品更完整”。当时混合检索、Rerank、引用和自动评测都值得做，但如果同时推进，出现 Bad Case 时很难判断问题究竟来自文档摄入、召回还是生成。\n\n**我的调整**：我把方案重新拆成验证顺序，先用 Dense Retrieval 跑通摄入—检索—生成主链路，建立可以重复检查的基线；再把高级检索和评测能力拆成独立实验，每次只改变少量变量。\n\n**我的验收**：我不再用功能数量判断进展，而是检查召回内容是否相关、回答是否忠于上下文、引用能否支持结论，以及失败样本能否转成下一步任务。这次调整让我认识到，AI 产品经理的重要工作不是不断加能力，而是控制变量、明确取舍，让团队知道下一步为什么值得做。",
    details: ["早期把功能数量误认为完整度", "同时推进导致 Bad Case 难定位", "回到 Dense Retrieval 基线并拆分实验", "用召回、忠实度、引用和失败样本验收"],
    limitations: "这是方案取舍与复盘，不虚构线上事故或业务损失。",
    claimIds: ["C2", "C3", "C4", "C8"], sourceIds: ["S1", "S3", "S4", "S10"], relatedProject: "rag-knowledge-base",
    evaluationGoal: "用真实方案调整证明复盘、控制变量和产品取舍能力。",
    exclusivePoints: ["功能堆叠造成问题定位困难", "建立基线并控制变量", "从功能数量转向质量验收"],
    avoidRepeating: ["泛泛谈产品闭环", "重新介绍 RAG 背景", "虚构线上事故"],
    responseShape: "star", targetLength: { min: 300, max: 480 }, preferredStoryIds: ["ST1", "ST8"],
    followUpQuestions: ["你为什么选择先保留 Dense Retrieval？", "如果再次做这个项目会如何规划？", "DeepFlow 中有类似的取舍吗？"],
    closingPurpose: "落到控制变量和明确取舍的产品能力。",
  }),
  answer({
    id: "A16",
    question: "他的教育背景是什么？",
    matchKeywords: ["教育背景", "学校专业", "东北大学"],
    standardAnswer: "我就读于东北大学应用统计学专业，预计 2027 年毕业。统计学训练对我做 AI 产品最直接的帮助，是让我习惯先定义问题和指标，再选择数据与方法，而不是只凭主观体验判断模型效果。概率统计、数据库和编程相关学习也让我能够理解评测结果、数据质量与技术约束。对我来说，专业背景不是一个标签，而是我建立评测思维和数据判断力的基础。",
    details: ["东北大学应用统计学专业", "预计 2027 年毕业", "形成指标和数据判断习惯"],
    limitations: "教育信息以正式学籍或简历为准。",
    claimIds: ["C1"], sourceIds: ["S1"],
    evaluationGoal: "说明教育背景及其对 AI 产品工作的实际帮助。",
    exclusivePoints: ["应用统计学背景", "指标与数据判断习惯", "评测思维基础"],
    avoidRepeating: ["完整自我介绍", "审计经历", "项目技术栈"],
    responseShape: "direct", targetLength: { min: 130, max: 240 }, preferredStoryIds: [],
    followUpQuestions: ["统计学如何帮助你设计评测？", "你最擅长的数据工具是什么？", "为什么从统计学转向 AI 产品？"],
    closingPurpose: "把专业背景落到评测思维。",
  }),
  answer({
    id: "A17",
    question: "他的英语和证书情况如何？",
    matchKeywords: ["英语", "四六级", "acca", "证书"],
    standardAnswer: "我的 CET-4 成绩是 619，CET-6 是 520，并完成了部分 ACCA 科目学习。英语能力主要帮助我直接阅读海外模型文档、AI 产品案例和工程资料，减少二手信息损耗；ACCA 和会计相关学习则让我更容易理解财务流程、指标和企业业务语言。它们对 AI 产品工作的价值，不是证书数量本身，而是让我能更快进入技术资料和 B 端业务语境。",
    details: ["CET-4 619", "CET-6 520", "部分 ACCA 科目", "支持阅读技术资料和理解企业业务"],
    limitations: "成绩与科目完成情况以正式材料为准。",
    claimIds: ["C1", "C2"], sourceIds: ["S1"],
    evaluationGoal: "说明英语和证书如何支持工作，不罗列无关荣誉。",
    exclusivePoints: ["英语阅读技术资料", "ACCA 支持企业业务理解"],
    avoidRepeating: ["学校背景", "项目经历", "三项个人优势"],
    responseShape: "direct", targetLength: { min: 120, max: 220 }, preferredStoryIds: [],
    followUpQuestions: ["你通常如何跟踪海外 AI 产品？", "财务知识如何帮助你理解 B 端场景？", "你最近在学习什么？"],
    closingPurpose: "落到技术信息获取和企业语境理解。",
  }),
  answer({
    id: "A18",
    question: "Ask Me 项目体现了什么能力？",
    matchKeywords: ["ask me能力", "数字分身", "本项目能力"],
    standardAnswer: "Ask Me 最能体现的是我如何把一个求职目标转成完整的 AI 产品，而不只是做一个聊天页面。传统简历信息密度低、不能追问，项目贡献又很难在短时间讲清楚，所以我先重新定义招聘方的决策路径，再设计候选人摘要、核心问题、项目追问、简历入口和转化事件。\n\n在回答层，我建立了结构化知识、稳定回答、事实门禁和多轮上下文；在工程层，我接入模型、限流、预算、匿名分析和固定简历地址；在迭代层，我用自动评测和模拟面试持续发现回答僵硬、重复和过度强调边界的问题。它体现的是需求洞察、产品取舍、AI 协作和持续验收能力。",
    details: ["从招聘决策路径定义产品", "结构化知识、稳定回答和事实门禁", "模型、限流、分析与简历链路", "通过评测持续修正回答体验"],
    limitations: "项目仍需真人招聘者验证实际面试转化价值。",
    claimIds: ["C12"], sourceIds: ["S2"], relatedProject: "ask-me",
    evaluationGoal: "证明从招聘问题到 AI 产品闭环的完整设计能力。",
    exclusivePoints: ["招聘决策路径", "回答、工程和转化三层设计", "根据评测修正产品方向"],
    avoidRepeating: ["完整自我介绍", "RAG 项目细节", "无关技术栈"],
    responseShape: "project_arc", targetLength: { min: 230, max: 360 }, preferredStoryIds: ["ST3", "ST8"],
    followUpQuestions: ["你为什么要做这个项目？", "你如何判断回答质量？", "这个项目目前最大的不足是什么？"],
    closingPurpose: "落到需求洞察、产品取舍和持续验收。",
  }),
  answer({
    id: "A19",
    question: "公开项目是否有真实用户增长数据？",
    matchKeywords: ["用户增长", "用户规模", "真实用户", "用户测试", "满意度", "服务什么用户", "什么用户", "业务价值", "解决什么业务问题", "目前有什么价值", "留存数据", "结果如何", "项目结果", "生产状态"],
    standardAnswer: "目前我的公开项目主要完成了问题定义、核心流程和可演示原型，还没有形成可以公开说明的用户测试次数、满意度提升、大规模用户增长、留存或商业化数据。已经能够确认的成果，是 RAG 的文档问答主链路、DeepFlow 的研究工作台 MVP，以及多个本地优先工具的完整使用闭环。\n\n我不会把原型完成包装成市场验证。下一步真正需要补的是让目标用户完成真实任务，记录完成率、使用阻力、重复使用和关键 Bad Case，再决定哪些能力值得继续投入。对我来说，当前结果证明了落地和验证能力，下一阶段才是产品价值与规模的验证。",
    details: ["已形成问题定义、核心流程和可演示原型", "没有公开的大规模增长或留存数据", "下一步通过真实任务和反馈验证"],
    limitations: "公开证据不足不代表项目没有任何使用者。",
    claimIds: ["C3", "C4", "C5", "C8"], sourceIds: ["S1", "S3", "S4", "S5", "S6", "S7", "S10"],
    evaluationGoal: "清楚区分原型成果与市场结果，并给出下一步验证方法。",
    exclusivePoints: ["当前成果是产品闭环和原型", "尚无公开规模数据", "下一步验证真实任务和重复使用"],
    avoidRepeating: ["重新罗列个人优势", "免责声明", "虚构用户反馈"],
    responseShape: "shortcoming", targetLength: { min: 210, max: 340 }, preferredStoryIds: [],
    followUpQuestions: ["你会如何设计第一轮用户测试？", "你最希望验证哪个项目？", "原型成功和产品成功有什么差别？"],
    closingPurpose: "区分已经证明的能力和下一阶段产品验证。",
  }),
  answer({
    id: "A20",
    question: "可以根据这些材料直接给出录用结论吗？",
    matchKeywords: ["录用结论", "是否录用", "值得录用", "进入下一轮", "继续面试", "建议进入下一轮"],
    standardAnswer: "我认为自己值得进入下一轮，因为我作为应届候选人已经展示了三项有继续验证价值的能力：能用评测思维定义 AI 效果，能理解企业流程和数据边界，也能把产品判断快速推进成可运行原型。\n\n下一轮不需要再重复询问技术栈，更值得现场验证的是：让我拆解一次 RAG 或 Agent 的关键取舍，说明本人、AI 工具和现成框架分别承担了什么；再给我一个新的企业 AI 场景，看我如何定义用户、目标指标、风险和最小验证方案。如果这些追问能够保持当前材料中的判断深度，我有能力在 AI 产品岗位继续成长并承担实际工作。",
    details: ["建议进入下一轮", "应届阶段已展示评测、业务和落地潜力", "下一轮验证项目取舍与职责分工", "用新场景验证迁移能力"],
    limitations: "进入下一轮建议不等于直接录用结论。",
    claimIds: ["C2", "C3", "C4", "C6", "C8", "C12"], sourceIds: ["S1", "S2", "S3", "S4", "S10"],
    evaluationGoal: "给出明确招聘建议，并告诉面试官下一轮最值得验证什么。",
    exclusivePoints: ["明确建议进入下一轮", "判断依据是应届阶段潜力", "给出项目取舍和新场景两类验证"],
    avoidRepeating: ["完整自我介绍", "再次逐项介绍所有项目", "机械免责声明"],
    responseShape: "recommendation", targetLength: { min: 230, max: 360 }, preferredStoryIds: [],
    followUpQuestions: ["请现场拆解一次最关键的产品取舍。", "给你一个新的企业 AI 场景，你会如何定义 MVP？", "你希望下一轮重点展示哪项能力？"],
    closingPurpose: "明确下一轮验证方向和候选人培养潜力。",
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
