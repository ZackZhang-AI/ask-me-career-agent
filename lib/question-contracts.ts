import { z } from "zod";
import type { QuestionContract, QuestionFacet, QuestionFrame, QuestionTopic, ResponseShape } from "./types";

const topics = ["profile", "role_fit", "rag", "deepflow", "ask_me", "local_tools", "audit", "statistics", "skills", "enterprise_ai", "agent", "unknown"] as const;
const facets = ["overview", "problem", "method", "contribution", "architecture", "collaboration", "evaluation", "transfer", "example", "result", "boundary", "fit"] as const;

export const plannedQuestionFrameSchema = z.object({
  topic: z.enum(topics),
  facet: z.enum(facets),
  requestedDimensions: z.array(z.string().min(2).max(30)).min(1).max(4),
  activeProject: z.enum(["rag-knowledge-base", "deepflow", "ask-me", "local-first-tools", "audit-tools"]).optional(),
  useHistory: z.boolean(),
  confidence: z.number().min(0).max(1),
});

type ContractInput = {
  id: string;
  question: string;
  aliases?: string[];
  topic: QuestionTopic;
  facet: QuestionFacet;
  dimensions: string[];
  knowledge: string[];
  stories?: string[];
  forbidden?: QuestionTopic[];
  shape?: ResponseShape;
  length?: { min: number; max: number };
  goal: string;
  thesis: string;
  required: string[];
  direct: string[];
  fallback: string;
  next?: string[];
};

function define(input: ContractInput): QuestionContract {
  return {
    id: input.id,
    question: input.question,
    aliases: input.aliases ?? [],
    frame: {
      topic: input.topic,
      facet: input.facet,
      requestedDimensions: input.dimensions,
      activeProject: ({ rag: "rag-knowledge-base", deepflow: "deepflow", ask_me: "ask-me", local_tools: "local-first-tools", audit: "audit-tools" } as Partial<Record<QuestionTopic, string>>)[input.topic],
      useHistory: false,
      confidence: 1,
      requiredKnowledgeIds: input.knowledge,
      allowedStoryIds: input.stories ?? [],
      forbiddenTopics: input.forbidden ?? [],
      responseShape: input.shape ?? "direct",
      targetLength: input.length
        ? {
            min: Math.min(input.length.min, Math.max(220, input.fallback.length - 12)),
            max: Math.max(input.length.max, input.fallback.length + 20),
          }
        : { min: 220, max: 480 },
      answerGoal: input.goal,
    },
    thesis: input.thesis,
    requiredPoints: input.required,
    directAnswerTerms: input.direct,
    fallbackAnswer: input.fallback,
    nextContractIds: input.next ?? [],
  };
}

export const questionContracts: QuestionContract[] = [
  define({
    id: "intro", question: "60 秒了解张倬玮。", aliases: ["请用 60 秒介绍张倬玮。", "请介绍一下你自己。"], topic: "profile", facet: "overview",
    dimensions: ["候选人定位", "三项差异", "代表实践"], knowledge: ["K1", "K2", "K3", "K4", "K8"], shape: "narrative", length: { min: 430, max: 600 },
    goal: "让面试官快速形成是否值得继续沟通的候选人判断。", thesis: "我是张倬玮，一名把数据评测、企业业务理解和 AI 产品落地结合起来的应用统计学学生。",
    required: ["应用统计学与数据分析基础", "审计经历形成的流程和风险意识", "RAG 与 Agent 项目体现产品工程能力"], direct: ["数据", "审计", "AI 产品"],
    fallback: "我叫张倬玮，目前就读于东北大学应用统计学专业，目标方向是 AI 产品经理。相比只做需求文档或只关注模型能力，我更擅长把**数据评测、企业业务和产品落地**放在同一条链路里思考。\n\n应用统计学训练让我习惯先定义指标、观察差异并分析失败样本；德勤 IT 审计和容诚财务审计经历，让我理解复杂流程、证据口径、风险控制和企业数据边界；RAG 知识库与 DeepFlow 项目则让我把这些判断落实为检索、评测、Agent 分工、人审和可演示 MVP。\n\n在具体项目里，我通常先确认用户到底要完成什么任务，再把问题拆成数据、流程、模型与人工确认节点，并提前定义怎样才算有效。面对复杂方案，我倾向于先跑通最短闭环，用评测集和 Bad Case 判断下一步，而不是为了技术完整度一次堆满功能。\n\n我主要负责问题定义、产品取舍、评测设计和最终验收，AI 编程工具承担实现协作。我的特点不是单点技术最深，而是能把业务问题翻译成**可实现、可验证、可继续迭代**的 AI 产品方案，并让业务与技术围绕同一个结果真正推进。",
    next: ["role_fit", "representative_project", "differentiation"],
  }),
  define({
    id: "role_fit", question: "你为什么适合 AI 产品经理岗位？", aliases: ["他为什么适合 AI 产品经理岗位？", "你能为 AI 产品团队带来什么价值？", "他能为 AI 产品团队带来什么价值？"], topic: "role_fit", facet: "fit",
    dimensions: ["岗位匹配", "差异化能力", "入职价值"], knowledge: ["K2", "K3", "K4", "K8"], shape: "fit_mapping", length: { min: 320, max: 480 },
    goal: "说明候选人与初级 AI 产品岗位的具体匹配关系。", thesis: "我适合 AI 产品岗位，核心不是会使用模型，而是能把业务问题、质量验证和工程落地连起来。",
    required: ["数据与评测能力", "企业流程和风险理解", "产品工程推进能力"], direct: ["适合", "评测", "业务", "落地"],
    fallback: "我适合 AI 产品经理岗位，核心不是单纯会使用模型，而是能把**业务问题、质量验证和工程落地**连起来。应用统计学背景让我习惯先明确指标和比较基线，再通过数据与 Bad Case 判断方案是否有效；审计经历让我理解企业流程中的证据、权限、口径和风险，而不是把 AI 场景想象成孤立的聊天功能。\n\n在 RAG、DeepFlow 和 Ask Me 项目中，我负责的问题定义、方案取舍、评测设计与最终验收，AI 编程工具作为工程协作者。这意味着我既能和技术讨论检索、Agent 工作流和可观测性，也能持续追问它解决了谁的什么问题、如何验证以及什么时候需要人工确认。对初级 AI 产品岗位来说，我可以较快承担需求分析、原型推进、评测迭代和跨角色沟通。",
    next: ["representative_project", "business_to_ai", "evaluation"],
  }),
  define({
    id: "representative_project", question: "哪个项目最能代表你的 AI 产品能力？", aliases: ["哪个项目最能代表他的 AI 产品能力？", "介绍一下你的 RAG 知识库项目。"], topic: "rag", facet: "overview",
    dimensions: ["项目问题", "个人判断", "产品闭环"], knowledge: ["K4", "K14", "K17"], stories: ["ST1"], shape: "project_arc", length: { min: 340, max: 520 }, forbidden: ["deepflow", "local_tools", "audit"],
    goal: "用一个项目证明候选人的 AI 产品完整能力。", thesis: "最能代表我 AI 产品能力的是 RAG Knowledge Base System，因为它同时考验问题定义、检索质量、评测和工程推进。",
    required: ["专业文档问答问题", "检索与生成链路", "评测和 Bad Case 迭代"], direct: ["RAG", "检索", "评测"],
    fallback: "最能代表我 AI 产品能力的是 **RAG Knowledge Base System**。我把它定位为专业文档问答系统，重点不是把资料接给模型，而是让知识摄入、检索、回答、引用和评测形成一条可以持续改进的链路。\n\n我的主要工作是确定产品定位、梳理端到端流程、设计检索策略与评测方式，并推动整体实现和验收。面对功能列表不断扩张的问题，我选择先把 Dense Retrieval 主链路和质量基线跑通，再依据 Bad Case 判断是否投入混合检索、Rerank 或其他能力。\n\n这个项目体现了我的产品方法：先把用户问题翻译成系统链路，再为关键环节定义验证方式，最后根据失败样本安排迭代优先级。AI 编程工具参与代码实现和调试，但问题定义、取舍与验收由我负责。",
    next: ["project_contribution", "rag_methods", "evaluation"],
  }),
  define({
    id: "project_contribution", question: "你在代表项目中负责哪些核心工作？", aliases: ["他在代表项目中负责哪些核心工作？", "你在 RAG 项目中的个人贡献是什么？", "你的核心贡献是什么？", "他在 RAG 项目中负责什么？", "你在这个项目中最关键的产品取舍是什么？", "最难的产品取舍是什么？"], topic: "rag", facet: "contribution",
    dimensions: ["本人判断", "核心行动", "验收责任"], knowledge: ["K4", "K17", "K14"], stories: ["ST1"], shape: "contribution", length: { min: 330, max: 500 }, forbidden: ["deepflow", "local_tools", "audit"],
    goal: "清楚区分候选人判断与 AI 工具协作。", thesis: "我在 RAG 项目中负责的核心不是堆功能，而是决定做什么、为什么这样取舍以及如何验收。",
    required: ["产品定位", "检索和评测取舍", "整体推进与验收"], direct: ["负责", "取舍", "验收"],
    fallback: "我在 RAG 项目中负责的核心不是简单堆功能，而是决定**做什么、为什么这样取舍、如何验收**。我先把专业文档问答拆成知识摄入、检索、回答、引用和评测几个关键环节，明确 Dense Retrieval 是当前需要优先跑通的主链路。\n\n随后我围绕召回质量、回答忠实度和 Bad Case 回流设计迭代方式，并根据当前实现复杂度判断哪些能力应先验证、哪些暂时保留在规划中。工程实现、调试和文档整理中使用了 AI 编程工具，但需求拆解、技术选型取舍、评测关注点和最终质量判断由我负责。\n\n我的验收标准不是页面能运行，而是关键链路可演示、问题能够定位、下一轮优化有明确依据。",
    next: ["rag_methods", "evaluation", "ai_coding"],
  }),
  define({
    id: "business_to_ai", question: "你如何把业务问题转化为 AI 产品方案？", aliases: ["他如何把业务问题转化为 AI 产品方案？"], topic: "enterprise_ai", facet: "method",
    dimensions: ["业务任务", "方案分工", "验证闭环"], knowledge: ["K7", "K17", "K21"], stories: ["ST4"], length: { min: 300, max: 460 },
    goal: "展示从业务问题到可验证 AI 方案的产品方法。", thesis: "我通常先确认用户任务、流程阻力和验收标准，再决定规则、模型与人工确认分别承担什么。",
    required: ["问题和流程拆解", "规则模型人工分工", "轻量验证与升级"], direct: ["业务问题", "方案", "验证"],
    fallback: "我不会从“这里能不能加一个模型”开始，而是先把业务问题拆成**用户任务、流程阻力和验收标准**。例如审计资料整理与日志核查中，真正的问题往往是字段多、规则重复、证据难追踪和人工复核成本高，因此需要先确定哪些步骤适合规则化，哪些需要模型辅助，哪些必须保留人工确认。\n\n然后我会用最轻量的方案验证闭环：输入是什么、模型或规则产出什么、用户在哪里确认、错误如何被记录。只有职责、工具或评价标准明显不同，才考虑拆分 Agent；只有基础方案已经证明有价值，才依据并发、数据规模和流程复杂度升级架构。这样得到的不是为了展示 AI 的功能，而是一条能被业务理解、使用和继续改进的产品流程。",
    next: ["audit_product_example", "enterprise_ai", "evaluation"],
  }),
  define({
    id: "evaluation", question: "你如何评估并改进 AI 产品效果？", aliases: ["他如何评估并改进 AI 产品效果？", "你如何定义并验收 AI 产品效果？", "他如何定义并验收 AI 产品效果？", "你如何评估 RAG 回答质量？"], topic: "skills", facet: "evaluation",
    dimensions: ["目标指标", "分层评测", "Bad Case 决策"], knowledge: ["K14", "K17", "K21"], stories: ["ST1", "ST3"], length: { min: 300, max: 470 },
    goal: "说明候选人如何用评测推动产品迭代。", thesis: "我会先把“效果好”拆成可观察的链路指标，再用 Bad Case 决定下一轮优先级。",
    required: ["链路分层指标", "固定评测集", "Bad Case 分类和单变量验证"], direct: ["评估", "指标", "Bad Case"],
    fallback: "我会先把“效果好”拆成可观察的链路指标，而不是只看一条最终答案。以 RAG 为例，我会分别关注知识摄入是否正确、召回证据是否相关完整、回答是否忠实使用证据、引用能否追溯，再准备一组固定问题作为质量基线。\n\n每轮迭代后，我会把失败样本按数据、检索、生成、引用或评测口径分类，判断问题集中在哪个环节。**Bad Case 的分布**比单一平均分更能决定优先级：如果证据没有召回，先改检索；证据正确但回答偏离，再看生成约束；如果结论波动来自标注口径，就先修评测。每轮尽量只改变一个关键变量并复用同一问题集，确保改进能够被解释和复现。",
    next: ["data_evaluation", "rag_methods", "speed_quality"],
  }),
  define({
    id: "statistics_product", question: "应用统计学背景如何帮助你做 AI 产品？", aliases: ["应用统计学背景如何帮助他做 AI 产品？", "你的统计学背景能怎样支持产品决策？", "他的统计学背景能怎样支持产品决策？"], topic: "statistics", facet: "transfer",
    dimensions: ["指标定义", "不确定性判断", "产品决策"], knowledge: ["K3", "K17"], forbidden: ["deepflow", "audit", "local_tools"], length: { min: 280, max: 440 },
    goal: "把统计训练具体映射到 AI 产品决策。", thesis: "统计学背景对我最大的帮助，是让我在做产品判断时先问指标是否可信、差异来自哪里以及结论能否复现。",
    required: ["指标与样本意识", "分层分析和失败样本", "用数据支持取舍"], direct: ["统计", "指标", "产品决策"],
    fallback: "统计学背景对我最大的帮助，是让我在做产品判断时先问三个问题：**指标是否可信、差异来自哪里、结论能否复现**。这会直接影响 AI 产品的评测设计，而不只是用于事后做报表。\n\n在项目中，我会先明确要验证的用户任务和成功标准，再固定样本与评价口径，把整体结果拆到不同类型的 Bad Case 中观察。如果平均表现变化不大，但某一类高价值问题持续失败，产品优先级就不应该被平均数掩盖；如果样本或标注口径变化，模型结果也不能直接横向比较。\n\n因此统计训练让我更习惯用基线、分层、对照和误差分析支持产品取舍，把“感觉模型更好了”转化为可以讨论、验证和继续迭代的判断。",
    next: ["data_evaluation", "evaluation", "differentiation"],
  }),
  define({
    id: "audit_value", question: "审计经历如何帮助你做 AI 产品？", aliases: ["审计经历如何帮助他做 AI 产品？", "你如何把审计经验迁移到企业 AI 场景？", "他如何把审计经验迁移到企业 AI 场景？"], topic: "audit", facet: "transfer",
    dimensions: ["流程理解", "证据意识", "企业风险"], knowledge: ["K8", "K9", "K7"], stories: ["ST4", "ST6"], forbidden: ["rag", "deepflow", "local_tools"], length: { min: 280, max: 450 },
    goal: "解释审计经历向企业 AI 产品能力的迁移。", thesis: "审计经历让我理解企业 AI 的价值不仅是自动化，还包括证据、口径、权限和人工复核。",
    required: ["复杂流程理解", "证据与风险意识", "产品化迁移"], direct: ["审计", "企业 AI", "证据"],
    fallback: "审计经历让我理解，企业 AI 的价值不能只用“自动化了多少步骤”衡量，还要看**证据是否可追踪、口径是否一致、风险是否可控制**。在 IT 审计和财务审计中，我接触到日志核查、IPE、底稿、函证和盘点等工作，它们共同特点是流程复杂、字段多、结论需要依据，并且关键节点必须保留人工判断。\n\n这会影响我做 AI 产品的方式：先梳理真实工作流和高成本环节，再判断规则、模型与人工分别适合承担什么；对模型输出保留来源、状态和复核入口；对客户资料与内部数据设置清晰边界。审计经历带给我的不是某个行业标签，而是一套更适合企业场景的流程理解和风险意识。",
    next: ["audit_product_example", "internship_transfer", "enterprise_ai"],
  }),
  define({
    id: "internship_transfer", question: "你的实习经历沉淀了哪些可迁移能力？", aliases: ["他的实习经历沉淀了哪些可迁移能力？"], topic: "audit", facet: "transfer",
    dimensions: ["结构化分析", "风险与证据", "沟通推进"], knowledge: ["K8", "K9", "K10"], stories: ["ST6", "ST7"], length: { min: 300, max: 460 },
    goal: "总结多段经历对 AI 产品岗位的可迁移价值。", thesis: "几段实习沉淀出的共性能力，是快速理解复杂流程、按证据判断问题并把多人协作推进到可交付状态。",
    required: ["复杂流程拆解", "证据和细节意识", "沟通与现场推进"], direct: ["实习", "可迁移", "流程", "沟通"],
    fallback: "几段实习沉淀出的共性能力，是**快速理解复杂流程、按证据判断问题、把协作推进到可交付状态**。德勤 IT 审计中的 IPE 与日志核查训练了我对系统流程、数据口径和证据链的敏感度；容诚财务审计中的底稿、函证和盘点，让我习惯在大量细节中保持结构化和可追踪；校园大使经历则补充了现场沟通与活动协调。\n\n这些能力可以直接迁移到 AI 产品工作：面对陌生业务时先梳理角色、输入输出和风险节点；讨论模型效果时要求结论有样本和依据；推进原型时及时对齐需求、状态和验收标准。它们让我不仅能提出方案，也更重视方案进入真实流程后是否可控、可解释和能被团队接住。",
    next: ["audit_value", "business_to_ai", "differentiation"],
  }),
  define({
    id: "education_combination", question: "你的教育与项目经历形成了怎样的能力组合？", aliases: ["他的教育与项目经历形成了怎样的能力组合？", "你的经历形成了哪些差异化能力组合？", "他的经历形成了哪些差异化能力组合？"], topic: "profile", facet: "fit",
    dimensions: ["数据能力", "业务理解", "产品工程"], knowledge: ["K3", "K8", "K4", "K5"], shape: "fit_mapping", length: { min: 300, max: 470 },
    goal: "解释候选人经历组合的差异化。", thesis: "我的经历形成了数据评测、企业业务理解和产品工程落地三项互相支撑的能力。",
    required: ["统计与数据", "审计与企业流程", "RAG 和 Agent 项目"], direct: ["能力组合", "数据", "业务", "产品"],
    fallback: "我的经历形成了三项互相支撑的能力：**数据评测、企业业务理解和产品工程落地**。应用统计学学习让我具备指标、样本、分析和不确定性意识；德勤与容诚的审计经历让我理解企业流程、证据口径、风险和人工复核；RAG、DeepFlow 与 Ask Me 等项目则让我把问题定义、工作流、评测和工程实现连接起来。\n\n这三部分并不是简单叠加。统计能力帮助我判断 AI 产品是否真的改善；业务经历帮助我识别哪些流程值得自动化、哪些节点不能交给模型；项目实践让我能把判断转成原型、接口、评测集和验收门禁。对 AI 产品岗位来说，这种组合让我可以同时和业务、数据与工程沟通，并持续把讨论落到可验证的产品动作上。",
    next: ["role_fit", "statistics_product", "representative_project"],
  }),
  define({
    id: "technical_skills", question: "你的核心技术能力有哪些？", aliases: ["他的核心技术能力有哪些？"], topic: "skills", facet: "overview",
    dimensions: ["数据分析", "AI 产品技术", "工程协作"], knowledge: ["K3", "K4", "K5"], length: { min: 260, max: 430 }, goal: "用产品视角说明技术能力边界。",
    thesis: "我的技术能力重点不是单一框架熟练度，而是能理解并推进 AI 产品从数据、模型到工程链路。", required: ["SQL 与 Python", "RAG 和评测", "API 与工作流"], direct: ["技术能力", "数据", "RAG"],
    fallback: "我的技术能力重点不是单一框架熟练度，而是能理解并推进 AI 产品从数据、模型到工程链路。数据侧使用 SQL、Python 完成处理和分析；AI 产品侧接触 Prompt、RAG、Dense Retrieval、Milvus、RAGAS 与 Agent 工作流；工程协作侧能够理解 FastAPI、异步任务、存储、容器部署和接口联调。\n\n我不会把自己包装成资深算法或后端工程师。我的优势是能读懂这些组件的能力边界，把它们映射到用户问题、质量指标和交付风险，并借助 AI 编程工具完成原型实现、调试与测试。最终由我负责的是技术方案是否服务于产品目标，以及结果能否被验证和验收。",
    next: ["data_evaluation", "ai_coding", "tech_collaboration"],
  }),
  define({
    id: "data_evaluation", question: "你在数据分析与 AI 评测方面有哪些实践？", aliases: ["他在数据分析与 AI 评测方面有哪些实践？"], topic: "skills", facet: "evaluation",
    dimensions: ["数据分析方法", "AI 评测链路", "迭代决策"], knowledge: ["K3", "K14", "K17", "K21"], length: { min: 300, max: 470 }, goal: "展示数据分析和 AI 评测如何共同支持迭代。",
    thesis: "我会把数据分析和 AI 评测放在同一条迭代链路里：先定义问题，再分层定位，最后用失败样本决定动作。", required: ["SQL Python 数据基础", "检索回答引用分层", "Bad Case 回流"], direct: ["数据分析", "AI 评测", "Bad Case"],
    fallback: "我会把数据分析和 AI 评测放在同一条迭代链路里：先定义问题，再分层定位，最后用失败样本决定动作。应用统计学与 SQL、Python 训练让我能够整理数据、定义指标并观察不同样本之间的差异。\n\n在 RAG 项目中，我把质量拆成知识摄入、召回、回答、引用和评测环节，而不是只看最终文本是否流畅；在 DeepFlow 中，则关注 Agent 任务状态、人审节点、过程记录和报告资产。每轮迭代都需要固定基线，把 Bad Case 按原因分类，再判断下一步应改数据、检索策略、生成约束还是流程设计。\n\n这种做法的价值是让产品决策有可解释依据，避免因为少量演示效果很好就误判整体质量。",
    next: ["evaluation", "statistics_product", "rag_methods"],
  }),
  define({
    id: "enterprise_ai", question: "你对企业级 AI 场景有哪些理解？", aliases: ["他对企业级 AI 场景有哪些理解？"], topic: "enterprise_ai", facet: "method",
    dimensions: ["流程价值", "可控性", "持续验证"], knowledge: ["K8", "K17", "K21"], length: { min: 300, max: 460 }, goal: "说明企业 AI 与演示型 AI 的差异。",
    thesis: "我理解企业级 AI 的重点不是展示模型能力，而是进入真实流程后仍然有价值、可控并且能够持续验证。", required: ["进入真实流程", "证据权限和人工复核", "评测验证和错误回流"], direct: ["企业级 AI", "流程", "可控"],
    fallback: "我理解企业级 AI 的重点不是展示模型能力，而是进入真实流程后仍然**有价值、可控并且能够持续验证**。产品首先要找准高频、高成本或容易出错的任务，再明确输入数据是否有资格使用、模型输出由谁确认、错误如何回流。\n\n审计经历让我特别关注证据、权限、口径和人工复核；RAG 项目让我看到检索、引用与评测决定回答能否被信任；DeepFlow 则体现了 Agent 自主性必须配合任务状态、过程观测和关键人审节点。\n\n因此企业 AI 方案应先用轻量流程验证价值，再根据数据规模、并发和协作复杂度升级，而不是一开始追求最复杂的 Agent 架构。能否进入业务流程并被稳定验收，比一次演示是否惊艳更重要。",
    next: ["business_to_ai", "audit_value", "speed_quality"],
  }),
  define({
    id: "ai_coding", question: "你如何使用 AI 编程工具提升交付效率？", aliases: ["他如何使用 AI 编程工具提升交付效率？", "这些项目里 AI 编程工具承担了多少工作？"], topic: "skills", facet: "collaboration",
    dimensions: ["工具承担内容", "本人判断", "质量门禁"], knowledge: ["K4", "K5", "K12"], stories: ["ST3"], length: { min: 300, max: 470 }, goal: "说明人机分工而不虚构贡献比例。",
    thesis: "我把 AI 编程工具当作工程协作者，用它提高实现和调试速度，但不把产品判断与验收外包给模型。", required: ["AI 辅助实现调试文档", "本人负责问题取舍", "测试和质量门禁"], direct: ["AI 编程", "工程协作者", "验收"],
    fallback: "我把 AI 编程工具当作工程协作者，用它提高代码实现、调试、测试补充和文档整理的速度，但不会把**问题定义、产品取舍和最终验收**外包给模型。开始前我先明确目标、接口和完成标准，再让工具处理可拆分的工程任务。\n\n生成结果不会直接视为完成。我会检查关键链路、运行测试、复核异常分支，并通过事实门禁、隐私扫描和回归用例验证输出。遇到工具反复修补却无法解释的问题，会回到需求或架构层重新拆分，而不是继续叠加提示词。\n\n我不虚构一个精确的代码贡献比例。更重要的职责边界是：AI 提高执行效率，我负责决定做什么、接受什么结果以及哪些风险不能被带到产品里。",
    next: ["project_contribution", "speed_quality", "technical_skills"],
  }),
  define({
    id: "differentiation", question: "你最值得面试官关注的三项优势是什么？", aliases: ["他最值得面试官关注的三项优势是什么？"], topic: "role_fit", facet: "fit",
    dimensions: ["数据评测", "企业业务", "产品落地"], knowledge: ["K2", "K3", "K8", "K4"], shape: "fit_mapping", length: { min: 280, max: 440 }, goal: "形成清晰可记忆的差异点。",
    thesis: "我最值得关注的三项优势是数据评测、企业业务理解和产品工程落地。", required: ["数据评测", "审计业务理解", "AI 产品落地"], direct: ["三项优势", "数据", "业务", "落地"],
    fallback: "我最值得面试官关注的三项优势是 **数据评测、企业业务理解和产品工程落地**。第一，应用统计学背景让我习惯先定义指标、建立基线并通过失败样本定位问题，而不是只凭演示感受判断 AI 效果。\n\n第二，德勤 IT 审计和容诚财务审计经历让我理解复杂流程、证据口径、权限风险和人工复核，这使我更适合思考企业 AI，而不只是消费级聊天功能。第三，我通过 RAG、DeepFlow 和 Ask Me 等项目，把产品定位、检索或 Agent 工作流、评测设计和工程实现连成可演示链路。三者结合，让我能够在业务、数据和技术之间完成翻译，并把讨论推进到可验证的产品动作。",
    next: ["role_fit", "representative_project", "education_combination"],
  }),
  define({
    id: "work_scope", question: "你最能胜任哪些 AI 产品工作？", aliases: ["他最能胜任哪些 AI 产品工作？"], topic: "role_fit", facet: "fit",
    dimensions: ["需求分析", "评测迭代", "原型交付"], knowledge: ["K2", "K4", "K5", "K8"], length: { min: 260, max: 430 }, goal: "让面试官快速判断可承担的工作范围。",
    thesis: "现阶段我最能胜任的是 AI 产品需求分析、原型推进、评测迭代和企业流程型场景的方案设计。", required: ["需求和流程拆解", "RAG Agent 评测", "工程协作与验收"], direct: ["胜任", "需求", "评测", "原型"],
    fallback: "现阶段我最能胜任的是 **AI 产品需求分析、原型推进、评测迭代和企业流程型场景的方案设计**。我能够把模糊业务问题拆成用户任务、流程节点和验收标准，再与技术讨论 RAG、Agent、规则或人工确认应如何分工。\n\n在推进过程中，我可以负责需求优先级、原型范围、评测集、Bad Case 分类和最终验收，并借助 AI 编程工具完成必要的工程实现与联调。审计经历也让我对企业数据、证据和风险节点更敏感。\n\n我目前不是资深算法或大型商业化产品负责人，更适合从一个具体场景切入，用较快的原型和严谨的验证建立产品闭环，再逐步承担更复杂的产品责任。",
    next: ["business_to_ai", "tech_collaboration", "role_fit"],
  }),
  define({
    id: "demo_results", question: "你有哪些可以直接演示的项目成果？", aliases: ["他有哪些可以直接演示的项目成果？"], topic: "profile", facet: "result",
    dimensions: ["代表成果", "演示内容", "完成边界"], knowledge: ["K4", "K5", "K6", "K7", "K12"], length: { min: 280, max: 440 }, goal: "说明可演示成果而不冒充生产规模。",
    thesis: "目前可以直接展示的成果包括 RAG 知识库主链路、DeepFlow 多 Agent MVP、Ask Me 数字分身以及几类本地优先和审计工具原型。", required: ["RAG", "DeepFlow", "Ask Me 或工具原型"], direct: ["演示", "RAG", "DeepFlow"],
    fallback: "目前可以直接展示的成果主要有三类。第一是 **RAG Knowledge Base System**，可以说明专业文档摄入、Dense Retrieval、回答生成以及围绕引用和评测设计的完整链路。第二是 DeepFlow 多 Agent 研究工作台，已经形成 Coordinator、Planner、Researcher、Coder 和 Reporter 协作的可演示 MVP。\n\n第三类是 Ask Me 数字分身、本地优先效率工具和审计资料工具原型，它们分别体现内容检索与回答门禁、隐私优先设计，以及把重复业务流程转成产品方案的能力。\n\n这些成果适合用于展示我的问题定义、产品取舍、评测和工程推进能力，但我不会把可演示原型描述成已经拥有真实用户规模或生产商业化结果。",
    next: ["representative_project", "project_contribution", "speed_quality"],
  }),
  define({
    id: "rag_methods", question: "RAG 项目体现了你哪些产品方法？", aliases: ["RAG 项目体现了他哪些产品方法？", "RAG 项目中有哪些产品取舍？", "RAG 项目还有哪些取舍？"], topic: "rag", facet: "method",
    dimensions: ["问题分层", "质量闭环", "迭代取舍"], knowledge: ["K14", "K17", "K15"], stories: ["ST1"], forbidden: ["deepflow", "audit", "local_tools"], length: { min: 300, max: 460 }, goal: "回答 RAG 项目背后的产品方法，而不是复述架构。",
    thesis: "RAG 项目最能体现我的三种产品方法：按用户链路拆问题、用评测建立质量基线、依据 Bad Case 控制迭代范围。", required: ["用户链路拆解", "评测基线", "Bad Case 和范围取舍"], direct: ["产品方法", "评测", "Bad Case"],
    fallback: "RAG 项目最能体现我的三种产品方法。第一是**按用户链路拆问题**：我没有把它理解成一次模型调用，而是拆成知识摄入、解析切片、检索、回答、引用和评测，每一环都对应不同的用户风险。\n\n第二是先建立质量基线，再讨论高级能力。当前优先跑通 Dense Retrieval 主链路，通过固定问题集和 Bad Case 判断召回、回答或引用哪里出错，而不是看到功能列表就同时投入混合检索、Rerank 和更多架构。\n\n第三是根据证据控制迭代范围：先用轻量方案验证闭环，只有失败样本明确指向某个瓶颈，才增加复杂度。这让我能够把技术选型转化为产品优先级，而不是用技术名词代替用户价值。",
    next: ["evaluation", "project_contribution", "speed_quality"],
  }),
  define({
    id: "deepflow_thinking", question: "DeepFlow 体现了你哪些多 Agent 产品思考？", aliases: ["DeepFlow 体现了他哪些多 Agent 产品思考？"], topic: "deepflow", facet: "method",
    dimensions: ["任务拆分", "自主与可控", "过程观测"], knowledge: ["K18", "K19", "K21"], stories: ["ST2"], forbidden: ["rag", "audit", "local_tools"], length: { min: 300, max: 470 }, goal: "说明多 Agent 设计的产品判断。",
    thesis: "DeepFlow 体现的核心不是 Agent 数量，而是如何按职责拆任务、控制自主性并让过程可观察。", required: ["角色职责和交接", "人审节点", "状态与报告资产"], direct: ["Agent", "分工", "人审", "观测"],
    fallback: "DeepFlow 体现的核心不是 Agent 数量，而是**如何按职责拆任务、控制自主性并让过程可观察**。Coordinator 负责组织任务，Planner 拆解研究计划，Researcher 和 Coder 分别处理资料与分析执行，Reporter 汇总报告；角色划分服务于不同工具、上下文和评价标准，而不是为了形式上显得复杂。\n\n产品取舍上，我不会让复杂研究任务一次性完全交给模型。高成本或方向性节点需要人工确认，过程要保留任务状态、关键字段和产物链路，便于发现计划跑偏、资料不足或报告无法追溯。\n\n因此我对多 Agent 的理解是：先用轻量工作流验证闭环，只有职责和评价标准确实不同才拆 Agent，并用人审与可观测性换取可控的自主执行。",
    next: ["agent_collaboration", "project_contribution", "enterprise_ai"],
  }),
  define({
    id: "requirements", question: "你在需求分析和方案设计方面有哪些实践？", aliases: ["他在需求分析和方案设计方面有哪些实践？"], topic: "skills", facet: "method",
    dimensions: ["问题定义", "方案取舍", "验收闭环"], knowledge: ["K7", "K17", "K21"], stories: ["ST4"], length: { min: 280, max: 450 }, goal: "用多个实践说明需求到方案的能力。",
    thesis: "我的需求分析习惯是先确认真实任务和流程阻力，再把方案范围、风险与验收方式同时定义出来。", required: ["用户任务和流程", "规则模型人工分工", "验证与验收"], direct: ["需求分析", "方案设计", "验收"],
    fallback: "我的需求分析习惯是先确认真实任务和流程阻力，再把**方案范围、风险与验收方式**同时定义出来。在审计工具中，我从资料归档、日志核查等重复工作识别字段、规则和复核节点；在 RAG 项目中，把专业问答拆成摄入、检索、回答、引用和评测；在 DeepFlow 中，则根据角色职责和工具差异设计 Agent 分工。\n\n方案阶段我会明确哪些问题用规则即可，哪些适合模型，哪些必须由人确认，并优先用最轻量原型验证闭环。验收不是“功能已经写完”，而是用户任务能否完成、错误能否定位、关键风险是否可控，以及下一轮优化有没有数据和 Bad Case 依据。",
    next: ["business_to_ai", "audit_product_example", "evaluation"],
  }),
  define({
    id: "speed_quality", question: "你如何平衡原型速度与交付质量？", aliases: ["他如何平衡原型速度与交付质量？"], topic: "skills", facet: "method",
    dimensions: ["MVP 范围", "质量底线", "升级条件"], knowledge: ["K12", "K17", "K21"], stories: ["ST3"], length: { min: 280, max: 440 }, goal: "展示快速交付但不牺牲关键质量的取舍。",
    thesis: "我会压缩功能范围来换速度，但不会压缩决定可信度的验证、隐私和关键异常处理。", required: ["最短闭环和功能范围", "测试和质量门禁", "Bad Case 后升级"], direct: ["原型速度", "交付质量", "MVP"],
    fallback: "我平衡**原型速度与交付质量**的方法，是压缩功能范围，但不压缩决定可信度的验证、隐私和关键异常处理。原型阶段先找最短闭环，只实现完成用户任务所必需的链路；例如 RAG 先跑通主检索路径，Agent 先验证角色交接和人审节点，而不是一次做完所有高级功能。\n\n与此同时，我会为关键环节设底线：输入是否合法、模型结果是否越界、核心流程是否有测试、失败是否能被定位。AI 编程工具可以提高实现速度，但生成代码仍要经过构建、测试和质量门禁。\n\n只有轻量方案已经证明有价值，并且 Bad Case、数据规模或协作复杂度明确暴露瓶颈时，才升级架构。这样速度来自减少不必要范围，而不是把风险推迟到交付之后。",
    next: ["ai_coding", "evaluation", "rag_methods"],
  }),
  define({
    id: "starting_scenarios", question: "你适合从哪些业务场景开始创造价值？", aliases: ["他适合从哪些业务场景开始创造价值？"], topic: "role_fit", facet: "fit",
    dimensions: ["适合场景", "切入方式", "初期价值"], knowledge: ["K7", "K17", "K21", "K8"], length: { min: 280, max: 440 }, goal: "说明候选人入职后可快速切入的业务。",
    thesis: "我适合先从知识密集、流程明确、需要质量验证和人工复核的企业 AI 场景切入。", required: ["知识或流程型场景", "轻量原型", "评测和人审"], direct: ["业务场景", "知识", "流程"],
    fallback: "我适合先从**知识密集、流程明确、需要质量验证和人工复核**的企业 AI 场景切入，例如内部知识问答、研究资料整理、审计或运营资料处理，以及需要 Agent 协作但不能完全放任模型的工作流。\n\n这些场景与我的经历匹配：统计背景支持指标与评测设计，审计经历帮助理解流程、证据和风险，RAG 与 DeepFlow 项目让我能够讨论检索、Agent 分工、人审和工程链路。入职初期我会先选择一个边界清楚的用户任务，梳理输入输出和验收标准，用轻量原型验证价值，再通过 Bad Case 决定下一轮投入。这样可以较快形成可演示、可讨论、可继续迭代的结果。",
    next: ["work_scope", "business_to_ai", "enterprise_ai"],
  }),
  define({
    id: "tech_collaboration", question: "你与技术团队协作时可以承担哪些职责？", aliases: ["他与技术团队协作时可以承担哪些职责？"], topic: "skills", facet: "collaboration",
    dimensions: ["需求翻译", "方案取舍", "联调验收"], knowledge: ["K4", "K5", "K19"], length: { min: 280, max: 440 }, goal: "说明候选人在产品技术协作中的具体职责。",
    thesis: "我可以承担业务问题翻译、方案边界讨论、评测设计以及联调验收之间的连接角色。", required: ["需求和技术翻译", "技术选型取舍", "评测联调验收"], direct: ["技术团队", "职责", "验收"],
    fallback: "我可以承担业务问题翻译、方案边界讨论、评测设计以及联调验收之间的连接角色。前期把用户任务、输入输出、异常情况和验收标准整理清楚，避免只给工程一个模糊的“做个 AI 功能”。\n\n方案阶段，我能够和技术讨论 RAG 检索链路、Agent 职责、数据与存储、异步任务和可观测性，并从用户价值、实现成本和风险角度参与取舍。我不会代替工程师做所有底层判断，但可以把技术差异转成产品影响。\n\n联调阶段，我负责准备测试问题、分类 Bad Case、确认关键异常和边界是否覆盖，并推动结果回到下一轮需求。我的价值是让业务、产品和技术围绕同一套可验证目标协作。",
    next: ["requirements", "ai_coding", "project_contribution"],
  }),
  define({
    id: "audit_product_example", question: "举一个审计问题转成产品的例子。", aliases: ["你如何把一个审计问题转成产品？"], topic: "audit", facet: "example",
    dimensions: ["原始问题", "产品判断", "方案闭环"], knowledge: ["K7"], stories: ["ST4"], forbidden: ["local_tools", "rag", "deepflow"], shape: "star", length: { min: 320, max: 500 }, goal: "用真实审计工具故事说明产品化过程。",
    thesis: "一个具体例子是把审计资料整理与日志核查中的重复步骤，转成可配置、可复核的工具流程。", required: ["审计资料或日志问题", "规则和人工复核", "公开原型"], direct: ["审计问题", "产品", "日志", "复核"],
    fallback: "一个具体例子是把审计资料整理与日志核查中的重复步骤，转成**可配置、可复核的工具流程**。原始工作中会出现大量字段、重复规则和证据整理任务，如果只追求自动生成结果，反而容易失去口径和追踪能力。\n\n我的产品判断是先保留业务结构：明确输入资料、需要识别或核查的字段、规则执行结果以及人工确认节点，再考虑 OCR、规则或模型分别承担什么。真实客户资料不能直接用于公开开发，因此原型只保留问题结构和通用流程，不带入客户、底稿或内部数据。\n\n最终形成的是审计资料智能归档助手和 IT 审计日志抽查助手等公开原型。这个过程体现了我把现场问题抽象为用户任务、数据结构、风险规则和验收流程的能力。",
    next: ["audit_value", "business_to_ai", "enterprise_ai"],
  }),
  define({
    id: "agent_collaboration", question: "Agent 之间如何协作？", aliases: ["DeepFlow 中 Agent 之间如何协作？"], topic: "deepflow", facet: "collaboration",
    dimensions: ["角色交接", "共享状态", "人审与观测"], knowledge: ["K18", "K19", "K21"], stories: ["ST2"], forbidden: ["rag", "audit", "local_tools"], length: { min: 280, max: 450 }, goal: "具体说明 DeepFlow 的 Agent 协作机制。",
    thesis: "DeepFlow 的 Agent 不是自由聊天，而是围绕研究任务按角色、输入输出和状态进行有序交接。", required: ["Coordinator Planner 等角色", "任务产物交接", "关键人审和状态观测"], direct: ["Agent", "协作", "交接", "人审"],
    fallback: "DeepFlow 的 Agent 不是自由聊天，而是围绕研究任务按**角色、输入输出和状态**进行有序交接。Coordinator 负责接收目标和组织流程，Planner 把目标拆成研究计划，Researcher 检索与整理资料，Coder 承担需要计算或结构化处理的任务，Reporter 汇总证据与分析形成报告。\n\n每个角色消费上一步的明确产物，而不是共享一段无限增长的对话；任务状态、关键字段和中间结果需要被记录，便于发现资料不足、计划跑偏或报告无法追溯。方向性、高成本或评价标准不清楚的节点加入人工确认。\n\n这样的协作设计让 Agent 的自主执行有边界，也使失败能够定位到计划、检索、分析还是报告环节。",
    next: ["deepflow_thinking", "project_contribution", "enterprise_ai"],
  }),
];

const contractById = new Map(questionContracts.map((contract) => [contract.id, contract]));

export function normalizeContractQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/张倬玮/g, "候选人")
    .replace(/你的|他的/g, "候选人的")
    .replace(/你|他/g, "候选人")
    .replace(/[\s，。！？、：；,.!?:;（）()\-_]/g, "");
}

export function findQuestionContract(question: string) {
  const normalized = normalizeContractQuestion(question);
  return questionContracts.find((contract) => [contract.question, ...contract.aliases]
    .some((candidate) => normalizeContractQuestion(candidate) === normalized));
}

export function frameFromContract(contract: QuestionContract): QuestionFrame {
  return { ...contract.frame, routeSource: "contract" };
}

const topicKnowledge: Record<QuestionTopic, string[]> = {
  profile: ["K1", "K2", "K3"], role_fit: ["K2", "K3", "K4", "K8"], rag: ["K4", "K13", "K14", "K15", "K17"],
  deepflow: ["K5", "K16", "K18", "K19", "K20", "K21"], ask_me: ["K12"], local_tools: ["K6"], audit: ["K7", "K8", "K9", "K10"],
  statistics: ["K3", "K17"], skills: ["K3", "K4", "K5", "K17", "K21"], enterprise_ai: ["K8", "K17", "K21"], agent: ["K18", "K19", "K21"], unknown: [],
};

const topicPatterns: Array<[QuestionTopic, RegExp]> = [
  ["rag", /\brag\b|知识库|检索|引用/i], ["deepflow", /deepflow/i], ["agent", /agent|多智能体|多代理/i],
  ["local_tools", /thirty[-\s]?minute brain|read[-\s]?later regret|downloads butler|本地优先效率工具|信息债|下载文件夹/i],
  ["audit", /审计|德勤|容诚|日志核查|底稿|函证|盘点/i], ["statistics", /统计|指标|样本|数据分析|产品决策/i],
  ["enterprise_ai", /企业级?\s*ai|企业场景|业务问题.*(?:ai|产品)/i], ["role_fit", /岗位|适合|胜任|优势|团队价值/i],
  ["profile", /自我介绍|介绍一下|背景|经历组合/i], ["skills", /技能|技术|评测|ai\s*编程|协作|sql|python|fastapi|ragas/i], ["ask_me", /ask\s*me|数字分身/i],
];

const facetPatterns: Array<[QuestionFacet, RegExp]> = [
  ["example", /举例|例子|案例/i], ["contribution", /贡献|负责|做了什么|核心工作|职责/i], ["collaboration", /协作|分工|交接|配合/i],
  ["evaluation", /评测|评估|指标|验收|效果|质量|错误|失败|检查|bad\s*case/i], ["transfer", /迁移|沉淀|帮助|支持/i], ["result", /结果|成果|完成|上线|规模/i],
  ["boundary", /短板|不足|限制|边界|风险/i], ["architecture", /架构|链路|技术方案/i], ["method", /方法|如何|怎么|思考|取舍/i],
  ["problem", /解决.*问题|什么问题|痛点/i], ["fit", /适合|胜任|优势|价值|能力组合/i],
];

function responseShapeFor(facet: QuestionFacet): ResponseShape {
  if (facet === "example") return "star";
  if (facet === "contribution") return "contribution";
  if (facet === "fit") return "fit_mapping";
  if (facet === "result" || facet === "boundary") return "shortcoming";
  return "direct";
}

function forbiddenFor(topic: QuestionTopic) {
  if (topic === "unknown" || topic === "profile" || topic === "role_fit" || topic === "skills" || topic === "enterprise_ai") return [];
  return topics.filter((candidate) => ![topic, "unknown", ...(topic === "agent" ? ["deepflow"] : [])].includes(candidate)) as QuestionTopic[];
}

export function buildLocalQuestionFrame(question: string, history: { role: "user" | "assistant"; content: string }[] = []): QuestionFrame {
  const contract = findQuestionContract(question);
  if (contract) return frameFromContract(contract);
  if (/^(?:你是谁|你叫什么|你的身份是什么|你能做什么|你可以做什么)[？?。.！!\s]*$/i.test(question)) {
    return {
      topic: "profile",
      facet: "overview",
      requestedDimensions: ["Agent 身份或能力范围"],
      useHistory: false,
      confidence: 0.98,
      requiredKnowledgeIds: [],
      allowedStoryIds: [],
      forbiddenTopics: [],
      responseShape: "direct",
      targetLength: { min: 120, max: 320 },
      answerGoal: "直接说明数字分身身份或可以回答的候选人信息范围。",
      routeSource: "local",
    };
  }
  if (/\brag\b/i.test(question) && /deepflow/i.test(question)) {
    return {
      topic: "profile",
      facet: /结果|成果|上线|规模|用户|完成/.test(question) ? "result" : "overview",
      requestedDimensions: ["RAG 当前状态", "DeepFlow 当前状态", "公开结果边界"],
      useHistory: false,
      confidence: 0.94,
      requiredKnowledgeIds: ["K4", "K5"],
      allowedStoryIds: [],
      forbiddenTopics: [],
      responseShape: "shortcoming",
      targetLength: { min: 220, max: 420 },
      answerGoal: "分别回答两个项目的公开状态，不虚构真实用户、生产或商业化数据。",
      routeSource: "local",
    };
  }
  const topic = topicPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? "unknown";
  const facet = facetPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? "overview";
  const reference = /这个|该项目|其中|它|上述|这套|这种|这些|那些|那次|当时|刚才|前面/.test(question);
  const historyProject = [...history].reverse().find((message) => /rag|deepflow|ask\s*me/i.test(message.content))?.content.match(/rag|deepflow|ask\s*me/i)?.[0]?.toLowerCase();
  const inferredTopic = topic === "unknown" && reference
    ? (historyProject === "rag" ? "rag" : historyProject === "deepflow" ? "deepflow" : historyProject?.includes("ask") ? "ask_me" : "unknown")
    : topic;
  const explicitTopic = inferredTopic !== "unknown";
  return {
    topic: inferredTopic,
    facet,
    requestedDimensions: [facet === "overview" ? "直接回答当前问题" : `${facet}相关判断`, "具体实践", "验证或落地方式"],
    activeProject: inferredTopic === "rag" ? "rag-knowledge-base" : inferredTopic === "deepflow" || inferredTopic === "agent" ? "deepflow" : inferredTopic === "ask_me" ? "ask-me" : undefined,
    useHistory: reference,
    confidence: explicitTopic && facet !== "overview" ? 0.86 : explicitTopic ? 0.72 : facet !== "overview" ? 0.58 : 0.35,
    requiredKnowledgeIds: topicKnowledge[inferredTopic],
    allowedStoryIds: facet === "example" ? (inferredTopic === "audit" ? ["ST4", "ST6"] : inferredTopic === "rag" ? ["ST1"] : inferredTopic === "deepflow" || inferredTopic === "agent" ? ["ST2"] : []) : [],
    forbiddenTopics: forbiddenFor(inferredTopic),
    responseShape: responseShapeFor(facet),
    targetLength: { min: facet === "overview" ? 220 : 280, max: 480 },
    answerGoal: "直接回应当前问题，并使用最相关的公开实践解释判断。",
    routeSource: "local",
  };
}

export function mergePlannedFrame(local: QuestionFrame, planned: z.infer<typeof plannedQuestionFrameSchema>): QuestionFrame {
  const topic = planned.topic === "unknown" ? local.topic : planned.topic;
  return {
    ...local,
    topic,
    facet: planned.facet,
    requestedDimensions: planned.requestedDimensions,
    activeProject: planned.activeProject ?? (topic === "rag" ? "rag-knowledge-base" : topic === "deepflow" || topic === "agent" ? "deepflow" : undefined),
    useHistory: planned.useHistory,
    confidence: planned.confidence,
    requiredKnowledgeIds: topicKnowledge[topic],
    allowedStoryIds: planned.facet === "example" || planned.facet === "transfer"
      ? (topic === "audit" ? ["ST4", "ST6"] : topic === "rag" ? ["ST1"] : topic === "deepflow" || topic === "agent" ? ["ST2"] : [])
      : [],
    forbiddenTopics: forbiddenFor(topic),
    responseShape: responseShapeFor(planned.facet),
    targetLength: { min: planned.facet === "overview" ? 220 : 280, max: 480 },
    answerGoal: "先直接回答问题，再使用最相关的公开实践说明判断、机制或迁移价值。",
    routeSource: "model",
  };
}

export function getQuestionContract(id: string) {
  return contractById.get(id);
}

export function recommendedContractQuestions(currentContractId: string | undefined, askedQuestions: readonly string[], limit = 3) {
  const seen = new Set(askedQuestions.map(normalizeContractQuestion));
  const current = currentContractId ? contractById.get(currentContractId) : undefined;
  const preferred = (current?.nextContractIds ?? []).map((id) => contractById.get(id)).filter((item): item is QuestionContract => Boolean(item));
  const ordered = [...preferred, ...questionContracts];
  const selected: QuestionContract[] = [];
  const usedTopics = new Set<QuestionTopic>();
  for (const contract of ordered) {
    if (seen.has(normalizeContractQuestion(contract.question))) continue;
    if (selected.some((item) => item.id === contract.id)) continue;
    if (selected.length >= 1 && usedTopics.has(contract.frame.topic) && ordered.some((item) => !usedTopics.has(item.frame.topic) && !seen.has(normalizeContractQuestion(item.question)))) continue;
    selected.push(contract);
    usedTopics.add(contract.frame.topic);
    if (selected.length === limit) break;
  }
  if (selected.length < limit) {
    for (const contract of ordered) {
      if (seen.has(normalizeContractQuestion(contract.question)) || selected.some((item) => item.id === contract.id)) continue;
      selected.push(contract);
      if (selected.length === limit) break;
    }
  }
  return selected.map((contract) => contract.question);
}
