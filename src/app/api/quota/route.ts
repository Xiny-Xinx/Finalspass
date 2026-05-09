import { NextResponse } from "next/server";
import { getQuota, getClientIP, diagnoseQuota } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const ip = getClientIP(req);
    const quota = await getQuota(ip);
    // 包含诊断信息，方便排查问题
    const diagnostics = await diagnoseQuota();
    return NextResponse.json({ ...quota, diagnostics });
  } catch {
    return NextResponse.json(
      { error: "查询配额失败" },
      { status: 500 }
    );
  }
}
