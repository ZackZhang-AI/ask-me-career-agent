const minuteBuckets = new Map<string, number[]>();
let dailyCount = 0;
let dailyKey = new Date().toISOString().slice(0, 10);

export function checkRateLimit(ip: string) {
  const now = Date.now();
  const recent = (minuteBuckets.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return { ok: false, status: 429, message: "请求过于频繁，请一分钟后再试。" };
  recent.push(now);
  minuteBuckets.set(ip, recent);

  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyKey) { dailyKey = today; dailyCount = 0; }
  const dailyLimit = Number(process.env.DAILY_REQUEST_LIMIT ?? 200);
  if (dailyCount >= dailyLimit) return { ok: false, status: 503, message: "今日问答预算已用完，请稍后再来。" };
  dailyCount += 1;
  return { ok: true, status: 200, message: "" };
}
