import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById, checkTierExpiry } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ user: null });
  }

  // 检查套餐是否到期
  await checkTierExpiry(auth.userId);

  const user = await getUserById(auth.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      balance: user.balance,
      totalPurchased: user.totalPurchased,
      verified: user.verified,
      tier: user.tier,
      tierExpiresAt: user.tierExpiresAt,
    },
  });
}
