import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signJWT } from "@/lib/auth";
import { getUserByEmail } from "@/lib/user-store";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail } from "@/lib/email-templates";
import { getAppUrl } from "@/lib/app-url";

const schema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    // 不管邮箱是否存在都返回成功（防止枚举攻击）
    const user = await getUserByEmail(email);

    if (user) {
      const resetToken = signJWT(
        { userId: user.id, email: user.email, purpose: "reset" as const },
        3600 // 1 小时有效期
      );
      const baseUrl = getAppUrl(req);
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

      // fire-and-forget
      sendEmail({
        to: email,
        subject: "重置你的 FinalsPass 密码",
        html: resetPasswordEmail(resetLink),
      }).then((r) => {
        if (!r.ok) console.error("[forgot-password] 发送重置邮件失败:", r.error);
      });
    } else {
      console.log(`[forgot-password] 用户不存在, email="${email}"`);
    }

    return NextResponse.json({
      ok: true,
      message: "如果该邮箱已注册，你将收到一封密码重置邮件",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "请求失败" }, { status: 500 });
  }
}
