export type EvidenceKind =
  | "confirmed_fact"
  | "user_statement"
  | "source_view"
  | "narrative_draft"
  | "counter_evidence"
  | "codex_inference"
  | "pending_validation"
  | "other";

export type CandidateRisk =
  | "restricted_topic"
  | "contact_information"
  | "secret"
  | "confidential"
  | "prompt_injection"
  | "quantitative_claim"
  | "draft_content"
  | "missing_sources"
  | "invalid_metadata";

export interface ObsidianSyncConfig {
  version: 1;
  includeFiles: string[];
  excludePathPrefixes: string[];
  excludePathContains: string[];
  restrictedTerms: string[];
  maxFileBytes: number;
  maxCandidateChars: number;
}

export interface ParsedSection {
  heading: string;
  level: number;
  content: string;
}

export interface ParsedObsidianDocument {
  sourcePath: string;
  sourceSha256: string;
  title: string;
  updated?: string;
  status?: string;
  confidence?: string;
  sources: string[];
  aliases: string[];
  sections: ParsedSection[];
  metadataValid: boolean;
}

export interface ObsidianCandidate {
  id: string;
  sourcePath: string;
  sourceSha256: string;
  documentTitle: string;
  section: string;
  evidenceKind: EvidenceKind;
  content: string;
  contentSha256: string;
  sources: string[];
  aliases: string[];
  risks: CandidateRisk[];
  publicationStatus: "review_required" | "blocked";
  approvalState: "not_approved" | "approved_current" | "approved_stale" | "approved_blocked";
}

export interface ObsidianSyncManifest {
  schemaVersion: 1;
  generatedAt: string;
  policyVersion: number;
  documents: Array<{ sourcePath: string; sourceSha256: string }>;
  candidates: ObsidianCandidate[];
  stats: {
    scannedDocuments: number;
    newDocuments: number;
    changedDocuments: number;
    unchangedDocuments: number;
    reviewRequired: number;
    blocked: number;
    approvedCurrent: number;
    approvedStale: number;
    blockedApprovals: number;
    duplicateApprovals: number;
    orphanApprovals: number;
  };
}
