/**
 * Lemon Squeezy Webhook
 *
 * 用户完成支付后，LS 以 POST 方式发送事件到此地址。
 * 返回 200 表示已处理，LS 不会重试。
 *
 * 处理的事件：
 *   - order_created：新订单（充值 / 首次订阅扣款）
 *   - subscription_updated：订阅状态变更（续费 / 取消）
 *   - subscription_cancelled：订阅已取消
 *
 * 注意：LS 可能会重发事件，需保证幂等性。
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/lemonsqueezy";
import { getOrder, markOrderSuccess } from "@/lib/order-store";
import { addUserBalance, setUserTier } from "@/lib/user-store";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return redisClient;
}

interface LsWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    attributes: {
      identifier?: string;
      custom?: Record<string, string>;
      status?: string;
      renews_at?: string;
      ends_at?: string;
      cancelled?: boolean;
      /** 首次订阅（order_created 事件） */
      first_subscription?: {
        data?: {
          id: string;
        };
      };
      /** 订单包含的订阅 ID */
      order_items?: Array<{
        subscription_id: number;
      }>;
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

    // ==============================================================
    // 处理 order_created（新订单：充值 / 首次订阅扣款）
    // ==============================================================
    if (eventName === "order_created") {
      return handleOrderCreated(event);
    }

    // ==============================================================
    // 处理 subscription_updated（续费成功 / 状态变更）
    // ==============================================================
    if (eventName === "subscription_updated") {
      return handleSubscriptionUpdated(event);
    }

    // ==============================================================
    // 处理 subscription_cancelled（订阅已取消）
    // ==============================================================
    if (eventName === "subscription_cancelled") {
      return handleSubscriptionCancelled(event);
    }

    // 其他事件忽略
    return new Response("OK");
  } catch (error) {
    console.error("[ls-webhook] 处理异常:", error);
    return new Response("OK");
  }
}

/** 处理新订单（充值与首次订阅） */
async function handleOrderCreated(event: LsWebhookEvent) {
  const attrs = event.data.attributes;
  const custom = attrs?.custom;

  if (!custom?.out_trade_no) {
    console.warn("[ls-webhook] 订单缺少 custom 数据");
    return new Response("OK");
  }

  const outTradeNo = custom.out_trade_no;
  const userId = custom.user_id;

  // 查订单
  const order = await getOrder(outTradeNo);
  if (!order) {
    console.warn(`[ls-webhook] 订单不存在: ${outTradeNo}`);
    return new Response("OK");
  }

  // 幂等性检查
  if (order.status !== "pending") {
    return new Response("OK");
  }

  // 标记订单成功
  const lsOrderId = attrs.identifier || "";
  await markOrderSuccess(outTradeNo, lsOrderId);

  if (order.type === "recharge" && order.tokens) {
    // ── 充值 ──
    const result = await addUserBalance(order.userId, order.tokens);
    if (!result.ok) {
      console.error(`[ls-webhook] 充值失败 userId=${order.userId} tokens=${order.tokens}: ${result.error}`);
    } else {
      console.log(`[ls-webhook] 充值成功 userId=${order.userId} tokens=${order.tokens}`);
    }
  } else if (order.type === "subscription" && order.tier) {
    // ── 首次订阅扣款 ──
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const ok = await setUserTier(order.userId, order.tier as any, expiresAt);
    if (!ok) {
      console.error(`[ls-webhook] 升级失败 userId=${order.userId} tier=${order.tier}`);
    } else {
      console.log(`[ls-webhook] 升级成功 userId=${order.userId} tier=${order.tier}`);
    }

    // 存储订阅映射（用于后续续费 / 取消事件查找用户）
    const subscriptionId = getSubscriptionId(event);
    if (subscriptionId) {
      const redis = await getRedis();
      if (redis) {
        const subKey = `ls_sub:${subscriptionId}`;
        const subData = JSON.stringify({ userId: order.userId, tier: order.tier });
        await redis.set(subKey, subData, { ex: 365 * 86400 });
        console.log(`[ls-webhook] 存储订阅映射 ${subKey}`);
      }
    }
  }

  return new Response("OK");
}

/** 处理订阅状态变更（续费 / 取消等） */
async function handleSubscriptionUpdated(event: LsWebhookEvent) {
  const subscriptionId = event.data.id;
  const attrs = event.data.attributes;

  if (!subscriptionId) {
    return new Response("OK");
  }

  const status = attrs?.status;

  // 查找订阅映射
  const mapping = await getSubscriptionMapping(subscriptionId);
  if (!mapping) {
    console.warn(`[ls-webhook] 订阅映射不存在: ${subscriptionId}`);
    return new Response("OK");
  }

  if (status === "active" && attrs?.renews_at) {
    // 续费成功 → 延长套餐到期时间到下一个续费日
    const expiresAt = attrs.renews_at;
    await setUserTier(mapping.userId, mapping.tier as any, expiresAt);
    console.log(`[ls-webhook] 续费成功 userId=${mapping.userId} tier=${mapping.tier} expiresAt=${expiresAt}`);
  } else if (status === "cancelled" || status === "expired" || attrs?.cancelled) {
    // 已取消 / 已过期 → 降级
    await setUserTier(mapping.userId, "free", null);
    console.log(`[ls-webhook] 订阅已取消，降级 userId=${mapping.userId}`);
  }

  return new Response("OK");
}

/** 处理订阅已取消 */
async function handleSubscriptionCancelled(event: LsWebhookEvent) {
  const subscriptionId = event.data.id;

  if (!subscriptionId) {
    return new Response("OK");
  }

  const mapping = await getSubscriptionMapping(subscriptionId);
  if (!mapping) {
    console.warn(`[ls-webhook] 取消时订阅映射不存在: ${subscriptionId}`);
    return new Response("OK");
  }

  // 降级
  await setUserTier(mapping.userId, "free", null);
  console.log(`[ls-webhook] 订阅已取消（事件），降级 userId=${mapping.userId}`);

  return new Response("OK");
}

// ── 工具函数 ──

/** 从 order_created 事件中提取 subscription_id */
function getSubscriptionId(event: LsWebhookEvent): string | null {
  // 方法1：first_subscription.data.id
  const firstSub = event.data?.attributes?.first_subscription;
  if (firstSub?.data?.id) {
    return firstSub.data.id;
  }
  // 方法2：order_items[0].subscription_id
  const items = event.data?.attributes?.order_items;
  if (items?.length && items[0]?.subscription_id) {
    return String(items[0].subscription_id);
  }
  return null;
}

/** 根据 subscription_id 查找映射的用户信息 */
async function getSubscriptionMapping(subscriptionId: string): Promise<{ userId: string; tier: string } | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get<any>(`ls_sub:${subscriptionId}`);
  if (!raw) return null;

  return (typeof raw === "string" ? JSON.parse(raw) : raw) as { userId: string; tier: string };
}
