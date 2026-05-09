import { NextRequest, NextResponse } from "next/server";
import { getConversation } from "@/lib/support-store";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

/** 获取当前登录用户的客服对话历史（含管理员回复） */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await getConversation(auth.userId);
  return NextResponse.json({ messages });
}
