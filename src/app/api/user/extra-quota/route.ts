import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { createCheckout, isLsConfigured } from "@/lib/lemonsqueezy";
import { createOrder } from "@/lib/order-store";
import { EXTRA_QUOTA_PACKS } from "@/lib/constants";

const schema = z.object({
  units: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  if (!isLsConfigured()) {
    return NextResponse.json({ error: "支付系统未配置" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { units } = schema.parse(body);

    // 找到匹配的套餐
    const pack = EXTRA_QUOTA_PACKS.find((p) => p.units === units);
    if (!pack) {
      return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
    }

    // 创建订单
    const order = await createOrder({
      userId: auth.userId,
      type: "recharge",
      amount: pack.priceAUD,
      tokens: units,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/payment/result?out_trade_no=${order.outTradeNo}`;

    // 使用该套餐对应的固定价格 Variant（需先在 LS 后台创建）
    const variantId = process.env[pack.variantEnv] || "";
    if (!variantId) {
      return NextResponse.json({ error: `未配置 ${pack.variantEnv} 环境变量` }, { status: 500 });
    }

    const checkout = await createCheckout(
      undefined, // 不传 custom_price，使用 variant 固定价格
      `FinalsPass 额外配额 ${pack.label}`,
      `额外 ${units} 次 AI 配额，不限使用时间`,
      {
        user_id: auth.userId,
        type: "extra_quota",
        units: String(units),
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
      units,
      amount: pack.priceAUD,
    });
  } catch (err) {
    console.error("[extra-quota] 创建订单失败:", err);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}
