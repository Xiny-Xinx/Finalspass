import { NextResponse } from "next/server";
import { getQuota, getClientIP, diagnoseQuota } from "@/lib/rate-limit";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";

export async function GET(req: Request) {
  try {
    // 检查是否已登录
    const auth = getAuthUser(req);

    if (auth) {
      // 已登录：返回用户余额
      const user = await getUserById(auth.userId);
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 401 });
      }

      // 也拉一下诊断信息
      const diagnostics = await diagnoseQuota();

      return NextResponse.json({
        // 兼容前端 QuotaInfo 接口
        used: 0, // 对于付费用户，不显示每日限额的 used
        limit: user.balance,
        remaining: user.balance,
        resetDate: "", // 付费用户无重置日期概念
        enabled: true,
        // 真实数据
        balance: user.balance,
        totalPurchased: user.totalPurchased,
        email: user.email,
        isLoggedIn: true,
        diagnostics,
      });
    }

    // 未登录：返回 IP-based 每日限额
    const ip = getClientIP(req);
    const quota = await getQuota(ip);
    const diagnostics = await diagnoseQuota();
    return NextResponse.json({ ...quota, isLoggedIn: false, diagnostics });
  } catch {
    return NextResponse.json({ error: "查询配额失败" }, { status: 500 });
  }
}
