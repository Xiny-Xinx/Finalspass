/**
 * 速率限制模块（基于 Upstash Redis）
 *
 * 滑动窗口算法，用于限制每分钟的请求数。
 * 游客按 IP 限制，已登录用户按 userId 限制。
 */

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
 * 检查是否超出速率限制
 * @param key - Redis key（如 `ratelimit:ip:xxx` 或 `ratelimit:user:xxx`）
 * @param limit - 每分钟允许的最大请求数
 * @returns 是否允许通过
 */
async function checkRate(key: string, limit: number): Promise<{ allowed: boolean; remaining: number }> {
  const redis = await getRedis();
  if (!redis) return { allowed: true, remaining: limit }; // Redis 未配置 → 无限制

  const now = Date.now();
  const windowMs = 60_000; // 1 分钟窗口

  try {
    // 移除窗口外的旧记录
    await redis.zremrangebyscore(key, 0, now - windowMs);
    // 统计当前窗口内的请求数
    const count = await redis.zcard(key);
    // 添加本次请求的时间戳
    await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    // 设置过期（1 分钟无访问后自动清理）
    await redis.expire(key, 60);

    const remaining = Math.max(0, limit - count - 1);
    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining };
  } catch {
    // Redis 出错不阻塞用户
    return { allowed: true, remaining: limit };
  }
}

/** 为游客 IP 创建限速 key */
function ipKey(ip: string): string {
  return `ratelimit:ip:${ip}`;
}

/** 为登录用户创建限速 key */
function userKey(userId: string): string {
  return `ratelimit:user:${userId}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * 检查游客 IP 速率限制
 */
export async function checkGuestRateLimit(ip: string, limit: number): Promise<RateLimitResult> {
  return checkRate(ipKey(ip), limit);
}

/**
 * 检查登录用户速率限制
 */
export async function checkUserRateLimit(userId: string, limit: number): Promise<RateLimitResult> {
  return checkRate(userKey(userId), limit);
}
