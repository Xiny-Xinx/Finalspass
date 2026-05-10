import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getTotalCount } from "@/lib/flashcard-store";

export const dynamic = "force-dynamic";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redisClient;
}

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ sessions: 0, cards: 0, flashcards: 0 });

  const raw = await redis.get<any>(`user:history:${auth.userId}`);
  const sessions: any[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  const totalSessions = sessions.length;
  const totalCards = sessions.reduce((sum, s) => sum + (s.cardCount || 0), 0);

  let totalFlashcards = 0;
  try { totalFlashcards = await getTotalCount(auth.userId); } catch {}

  return NextResponse.json({ sessions: totalSessions, cards: totalCards, flashcards: totalFlashcards });
}
