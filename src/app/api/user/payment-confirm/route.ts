/**
 * 用户提交支付确认（支付宝绑定手机号）
 *
 * 用户在扫码付款后，填写 Alipay 绑定的手机号提交到后台，
 * 管理员在后台看到手机号后，核对自己支付宝收款记录，确认后手动激活。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { sendEmail } from "@/lib/email";

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

    // 邮件通知管理员（await 确保 Vercel serverless 不截断请求）
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const amountStr = `¥${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
      try {
        await sendEmail({
          to: adminEmail,
          subject: `💰 支付确认 - ${email} - ${amountStr}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#2563eb">新支付确认</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#666">用户</td><td><strong>${email}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">商品</td><td><strong>${pending.label}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">金额</td><td><strong>${amountStr}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">支付宝手机号</td><td><strong>${phone}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">提交时间</td><td>${new Date().toLocaleString("zh-CN")}</td></tr>
  </table>
  <p style="color:#666;font-size:0.85rem;margin:16px 0">请核对支付宝收款记录中的手机号和金额，确认无误后前往后台激活。</p>
  <a href="https://finalspass.top/login?redirect=/admin/messages" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:0.85rem">前往后台激活 →</a>
</div>`,
        });
        console.log("[payment-confirm] 邮件通知成功");
      } catch (err) {
        console.error("[payment-confirm] 邮件通知失败:", err);
      }
    }

    return NextResponse.json({ success: true, message: "提交成功，请等待管理员确认" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    console.error("[payment-confirm] 错误:", error);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
