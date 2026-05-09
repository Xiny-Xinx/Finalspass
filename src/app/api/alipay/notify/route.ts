/**
 * 支付宝异步通知（Webhook）
 *
 * 用户完成支付后，支付宝以 POST 方式将支付结果通知到此地址。
 * 必须返回 "success"（纯文本）以告知支付宝已成功处理。
 *
 * 处理逻辑：
 *   1. 验证签名 → 2. 查订单 → 3. 执行业务（加 Token / 升级套餐）
 *
 * 注意：支付宝可能会重复通知，需保证幂等性。
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyNotify } from "@/lib/alipay";
import { getOrder, markOrderSuccess } from "@/lib/order-store";
import { addUserBalance } from "@/lib/user-store";
import { setUserTier } from "@/lib/user-store";

export async function POST(req: NextRequest) {
  try {
    // 支付宝 POST 的是 URL-encoded form 数据
    const text = await req.text();
    const rawParams = Object.fromEntries(new URLSearchParams(text));

    // 1. 验证签名
    const verified = verifyNotify(rawParams);
    if (!verified) {
      console.error("[alipay-notify] 签名验证失败");
      return new Response("failure", { status: 400 });
    }

    const { out_trade_no, trade_no, trade_status, total_amount } = verified;

    // 2. 只处理交易成功状态
    if (trade_status !== "TRADE_SUCCESS") {
      // 其他状态不处理，但返回 success 避免支付宝重试
      return new Response("success");
    }

    if (!out_trade_no || !trade_no) {
      console.error("[alipay-notify] 缺少订单号");
      return new Response("success");
    }

    // 3. 查订单
    const order = await getOrder(out_trade_no);
    if (!order) {
      console.error(`[alipay-notify] 订单不存在: ${out_trade_no}`);
      return new Response("success");
    }

    // 4. 幂等性检查：已处理的订单跳过
    if (order.status !== "pending") {
      return new Response("success");
    }

    // 5. 金额校验（粗略比较，防止篡改）
    const notifiedAmount = parseFloat(total_amount || "0");
    if (Math.abs(notifiedAmount - order.amount) > 0.01) {
      console.error(
        `[alipay-notify] 金额不匹配: 订单=${order.amount}, 通知=${notifiedAmount}`
      );
      return new Response("success");
    }

    // 6. 标记订单成功
    await markOrderSuccess(out_trade_no, trade_no);

    // 7. 执行业务逻辑
    if (order.type === "recharge" && order.tokens) {
      const result = await addUserBalance(order.userId, order.tokens);
      if (!result.ok) {
        console.error(
          `[alipay-notify] 加款失败 userId=${order.userId} tokens=${order.tokens}: ${result.error}`
        );
      } else {
        console.log(
          `[alipay-notify] 充值成功 userId=${order.userId} tokens=${order.tokens} 余额=${result.balance}`
        );
      }
    } else if (order.type === "subscription" && order.tier) {
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const ok = await setUserTier(order.userId, order.tier as any, expiresAt);
      if (!ok) {
        console.error(
          `[alipay-notify] 升级失败 userId=${order.userId} tier=${order.tier}`
        );
      } else {
        console.log(
          `[alipay-notify] 升级成功 userId=${order.userId} tier=${order.tier} 到期=${expiresAt}`
        );
      }
    }

    return new Response("success");
  } catch (error) {
    console.error("[alipay-notify] 处理异常:", error);
    // 返回 success 防止支付宝重试，人工对账
    return new Response("success");
  }
}
