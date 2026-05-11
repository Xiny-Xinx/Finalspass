/**
 * 共享 Redis 客户端（基于 Upstash Redis）
 *
 * 所有需要操作 Redis 的模块统一从此文件导入，
 * 避免 getRedis() 重复定义。
 */

import type { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export async function getRedis(): Promise<Redis | null> {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis: UpstashRedis } = await import("@upstash/redis");
      redisClient = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return redisClient;
}
