/**
 * 统一配额守卫
 *
 * 根据请求是否携带有效 JWT 自动选择：
 *   - 已登录用户 → 检查每日使用上限
 *   - 未登录游客 → 沿用 IP-based 每日限额
 *
 * 用法：
 *   const guard = await withQuota(req);
 *   // ... AI 调用 ...
 *   await guard.deduct(actualTokens);
 */

import { verifyJWT, JwtPayload } from "./auth";
import { getUserById } from "./user-store";
import { checkTokenBudget, recordTokens, getClientIP } from "./rate-limit";
import { checkGuestRateLimit, checkUserRateLimit } from "./rate-limiter";
import {
  MODEL_QUOTA_COST,
  GUEST_RPM_LIMIT,
  USER_RPM_LIMIT,
  TIER_LIMITS,
  TIER_MODEL_CAPS,
  EXTRACT_QUOTA_COST,
  QUIZ_QUOTA_COST,
} from "./constants";

export type QuotaGuard = Awaited<ReturnType<typeof withQuota>>;

/**
 * 解析请求中的 JWT cookie，返回用户信息或 null
 */
export function getAuthUser(req: Request): JwtPayload | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)fp_token=([^;]+)/);
  if (!match) return null;
  return verifyJWT(match[1]);
}

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
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

/**
 * 检查已登录用户每日配额上限
 */
async function getUserDailyCap(userId: string): Promise<number> {
  try {
    const user = await getUserById(userId);
    if (user) return TIER_LIMITS[user.tier] ?? TIER_LIMITS.free;
  } catch {}
  return TIER_LIMITS.free;
}

async function checkUserDailyCap(userId: string):
  Promise<{ usedExtra: boolean; extraRemaining: number }> {
  const redis = await getRedis();
  if (!redis) return { usedExtra: false, extraRemaining: 0 };

  const cap = await getUserDailyCap(userId);
  const key = `user:daily:${userId}:${dateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used < cap) return { usedExtra: false, extraRemaining: 0 };

    // 每日上限已到，检查额外配额
    const extraKey = `extra_quota:${userId}`;
    const extra = (await redis.get<number>(extraKey)) ?? 0;
    if (extra > 0) {
      return { usedExtra: true, extraRemaining: extra };
    }

    throw Object.assign(
      new Error(`今日使用次数已达上限（${cap} 次），可购买额外配额继续使用`),
      { statusCode: 429 }
    );
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
    return { usedExtra: false, extraRemaining: 0 };
  }
}

async function recordUserDailyUsage(userId: string, units: number): Promise<void> {
  const redis = await getRedis();
  if (!redis || units <= 0) return;

  const key = `user:daily:${userId}:${dateKey()}`;
  try {
    const ttl = await redis.ttl(key);
    if (ttl === -2) {
      await redis.set(key, units, { ex: 86400 });
    } else {
      await redis.incrby(key, units);
    }
  } catch {}
}

function dateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 检查指定模型是否超出每日调用次数上限
 */
async function checkModelCap(userId: string, tier: string, modelId: string): Promise<void> {
  const cap = TIER_MODEL_CAPS[tier]?.[modelId];
  if (!cap) return; // 无上限

  const redis = await getRedis();
  if (!redis) return;

  const key = `user:daily:model:${userId}:${dateKey()}:${modelId}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used >= cap) {
      throw Object.assign(
        new Error(`今日 ${modelId} 模型调用已达上限（${cap} 次），请明日再试`),
        { statusCode: 429 }
      );
    }
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
  }
}

/** 根据模型 ID 获取单次请求的配额成本 */
export function getQuotaCost(model?: string): number {
  if (model && MODEL_QUOTA_COST[model]) return MODEL_QUOTA_COST[model];
  return 1;
}

/**
 * 在 AI 调用前检查配额，返回 deduct 函数用于调用后扣减配额
 */
export async function withQuota(req: Request) {
  const ip = getClientIP(req);
  const auth = getAuthUser(req);

  if (auth) {
    const rateCheck = await checkUserRateLimit(auth.userId, USER_RPM_LIMIT);
    if (!rateCheck.allowed) {
      throw Object.assign(new Error("请求过于频繁，请稍后再试"), { statusCode: 429 });
    }

    const user = await getUserById(auth.userId);
    if (!user) {
      throw Object.assign(new Error("用户不存在"), { statusCode: 401 });
    }

    const tier = user.tier;

    const dailyCheck = await checkUserDailyCap(auth.userId);
    const usingExtra = dailyCheck.usedExtra;

    return {
      userId: auth.userId,
      ip,
      isLoggedIn: true as const,
      tier,
      /** 调用 AI 前检查该模型今日是否已达上限 */
      checkModelCap: async (modelId: string) => checkModelCap(auth.userId, tier, modelId),
      /** AI 调用后，记录每日用量（超额时从额外配额扣减） */
      deduct: async (units: number, modelId?: string) => {
        if (units > 0) {
          if (usingExtra) {
            // 超额使用：从 extra_quota 扣减，不记入日用量
            const redis = await getRedis();
            if (redis) {
              const ek = `extra_quota:${auth.userId}`;
              const cur = (await redis.get<number>(ek)) ?? 0;
              if (cur >= units) await redis.set(ek, cur - units);
            }
          } else {
            // 正常使用：记入日用量
            await recordUserDailyUsage(auth.userId, units);
          }
          // 模型专用计数器（不论是否超额都记）
          if (modelId) {
            const mk = `user:daily:model:${auth.userId}:${dateKey()}:${modelId}`;
            const redis = await getRedis();
            if (redis) {
              try {
                const ttl = await redis.ttl(mk);
                if (ttl === -2) await redis.set(mk, 1, { ex: 86400 });
                else await redis.incrby(mk, 1);
              } catch {}
            }
          }
        }
      },
    };
  }

  // ── 未登录游客 ──
  const guestRateCheck = await checkGuestRateLimit(ip, GUEST_RPM_LIMIT);
  if (!guestRateCheck.allowed) {
    throw Object.assign(new Error("请求过于频繁，请稍后再试"), { statusCode: 429 });
  }

  await checkTokenBudget(ip);

  return {
    userId: null,
    ip,
    isLoggedIn: false as const,
    checkModelCap: async () => {},
    deduct: async (units: number) => {
      if (units > 0) {
        await recordTokens(ip, units * 1000);
      }
    },
  };
}
