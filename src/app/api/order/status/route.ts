/**
 * 查询订单状态
 *
 * 支付结果页面用此接口确认用户是否支付成功。
 * 支付宝异步通知可能会延迟几秒，此接口也会轮询等待。
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getOrder } from "@/lib/order-store";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  const outTradeNo = req.nextUrl.searchParams.get("out_trade_no");

  if (!outTradeNo) {
    return NextResponse.json({ error: "缺少订单号" }, { status: 400 });
  }

  const order = await getOrder(outTradeNo);
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  // 如果已登录，只允许查看自己的订单
  if (auth && order.userId !== auth.userId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json({
    outTradeNo: order.outTradeNo,
    type: order.type,
    status: order.status,
    amount: order.amount,
    tokens: order.tokens,
    tier: order.tier,
    paidAt: order.paidAt,
  });
}
