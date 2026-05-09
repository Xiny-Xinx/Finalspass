import { NextRequest, NextResponse } from "next/server";
import { getConversation, getUserInfo } from "@/lib/support-store";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

async function isAdmin(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const info = await getUserInfo(userId);
  return info?.email === adminEmail;
}

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  const messages = await getConversation(userId);
  return NextResponse.json({ messages });
}
