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
