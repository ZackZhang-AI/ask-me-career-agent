export type Verification = "externally_verified" | "self_attested" | "unverified";
export type ProjectStatus = "completed" | "in_progress" | "planned" | "archived";
export type Visibility = "public" | "private";
export type ContentStatus = "active" | "draft" | "archived";
export type ResponseStatus = "completed" | "insufficient_evidence" | "refused" | "rate_limited" | "budget_exhausted" | "upstream_error";
export type EvidenceBasis = "confirmed_fact" | "source_view" | "user_statement" | "inference";
export type ResponseShape = "narrative" | "direct" | "fit_mapping" | "project_arc" | "contribution" | "star" | "shortcoming" | "recommendation";
export type ConversationDepth = "overview" | "follow_up" | "deep_dive";
export type AnswerIntent =
  | "introduction"
  | "role_fit"
  | "representative_project"
  | "project_overview"
  | "project_problem"
  | "contribution"
  | "ai_collaboration"
  | "challenge"
  | "result"
  | "limitation"
  | "skills"
  | "experience"
  | "experience_value"
  | "privacy"
  | "education"
  | "credentials"
  | "hiring_recommendation"
  | "general";

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

export interface AnswerPlan {
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
  responseShape: ResponseShape;
  closingPurpose: string;
  targetLength: { min: number; max: number };
  followUpQuestions: string[];
  recentAnswers: string[];
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
