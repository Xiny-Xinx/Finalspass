import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { reviewFlashcard } from "@/lib/flashcard-store";

export const dynamic = "force-dynamic";

/** POST: 提交闪卡复习结果 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const { cardId, quality } = body;

  if (!cardId || ![0, 1, 2, 3].includes(quality)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const result = await reviewFlashcard(auth.userId, cardId, quality as 0 | 1 | 2 | 3);
  if (!result) return NextResponse.json({ error: "闪卡不存在" }, { status: 404 });

  return NextResponse.json({ success: true, nextReview: result.nextReview });
}
