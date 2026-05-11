/**
 * 测验结果存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   quiz:history:{userId} → JSON 数组 [{timestamp, fileName, score, total, type}]
 *   每个用户最多保留 50 条历史记录
 */

import { getRedis } from "@/lib/redis";

export interface QuizAttempt {
  timestamp: number;
  fileName: string;
  score: number;
  total: number;
  type: string;
}

/** 保存一次测验结果 */
export async function saveQuizResult(
  userId: string,
  attempt: Omit<QuizAttempt, "timestamp">
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = `quiz:history:${userId}`;
  const raw = await redis.get<any>(key);
  const history: QuizAttempt[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];

  history.push({ ...attempt, timestamp: Date.now() });

  // 最多保留 50 条
  const trimmed = history.slice(-50);
  await redis.set(key, JSON.stringify(trimmed));
}

/** 获取测验历史 */
export async function getQuizHistory(userId: string): Promise<QuizAttempt[]> {
  const redis = await getRedis();
  if (!redis) return [];

  const raw = await redis.get<any>(`quiz:history:${userId}`);
  if (!raw) return [];
  const history = (typeof raw === "string" ? JSON.parse(raw) : raw) as QuizAttempt[];
  return history.reverse(); // 最新的在前
}
