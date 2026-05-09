/**
 * 用量限额模块（基于 Upstash Redis）
 *
 * 每个 IP 每天限制一定数量的 AI 请求。
 * 当 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 未配置时自动降级为无限制。
 */

import { DAILY_QUOTA_LIMIT } from "./constants";

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

/** 检查是否超限，超限则抛错 */
export async function checkQuota(ip: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return; // Redis 未配置 → 无限制

  const key = `ratelimit:${ip}:${getDateKey()}`;
  try {
    const count = (await redis.get<number>(key)) ?? 0;
    if (count >= DAILY_QUOTA_LIMIT) {
      throw Object.assign(new Error(`今日 AI 调用次数已达上限（${DAILY_QUOTA_LIMIT} 次），${getDateKey()} 重置`), {
        statusCode: 429,
      });
    }
    await redis.incr(key);
    if (count === 0) {
      await redis.expire(key, secondsUntilEndOfDay());
    }
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
    console.error("[rate-limit] Redis error:", err);
    // Redis 出错不阻塞用户
  }
}

/** 查询当前配额使用情况 */
export async function getQuota(ip: string): Promise<QuotaInfo> {
  const redis = await getRedis();
  if (!redis) {
    return { used: 0, limit: DAILY_QUOTA_LIMIT, remaining: DAILY_QUOTA_LIMIT, resetDate: getDateKey(), enabled: false };
  }

  const key = `ratelimit:${ip}:${getDateKey()}`;
  try {
    const count = (await redis.get<number>(key)) ?? 0;
    return {
      used: count,
      limit: DAILY_QUOTA_LIMIT,
      remaining: Math.max(0, DAILY_QUOTA_LIMIT - count),
      resetDate: getDateKey(),
      enabled: true,
    };
  } catch {
    return { used: 0, limit: DAILY_QUOTA_LIMIT, remaining: DAILY_QUOTA_LIMIT, resetDate: getDateKey(), enabled: false };
  }
}
