import { z } from "zod";
import { knowledgeContent, projectAliases, strengthContent, suggestedQuestionContent } from "../content/knowledge.ts";
import { faqContent, stableAnswerContent } from "../content/qa.ts";
import { sourceContent, claimContent } from "../content/sources-claims.ts";
import { starStoryContent } from "../content/stories.ts";
import obsidianApprovedKnowledgeContent from "../content/obsidian-approved.json";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "必须使用 YYYY-MM-DD 日期");
const verification = z.enum(["externally_verified", "self_attested", "unverified"]);
const visibility = z.enum(["public", "private"]);
const status = z.enum(["active", "draft", "archived"]);
const projectStatus = z.enum(["completed", "in_progress", "planned", "archived"]);
const obsidianProvenanceSchema = z.object({
  provider: z.literal("obsidian"),
  candidateId: z.string().regex(/^obs_[a-f0-9]{16}$/),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  section: z.string().min(1),
  reviewedAt: isoDate,
}).strict();

const metadata = {
  visibility,
  status,
  verification,
  lastUpdated: isoDate,
  relatedProject: z.string().min(1).optional(),
  supportsClaimIds: z.array(z.string().min(1)),
};

export const sourceSchema = z.object({
  ...metadata,
  id: z.string().regex(/^S\d+$/),
  title: z.string().min(1),
  sourceType: z.enum(["repository", "online_demo", "document", "certificate", "self_report", "inference"]),
  url: z.url().optional(),
  public: z.boolean(),
  lastChecked: isoDate,
  projectStatus: projectStatus.optional(),
  supports: z.string().min(1),
  limitations: z.string().min(1),
}).superRefine((source, context) => {
  if (source.public !== (source.visibility === "public")) {
    context.addIssue({ code: "custom", path: ["public"], message: "public 必须与 visibility 一致" });
  }
});

export const claimSchema = z.object({
  ...metadata,
  id: z.string().regex(/^C\d+$/),
  statement: z.string().min(1),
  claimType: z.enum(["background", "experience", "project", "skill", "boundary"]),
  evidenceBasis: z.enum(["confirmed_fact", "source_view", "user_statement", "inference"]),
  candidateContribution: z.string().min(1),
  aiAssistance: z.string().min(1),
  sourceIds: z.array(z.string().regex(/^S\d+$/)).min(1),
  limitations: z.string().min(1),
});

export const knowledgeItemSchema = z.object({
  ...metadata,
  id: z.string().regex(/^K\d+$/),
  title: z.string().min(1),
  content: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  projectStatus: projectStatus.optional(),
  candidateContribution: z.string().min(1),
  aiAssistance: z.string().min(1),
  limitations: z.string().min(1),
  claimIds: z.array(z.string().regex(/^C\d+$/)).min(1),
  sourceIds: z.array(z.string().regex(/^S\d+$/)).min(1),
  provenance: obsidianProvenanceSchema.optional(),
});

export const obsidianApprovedKnowledgeSchema = z.array(knowledgeItemSchema.extend({
  provenance: obsidianProvenanceSchema,
})).superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.provenance.candidateId)) {
      context.addIssue({ code: "custom", path: [index, "provenance", "candidateId"], message: "重复的 Obsidian 候选项批准" });
    }
    seen.add(item.provenance.candidateId);
  });
});

const obsidianApprovedKnowledge = obsidianApprovedKnowledgeSchema.parse(obsidianApprovedKnowledgeContent);

export const starStorySchema = z.object({
  ...metadata,
  id: z.string().regex(/^ST\d+$/),
  title: z.string().min(1),
  situation: z.string().min(1),
  task: z.string().min(1),
  action: z.string().min(1),
  result: z.string().min(1),
  limitations: z.string().min(1),
  claimIds: z.array(z.string().regex(/^C\d+$/)).min(1),
  sourceIds: z.array(z.string().regex(/^S\d+$/)).min(1),
});

export const stableAnswerSchema = z.object({
  ...metadata,
  id: z.string().regex(/^A\d+$/),
  question: z.string().min(1),
  standardAnswer: z.string().min(1),
  details: z.array(z.string().min(1)).min(2).max(5).optional(),
  limitations: z.string().min(1),
  claimIds: z.array(z.string().regex(/^C\d+$/)).min(1),
  sourceIds: z.array(z.string().regex(/^S\d+$/)).min(1),
  requiredClaimIds: z.array(z.string().regex(/^C\d+$/)).min(1),
  requiredSourceIds: z.array(z.string().regex(/^S\d+$/)).min(1),
  matchKeywords: z.array(z.string().min(1)).min(1),
  factSkeleton: z.object({
    intent: z.enum(["introduction", "role_fit", "representative_project", "project_overview", "project_problem", "contribution", "ai_collaboration", "challenge", "result", "limitation", "skills", "experience", "experience_value", "privacy", "education", "credentials", "hiring_recommendation", "general"]),
    thesis: z.string().min(1),
    mustInclude: z.array(z.string().min(1)).min(1),
    allowedFacts: z.array(z.string().min(1)).min(1),
    allowedNumbers: z.array(z.string().min(1)),
    allowedOrganizations: z.array(z.string().min(1)),
    allowedProjectStatuses: z.array(z.string().min(1)),
    boundaryTriggers: z.array(z.string().min(1)).min(1),
    forbiddenDetails: z.array(z.string().min(1)).min(1),
  }),
});

export const faqSchema = z.object({
  ...metadata,
  id: z.string().regex(/^F\d+$/),
  question: z.string().min(1),
  answerId: z.string().regex(/^A\d+$/),
  keywords: z.array(z.string().min(1)).min(1),
});

export const contentCatalogSchema = z.object({
  strengths: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).length(3),
  sources: z.array(sourceSchema).min(1),
  claims: z.array(claimSchema).min(1),
  knowledge: z.array(knowledgeItemSchema).min(1),
  starStories: z.array(starStorySchema).min(8),
  faqs: z.array(faqSchema).min(15),
  stableAnswers: z.array(stableAnswerSchema).min(20),
  suggestedQuestions: z.array(z.string().min(1)).min(1),
  aliases: z.record(z.string(), z.array(z.string().min(1)).min(1)),
}).superRefine((catalog, context) => {
  const ensureUnique = (items: Array<{ id: string }>, path: string) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.id)) context.addIssue({ code: "custom", path: [path, index, "id"], message: `重复 ID: ${item.id}` });
      seen.add(item.id);
    }
  };
  ensureUnique(catalog.sources, "sources");
  ensureUnique(catalog.claims, "claims");
  ensureUnique(catalog.knowledge, "knowledge");
  ensureUnique(catalog.starStories, "starStories");
  ensureUnique(catalog.faqs, "faqs");
  ensureUnique(catalog.stableAnswers, "stableAnswers");

  const sourceIds = new Set(catalog.sources.map((item) => item.id));
  const claimIds = new Set(catalog.claims.map((item) => item.id));
  const answerIds = new Set(catalog.stableAnswers.map((item) => item.id));
  const checkReferences = (items: Array<{ claimIds?: string[]; sourceIds?: string[]; supportsClaimIds: string[] }>, path: string) => {
    items.forEach((item, index) => {
      for (const claimId of [...(item.claimIds ?? []), ...item.supportsClaimIds]) {
        if (!claimIds.has(claimId)) context.addIssue({ code: "custom", path: [path, index], message: `未知 Claim: ${claimId}` });
      }
      for (const sourceId of item.sourceIds ?? []) {
        if (!sourceIds.has(sourceId)) context.addIssue({ code: "custom", path: [path, index], message: `未知 Source: ${sourceId}` });
      }
    });
  };
  checkReferences(catalog.sources, "sources");
  checkReferences(catalog.claims, "claims");
  checkReferences(catalog.knowledge, "knowledge");
  checkReferences(catalog.starStories, "starStories");
  checkReferences(catalog.stableAnswers, "stableAnswers");
  checkReferences(catalog.faqs, "faqs");
  catalog.faqs.forEach((faq, index) => {
    if (!answerIds.has(faq.answerId)) context.addIssue({ code: "custom", path: ["faqs", index, "answerId"], message: `未知 Answer: ${faq.answerId}` });
  });

  const publicClaims = new Set(catalog.claims.filter((item) => item.visibility === "public" && item.status === "active" && item.verification !== "unverified").map((item) => item.id));
  const publicSources = new Set(catalog.sources.filter((item) => item.visibility === "public" && item.status === "active" && item.verification !== "unverified").map((item) => item.id));
  const isPublicActive = (item: { visibility: string; status: string; verification: string }) => item.visibility === "public" && item.status === "active" && item.verification !== "unverified";
  const ensurePublicReferences = (items: Array<{ visibility: string; status: string; verification: string; claimIds?: string[]; sourceIds?: string[]; requiredClaimIds?: string[]; requiredSourceIds?: string[] }>, path: string) => {
    items.forEach((item, index) => {
      if (!isPublicActive(item)) return;
      const referencedClaims = [...(item.claimIds ?? []), ...(item.requiredClaimIds ?? [])];
      const referencedSources = [...(item.sourceIds ?? []), ...(item.requiredSourceIds ?? [])];
      if (!referencedClaims.every((id) => publicClaims.has(id)) || !referencedSources.every((id) => publicSources.has(id))) {
        context.addIssue({ code: "custom", path: [path, index], message: "公开内容只能引用公开、有效且已验证的 Claim/Source" });
      }
    });
  };
  catalog.claims.forEach((claim, index) => {
    if (isPublicActive(claim) && !claim.sourceIds.every((id) => publicSources.has(id))) {
      context.addIssue({ code: "custom", path: ["claims", index], message: "公开 Claim 只能引用公开、有效且已验证的 Source" });
    }
    if (isPublicActive(claim) && claim.evidenceBasis === "inference" && claim.claimType !== "boundary") {
      context.addIssue({ code: "custom", path: ["claims", index, "evidenceBasis"], message: "公开推断只能作为证据边界，不得作为候选人事实" });
    }
  });
  ensurePublicReferences(catalog.knowledge, "knowledge");
  ensurePublicReferences(catalog.starStories, "starStories");
  ensurePublicReferences(catalog.stableAnswers, "stableAnswers");
  catalog.faqs.forEach((faq, index) => {
    if (!isPublicActive(faq)) return;
    const answer = catalog.stableAnswers.find((item) => item.id === faq.answerId);
    if (!answer || !isPublicActive(answer)) context.addIssue({ code: "custom", path: ["faqs", index], message: "公开 FAQ 只能引用公开、有效且已验证的稳定回答" });
  });
});

export const contentCatalog = contentCatalogSchema.parse({
  strengths: strengthContent,
  sources: sourceContent,
  claims: claimContent,
  knowledge: [...knowledgeContent, ...obsidianApprovedKnowledge],
  starStories: starStoryContent,
  faqs: faqContent,
  stableAnswers: stableAnswerContent,
  suggestedQuestions: suggestedQuestionContent,
  aliases: projectAliases,
});
