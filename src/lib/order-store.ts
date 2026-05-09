/**
 * 订单存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   order:{outTradeNo}    → JSON Order
 *   orders:user:{userId}  → Set of outTradeNo（用户订单索引）
 */

import { randomUUID } from "crypto";

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

export type OrderType = "recharge" | "subscription";
export type OrderStatus = "pending" | "success" | "failed";

export interface Order {
  /** 商户订单号（全局唯一） */
  outTradeNo: string;
  /** 用户 ID */
  userId: string;
  /** 订单类型 */
  type: OrderType;
  /** 充值 token 数量（recharge 类型） */
  tokens?: number;
  /** 订阅套餐（subscription 类型） */
  tier?: string;
  /** 金额（元） */
  amount: number;
  /** 订单状态 */
  status: OrderStatus;
  /** 创建时间 */
  createdAt: string;
  /** 支付成功时间 */
  paidAt?: string;
  /** 支付宝交易号 */
  tradeNo?: string;
}

/** 生成唯一商户订单号 */
export function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = randomUUID().slice(0, 8);
  return `FP${ts}${rand}`;
}

/**
 * 创建待支付订单
 */
export async function createOrder(params: {
  userId: string;
  type: OrderType;
  amount: number;
  tokens?: number;
  tier?: string;
}): Promise<Order> {
  const redis = await getRedis();
  const outTradeNo = generateOrderId();

  const order: Order = {
    outTradeNo,
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    tokens: params.tokens,
    tier: params.tier,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (redis) {
    const multi = redis.multi();
    multi.set(`order:${outTradeNo}`, JSON.stringify(order));
    multi.sadd(`orders:user:${params.userId}`, outTradeNo);
    // 24 小时后自动清理
    multi.expire(`order:${outTradeNo}`, 86400);
    await multi.exec();
  }

  return order;
}

/**
 * 获取订单
 */
export async function getOrder(outTradeNo: string): Promise<Order | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get<any>(`order:${outTradeNo}`);
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Order;
}

/**
 * 标记订单为支付成功
 */
export async function markOrderSuccess(
  outTradeNo: string,
  tradeNo: string
): Promise<Order | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get<any>(`order:${outTradeNo}`);
  if (!raw) return null;

  const order = (typeof raw === "string" ? JSON.parse(raw) : raw) as Order;
  if (order.status !== "pending") return order; // 已处理，防重复

  order.status = "success";
  order.paidAt = new Date().toISOString();
  order.tradeNo = tradeNo;

  await redis.set(`order:${outTradeNo}`, JSON.stringify(order));
  return order;
}

/**
 * 标记订单为失败
 */
export async function markOrderFailed(outTradeNo: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const raw = await redis.get<any>(`order:${outTradeNo}`);
  if (!raw) return;

  const order = (typeof raw === "string" ? JSON.parse(raw) : raw) as Order;
  order.status = "failed";
  await redis.set(`order:${outTradeNo}`, JSON.stringify(order));
}

/**
 * 获取用户的订单列表
 */
export async function getUserOrders(
  userId: string,
  limit = 20
): Promise<Order[]> {
  const redis = await getRedis();
  if (!redis) return [];

  const ids = await redis.smembers<string[]>(`orders:user:${userId}`);
  const recent = ids.slice(-limit);

  if (recent.length === 0) return [];

  const raws = await redis.mget<any[]>(...recent.map((id) => `order:${id}`));
  return raws
    .filter((r): r is NonNullable<any> => r !== null)
    .map((r) => (typeof r === "string" ? JSON.parse(r) : r) as Order)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
