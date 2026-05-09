import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(auth.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      balance: user.balance,
      totalPurchased: user.totalPurchased,
      verified: user.verified,
    },
  });
}
