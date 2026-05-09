import { NextRequest, NextResponse } from "next/server";
import { getConversation } from "@/lib/support-store";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  const messages = await getConversation(userId);
  return NextResponse.json({ messages });
}
