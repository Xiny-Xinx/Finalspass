import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { createFlashcards, getDueFlashcards, getTotalCount, getReviewedCount } from "@/lib/flashcard-store";

export const dynamic = "force-dynamic";

/** GET: 获取待复习闪卡 + 统计 */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const [due, total, reviewed] = await Promise.all([
    getDueFlashcards(auth.userId),
    getTotalCount(auth.userId),
    getReviewedCount(auth.userId),
  ]);

  return NextResponse.json({ due, total, reviewed });
}

/** POST: 从已有知识卡片生成闪卡 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 消耗 2 单位配额
  const { withQuota } = await import("@/lib/quota-guard");
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { cards } = body;
    if (!cards?.length) {
      return NextResponse.json({ error: "请先上传课件生成知识点卡片" }, { status: 400 });
    }

    const count = await createFlashcards(auth.userId, cards);
    await guard.deduct(2);
    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    if (err.statusCode === 429) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}
