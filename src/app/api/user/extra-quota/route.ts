/**
 * 额外配额购买（支付宝收款码）
 *
 * 流程：
 *   1. 返回支付宝收款码信息 + 金额
 *   2. 用户扫码付款后，联系客服告知已付款
 *   3. 管理员在后台手动添加额外配额
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { EXTRA_QUOTA_PACKS } from "@/lib/constants";

const schema = z.object({
  units: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const qrUrl = process.env.NEXT_PUBLIC_ALIPAY_QR_URL || "";
  if (!qrUrl) {
    return NextResponse.json({ error: "收款码尚未配置" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { units } = schema.parse(body);

    const pack = EXTRA_QUOTA_PACKS.find((p) => p.units === units);
    if (!pack) {
      return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      qrPayment: true,
      units: pack.units,
      amount: pack.priceCNY,
      label: `${pack.label} · ¥${Number.isInteger(pack.priceCNY) ? pack.priceCNY : pack.priceCNY.toFixed(2)}`,
      qrUrl,
      message: `请使用支付宝扫描下方二维码支付 ¥${Number.isInteger(pack.priceCNY) ? pack.priceCNY : pack.priceCNY.toFixed(2)}，付款后联系在线客服告知已付款，管理员将在核实后为您添加 ${pack.units} 次额外配额。`,
    });
  } catch (err) {
    console.error("[extra-quota] 错误:", err);
    return NextResponse.json({ error: "请求失败" }, { status: 500 });
  }
}
