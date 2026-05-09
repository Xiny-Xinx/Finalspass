import { NextRequest, NextResponse } from "next/server";
import { getActiveUsers, getConversation, addMessage, setUnread, getUserInfo } from "@/lib/support-store";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

/** 检查当前用户是否为管理员 */
async function isAdmin(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const info = await getUserInfo(userId);
  return info?.email === adminEmail;
}

/** 获取所有对话列表（仅用于管理后台） */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const userIds = await getActiveUsers();
  const conversations = await Promise.all(
    userIds.map(async (uid) => {
      const msgs = await getConversation(uid);
      const info = await getUserInfo(uid);
      return {
        userId: uid,
        email: info?.email || uid,
        tier: info?.tier || "free",
        lastMsg: msgs.length > 0 ? msgs[msgs.length - 1] : null,
        msgCount: msgs.length,
      };
    })
  );

  // 按最新消息排序
  conversations.sort((a, b) => (b.lastMsg?.ts ?? 0) - (a.lastMsg?.ts ?? 0));

  return NextResponse.json({ conversations });
}

/** 管理员回复消息 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, content } = body;

  if (!userId || !content?.trim()) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // 保存管理员回复 + 标记客户未读
  await addMessage(userId, { role: "admin", content: content.trim() });
  await setUnread(userId, 1);

  return NextResponse.json({ success: true });
}
