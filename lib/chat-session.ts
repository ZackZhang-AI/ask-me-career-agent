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

export function presetRevealChunks(content: string, remainingSteps = 10) {
  const sentenceEnd = content.search(/[。！？]/);
  const firstEnd = sentenceEnd >= 0 ? sentenceEnd + 1 : Math.min(content.length, 80);
  const first = content.slice(0, firstEnd);
  const remaining = content.slice(firstEnd);
  if (!remaining) return [first];
  const chunkSize = Math.max(1, Math.ceil(remaining.length / remainingSteps));
  return [first, ...Array.from(
    { length: Math.ceil(remaining.length / chunkSize) },
    (_, index) => remaining.slice(index * chunkSize, (index + 1) * chunkSize),
  )];
}
