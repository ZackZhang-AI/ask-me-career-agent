import type {
  AnswerCitation,
  ChatMessage,
  KnowledgeItem,
  ResponseStatus,
  Source,
} from "./types";

export const CONVERSATION_HISTORY_KEY = "ask-me-conversations-v1";
export const MAX_LOCAL_CONVERSATIONS = 10;

export interface ConversationMessage extends ChatMessage {
  sources?: Source[];
  items?: KnowledgeItem[];
  mode?: "live" | "stable" | "demo" | "guardrail";
  responseStatus?: ResponseStatus;
  claimIds?: string[];
  sourceIds?: string[];
  citations?: AnswerCitation[];
  latencyMs?: number;
  firstTokenLatencyMs?: number;
  deliveryPath?: "preset" | "api";
  contractId?: string;
  followUpQuestions?: string[];
}

export interface LocalConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function normalizeSource(value: unknown): Source | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.supports !== "string" ||
    typeof value.limitations !== "string" ||
    typeof value.lastChecked !== "string" ||
    typeof value.lastUpdated !== "string"
  ) return null;
  const verification = ["externally_verified", "self_attested", "unverified"].includes(String(value.verification))
    ? value.verification as Source["verification"]
    : "unverified";
  const sourceType = ["repository", "online_demo", "document", "certificate", "self_report", "inference"].includes(String(value.sourceType))
    ? value.sourceType as Source["sourceType"]
    : "self_report";
  return {
    id: value.id,
    title: value.title,
    supports: value.supports,
    limitations: value.limitations,
    lastChecked: value.lastChecked,
    lastUpdated: value.lastUpdated,
    verification,
    sourceType,
    public: value.public === true,
    visibility: value.visibility === "private" ? "private" : "public",
    status: ["active", "draft", "archived"].includes(String(value.status))
      ? value.status as Source["status"]
      : "active",
    supportsClaimIds: asStringArray(value.supportsClaimIds) ?? [],
    ...(typeof value.url === "string" && /^https?:\/\//.test(value.url) ? { url: value.url } : {}),
    ...(typeof value.relatedProject === "string" ? { relatedProject: value.relatedProject } : {}),
    ...(["completed", "in_progress", "planned", "archived"].includes(String(value.projectStatus))
      ? { projectStatus: value.projectStatus as Source["projectStatus"] }
      : {}),
  };
}

function normalizeCitation(value: unknown): AnswerCitation | null {
  if (!isRecord(value) || typeof value.paragraphIndex !== "number") return null;
  return {
    paragraphIndex: value.paragraphIndex,
    claimIds: asStringArray(value.claimIds) ?? [],
    sourceIds: asStringArray(value.sourceIds) ?? [],
  };
}

function normalizeMessage(value: unknown): ConversationMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== "user" && value.role !== "assistant") return null;
  if (typeof value.content !== "string" || !value.content.trim()) return null;

  const message: ConversationMessage = {
    role: value.role,
    content: value.content.slice(0, 8_000),
  };
  if (["live", "stable", "demo", "guardrail"].includes(String(value.mode))) {
    message.mode = value.mode as ConversationMessage["mode"];
  }
  if (typeof value.responseStatus === "string") message.responseStatus = value.responseStatus as ResponseStatus;
  if (typeof value.deliveryPath === "string") message.deliveryPath = value.deliveryPath as "preset" | "api";
  if (typeof value.contractId === "string") message.contractId = value.contractId;
  if (typeof value.latencyMs === "number") message.latencyMs = value.latencyMs;
  if (typeof value.firstTokenLatencyMs === "number") message.firstTokenLatencyMs = value.firstTokenLatencyMs;
  message.claimIds = asStringArray(value.claimIds);
  message.sourceIds = asStringArray(value.sourceIds);
  message.followUpQuestions = asStringArray(value.followUpQuestions);

  if (Array.isArray(value.sources)) {
    message.sources = value.sources.map(normalizeSource).filter((source): source is Source => Boolean(source));
  }
  if (Array.isArray(value.citations)) {
    message.citations = value.citations.map(normalizeCitation).filter((citation): citation is AnswerCitation => Boolean(citation));
  }
  return message;
}

export function conversationTitle(messages: readonly ChatMessage[]) {
  const question = messages.find((message) => message.role === "user")?.content.trim() ?? "新对话";
  const normalized = question.replace(/\s+/g, " ");
  return Array.from(normalized).length > 28
    ? `${Array.from(normalized).slice(0, 28).join("")}…`
    : normalized;
}

export function parseConversationHistory(serialized: string | null): LocalConversation[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): LocalConversation[] => {
      if (!isRecord(value) || typeof value.id !== "string") return [];
      const messages = Array.isArray(value.messages)
        ? value.messages.map(normalizeMessage).filter((message): message is ConversationMessage => Boolean(message))
        : [];
      if (!messages.some((message) => message.role === "user")) return [];
      const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString();
      const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
      return [{
        id: value.id,
        title: typeof value.title === "string" && value.title.trim()
          ? value.title.trim().slice(0, 60)
          : conversationTitle(messages),
        createdAt,
        updatedAt,
        messages,
      }];
    })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_LOCAL_CONVERSATIONS);
  } catch {
    return [];
  }
}

export function upsertLocalConversation(
  history: readonly LocalConversation[],
  conversationId: string,
  messages: readonly ConversationMessage[],
  now = new Date().toISOString(),
) {
  const persistedMessages = messages
    .map(normalizeMessage)
    .filter((message): message is ConversationMessage => Boolean(message))
    .slice(-40);
  if (!persistedMessages.some((message) => message.role === "user")) return [...history];

  const existing = history.find((conversation) => conversation.id === conversationId);
  const conversation: LocalConversation = {
    id: conversationId,
    title: existing?.title ?? conversationTitle(persistedMessages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages: persistedMessages,
  };
  return [
    conversation,
    ...history.filter((item) => item.id !== conversationId),
  ].slice(0, MAX_LOCAL_CONVERSATIONS);
}

export function renameLocalConversation(
  history: readonly LocalConversation[],
  conversationId: string,
  title: string,
) {
  const clean = title.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return [...history];
  return history.map((conversation) => (
    conversation.id === conversationId ? { ...conversation, title: clean } : conversation
  ));
}
