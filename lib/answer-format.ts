export interface AnswerSegment {
  text: string;
  emphasized: boolean;
}

const LOW_INFORMATION_EMPHASIS = new Set([
  "代表项目",
  "用户问题",
  "产品目标",
  "核心项目",
  "我的贡献",
  "方案设计",
  "验证结果",
  "明确贡献",
  "职责边界",
  "分层定位",
  "形成闭环",
  "已有基础",
  "验证方法",
  "产品链路",
  "产品方法",
  "指标设计",
  "评测落地",
  "结果边界",
  "当前产品价值",
  "下一步如何验证",
  "回答层",
  "工程与迭代层",
]);

export function extractAnswerEmphasis(content: string) {
  return [...content.matchAll(/\*\*([^*\n]+)\*\*/g)].map((match) => match[1].trim());
}

/** 加黑内容应独立传达结论、贡献、结果或边界，而不是只充当段落标签。 */
export function isHighSignalEmphasis(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 1
    && !LOW_INFORMATION_EMPHASIS.has(normalized)
    && !/^(?:第[一二三四五六七八九十\d]+步|下一步)(?:是|如何)?/.test(normalized);
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
