/**
 * 客服消息存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   support:conv:{userId}   → JSON 消息数组 [{role, content, ts}]
 *   support:unread:{userId}  → 管理员未读回复数量（客户打开窗口时清零）
 *   support:users            → Set of userIds（有历史消息的用户索引）
 */

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

export interface SupportMessage {
  role: "user" | "assistant" | "admin";
  content: string;
  ts: number;
}

/** 添加一条消息到对话 */
export async function addMessage(
  userId: string,
  msg: { role: SupportMessage["role"]; content: string }
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = `support:conv:${userId}`;
  const raw = await redis.get<any>(key);
  const conv: SupportMessage[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  conv.push({ ...msg, ts: Date.now() });
  // 最多保留 200 条
  const trimmed = conv.slice(-200);
  await redis.set(key, JSON.stringify(trimmed));
  await redis.sadd("support:users", userId);
}

/** 获取对话历史 */
export async function getConversation(userId: string): Promise<SupportMessage[]> {
  const redis = await getRedis();
  if (!redis) return [];

  const raw = await redis.get<any>(`support:conv:${userId}`);
  if (!raw) return [];
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as SupportMessage[];
}

/** 设置管理员未读回复数 */
export async function setUnread(userId: string, count: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  if (count > 0) {
    await redis.set(`support:unread:${userId}`, count);
  } else {
    await redis.del(`support:unread:${userId}`);
  }
}

/** 增加管理员未读回复数（原子递增） */
export async function incrUnread(userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.incr(`support:unread:${userId}`);
}

/** 获取管理员未读回复数 */
export async function getUnread(userId: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  return (await redis.get<number>(`support:unread:${userId}`)) ?? 0;
}

/** 获取所有有消息的用户 ID 列表 */
export async function getActiveUsers(): Promise<string[]> {
  const redis = await getRedis();
  if (!redis) return [];
  return redis.smembers<string[]>("support:users");
}

/** 获取用户信息（邮箱/用户名）用于列表显示 */
export async function getUserInfo(userId: string): Promise<{ email: string; tier: string } | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.get<any>(`user:${userId}`);
  if (!raw) return null;
  const user = (typeof raw === "string" ? JSON.parse(raw) : raw) as any;
  return { email: user.email || userId, tier: user.tier || "free" };
}
