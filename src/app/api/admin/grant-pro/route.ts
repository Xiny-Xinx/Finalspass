import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

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
  const { email, days, tier } = body;
  if (!email) return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
  const targetTier = tier === "premium" ? "premium" : "pro";

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  // 查找用户
  const userId = await redis.get<string>(`user:email:${email.toLowerCase().trim()}`);
  if (!userId) return NextResponse.json({ error: "该邮箱未注册" }, { status: 404 });

  const raw = await redis.get<any>(`user:${userId}`);
  if (!raw) return NextResponse.json({ error: "用户数据异常" }, { status: 500 });

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  user.tier = "pro";
  const grantDays = Math.min(Math.max(days || 365, 1), 3650);
  user.tier = targetTier;
  user.tierExpiresAt = new Date(Date.now() + grantDays * 86400000).toISOString();
  user.verified = true;

  // days=0 仅为查询用户信息，不实际修改
  if (days === 0) {
    return NextResponse.json({
      email: user.email,
      username: user.username,
      tier: user.tier,
      verified: user.verified,
      tierExpiresAt: user.tierExpiresAt,
      createdAt: user.createdAt,
    });
  }

  await redis.set(`user:${userId}`, JSON.stringify(user));
  return NextResponse.json({ success: true, email, tier: targetTier, days: grantDays });
}
