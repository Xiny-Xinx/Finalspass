import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

async function isAdmin(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const redis = await getRedis();
  if (!redis) return false;
  const raw = await redis.get<any>(`user:${userId}`);
  if (!raw) return false;
  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  return user.email === adminEmail;
}

/** GET: 获取当前公告（公开） */
export async function GET() {
  const redis = await getRedis();
  if (!redis) return NextResponse.json({ text: "" });

  const raw = await redis.get<any>("announcement");
  const data = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  return NextResponse.json({ text: data?.text || "", active: data?.active || false });
}

/** POST: 管理员发布/更新公告 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || !(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { text } = body;
  if (!text?.trim()) return NextResponse.json({ error: "内容不能为空" }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  await redis.set("announcement", JSON.stringify({ text: text.trim(), active: true, updatedAt: Date.now() }));
  return NextResponse.json({ success: true });
}

/** DELETE: 管理员关闭公告 */
export async function DELETE(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || !(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  await redis.del("announcement");
  return NextResponse.json({ success: true });
}
