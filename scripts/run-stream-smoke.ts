import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route.ts";

const questions = [
  "你之前的经历都对你求职 AI 有什么帮助？",
  "你有什么作用？",
  "你可以干什么？",
  "为什么要转型 AI 产品？",
  "你和商业化产品经理这个岗有什么匹配之处？",
  "如果模型效果和用户体验发生冲突，你会怎么处理？",
  "你平时如何面对压力和不确定性？",
  "如果资源突然减半，你会怎么排优先级？",
  "你如何理解产品经理在跨团队协作中的作用？",
  "假设需求方和研发对方案有分歧，你会如何推进？",
  "你有什么兴趣爱好？",
  "你有经过验证的商业化结果吗？",
  "你在百度实习中具体负责了哪些工作？",
  "RAG 项目最难的取舍是什么？",
  "你能回答没有标准答案的问题吗？",
  "你是谁？",
  "请你用 60 秒做自我介绍。",
  "哪个项目最能代表你的 AI 产品能力？",
  "如何证明自动评测结果可信？",
  "如果需求不清，你会怎么处理？",
  "你可以帮面试官了解什么？",
  "审计经历如何帮助你理解企业产品？",
  "你与搜索产品经理岗位有哪些契合点？",
  "项目形成真实用户规模了吗？",
  "如果只能保留一个功能，你会如何取舍？",
  "你如何看待 AI 产品中的人工确认？",
  "你如何处理跨团队沟通中的冲突？",
  "为什么选择 AI 产品而不是继续做审计？",
  "你之前的统计学训练如何支持产品决策？",
  "当前项目已经正式商业化了吗？",
] as const;
const selectedIndex = Number(process.env.SMOKE_INDEX);
const questionEntries = Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= questions.length
  ? [[selectedIndex - 1, questions[selectedIndex - 1]] as const]
  : questions.map((question, index) => [index, question] as const);

async function readEvents(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return { events: [], firstDeltaMs: null };
  const decoder = new TextDecoder();
  const startedAt = Date.now();
  let buffer = "";
  let firstDeltaMs: number | null = null;
  const events: Array<Record<string, unknown>> = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) {
      if (!row.trim()) continue;
      const event = JSON.parse(row) as Record<string, unknown>;
      events.push(event);
      if (firstDeltaMs === null && event.type === "delta") firstDeltaMs = Date.now() - startedAt;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) events.push(JSON.parse(buffer) as Record<string, unknown>);
  return { events, firstDeltaMs };
}

const boundaryIndexes = new Set([10]);
const realtimeIndexes = new Set([0, 3, 4, 5, 6, 7, 8, 9, 18, 19, 22, 24, 25, 26, 27, 28]);
let failures = 0;
const failureDetails: Array<Record<string, unknown>> = [];
const modes = new Map<string, number>();
const firstDeltaLatencies: number[] = [];

for (const [index, question] of questionEntries) {
  let result = { events: [] as Array<Record<string, unknown>>, firstDeltaMs: null as number | null };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await POST(new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${index + 1}` },
      body: JSON.stringify({ sessionId: `stream-smoke-${index}-${attempt}`, messages: [{ role: "user", content: question }] }),
    }));
    result = await readEvents(response);
    const done = result.events.at(-1);
    const retryable = done?.type === "error" || done?.responseStatus === "upstream_error";
    if (!retryable || attempt === 1) break;
  }
  if (process.env.SMOKE_VERBOSE === "1" && Number(process.env.SMOKE_INDEX) === index + 1) {
    console.info(JSON.stringify({ index: index + 1, events: result.events }));
  }
  const done = result.events.at(-1);
  const answer = result.events.filter((event) => event.type === "delta").map((event) => String(event.content ?? "")).join("");
  const deliveryMode = String(done?.deliveryMode ?? "unknown");
  modes.set(deliveryMode, (modes.get(deliveryMode) ?? 0) + 1);
  if (result.firstDeltaMs !== null) firstDeltaLatencies.push(result.firstDeltaMs);
  const completed = done?.type === "done" && String(done.responseStatus) === "completed" && answer.trim().length > 0;
  const expectedBoundary = boundaryIndexes.has(index);
  const validBoundary = expectedBoundary && done?.type === "done" && answer.trim().length > 0;
  const validOpen = expectedBoundary ? validBoundary : completed;
  const validRealtime = realtimeIndexes.has(index) ? deliveryMode === "realtime_stream" && result.firstDeltaMs !== null : true;
  if (!validOpen || !validRealtime) {
    failures += 1;
    failureDetails.push({ index: index + 1, responseStatus: done?.responseStatus, deliveryMode, modelPath: done?.modelPath, answerLength: answer.length, firstDeltaMs: result.firstDeltaMs });
  }
}

const sortedLatencies = [...firstDeltaLatencies].sort((left, right) => left - right);
const p50 = sortedLatencies.length ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] : null;
const p95 = sortedLatencies.length ? sortedLatencies[Math.min(sortedLatencies.length - 1, Math.ceil(sortedLatencies.length * 0.95) - 1)] : null;
console.info(JSON.stringify({ total: questionEntries.length, failures, failureDetails, deliveryModes: Object.fromEntries(modes), firstDeltaP50Ms: p50, firstDeltaP95Ms: p95 }));
if (failures) process.exitCode = 1;
