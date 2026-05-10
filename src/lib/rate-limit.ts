/**
 * 用量限额模块（基于 Upstash Redis）
 *
 * 每个 IP 每天限制一定的 API Token 消耗量。
 * 当 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 未配置时自动降级为无限制。
 */

import { TIER_LIMITS, QUOTA_WINDOW_HOURS } from "./constants";

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

/** Token 过期时间(秒) = 24 小时（随窗口配置） */
function windowTTL(): number {
  return Math.max(QUOTA_WINDOW_HOURS, 1) * 3600;
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

/**
 * 检查是否超出 Token 预算，超限则抛 429
 * @param minRemaining - 要求至少剩余多少 token（预检用），默认 0
 */
export async function checkTokenBudget(ip: string, minRemaining: number = 0): Promise<void> {
  const redis = await getRedis();
  if (!redis) return; // Redis 未配置 → 无限制

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = TIER_LIMITS.free - used;
    if (remaining <= 0) {
      throw Object.assign(
        new Error(
          `今日免费额度已用完（${TIER_LIMITS.free.toLocaleString()}），请登录后使用或明日再试`
        ),
        { statusCode: 429 }
      );
    }
    if (remaining < minRemaining) {
      throw Object.assign(
        new Error(
          `免费额度不足（剩余 ${remaining.toLocaleString()}，至少需要 ${minRemaining.toLocaleString()}），请登录后使用`
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
      // key 不存在 → 新建并设过期（QUOTA_WINDOW_HOURS 小时后自动重置）
      await redis.set(key, tokens, { ex: windowTTL() });
    } else {
      await redis.incrby(key, tokens);
    }
  } catch (err) {
    console.error("[rate-limit] recordTokens error:", err);
  }
}

/** 手动重置当前 IP 的配额（删除 Redis key） */
export async function resetQuota(ip: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error("[rate-limit] resetQuota error:", err);
    return false;
  }
}

/** 查询当前配额使用情况（token 维度） */
export async function getQuota(ip: string): Promise<QuotaInfo> {
  const redis = await getRedis();
  if (!redis) {
    return {
      used: 0,
      limit: TIER_LIMITS.free,
      remaining: TIER_LIMITS.free,
      resetDate: getDateKey(),
      enabled: false,
    };
  }

  const key = `tokens:${ip}:${getDateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    return {
      used,
      limit: TIER_LIMITS.free,
      remaining: Math.max(0, TIER_LIMITS.free - used),
      resetDate: getDateKey(),
      enabled: true,
    };
  } catch {
    return {
      used: 0,
      limit: TIER_LIMITS.free,
      remaining: TIER_LIMITS.free,
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
