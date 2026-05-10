/**
 * 闪卡存储（基于 Upstash Redis），使用 SM-2 间隔重复算法
 *
 * 数据结构：
 *   flashcard:{userId}:{cardId} → Flashcard
 *   flashcard:due:{userId}      → Sorted Set (score = nextReview timestamp)
 */

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  source: string;
  interval: number;
  ease: number;
  nextReview: number;
  reviewed: number;
}

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redisClient;
}

/** 生成闪卡 */
export async function createFlashcards(
  userId: string,
  cards: { title: string; summary: string }[]
): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;

  let count = 0;
  for (const card of cards) {
    const id = `fc_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fc: Flashcard = {
      id, question: card.title, answer: card.summary, source: card.title,
      interval: 0, ease: 2.5, nextReview: Date.now(), reviewed: 0,
    };
    await redis.set(`flashcard:${userId}:${id}`, JSON.stringify(fc));
    await redis.zadd(`flashcard:due:${userId}`, { score: fc.nextReview, member: id });
    count++;
  }
  return count;
}

/** 获取到期待复习的闪卡（nextReview <= now） */
export async function getDueFlashcards(userId: string, limit = 20): Promise<Flashcard[]> {
  const redis = await getRedis();
  if (!redis) return [];

  const now = Date.now();
  const ids = (await redis.zrange(`flashcard:due:${userId}`, 0, now, { byScore: true })) as string[];
  if (ids.length === 0) return [];
  const sliced = ids.slice(0, limit);

  const raws = await redis.mget<any[]>(...sliced.map((id) => `flashcard:${userId}:${id}`));
  return raws
    .filter((r: any): r is any => r !== null)
    .map((r: any) => (typeof r === "string" ? JSON.parse(r) : r) as Flashcard);
}

/** 获取全部闪卡数量 */
export async function getTotalCount(userId: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  return redis.zcard(`flashcard:due:${userId}`);
}

/** 获取今日已复习的闪卡数 */
export async function getReviewedCount(userId: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await redis.zcount(`flashcard:due:${userId}`, 0, Date.now());
  return count;
}

/**
 * SM-2 间隔重复
 * @param quality 0=忘记 1=困难 2=良好 3=轻松
 */
export async function reviewFlashcard(
  userId: string,
  cardId: string,
  quality: 0 | 1 | 2 | 3
): Promise<Flashcard | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get<any>(`flashcard:${userId}:${cardId}`);
  if (!raw) return null;

  const fc: Flashcard = typeof raw === "string" ? JSON.parse(raw) : raw;
  fc.reviewed++;

  if (quality < 2) {
    fc.interval = 0;
    fc.ease = Math.max(1.3, fc.ease - 0.2);
  } else {
    fc.interval = fc.interval === 0 ? 1 : Math.round(fc.interval * fc.ease);
    fc.ease = Math.min(3.0, fc.ease + (quality === 3 ? 0.15 : 0));
  }

  fc.nextReview = Date.now() + fc.interval * 86400000;
  await redis.set(`flashcard:${userId}:${cardId}`, JSON.stringify(fc));
  await redis.zadd(`flashcard:due:${userId}`, { score: fc.nextReview, member: cardId });
  return fc;
}
