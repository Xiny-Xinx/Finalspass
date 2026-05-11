import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** 获取指定会话的完整数据 */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("id");
  if (!sessionId) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  const raw = await redis.get<any>(`user:session:${auth.userId}:${sessionId}`);
  if (!raw) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  return NextResponse.json(data);
}
