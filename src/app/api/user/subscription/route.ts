/**
 * 套餐订阅 API（支付宝收款码）
 *
 * 流程：
 *   1. 返回支付宝收款码信息 + 金额
 *   2. 用户扫码付款后，联系客服告知已付款
 *   3. 管理员在后台手动激活套餐
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { TIER_PRICES } from "@/lib/constants";

const schema = z.object({
  tier: z.enum(["pro", "premium"]),
});

const TIER_LABEL: Record<string, string> = {
  pro: "Pro",
  premium: "Premium",
};

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const qrUrl = process.env.NEXT_PUBLIC_ALIPAY_QR_URL || "";
  if (!qrUrl) {
    return NextResponse.json(
      { error: "收款码尚未配置" },
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

    return NextResponse.json({
      success: true,
      qrPayment: true,
      tier,
      amount,
      label: `${TIER_LABEL[tier]} · ¥${Number.isInteger(amount) ? amount : amount.toFixed(2)}`,
      qrUrl,
      message: `请使用支付宝扫描下方二维码支付 ¥${Number.isInteger(amount) ? amount : amount.toFixed(2)}，付款后联系在线客服告知已付款，管理员将在核实后为您激活 ${TIER_LABEL[tier]} 套餐。`,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[subscription] 错误:", error);
    return NextResponse.json({ error: "请求失败" }, { status: 500 });
  }
}
