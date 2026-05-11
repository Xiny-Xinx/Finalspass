/**
 * 更新日志存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   changelog → JSON 数组 [{ id, date, title, changes, createdAt }]
 */

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  changes: string[];
  createdAt: number;
}

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

const KEY = "changelog";

/** 获取所有更新日志（按时间倒序） */
export async function getChangelog(): Promise<ChangelogEntry[]> {
  const redis = await getRedis();
  if (!redis) return [];

  const raw = await redis.get<any>(KEY);
  if (!raw) return [];
  const entries = (typeof raw === "string" ? JSON.parse(raw) : raw) as ChangelogEntry[];
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

/** 添加一条更新日志 */
export async function addChangelog(entry: {
  date: string;
  title: string;
  changes: string[];
}): Promise<ChangelogEntry> {
  const redis = await getRedis();
  const newEntry: ChangelogEntry = {
    id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
    createdAt: Date.now(),
  };

  if (redis) {
    const raw = await redis.get<any>(KEY);
    const entries = (raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []) as ChangelogEntry[];
    entries.push(newEntry);
    // 最多保留 50 条
    const trimmed = entries.slice(-50);
    await redis.set(KEY, JSON.stringify(trimmed));
  }

  return newEntry;
}

/** 删除一条更新日志 */
export async function deleteChangelog(id: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const raw = await redis.get<any>(KEY);
  const entries = (raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []) as ChangelogEntry[];
  const filtered = entries.filter((e) => e.id !== id);
  await redis.set(KEY, JSON.stringify(filtered));
}
