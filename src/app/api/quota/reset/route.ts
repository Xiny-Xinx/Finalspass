import { NextResponse } from "next/server";
import { getClientIP, resetQuota } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const ok = await resetQuota(ip);
    if (ok) {
      return NextResponse.json({ success: true, message: "配额已重置" });
    }
    return NextResponse.json(
      { success: false, message: "Redis 未配置，无法重置" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "重置配额失败" },
      { status: 500 }
    );
  }
}
