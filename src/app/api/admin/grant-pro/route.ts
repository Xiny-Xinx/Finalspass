import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redisClient;
}

async function isAdmin(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const redis = await getRedis();
  if (!redis) return false;
  const raw = await redis.get<any>(`user:${userId}`);
  if (!raw) return false;
  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  return user.email === adminEmail;
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || !(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { email } = body;
  if (!email) return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  // 查找用户
  const userId = await redis.get<string>(`user:email:${email.toLowerCase().trim()}`);
  if (!userId) return NextResponse.json({ error: "该邮箱未注册" }, { status: 404 });

  const raw = await redis.get<any>(`user:${userId}`);
  if (!raw) return NextResponse.json({ error: "用户数据异常" }, { status: 500 });

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  user.tier = "pro";
  user.tierExpiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
  user.verified = true;

  await redis.set(`user:${userId}`, JSON.stringify(user));
  return NextResponse.json({ success: true, email, tier: "pro" });
}
