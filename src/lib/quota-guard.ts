/**
 * 统一配额守卫
 *
 * 根据请求是否携带有效 JWT 自动选择：
 *   - 已登录用户 → 从余额扣减 tokens（附带每日上限和速率限制）
 *   - 未登录游客 → 沿用 IP-based 每日限额（附带速率限制）
 *
 * 每次请求执行三层检查：
 *   1. 速率限制（RPM）
 *   2. 最低 token 预检（防止余额/限额极低时仍发起请求）
 *   3. 配额/余额检查
 *
 * 用法：
 *   const guard = await withQuota(req);
 *   // ... AI 调用 ...
 *   await guard.deduct(actualTokens);
 */

import { verifyJWT, JwtPayload } from "./auth";
import { deductUserBalance, getUserById } from "./user-store";
import { checkTokenBudget, recordTokens, getClientIP } from "./rate-limit";
import { checkGuestRateLimit, checkUserRateLimit } from "./rate-limiter";
import {
  MIN_REQUEST_TOKENS,
  USER_DAILY_CAP,
  GUEST_RPM_LIMIT,
  USER_RPM_LIMIT,
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
 * 检查已登录用户每日 token 消耗上限
 */
async function checkUserDailyCap(userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = `user:daily:${userId}:${dateKey()}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used >= USER_DAILY_CAP) {
      throw Object.assign(
        new Error(`今日 Token 消耗已达上限（${USER_DAILY_CAP.toLocaleString()}），请明日再试`),
        { statusCode: 429 }
      );
    }
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
    // Redis 出错不阻塞
  }
}

/**
 * 记录已登录用户每日 token 消耗
 */
async function recordUserDailyUsage(userId: string, tokens: number): Promise<void> {
  const redis = await getRedis();
  if (!redis || tokens <= 0) return;

  const key = `user:daily:${userId}:${dateKey()}`;
  try {
    const ttl = await redis.ttl(key);
    if (ttl === -2) {
      await redis.set(key, tokens, { ex: 86400 }); // 24 小时过期
    } else {
      await redis.incrby(key, tokens);
    }
  } catch {
    // 静默
  }
}

function dateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 在 AI 调用前检查配额，返回一个 deduct 函数用于调用后扣除
 *
 * 三层检查：
 *   1. 速率限制
 *   2. 最低 token 预检（至少 MIN_REQUEST_TOKENS）
 *   3. 余额/限额检查
 */
export async function withQuota(req: Request) {
  const ip = getClientIP(req);
  const auth = getAuthUser(req);

  if (auth) {
    // ── 已登录用户 ──
    // 1. 速率限制
    const rateCheck = await checkUserRateLimit(auth.userId, USER_RPM_LIMIT);
    if (!rateCheck.allowed) {
      throw Object.assign(
        new Error("请求过于频繁，请稍后再试"),
        { statusCode: 429 }
      );
    }

    // 2. 查用户
    const user = await getUserById(auth.userId);
    if (!user) {
      throw Object.assign(new Error("用户不存在"), { statusCode: 401 });
    }

    // 3. 预检：余额是否至少能支付一次最低请求
    if (user.balance < MIN_REQUEST_TOKENS) {
      throw Object.assign(
        new Error(`Token 余额不足（剩余 ${user.balance.toLocaleString()}），请充值`),
        { statusCode: 402 }
      );
    }

    // 4. 每日上限检查
    await checkUserDailyCap(auth.userId);

    return {
      userId: auth.userId,
      ip,
      isLoggedIn: true as const,
      /** AI 调用后，扣除实际消耗的 token 数 */
      deduct: async (tokens: number) => {
        if (tokens > 0) {
          // 原子扣减
          const result = await deductUserBalance(auth.userId, tokens);
          if (!result.ok) {
            console.error(`[quota] 扣减失败 userId=${auth.userId} tokens=${tokens}: ${result.error}`);
          }
          // 记录每日消耗
          await recordUserDailyUsage(auth.userId, tokens);
        }
      },
    };
  }

  // ── 未登录游客 ──
  // 1. 速率限制
  const guestRateCheck = await checkGuestRateLimit(ip, GUEST_RPM_LIMIT);
  if (!guestRateCheck.allowed) {
    throw Object.assign(
      new Error("请求过于频繁，请稍后再试"),
      { statusCode: 429 }
    );
  }

  // 2. 预检：每日限额是否还有至少 MIN_REQUEST_TOKENS
  const quota = await checkTokenBudget(ip, MIN_REQUEST_TOKENS);

  return {
    userId: null,
    ip,
    isLoggedIn: false as const,
    deduct: async (tokens: number) => {
      if (tokens > 0) {
        await recordTokens(ip, tokens);
      }
    },
  };
}
