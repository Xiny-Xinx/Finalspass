import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await getUserById(auth.userId);
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({
    balance: user.balance,
    totalPurchased: user.totalPurchased,
  });
}
