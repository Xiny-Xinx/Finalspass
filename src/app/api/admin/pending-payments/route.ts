/**
 * 管理员：查看和确认待处理的支付
 *
 * GET  - 列出所有待确认的支付
 * POST - 管理员确认收款（激活套餐或添加额外配额）
 */

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

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || !(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  const ids = await redis.smembers<string[]>("payment_pending_ids");
  const payments: unknown[] = [];

  for (const id of ids) {
    const raw = await redis.get<any>(id);
    if (!raw) continue;
    const payment = typeof raw === "string" ? JSON.parse(raw) : raw;
    payments.push({ id, ...payment });
  }

  // 按时间倒序
  payments.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || !(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  const body = await req.json();
  const { pendingId, action } = body; // action: "confirm" | "reject"

  const raw = await redis.get<any>(pendingId);
  if (!raw) return NextResponse.json({ error: "该记录不存在或已被处理" }, { status: 404 });

  const payment = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (payment.status !== "pending") {
    return NextResponse.json({ error: "该记录已被处理" }, { status: 400 });
  }

  if (action === "reject") {
    payment.status = "rejected";
    await redis.set(pendingId, JSON.stringify(payment));
    await redis.srem("payment_pending_ids", pendingId);
    return NextResponse.json({ success: true, message: "已拒绝" });
  }

  if (action !== "confirm") {
    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  }

  // 确认收款 → 激活
  try {
    if (payment.type === "subscription") {
      // 使用现有 grant-pro 逻辑
      const userKey = `user:${payment.userId}`;
      const userRaw = await redis.get<any>(userKey);
      if (!userRaw) return NextResponse.json({ error: "用户数据异常" }, { status: 500 });

      const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
      user.tier = payment.tier || "pro";
      user.tierExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30天
      user.verified = true;
      await redis.set(userKey, JSON.stringify(user));
    } else if (payment.type === "extra_quota") {
      const extraKey = `extra_quota:${payment.userId}`;
      const current = (await redis.get<number>(extraKey)) ?? 0;
      await redis.set(extraKey, current + (payment.units || 0));
    }

    payment.status = "confirmed";
    await redis.set(pendingId, JSON.stringify(payment));
    await redis.srem("payment_pending_ids", pendingId);

    return NextResponse.json({ success: true, message: `已确认 ${payment.email} 的 ${payment.label}` });
  } catch (err) {
    console.error("[pending-payments] 确认失败:", err);
    return NextResponse.json({ error: "确认失败" }, { status: 500 });
  }
}
