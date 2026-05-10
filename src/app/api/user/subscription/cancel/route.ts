import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";

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
    } catch { return null; }
  }
  return redisClient;
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await getUserById(auth.userId);
  if (!user || user.tier === "free") {
    return NextResponse.json({ error: "您当前没有订阅套餐" }, { status: 400 });
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return NextResponse.json({ error: "系统错误" }, { status: 500 });
    }

    // 手动激活模式下，取消即降级为免费版
    const userKey = `user:${auth.userId}`;
    const raw = await redis.get<any>(userKey);
    if (raw) {
      const u = typeof raw === "string" ? JSON.parse(raw) : raw;
      u.tier = "free";
      u.tierExpiresAt = null;
      await redis.set(userKey, JSON.stringify(u));
    }

    return NextResponse.json({ success: true, message: "已降级为免费版" });
  } catch (err) {
    console.error("[cancel] 取消失败:", err);
    return NextResponse.json({ error: "取消失败" }, { status: 500 });
  }
}
