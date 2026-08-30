export type Verification = "externally_verified" | "self_attested" | "unverified";
export type ProjectStatus = "completed" | "in_progress" | "planned" | "archived";
export type Visibility = "public" | "private";
export type ContentStatus = "active" | "draft" | "archived";
export type ResponseStatus = "completed" | "needs_clarification" | "insufficient_evidence" | "refused" | "rate_limited" | "budget_exhausted" | "upstream_error";
export type AnswerDisposition = "answer" | "scoped_answer" | "clarify" | "decline" | "service_unavailable";
export type BoundaryReason =
  | "none"
  | "ambiguous_role"
  | "ambiguous_project"
  | "missing_personal_evidence"
  | "outside_supported_scope"
  | "unrelated_to_interview"
  | "unsafe_request"
  | "quality_review_failed"
  | "upstream_unavailable";
export type ProcessingStage = "understanding" | "checking_evidence" | "writing_answer" | "reviewing_answer";
export type ReviewPath = "none" | "pro_pass" | "pro_rewrite" | "pro_reject";
export type DeliveryMode = "local_reveal" | "realtime_stream" | "reviewed_buffer";
export type StreamFailureType = "hard_safety" | "transport_interrupted" | "service_unavailable" | "semantic_warning";
export type AnswerDetailLevel = "concise" | "standard" | "deep";
export type InterviewQuestionFamily =
  | "candidate_fact"
  | "behavioral"
  | "situational"
  | "product_case"
  | "business_case"
  | "estimation"
  | "motivation"
  | "work_style"
  | "career_logistics"
  | "current_topic"
  | "agent_meta"
  | "unrelated";
export type FactRisk = "low" | "supported_personal" | "unsupported_personal" | "freshness_sensitive";
export type AnswerStrategy = "evidence_answer" | "reasoned_answer" | "clarify_then_answer" | "boundary_bridge" | "decline";
export type EvidenceBasis = "confirmed_fact" | "source_view" | "user_statement" | "inference";
export type ResponseShape = "narrative" | "direct" | "fit_mapping" | "project_arc" | "contribution" | "star" | "shortcoming" | "recommendation";
export type ConversationDepth = "overview" | "follow_up" | "deep_dive";
export type QuestionTopic =
  | "profile"
  | "role_fit"
  | "baidu"
  | "rag"
  | "deepflow"
  | "ask_me"
  | "local_tools"
  | "audit"
  | "statistics"
  | "skills"
  | "enterprise_ai"
  | "agent"
  | "unknown";
export type QuestionFacet =
  | "overview"
  | "problem"
  | "method"
  | "contribution"
  | "architecture"
  | "collaboration"
  | "evaluation"
  | "transfer"
  | "example"
  | "result"
  | "boundary"
  | "fit";
export type QuestionRouteSource = "contract" | "local" | "model";
export type QuestionMode = "agent_meta" | "candidate_fact" | "candidate_reasoning";
export type EvidencePolicy = "required" | "supporting" | "none";

export interface QuestionFrame {
  topic: QuestionTopic;
  facet: QuestionFacet;
  answerIntent: AnswerIntent;
  questionMode: QuestionMode;
  evidencePolicy: EvidencePolicy;
  questionFamily: InterviewQuestionFamily;
  factRisk: FactRisk;
  answerStrategy: AnswerStrategy;
  focusTerms: string[];
  targetRole?: string;
  requestedDimensions: string[];
  activeProject?: string;
  useHistory: boolean;
  confidence: number;
  requiredKnowledgeIds: string[];
  allowedStoryIds: string[];
  forbiddenTopics: QuestionTopic[];
  responseShape: ResponseShape;
  targetLength: { min: number; max: number };
  answerGoal: string;
  routeSource: QuestionRouteSource;
  intentResolution?: {
    localIntent: AnswerIntent;
    plannedIntent: AnswerIntent;
    resolvedIntent: AnswerIntent;
    conflictReason?: string;
  };
}

export interface QuestionContract {
  id: string;
  question: string;
  aliases: string[];
  frame: Omit<QuestionFrame, "routeSource">;
  thesis: string;
  requiredPoints: string[];
  directAnswerTerms: string[];
  fallbackAnswer: string;
  nextContractIds: string[];
  generationMode: "local" | "realtime";
}
export type AnswerIntent =
  | "agent_identity"
  | "capability_scope"
  | "introduction"
  | "career_transition"
  | "role_fit"
  | "representative_project"
  | "project_overview"
  | "project_problem"
  | "contribution"
  | "ai_collaboration"
  | "challenge"
  | "diagnosis"
  | "result"
  | "limitation"
  | "skills"
  | "experience"
  | "experience_value"
  | "privacy"
  | "education"
  | "credentials"
  | "hiring_recommendation"
  | "behavioral_experience"
  | "situational_judgment"
  | "product_design"
  | "business_analysis"
  | "estimation"
  | "work_style"
  | "career_planning"
  | "company_motivation"
  | "career_logistics"
  | "industry_view"
  | "general";

export interface AnswerBlueprint {
  directConclusion: string;
  requiredFacts: string[];
  reasoningSteps: string[];
  keyTradeoffs: string[];
  interviewConclusion: string;
}

export interface AnswerFactSkeleton {
  intent: AnswerIntent;
  thesis: string;
  mustInclude: string[];
  allowedFacts: string[];
  allowedNumbers: string[];
  allowedOrganizations: string[];
  allowedProjectStatuses: string[];
  boundaryTriggers: string[];
  forbiddenDetails: string[];
}

export interface InterviewConversationContext {
  activeProject?: string;
  targetRole?: string;
  depth: ConversationDepth;
  askedDimensions: QuestionFacet[];
  usedKnowledgeIds: string[];
  usedStoryIds: string[];
}

export interface AnswerBrief {
  directThesis: string;
  requiredDimensions: string[];
  primaryEvidenceId?: string;
  supportingEvidenceIds: string[];
  newInformationGoal: string[];
  forbiddenClaims: string[];
  closingPurpose: string;
}

export interface AnswerPlan {
  contractId?: string;
  topic: QuestionTopic;
  facet: QuestionFacet;
  focusTerms: string[];
  targetRole?: string;
  questionMode: QuestionMode;
  evidencePolicy: EvidencePolicy;
  questionFamily: InterviewQuestionFamily;
  factRisk: FactRisk;
  answerStrategy: AnswerStrategy;
  directAnswerTerms: string[];
  forbiddenTopics: QuestionTopic[];
  intent: AnswerIntent;
  thesis: string;
  mustInclude: string[];
  allowedFacts: string[];
  allowedNumbers: string[];
  allowedOrganizations: string[];
  allowedProjectStatuses: string[];
  forbiddenDetails: string[];
  shouldMentionLimitations: boolean;
  limitations?: string;
  relatedStoryId?: string;
  evaluationGoal: string;
  exclusivePoints: string[];
  newInformationGoal: string[];
  usedFactIds: string[];
  usedStoryIds: string[];
  avoidPoints: string[];
  conversationDepth: ConversationDepth;
  detailLevel: AnswerDetailLevel;
  responseShape: ResponseShape;
  closingPurpose: string;
  targetLength: { min: number; max: number };
  followUpQuestions: string[];
  recentAnswers: string[];
  conversationContext: InterviewConversationContext;
  brief: AnswerBrief;
  blueprint: AnswerBlueprint;
  answerableWithoutRetrievedEvidence: boolean;
  fallbackAnswer: string;
}

export interface ContentMetadata {
  visibility: Visibility;
  status: ContentStatus;
  verification: Verification;
  lastUpdated: string;
  relatedProject?: string;
  supportsClaimIds: string[];
}

export interface ObsidianProvenance {
  provider: "obsidian";
  candidateId: string;
  sourceSha256: string;
  section: string;
  reviewedAt: string;
}

export interface Source extends ContentMetadata {
  id: string;
  title: string;
  sourceType: "repository" | "online_demo" | "document" | "certificate" | "self_report" | "inference";
  url?: string;
  public: boolean;
  lastChecked: string;
  projectStatus?: ProjectStatus;
  supports: string;
  limitations: string;
}

export interface Claim extends ContentMetadata {
  id: string;
  statement: string;
  claimType: "background" | "experience" | "project" | "skill" | "boundary";
  evidenceBasis: EvidenceBasis;
  candidateContribution: string;
  aiAssistance: string;
  sourceIds: string[];
  limitations: string;
}

export interface KnowledgeItem extends ContentMetadata {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  projectStatus?: ProjectStatus;
  candidateContribution: string;
  aiAssistance: string;
  limitations: string;
  claimIds: string[];
  sourceIds: string[];
  provenance?: ObsidianProvenance;
}

export interface StarStory extends ContentMetadata {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  limitations: string;
  competency: string;
  interviewUse: string[];
  claimIds: string[];
  sourceIds: string[];
}

export interface FAQ extends ContentMetadata {
  id: string;
  question: string;
  answerId: string;
  keywords: string[];
}

export interface StableAnswer extends ContentMetadata {
  id: string;
  question: string;
  standardAnswer: string;
  details?: string[];
  limitations: string;
  claimIds: string[];
  sourceIds: string[];
  requiredClaimIds: string[];
  requiredSourceIds: string[];
  matchKeywords: string[];
  matchRequiresProjectContext?: boolean;
  evaluationGoal: string;
  exclusivePoints: string[];
  avoidRepeating: string[];
  responseShape: ResponseShape;
  targetLength: { min: number; max: number };
  preferredStoryIds: string[];
  followUpQuestions: string[];
  closingPurpose: string;
  factSkeleton: AnswerFactSkeleton;
}

export interface ChatMessage { role: "user" | "assistant"; content: string }

export interface AnswerCitation {
  paragraphIndex: number;
  claimIds: string[];
  sourceIds: string[];
}

export interface PresetAnswerPacket {
  contractId: string;
  question: string;
  content: string;
  mode: "stable";
  responseStatus: "completed";
  disposition: "answer";
  claimIds: string[];
  sourceIds: string[];
  citations: AnswerCitation[];
  sources: Source[];
  followUpQuestions: string[];
}
