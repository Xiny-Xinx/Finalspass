import { NextResponse } from "next/server";
import { getQuota, getClientIP } from "@/lib/rate-limit";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById, checkTierExpiry } from "@/lib/user-store";
import { GUEST_RPM_LIMIT, USER_RPM_LIMIT, DAILY_TOKEN_LIMIT, TIER_LIMITS } from "@/lib/constants";

export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);

    if (auth) {
      // 检查套餐是否到期，到期自动降级
      await checkTierExpiry(auth.userId);
      const user = await getUserById(auth.userId);
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 401 });
      }

      // 查询今日已用
      const redis = await getRedis();
      let dailyUsed = 0;
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (redis) {
        dailyUsed = (await redis.get<number>(`user:daily:${auth.userId}:${dateKey}`)) ?? 0;
      }

      const tier = user.tier ?? "free";
      const tierLimit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

      return NextResponse.json({
        isLoggedIn: true,
        // 兼容前端 QuotaInfo 接口
        used: dailyUsed,
        limit: tierLimit,
        remaining: Math.max(0, tierLimit - dailyUsed),
        resetDate: dateKey,
        enabled: true,
        // 真实数据
        balance: user.balance,
        totalPurchased: user.totalPurchased,
        email: user.email,
        verified: user.verified,
        dailyCap: tierLimit,
        dailyUsed,
        tier,
        tierExpiresAt: user.tierExpiresAt,
        rateLimit: USER_RPM_LIMIT,
      });
    }

    // 未登录：返回 IP-based 每日限额
    const ip = getClientIP(req);
    const quota = await getQuota(ip);
    return NextResponse.json({
      ...quota,
      isLoggedIn: false,
      dailyCap: DAILY_TOKEN_LIMIT,
      rateLimit: GUEST_RPM_LIMIT,
    });
  } catch (err) {
    console.error("[quota] 查询配额失败:", err);
    return NextResponse.json({ error: "查询配额失败" }, { status: 500 });
  }
}
