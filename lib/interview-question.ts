import type {
  AnswerIntent,
  AnswerStrategy,
  FactRisk,
  InterviewQuestionFamily,
  QuestionMode,
} from "./types";

export const interviewQuestionFamilies = [
  "candidate_fact", "behavioral", "situational", "product_case", "business_case", "estimation",
  "motivation", "work_style", "career_logistics", "current_topic", "agent_meta", "unrelated",
] as const satisfies readonly InterviewQuestionFamily[];

export const factRisks = ["low", "supported_personal", "unsupported_personal", "freshness_sensitive"] as const satisfies readonly FactRisk[];
export const answerStrategies = ["evidence_answer", "reasoned_answer", "clarify_then_answer", "boundary_bridge", "decline"] as const satisfies readonly AnswerStrategy[];

const unsupportedPersonalPattern = /爱好|兴趣|足球队|球队|生日|星座|MBTI|婚姻|对象|家庭|父母|籍贯|住址|身份证|期望薪资|薪资要求|薪酬|到岗时间|什么时候到岗|入职时间|可实习多久|实习时长|千万|百万(?:营收|收入|付费用户|用户)|亿元?|营收|正式(?:研发)?团队|带领.{0,8}团队|带过.{0,8}人|独立训练|千亿参数|自动驾驶|支付牌照|融资(?:金额|轮次|经历|结果)/i;
const privateOrUnsafePattern = /家庭住址|身份证|联系方式|手机号|微信|邮箱|政治(?:立场|观点|倾向)|政党|投票|编造|虚构|假装.{0,8}(?:做过|负责|实现)|系统提示|prompt|API\s*Key|密钥|环境变量|内部底稿|客户名称/i;
const currentTopicPattern = /最新|最近|近期|今年|当下|当前.{0,16}(?:行业|公司|市场|动态|趋势|政策|监管)|新闻|热点|融资|财报|股价|发布会|政策变化|行业事件/i;
const estimationPattern = /估算|估一估|市场规模|市场有多大|一天有多少|大概多少|数量级|费米|Fermi|怎么算/i;
const productCasePattern = /设计一款|设计一个|产品设计|如何设计|如何改进|MVP|最小可行|功能优先级|需求优先级|用户需求|核心指标|产品方案|改进.{0,12}(?:产品|功能)|如果让你做.{0,16}(?:产品|功能)/i;
const businessCasePattern = /业务分析|商业模式|增长|留存|续费|收费|转化(?:率)?|漏斗|用户链路|获客|变现|定价|商业化|指标树|收入|GMV|ROI|业务目标/i;
const situationalPattern = /^(?:如果|假设|假如|当|面对|遇到)|你会如何|你会怎么|怎么办|如何处理|怎么处理/i;
const behavioralPattern = /讲一个|举个例子|举例|哪一次|有没有一次|有没有.{0,12}(?:经历|情况|冲突|失败|压力|困难)|曾经|过去.{0,12}(?:如何|怎么)|你是如何.{0,16}(?:协作|处理|解决|推动)|最失败|最困难|最有压力|发生过/i;
const workStylePattern = /工作风格|如何协作|团队协作|跨团队|技术同学.{0,8}沟通|冲突|压力|优先级|不确定性|学习能力|抗压|加班|反馈|沟通方式|失败|复盘|重要决策|管理.{0,6}时间|重复性工作|保证.{0,6}(?:细节|质量)|独立工作|团队合作|缺点|短板/i;
const logisticsPattern = /薪资|薪酬|到岗|入职|实习多久|实习时长|实习多长|工作地点|哪个城市工作|是否接受|意向城市|offer|求职流程|流程进度/i;
const motivationPattern = /为什么.{0,12}(?:选择|应聘|加入|做|想做|转|不继续|感兴趣)|职业规划|职业方向|未来.{0,12}(?:规划|方向|发展|成长)|公司动机|为什么是我们|为什么来|选择这家公司|长期发展|选择.{0,10}(?:实习|工作|机会).{0,10}(?:看重|考虑|标准)|下一阶段.{0,12}(?:补齐|提升|成长)|判断.{0,12}工作.{0,12}值得加入|希望.{0,12}实习.{0,12}(?:获得|学到)/i;
const interviewScopePattern = /候选人|面试|岗位|职位|工作|职业|公司|团队|产品|业务|用户|项目|实习|产出|经历|能力|AI|模型|数据|审计|统计|RAG|Agent|需求|方案|指标|协作|冲突|压力|学习|规划|优势|不足|薪资|到岗/i;

const intentFamilies: Partial<Record<AnswerIntent, InterviewQuestionFamily>> = {
  agent_identity: "agent_meta",
  capability_scope: "agent_meta",
  behavioral_experience: "behavioral",
  situational_judgment: "situational",
  product_design: "product_case",
  business_analysis: "business_case",
  estimation: "estimation",
  work_style: "work_style",
  career_planning: "motivation",
  company_motivation: "motivation",
  career_logistics: "career_logistics",
  industry_view: "current_topic",
  career_transition: "motivation",
  introduction: "candidate_fact",
  role_fit: "candidate_fact",
  representative_project: "candidate_fact",
  project_overview: "candidate_fact",
  project_problem: "candidate_fact",
  contribution: "candidate_fact",
  ai_collaboration: "candidate_fact",
  challenge: "behavioral",
  result: "candidate_fact",
  limitation: "candidate_fact",
  skills: "candidate_fact",
  experience: "candidate_fact",
  experience_value: "candidate_fact",
  education: "candidate_fact",
  credentials: "candidate_fact",
  hiring_recommendation: "candidate_fact",
};

export interface LocalInterviewClassification {
  questionFamily: InterviewQuestionFamily;
  factRisk: FactRisk;
  answerStrategy: AnswerStrategy;
  protectedDecision: boolean;
}

export function classifyInterviewQuestion(question: string, intent: AnswerIntent, mode: QuestionMode): LocalInterviewClassification {
  if (["agent_identity", "capability_scope"].includes(intent)) {
    return { questionFamily: "agent_meta", factRisk: "low", answerStrategy: "evidence_answer", protectedDecision: true };
  }
  if (privateOrUnsafePattern.test(question)) {
    return { questionFamily: "unrelated", factRisk: "unsupported_personal", answerStrategy: "decline", protectedDecision: true };
  }
  if (logisticsPattern.test(question)) {
    return { questionFamily: "career_logistics", factRisk: "unsupported_personal", answerStrategy: "boundary_bridge", protectedDecision: true };
  }
  if (unsupportedPersonalPattern.test(question) && !["career_planning", "company_motivation", "career_transition"].includes(intent)) {
    return { questionFamily: "candidate_fact", factRisk: "unsupported_personal", answerStrategy: "boundary_bridge", protectedDecision: true };
  }
  if (currentTopicPattern.test(question)) {
    return { questionFamily: "current_topic", factRisk: "freshness_sensitive", answerStrategy: "reasoned_answer", protectedDecision: true };
  }

  const intentFamily = intentFamilies[intent];
  const isHypothetical = /^(?:如果|假设|假如|当|面对|遇到)/.test(question);
  const explicitFamily: InterviewQuestionFamily | undefined = behavioralPattern.test(question) ? "behavioral"
    : estimationPattern.test(question) ? "estimation"
      : businessCasePattern.test(question) ? "business_case"
        : productCasePattern.test(question) ? "product_case"
          : motivationPattern.test(question) ? "motivation"
            : isHypothetical ? "situational"
              : workStylePattern.test(question) ? "work_style"
                : mode === "candidate_reasoning" && situationalPattern.test(question) ? "situational"
                  : undefined;
  const resolvedIntentFamily = intent === "challenge" && (isHypothetical || workStylePattern.test(question))
    ? undefined
    : intentFamily;
  const questionFamily = resolvedIntentFamily
    ?? explicitFamily
    ?? (interviewScopePattern.test(question) ? "candidate_fact" : "unrelated");
  const factRisk: FactRisk = mode === "candidate_fact" || questionFamily === "behavioral" ? "supported_personal" : "low";
  const answerStrategy: AnswerStrategy = questionFamily === "unrelated"
    ? "decline"
    : mode === "candidate_fact" || questionFamily === "behavioral"
      ? "evidence_answer"
      : "reasoned_answer";
  return {
    questionFamily,
    factRisk,
    answerStrategy,
    protectedDecision: questionFamily === "candidate_fact" && mode === "candidate_fact",
  };
}

export function shouldPlanWithModel(input: { hasContract: boolean; hasStableAnswer: boolean; classification: LocalInterviewClassification }) {
  if (input.hasContract || input.hasStableAnswer || input.classification.protectedDecision) return false;
  return !["agent_meta", "unrelated"].includes(input.classification.questionFamily);
}

export function defaultIntentForFamily(family: InterviewQuestionFamily): AnswerIntent {
  const mapping: Record<InterviewQuestionFamily, AnswerIntent> = {
    candidate_fact: "general",
    behavioral: "behavioral_experience",
    situational: "situational_judgment",
    product_case: "product_design",
    business_case: "business_analysis",
    estimation: "estimation",
    motivation: "career_planning",
    work_style: "work_style",
    career_logistics: "career_logistics",
    current_topic: "industry_view",
    agent_meta: "capability_scope",
    unrelated: "general",
  };
  return mapping[family];
}
