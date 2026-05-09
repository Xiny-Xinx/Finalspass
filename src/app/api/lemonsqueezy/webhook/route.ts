/**
 * Lemon Squeezy Webhook
 *
 * 用户完成支付后，LS 以 POST 方式发送事件到此地址。
 * 返回 200 表示已处理，LS 不会重试。
 *
 * 处理逻辑：
 *   1. 验证签名
 *   2. 处理 order_created 事件
 *   3. 查订单 → 执行业务（加 Token / 升级套餐）
 *
 * 注意：LS 可能会重发事件，需保证幂等性。
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/lemonsqueezy";
import { getOrder, markOrderSuccess } from "@/lib/order-store";
import { addUserBalance, setUserTier } from "@/lib/user-store";

interface LsWebhookEvent {
  meta: {
    event_name: string;
  };
  data: {
    attributes: {
      identifier?: string;
      custom?: Record<string, string>;
      first_subscription?: {
        attributes: {
          status: string;
        };
      };
      status: string;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";

    // 1. 验证签名
    const event = verifyWebhook<LsWebhookEvent>(rawBody, signature);
    if (!event) {
      console.error("[ls-webhook] 签名验证失败");
      return new Response("Invalid signature", { status: 400 });
    }

    const eventName = event.meta?.event_name;
    const attrs = event.data?.attributes;

    // 2. 只处理已完成支付的订单
    if (eventName !== "order_created") {
      return new Response("OK");
    }

    const custom = attrs?.custom;
    if (!custom?.out_trade_no) {
      console.warn("[ls-webhook] 订单缺少 custom 数据");
      return new Response("OK");
    }

    const outTradeNo = custom.out_trade_no;
    const userId = custom.user_id;

    // 3. 查订单
    const order = await getOrder(outTradeNo);
    if (!order) {
      console.warn(`[ls-webhook] 订单不存在: ${outTradeNo}`);
      return new Response("OK");
    }

    // 4. 幂等性检查
    if (order.status !== "pending") {
      return new Response("OK");
    }

    // 5. 标记订单成功
    const lsOrderId = attrs.identifier || "";
    await markOrderSuccess(outTradeNo, lsOrderId);

    // 6. 执行业务逻辑
    if (order.type === "recharge" && order.tokens) {
      const result = await addUserBalance(order.userId, order.tokens);
      if (!result.ok) {
        console.error(
          `[ls-webhook] 充值失败 userId=${order.userId} tokens=${order.tokens}: ${result.error}`
        );
      } else {
        console.log(
          `[ls-webhook] 充值成功 userId=${order.userId} tokens=${order.tokens}`
        );
      }
    } else if (order.type === "subscription" && order.tier) {
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const ok = await setUserTier(order.userId, order.tier as any, expiresAt);
      if (!ok) {
        console.error(
          `[ls-webhook] 升级失败 userId=${order.userId} tier=${order.tier}`
        );
      } else {
        console.log(
          `[ls-webhook] 升级成功 userId=${order.userId} tier=${order.tier}`
        );
      }
    }

    return new Response("OK");
  } catch (error) {
    console.error("[ls-webhook] 处理异常:", error);
    return new Response("OK");
  }
}
