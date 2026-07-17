import type { CandidateRisk, EvidenceKind, ObsidianSyncConfig, ParsedObsidianDocument } from "./types.ts";

const contactPatterns = [
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /(?<!\d)1[3-9]\d{9}(?!\d)/,
  /(?:微信|wechat)\s*[:：]\s*[\w-]{5,}/i,
  /(?<!\d)\d{17}[\dXx](?!\d)/,
];

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /(?:api[_\s-]*key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+-]{16,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const confidentialPatterns = [/客户名称|内部底稿|原始底稿|企业机密|未公开数据|保密协议|\bNDA\b/i];
const injectionPatterns = [/忽略.{0,12}(指令|规则)|ignore.{0,12}(instructions|rules)|system\s*prompt|系统提示词/i];
const quantitativePattern = /(?:\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*(?:万|亿|倍|小时|分钟|天|项|人|次))/;

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function scanSensitiveText(value: string, config: ObsidianSyncConfig, includeRestricted = true) {
  const risks = new Set<CandidateRisk>();
  if (includeRestricted && config.restrictedTerms.some((term) => value.toLowerCase().includes(term.toLowerCase()))) risks.add("restricted_topic");
  if (matchesAny(value, contactPatterns)) risks.add("contact_information");
  if (matchesAny(value, secretPatterns)) risks.add("secret");
  if (matchesAny(value, confidentialPatterns)) risks.add("confidential");
  if (matchesAny(value, injectionPatterns)) risks.add("prompt_injection");
  return [...risks];
}

export function assessCandidate(input: {
  document: ParsedObsidianDocument;
  heading: string;
  content: string;
  evidenceKind: EvidenceKind;
  config: ObsidianSyncConfig;
  documentText?: string;
}) {
  const combined = `${input.document.sourcePath}\n${input.document.title}\n${input.heading}\n${input.content}\n${input.document.sources.join("\n")}\n${input.document.aliases.join("\n")}`;
  const risks = new Set<CandidateRisk>(scanSensitiveText(combined, input.config));
  for (const risk of scanSensitiveText(input.documentText ?? "", input.config, false)) risks.add(risk);
  if (quantitativePattern.test(input.content)) risks.add("quantitative_claim");
  if (["seed", "draft"].includes(input.document.status ?? "")) risks.add("draft_content");
  if (!input.document.sources.length) risks.add("missing_sources");
  if (!input.document.metadataValid) risks.add("invalid_metadata");

  const hardBlock = ["restricted_topic", "contact_information", "secret", "confidential", "prompt_injection", "invalid_metadata"].some((risk) => risks.has(risk as CandidateRisk))
    || input.evidenceKind === "codex_inference";
  return {
    risks: [...risks].sort(),
    publicationStatus: hardBlock ? "blocked" as const : "review_required" as const,
  };
}

export function shouldExcludePath(sourcePath: string, config: ObsidianSyncConfig) {
  const normalized = sourcePath.replace(/\\/g, "/").toLowerCase();
  return config.excludePathPrefixes.some((prefix) => normalized === prefix.toLowerCase() || normalized.startsWith(`${prefix.toLowerCase()}/`))
    || config.excludePathContains.some((fragment) => normalized.includes(fragment.toLowerCase()));
}
