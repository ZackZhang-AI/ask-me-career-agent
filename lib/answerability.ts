import { interviewPersona } from "../content/interview-persona";
import type {
  AnswerDisposition,
  AnswerPlan,
  BoundaryReason,
  ChatMessage,
  KnowledgeItem,
  QuestionContract,
  QuestionFrame,
  ResponseStatus,
  StableAnswer,
} from "./types";

export interface AnswerabilityDecision {
  disposition: Exclude<AnswerDisposition, "service_unavailable">;
  boundaryReason: BoundaryReason;
  responseStatus: ResponseStatus;
  message?: string;
  shouldGenerate: boolean;
  capabilityIds: string[];
}

interface AnswerabilityInput {
  question: string;
  history: ChatMessage[];
  frame: QuestionFrame;
  plan: AnswerPlan;
  items: KnowledgeItem[];
  claimIds: string[];
  sourceIds: string[];
  stableAnswer?: StableAnswer;
  contract?: QuestionContract;
}

const ambiguousRolePattern = /(?:这个|该|上述|刚才的|前面提到的)(?:岗位|职位|岗)|这个岗/;
const ambiguousProjectPattern = /(?:这个|该|上述|刚才的|前面提到的)(?:项目|系统)|这个项目|该项目/;
const roleNamePattern = /[A-Za-z0-9\u4e00-\u9fa5]{2,24}(?:产品经理|岗位|职位|PM)/i;
const projectNamePattern = /百度|AI\s*Coding|Evaluator\s*Agent|RAG|DeepFlow|Ask\s*Me|Thirty-Minute Brain|审计/i;
const unsupportedPersonalFactPattern = /千万|百万(?:营收|收入|(?:付费)?用户)|亿元?|营收|正式(?:研发)?团队|带领.{0,8}团队|带过.{0,8}人|独立训练|千亿参数|自动驾驶|支付牌照|政治人物/;

function historyContains(history: ChatMessage[], pattern: RegExp) {
  return history.slice(-8).some((message) => message.role === "user" && pattern.test(message.content));
}

export function unresolvedReferenceReason(input: Pick<AnswerabilityInput, "question" | "history" | "frame" | "contract">) {
  if (
    ambiguousRolePattern.test(input.question)
    && !input.frame.targetRole
    && !historyContains(input.history, roleNamePattern)
    && !input.contract
  ) return "ambiguous_role" as const;

  if (
    ambiguousProjectPattern.test(input.question)
    && !input.frame.activeProject
    && !historyContains(input.history, projectNamePattern)
    && !input.contract
  ) return "ambiguous_project" as const;

  return undefined;
}

function matchedCapabilities(question: string, frame: QuestionFrame) {
  return interviewPersona.supportedCapabilities.filter((capability) =>
    capability.topics.some((topic) => topic === frame.topic)
    || capability.terms.some((term) => question.toLowerCase().includes(term.toLowerCase())),
  );
}

function clarify(reason: "ambiguous_role" | "ambiguous_project", capabilityIds: string[]): AnswerabilityDecision {
  return {
    disposition: "clarify",
    boundaryReason: reason,
    responseStatus: "needs_clarification",
    shouldGenerate: false,
    capabilityIds,
    message: reason === "ambiguous_role"
      ? "为了避免泛泛而谈，您能补充一下具体岗位名称，或者 JD 中最关注的职责吗？"
      : "为了准确回答，您指的是 AI Coding Evaluator、RAG Knowledge Base、DeepFlow，还是 Ask Me 项目？",
  };
}

function decline(reason: "missing_personal_evidence" | "outside_supported_scope", capabilityIds: string[]): AnswerabilityDecision {
  return {
    disposition: "decline",
    boundaryReason: reason,
    responseStatus: "insufficient_evidence",
    shouldGenerate: false,
    capabilityIds,
    message: reason === "missing_personal_evidence"
      ? "这部分我没有可以准确说明的真实经历，我不希望用推测替代事实。如果您希望评估相近能力，我可以结合已经公开的项目和实践继续回答。"
      : "这个问题超出了我目前能够可靠说明的能力范围，我不想用通用答案代替真实判断。您可以继续了解我的 AI 产品、模型评测、数据分析或企业流程实践。",
  };
}

export function decideAnswerability(input: AnswerabilityInput): AnswerabilityDecision {
  const capabilities = matchedCapabilities(input.question, input.frame);
  const capabilityIds = capabilities.map((capability) => capability.id);

  const unresolvedReason = unresolvedReferenceReason(input);
  if (unresolvedReason) return clarify(unresolvedReason, capabilityIds);

  if (input.frame.questionMode === "agent_meta") {
    return {
      disposition: "answer",
      boundaryReason: "none",
      responseStatus: "completed",
      shouldGenerate: false,
      capabilityIds,
    };
  }

  if (input.contract) {
    return {
      disposition: "answer",
      boundaryReason: "none",
      responseStatus: "completed",
      shouldGenerate: false,
      capabilityIds,
    };
  }

  if (unsupportedPersonalFactPattern.test(input.question)) {
    return decline("missing_personal_evidence", capabilityIds);
  }

  if (input.frame.questionMode === "candidate_reasoning") {
    if (!capabilities.length) return decline("outside_supported_scope", capabilityIds);
    return {
      disposition: "scoped_answer",
      boundaryReason: "none",
      responseStatus: "completed",
      shouldGenerate: true,
      capabilityIds,
    };
  }

  if (input.stableAnswer) {
    return {
      disposition: "answer",
      boundaryReason: "none",
      responseStatus: "completed",
      shouldGenerate: false,
      capabilityIds,
    };
  }

  const hasEvidence = input.items.length > 0 && input.claimIds.length > 0 && input.sourceIds.length > 0;
  if (!hasEvidence && (input.frame.evidencePolicy === "required" || input.frame.topic === "unknown" || input.plan.intent === "general")) {
    return decline("missing_personal_evidence", capabilityIds);
  }
  if (!hasEvidence && !input.plan.answerableWithoutRetrievedEvidence) {
    return decline("missing_personal_evidence", capabilityIds);
  }

  return {
    disposition: "answer",
    boundaryReason: "none",
    responseStatus: "completed",
    shouldGenerate: true,
    capabilityIds,
  };
}

export function serviceUnavailableMessage() {
  return "当前回答服务暂时不可用。为了避免给出不准确的内容，我没有展示这次回答，请稍后重新生成。";
}
