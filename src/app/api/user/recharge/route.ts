/**
 * 充值接口（Lemon Squeezy）
 *
 * 流程：
 *   1. 创建订单记录 → 标记 pending
 *   2. 调用 LS Checkout API 创建结账会话
 *   3. 返回 redirectUrl，前端跳转到 LS 支付页
 *
 * 用户完成支付后，LS 异步通知 /api/lemonsqueezy/webhook 完成入账。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { createCheckout, isLsConfigured } from "@/lib/lemonsqueezy";
import { createOrder } from "@/lib/order-store";
import { TOP_UP_RATE } from "@/lib/constants";

const schema = z.object({
  tokens: z.number().int().positive("充值数量必须大于 0"),
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
    const { tokens } = schema.parse(body);

    // 计算价格（美元，精确到分）
    const amount = parseFloat(((tokens / 1000000) * TOP_UP_RATE).toFixed(2));
    if (amount < 0.5) {
      return NextResponse.json(
        { error: "最低充值 $0.50" },
        { status: 400 }
      );
    }

    // 创建订单
    const order = await createOrder({
      userId: auth.userId,
      type: "recharge",
      amount,
      tokens,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/payment/result?out_trade_no=${order.outTradeNo}`;

    // 创建 LS Checkout（需要先在 LS 后台创建充值专用的 Variable Pricing Variant）
    const rechargeVariantId = process.env.LS_VARIANT_RECHARGE || "";
    const checkout = await createCheckout(
      Math.round(amount * 100), // 美分
      `FinalsPass 充值 ${tokens.toLocaleString()} tokens`,
      `充值 ${tokens.toLocaleString()} tokens，余额永不过期`,
      {
        user_id: auth.userId,
        type: "recharge",
        tokens: String(tokens),
        out_trade_no: order.outTradeNo,
      },
      redirectUrl,
      rechargeVariantId
    );

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      redirectUrl: checkout.url,
      outTradeNo: order.outTradeNo,
      amount,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[recharge] 创建订单失败:", error);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}
