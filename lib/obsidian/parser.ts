import { createHash } from "node:crypto";
import type { EvidenceKind, ParsedObsidianDocument, ParsedSection } from "./types.ts";

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function parseList(value: string | undefined) {
  if (!value) return [];
  const clean = value.trim();
  if (!clean.startsWith("[") || !clean.endsWith("]")) return clean ? [clean.replace(/^['"]|['"]$/g, "")] : [];
  return clean
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseFrontmatter(markdown: string) {
  if (!markdown.startsWith("---")) return { metadata: new Map<string, string>(), body: markdown };
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) return { metadata: new Map<string, string>(), body: markdown };
  const metadata = new Map<string, string>();
  for (const line of markdown.slice(3, end).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (match) metadata.set(match[1], match[2]);
  }
  return { metadata, body: markdown.slice(end + 4).replace(/^\r?\n/, "") };
}

function cleanMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, "[代码块已省略]")
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSections(body: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let current: ParsedSection | undefined;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (current?.content.trim()) sections.push({ ...current, content: cleanMarkdown(current.content) });
      current = { heading: cleanMarkdown(heading[2]), level: heading[1].length, content: "" };
      continue;
    }
    if (current) current.content += `${line}\n`;
  }
  if (current?.content.trim()) sections.push({ ...current, content: cleanMarkdown(current.content) });
  return sections.filter((section) => section.content.length >= 20);
}

export function classifyEvidence(heading: string): EvidenceKind {
  if (/已确认事实/.test(heading)) return "confirmed_fact";
  if (/用户确认|用户贡献|用户职责|用户承担|参与方式/.test(heading)) return "user_statement";
  if (/来源观点|来源记录|来源陈述|支持证据/.test(heading)) return "source_view";
  if (/Codex\s*推断|推断/.test(heading)) return "codex_inference";
  if (/反面证据|能力边界|结果与.*边界|状态与边界/.test(heading)) return "counter_evidence";
  if (/待验证|待补充|下一步证据|用户确认记录/.test(heading)) return "pending_validation";
  if (/一句话|\d+\s*秒|项目定位|项目故事|产品判断|项目目标/.test(heading)) return "narrative_draft";
  return "other";
}

export function parseObsidianDocument(sourcePath: string, markdown: string): ParsedObsidianDocument {
  const { metadata, body } = parseFrontmatter(markdown);
  const sections = extractSections(body);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const sources = parseList(metadata.get("sources"));
  const status = metadata.get("status");
  const confidence = metadata.get("confidence");
  const updated = metadata.get("updated");
  const validStatuses = new Set(["seed", "growing", "stable", "disputed", "outdated", "archived", "draft", "reviewed", "final"]);
  return {
    sourcePath,
    sourceSha256: sha256(markdown),
    title: h1 ? cleanMarkdown(h1) : sourcePath.split("/").at(-1)?.replace(/\.md$/i, "") ?? sourcePath,
    updated,
    status,
    confidence,
    sources,
    aliases: parseList(metadata.get("aliases")),
    sections,
    metadataValid: Boolean(metadata.get("type"))
      && Boolean(updated && /^\d{4}-\d{2}-\d{2}$/.test(updated))
      && Boolean(status && validStatuses.has(status))
      && Boolean(confidence && ["low", "medium", "high"].includes(confidence))
      && sources.length > 0,
  };
}
