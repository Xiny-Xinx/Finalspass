import { NextResponse } from "next/server";
import { getChangelog } from "@/lib/changelog-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await getChangelog();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[changelog] 获取失败:", error);
    return NextResponse.json({ entries: [] });
  }
}
