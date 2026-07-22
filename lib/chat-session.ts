import type { ChatMessage } from "./types";

export function prepareQuestionMessages<T extends ChatMessage>(
  messages: T[],
  question: string,
  retry = false,
): ChatMessage[] {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  const history = retry && lastUserIndex >= 0 ? messages.slice(0, lastUserIndex) : messages;

  return [...history, { role: "user", content: question }];
}

export function isNearScrollBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 120,
) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function presetRevealChunks(content: string) {
  const characters = Array.from(content);
  const chunks: string[] = [];
  let offset = 0;

  while (offset < characters.length) {
    const chunkSize = offset === 0 ? 1 : offset < 20 ? 2 : offset < 96 ? 3 : 5;
    chunks.push(characters.slice(offset, offset + chunkSize).join(""));
    offset += chunkSize;
  }

  return chunks;
}
