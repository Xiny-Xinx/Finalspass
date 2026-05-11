import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { saveQuizResult, getQuizHistory } from "@/lib/quiz-store";

export const dynamic = "force-dynamic";

/** 获取当前用户的测验历史 */
export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const history = await getQuizHistory(auth.userId);
  return NextResponse.json({ history });
}

/** 保存一次测验结果 */
export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const { score, total, fileName, type } = body;

  if (typeof score !== "number" || typeof total !== "number" || total <= 0) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  await saveQuizResult(auth.userId, { score, total, fileName: fileName || "", type: type || "mixed" });
  return NextResponse.json({ success: true });
}
