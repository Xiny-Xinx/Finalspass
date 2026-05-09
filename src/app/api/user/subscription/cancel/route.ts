import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { setUserTier, getUserById } from "@/lib/user-store";

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

const LS_BASE = "https://api.lemonsqueezy.com/v1";

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

    // 查找用户的 LS 订阅 ID
    const subscriptionId = await redis.get<string>(`user:sub:${auth.userId}`);
    if (!subscriptionId) {
      // 没有索引，但用户有 tier——可能是在 webhook 到来前手动创建的
      // 先降级，让 LS 那边自然过期
      await setUserTier(auth.userId, "free", null);
      return NextResponse.json({ success: true, note: "已降级（无订阅关联，将在下次续费时彻底取消）" });
    }

    const apiKey = process.env.LS_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "支付系统未配置" }, { status: 500 });
    }

    // 调用 LS API 取消订阅（仅停止自动续费，不立即终止）
    const res = await fetch(`${LS_BASE}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
      },
    });

    // 从 LS 响应中提取 ends_at（当前计费周期结束日期）
    let endsAt: string | null = null;
    if (res.ok) {
      try {
        const json = await res.json();
        endsAt = json.data?.attributes?.ends_at || null;
      } catch {}
    } else {
      const errText = await res.text();
      console.error("[cancel] LS 取消订阅失败:", res.status, errText);

      if (res.status !== 404) {
        // 404 = 已在 LS 侧取消，继续处理
        return NextResponse.json({ error: "取消失败，请稍后重试" }, { status: 500 });
      }
    }

    // 不降级，只更新到期日为用户当前周期的结束日（保留权益至到期）
    if (endsAt) {
      await setUserTier(auth.userId, user.tier, endsAt);
    } else {
      // LS 未返回 ends_at，用当前 tierExpiresAt 继续保留
      // 或按30天估算（以防没有到期日）
      const fallback = user.tierExpiresAt || new Date(Date.now() + 30 * 86400000).toISOString();
      await setUserTier(auth.userId, user.tier, fallback);
    }
    // 清理索引（已取消，不再处理 webhook）
    await redis.del(`user:sub:${auth.userId}`);
    await redis.del(`ls_sub:${subscriptionId}`);

    console.log(`[cancel] 用户 ${auth.userId} 已取消自动续费，${user.tier} 权益保留至 ${endsAt || "原到期日"}`);
    return NextResponse.json({ success: true, endsAt });
  } catch (err) {
    console.error("[cancel] 取消失败:", err);
    return NextResponse.json({ error: "取消失败" }, { status: 500 });
  }
}
