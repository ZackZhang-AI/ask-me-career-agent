export type Verification = "externally_verified" | "self_attested" | "unverified";
export type ProjectStatus = "completed" | "in_progress" | "planned" | "archived";

export interface Source {
  id: string;
  title: string;
  sourceType: "repository" | "online_demo" | "document" | "certificate" | "self_report" | "inference";
  url?: string;
  public: boolean;
  lastChecked: string;
  verification: Verification;
  projectStatus?: ProjectStatus;
  supports: string;
  limitations: string;
}

export interface Claim {
  id: string;
  statement: string;
  claimType: "background" | "experience" | "project" | "skill" | "boundary";
  candidateContribution: string;
  aiAssistance: string;
  verification: Verification;
  sourceIds: string[];
  limitations: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  projectStatus?: ProjectStatus;
  verification: Verification;
  candidateContribution: string;
  aiAssistance: string;
  limitations: string;
  claimIds: string[];
  sourceIds: string[];
}

export interface ChatMessage { role: "user" | "assistant"; content: string }
