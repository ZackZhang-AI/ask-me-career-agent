import { z } from "zod";
import { candidateNarrative } from "../content/narrative";
import type { AnswerIntent, EvidencePolicy, QuestionContract, QuestionFacet, QuestionFrame, QuestionMode, QuestionTopic, ResponseShape } from "./types";

const topics = ["profile", "role_fit", "baidu", "rag", "deepflow", "ask_me", "local_tools", "audit", "statistics", "skills", "enterprise_ai", "agent", "unknown"] as const;
const facets = ["overview", "problem", "method", "contribution", "architecture", "collaboration", "evaluation", "transfer", "example", "result", "boundary", "fit"] as const;
const answerIntents = ["agent_identity", "capability_scope", "introduction", "career_transition", "role_fit", "representative_project", "project_overview", "project_problem", "contribution", "ai_collaboration", "challenge", "diagnosis", "result", "limitation", "skills", "experience", "experience_value", "privacy", "education", "credentials", "hiring_recommendation", "general"] as const;

const careerTransitionPattern = /(?:为什么|为何).{0,12}(?:(?:从)?(?:财会|会计|财务|审计|统计)(?!问题)(?:背景|专业|经历)?.{0,12}(?:转向|转型|转(?!化)|选择|改做|走到|进入)|(?:转向|转型|选择|改做|走到|进入)).{0,12}(?:AI\s*产品|产品经理|产品)|(?:(?:从)(?:财会|会计|财务|审计|统计|原专业|传统行业)|(?:财会|会计|财务|审计|统计|原专业|传统行业)(?:背景|专业|经历)).{0,12}(?:转向|转型|转(?!化)|选择|改做|走到|进入).{0,8}(?:AI\s*产品|产品经理|产品)/i;
const careerTransitionContextPattern = /(?:财会|会计|财务|审计|统计|传统行业).{0,24}(?:产品|AI).{0,14}(?:连续|迁移|选择|适合|方向|准备)|(?:为什么|为何|如何|怎么).{0,12}(?:转型|转向|选择).{0,14}(?:AI|产品)/i;
const careerTransitionActionPattern = /(?:转型|转向|转(?!化)|改做|走到|进入|从.{0,12}(?:到|选择)|不继续.{0,12}(?:而)?(?:选择|做)|选择.{0,12}(?:AI|产品|而不是)|连续性|做了哪些准备)/i;
const experienceValuePattern = /(?:(?:(?:应用)?统计学?|所学|你的|他的|候选人的|原)(?:这个)?专业(?:背景)?|专业背景|之前的?经历|过往经历|审计(?:经历|训练)?|财会(?:经历|背景)?|数据分析(?:能力|背景)?).{0,28}(?:对.{0,12})?(?:做|求职|支持|帮助|价值|作用|迁移|产品判断).{0,16}(?:AI\s*产品|产品|决策|能力)?|(?:AI\s*产品|产品决策).{0,18}(?:帮助|价值|作用|支持|迁移)/i;

export function hasCareerTransitionSignature(question: string) {
  return careerTransitionActionPattern.test(question)
    && (careerTransitionPattern.test(question) || careerTransitionContextPattern.test(question));
}

export function hasExperienceValueSignature(question: string) {
  return experienceValuePattern.test(question);
}
const roleFitPattern = /匹配(?:之处|点|度|证据)?|契合(?:之处|点|度)?|适合|胜任|为什么.{0,8}(?:选择你|选你)|能为.{0,16}(?:岗位|岗|团队|业务).{0,8}(?:带来|创造)|与.{0,18}(?:岗位|岗).{0,8}(?:关系|匹配)/i;
const resultEvidencePattern = /(?:有没有|是否|能否证明|做过|负责过|实现过|取得|形成|达到|已经|目前).{0,16}(?:商业化|变现|营收|收入|增长|用户|留存|上线|结果|成果|规模)|(?:商业化|变现|营收|收入|增长|用户|留存|上线).{0,12}(?:数据|结果|成果|规模|经验|案例|证明|做过|负责过|实现过)|(?:商业化|变现|营收|收入|增长|用户|留存|上线)(?:情况)?(?:怎么样|如何)[？?。\s]*$/i;

export function extractTargetRole(question: string) {
  const isGenericReference = (value: string) => /^(?:(?:这个|该|上述|刚才的|前面提到的|目标)(?:岗位|职位|岗)|(?:岗位|职位|岗))$/i.test(value.trim());
  const namedRole = question.match(/((?:企业|商业分析|智能客服|AI|商业化|增长|搜索|数据|策略|平台|企业服务|B\s*端|C\s*端|广告|用户|内容|推荐|国际化|电商|支付|风控|运营|智能体|Agent)[A-Za-z0-9\u4e00-\u9fa5·+\-\s]{0,10}(?:产品经理|PM))/i)?.[1];
  if (namedRole) return namedRole.replace(/\s+/g, " ").trim();
  const contextualRole = question.match(/(?:和|与|应聘|申请|面试|目标是?|针对)\s*([^，。！？?]{2,24}?(?:产品经理|PM|工程师|设计师|运营|分析师|岗位))(?=这个岗|该岗|岗位|职位|有什么|有哪些|的匹配|匹配|契合|适合|可迁移)/i)?.[1];
  if (contextualRole && !isGenericReference(contextualRole)) return contextualRole.trim();
  const broadRole = question.match(/(?:适合|胜任|匹配)(?:做|从事)?\s*(?!什么|哪些|哪种|哪类)([^，。！？?]{2,20}(?:产品|岗位|方向))/i)?.[1];
  return broadRole && !isGenericReference(broadRole) ? broadRole.trim() : undefined;
}

export function inferAnswerIntent(question: string, topic: QuestionTopic = "unknown", facet: QuestionFacet = "overview"): AnswerIntent {
  if (/^(?:(?:你|您)?(?:是谁|叫什么(?:名字)?|是什么(?:身份|助手|Agent|角色)?|的身份是什么)|(?:请)?(?:介绍|说明)(?:一下)?你的身份)[？?。.！!\s]*$/i.test(question)) return "agent_identity";
  if (/^(?:(?:你|您)(?:能|可以)(?:做|回答|介绍|帮我)(?:些什么|什么|哪些(?:问题|内容|开放题)?)?|你有什么(?:作用|用处|功能)|你是做什么的|你能干什么|你可以干什么|能问你什么|可以问什么|功能范围|能力范围|你不能回答开放(?:问题|题目|题)?(?:吗)?|你能回答(?:开放|没有标准答案的)?(?:问题|题目|题)?(?:吗)?|.*(?:Agent|助手).{0,8}(?:能不能|可以不可以|能否)?回答.{0,12}(?:开放|标准答案|问题))[？?。.！!\s]*$/i.test(question)) return "capability_scope";
  if (hasCareerTransitionSignature(question)) return "career_transition";
  if (roleFitPattern.test(question)) return "role_fit";
  if (/AI\s*(?:编程|写|生成)|代码.*AI|AI.*占比|用了多少\s*AI/i.test(question)) return "ai_collaboration";
  if (/挑战|困难|失败|取舍|踩坑|复盘|怎么推进|如何推进/i.test(question)) return "challenge";
  if (/^(?:如果|假设|当)/.test(question) && /(?:怎么办|怎么|如何|怎样)/.test(question)) return "diagnosis";
  if (/(?:如何|怎么|怎样).{0,12}(?:证明|验证).{0,12}(?:可信|可靠|质量)/i.test(question)) return "diagnosis";
  if (resultEvidencePattern.test(question)) return "result";
  if (/个人贡献|你做了什么|你负责|具体做了|你的工作|主导/i.test(question)) return "contribution";
  if (/没有改善|没改善|没有效果|没效果|优先排查|先排查|先.{0,3}看什么|定位问题|(?:如何|怎么).{0,4}定位|为什么没有/i.test(question)) return "diagnosis";
  if (/隐私|机密|企业数据|数据边界/i.test(question)) return "privacy";
  if (/短板|不足|弱点|限制|能力缺口/i.test(question) || facet === "boundary") return "limitation";
  if (/结果|量化(?:结果|效果)|效果数据|用户规模|增长|留存|上线|生产状态|完成(?:了吗|情况)/i.test(question) || facet === "result") return "result";
  if (/代表项目|最能代表|最有价值的项目/i.test(question)) return "representative_project";
  if (/自我介绍|介绍一下自己|60\s*秒/i.test(question)) return "introduction";
  if (/(?:项目|系统|工具|助手).{0,10}(?:能做什么|做什么|有什么功能|如何工作)/i.test(question)) return "project_overview";
  if (hasExperienceValueSignature(question)) return "experience_value";
  if (/技术能力|技术栈|会什么|数据分析|(?:AI\s*)?评测|如何评估|有哪些实践/i.test(question) || facet === "evaluation") return "skills";
  if (/企业级?\s*AI|企业\s*AI|企业场景|业务问题.{0,8}(?:转化|转成|变成).{0,8}(?:AI|产品)|(?:AI|产品)方案|项目经历.{0,12}(?:价值|帮助|迁移)|(?:从)?(?:财会|会计|财务|审计|统计).{0,14}(?:积累|迁移|帮助|带来|形成).{0,12}(?:产品|能力|需求|决策)/i.test(question)) return "experience_value";
  if (facet === "contribution") return "contribution";
  if ((facet === "fit" && topic === "role_fit") || topic === "role_fit") return "role_fit";
  if (facet === "example" || (facet === "transfer" && ["audit", "statistics", "profile"].includes(topic))) return "experience_value";
  if (["rag", "deepflow", "ask_me", "local_tools", "agent"].includes(topic)) return "project_overview";
  return "general";
}

function questionModeFor(question: string, intent: AnswerIntent): QuestionMode {
  if (["agent_identity", "capability_scope", "privacy"].includes(intent)) return "agent_meta";
  // These intents already have a grounded candidate-facing answer shape. They
  // may still use realtime delivery, but should remain an ordinary answer
  // rather than being labelled as a hypothetical/scoped response.
  if (["skills", "experience_value", "ai_collaboration"].includes(intent)) return "candidate_fact";
  if (["introduction", "career_transition", "role_fit", "representative_project", "project_overview", "project_problem", "contribution", "result", "experience", "education", "credentials"].includes(intent)) return "candidate_fact";
  if (/^(?:如果|假设|当|遇到假设|你会如何|你怎么看|如何看待|面对|遇到|如何处理|怎么处理|如何|怎么|你(?:平时|通常)?如何|你(?:平时|通常)?怎样|你会怎么)/.test(question)) return "candidate_reasoning";
  return "candidate_fact";
}

function evidencePolicyFor(intent: AnswerIntent, mode: QuestionMode): EvidencePolicy {
  if (mode === "agent_meta") return "none";
  if (mode === "candidate_reasoning") return "supporting";
  if (["result", "contribution", "experience", "education", "credentials", "career_transition"].includes(intent)) return "required";
  return "supporting";
}

function focusTermsFor(intent: AnswerIntent, targetRole?: string) {
  if (intent === "career_transition") return ["转型动机", "经历连续性", "选择依据"];
  if (intent === "role_fit") return [targetRole ?? "目标岗位", "岗位要求", "经历证据", "可迁移价值"];
  if (intent === "result") return ["已验证结果", "证据边界"];
  if (intent === "challenge" || intent === "diagnosis") return ["问题判断", "处理过程", "复盘改进"];
  return ["当前问题", "相关实践", "判断依据"];
}

export const plannedQuestionFrameSchema = z.object({
  topic: z.enum(topics),
  facet: z.enum(facets),
  answerIntent: z.enum(answerIntents),
  questionMode: z.enum(["agent_meta", "candidate_fact", "candidate_reasoning"]).default("candidate_fact"),
  evidencePolicy: z.enum(["required", "supporting", "none"]).default("supporting"),
  focusTerms: z.array(z.string().min(2).max(30)).min(1).max(4),
  targetRole: z.string().min(2).max(30).optional(),
  requestedDimensions: z.array(z.string().min(2).max(30)).min(1).max(4),
  activeProject: z.enum(["baidu-ai-coding-evaluation", "rag-knowledge-base", "deepflow", "ask-me", "local-first-tools", "audit-tools"]).optional(),
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
  generationMode?: "local" | "realtime";
};

function define(input: ContractInput): QuestionContract {
  const answerIntent = inferAnswerIntent(input.question, input.topic, input.facet);
  const targetRole = answerIntent === "role_fit" ? extractTargetRole(input.question) : undefined;
  const questionMode = questionModeFor(input.question, answerIntent);
  return {
    id: input.id,
    question: input.question,
    aliases: input.aliases ?? [],
    frame: {
      topic: input.topic,
      facet: input.facet,
      answerIntent,
      questionMode,
      evidencePolicy: evidencePolicyFor(answerIntent, questionMode),
      focusTerms: input.dimensions.slice(0, 4),
      targetRole,
      requestedDimensions: input.dimensions,
      activeProject: ({ baidu: "baidu-ai-coding-evaluation", rag: "rag-knowledge-base", deepflow: "deepflow", ask_me: "ask-me", local_tools: "local-first-tools", audit: "audit-tools" } as Partial<Record<QuestionTopic, string>>)[input.topic],
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
    generationMode: input.generationMode ?? "local",
  };
}

export const questionContracts: QuestionContract[] = [
  define({
    id: "intro", question: "60 秒了解张倬玮。", aliases: ["请用 60 秒介绍张倬玮。", "请介绍一下你自己。"], topic: "profile", facet: "overview",
    dimensions: ["候选人定位", "真实 AI 产品实习", "项目能力主线"], knowledge: ["K1", "K27", "K22", "K37", "K2"], stories: ["ST11"], shape: "narrative", length: { min: 430, max: 600 },
    goal: "让面试官快速形成是否值得继续沟通的候选人判断。", thesis: "我是张倬玮，一名把数据评测、企业业务理解和 AI 产品落地结合起来的应用统计学学生。",
    required: ["应用统计学与审计基础", "百川医疗 RAG 与百度模型评测", "持续学习和产品落地能力"], direct: ["数据", "百川", "百度", "AI 产品"],
    fallback: candidateNarrative.introductions.seconds60,
    next: ["baidu_internship", "representative_project", "role_fit"],
  }),
  define({
    id: "role_fit", question: "你为什么适合 AI 产品经理岗位？", aliases: ["他为什么适合 AI 产品经理岗位？", "你能为 AI 产品团队带来什么价值？", "他能为 AI 产品团队带来什么价值？"], topic: "role_fit", facet: "fit",
    dimensions: ["岗位匹配", "真实 AI 产品实践", "自主产品验证", "入职价值"], knowledge: ["K27", "K19", "K22", "K12", "K5", "K2", "K37"], stories: ["ST11"], shape: "fit_mapping", length: { min: 360, max: 540 },
    goal: "说明候选人与初级 AI 产品岗位的具体匹配关系。", thesis: "我适合 AI 产品岗位，核心不是会使用模型，而是能把业务问题、质量验证和工程落地连起来。",
    required: ["模型评测与归因", "企业流程和风险理解", "Ask Me 与 DeepFlow 自主验证", "产品工程推进能力"], direct: ["适合", "评测", "业务", "落地"],
    fallback: "我适合 AI 产品经理岗位，核心不是单纯会使用模型，而是已经形成了从业务理解、产品设计到质量验证和快速落地的完整能力链。\n\n**真实业务闭环**：百川医疗 RAG 中，我参与需求调研、知识库与检索问答设计和三轮 QA 评测；随后在百度参与六类 AI Coding 任务、七维 Gate、6 个模型 36 次 Pilot 与 Bad Case 归因。\n\n**数据与风险**：应用统计学让我重视样本、指标和结论边界；德勤 IT 审计让我理解企业流程中的证据、数据边界和人工复核。这些能力让我不会只看模型演示，而会追问结果能否复现、错误能否定位、风险是否可控。\n\n**自主产品验证**：Ask Me 验证可信回答、风险分级和招聘决策路径，DeepFlow 验证多 Agent、私域 RAG 和过程追踪。它们说明我能从问题洞察出发把方案推进到可运行、可测试的状态，并在业务、模型和工程之间建立共同语言。",
    next: ["baichuan_internship", "representative_project", "baidu_internship"],
  }),
  define({
    id: "baichuan_internship", question: "请介绍一下你的百川智能实习。", aliases: ["你在百川智能实习期间主要做了什么？", "百川智能实习做了什么？", "请介绍你的医疗 RAG 实习。"], topic: "rag", facet: "overview",
    dimensions: ["实习顺序", "业务问题", "个人工作", "评测结果与边界"], knowledge: ["K27", "K4", "K28", "K31", "K35", "K36"], stories: ["ST10", "ST1"], shape: "narrative", length: { min: 360, max: 540 }, forbidden: ["deepflow", "local_tools"],
    goal: "让面试官快速确认百川实习的日期、业务问题、个人工作和事实边界。", thesis: "2026 年 4 月到 6 月，我在百川智能参与 AI 产品经理实习，主要项目是企业级医疗 RAG 知识库问答系统。",
    required: ["2026 年 4 月到 6 月", "医疗 RAG 业务问题", "需求产品评测三类工作", "脱敏 Demo 边界"], direct: ["百川智能", "医疗 RAG", "实习"],
    fallback: "2026 年 4 月到 6 月，我在百川智能参与 AI 产品经理实习，主要项目是**企业级医疗 RAG 知识库问答系统**。它面向医院、卫健委等医疗场景，把分散、敏感且持续更新的私有文档转成可检索、可问答、可核验的信息服务，但不替代医生诊断。\n\n我的工作主要有三部分：参与需求调研，梳理知识库管理、模型幻觉与答案溯源；参与整体架构和功能设计，与算法、研发推进文档解析、知识库、Dense Retrieval、Rerank、来源片段、短期记忆和多助手配置；参与 QA、四维 LLM-as-Judge 和 Bad Case 回流。\n\n项目完成三轮、累计 30 次 QA 执行，并发现多跳问题明显弱于单跳。公开 RAG 项目是**脱敏重构**，不是百川生产代码；面向客户类型不等于我完成了客户交付，小样本结果也不是线上或客户验收。",
    next: ["project_contribution", "rag_architecture", "evaluation"],
  }),
  define({
    id: "baidu_internship", question: "请介绍一下你的百度 AI 产品经理实习。", aliases: ["你在百度实习期间主要做了什么？", "请用 90 秒介绍这段百度实习。", "你的百度实习经历是什么？"], topic: "baidu", facet: "overview",
    dimensions: ["工作主线", "重点项目", "结果边界"], knowledge: ["K22", "K23", "K24", "K25", "K26", "K32", "K33", "K34"], stories: ["ST9"], shape: "narrative", length: { min: 360, max: 540 },
    goal: "让面试官快速确认百度实习的真实性、工作主线与项目深度。", thesis: "我在百度实习的工作主线是模型与 AI Coding 产品评测，重点参与 WebDev E2E Bench 和多模型 Pilot。",
    required: ["模型评测与 Bad Case 归因", "六类任务七维指标与 Gate", "36 次 Pilot 与结论边界"], direct: ["百度", "评测", "Pilot"],
    fallback: "2026 年 6 月到 8 月，我在百度参与 AI 产品经理实习，核心工作是把**模型评测**与 Bad Case 归因从“得到一个分数”推进到“能支持产品选型和迭代判断”。\n\n我先参与调研 13 项 Coding Benchmark，再参与设计 WebDev E2E Bench，用六类任务覆盖页面生成、功能实现、组件、重设计、轻全栈和 Bugfix+UX，并以七维指标与 Gate 同时保护工程可用性和用户体验。随后参与把确定性工作流、Agent 判断和人工校准组合成 Evaluator。\n\n**正式 Pilot**覆盖 6 个模型、6 类任务和 36 次运行，并完成 18 份盲评。我的工作不止是记录总分，而是把结果拆成场景优势、共同弱项、根因证据和下一步动作。边界是这些结论只适用于本次冻结版本和任务集，不是行业权威排名或生产平台成果。",
    next: ["baidu_contribution", "baidu_project", "baidu_metrics"],
  }),
  define({
    id: "representative_project", question: "哪个项目最能代表你的 AI 产品能力？", aliases: ["哪个项目最能代表他的 AI 产品能力？", "哪个公开项目最能代表你的 AI 产品能力？", "哪个公开项目最能代表他的 AI 产品能力？"], topic: "rag", facet: "overview",
    dimensions: ["项目问题", "产品判断", "验证边界"], knowledge: ["K4", "K28", "K29", "K31", "K35", "K36"], stories: ["ST10", "ST1"], shape: "project_arc", length: { min: 390, max: 540 }, forbidden: ["baidu", "deepflow", "local_tools", "audit"],
    goal: "用 RAG 项目证明候选人的问题定义、方案取舍、评测设计与工程落地能力。", thesis: "最能代表我 AI 产品能力的是 RAG Knowledge Base System。",
    required: ["医疗私有文档可信问答", "四层架构和评测闭环", "公开脱敏与未完成边界"], direct: ["RAG", "百川", "Rerank", "评测"],
    fallback: "最能代表我 AI 产品能力的是百川智能实习中的 RAG Knowledge Base System。它面向**医疗私有文档可信问答**，帮助使用者从指南、共识和论文等资料中获得有来源、可核验的答案，同时只辅助资料查阅，不替代诊断。\n\n我参与把产品拆成文档处理、知识库管理、检索问答和评测四层，并把 P0 收敛为知识入库、问答、来源返回和失败状态。公开脱敏项目已跑通 Dense Retrieval、Rerank、来源片段、Redis 短期记忆、多助手基础配置和四维自动评测。\n\n我的工作覆盖需求与 MVP 梳理、功能和配置边界、跨角色协作以及 QA 评测闭环。公开仓库不是百川生产代码；BM25 混合检索、长期记忆、完整 Agent、版本对比和生产级 RBAC 尚未完整落地，也没有可公开的真实客户效果。这个项目体现了我把高风险行业需求转成**可运行、可核验、可迭代**产品闭环的能力。",
    next: ["project_contribution", "rag_methods", "evaluation"],
  }),
  define({
    id: "rag_overview", question: "请介绍一下你的 RAG 知识库项目。", aliases: ["介绍一下你的 RAG 知识库项目。", "介绍一下你的 RAG Knowledge Base System。"], topic: "rag", facet: "overview",
    dimensions: ["医疗文档问题", "检索方案", "评测闭环"], knowledge: ["K4", "K28", "K29", "K31", "K35", "K36"], stories: ["ST10", "ST1"], shape: "project_arc", length: { min: 340, max: 520 }, forbidden: ["baidu", "deepflow", "local_tools", "audit"],
    goal: "完整介绍 RAG 项目的问题、方案取舍与当前边界。", thesis: "RAG Knowledge Base System 面向专业文档问答，重点是让检索、回答、引用和评测形成可持续改进的链路。",
    required: ["专业文档问答问题", "Dense Retrieval 主链路", "评测和 Bad Case 迭代"], direct: ["RAG", "检索", "评测"],
    fallback: "RAG Knowledge Base System 是我在百川智能实习中的主要项目，面向**医疗私有文档问答**。它把指南、共识、论文等资料转成可检索、可问答、可核验的信息服务，辅助专业资料查阅而不替代诊断。\n\n产品分为文档处理、知识库管理、检索问答和评测四层。公开脱敏项目已跑通知识入库、**Dense 加 Rerank**、来源片段、Redis 短期记忆、多助手基础配置和 QA 四维自动评测。我参与需求与 MVP 梳理、功能与配置边界、跨角色协作和评测闭环。\n\n公开仓库不是百川生产代码；BM25 混合检索、长期记忆、完整 Agent、持久化版本对比、专门 Bad Case 平台和生产级 RBAC 尚未完整落地。",
    next: ["project_contribution", "rag_methods", "evaluation"],
  }),
  define({
    id: "baidu_project", question: "Evaluator Agent 项目具体做了什么？", aliases: ["AI Coding Evaluator Agent 是什么？", "你在百度重点做的项目是什么？"], topic: "baidu", facet: "architecture",
    dimensions: ["任务指标", "执行链路", "工具 Judge 与人工分工"], knowledge: ["K23", "K24", "K25", "K32"], stories: ["ST9"], length: { min: 340, max: 520 },
    goal: "解释 Evaluator Agent 的产品目标、执行链路与当前完成边界。", thesis: "Evaluator Agent 把 Task Spec、候选项目和 Rubric 转成可执行的端到端评测与证据报告。",
    required: ["六类任务与七维 Gate", "确定性执行和开放判断", "36 次 Pilot 与人工校准"], direct: ["Evaluator Agent", "Pilot", "报告"],
    fallback: "Evaluator Agent 的目标，是把 Task Spec、候选项目、运行配置和 Rubric 转成一条**评测执行链路**。六类任务覆盖页面、功能、组件、重设计、轻全栈和 Bugfix+UX；七维指标与 Gate 同时保护核心可用性和产品体验。\n\n构建、HTTP、DOM、浏览器操作、日志和 axe-core 等硬事实由确定性工具检查；视觉、交互和产品完成度由双 Judge 按 Rubric 评价，并保留截图和交互证据；**人工校准**结合 Gold、缺陷注入、重复检查和盲评。\n\n正式 Pilot 覆盖 6 个模型、6 类任务和 36 次运行，完成 18 份盲评，并输出分项证据、场景差异、共同风险和优化建议。它已经从 MVP 推进到受控 Pilot，但不是生产平台，也不是行业权威排行榜。",
    next: ["baidu_metrics", "baidu_reliability", "baidu_contribution"],
  }),
  define({
    id: "baidu_contribution", question: "你在百度实习中具体负责什么？", aliases: ["你在百度实习中的个人贡献是什么？", "你个人具体做了什么，导师和研发做了什么？"], topic: "baidu", facet: "contribution",
    dimensions: ["确认贡献", "协作边界", "可交付产物"], knowledge: ["K22", "K23", "K24", "K26", "K32", "K33"], stories: ["ST9"], shape: "contribution", length: { min: 320, max: 500 },
    goal: "清楚说明候选人的确认贡献，并避免夸大独立 Owner 身份。", thesis: "我在百度实习中的确认贡献，是参与评测研究、体系设计、Pilot 执行、校准和结果转化。",
    required: ["Benchmark 调研", "任务指标与 Pilot", "不负责底层训练和生产平台"], direct: ["参与", "评测", "Pilot"],
    fallback: "我在百度实习中的确认贡献主要有四部分：参与 13 项 **Benchmark 调研**；参与六类 Web 任务、七维指标与 Gate 设计；参与 Evaluator 实现验证、6 个模型 36 次 Pilot、18 份盲评和可靠性校准；结合日志、Trace、DOM 和截图分析 Bad Case，并把结果转成场景建议与下一轮动作。\n\n我的角色更接近**产品侧的任务拆解、评测规则、结果分析和跨角色推进**，而不是底层模型训练者。Qwen 写入协议诊断也体现了我的判断：低分不一定只有模型原因，需要控制变量验证工具与协议。\n\n对于具体代码由谁独立完成、导师与研发的详细分工，我只按真实项目记录回答。我的核心价值是把业务目标转成任务、指标、证据和复测闭环，而不是用“独立搭建生产平台”包装自己。",
    next: ["baidu_project", "baidu_metrics", "baidu_badcase"],
  }),
  define({
    id: "baidu_metrics", question: "AI Coding 评测的七维指标和硬门槛如何设计？", aliases: ["七个指标和权重怎么来的？", "AI Coding 评测为什么需要 Gate？"], topic: "baidu", facet: "evaluation",
    dimensions: ["七维指标", "权重逻辑", "Gate 边界"], knowledge: ["K23", "K24"], length: { min: 330, max: 510 },
    goal: "证明候选人能从用户任务设计多维评测，并理解规则边界。", thesis: "七维指标从用户能否获得可运行、可交互的 Web 应用倒推，Gate 用来保护核心可用性。",
    required: ["七个维度", "30 15 20 15 8 5 7 权重", "20 分 60 分与白屏 Gate"], direct: ["七维", "权重", "Gate"],
    fallback: "**七维指标**包含七个维度，是从用户最终能否获得一个可运行、可交互的 Web 应用倒推的：功能正确性 30%、端到端可用性 15%、视觉美观度 20%、交互体验 15%、响应式适配 8%、可访问性 5%、代码质量 7%。它既保留确定性的工程质量，也覆盖用户真正感知的产品体验。\n\n**核心可用性 Gate**用来避免体验高分掩盖核心失败：无法安装、构建或启动时总分最高 20；核心流程通过率低于 50% 时总分最高 60；白屏或核心页面不可访问时直接判定端到端失败。视觉和代码信息仍可保留用于诊断，但不能改变产品不可用的结论。\n\n这些权重和门槛属于**当前 MVP 规则**，不是行业标准。后续需要用多任务 Pilot、人工评分和错误分布校准它们的区分度与误伤，而不是把一次设计当成永久正确答案。",
    next: ["baidu_reliability", "baidu_badcase", "baidu_project"],
  }),
  define({
    id: "baidu_badcase", question: "你如何分析和归因 AI Coding 的 Bad Case？", aliases: ["AI Coding Bad Case 怎么分类？", "模型评测发现问题后你怎么归因？"], topic: "baidu", facet: "method",
    dimensions: ["现象与根因", "证据链", "控制变量复测"], knowledge: ["K22", "K25", "K33"], length: { min: 300, max: 470 },
    goal: "展示从失败现象到可验证根因和产品动作的归因方法。", thesis: "Bad Case 归因要先分离现象与根因，再沿模型、Prompt、工具、环境和评测器建立证据。",
    required: ["模型协议与评测器分层归因", "日志 Trace DOM 与截图证据", "固定模型任务预算受控诊断"], direct: ["Bad Case", "归因", "证据"],
    fallback: "分析 Bad Case 时，我会先做**分层归因**，区分结果现象、模型能力、工具协议和评测器失败，再结合构建退出码、console、network、Trace、DOM 和截图建立证据。信息未闭环时保留候选原因，不把低分直接归因给模型。\n\n**受控诊断**：Qwen Ticket CRUD 中，我固定模型、任务和总预算，只增加 6000 字符写入限制、追加写入和写后校验，得分由 16.04 提升到 69.07，输入 Token 由 254,765 降到 74,447。这说明工具协议本身也可能是根因。\n\n我会明确它只是正式结果后的单任务诊断，不进入榜单，也不能外推为模型普遍提升。它的价值是把 Bad Case 转成可验证约束，并沉淀为后续回归。",
    next: ["baidu_reliability", "baidu_metrics", "tech_collaboration"],
  }),
  define({
    id: "baidu_reliability", question: "你如何证明自动评测结果可信？", aliases: ["Evaluator Agent 的评分可靠吗？", "LLM Judge 如何校准？", "人机一致率是多少？"], topic: "baidu", facet: "evaluation",
    dimensions: ["当前证据", "校准方法", "失败转人工"], knowledge: ["K24", "K25"], length: { min: 310, max: 480 },
    goal: "用当前校准证据说明可靠性，同时准确解释样本边界。", thesis: "评测器已具备受控 Pilot 所需的基础可靠性，但主观判断仍需要人工校准。",
    required: ["6/6 Gold 与 10/10 确定性缺陷", "重复一致性与主观敏感度", "人工样本边界"], direct: ["Gold", "一致性", "人工"],
    fallback: "我会把可信度拆成三层。**硬检查校准**中，6/6 个 Gold 样例通过，10/10 个确定性缺陷被检出，重复自动检查一致性为 100%；主观缺陷方向敏感度是 5/6，漏掉了较弱的信息层级问题。\n\n**人工样本边界**也必须说明：Auto-Judge Spearman 为 0.6191，Judge-Human 为 0.4599。我把它解释为初步判别力，而不是“已经和人一样可靠”，因为人工评分只有 18 份、由一人完成且抽样不均。\n\n因此，硬事实优先用确定性工具，开放体验保留证据，冲突和低置信度结果转人工，同时继续扩充均衡 Gold 和回归集。评测器可以支持当前 Pilot，但不能替代人。",
    next: ["baidu_metrics", "baidu_badcase", "baidu_project"],
  }),
  define({
    id: "project_contribution", question: "你在 RAG 项目中负责哪些核心工作？", aliases: ["你在代表项目中负责哪些核心工作？", "他在代表项目中负责哪些核心工作？", "你在 RAG 项目中的个人贡献是什么？", "你的核心贡献是什么？", "他在 RAG 项目中负责什么？", "你在这个项目中最关键的产品取舍是什么？", "最难的产品取舍是什么？"], topic: "rag", facet: "contribution",
    dimensions: ["本人判断", "核心行动", "验收责任"], knowledge: ["K27", "K28", "K29", "K31"], stories: ["ST10", "ST1"], shape: "contribution", length: { min: 330, max: 520 }, forbidden: ["deepflow", "local_tools", "audit"],
    goal: "清楚区分候选人判断与 AI 工具协作。", thesis: "我在 RAG 项目中负责的核心不是堆功能，而是决定做什么、为什么这样取舍以及如何验收。",
    required: ["产品定位", "检索和评测取舍", "整体推进与验收"], direct: ["负责", "取舍", "验收"],
    fallback: "我在百川医疗 RAG 项目中负责把业务需求、产品规则和质量验证连成闭环。**需求与 MVP**方面，我参与梳理知识库管理、幻觉风险和来源核验需求，把 P0 收敛为知识入库、检索问答、来源返回和失败状态。\n\n功能设计阶段，我参与文档处理、知识库、Dense 加 Rerank、短期记忆和多助手配置，重点定义用户入口、流程状态、配置边界、异常分支和验收标准，并与算法、研发对齐。我的职责不是独立实现检索算法，而是让技术组件服务于清楚的用户任务。\n\n**四维评测闭环**方面，我参与 QA 数据、LLM-as-Judge 打分和报告输出，让问题能回到召回、排序或生成环节。公开 Demo 使用外部模型和 AI 工具做脱敏重构，但需求取舍、评测标准和事实边界由我负责。",
    next: ["rag_methods", "evaluation", "ai_coding"],
  }),
  define({
    id: "business_to_ai", question: "你如何把业务问题转化为 AI 产品方案？", aliases: ["他如何把业务问题转化为 AI 产品方案？"], topic: "enterprise_ai", facet: "method",
    dimensions: ["业务任务", "方案分工", "验证闭环"], knowledge: ["K7", "K17", "K21"], stories: ["ST4"], length: { min: 300, max: 460 },
    goal: "展示从业务问题到可验证 AI 方案的产品方法。", thesis: "我通常先确认用户任务、流程阻力和验收标准，再决定规则、模型与人工确认分别承担什么。",
    required: ["问题和流程拆解", "规则模型人工分工", "轻量验证与升级"], direct: ["业务问题", "方案", "验证"],
    fallback: "我不会从“这里能不能加一个模型”开始，而是先把业务问题拆成**用户任务、流程阻力和验收标准**。例如审计资料整理与日志核查中，真正的问题往往是字段多、规则重复、证据难追踪和人工复核成本高，因此需要先确定哪些步骤适合规则化，哪些需要模型辅助，哪些必须保留人工确认。\n\n然后我会用**最轻量的方案验证闭环**：输入是什么、模型或规则产出什么、用户在哪里确认、错误如何被记录。只有职责、工具或评价标准明显不同，才考虑拆分 Agent；只有基础方案已经证明有价值，才依据并发、数据规模和流程复杂度升级架构。这样得到的不是为了展示 AI 的功能，而是一条能被业务理解、使用和继续改进的产品流程。",
    next: ["audit_product_example", "enterprise_ai", "evaluation"],
  }),
  define({
    id: "evaluation", question: "你如何评估并改进 AI 产品效果？", aliases: ["他如何评估并改进 AI 产品效果？", "你如何定义并验收 AI 产品效果？", "他如何定义并验收 AI 产品效果？", "你如何评估 RAG 回答质量？"], topic: "skills", facet: "evaluation",
    dimensions: ["目标指标", "分层评测", "Bad Case 决策"], knowledge: ["K23", "K25", "K29", "K31"], stories: ["ST9", "ST10", "ST1"], length: { min: 320, max: 520 },
    goal: "说明候选人如何用评测推动产品迭代。", thesis: "我会先把“效果好”拆成可观察的链路指标，再用 Bad Case 决定下一轮优先级。",
    required: ["七维指标与 Gate", "固定评测集", "Bad Case 分类和单变量验证"], direct: ["评估", "指标", "Bad Case"],
    fallback: "我会先把“效果好”翻译成**用户任务、指标、Gate 和证据**，而不是只看几条演示。在百度 AI Coding 评测中，我参与把质量拆成功能、端到端可用性、视觉、交互、响应式、可访问性和代码质量，并用 Gate 防止构建失败或核心流程失败被体验分掩盖。\n\n执行评测后，我会把 **Bad Case** 沿模型、Prompt、检索、工具、环境和评测器分类，结合日志、Trace、DOM、网络和截图寻找根因。出现争议时用**控制变量复测**，评测器失败与候选产品失败必须分开。\n\n在 RAG 项目中，这套方法会进一步拆到知识摄入、召回、回答忠实度和引用支持。每轮固定任务与口径，只改变一个关键变量；没有足够样本时只说趋势，不把单样例结果包装成整体提升。评测的目的不是得到一个漂亮总分，而是让团队知道问题在哪里、下一步改什么。",
    next: ["baidu_metrics", "baidu_badcase", "baidu_reliability"],
  }),
  define({
    id: "statistics_product", question: "应用统计学背景如何帮助你做 AI 产品？", aliases: ["应用统计学背景如何帮助他做 AI 产品？", "你的统计学背景能怎样支持产品决策？", "他的统计学背景能怎样支持产品决策？"], topic: "statistics", facet: "transfer",
    dimensions: ["指标定义", "不确定性判断", "产品决策"], knowledge: ["K3", "K17"], forbidden: ["deepflow", "audit", "local_tools"], length: { min: 280, max: 440 },
    goal: "把统计训练具体映射到 AI 产品决策。", thesis: "统计学背景对我最大的帮助，是让我在做产品判断时先问指标是否可信、差异来自哪里以及结论能否复现。",
    required: ["指标与样本意识", "分层分析和失败样本", "用数据支持取舍"], direct: ["统计", "指标", "产品决策"],
    fallback: "统计学背景对我最大的帮助，是让我在做产品判断时先问三个问题：**指标是否可信、差异来自哪里、结论能否复现**。这会直接影响 AI 产品的评测设计，而不只是用于事后做报表。\n\n在项目中，我会先明确要验证的用户任务和成功标准，再**固定样本与评价口径**，把整体结果拆到不同类型的 Bad Case 中观察。如果平均表现变化不大，但某一类高价值问题持续失败，产品优先级就不应该被平均数掩盖；如果样本或标注口径变化，模型结果也不能直接横向比较。\n\n因此统计训练让我更习惯用**基线、分层、对照和误差分析**支持产品取舍，把“感觉模型更好了”转化为可以讨论、验证和继续迭代的判断。",
    next: ["data_evaluation", "evaluation", "differentiation"],
  }),
  define({
    id: "profession_value", question: "你的专业对你做 AI 产品有什么帮助？", aliases: ["你的专业对你做AI产品有什么帮助", "应用统计学专业对 AI 产品有什么价值？", "你所学专业如何支持产品判断？", "专业背景对你求职 AI 产品有什么帮助？"], topic: "statistics", facet: "transfer",
    dimensions: ["数据与实验判断", "评测和 Bad Case 方法", "业务与风险意识"], knowledge: ["K3", "K17", "K8", "K9"], forbidden: ["deepflow", "local_tools"], length: { min: 280, max: 480 }, generationMode: "realtime",
    goal: "解释应用统计学专业以及相邻经历如何迁移为 AI 产品判断能力。", thesis: "应用统计学专业对我做 AI 产品最直接的帮助，是让我习惯用数据、实验和结论边界支撑判断。",
    required: ["数据与实验意识", "建立基线、控制变量和分析 Bad Case", "对产品判断的迁移价值"], direct: ["专业", "统计", "AI 产品", "帮助"],
    fallback: "应用统计学专业对我做 AI 产品最直接的帮助，是让我具备**数据与实验意识**，习惯用样本、指标和结论边界支撑判断。我会先明确用户任务与成功标准，再**建立基线、控制变量并分析 Bad Case**，判断问题来自哪里、下一步应该验证什么。审计经历进一步强化了我对业务流程、证据和风险的敏感度。因此，这些训练让我能把模糊的产品感受转化为**可验证的产品判断**。",
    next: ["statistics_product", "evaluation", "role_fit"],
  }),
  define({
    id: "ask_me_capability", question: "Ask Me 项目体现了什么能力？", aliases: ["Ask Me 项目体现了你什么能力？", "Ask Me 体现了你哪些产品能力？", "这个数字分身项目体现了什么能力？", "你从 Ask Me 项目中验证了什么？"], topic: "ask_me", facet: "method",
    dimensions: ["招聘决策路径", "可信回答机制", "评测驱动迭代"], knowledge: ["K12", "K38"], length: { min: 320, max: 520 },
    goal: "说明 Ask Me 如何验证从用户问题、可信机制到持续评测的完整 AI 产品能力。", thesis: "Ask Me 最能体现的，是我如何把模糊的求职目标拆成一条可信、可追问、可持续验证的 AI 产品闭环。",
    required: ["招聘决策路径", "事实与风险分级", "163 项自动化测试和 48 个 AI 面试用例"], direct: ["Ask Me", "产品闭环", "可信", "评测"],
    fallback: "Ask Me 最能体现的是我如何把一个模糊的求职目标，拆成完整的 AI 产品闭环，而不是只做聊天页面。传统简历信息有限、不能继续追问，项目贡献也很难核验，所以我从招聘方决策过程出发，设计“快速了解—深入追问—核验项目—查看简历或联系”的路径，并支持推荐问题、自由提问、多轮指代和动态追问。\n\n**可信回答与产品取舍**：我把经历拆成事实、贡献和来源，按问题风险分级回答——高频题快速响应，事实题二次审校，方法题实时生成；同时保留主动拒答，让数字分身可以像面试一样优化表达，但不编造结果。\n\n**评测驱动迭代**：我建立核心问答、安全和多轮对话回归，最新版简历记录 163 项自动化测试和 48 个 AI 面试用例。测试不是招聘转化数据，但能持续发现答非所问、过度拒答、重复套话和流式异常。这个项目体现了我从用户决策出发定义产品、平衡速度、表现力与可信度，并持续验收体验的能力。",
    next: ["internship_transfer", "evaluation", "role_fit"],
  }),
  define({
    id: "audit_value", question: "审计经历如何帮助你做 AI 产品？", aliases: ["审计经历如何帮助他做 AI 产品？", "你如何把审计经验迁移到企业 AI 场景？", "他如何把审计经验迁移到企业 AI 场景？"], topic: "audit", facet: "transfer",
    dimensions: ["流程理解", "证据意识", "企业风险"], knowledge: ["K8", "K9", "K7"], stories: ["ST4", "ST6"], forbidden: ["rag", "deepflow", "local_tools"], length: { min: 280, max: 450 },
    goal: "解释审计经历向企业 AI 产品能力的迁移。", thesis: "审计经历让我理解企业 AI 的价值不仅是自动化，还包括证据、口径、权限和人工复核。",
    required: ["复杂流程理解", "证据与风险意识", "产品化迁移"], direct: ["审计", "企业 AI", "证据"],
    fallback: "审计经历让我理解，企业 AI 的价值不能只用“自动化了多少步骤”衡量，还要看**证据是否可追踪、口径是否一致、风险是否可控制**。在 IT 审计和财务审计中，我接触到日志核查、IPE、底稿、函证和盘点等工作，它们共同特点是流程复杂、字段多、结论需要依据，并且关键节点必须保留人工判断。\n\n这会影响我做 AI 产品的方式：先梳理**真实工作流和高成本环节**，再判断**规则、模型与人工**分别适合承担什么；对模型输出保留来源、状态和复核入口；对客户资料与内部数据设置清晰边界。审计经历带给我的不是某个行业标签，而是一套更适合企业场景的流程理解和风险意识。",
    next: ["audit_product_example", "internship_transfer", "enterprise_ai"],
  }),
  define({
    id: "internship_transfer", question: "你的实习和项目是如何串联起来的？", aliases: ["你的实习经历沉淀了哪些可迁移能力？", "他的实习经历沉淀了哪些可迁移能力？", "你的项目怎么串联起来？", "这些项目之间有什么关系？", "为什么做这些项目？"], topic: "profile", facet: "transfer",
    dimensions: ["流程与证据", "真实 AI 产品闭环", "Agent 产品验证", "能力迁移"], knowledge: ["K1", "K8", "K27", "K19", "K22", "K12", "K5", "K37", "K39"], stories: ["ST11", "ST10", "ST9", "ST6"], length: { min: 400, max: 600 },
    goal: "以最新简历为主线，说明德勤、百川、百度和独立项目如何形成连续的 AI 产品能力。", thesis: "我的实习和项目不是横向堆叠，而是在同一条能力主线上逐步深入。",
    required: ["德勤流程证据意识", "百川与百度真实 AI 产品闭环", "Ask Me 与 DeepFlow 验证", "统一方法"], direct: ["串联", "百川", "百度", "Ask Me", "DeepFlow"],
    fallback: "我的实习和项目可以这样**串联**：先理解真实流程，再把问题转成 AI 产品，最后用评测和 Bad Case 推动迭代。\n\n**真实 AI 闭环**：应用统计学和德勤 IT 审计让我建立样本、指标、流程、证据和风险意识，也启发了日志抽查与资料归档工具；百川医疗 RAG 把这种意识迁移到知识库、检索、来源和四维评测；百度又把质量判断推进到六类任务、七维 Gate、多模型 Pilot 和工具协议归因。\n\n**Agent 项目验证**：Ask Me 将可信回答和风险分级用于招聘决策，DeepFlow 将多 Agent、私域 RAG、引用与 Trace 用于复杂研究；Resume Autofill AI、个人知识库、HarnessLab、Read-Later Regret 和 Downloads Butler 则验证更具体的问题。项目名称不同，但底层方法一致：发现问题、定义方案、快速验证、评测归因和持续迭代。",
    next: ["baichuan_internship", "baidu_internship", "role_fit"],
  }),
  define({
    id: "education_combination", question: "你的教育与项目经历形成了怎样的能力组合？", aliases: ["他的教育与项目经历形成了怎样的能力组合？", "你的经历形成了哪些差异化能力组合？", "他的经历形成了哪些差异化能力组合？"], topic: "profile", facet: "fit",
    dimensions: ["数据能力", "真实评测", "产品工程"], knowledge: ["K3", "K22", "K23", "K8"], shape: "fit_mapping", length: { min: 320, max: 500 },
    goal: "解释候选人经历组合的差异化。", thesis: "我的经历形成了数据评测、企业业务理解和产品工程落地三项互相支撑的能力。",
    required: ["统计与数据", "百度模型评测", "审计和产品工程"], direct: ["能力组合", "数据", "评测", "产品"],
    fallback: "我的经历形成了三项互相支撑的能力：**数据与评测、企业业务理解、产品工程验证**。应用统计学让我具备指标、样本和不确定性意识；百度实习让我把这套思维用于模型或 Agent 版本评测、Bad Case 归因，以及 AI Coding 七维指标和 Evaluator Agent MVP；德勤与容诚的审计经历则让我理解流程、证据、风险和人工复核。\n\nRAG、DeepFlow 与 Ask Me 等项目补充了我把需求、工作流和评测方案推进成**可运行原型**的能力。这些经历不是简单叠加：统计能力帮助我判断差异是否可信，业务经历帮助我识别责任和风险边界，评测实习与项目实践让我把判断转成任务、指标、证据和验收。\n\n这种组合让我能够在业务、模型与工程之间建立共同语言，并持续把讨论落到**可验证的产品动作**上。",
    next: ["role_fit", "statistics_product", "representative_project"],
  }),
  define({
    id: "technical_skills", question: "你的核心技术能力有哪些？", aliases: ["他的核心技术能力有哪些？"], topic: "skills", facet: "overview",
    dimensions: ["数据分析", "模型评测技术", "工程协作"], knowledge: ["K3", "K23", "K24", "K4"], length: { min: 300, max: 470 }, goal: "用产品视角说明技术能力边界。",
    thesis: "我的技术能力重点不是单一框架熟练度，而是能理解并推进 AI 产品从数据、模型到工程链路。", required: ["SQL 与 Python", "RAG 和评测", "API 与工作流"], direct: ["技术能力", "数据", "RAG"],
    fallback: "我的技术能力重点不是单一框架熟练度，而是能理解并推进 AI 产品**从数据、模型到工程链路**。数据侧使用 SQL、Python 完成处理和分析；AI 产品侧接触 Prompt、RAG、Dense Retrieval、Milvus、RAGAS 与 Agent 工作流；工程协作侧能够理解 FastAPI、异步任务、存储、容器部署和接口联调。\n\n我不会把自己包装成资深算法或后端工程师。我的优势是能读懂这些组件的能力边界，把它们映射到**用户问题、质量指标和交付风险**，并借助 AI 编程工具完成原型实现、调试与测试。最终由我负责的是技术方案是否服务于产品目标，以及结果能否被验证和验收。",
    next: ["data_evaluation", "ai_coding", "tech_collaboration"],
  }),
  define({
    id: "data_evaluation", question: "你在数据分析与 AI 评测方面有哪些实践？", aliases: ["他在数据分析与 AI 评测方面有哪些实践？"], topic: "skills", facet: "evaluation",
    dimensions: ["数据分析方法", "真实模型评测", "迭代决策"], knowledge: ["K3", "K22", "K23", "K24", "K25", "K35", "K36"], stories: ["ST9", "ST1"], length: { min: 320, max: 500 }, goal: "展示数据分析和真实模型评测如何共同支持迭代。",
    thesis: "我会把数据分析和 AI 评测放在同一条迭代链路里：先定义问题，再用样本、指标和失败证据决定动作。", required: ["6 个模型 36 次 Pilot", "Gold 缺陷注入与重复检查", "RAG 三轮 30 次评测"], direct: ["数据分析", "AI 评测", "Pilot"],
    fallback: "我在数据分析与 AI 评测上的实践，重点是把模糊的“效果好不好”变成可检查、可归因、能推动迭代的判断。\n\n**多模型 Pilot**：在百度 AI Coding Web 评测中，我参与设计六类任务、七维指标和 Gate，并完成 6 个模型、36 次正式 Pilot 与 18 份盲评；校准中结合 Gold、缺陷注入和重复检查，验证硬检查与主观判断各自的可靠性。\n\n**RAG 质量回归**：在百川医疗 RAG 中，我参与三轮、累计 30 次 QA 评测，并从单跳与多跳差异中定位风险。两段实践让我形成了用样本、指标、证据和结论边界支持产品判断的习惯，而不是把一次分数当成答案。",
    next: ["baidu_metrics", "baidu_badcase", "statistics_product"],
  }),
  define({
    id: "enterprise_ai", question: "你对企业级 AI 场景有哪些理解？", aliases: ["他对企业级 AI 场景有哪些理解？"], topic: "enterprise_ai", facet: "method",
    dimensions: ["流程价值", "可控性", "持续验证"], knowledge: ["K8", "K17", "K21"], length: { min: 300, max: 460 }, goal: "说明企业 AI 与演示型 AI 的差异。",
    thesis: "我理解企业级 AI 的重点不是展示模型能力，而是进入真实流程后仍然有价值、可控并且能够持续验证。", required: ["进入真实流程", "证据权限和人工复核", "评测验证和错误回流"], direct: ["企业级 AI", "流程", "可控"],
    fallback: "我理解企业级 AI 的重点不是展示模型能力，而是进入真实流程后仍然**有价值、可控并且能够持续验证**。产品首先要找准高频、高成本或容易出错的任务，再明确输入数据是否有资格使用、模型输出由谁确认、错误如何回流。\n\n审计经历让我特别关注**证据、权限、口径和人工复核**；RAG 项目让我看到检索、引用与评测决定回答能否被信任；DeepFlow 则体现了 Agent 自主性必须配合任务状态、过程观测和关键人审节点。\n\n因此企业 AI 方案应先用**轻量流程验证价值**，再根据数据规模、并发和协作复杂度升级，而不是一开始追求最复杂的 Agent 架构。能否进入业务流程并被稳定验收，比一次演示是否惊艳更重要。",
    next: ["business_to_ai", "audit_value", "speed_quality"],
  }),
  define({
    id: "ai_coding", question: "你如何使用 AI 编程工具提升交付效率？", aliases: ["他如何使用 AI 编程工具提升交付效率？", "这些项目里 AI 编程工具承担了多少工作？"], topic: "skills", facet: "collaboration",
    dimensions: ["工具承担内容", "本人判断", "质量门禁"], knowledge: ["K4", "K5", "K12"], stories: ["ST3"], length: { min: 300, max: 470 }, goal: "说明人机分工而不虚构贡献比例。",
    thesis: "我把 AI 编程工具当作工程协作者，用它提高实现和调试速度，但不把产品判断与验收外包给模型。", required: ["AI 辅助实现调试文档", "本人负责问题取舍", "测试和质量门禁"], direct: ["AI 编程", "工程协作者", "验收"],
    fallback: "我把 AI 编程工具当作工程协作者，用它提高代码实现、调试、测试补充和文档整理的速度，但不会把**问题定义、产品取舍和最终验收**外包给模型。开始前我先明确目标、接口和完成标准，再让工具处理可拆分的工程任务。\n\n生成结果不会直接视为完成。我会检查关键链路、运行测试、复核异常分支，并通过**事实门禁、隐私扫描和回归用例**验证输出。遇到工具反复修补却无法解释的问题，会回到需求或架构层重新拆分，而不是继续叠加提示词。\n\n我不虚构一个精确的代码贡献比例。更重要的职责边界是：AI 提高执行效率，我负责决定做什么、接受什么结果以及哪些风险不能被带到产品里。",
    next: ["project_contribution", "speed_quality", "technical_skills"],
  }),
  define({
    id: "differentiation", question: "你最值得面试官关注的三项优势是什么？", aliases: ["他最值得面试官关注的三项优势是什么？"], topic: "role_fit", facet: "fit",
    dimensions: ["数据评测", "企业业务", "产品落地"], knowledge: ["K2", "K3", "K8", "K4"], shape: "fit_mapping", length: { min: 280, max: 440 }, goal: "形成清晰可记忆的差异点。",
    thesis: "我最值得关注的三项优势是数据评测、企业业务理解和产品工程落地。", required: ["数据评测", "审计业务理解", "AI 产品落地"], direct: ["三项优势", "数据", "业务", "落地"],
    fallback: "我最值得面试官关注的三项优势是 **数据评测**、**企业业务理解**和**产品工程落地**。第一，应用统计学背景让我习惯先定义指标、建立基线并通过失败样本定位问题，而不是只凭演示感受判断 AI 效果。\n\n第二，德勤 IT 审计和容诚财务审计经历让我理解复杂流程、证据口径、权限风险和人工复核，这使我更适合思考企业 AI，而不只是消费级聊天功能。第三，我通过 RAG、DeepFlow 和 Ask Me 等项目，把产品定位、检索或 Agent 工作流、评测设计和工程实现连成可演示链路。三者结合，让我能够在业务、数据和技术之间完成翻译，并把讨论推进到可验证的产品动作。",
    next: ["role_fit", "representative_project", "education_combination"],
  }),
  define({
    id: "work_scope", question: "你最能胜任哪些 AI 产品工作？", aliases: ["他最能胜任哪些 AI 产品工作？"], topic: "role_fit", facet: "fit",
    dimensions: ["需求分析", "评测迭代", "原型交付"], knowledge: ["K2", "K4", "K5", "K8"], length: { min: 260, max: 430 }, goal: "让面试官快速判断可承担的工作范围。",
    thesis: "现阶段我最能胜任的是 AI 产品需求分析、原型推进、评测迭代和企业流程型场景的方案设计。", required: ["需求和流程拆解", "RAG Agent 评测", "工程协作与验收"], direct: ["胜任", "需求", "评测", "原型"],
    fallback: "现阶段我最能胜任的是 **AI 产品需求分析**、原型推进、**评测迭代**和**企业流程型场景的方案设计**。我能够把模糊业务问题拆成用户任务、流程节点和验收标准，再与技术讨论 RAG、Agent、规则或人工确认应如何分工。\n\n在推进过程中，我可以负责需求优先级、原型范围、评测集、Bad Case 分类和最终验收，并借助 AI 编程工具完成必要的工程实现与联调。审计经历也让我对企业数据、证据和风险节点更敏感。\n\n我目前不是资深算法或大型商业化产品负责人，更适合从一个具体场景切入，用较快的原型和严谨的验证建立产品闭环，再逐步承担更复杂的产品责任。",
    next: ["business_to_ai", "tech_collaboration", "role_fit"],
  }),
  define({
    id: "demo_results", question: "你有哪些可以直接演示的项目成果？", aliases: ["他有哪些可以直接演示的项目成果？"], topic: "profile", facet: "result",
    dimensions: ["代表成果", "演示内容", "完成边界"], knowledge: ["K4", "K5", "K6", "K7", "K12"], length: { min: 280, max: 440 }, goal: "说明可演示成果而不冒充生产规模。",
    thesis: "目前可以直接展示的成果包括 RAG 知识库主链路、DeepFlow 多 Agent MVP、Ask Me 数字分身以及几类本地优先和审计工具原型。", required: ["RAG", "DeepFlow", "Ask Me 或工具原型"], direct: ["演示", "RAG", "DeepFlow"],
    fallback: "目前可以直接展示的成果主要有三类。第一是 **RAG Knowledge Base System**，可以说明专业文档摄入、Dense Retrieval、回答生成以及围绕引用和评测设计的完整链路。第二是 DeepFlow 多 Agent 研究工作台，已经形成 Coordinator、Planner、Researcher、Coder 和 Reporter 协作的**可演示 MVP**。\n\n第三类是 Ask Me 数字分身、本地优先效率工具和审计资料工具原型，它们分别体现内容检索与回答门禁、隐私优先设计，以及把重复业务流程转成产品方案的能力。\n\n这些成果适合用于展示我的**问题定义、产品取舍、评测和工程推进能力**，但我不会把可演示原型描述成已经拥有真实用户规模或生产商业化结果。",
    next: ["representative_project", "project_contribution", "speed_quality"],
  }),
  define({
    id: "rag_methods", question: "RAG 项目体现了你哪些产品方法？", aliases: ["RAG 项目体现了他哪些产品方法？", "RAG 项目中有哪些产品取舍？", "RAG 项目还有哪些取舍？"], topic: "rag", facet: "method",
    dimensions: ["问题分层", "质量闭环", "迭代取舍"], knowledge: ["K28", "K29", "K31"], stories: ["ST10", "ST1"], forbidden: ["deepflow", "audit", "local_tools"], length: { min: 300, max: 480 }, goal: "回答 RAG 项目背后的产品方法，而不是复述架构。",
    thesis: "RAG 项目最能体现我的三种产品方法：按用户链路拆问题、用评测建立质量基线、依据 Bad Case 控制迭代范围。", required: ["用户链路拆解", "评测基线", "Bad Case 和范围取舍"], direct: ["产品方法", "评测", "Bad Case"],
    fallback: "RAG 项目最能体现我的三种产品方法。第一是**按用户任务拆问题**：我把医疗私有文档问答拆成文档处理、知识库管理、检索问答和评测四层，每一层都对应用户状态、异常和验收责任。\n\n第二是**先建立质量基线**。当前用 Dense Retrieval 建立召回基线，再单独接入 Rerank 检查前排证据质量；BM25 仍作为后续对照，而不是把规划包装成已完成。\n\n第三是**让质量进入闭环**：通过 QA 数据和 Faithfulness、Relevancy、Context Precision、Accuracy 四维评测发现趋势，再把 Bad Case 回到召回、排序或生成。Judge 不是绝对真值，仍需固定配置和人工校准。这样技术选型才能真正转成产品优先级。",
    next: ["evaluation", "project_contribution", "speed_quality"],
  }),
  define({
    id: "deepflow_thinking", question: "DeepFlow 体现了你哪些多 Agent 产品思考？", aliases: ["DeepFlow 体现了他哪些多 Agent 产品思考？"], topic: "deepflow", facet: "method",
    dimensions: ["任务拆分", "自主与可控", "私域检索与过程观测"], knowledge: ["K5", "K18", "K19", "K21"], stories: ["ST2"], forbidden: ["rag", "audit", "local_tools"], length: { min: 320, max: 500 }, goal: "说明多 Agent 设计的产品判断。",
    thesis: "DeepFlow 体现的核心不是 Agent 数量，而是如何按职责拆任务、控制自主性并让过程可观察。", required: ["角色职责和交接", "人审节点", "状态与报告资产"], direct: ["Agent", "分工", "人审", "观测"],
    fallback: "DeepFlow 体现的核心不是 Agent 数量，而是**如何按职责拆任务、控制自主性并让过程可观察**。Coordinator 负责组织任务，Planner 拆解研究计划，Researcher 和 Coder 分别处理资料与分析执行，Reporter 汇总报告；角色划分服务于不同工具、上下文和评价标准，而不是为了形式上显得复杂。\n\n产品取舍上，我不会让复杂研究任务一次性完全交给模型。高成本或方向性节点需要**人工确认**，过程要保留任务状态、关键字段和产物链路，便于发现计划跑偏、资料不足或报告无法追溯。\n\n因此我对多 Agent 的理解是：先用轻量工作流验证闭环，只有职责和评价标准确实不同才拆 Agent，并用**人审与可观测性**换取可控的自主执行。",
    next: ["agent_collaboration", "project_contribution", "enterprise_ai"],
  }),
  define({
    id: "requirements", question: "你在需求分析和方案设计方面有哪些实践？", aliases: ["他在需求分析和方案设计方面有哪些实践？"], topic: "skills", facet: "method",
    dimensions: ["问题定义", "方案取舍", "验收闭环"], knowledge: ["K7", "K17", "K21"], stories: ["ST4"], length: { min: 280, max: 450 }, goal: "用多个实践说明需求到方案的能力。",
    thesis: "我的需求分析习惯是先确认真实任务和流程阻力，再把方案范围、风险与验收方式同时定义出来。", required: ["用户任务和流程", "规则模型人工分工", "验证与验收"], direct: ["需求分析", "方案设计", "验收"],
    fallback: "我的需求分析习惯是先确认真实任务和流程阻力，再把**方案范围、风险与验收方式**同时定义出来。在审计工具中，我从资料归档、日志核查等重复工作识别字段、规则和复核节点；在 RAG 项目中，把专业问答拆成摄入、检索、回答、引用和评测；在 DeepFlow 中，则根据角色职责和工具差异设计 Agent 分工。\n\n方案阶段我会明确哪些问题用规则即可，哪些适合模型，哪些必须由人确认，并优先用**最轻量原型验证闭环**。验收不是“功能已经写完”，而是用户任务能否完成、错误能否定位、关键风险是否可控，以及下一轮优化有没有数据和 Bad Case 依据。",
    next: ["business_to_ai", "audit_product_example", "evaluation"],
  }),
  define({
    id: "speed_quality", question: "你如何平衡原型速度与交付质量？", aliases: ["他如何平衡原型速度与交付质量？"], topic: "skills", facet: "method",
    dimensions: ["MVP 范围", "质量底线", "升级条件"], knowledge: ["K12", "K17", "K21"], stories: ["ST3"], length: { min: 280, max: 440 }, goal: "展示快速交付但不牺牲关键质量的取舍。",
    thesis: "我会压缩功能范围来换速度，但不会压缩决定可信度的验证、隐私和关键异常处理。", required: ["最短闭环和功能范围", "测试和质量门禁", "Bad Case 后升级"], direct: ["原型速度", "交付质量", "MVP"],
    fallback: "我平衡**原型速度与交付质量**的方法，是压缩功能范围，但不压缩决定可信度的验证、隐私和关键异常处理。原型阶段先找**最短闭环**，只实现完成用户任务所必需的链路；例如 RAG 先跑通主检索路径，Agent 先验证角色交接和人审节点，而不是一次做完所有高级功能。\n\n与此同时，我会为关键环节设底线：输入是否合法、模型结果是否越界、核心流程是否有测试、失败是否能被定位。AI 编程工具可以提高实现速度，但生成代码仍要经过**构建、测试和质量门禁**。\n\n只有轻量方案已经证明有价值，并且 Bad Case、数据规模或协作复杂度明确暴露瓶颈时，才升级架构。这样速度来自减少不必要范围，而不是把风险推迟到交付之后。",
    next: ["ai_coding", "evaluation", "rag_methods"],
  }),
  define({
    id: "starting_scenarios", question: "你适合从哪些业务场景开始创造价值？", aliases: ["他适合从哪些业务场景开始创造价值？"], topic: "role_fit", facet: "fit",
    dimensions: ["适合场景", "切入方式", "初期价值"], knowledge: ["K7", "K17", "K21", "K8"], length: { min: 280, max: 440 }, goal: "说明候选人入职后可快速切入的业务。",
    thesis: "我适合先从知识密集、流程明确、需要质量验证和人工复核的企业 AI 场景切入。", required: ["知识或流程型场景", "轻量原型", "评测和人审"], direct: ["业务场景", "知识", "流程"],
    fallback: "我适合先从**知识密集、流程明确、需要质量验证和人工复核**的企业 AI 场景切入，例如内部知识问答、研究资料整理、审计或运营资料处理，以及需要 Agent 协作但不能完全放任模型的工作流。\n\n这些场景与我的经历匹配：统计背景支持指标与评测设计，审计经历帮助理解流程、证据和风险，RAG 与 DeepFlow 项目让我能够讨论检索、Agent 分工、人审和工程链路。入职初期我会先选择一个边界清楚的用户任务，梳理输入输出和验收标准，用**轻量原型验证价值**，再通过**Bad Case 决定下一轮投入**。这样可以较快形成可演示、可讨论、可继续迭代的结果。",
    next: ["work_scope", "business_to_ai", "enterprise_ai"],
  }),
  define({
    id: "tech_collaboration", question: "你与技术团队协作时可以承担哪些职责？", aliases: ["他与技术团队协作时可以承担哪些职责？"], topic: "skills", facet: "collaboration",
    dimensions: ["需求翻译", "方案取舍", "联调验收"], knowledge: ["K4", "K5", "K19"], length: { min: 280, max: 440 }, goal: "说明候选人在产品技术协作中的具体职责。",
    thesis: "我可以承担业务问题翻译、方案边界讨论、评测设计以及联调验收之间的连接角色。", required: ["需求和技术翻译", "技术选型取舍", "评测联调验收"], direct: ["技术团队", "职责", "验收"],
    fallback: "我可以承担业务问题翻译、方案边界讨论、评测设计以及联调验收之间的连接角色。前期把**用户任务、输入输出、异常情况和验收标准**整理清楚，避免只给工程一个模糊的“做个 AI 功能”。\n\n方案阶段，我能够和技术讨论 RAG 检索链路、Agent 职责、数据与存储、异步任务和可观测性，并从**用户价值、实现成本和风险**角度参与取舍。我不会代替工程师做所有底层判断，但可以把技术差异转成产品影响。\n\n联调阶段，我负责准备测试问题、分类 Bad Case、确认关键异常和边界是否覆盖，并推动结果回到下一轮需求。我的价值是让业务、产品和技术围绕同一套**可验证目标**协作。",
    next: ["requirements", "ai_coding", "project_contribution"],
  }),
  define({
    id: "audit_product_example", question: "举一个审计问题转成产品的例子。", aliases: ["你如何把一个审计问题转成产品？"], topic: "audit", facet: "example",
    dimensions: ["原始问题", "产品判断", "方案闭环"], knowledge: ["K7"], stories: ["ST4"], forbidden: ["local_tools", "rag", "deepflow"], shape: "star", length: { min: 320, max: 500 }, goal: "用真实审计工具故事说明产品化过程。",
    thesis: "一个具体例子是把审计资料整理与日志核查中的重复步骤，转成可配置、可复核的工具流程。", required: ["审计资料或日志问题", "规则和人工复核", "公开原型"], direct: ["审计问题", "产品", "日志", "复核"],
    fallback: "一个具体例子是把审计资料整理与日志核查中的重复步骤，转成**可配置、可复核的工具流程**。原始工作中会出现大量字段、重复规则和证据整理任务，如果只追求自动生成结果，反而容易失去口径和追踪能力。\n\n我的产品判断是先保留业务结构：明确输入资料、需要识别或核查的字段、规则执行结果以及**人工确认节点**，再考虑 OCR、规则或模型分别承担什么。真实客户资料不能直接用于公开开发，因此原型**只保留问题结构和通用流程**，不带入客户、底稿或内部数据。\n\n最终形成的是审计资料智能归档助手和 IT 审计日志抽查助手等公开原型。这个过程体现了我把现场问题抽象为用户任务、数据结构、风险规则和验收流程的能力。",
    next: ["audit_value", "business_to_ai", "enterprise_ai"],
  }),
  define({
    id: "agent_collaboration", question: "Agent 之间如何协作？", aliases: ["DeepFlow 中 Agent 之间如何协作？"], topic: "deepflow", facet: "collaboration",
    dimensions: ["角色交接", "共享状态", "人审与观测"], knowledge: ["K18", "K19", "K21"], stories: ["ST2"], forbidden: ["rag", "audit", "local_tools"], length: { min: 280, max: 450 }, goal: "具体说明 DeepFlow 的 Agent 协作机制。",
    thesis: "DeepFlow 的 Agent 不是自由聊天，而是围绕研究任务按角色、输入输出和状态进行有序交接。", required: ["Coordinator Planner 等角色", "任务产物交接", "关键人审和状态观测"], direct: ["Agent", "协作", "交接", "人审"],
    fallback: "DeepFlow 的 Agent 不是自由聊天，而是围绕研究任务按**角色、输入输出和状态**进行有序交接。Coordinator 负责接收目标和组织流程，Planner 把目标拆成研究计划，Researcher 检索与整理资料，Coder 承担需要计算或结构化处理的任务，Reporter 汇总证据与分析形成报告。\n\n每个角色消费上一步的**明确产物**，而不是共享一段无限增长的对话；任务状态、关键字段和中间结果需要被记录，便于发现资料不足、计划跑偏或报告无法追溯。方向性、高成本或评价标准不清楚的节点加入**人工确认**。\n\n这样的协作设计让 Agent 的自主执行有边界，也使失败能够定位到计划、检索、分析还是报告环节。",
    next: ["deepflow_thinking", "project_contribution", "enterprise_ai"],
  }),
  define({
    id: "rag_architecture", question: "你的 RAG 项目如何设计混合检索和引用溯源？", aliases: ["RAG 项目的混合检索和引用溯源是怎样设计的？"], topic: "rag", facet: "architecture",
    dimensions: ["当前检索链路", "BM25 规划", "来源与评测"], knowledge: ["K29", "K31", "K4"], stories: ["ST1"], forbidden: ["deepflow", "audit", "local_tools"], length: { min: 300, max: 470 }, goal: "讲清 RAG 当前 Dense 加 Rerank 和来源片段实现，并区分 BM25 与完整引用规划。",
    thesis: "当前实现是稠密向量召回加 Rerank，并返回来源片段；BM25 混合检索与更完整的原文定位仍需实验。", required: ["Dense Retrieval 加 Rerank", "BM25 尚未落地", "来源片段和评测"], direct: ["Dense Retrieval", "Rerank", "来源片段"],
    fallback: "当前检索链路是先用 **Dense Retrieval** 扩大候选，再通过 **Rerank 精排**，将前排证据片段交给模型生成答案并返回来源片段。产品侧重点是用固定问题集同时检查证据召回、前排精度、最终回答、延迟和成本，并把失败样本区分为召回遗漏、排序错误或生成偏离。\n\nBM25 对药名、缩写和编号等精确词有价值，但当前还没有完整落地为混合检索，需要与现有基线做单变量对照后再决定融合方式。\n\n来源方面，当前能确认的是片段和元数据返回；PDF 页码高亮与一键定位原文仍是进一步完善方向。四维评测用于发现趋势，但 Judge 不是绝对真值，仍需固定配置和人工校准。",
    next: ["rag_methods", "evaluation", "project_contribution"],
  }),
  define({
    id: "audit_archive_tool", question: "你的审计资料智能归档助手能做什么？", aliases: ["他的审计工具如何完成资料归档？"], topic: "audit", facet: "overview",
    dimensions: ["资料字段抽取", "归档建议", "人工复核"], knowledge: ["K7"], stories: ["ST4"], forbidden: ["rag", "deepflow", "local_tools"], length: { min: 240, max: 390 }, goal: "说明审计资料归档原型的输入、处理方式和风险边界。",
    thesis: "审计资料智能归档助手把资料识别、字段抽取和归档建议组织成一条可人工复核的流程。", required: ["审计资料和字段抽取", "归档建议", "人工确认与演示数据"], direct: ["审计", "字段抽取", "归档"],
    fallback: "审计资料智能归档助手把资料识别、**字段抽取与归档建议**组织成一条可人工复核的流程。它先从演示资料中识别文件名、日期、主体等通用字段，再依据预设规则给出目录和命名建议，减少人工逐份整理的重复工作。\n\n对于字段缺失、内容冲突或无法确定的资料，工具只标记问题并交给人确认，不直接替代审计判断。公开原型使用演示数据，不接入真实客户底稿。我的重点是把归档工作拆成清楚的输入、规则、异常状态和**人工复核节点**，让结果可检查、可纠正。",
    next: ["audit_product_example", "audit_value", "business_to_ai"],
  }),
  define({
    id: "audit_log_tool", question: "你的 IT 审计日志抽查助手能做什么？", aliases: ["IT 审计日志抽查助手能做什么？"], topic: "audit", facet: "overview",
    dimensions: ["日志结构化", "异常规则", "审计关注点"], knowledge: ["K7"], stories: ["ST4"], forbidden: ["rag", "deepflow", "local_tools"], length: { min: 240, max: 390 }, goal: "说明日志抽查助手如何辅助发现异常并保留人工判断。",
    thesis: "IT 审计日志抽查助手用于把日志字段、抽查规则和异常关注点整理成可复核结果。", required: ["日志字段与抽查", "异常或风险规则", "人工复核"], direct: ["日志", "抽查", "异常"],
    fallback: "IT 审计日志抽查助手用于把**日志抽查与异常关注**整理成可复核结果。它先对演示日志做结构化处理，再按时间、账号、操作类型等通用规则标记需要关注的记录，帮助使用者更快定位异常或风险线索。\n\n工具不会把规则命中直接当成审计结论，而是保留原始记录、命中原因和人工复核入口。当前是基于公开问题结构制作的原型，不包含真实客户日志。我的产品判断是让自动化承担重复筛查，让**人工确认最终判断**。",
    next: ["audit_product_example", "audit_value", "enterprise_ai"],
  }),
  define({
    id: "campus_ambassador", question: "你的德勤校园大使经历体现了哪些业务能力？", aliases: ["他的德勤校园大使经历体现了哪些业务能力？"], topic: "audit", facet: "transfer",
    dimensions: ["流程主持", "校招推广", "沟通交付"], knowledge: ["K10"], length: { min: 220, max: 360 }, goal: "说明校园大使经历形成的现场沟通和执行能力。",
    thesis: "德勤校园大使经历主要训练了我在明确目标下组织流程、现场沟通和推进交付的能力。", required: ["校园大使", "主持或流程组织", "校招推广与沟通"], direct: ["校园大使", "主持", "推广"],
    fallback: "德勤校园大使经历主要训练了我的**流程组织与现场沟通**能力。我参与过流程主持和校招推广，需要把活动信息讲清楚、衔接不同环节，并根据现场反馈及时调整表达和节奏。\n\n这段经历本身不是复杂产品项目，但它补充了我在真实场景中的沟通与执行：面对不同受众时先判断对方最关心什么，再把信息组织成容易理解、能够继续行动的内容；遇到临时变化时保持节奏，把任务推进到结束。这种**信息表达与临场推进**能力可以迁移到需求沟通、评审主持和跨角色协作中。",
    next: ["internship_value", "audit_value", "role_fit"],
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
  profile: ["K1", "K2", "K3", "K8", "K27", "K22", "K37", "K39"], role_fit: ["K2", "K3", "K8", "K27", "K19", "K22", "K12", "K5", "K37"], baidu: ["K22", "K23", "K24", "K25", "K26", "K32", "K33", "K34"], rag: ["K4", "K27", "K28", "K29", "K30", "K31", "K35", "K36"],
  deepflow: ["K5", "K16", "K18", "K19", "K20", "K21"], ask_me: ["K12", "K38"], local_tools: ["K6", "K39"], audit: ["K7", "K8", "K9", "K10"],
  statistics: ["K3", "K17", "K31"], skills: ["K3", "K4", "K29", "K31", "K5", "K21"], enterprise_ai: ["K8", "K28", "K29", "K21"], agent: ["K18", "K19", "K21"], unknown: [],
};

const topicPatterns: Array<[QuestionTopic, RegExp]> = [
  ["baidu", /百度|\bbaidu\b|ai\s*coding|evaluator\s*agent|七维指标|硬门槛|dashboard\s*样例/i], ["rag", /百川智能|百川|医疗\s*rag|医疗知识助手|\brag\b|知识库|检索|引用/i], ["deepflow", /deepflow/i], ["agent", /agent|多智能体|多代理/i],
  ["local_tools", /thirty[-\s]?minute brain|read[-\s]?later regret|downloads butler|本地优先效率工具|信息债|下载文件夹/i],
  ["audit", /审计|德勤|容诚|日志核查|底稿|函证|盘点/i], ["statistics", /统计|指标|样本|数据分析|产品决策/i],
  ["enterprise_ai", /企业级?\s*ai|企业场景|业务问题.*(?:ai|产品)/i], ["role_fit", /岗位|(?:这个|该|目标)?岗(?:位)?|匹配|契合|适合|胜任|优势|团队价值/i],
  ["profile", /自我介绍|介绍一下|背景|经历组合/i], ["skills", /技能|技术|评测|ai\s*编程|协作|sql|python|fastapi|ragas/i], ["ask_me", /ask\s*me|数字分身/i],
];

const facetPatterns: Array<[QuestionFacet, RegExp]> = [
  ["example", /举例|例子|案例/i], ["contribution", /贡献|负责|做了什么|核心工作|职责/i], ["collaboration", /协作|分工|交接|配合/i],
  ["evaluation", /评测|评估|指标|验收|效果|质量|错误|失败|检查|bad\s*case/i], ["transfer", /迁移|沉淀|帮助|支持/i], ["result", /结果|成果|完成|上线|规模/i],
  ["boundary", /短板|不足|限制|边界|风险/i], ["architecture", /架构|链路|技术方案/i], ["method", /方法|如何|怎么|思考|取舍/i],
  ["problem", /解决.*问题|什么问题|痛点/i], ["fit", /匹配|契合|适合|胜任|优势|价值|能力组合/i],
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
  if (/^(?:你是谁|你叫什么|你的身份是什么|你能做什么|你可以做什么|你有什么(?:作用|用处|功能)|你是做什么的|你能干什么|你可以干什么|你不能回答开放(?:问题|题目)?(?:吗)?|你能回答开放(?:问题|题目)?(?:吗)?)[？?。.！!\s]*$/i.test(question)) {
    return {
      topic: "profile",
      facet: "overview",
      answerIntent: inferAnswerIntent(question, "profile", "overview"),
      questionMode: "agent_meta",
      evidencePolicy: "none",
      focusTerms: ["Agent 身份", "能力范围"],
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
    const facet = /结果|成果|上线|规模|用户|完成/.test(question) ? "result" : "overview";
    return {
      topic: "profile",
      facet,
      answerIntent: inferAnswerIntent(question, "profile", facet),
      questionMode: "candidate_fact",
      evidencePolicy: "supporting",
      focusTerms: ["RAG", "DeepFlow", facet === "result" ? "结果边界" : "项目对比"],
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
  const detectedTopic = topicPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? "unknown";
  const detectedFacet = facetPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? "overview";
  const initialIntent = inferAnswerIntent(question, detectedTopic, detectedFacet);
  const topic = ["career_transition", "experience_value"].includes(initialIntent) ? "profile" : initialIntent === "role_fit" ? "role_fit" : detectedTopic;
  const facet = ["career_transition", "experience_value"].includes(initialIntent) ? "transfer" : initialIntent === "role_fit" ? "fit" : initialIntent === "result" ? "result" : detectedFacet;
  const answerIntent = inferAnswerIntent(question, topic, facet);
  const targetRole = answerIntent === "role_fit"
    ? extractTargetRole(question) ?? [...history].reverse()
      .filter((message) => message.role === "user")
      .map((message) => extractTargetRole(message.content))
      .find(Boolean)
    : undefined;
  const questionMode = questionModeFor(question, answerIntent);
  const reference = /这个|该项目|其中|它|上述|这套|这种|这些|那些|那次|当时|刚才|前面/.test(question);
  const historyProject = [...history].reverse().find((message) => message.role === "user" && /百度|baidu|ai\s*coding|evaluator\s*agent|百川智能|百川|医疗\s*rag|rag|deepflow|ask\s*me/i.test(message.content))?.content.match(/百度|baidu|ai\s*coding|evaluator\s*agent|百川智能|百川|医疗\s*rag|rag|deepflow|ask\s*me/i)?.[0]?.toLowerCase();
  const inferredTopic = topic === "unknown" && reference
    ? (historyProject && /rag|百川/.test(historyProject) ? "rag" : historyProject === "deepflow" ? "deepflow" : historyProject?.includes("ask") ? "ask_me" : historyProject ? "baidu" : "unknown")
    : topic;
  const explicitTopic = inferredTopic !== "unknown";
  const hasMethodContext = /AI|产品|模型|RAG|DeepFlow|Agent|检索|评测|数据|用户|指标|需求|项目|功能|失败|复盘|取舍|协作|团队|岗位|工作|压力|冲突|学习|加班|职业|选择/i.test(question);
  const hasExplicitProjectOverviewAction = answerIntent === "project_overview"
    && /(?:项目|系统|工具|助手).{0,10}(?:能做什么|做什么|有什么功能|如何工作)/i.test(question);
  const hasStrongLocalIntent = !["general", "project_overview", "challenge", "diagnosis"].includes(answerIntent)
    || hasExplicitProjectOverviewAction
    || (["challenge", "diagnosis"].includes(answerIntent) && hasMethodContext);
  const interviewReasoning = /(?:你怎么看|如何看待|你会如何|如果|假设|面对|遇到|为什么|为何|如何|怎么).{0,20}(?:岗位|工作|团队|压力|冲突|学习|加班|职业|选择|产品|AI|业务|协作|沟通|优先级)/i.test(question);
  return {
    topic: inferredTopic,
    facet,
    answerIntent,
    questionMode,
    evidencePolicy: evidencePolicyFor(answerIntent, questionMode),
    focusTerms: focusTermsFor(answerIntent, targetRole),
    targetRole,
    requestedDimensions: [facet === "overview" ? "直接回答当前问题" : `${facet}相关判断`, "具体实践", "验证或落地方式"],
    activeProject: inferredTopic === "baidu" ? "baidu-ai-coding-evaluation" : inferredTopic === "rag" ? "rag-knowledge-base" : inferredTopic === "deepflow" || inferredTopic === "agent" ? "deepflow" : inferredTopic === "ask_me" ? "ask-me" : undefined,
    useHistory: reference,
    confidence: ["career_transition", "role_fit"].includes(answerIntent) ? 0.92 : interviewReasoning ? 0.86 : hasStrongLocalIntent ? 0.88 : explicitTopic && facet !== "overview" ? 0.86 : explicitTopic ? 0.72 : facet !== "overview" ? 0.58 : 0.35,
    requiredKnowledgeIds: ["career_transition", "experience_value"].includes(answerIntent) ? ["K1", "K2", "K3", "K8", "K27", "K22", "K37"] : topicKnowledge[inferredTopic],
    allowedStoryIds: facet === "example" ? (inferredTopic === "baidu" ? ["ST9"] : inferredTopic === "audit" ? ["ST4", "ST6"] : inferredTopic === "rag" ? ["ST1"] : inferredTopic === "deepflow" || inferredTopic === "agent" ? ["ST2"] : []) : [],
    forbiddenTopics: forbiddenFor(inferredTopic),
    responseShape: answerIntent === "career_transition" ? "narrative" : responseShapeFor(facet),
    targetLength: { min: facet === "overview" ? 220 : 280, max: 480 },
    answerGoal: "直接回应当前问题，并使用最相关的公开实践解释判断。",
    routeSource: "local",
  };
}

export function mergePlannedFrame(local: QuestionFrame, planned: z.infer<typeof plannedQuestionFrameSchema>, question = ""): QuestionFrame {
  const keepLocalIntent = local.confidence >= 0.82 && local.answerIntent !== "general";
  const blockCareerTransition = planned.answerIntent === "career_transition" && !hasCareerTransitionSignature(question);
  const inferredValueIntent = hasExperienceValueSignature(question) ? "experience_value" : local.answerIntent;
  const answerIntent = keepLocalIntent
    ? local.answerIntent
    : blockCareerTransition
      ? inferredValueIntent
      : planned.answerIntent;
  const plannedTopic = planned.topic === "unknown" ? local.topic : planned.topic;
  const topic = ["career_transition", "experience_value"].includes(answerIntent) ? "profile" : answerIntent === "role_fit" ? "role_fit" : plannedTopic;
  const facet = ["career_transition", "experience_value"].includes(answerIntent) ? "transfer" : answerIntent === "role_fit" ? "fit" : planned.facet;
  const targetRole = local.targetRole ?? planned.targetRole;
  const questionMode = keepLocalIntent || blockCareerTransition
    ? questionModeFor(question, answerIntent)
    : planned.questionMode;
  const conflictReason = local.answerIntent !== planned.answerIntent
    ? blockCareerTransition
      ? "missing_career_transition_signature"
      : keepLocalIntent
        ? "local_high_confidence"
        : undefined
    : undefined;
  return {
    ...local,
    topic,
    facet,
    answerIntent,
    questionMode,
    evidencePolicy: keepLocalIntent || blockCareerTransition ? evidencePolicyFor(answerIntent, questionMode) : planned.evidencePolicy,
    focusTerms: keepLocalIntent || blockCareerTransition ? focusTermsFor(answerIntent, targetRole) : planned.focusTerms,
    targetRole,
    requestedDimensions: planned.requestedDimensions,
    activeProject: planned.activeProject ?? (topic === "baidu" ? "baidu-ai-coding-evaluation" : topic === "rag" ? "rag-knowledge-base" : topic === "deepflow" || topic === "agent" ? "deepflow" : undefined),
    useHistory: planned.useHistory,
    confidence: planned.confidence,
    requiredKnowledgeIds: ["career_transition", "experience_value"].includes(answerIntent) ? ["K1", "K2", "K3", "K8", "K27", "K22", "K37"] : topicKnowledge[topic],
    allowedStoryIds: facet === "example" || facet === "transfer"
      ? (topic === "baidu" ? ["ST9"] : topic === "audit" ? ["ST4", "ST6"] : topic === "rag" ? ["ST1"] : topic === "deepflow" || topic === "agent" ? ["ST2"] : [])
      : [],
    forbiddenTopics: forbiddenFor(topic),
    responseShape: answerIntent === "career_transition" ? "narrative" : responseShapeFor(facet),
    targetLength: { min: facet === "overview" ? 220 : 280, max: 480 },
    answerGoal: "先直接回答问题，再使用最相关的公开实践说明判断、机制或迁移价值。",
    routeSource: "model",
    intentResolution: {
      localIntent: local.answerIntent,
      plannedIntent: planned.answerIntent,
      resolvedIntent: answerIntent,
      conflictReason,
    },
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
