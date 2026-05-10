import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import type { SessionMeta, SessionData } from "@/lib/store";

export const dynamic = "force-dynamic";

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

function indexKey(userId: string) { return `user:history:${userId}`; }
function sessionKey(userId: string, sessionId: string) { return `user:session:${userId}:${sessionId}`; }

/** 获取用户历史列表 */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ sessions: [] });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ sessions: [] });

  const raw = await redis.get<any>(indexKey(auth.userId));
  const sessions: SessionMeta[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  return NextResponse.json({ sessions });
}

/** 保存新会话 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const { fileName, pptContent, cards, qaHistory } = body;
  if (!fileName) return NextResponse.json({ error: "缺少文件名" }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const meta: SessionMeta = {
    id, fileName, timestamp: Date.now(), cardCount: cards?.length || 0,
  };
  const data: SessionData = { fileName, pptContent, cards, qaHistory };

  // 更新索引
  const raw = await redis.get<any>(indexKey(auth.userId));
  const index: SessionMeta[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  index.unshift(meta);
  // 最多保留 50 条
  const trimmed = index.slice(0, 50);
  await redis.set(indexKey(auth.userId), JSON.stringify(trimmed));
  await redis.set(sessionKey(auth.userId, id), JSON.stringify(data), { ex: 365 * 86400 });

  return NextResponse.json({ id });
}

/** 删除指定会话 / 清空全部 */
export async function DELETE(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("id");
  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  if (sessionId === "all") {
    // 清空全部
    const raw = await redis.get<any>(indexKey(auth.userId));
    const index: SessionMeta[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    for (const s of index) {
      await redis.del(sessionKey(auth.userId, s.id));
    }
    await redis.del(indexKey(auth.userId));
    return NextResponse.json({ success: true });
  }

  if (!sessionId) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  // 删除指定
  await redis.del(sessionKey(auth.userId, sessionId));
  const raw = await redis.get<any>(indexKey(auth.userId));
  const index: SessionMeta[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  await redis.set(indexKey(auth.userId), JSON.stringify(index.filter((s) => s.id !== sessionId)));
  return NextResponse.json({ success: true });
}
