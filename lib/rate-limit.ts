import { createHash } from "node:crypto";

export type LimitCode = "rate_limited" | "budget_exhausted";

export type RequestLimitResult =
  | { ok: true; status: "allowed"; tokenReservation: number }
  | { ok: false; status: LimitCode; code: LimitCode; message: string; retryAfterSeconds?: number };

export interface CheckRequestLimitsInput {
  ip: string;
  sessionId: string;
  estimatedTokens?: number;
}

export interface RecordTokenUsageInput {
  actualTokens: number;
  tokenReservation: number;
}

interface RedisClient {
  eval(script: string, keys: string[], args: Array<string | number>): Promise<unknown>;
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

interface RedisModule {
  Redis: new (config: { url: string; token: string }) => RedisClient;
}

interface LocalCounters {
  value: number;
  expiresAt: number;
}

const localCounters = new Map<string, LocalCounters>();
let redisPromise: Promise<RedisClient | null> | null = null;

const LIMIT_SCRIPT = `
local minute = redis.call("INCR", KEYS[1])
if minute == 1 then redis.call("EXPIRE", KEYS[1], ARGV[6]) end
if minute > tonumber(ARGV[1]) then return {1, minute} end

local session = tonumber(redis.call("GET", KEYS[2]) or "0")
if session >= tonumber(ARGV[2]) then return {2, session} end

local requests = tonumber(redis.call("GET", KEYS[3]) or "0")
if requests >= tonumber(ARGV[3]) then return {3, requests} end

local tokens = tonumber(redis.call("GET", KEYS[4]) or "0")
if tokens + tonumber(ARGV[5]) > tonumber(ARGV[4]) then return {4, tokens} end

session = redis.call("INCR", KEYS[2])
requests = redis.call("INCR", KEYS[3])
tokens = redis.call("INCRBY", KEYS[4], ARGV[5])
if session == 1 then redis.call("EXPIRE", KEYS[2], ARGV[7]) end
if requests == 1 then redis.call("EXPIRE", KEYS[3], ARGV[8]) end
if tokens == tonumber(ARGV[5]) then redis.call("EXPIRE", KEYS[4], ARGV[8]) end
return {0, minute, session, requests, tokens}
`;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function limits() {
  return {
    minute: positiveInteger(process.env.RATE_LIMIT_PER_MINUTE, 5),
    session: positiveInteger(process.env.SESSION_QUESTION_LIMIT, 20),
    dailyRequests: positiveInteger(process.env.DAILY_REQUEST_LIMIT, 200),
    dailyTokens: positiveInteger(process.env.DAILY_TOKEN_LIMIT, 300_000),
    reservation: positiveInteger(process.env.TOKEN_RESERVATION, 1_500),
  };
}

async function getRedis(): Promise<RedisClient | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisPromise) {
    redisPromise = import("@upstash/redis")
      .then((module) => {
        const { Redis } = module as unknown as RedisModule;
        return new Redis({ url, token });
      })
      .catch((error: unknown) => {
        console.warn("ask-me-rate-limit: Redis unavailable; using local fallback", error instanceof Error ? error.message : "unknown error");
        return null;
      });
  }
  return redisPromise;
}

function privacyHash(value: string): string {
  const salt = process.env.PRIVACY_HASH_SALT || "ask-me-local-development";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function counterKey(prefix: string, value: string): string {
  return `ask-me:${prefix}:${value}`;
}

function getLocal(key: string, now: number): number {
  const current = localCounters.get(key);
  if (!current || current.expiresAt <= now) {
    localCounters.delete(key);
    return 0;
  }
  return current.value;
}

function setLocal(key: string, value: number, expiresAt: number): void {
  localCounters.set(key, { value, expiresAt });
}

function localCheck(ipHash: string, sessionHash: string, reservation: number, now: number): RequestLimitResult {
  const config = limits();
  const minuteEnd = (Math.floor(now / 60_000) + 1) * 60_000;
  const dayEnd = new Date(new Date(now).toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() + 86_400_000;
  const day = new Date(now).toISOString().slice(0, 10);
  const minuteKey = counterKey("minute", `${Math.floor(now / 60_000)}:${ipHash}`);
  const sessionKey = counterKey("session", sessionHash);
  const requestKey = counterKey("requests", day);
  const tokenKey = counterKey("tokens", day);

  const minuteCount = getLocal(minuteKey, now) + 1;
  setLocal(minuteKey, minuteCount, minuteEnd + 60_000);
  if (minuteCount > config.minute) {
    return { ok: false, status: "rate_limited", code: "rate_limited", message: "请求过于频繁，请稍后再试。", retryAfterSeconds: Math.max(1, Math.ceil((minuteEnd - now) / 1_000)) };
  }
  if (getLocal(sessionKey, now) >= config.session) {
    return { ok: false, status: "rate_limited", code: "rate_limited", message: "当前会话已达到提问上限，请开启新会话。" };
  }
  if (getLocal(requestKey, now) >= config.dailyRequests || getLocal(tokenKey, now) + reservation > config.dailyTokens) {
    return { ok: false, status: "budget_exhausted", code: "budget_exhausted", message: "今日 AI 服务额度已用完，请明天再试。" };
  }

  setLocal(sessionKey, getLocal(sessionKey, now) + 1, now + 30 * 86_400_000);
  setLocal(requestKey, getLocal(requestKey, now) + 1, dayEnd + 86_400_000);
  setLocal(tokenKey, getLocal(tokenKey, now) + reservation, dayEnd + 86_400_000);
  return { ok: true, status: "allowed", tokenReservation: reservation };
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkRequestLimits(input: CheckRequestLimitsInput): Promise<RequestLimitResult> {
  const config = limits();
  const reservation = Math.max(0, Math.min(input.estimatedTokens ?? config.reservation, config.dailyTokens));
  const now = Date.now();
  const ipHash = privacyHash(input.ip || "unknown");
  const sessionHash = privacyHash(input.sessionId || "anonymous");
  const redis = await getRedis();
  if (!redis) return localCheck(ipHash, sessionHash, reservation, now);

  const day = new Date(now).toISOString().slice(0, 10);
  const keys = [
    counterKey("minute", `${Math.floor(now / 60_000)}:${ipHash}`),
    counterKey("session", sessionHash),
    counterKey("requests", day),
    counterKey("tokens", day),
  ];
  try {
    const result = await redis.eval(LIMIT_SCRIPT, keys, [config.minute, config.session, config.dailyRequests, config.dailyTokens, reservation, 120, 30 * 86_400, 2 * 86_400]);
    const values = Array.isArray(result) ? result.map(Number) : [4];
    if (values[0] === 0) return { ok: true, status: "allowed", tokenReservation: reservation };
    if (values[0] === 1) return { ok: false, status: "rate_limited", code: "rate_limited", message: "请求过于频繁，请稍后再试。", retryAfterSeconds: 60 };
    if (values[0] === 2) return { ok: false, status: "rate_limited", code: "rate_limited", message: "当前会话已达到提问上限，请开启新会话。" };
    return { ok: false, status: "budget_exhausted", code: "budget_exhausted", message: "今日 AI 服务额度已用完，请明天再试。" };
  } catch (error) {
    console.warn("ask-me-rate-limit: Redis request failed; using local fallback", error instanceof Error ? error.message : "unknown error");
    return localCheck(ipHash, sessionHash, reservation, now);
  }
}

export async function recordTokenUsage(input: RecordTokenUsageInput): Promise<void> {
  const delta = Math.max(0, Math.floor(input.actualTokens)) - Math.max(0, Math.floor(input.tokenReservation));
  if (delta === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = counterKey("tokens", day);
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.incrby(key, delta);
      await redis.expire(key, 2 * 86_400);
      return;
    } catch (error) {
      console.warn("ask-me-rate-limit: token reconciliation failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  const now = Date.now();
  const current = getLocal(key, now);
  setLocal(key, Math.max(0, current + delta), now + 2 * 86_400_000);
}

export function resetLocalRateLimitsForTests(): void {
  localCounters.clear();
  redisPromise = null;
}
