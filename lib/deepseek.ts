import type { ChatMessage } from "./types";

export class DeepSeekUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "DeepSeekUpstreamError";
  }
}

interface GenerateInput {
  apiKey: string;
  messages: Array<ChatMessage | { role: "system"; content: string }>;
  signal: AbortSignal;
}

export async function generateDeepSeekAnswer(input: GenerateInput) {
  const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: input.messages,
      thinking: { type: "disabled" },
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 1_100,
    }),
    signal: input.signal,
  });

  if (!response.ok || !response.body) {
    throw new DeepSeekUpstreamError(response.status, "模型服务返回异常");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let totalTokens = 0;

  const consume = (row: string) => {
    if (!row.startsWith("data:")) return;
    const data = row.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data);
      text += payload.choices?.[0]?.delta?.content ?? "";
      if (payload.usage?.total_tokens) totalTokens = Number(payload.usage.total_tokens);
    } catch {
      // Keep-alive 与不完整帧不属于回答内容。
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) consume(row);
  }
  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer.trim());

  if (!text.trim()) throw new DeepSeekUpstreamError(502, "模型返回空回答");
  return { text: text.trim(), totalTokens };
}
