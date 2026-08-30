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
const ambiguousCompanyPattern = /(?:为什么|为何).{0,8}(?:选择|加入|应聘)(?:我们|你们|贵公司|这家公司)|为什么是我们/i;
const roleNamePattern = /[A-Za-z0-9\u4e00-\u9fa5]{2,24}(?:产品经理|岗位|职位|PM)/i;
const projectNamePattern = /百度|AI\s*Coding|Evaluator\s*Agent|RAG|DeepFlow|Ask\s*Me|Thirty-Minute Brain|审计/i;

function historyContains(history: ChatMessage[], pattern: RegExp) {
  return history.slice(-8).some((message) => message.role === "user" && pattern.test(message.content));
}

export function unresolvedReferenceReason(input: Pick<AnswerabilityInput, "question" | "history" | "frame" | "contract">) {
  if (ambiguousCompanyPattern.test(input.question) && !input.frame.targetRole && !input.contract) return "ambiguous_role" as const;
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
      ? "为了避免泛泛而谈，您能补充一下具体公司、岗位名称，或者 JD 中最关注的职责吗？"
      : "为了准确回答，您指的是 AI Coding Evaluator、RAG Knowledge Base、DeepFlow，还是 Ask Me 项目？",
  };
}

function decline(reason: "missing_personal_evidence" | "outside_supported_scope" | "unrelated_to_interview", capabilityIds: string[]): AnswerabilityDecision {
  return {
    disposition: "decline",
    boundaryReason: reason,
    responseStatus: "insufficient_evidence",
    shouldGenerate: false,
    capabilityIds,
    message: reason === "missing_personal_evidence"
      ? "这部分我没有可以准确说明的真实经历，我不希望用推测替代事实。如果您希望评估相近能力，我可以结合已经公开的项目和实践继续回答。"
      : reason === "unrelated_to_interview"
        ? "抱歉，这个问题和当前面试中评估候选人的经历与能力关联不强，我不希望用泛泛的内容代替有效回答。如果您愿意，可以继续了解我的 AI 产品、项目实践或岗位匹配。"
        : "这个问题超出了我目前能够可靠说明的能力范围，我不想用通用答案代替真实判断。您可以继续了解我的 AI 产品、模型评测、数据分析或企业流程实践。",
  };
}

function boundaryBridge(frame: QuestionFrame, capabilityIds: string[]): AnswerabilityDecision {
  const message = frame.questionFamily === "career_logistics"
    ? "这个问题我需要谨慎回答。当前公开资料里没有可以准确确认的具体安排，我不希望替本人做未经确认的承诺。可以确认的是，我会以岗位匹配和双方实际安排为基础坦诚沟通；如果您希望继续判断适配度，我也可以说明我的求职方向与相关能力。"
    : "这个问题我需要谨慎回答。就目前已公开的信息，我没有足够依据准确说明这部分，也不希望为了完整而做猜测。如果您愿意，我可以结合相近经历说明我的工作方式、学习特点或岗位相关能力。";
  return {
    disposition: "decline",
    boundaryReason: "missing_personal_evidence",
    responseStatus: "insufficient_evidence",
    shouldGenerate: false,
    capabilityIds,
    message,
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
      shouldGenerate: input.contract.generationMode === "realtime",
      capabilityIds,
    };
  }

  if (input.frame.answerStrategy === "boundary_bridge" || input.frame.factRisk === "unsupported_personal") return boundaryBridge(input.frame, capabilityIds);
  if (input.frame.answerStrategy === "decline") return decline(
    input.frame.questionFamily === "unrelated" ? "unrelated_to_interview" : "outside_supported_scope",
    capabilityIds,
  );

  if (input.frame.questionMode === "candidate_reasoning") {
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
  if (!hasEvidence && input.frame.questionFamily === "unrelated") {
    return decline("unrelated_to_interview", capabilityIds);
  }
  if (!hasEvidence && input.frame.questionFamily === "behavioral") {
    return boundaryBridge(input.frame, capabilityIds);
  }
  if (!hasEvidence && (input.frame.evidencePolicy === "required" || input.frame.answerStrategy === "evidence_answer")) {
    return boundaryBridge(input.frame, capabilityIds);
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
  return "抱歉，这次回答没有成功生成。为了避免展示不完整或不准确的内容，我先没有保留它。你可以点击“重新回答”再试一次。";
}
