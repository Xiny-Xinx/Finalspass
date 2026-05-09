import { NextResponse } from "next/server";
import { getQuota, getClientIP } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const ip = getClientIP(req);
    const quota = await getQuota(ip);
    return NextResponse.json(quota);
  } catch {
    return NextResponse.json(
      { error: "查询配额失败" },
      { status: 500 }
    );
  }
}
