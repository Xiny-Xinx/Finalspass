import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, signJWT, serializeCookie } from "@/lib/auth";
import { markVerified, getUserById } from "@/lib/user-store";
import { getAppUrl } from "@/lib/app-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=缺少验证参数", getAppUrl(req)));
  }

  const payload = verifyJWT(token);
  if (!payload || (payload as any).purpose !== "verify") {
    return NextResponse.redirect(new URL("/login?error=验证链接无效或已过期", getAppUrl(req)));
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=用户不存在", getAppUrl(req)));
  }

  if (user.verified) {
    // 已经验证过了，直接跳转
    return NextResponse.redirect(new URL("/account?verified=already", getAppUrl(req)));
  }

  const ok = await markVerified(payload.userId);
  if (!ok) {
    return NextResponse.redirect(new URL("/login?error=验证失败", getAppUrl(req)));
  }

  // 重新签发包含 verified 状态的 JWT
  const newToken = signJWT(
    { userId: user.id, email: user.email },
    7 * 24 * 3600
  );
  const cookie = serializeCookie("fp_token", newToken, 7 * 24 * 3600);

  const redirectUrl = new URL("/account?verified=ok", getAppUrl(req));
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Set-Cookie", cookie);
  return response;
}
