import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** 搜索用户历史会话中的知识卡片（按标题/摘要关键词） */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  const keyword = q.toLowerCase();
  const sessionKey = `history:${auth.userId}`;

  try {
    const raw = await redis.get<any>(sessionKey);
    const sessions: any[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    const results: { fileName: string; title: string; summary: string; sessionId: string }[] = [];

    for (const s of sessions) {
      const dataKey = `history:${auth.userId}:session:${s.id}`;
      const sRaw = await redis.get<any>(dataKey);
      if (!sRaw) continue;
      const session = typeof sRaw === "string" ? JSON.parse(sRaw) : sRaw;
      const cards = session.cards || [];
      for (const card of cards) {
        if (
          card.title?.toLowerCase().includes(keyword) ||
          card.summary?.toLowerCase().includes(keyword)
        ) {
          results.push({
            fileName: s.fileName || session.fileName || "",
            title: card.title || "",
            summary: card.summary || "",
            sessionId: s.id,
          });
          if (results.length >= 30) break;
        }
      }
      if (results.length >= 30) break;
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
