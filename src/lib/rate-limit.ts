/**
 * 用量限额模块（基于 Upstash Redis）
 *
 * 每个 IP 每天限制一定的 API Token 消耗量。
 * 当 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 未配置时自动降级为无限制。
 */

import { DAILY_TOKEN_LIMIT } from "./constants";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis(): Promise<typeof redisClient> {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return redisClient;
}

function getDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 到当日 23:59:59 的秒数 */
function secondsUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  enabled: boolean;
}

/** 从请求头中提取客户端 IP */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

/** 检查是否超出 Token 预算，超限则抛 429 */
export async function checkTokenBudget(ip: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return; // Redis 未配置 → 无限制

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used >= DAILY_TOKEN_LIMIT) {
      throw Object.assign(
        new Error(
          `今日 API Token 用量已达上限（${DAILY_TOKEN_LIMIT.toLocaleString()}），${getDateKey()} 重置`
        ),
        { statusCode: 429 }
      );
    }
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
    console.error("[rate-limit] Redis error:", err);
    // Redis 出错不阻塞用户
  }
}

/** 记录本次消耗的 token 数 */
export async function recordTokens(ip: string, tokens: number): Promise<void> {
  const redis = await getRedis();
  if (!redis || tokens <= 0) return;

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    const ttl = await redis.ttl(key);
    if (ttl === -2) {
      // key 不存在 → 新建并设过期（到当日午夜）
      await redis.set(key, tokens, { ex: secondsUntilEndOfDay() });
    } else {
      await redis.incrby(key, tokens);
    }
  } catch (err) {
    console.error("[rate-limit] recordTokens error:", err);
  }
}

/** 查询当前配额使用情况（token 维度） */
export async function getQuota(ip: string): Promise<QuotaInfo> {
  const redis = await getRedis();
  if (!redis) {
    return {
      used: 0,
      limit: DAILY_TOKEN_LIMIT,
      remaining: DAILY_TOKEN_LIMIT,
      resetDate: getDateKey(),
      enabled: false,
    };
  }

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    return {
      used,
      limit: DAILY_TOKEN_LIMIT,
      remaining: Math.max(0, DAILY_TOKEN_LIMIT - used),
      resetDate: getDateKey(),
      enabled: true,
    };
  } catch {
    return {
      used: 0,
      limit: DAILY_TOKEN_LIMIT,
      remaining: DAILY_TOKEN_LIMIT,
      resetDate: getDateKey(),
      enabled: false,
    };
  }
}

/**
 * 诊断函数：返回环境变量的存在状态和 Redis 连接测试结果
 * 仅在 /api/quota 中调用，帮助排查部署问题
 */
export async function diagnoseQuota(): Promise<Record<string, any>> {
  const urlExists = !!process.env.UPSTASH_REDIS_REST_URL;
  const tokenExists = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const urlPrefix = process.env.UPSTASH_REDIS_REST_URL
    ? process.env.UPSTASH_REDIS_REST_URL.substring(0, 20) + "..."
    : null;
  const tokenPrefix = process.env.UPSTASH_REDIS_REST_TOKEN
    ? process.env.UPSTASH_REDIS_REST_TOKEN.substring(0, 8) + "..."
    : null;

  let connectionTest: string | null = null;
  if (urlExists && tokenExists) {
    try {
      const { Redis } = await import("@upstash/redis");
      const testClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await testClient.set("__diag__", "ok", { ex: 60 });
      const val = await testClient.get("__diag__");
      connectionTest = val === "ok" ? "OK" : `unexpected value: ${val}`;
    } catch (e: any) {
      connectionTest = `FAILED: ${e?.message ?? e}`;
    }
  }

  return {
    env: {
      UPSTASH_REDIS_REST_URL: urlExists,
      UPSTASH_REDIS_REST_TOKEN: tokenExists,
    },
    preview: {
      UPSTASH_REDIS_REST_URL: urlPrefix,
      UPSTASH_REDIS_REST_TOKEN: tokenPrefix,
    },
    connectionTest,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
  };
}
