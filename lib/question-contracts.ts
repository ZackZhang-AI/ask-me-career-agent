import { z } from "zod";
import { candidateNarrative } from "../content/narrative";
import type { AnswerIntent, EvidencePolicy, QuestionContract, QuestionFacet, QuestionFrame, QuestionMode, QuestionTopic, ResponseShape } from "./types";

const topics = ["profile", "role_fit", "didi", "baidu", "rag", "deepflow", "ask_me", "local_tools", "audit", "statistics", "skills", "enterprise_ai", "agent", "unknown"] as const;
const facets = ["overview", "problem", "method", "contribution", "architecture", "collaboration", "evaluation", "transfer", "example", "result", "boundary", "fit"] as const;
const answerIntents = ["agent_identity", "capability_scope", "introduction", "career_transition", "role_fit", "representative_project", "project_overview", "project_problem", "contribution", "ai_collaboration", "challenge", "diagnosis", "result", "limitation", "skills", "experience", "experience_value", "privacy", "education", "credentials", "hiring_recommendation", "general"] as const;

const careerTransitionPattern = /(?:为什么|为何).{0,12}(?:(?:从)?(?:财会|会计|财务|审计|统计)(?!问题)(?:背景|专业|经历)?.{0,12}(?:转向|转型|转(?!化)|选择|改做|走到|进入)|(?:转向|转型|选择|改做|走到|进入)).{0,12}(?:AI\s*产品|产品经理|产品)|(?:(?:从)(?:财会|会计|财务|审计|统计|原专业|传统行业)|(?:财会|会计|财务|审计|统计|原专业|传统行业)(?:背景|专业|经历)).{0,12}(?:转向|转型|转(?!化)|选择|改做|走到|进入).{0,8}(?:AI\s*产品|产品经理|产品)/i;
const careerTransitionContextPattern = /(?:财会|会计|财务|审计|统计|传统行业).{0,24}(?:产品|AI).{0,14}(?:连续|迁移|选择|适合|方向|准备)|(?:为什么|为何|如何|怎么).{0,12}(?:转型|转向|选择).{0,14}(?:AI|产品)/i;
const careerTransitionActionPattern = /(?:转型|转向|转(?!化)|改做|走到|进入|从.{0,12}(?:到|选择)|不继续.{0,12}(?:而)?(?:选择|做)|选择.{0,12}(?:AI|产品|而不是)|连续性|做了哪些准备)/i;
const pmMotivationPattern = /(?:为什么|为何).{0,8}(?!.{0,6}(?:适合|胜任|契合))(?:想|要|决定|选择)?(?:做|从事|当|走|求职|投递)\s*(?:AI\s*产品(?:经理)?|产品经理|产品(?:岗位|工作|方向))|(?:求职动机|职业选择原因)/i;
const experienceValuePattern = /(?:(?:(?:应用)?统计学?|所学|你的|他的|候选人的|原)(?:这个)?专业(?:背景)?|专业背景|之前的?经历|过往经历|审计(?:经历|训练)?|财会(?:经历|背景)?|数据分析(?:能力|背景)?).{0,28}(?:对.{0,12})?(?:做|求职|支持|帮助|价值|作用|迁移|产品判断).{0,16}(?:AI\s*产品|产品|决策|能力)?|(?:AI\s*产品|产品决策).{0,18}(?:帮助|价值|作用|支持|迁移)/i;

export function hasCareerTransitionSignature(question: string) {
  if (pmMotivationPattern.test(question)) return true;
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
  const contextualRole = question.match(/(?:和|与|应聘|申请|面试|目标是?|针对)\s*([^，。！？?]{2,24}?(?:产品经理|PM|工程师|设计师|运营|分析师|岗位))(?=这个岗|该岗|岗位|职位|有什么|有哪些|的匹配|匹配|契合|适合|胜任|可迁移)/i)?.[1];
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
  if (/短板|不足|缺点|弱点|限制|能力缺口/i.test(question) || facet === "boundary") return "limitation";
  if (/结果|量化(?:结果|效果)|效果数据|用户规模|增长|留存|上线|生产状态|完成(?:了吗|情况)/i.test(question) || facet === "result") return "result";
  if (/代表项目|最能代表|最有价值的项目/i.test(question)) return "representative_project";
  if (/自我介绍|介绍一下自己|60\s*秒/i.test(question)) return "introduction";
  if (/(?:项目|系统|工具|助手|工作台|Skill).{0,10}(?:能做什么|做什么|有什么功能|如何工作|如何设计)/i.test(question)) return "project_overview";
  if (hasExperienceValueSignature(question)) return "experience_value";
  if (/技术能力|技术栈|会什么|数据分析|(?:AI\s*)?评测|如何评估|有哪些实践/i.test(question) || facet === "evaluation") return "skills";
  if (/企业级?\s*AI|企业\s*AI|企业场景|业务问题.{0,8}(?:转化|转成|变成).{0,8}(?:AI|产品)|(?:AI|产品)方案|项目经历.{0,12}(?:价值|帮助|迁移)|(?:从)?(?:财会|会计|财务|审计|统计).{0,14}(?:积累|迁移|帮助|带来|形成).{0,12}(?:产品|能力|需求|决策)/i.test(question)) return "experience_value";
  if (facet === "contribution") return "contribution";
  if ((facet === "fit" && topic === "role_fit") || topic === "role_fit") return "role_fit";
  if (facet === "example" || (facet === "transfer" && ["audit", "statistics", "profile"].includes(topic))) return "experience_value";
  if (["didi", "rag", "deepflow", "ask_me", "local_tools", "agent"].includes(topic)) return "project_overview";
  return "general";
}

function questionModeFor(question: string, intent: AnswerIntent): QuestionMode {
  if (["agent_identity", "capability_scope", "privacy"].includes(intent)) return "agent_meta";
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
  activeProject: z.enum(["didi-internship", "didi-rental-audit", "didi-diva", "didi-flight-skill", "baidu-ai-coding-evaluation", "rag-knowledge-base", "deepflow", "ask-me", "local-first-tools", "audit-tools"]).optional(),
  useHistory: z.boolean(),
  confidence: z.number().min(0).max(1),
});

type ContractInput = {
  id: string;
  question: string;
  aliases?: string[];
  topic: QuestionTopic;
  facet: QuestionFacet;
  activeProject?: string;
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
      activeProject: input.activeProject ?? ({ didi: "didi-internship", baidu: "baidu-ai-coding-evaluation", rag: "rag-knowledge-base", deepflow: "deepflow", ask_me: "ask-me", local_tools: "local-first-tools", audit: "audit-tools" } as Partial<Record<QuestionTopic, string>>)[input.topic],
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
    id: "intro", question: "60 秒了解张倬玮。", aliases: ["请用 60 秒介绍张倬玮。", "请介绍一下你自己。", "介绍一下你自己", "自我介绍一下", "做个自我介绍", "请做一下自我介绍"], topic: "profile", facet: "overview",
    dimensions: ["候选人定位", "真实 AI 产品实习", "项目能力主线"], knowledge: ["K1", "K40", "K22", "K27", "K37", "K2"], stories: ["ST11"], shape: "narrative", length: { min: 430, max: 600 },
    goal: "让面试官快速形成是否值得继续沟通的候选人判断。", thesis: "我是张倬玮，一名把数据评测、企业业务理解和 AI 工作流落地结合起来的应用统计学学生。",
    required: ["应用统计学与审计基础", "百川百度与滴滴 AI 产品实习", "人机规则边界与产品落地"], direct: ["张倬玮", "百川", "百度", "滴滴", "AI 产品"],
    fallback: candidateNarrative.introductions.seconds60,
    next: ["didi_internship", "baidu_internship", "representative_project"],
  }),
  define({
    id: "role_fit", question: "你为什么适合 AI 产品经理岗位？", aliases: ["他为什么适合 AI 产品经理岗位？", "你能为 AI 产品团队带来什么价值？", "他能为 AI 产品团队带来什么价值？", "你为什么适合这个岗位？", "为什么录用你？", "为什么选择你？", "你做 AI 产品经理的优势是什么？"], topic: "role_fit", facet: "fit",
    dimensions: ["岗位匹配", "真实 AI 产品实践", "自主产品验证", "入职价值"], knowledge: ["K2", "K40", "K22", "K27", "K12", "K5", "K37"], stories: ["ST11", "ST12"], shape: "fit_mapping", length: { min: 360, max: 540 },
    goal: "说明候选人与初级 AI 产品岗位的具体匹配关系。", thesis: "我适合 AI 产品岗位，核心不是会使用模型，而是能把真实工作流、质量验证和工程落地连起来。",
    required: ["模型评测与归因", "企业流程与人机规则边界", "Ask Me 与 DeepFlow 自主验证", "产品工程推进能力"], direct: ["适合", "评测", "业务", "落地"],
    fallback: "我适合 AI 产品经理岗位，核心不是单纯会使用模型，而是已经形成了从业务理解、工作流拆解到质量验证和快速落地的完整能力链。\n\n**真实业务闭环**：百川医疗 RAG 中我参与检索问答与三轮 30 次 QA 评测；百度实习中参与六类 AI Coding 任务、七维 Gate 与 36 次 Pilot；在滴滴 ABC 智能一组，我从 0 到 1 推进租车准入预审、DiVA 营销素材和机票比价 Skill，将单户预审由约 120 分钟降至 30 分钟。\n\n**数据与风险边界**：应用统计学让我重视样本、指标和对照；德勤 IT 审计与滴滴风控实践让我理解证据链，分清模型、确定性规则与人工把关各自的边界。\n\n**自主产品验证**：Ask Me 验证可信回答与风险分级，DeepFlow 验证多 Agent、私域 RAG 和过程追踪，帮助我在业务、模型和工程之间建立共同语言。",
    next: ["didi_internship", "representative_project", "baidu_internship"],
  }),
  define({
    id: "baichuan_internship", question: "请介绍一下你的百川智能实习。", aliases: ["你在百川智能实习期间主要做了什么？", "百川智能实习做了什么？", "百川实习做了什么？", "聊聊你在百川的实习", "说说百川智能的实习", "请介绍你的医疗 RAG 实习。"], topic: "rag", facet: "overview",
    dimensions: ["实习顺序", "业务问题", "个人工作", "评测结果与边界"], knowledge: ["K27", "K4", "K28", "K31", "K35", "K36"], stories: ["ST10", "ST1"], shape: "narrative", length: { min: 360, max: 540 }, forbidden: ["deepflow", "local_tools"],
    goal: "让面试官快速确认百川实习的日期、业务问题、个人工作和事实边界。", thesis: "2026 年 4 月到 6 月，我在百川智能参与 AI 产品经理实习，主要项目是企业级医疗 RAG 知识库问答系统。",
    required: ["2026 年 4 月到 6 月", "医疗 RAG 业务问题", "需求产品评测三类工作", "脱敏 Demo 边界"], direct: ["百川智能", "医疗 RAG", "实习"],
    fallback: "2026 年 4 月到 6 月，我在百川智能参与 AI 产品经理实习，主要项目是**企业级医疗 RAG 知识库问答系统**。它面向医院、卫健委等医疗场景，把分散、敏感且持续更新的私有文档转成可检索、可问答、可核验的信息服务，但不替代医生诊断。\n\n我的工作主要有三部分：参与需求调研，梳理知识库管理、模型幻觉与答案溯源；参与整体架构和功能设计，与算法、研发推进文档解析、知识库、Dense Retrieval、Rerank、来源片段、短期记忆和多助手配置；参与 QA、四维 LLM-as-Judge 和 Bad Case 回流。\n\n项目完成三轮、累计 30 次 QA 执行，并发现多跳问题明显弱于单跳。公开 RAG 项目是**脱敏重构**，不是百川生产代码；面向客户类型不等于我完成了客户交付，小样本结果也不是线上或客户验收。",
    next: ["project_contribution", "rag_architecture", "evaluation"],
  }),
  define({
    id: "baidu_internship", question: "请介绍一下你的百度 AI 产品经理实习。", aliases: ["你在百度实习期间主要做了什么？", "请用 90 秒介绍这段百度实习。", "你的百度实习经历是什么？", "百度实习做了什么？", "聊聊你在百度的实习", "说说百度的实习"], topic: "baidu", facet: "overview",
    dimensions: ["工作主线", "重点项目", "结果边界"], knowledge: ["K22", "K23", "K24", "K25", "K26", "K32", "K33", "K34"], stories: ["ST9"], shape: "narrative", length: { min: 360, max: 540 },
    goal: "让面试官快速确认百度实习的真实性、工作主线与项目深度。", thesis: "我在百度实习的工作主线是模型与 AI Coding 产品评测，重点参与 WebDev E2E Bench 和多模型 Pilot。",
    required: ["模型评测与 Bad Case 归因", "六类任务七维指标与 Gate", "36 次 Pilot 与结论边界"], direct: ["百度", "评测", "Pilot"],
    fallback: "2026 年 6 月到 8 月，我在百度参与 AI 产品经理实习，核心工作是把**模型评测**与 Bad Case 归因从“得到一个分数”推进到“能支持产品选型和迭代判断”。\n\n我先参与调研 13 项 Coding Benchmark，再参与设计 WebDev E2E Bench，用六类任务覆盖页面生成、功能实现、组件、重设计、轻全栈和 Bugfix+UX，并以七维指标与 Gate 同时保护工程可用性和用户体验。随后参与把确定性工作流、Agent 判断和人工校准组合成 **Evaluator Agent**。\n\n**正式 Pilot**覆盖 6 个模型、6 类任务和 36 次运行，并完成 18 份盲评。我的工作不止是记录总分，而是把结果拆成场景优势、共同弱项、根因证据和下一步动作。边界是这些结论只适用于本次冻结版本和任务集，不是行业权威排名或生产平台成果。",
    next: ["baidu_contribution", "baidu_project", "baidu_metrics"],
  }),
  define({
    id: "representative_project", question: "哪个项目最能代表你的 AI 产品能力？", aliases: ["哪个项目最能代表他的 AI 产品能力？", "哪个公开项目最能代表你的 AI 产品能力？", "哪个公开项目最能代表他的 AI 产品能力？", "你最满意的一个项目是什么？", "代表项目是什么？"], topic: "rag", facet: "overview",
    dimensions: ["项目问题", "产品判断", "验证边界"], knowledge: ["K4", "K28", "K29", "K31", "K35", "K36"], stories: ["ST10", "ST1"], shape: "project_arc", length: { min: 390, max: 540 }, forbidden: ["baidu", "deepflow", "local_tools", "audit"],
    goal: "用 RAG 项目证明候选人的问题定义、方案取舍、评测设计与工程落地能力。", thesis: "最能代表我 AI 产品能力的是 RAG Knowledge Base System。",
    required: ["医疗私有文档可信问答", "四层架构和评测闭环", "公开脱敏与未完成边界"], direct: ["RAG", "百川", "Rerank", "评测"],
    fallback: "最能代表我 AI 产品能力的是百川智能实习中的 RAG Knowledge Base System。它面向**医疗私有文档可信问答**，帮助使用者从指南、共识和论文等资料中获得有来源、可核验的答案，同时只辅助资料查阅，不替代诊断。\n\n我参与把产品拆成文档处理、知识库管理、检索问答和评测四层，并把 P0 收敛为知识入库、问答、来源返回和失败状态。公开脱敏项目先建立**质量基线**，再通过控制变量验证 Dense Retrieval、Rerank、来源片段与基础引用溯源，并用四维自动评测让 Bad Case 回流到召回、排序或生成环节。\n\n我的工作覆盖需求与 MVP 梳理、功能和配置边界、跨角色协作以及 QA 评测闭环。公开仓库不是百川生产代码；BM25 混合检索、长期记忆、完整 Agent、版本对比和生产级 RBAC 尚未完整落地，也没有可公开的真实客户效果。这个项目体现了我把高风险行业需求转成**可运行、可核验、可迭代**产品闭环的能力。",
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
    fallback: "Evaluator Agent 的目标，是把 Task Spec、候选项目、运行配置和 Rubric 转成一条**评测执行链路**。链路按 **11 个阶段**完成环境准备、执行、证据采集、检查、Judge 评价和报告输出；六类任务覆盖页面、功能、组件、重设计、轻全栈和 Bugfix+UX，七维指标与 Gate 同时保护核心可用性和产品体验。\n\n构建、HTTP、DOM、浏览器操作、日志和 axe-core 等硬事实由确定性工具检查；视觉、交互和产品完成度由双 Judge 按 Rubric 评价，并保留截图和交互证据；**人工校准**结合 Gold、缺陷注入、重复检查和盲评。\n\n正式 Pilot 覆盖 6 个模型、6 类任务和 36 次运行，完成 18 份盲评，并输出分项证据、场景差异、共同风险和优化建议。它已经从 MVP 推进到受控 Pilot，但不是生产平台，也不是行业权威排行榜。",
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
    fallback: "我会把可信度拆成三层。**硬检查校准**中，6/6 个 Gold 样例通过，10/10 个确定性缺陷被检出，重复自动检查一致性为 100%；主观缺陷方向敏感度是 5/6，漏掉了较弱的信息层级问题。\n\n**人工样本边界**也必须说明：Auto-Judge Spearman 为 0.6191，Judge-Human 为 0.4599。我把它解释为初步判别力，而不是“已经和人一样可靠”，因为目前还没有规模足够、分布均衡的**人工黄金集**；现有人工评分只有 18 份、由一人完成且抽样不均，也需要继续观察误报和漏报。\n\n因此，硬事实优先用确定性工具，开放体验保留证据，冲突和低置信度结果转人工，同时继续扩充均衡 Gold 和回归集。评测器可以支持当前 Pilot，但尚未能替代人。",
    next: ["baidu_metrics", "baidu_badcase", "baidu_project"],
  }),
  define({
    id: "project_contribution", question: "你在 RAG 项目中负责哪些核心工作？", aliases: ["你在代表项目中负责哪些核心工作？", "他在代表项目中负责哪些核心工作？", "你在 RAG 项目中的个人贡献是什么？", "你的核心贡献是什么？", "他在 RAG 项目中负责什么？", "这个项目中你本人做了什么？", "你在这个项目中最关键的产品取舍是什么？", "最难的产品取舍是什么？"], topic: "rag", facet: "contribution",
    dimensions: ["本人判断", "核心行动", "验收责任"], knowledge: ["K27", "K28", "K29", "K31"], stories: ["ST10", "ST1"], shape: "contribution", length: { min: 330, max: 520 }, forbidden: ["deepflow", "local_tools", "audit"],
    goal: "清楚区分候选人判断与 AI 工具协作。", thesis: "我在 RAG 项目中负责的核心不是堆功能，而是决定做什么、为什么这样取舍以及如何验收。",
    required: ["产品定位", "检索和评测取舍", "整体推进与验收"], direct: ["贡献", "负责", "取舍", "验收"],
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
    dimensions: ["流程与证据", "真实 AI 产品闭环", "Agent 产品验证", "能力迁移"], knowledge: ["K1", "K8", "K27", "K19", "K40", "K22", "K12", "K5", "K37", "K39"], stories: ["ST11", "ST12", "ST10", "ST9"], length: { min: 400, max: 600 },
    goal: "以最新简历为主线，说明德勤、百川、百度、滴滴和独立项目如何形成连续的 AI 产品能力。", thesis: "我的实习和项目不是横向堆叠，而是在同一条能力主线上逐步深入。",
    required: ["德勤流程证据意识", "百川百度与滴滴真实 AI 产品闭环", "Ask Me 与 DeepFlow 验证", "统一方法"], direct: ["串联", "百川", "百度", "滴滴", "Ask Me", "DeepFlow"],
    fallback: "我的实习和项目可以这样**串联**：先拆透真实业务流程，再分清人机规则边界，最后用评测和坏案例推动迭代。\n\n**真实 AI 闭环**：应用统计学和德勤 IT 审计让我建立样本、指标、流程与证据链意识，启发了日志抽查与资料归档工具；百川医疗 RAG 把这种意识迁移到知识库、检索、来源和四维评测；百度将质量判断推进到六类任务、七维 Gate、多模型 Pilot 和协议归因；滴滴 ABC 智能一组又让我面向租车准入预审、DiVA 营销素材和机票比价 Skill 从 0 到 1 验证模型、程序规则与人工把关边界。\n\n**Agent 项目验证**：Ask Me 将可信回答和风险分级用于招聘决策，DeepFlow 将多 Agent、私域 RAG、引用与 Trace 用于复杂研究；Resume Autofill AI、个人知识库、HarnessLab、Read-Later Regret 和 Downloads Butler 则快速验证高频痛点。名称不同，底层方法一致：拆透流程、快速验证、评测归因与持续迭代。",
    next: ["didi_internship", "baidu_internship", "baichuan_internship"],
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
    id: "differentiation", question: "你最值得面试官关注的三项优势是什么？", aliases: ["他最值得面试官关注的三项优势是什么？", "你的优势是什么？", "你的核心优势是什么？", "你最大的优势是什么？", "你有什么优势？"], topic: "role_fit", facet: "fit",
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
    fallback: "当前检索链路是先用 **Dense Retrieval** 扩大候选，再通过 **Rerank 精排**，将前排证据片段交给模型生成答案并返回来源片段，形成基础的**引用溯源**。产品侧重点是用固定问题集同时检查证据召回、前排精度、最终回答、延迟和成本，并把失败样本区分为召回遗漏、排序错误或生成偏离。\n\nBM25 对药名、缩写和编号等精确词有价值，但当前还没有完整落地为混合检索，需要与现有基线做单变量对照后再决定融合方式。\n\n来源方面，当前能确认的是片段和元数据返回；PDF 页码高亮与一键定位原文仍是进一步完善方向。四维评测用于发现趋势，但 Judge 不是绝对真值，仍需固定配置和人工校准。",
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
    next: ["internship_transfer", "audit_value", "role_fit"],
  }),
  define({
    id: "didi_internship", question: "请介绍一下你在滴滴的 AI 产品经理实习。",
    aliases: ["介绍一下你在滴滴的实习。", "你在滴滴实习期间主要做了什么？", "整体介绍一下你在滴滴这段实习。", "你的滴滴实习经历是什么？", "你在滴滴 ABC 智能一组做了什么？", "滴滴实习做了什么？", "聊聊你在滴滴的实习", "说说滴滴的实习", "你在滴滴做了哪些项目？"],
    topic: "didi", facet: "overview", activeProject: "didi-internship",
    dimensions: ["实习角色与业务承接", "三个 0—1 项目闭环", "人机规则边界方法论"],
    knowledge: ["K40", "K41", "K44", "K46"], stories: ["ST12", "ST14"], shape: "narrative", length: { min: 420, max: 600 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "让面试官快速把握滴滴 ABC 智能一组实习的角色定位、风控/营销/比价三个核心项目结果及工作方法。",
    thesis: "2026 年 9 月至今，我在滴滴 ABC 智能一组担任 AI 产品经理实习生，从 0 到 1 推进了风控准入、营销素材与机票比价三个业务提效项目。",
    required: ["租车商家准入 AI 预审工作台与 120 分钟降至 30 分钟", "DiVA 营销素材工作台与机酒国庆 11 个点位", "机票竞品比价 Skill 与近 2500 条任务", "分清模型确定性程序和人工边界"],
    direct: ["滴滴", "ABC 智能一组", "三个"],
    fallback: "2026 年 9 月至今，我在滴滴 ABC 智能一组担任 AI 产品经理实习生，核心工作是承接公司内部不同业务线的真实提效诉求，把大模型与自动化能力落进日常工作流，从 0 到 1 推进了三个代表项目。\n\n第一个是投入最深的**租车风控预审工作台**。我梳理业务、财务、法务三方审核 SOP 与十类准入材料，搭建“材料建档—AI 解析—规则核验—三方审核”流程，并通过四家 OCR 盲测与原件定位解决脏乱原件及假冲突；目前完成 100 多笔商家申请试点预审，单户人工预审时间从约 120 分钟降到 30 分钟，累计省下 150 多小时。\n\n第二个是面向营销运营的**DiVA营销素材台**。我采用“模板约束 + AI 局部生成 + 人工审核”搭建四步适配流，落地机酒国庆活动覆盖 11 个验收广告位、交付 60 多份采用素材，单批耗时从 2 小时降至 40 分钟，首次验收通过率达 80%。\n\n第三个是**机票竞品比价Skill**，把跨平台查价、同航班匹配与分层报告封装为可恢复工具，累计执行近 2,500 条航线任务、抓取超 10 万条数据。三段实践让我沉淀出清晰判断：先把工作流拆透，分清模型、确定性程序和人工各自的边界，才能稳定产出业务价值。",
    next: ["didi_rental_overview", "didi_diva_overview", "didi_flight_skill"],
  }),
  define({
    id: "didi_rental_overview", question: "租车商家准入 AI 预审工作台具体做了什么？",
    aliases: ["请介绍一下你的租车商家准入 AI 预审工作台项目。", "滴滴的租车风控预审工作台做了什么？", "租车准入预审工作台解决了什么问题？", "为什么租车风控工作台一期不做全自动审批放行？", "介绍一下租车风控项目", "讲讲滴滴的租车项目", "租车预审工作台是怎么做的？"],
    topic: "didi", facet: "overview", activeProject: "didi-rental-audit",
    dimensions: ["业务痛点与一期取舍", "三方 SOP 与人机规则四步协同", "试点预审结果"],
    knowledge: ["K41", "K42", "K43"], stories: ["ST12", "ST13"], shape: "project_arc", length: { min: 380, max: 560 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "讲清租车商家准入工作台的业务场景、为什么不做黑盒自动放行的一期取舍、四步协同设计与试点成效。",
    thesis: "租车商家准入 AI 预审工作台面向业务、财务、法务三方审核十类材料的痛点，用人机规则分层把单户人工预审由约 120 分钟压到 30 分钟。",
    required: ["十类准入材料与不做黑盒终审的风险取舍", "材料建档 AI 解析规则核验三方审核", "100 多笔试点单户 120 分钟降至 30 分钟"],
    direct: ["租车", "预审工作台", "十类材料", "120 分钟"],
    fallback: "租车商家准入 AI 预审工作台是我在滴滴投入最深的 0—1 项目。平台给下游商家放车前，业务、财务、法务需兼职审营业执照、征信、近一年流水、近两年财报、场地合同、资产明细等十类材料，单户多达几十上百份，纯人工翻查算账平均要花约 120 分钟。\n\n业务最初想做全自动授信打分放行，但我深聊并翻完真实材料后收敛为一期**辅助预审闭环**：一方面团队已有可用额度测算表，真瓶颈在跨文件检索核验；另一方面单批放车动辄上百万，黑盒漏放高风险商家的代价远大于人力节省。\n\n我拉通三方梳理检查项与责任边界，搭建**人机规则四步流**（材料建档—AI 解析—规则核验—三方审核）：模型与 OCR 负责从复杂扫描件和合同里提关键字段与印章风险；程序规则负责银行 PDF 与 Excel 逐笔对账、月均流水、三表勾稽和硬门槛计算；人工聚焦异常复核与终审拍板，并配齐原目录兼容、分角色视图和问题清单导出。\n\n一期已在内部投入使用，完成 100 多笔商家申请试点预审，单户人工**预审压至30分钟**（减少约 75%，累计省下 150 多小时），在不降风控标准的前提下释放了审核人效。",
    next: ["didi_rental_challenge", "didi_rental_model", "didi_diva_overview"],
  }),
  define({
    id: "didi_rental_challenge", question: "租车准入预审工作台遇到的最大挑战是什么？",
    aliases: ["租车商家准入预审工作台最大的难点是什么？", "讲一个滴滴风控工作台踩坑复盘的案例。", "你是怎么解决风控原件识别不准和 15 处假冲突的？", "风控工作台为什么拆开 OCR 看图和大模型理解？", "滴滴实习遇到的最大挑战是什么？", "15 处假冲突是怎么解决的？"],
    topic: "didi", facet: "example", activeProject: "didi-rental-audit",
    dimensions: ["局部重读踩坑与 15 处假冲突", "40 份难例 OCR 盲测与提取规则重构", "118 份复测与 45 秒零假冲突验证"],
    knowledge: ["K42", "K41"], stories: ["ST12"], shape: "star", length: { min: 400, max: 580 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "用一次真实的局部重读踩坑与三步重构证明候选人不迷信调 Prompt，能重划技术与业务边界。",
    thesis: "最大挑战是脏乱真实材料叠加局部截图重读反向造出 15 处假冲突，我通过拆开看图与理解、改提取粒度和原件定位彻底解决。",
    required: ["局部截图重读反向改错造出 15 处假冲突", "40 份难例四家 OCR 盲测与看图理解解耦", "71 行车单提取规则与 118 份复测 45 秒零假冲突"],
    direct: ["最大挑战", "脏乱", "假冲突"],
    fallback: "最大挑战是真实商户材料极度脏乱（歪拍双语执照、红章盖财报数字、手写租赁合同、71 行密集车辆表截断），而我第一轮用常规改 Prompt 加局部截图重读反而遭遇了**15处假冲突踩坑**：一家建档带括号简称的商户被系统字面比对误判 9 页财报抬头全错，触发十几次低清局部重读卡了近 5 分钟，甚至把原读对的公司名反向改成错字，业务根本没法信。\n\n我立刻停下打补丁，做了三步重构。第一是**拆开看图与理解**：挑出 40 份最难真实样本（人工核出 106 个核心字段）拉四家线上 OCR 盲测，选出红章压字与手写唯一 100% 准确且带坐标印章识别的方案——标准卡证直出，复杂财报合同先由 OCR 还原干净文本表格，再把纯文本喂给 DeepSeek 提取。第二是从业务需求改提取粒度：确认 71 行车单只需权属人、总台数、总估值与抽查明细，根治思考链共享上限截断。第三是收严补读触发（纳入执照法定名、禁模糊占位覆盖原值）并上线字段级页码图框一键定位原件。\n\n在 118 份重度复杂材料复测中实现 100% 识别通过、0 截断，原跑近 9 分钟出 15 处假冲突的案例压至**45秒零假冲突**，整案提速 3 至 11 倍且大模型输入 Token 省下一半以上。",
    next: ["didi_rental_model", "didi_rental_rules", "baidu_badcase"],
  }),
  define({
    id: "didi_rental_model", question: "租车风控工作台是怎么做模型选型和兜底设计的？",
    aliases: ["风控预审工作台的模型是怎么选的？", "为什么风控工作台主力选 DeepSeek Flash 并配按需备用？", "38 个脱敏审核对照题是怎么评测模型的？", "风控模型是怎么选的？"],
    topic: "didi", facet: "evaluation", activeProject: "didi-rental-audit",
    dimensions: ["38 题对照与错误放行风险观察", "DeepSeek Flash 主力与 GPT 按需备用", "数据口径边界"],
    knowledge: ["K43", "K42"], stories: ["ST13"], shape: "fit_mapping", length: { min: 380, max: 560 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "说明风控场景下如何围绕错误放行风险做多模型选型与低成本按需兜底。",
    thesis: "风控选型最关注不误放行风险，我通过 38 个脱敏审核对照题选定 DeepSeek Flash 为主力，并设计结构校验后的单次按需备用兜底。",
    required: ["38 个脱敏对照题对比三模型 114 个返回", "无误放行倾向选 DeepSeek Flash 主力", "先结构与规则校验再按需触发 GPT 系列备用"],
    direct: ["风控", "38", "模型"],
    fallback: "风控准入场景选模型，我最看重的不是平均跑分，而是“不能把存疑高风险项误判成直接通过”。我基于导师整理的 35 个审核项，又从真实商户材料补了 3 个高频核验项，搭起**38题脱敏对照**集，横向测试 Jev、StartLux、DeepSeek 共 114 个返回。\n\n结果显示三者参考一致数分别为 27/38、30/38 和 31/38，更重要的是 DeepSeek Flash 没有把存疑项误判放行的倾向且响应最快，因此定为主力模型。兜底上我没有无脑全量双调烧钱，而是设计**按需备用兜底**：主模型输出后先过结构校验、来源检查和规则复算，只有接口失败、格式损坏或关键字段缺失时才触发一次 GPT 系列备用；若备用仍缺失或结论冲突，直接标“待人工复核”。\n\n同时我坚持用规则与人审**守住风控边界**：征信多机构额度混比的 9 条冲突用主体与机构对齐规则解除，单户 575 笔银行流水逐笔对上后仍保留 234 笔入账由业务确认性质；我也严格区分 31/38 脱敏审核题一致数与原件 OCR 准确率。",
    next: ["didi_rental_rules", "didi_rental_challenge", "baidu_reliability"],
  }),
  define({
    id: "didi_rental_rules", question: "银行流水和征信核验中哪些交给规则、哪些留给人工？",
    aliases: ["征信报告的 9 条假冲突和 575 笔银行流水是怎么处理的？", "风控预审工作台如何划分模型、程序规则和人工边界？", "为什么 575 笔银行流水对上后还要留 234 笔人工确认？"],
    topic: "didi", facet: "method", activeProject: "didi-rental-audit",
    dimensions: ["征信主体机构对齐规则", "575 笔逐笔对账确定性规则", "234 笔经营入账人工判断"],
    knowledge: ["K43", "K41"], stories: ["ST13"], shape: "direct", length: { min: 320, max: 500 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "用征信 9 条冲突与 575/234 笔银行流水两个真实单户案例说明模型、确定性规则与人工判断的精确边界。",
    thesis: "我划分规则与人工的原则是：客观一致性核对与算账全部交给确定性程序，涉及业务实质定性的判断坚决留给人工。",
    required: ["主体机构字段来源对齐解除 9 条征信假冲突", "575 笔 PDF 与 Excel 逐笔对账归程序", "234 笔经营收入性质与月份分母归人工"],
    direct: ["规则", "人工", "征信", "流水"],
    fallback: "在租车风控工作台里，我划分程序规则与人工判断的核心原则是：客观一致性比对与算账全部交给规则，涉及业务实质定性的判断坚决留给人工，不让模型硬猜征信和流水。\n\n在征信核验上，初期系统把同一份征信报告里不同授信机构的额度混在一起比对，冒出 9 条读值冲突。我没有加调模型，而是补了**四元对齐解冲突**规则（主体—机构—字段—来源位置），必须四项同源才允许比对，零新增模型调用就消除了全部 9 条误报。\n\n在银行流水核验上，单家商户上传的 PDF 与 Excel 各有 575 笔记录，程序先做**575笔自动对账**确保原件未被删改；但其中 234 笔入账到底算不算真实租车经营收入、往来款剔不剔除、月均分母按几个月算，直接决定授信安全，因此保留**234笔人工定性**，系统只把候选明细和凭证高亮摆在审核员手边。",
    next: ["didi_rental_model", "didi_diva_overview", "audit_value"],
  }),
  define({
    id: "didi_diva_overview", question: "DiVA 营销素材工作台为什么采用模板约束加局部生成？",
    aliases: ["请介绍一下滴滴的 DiVA AI 营销素材生产工作台项目。", "DiVA 营销素材生产工作台具体做了什么？", "为什么 DiVA 不让 AI 直接生成整张成品海报？", "机酒国庆营销活动里 DiVA 取得了什么效果？", "介绍一下 DiVA 项目", "讲讲 DiVA 营销素材工作台"],
    topic: "didi", facet: "overview", activeProject: "didi-diva",
    dimensions: ["跨点位做图痛点", "模板约束加局部生成取舍", "四步适配工作流与国庆活动效果"],
    knowledge: ["K44", "K45"], stories: ["ST14"], shape: "project_arc", length: { min: 360, max: 540 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "解释 DiVA 为什么不做高错误成本的整图直出，以及如何通过模板约束和四步工作流在机酒国庆活动落地。",
    thesis: "DiVA 采用模板约束加 AI 局部生成加人工审核，核心是为了锁死品牌与优惠金额风险，同时释放多广告位延展效率。",
    required: ["模板锁定品牌安全区与优惠金额防投放事故", "主视觉生成元素复用多广告位适配校样导出", "国庆活动 11 个验收点位 60 多份素材 40 分钟 80%"],
    direct: ["DiVA", "营销素材", "模板", "局部生成"],
    fallback: "DiVA AI 营销素材生产工作台面向滴滴内部营销运营与设计协同场景。每次大促活动，运营都要把同一套主题延展到十几个不同尺寸的投放点位，反复向设计提单改尺寸、改文案、来回审校，排期长且占满设计重复工时。\n\n在方案取舍上，我没有采用看起来很酷但错误成本极高的“AI 一键直出整张成品海报”——因为一旦优惠金额写错、品牌 Logo 变形或关键元素压住安全区，线上投放就是事故。我最终定下**模板加局部生成**加人工审核的路线：确定性的多尺寸裁切与格式交给程序规则，模板死锁品牌规范、安全区与优惠金额，AI 只专注主视觉生成、元素延展和创意文案候选。\n\n围绕这套边界，我搭建了**多广告位适配流**（主视觉生成—元素复用—多广告位适配—校样导出），让运营一次确认主视觉后即可批量适配各点位并在校样页人工把关。该工作台落地机酒国庆营销活动，覆盖 11 个已验收广告位，累计交付 60 多份业务采用素材，单批素材交付时间从 2 小时缩短到 40 分钟，**首审通过率80%**。",
    next: ["didi_diva_feedback", "didi_flight_skill", "didi_rental_overview"],
  }),
  define({
    id: "didi_diva_feedback", question: "面对运营提的 37 条反馈，你是怎么判断需求并排优先级的？",
    aliases: ["DiVA 试用期 37 条运营反馈是怎么处理的？", "为什么 37 条业务反馈里驳回了 12 条？", "你是怎么从收需求变成判断需求的？", "37 条反馈是怎么处理的？"],
    topic: "didi", facet: "method", activeProject: "didi-diva",
    dimensions: ["拆开业务目标与建议做法", "三类根因分流与具体案例", "四维排期与沟通边界"],
    knowledge: ["K45", "K44"], stories: ["ST14"], shape: "star", length: { min: 380, max: 560 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "通过 37 条试用反馈的分流与 12 条沟通驳回案例展示候选人的需求判断力和跨角色沟通方法。",
    thesis: "面对试用期涌入的 37 条反馈，我先拆开业务目标与用户建议做法，按三类根因分流后再依据阻断度、频率、复用性和成本排期。",
    required: ["拆开业务目标与建议做法还原点位原稿", "操作认知交互体验与模型版式约束三类归因", "阻断度频率复用性成本排期且不把 12 条驳回叫假需求"],
    direct: ["37 条", "反馈", "判断需求"],
    fallback: "DiVA 试用阶段，业务陆陆续续提了 37 条反馈（最终推进完成 15 条、沟通驳回或替代 12 条）。如果照单全收，研发会被低复用定制拖垮，核心交付反而卡住。我借这次实战建立了一套从“收需求”转向“判断需求”的三步机制。\n\n第一步是**拆开目标与做法**，先还原具体投放点位、输入原稿和真实卡点，不直接按用户口头方案派单。第二步做**三类根因分流**：一是用户操作与认知问题，比如运营反映“没法调圆角”，实际功能已有只是入口深，我先引导路径跑通当期交付，再观察是否高频需提浅入口；二是产品交互体验问题；三是底层模型或版式硬约束，例如狭长横幅硬塞超长文案导致溢出，我没有承诺高成本且易失真的“任意长度自动缩排”，而是对齐主副标题字数上限与层级规则。\n\n第三步按**四维价值排期**——看是否阻断当期活动交付、出现频率、跨活动复用性和实现成本。沟通驳回那 12 条时，我会拿原输入对比验收规范，说清我们拒绝的是高风险或低 ROI 的实现方式，同时给出替代解法，而不是简单把业务诉求定性成“假需求”。",
    next: ["didi_diva_overview", "didi_flight_skill", "requirements"],
  }),
  define({
    id: "didi_flight_skill", question: "机票竞品比价 Skill 是如何设计的？",
    aliases: ["请介绍一下滴滴的机票竞品比价 Skill 项目。", "为什么机票竞品比价要做成三层 Skill 而不是普通脚本？", "机票比价 Skill 的同航班匹配和异常恢复怎么做？", "介绍一下机票比价项目", "讲讲机票比价 Skill"],
    topic: "didi", facet: "architecture", activeProject: "didi-flight-skill",
    dimensions: ["可比输入契约与待核查规则", "六步链路与入口主体引用三层架构", "57 分钟瓶颈剖析与检查点补跑"],
    knowledge: ["K46", "K47"], stories: ["ST15"], shape: "project_arc", length: { min: 400, max: 580 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "展示机票竞品比价 Skill 的数据可比契约、三层可维护架构、检查点恢复设计以及两阶段规模口径。",
    thesis: "机票竞品比价 Skill 先固定严格可比口径与待核查边界，再用入口—主体—引用三层架构和检查点局部补跑解决批处理脆弱性。",
    required: ["固定可比契约且唯一性不足标待人工复核不强配", "入口层主体层引用层与六步流程", "10 条航线 57 分钟复盘检查点补跑与 80 组及近 2500 条规模"],
    direct: ["机票", "比价 Skill", "口径"],
    fallback: "机票竞品比价 Skill 服务于机票供给与价格分析团队，目标是把手工跨平台查价、对航班和出报告变成稳定可复用的工具。设计之初我没有直接堆爬虫脚本，而是先做**固定可比口径**：锁死出发到达、日期、舱等、查询时点与来源契约，明确覆盖率、价差和低价率定义，并规定“唯一性不足标待人工复核不强配、没查到标待核查不断言无供给”，防止错配数据误导调价。\n\n流程上我拆成“输入校验去重—跨平台查询—同航班匹配—固定舱位取有效价—算参考价差与状态—分层输出报告”六步，并用**三层Skill架构**组织：入口层管触发条件与交付目标，主体层管业务规则、工具顺序与异常状态机，引用层放复杂字段映射与数据字典，避免上下文臃肿失控。\n\n针对跑批脆弱性，我设计了**检查点局部补跑**与人工接管：比如复盘一批 10 条航线约 57 分钟记录时，我发现手机准备与恢复占了约 42 分钟，于是改成单步失败只补未完成节点、遇登录验证码保留现场交人工接管。该项目简历基线完成 80 组航线分析、人工耗时降 75%；随业务扩展近期累计执行近 2,500 条航线任务、抓取超 10 万条原始记录，直接输出供给缺口与高价航班清单。",
    next: ["didi_metrics_boundary", "didi_rental_overview", "deepflow_thinking"],
  }),
  define({
    id: "didi_metrics_boundary", question: "滴滴三个实习项目的数据口径和结论边界分别是什么？",
    aliases: ["滴滴实习项目的数字口径有哪些需要注意的边界？", "机票比价的 10 万条数据和风控 31/38 分别代表什么口径？"],
    topic: "didi", facet: "boundary", activeProject: "didi-internship",
    dimensions: ["风控试点反馈与 31/38 边界", "DiVA 去重采用与 12 条驳回边界", "比价两阶段规模与原始抓取边界"],
    knowledge: ["K40", "K43", "K45", "K47"], stories: [], shape: "shortcoming", length: { min: 400, max: 590 },
    forbidden: ["rag", "deepflow", "local_tools", "audit"],
    goal: "清晰区分滴滴三项内部项目的实测口径、单样本验证与采集吞吐，避免任何夸大或概念偷换。",
    thesis: "对滴滴三个项目的数字，我严格区分业务试用反馈、脱敏对照集一致数、去重采用素材与原始抓取吞吐，绝不混用口径。",
    required: ["120 降至 30 分钟为预审试点反馈且 31/38 非 OCR 准确率", "DiVA 11 点位 60 多份按去重采用且 12 条驳回非假需求", "比价区分 80 组基线与近 2500 条及超 10 万条原始抓取"],
    direct: ["滴滴", "统计口径", "指标"],
    fallback: "对滴滴这三个内部项目的量化结果，我坚持按各自真实统计口径回答，不把阶段验证或采集吞吐混同为全量终态指标。\n\n**风控试点与盲测**：租车准入工作台“100 多笔试点、单户人工预审由约 120 分钟降至 30 分钟、累计省下 150 多小时”来自近期业务使用反馈，代表预审人效提升，不等同于坏账率下降；38 题选型里的 31/38 是整理后脱敏审核题参考一致数，不冒充原件 OCR 准确率；40 份样本盲测与 118 份材料 100% 通过属于项目内难例复测，9 条征信冲突与 575/234 笔流水则是单户样本深度验证。\n\n**DiVA去重采用账**：机酒国庆活动的“11 个已验收广告位、60 多份采用素材、单批耗时 2 小时降至 40 分钟、首次验收通过率 80%”按业务去重采用口径统计；模板约束对比整图直出是错误成本驱动的方案取舍而非线上随机 A/B；试用期 37 条反馈中的 12 条驳回包含替代路径与暂缓项，不简单贴“假需求”标签。\n\n**比价两阶段口径**：机票比价 Skill 简历基线为“80 组航线、人工耗时降 75%”，近期扩展吞吐为“累计近 2,500 条航线任务、超 10 万条原始抓取记录”；超 10 万条是原始抓取量而非有效可比航班对，试行价差用于定位待核查线索而非正式双端低价率。",
    next: ["didi_rental_challenge", "didi_diva_feedback", "baidu_reliability"],
  }),
  define({
    id: "why_pm", question: "你为什么想做 AI 产品经理？",
    aliases: ["你为什么做产品经理", "你为什么做产品经理？", "为什么做产品经理", "为什么做产品经理？", "你为什么想做产品经理", "你为什么想做产品经理？", "为什么想做产品经理？", "你为什么做 AI 产品经理", "你为什么做 AI 产品经理？", "为什么做 AI 产品经理？", "为什么想做 AI 产品？", "你为什么选择做产品经理？", "为什么选择做产品经理？", "你为什么选择做 AI 产品经理？", "你的求职动机是什么？", "为什么想走产品经理方向？"],
    topic: "profile", facet: "transfer",
    dimensions: ["从检查走向定义的起点", "百川百度滴滴实战验证", "产品价值与长期动机"],
    knowledge: ["K1", "K2", "K3", "K8", "K27", "K22", "K40", "K12"], stories: ["ST11", "ST12"], shape: "narrative", length: { min: 360, max: 540 },
    goal: "回答为什么选择做产品经理/AI 产品经理，展现有真实项目与实习支撑的演进路径。",
    thesis: "我选择做 AI 产品经理，是在统计学习、企业审计与三段 AI 实习中逐步确认：我最擅长把真实业务阻力、数据验证和模型能力拧成可用闭环。",
    required: ["应用统计学与德勤审计痛点起点", "百川百度滴滴三段实习实战闭环", "人机规则协同与独立产品验证"],
    direct: ["选择", "产品经理", "业务"],
    fallback: "我选择做 AI 产品经理，不是临时起意追热点，而是在统计学习、企业审计和几段 AI 实习里一步步确认：我最擅长也最享受把真实**业务阻力与模型能力**、数据验证拧成一条可用工作流。\n\n早期在东北大学学应用统计学、在德勤做 IT 审计时，我发现一线业务最耗人的往往不是高深决策，而是跨系统核对、脏乱资料提取和口径对齐；但我不想只停留在事后检查问题，更想往前一步定义工具去消掉这些摩擦，于是自己动手做出了审计日志抽查与资料归档原型。\n\n随后进入百川医疗 RAG、百度 AI Coding 多模型评测和滴滴 ABC 智能一组实习，我真正走通了从**拆透业务流程**到划清模型、确定性规则与人工边界的全过程——比如把租车单户预审从约 120 分钟压到 30 分钟，把 DiVA 单批素材交付从 2 小时压到 40 分钟，同时独立完成了 Ask Me 与 DeepFlow。这种用数据定位根因、把不确定模型变成业务真敢用的闭环的成就感，让我坚定了走**AI产品经理**方向。",
    next: ["didi_internship", "role_fit", "representative_project"],
  }),
  define({
    id: "internships_overview", question: "请介绍一下你的实习经历。",
    aliases: ["你有哪些实习经历？", "你有几段实习经历？", "你有几段实习？", "介绍一下你的实习经历", "你的实习经历有哪些？", "讲讲你的实习经历", "说说你的实习经历"],
    topic: "profile", facet: "overview",
    dimensions: ["审计流程底座", "百川 RAG 与百度评测", "滴滴三项 0—1 业务工作流"],
    knowledge: ["K1", "K8", "K27", "K22", "K40", "K41", "K44", "K46"], stories: ["ST11", "ST12"], shape: "narrative", length: { min: 380, max: 560 },
    goal: "清晰串讲四段实习的时间线、核心产出与能力递进，方便面试官继续深挖。",
    thesis: "我共有四段连续递进的实习经历，覆盖从企业审计流程到医疗 RAG、多模型评测与滴滴业务工作流 0—1 落地。",
    required: ["容诚与德勤审计流程底座", "百川医疗 RAG 与百度 36 次 Pilot", "滴滴风控准入 DiVA 与机票比价三项工作流"],
    direct: ["四段", "实习", "百川", "百度", "滴滴"],
    fallback: "我共有四段连续递进的实习经历，完整覆盖了从企业流程理解到 RAG、多模型评测和业务向 AI 工作流 0—1 落地的演进过程。\n\n第一段是 2025 年初在容诚及 2026 年 1 月至 4 月在德勤的审计与 IT 审计实习，参与 30 余份操作系统与 APP 底稿复核并用 Prompt 辅助数据脱敏，帮我打下了严密的**流程与证据链意识**。第二段是 2026 年 4 月至 6 月在百川智能担任 AI 产品实习生，围绕企业级医疗 RAG 知识库参与需求梳理、四层功能设计和三轮累计 30 次 QA 评测，定位出多跳问答弱项。\n\n第三段是 2026 年 6 月至 8 月在百度担任 AI 产品实习生，聚焦**多模型评测归因**，参与设计六类 Web 任务与七维 Gate，推进 6 个模型 36 次正式 Pilot 与 Qwen 协议级受控诊断。第四段是 2026 年 9 月至今在滴滴 ABC 智能一组担任 AI 产品实习生，从 0 到 1 推进**三项业务工作流**——租车商家准入预审工作台（单户人工预审由约 120 分钟降至 30 分钟）、DiVA 营销素材工作台（国庆 11 个点位首审通过率 80%）和机票竞品比价 Skill（累计近 2,500 条航线任务）。",
    next: ["didi_internship", "baidu_contribution", "baichuan_internship"],
  }),
  define({
    id: "candidate_shortcoming", question: "你的主要短板是什么？",
    aliases: ["他的主要短板是什么？", "你的缺点是什么？", "你的短板是什么？", "你有什么不足？", "你有什么缺点？", "你的优缺点是什么？", "你目前最大的不足是什么？"],
    topic: "profile", facet: "boundary",
    dimensions: ["长周期线上与商业化经验边界", "区分原型完成与产品成功", "进入业务团队后的补强计划"],
    knowledge: ["K2", "K12", "K40"], stories: [], shape: "shortcoming", length: { min: 320, max: 480 },
    goal: "诚实说明当前经验阶段边界并给出清晰可执行的成长路径。",
    thesis: "我目前最需要补强的，是把原型与内部试点阶段的产品判断延伸到更长周期的真实用户规模运营和商业化闭环中。",
    required: ["缺少长周期大规模商业化完整经历", "主动区分原型可用与产品长期成功", "通过真实业务指标与上线复盘补强"],
    direct: ["补强", "原型", "真实"],
    fallback: "我目前最需要补强的，是把原型与内部试点阶段的产品判断延伸到更长周期的真实用户运营、生产稳定性和商业结果闭环中。现阶段我已经能独立完成问题拆解、人机规则边界设计、原型推进和评测归因，但还缺少在长周期大流量业务里持续迭代留存与商业化的完整经历。\n\n**原型不等于产品成功**：如果只停留在原型或短期试点，容易高估功能完成度，却低估推广阻力、异常长尾和长期维护成本。因此我在滴滴、百度与百川的实践中都会主动区分“功能跑通”“业务敢用”和“长期商业价值”，绝不把阶段提效直接包装成终局成功。\n\n**用行为和结果验证**：进入正式业务团队后，我会主动扎进真实用户反馈、线上漏斗指标和跨职能上线复盘里补齐长周期运营经验；同时在入职初期就能贡献快速拆透复杂流程、搭建评测基线和用 Bad Case 驱动迭代的实战能力。",
    next: ["role_fit", "didi_metrics_boundary", "baidu_reliability"],
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
  profile: ["K1", "K2", "K3", "K8", "K27", "K22", "K40", "K37", "K39"],
  role_fit: ["K2", "K3", "K8", "K27", "K19", "K22", "K40", "K12", "K5", "K37"],
  didi: ["K40", "K41", "K42", "K43", "K44", "K45", "K46", "K47"],
  baidu: ["K22", "K23", "K24", "K25", "K26", "K32", "K33", "K34"],
  rag: ["K4", "K27", "K28", "K29", "K30", "K31", "K35", "K36"],
  deepflow: ["K5", "K16", "K18", "K19", "K20", "K21"],
  ask_me: ["K12", "K38"],
  local_tools: ["K6", "K39"],
  audit: ["K7", "K8", "K9", "K10"],
  statistics: ["K3", "K17", "K31"],
  skills: ["K3", "K4", "K29", "K31", "K5", "K21"],
  enterprise_ai: ["K8", "K41", "K28", "K29", "K21"],
  agent: ["K18", "K19", "K21"],
  unknown: [],
};

const topicPatterns: Array<[QuestionTopic, RegExp]> = [
  ["didi", /滴滴|\bdidi\b|abc\s*智能|租车.{0,8}(?:商家|准入|风控|预审)|风控预审|预审工作台|十类材料|假冲突|\bdiva\b|营销素材|多广告位|机酒国庆|37\s*条(?:运营|业务)?反馈|机票.{0,6}比价|竞品比价|比价\s*skill/i],
  ["baidu", /百度|\bbaidu\b|ai\s*coding|evaluator\s*agent|七维指标|硬门槛|dashboard\s*样例/i],
  ["rag", /百川智能|百川|医疗\s*rag|医疗知识助手|\brag\b|知识库|检索|引用/i],
  ["deepflow", /deepflow/i],
  ["agent", /agent|多智能体|多代理/i],
  ["local_tools", /thirty[-\s]?minute brain|read[-\s]?later regret|downloads butler|本地优先效率工具|信息债|下载文件夹/i],
  ["audit", /审计|德勤|容诚|日志核查|底稿|函证|盘点/i],
  ["statistics", /统计|指标|样本|数据分析|产品决策/i],
  ["enterprise_ai", /企业级?\s*ai|企业场景|业务问题.*(?:ai|产品)/i],
  ["role_fit", /岗位|(?:这个|该|目标)?岗(?:位)?|匹配|契合|适合|胜任|优势|团队价值/i],
  ["profile", /自我介绍|介绍一下|背景|经历组合|几段实习|哪些实习/i],
  ["skills", /技能|技术|评测|ai\s*编程|协作|sql|python|fastapi|ragas/i],
  ["ask_me", /ask\s*me|数字分身/i],
];

const facetPatterns: Array<[QuestionFacet, RegExp]> = [
  ["example", /举例|例子|案例/i], ["contribution", /贡献|负责|做了什么|核心工作|职责/i], ["collaboration", /协作|分工|交接|配合/i],
  ["evaluation", /评测|评估|指标|验收|效果|质量|错误|失败|检查|bad\s*case/i], ["transfer", /迁移|沉淀|帮助|支持/i], ["result", /结果|成果|完成|上线|规模/i],
  ["boundary", /短板|不足|缺点|限制|边界|风险/i], ["architecture", /架构|链路|技术方案/i], ["method", /方法|如何|怎么|思考|取舍/i],
  ["problem", /解决.*问题|什么问题|痛点/i], ["fit", /匹配|契合|适合|胜任|优势|价值|能力组合/i],
];

function inferDidiActiveProject(text: string): string | undefined {
  if (/租车|商家准入|风控预审|预审工作台|十类材料|假冲突|575\s*笔|38\s*个脱敏|31\/38/i.test(text)) return "didi-rental-audit";
  if (/\bdiva\b|营销素材|多广告位|机酒国庆|37\s*条/i.test(text)) return "didi-diva";
  if (/机票.{0,6}比价|竞品比价|比价\s*skill|航班匹配|2[,\s]?500\s*条|10\s*万条/i.test(text)) return "didi-flight-skill";
  if (/滴滴|\bdidi\b|abc\s*智能/i.test(text)) return "didi-internship";
  return undefined;
}

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
  const historyMatchPattern = /滴滴|\bdidi\b|abc\s*智能|租车|商家准入|风控预审|预审工作台|\bdiva\b|营销素材|机票.{0,6}比价|竞品比价|比价\s*skill|百度|baidu|ai\s*coding|evaluator\s*agent|百川智能|百川|医疗\s*rag|rag|deepflow|ask\s*me/i;
  const recentProjectMessage = [...history].reverse().find((message) => message.role === "user" && historyMatchPattern.test(message.content))?.content;
  const historyProject = recentProjectMessage?.match(historyMatchPattern)?.[0]?.toLowerCase();
  const inferredTopic = (topic === "unknown" || (reference && topic === "skills" && historyProject))
    ? (historyProject && /滴滴|didi|abc|租车|商家准入|风控预审|预审工作台|diva|营销素材|机票|比价/.test(historyProject) ? "didi" : historyProject && /rag|百川/.test(historyProject) ? "rag" : historyProject === "deepflow" ? "deepflow" : historyProject?.includes("ask") ? "ask_me" : historyProject ? "baidu" : topic)
    : topic;
  const didiSubproject = inferredTopic === "didi"
    ? inferDidiActiveProject(question) ?? (reference && recentProjectMessage ? inferDidiActiveProject(recentProjectMessage) : undefined) ?? "didi-internship"
    : undefined;
  const explicitTopic = inferredTopic !== "unknown";
  const hasMethodContext = /AI|产品|模型|滴滴|DiVA|风控|比价|RAG|DeepFlow|Agent|检索|评测|数据|用户|指标|需求|项目|功能|失败|复盘|取舍|协作|团队|岗位|工作|压力|冲突|学习|加班|职业|选择/i.test(question);
  const hasExplicitProjectOverviewAction = answerIntent === "project_overview"
    && /(?:项目|系统|工具|助手|工作台|Skill).{0,10}(?:能做什么|做什么|有什么功能|如何工作|如何设计)/i.test(question);
  const hasStrongLocalIntent = !["general", "project_overview", "challenge", "diagnosis"].includes(answerIntent)
    || hasExplicitProjectOverviewAction
    || (["challenge", "diagnosis"].includes(answerIntent) && hasMethodContext);
  const interviewReasoning = /(?:你怎么看|如何看待|你会如何|如果|假设|面对|遇到|为什么|为何|如何|怎么).{0,20}(?:岗位|工作|团队|压力|冲突|学习|加班|职业|选择|产品|AI|业务|协作|沟通|优先级)/i.test(question);
  const didiKnowledgeBySubproject: Record<string, string[]> = {
    "didi-rental-audit": ["K41", "K42", "K43"],
    "didi-diva": ["K44", "K45"],
    "didi-flight-skill": ["K46", "K47"],
    "didi-internship": topicKnowledge.didi,
  };
  return {
    topic: inferredTopic,
    facet,
    answerIntent,
    questionMode,
    evidencePolicy: evidencePolicyFor(answerIntent, questionMode),
    focusTerms: focusTermsFor(answerIntent, targetRole),
    targetRole,
    requestedDimensions: [facet === "overview" ? "直接回答当前问题" : `${facet}相关判断`, "具体实践", "验证或落地方式"],
    activeProject: inferredTopic === "didi" ? didiSubproject : inferredTopic === "baidu" ? "baidu-ai-coding-evaluation" : inferredTopic === "rag" ? "rag-knowledge-base" : inferredTopic === "deepflow" || inferredTopic === "agent" ? "deepflow" : inferredTopic === "ask_me" ? "ask-me" : undefined,
    useHistory: reference,
    confidence: ["career_transition", "role_fit"].includes(answerIntent) ? 0.92 : interviewReasoning ? 0.86 : hasStrongLocalIntent ? 0.88 : explicitTopic && facet !== "overview" ? 0.86 : explicitTopic ? 0.72 : facet !== "overview" ? 0.58 : 0.35,
    requiredKnowledgeIds: ["career_transition", "experience_value"].includes(answerIntent)
      ? ["K1", "K2", "K3", "K8", "K27", "K22", "K40", "K37"]
      : inferredTopic === "didi" && didiSubproject
        ? didiKnowledgeBySubproject[didiSubproject]
        : topicKnowledge[inferredTopic],
    allowedStoryIds: facet === "example"
      ? (inferredTopic === "didi"
          ? (didiSubproject === "didi-diva" ? ["ST14"] : didiSubproject === "didi-flight-skill" ? ["ST15"] : ["ST12", "ST13"])
          : inferredTopic === "baidu" ? ["ST9"] : inferredTopic === "audit" ? ["ST4", "ST6"] : inferredTopic === "rag" ? ["ST1"] : inferredTopic === "deepflow" || inferredTopic === "agent" ? ["ST2"] : [])
      : [],
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
  const resolvedActiveProject = planned.activeProject ?? local.activeProject ?? (topic === "didi" ? (inferDidiActiveProject(question) ?? "didi-internship") : topic === "baidu" ? "baidu-ai-coding-evaluation" : topic === "rag" ? "rag-knowledge-base" : topic === "deepflow" || topic === "agent" ? "deepflow" : undefined);
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
    activeProject: resolvedActiveProject,
    useHistory: planned.useHistory,
    confidence: planned.confidence,
    requiredKnowledgeIds: ["career_transition", "experience_value"].includes(answerIntent) ? ["K1", "K2", "K3", "K8", "K27", "K22", "K40", "K37"] : topicKnowledge[topic],
    allowedStoryIds: facet === "example" || facet === "transfer"
      ? (topic === "didi"
          ? (resolvedActiveProject === "didi-diva" ? ["ST14"] : resolvedActiveProject === "didi-flight-skill" ? ["ST15"] : ["ST12", "ST13"])
          : topic === "baidu" ? ["ST9"] : topic === "audit" ? ["ST4", "ST6"] : topic === "rag" ? ["ST1"] : topic === "deepflow" || topic === "agent" ? ["ST2"] : [])
      : [],
    forbiddenTopics: forbiddenFor(topic),
    targetLength: { min: facet === "overview" ? 220 : 280, max: 480 },
    responseShape: answerIntent === "career_transition" ? "narrative" : responseShapeFor(facet),
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
