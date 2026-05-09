/**
 * 套餐订阅 API（Lemon Squeezy）
 *
 * 流程：
 *   1. 创建订单记录 → 标记 pending
 *   2. 调用 LS Checkout API 创建结账会话
 *   3. 返回 redirectUrl，前端跳转到 LS 支付页
 *
 * 用户完成支付后，LS 异步通知 /api/lemonsqueezy/webhook 完成升级。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { createCheckout, isLsConfigured } from "@/lib/lemonsqueezy";
import { createOrder } from "@/lib/order-store";
import { TIER_PRICES } from "@/lib/constants";

const TIER_LABEL: Record<string, string> = {
  pro: "Pro",
  premium: "Premium",
};

/** 各套餐对应的 LS Variant ID（在 LS 后台 Product Variants 获取） */
const TIER_VARIANT: Record<string, string> = {
  pro: process.env.LS_VARIANT_PRO || "",
  premium: process.env.LS_VARIANT_PREMIUM || "",
};

const schema = z.object({
  tier: z.enum(["pro", "premium"]),
});

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isLsConfigured()) {
    return NextResponse.json(
      { error: "支付系统尚未配置" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { tier } = schema.parse(body);

    const amount = TIER_PRICES[tier];
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "无效套餐" }, { status: 400 });
    }

    // 创建订单
    const order = await createOrder({
      userId: auth.userId,
      type: "subscription",
      amount,
      tier,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/payment/result?out_trade_no=${order.outTradeNo}`;

    // 检查对应套餐的 Variant ID 是否配置
    const variantId = TIER_VARIANT[tier];
    if (!variantId) {
      return NextResponse.json({ error: "套餐支付配置未完成" }, { status: 500 });
    }

    // 创建 LS Checkout（使用套餐各自的固定价格 Variant，不传 custom_price）
    const checkout = await createCheckout(
      undefined, // 使用 variant 固定价格
      `${TIER_LABEL[tier]} 套餐 · 月付`,
      `${TIER_LABEL[tier]} 套餐，30 天有效期`,
      {
        user_id: auth.userId,
        type: "subscription",
        tier,
        out_trade_no: order.outTradeNo,
      },
      redirectUrl,
      variantId
    );

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      redirectUrl: checkout.url,
      outTradeNo: order.outTradeNo,
      tier,
      amount,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[subscription] 创建订单失败:", error);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}
