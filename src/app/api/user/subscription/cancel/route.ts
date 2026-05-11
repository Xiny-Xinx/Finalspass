import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

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
