import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserInfo } from "@/lib/support-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ admin: false });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ admin: false });
  }

  const info = await getUserInfo(auth.userId);
  return NextResponse.json({ admin: info?.email === adminEmail });
}
