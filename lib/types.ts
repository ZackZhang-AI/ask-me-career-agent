export type Verification = "externally_verified" | "self_attested" | "unverified";
export type ProjectStatus = "completed" | "in_progress" | "planned" | "archived";
export type Visibility = "public" | "private";
export type ContentStatus = "active" | "draft" | "archived";
export type ResponseStatus = "completed" | "insufficient_evidence" | "refused" | "rate_limited" | "budget_exhausted" | "upstream_error";

export interface ContentMetadata {
  visibility: Visibility;
  status: ContentStatus;
  verification: Verification;
  lastUpdated: string;
  relatedProject?: string;
  supportsClaimIds: string[];
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
}

export interface StarStory extends ContentMetadata {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  limitations: string;
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
}

export interface ChatMessage { role: "user" | "assistant"; content: string }
