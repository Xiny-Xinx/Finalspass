/**
 * 用户提交支付确认（支付宝绑定手机号）
 *
 * 用户在扫码付款后，填写 Alipay 绑定的手机号提交到后台，
 * 管理员在后台看到手机号后，核对自己支付宝收款记录，确认后手动激活。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const schema = z.object({
  type: z.enum(["subscription", "extra_quota"]),
  tier: z.enum(["pro", "premium"]).optional(),
  units: z.number().int().positive().optional(),
  amount: z.number().positive(),
  phone: z.string().min(5).max(20),
});

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const redis = await getRedis();
  if (!redis) {
    return NextResponse.json({ error: "系统错误" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { type, tier, units, amount, phone } = schema.parse(body);

    // 获取用户邮箱
    const raw = await redis.get<any>(`user:${auth.userId}`);
    const user = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    const email = user?.email || auth.email;

    const pending: Record<string, unknown> = {
      userId: auth.userId,
      email,
      phone,
      type,
      amount,
      timestamp: Date.now(),
      status: "pending",
    };

    if (type === "subscription" && tier) {
      pending.tier = tier;
      pending.label = tier === "pro" ? "Pro 套餐" : "Premium 套餐";
    } else if (type === "extra_quota" && units) {
      pending.units = units;
      pending.label = `额外配额 ${units} 次`;
    }

    // 存储到 Redis
    const pendingId = `payment_pending:${auth.userId}:${Date.now()}`;
    await redis.set(pendingId, JSON.stringify(pending));
    await redis.sadd("payment_pending_ids", pendingId);

    return NextResponse.json({ success: true, message: "提交成功，请等待管理员确认" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    console.error("[payment-confirm] 错误:", error);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
