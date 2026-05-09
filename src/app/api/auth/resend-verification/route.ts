import { NextRequest, NextResponse } from "next/server";
import { signJWT } from "@/lib/auth";
import { getAuthUser } from "@/lib/quota-guard";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/email-templates";
import { getAppUrl } from "@/lib/app-url";

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const verifyToken = signJWT(
    { userId: auth.userId, email: auth.email, purpose: "verify" as const },
    24 * 3600
  );
  const baseUrl = getAppUrl(req);
  const verifyLink = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`;

  const result = await sendEmail({
    to: auth.email,
    subject: "验证你的 FinalsPass 邮箱",
    html: verificationEmail(verifyLink),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "验证邮件已发送" });
}
