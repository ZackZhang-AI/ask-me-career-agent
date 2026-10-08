import { mkdir, writeFile } from "node:fs/promises";

// 手动发布验收脚本；不在生产日志记录原始问题或回答。
const questions = [
  "请用 60 秒介绍张倬玮。", "你目前在哪实习？", "请介绍一下 DiVA 营销素材工作台。",
  "你在 DiVA 中具体负责什么？", "请介绍一下机票竞品比价 Skill。", "你在比价 Skill 中具体负责什么？",
  "你在百度实习中具体负责什么？ ”", "请介绍一下你的百川智能实习。",
  "你的实习和项目是如何串联起来的？", "你为什么适合 AI 产品经理岗位？",
  "DiVA 为什么要保留人工审核，不能全部自动化吗？", "DiVA 的主视觉、元素复用和广告位适配分别解决什么问题？",
  "比价 Skill 中覆盖率和低价率有什么不同？", "如果机票数据缺少价格，你会怎么处理？",
  "DiVA 的 80% 通过率分母到底是多少？", "你们已经把素材全部投放并提升转化了吗？",
  "你的专业对做 AI 产品有什么帮助？", "为什么从财会和审计转向 AI 产品？",
  "AI 写了代码，你的价值在哪里？", "滴滴这段经历如何帮助你做业务型 AI 产品？",
];
const base = process.env.CONTENT_CHECK_BASE_URL?.replace(/\/$/, "");
if (!base) throw new Error("需要 CONTENT_CHECK_BASE_URL 指定本地或 Preview 地址");
const limit = Number(process.env.CONTENT_CHECK_LIMIT) || questions.length;
const report: Array<Record<string, unknown>> = [];
for (const [index, question] of questions.slice(0, limit).entries()) {
  const started = performance.now();
  const events: Array<Record<string, unknown>> = [];
  let firstDeltaMs: number | null = null;
  let firstStageMs: number | null = null;
  let httpStatus = 0;
  let failure: string | undefined;
  try {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST", signal: AbortSignal.timeout(120_000),
      headers: { "Content-Type": "application/json", ...(process.env.VERCEL_OIDC_TOKEN ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN } : {}) },
      body: JSON.stringify({ sessionId: `content-check-${Date.now()}-${index}`, messages: [{ role: "user", content: question }] }),
    });
    httpStatus = response.status;
    if (!response.ok || !response.body) throw new Error(`http_${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    const accept = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as Record<string, unknown>;
      events.push(event);
      if (event.type === "stage" && firstStageMs === null) firstStageMs = Math.round(performance.now() - started);
      if (event.type === "delta" && firstDeltaMs === null) firstDeltaMs = Math.round(performance.now() - started);
    };
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      lines.forEach(accept);
    }
    pending += decoder.decode();
    accept(pending);
  } catch (error) { failure = error instanceof Error ? error.message : "request_failed"; }
  const done = events.findLast((event) => event.type === "done");
  const answer = events.filter((event) => event.type === "delta").map((event) => String(event.content ?? "")).join("");
  const passed = Boolean(done && answer.trim() && !events.some((event) => event.type === "error") && done.responseStatus !== "upstream_error");
  const result = { index: index + 1, question, httpStatus, passed, failure, firstStageMs, firstDeltaMs, completedMs: Math.round(performance.now() - started), answer, done };
  report.push(result);
  console.info(JSON.stringify({ ...result, question: undefined, answer: undefined, done: undefined, deliveryMode: done?.deliveryMode, modelPath: done?.modelPath }));
  await mkdir("output", { recursive: true });
  await writeFile("output/content-update-preview.json", JSON.stringify(report, null, 2));
  // 不重试鉴权错误，也不绕过项目的请求频率限制。
  if ([401, 403, 429].includes(httpStatus)) break;
}
if (report.length !== Math.min(limit, questions.length) || report.some((row) => !row.passed)) process.exitCode = 1;
