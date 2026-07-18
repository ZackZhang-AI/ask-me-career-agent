export interface AnswerSegment {
  text: string;
  emphasized: boolean;
}

/** 只解析回答协议允许的 **重点**，不执行任意 Markdown 或 HTML。 */
export function parseAnswerEmphasis(content: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let cursor = 0;

  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: content.slice(cursor, index), emphasized: false });
    segments.push({ text: match[1], emphasized: true });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) segments.push({ text: content.slice(cursor), emphasized: false });
  return segments.length ? segments : [{ text: content, emphasized: false }];
}
