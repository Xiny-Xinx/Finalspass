import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signJWT, serializeCookie } from "@/lib/auth";
import { loginUser } from "@/lib/user-store";
import { checkAuthRateLimit, resetAuthRateLimit } from "@/lib/rate-limiter";
import { getClientIP } from "@/lib/rate-limit";

const schema = z.object({
  login: z.string().min(1, "请输入邮箱或用户名"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);

    // 频率限制：同一 IP 5 分钟内最多尝试 10 次
    const rateCheck = await checkAuthRateLimit(ip, 10, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "登录尝试过于频繁，请 5 分钟后再试" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { login, password } = schema.parse(body);

    const result = await loginUser(login, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // 登录成功 → 重置频率计数
    await resetAuthRateLimit(ip);

    // 签发 JWT
    const token = signJWT({ userId: result.user.id, email: result.user.email });
    const cookie = serializeCookie("fp_token", token, 7 * 24 * 3600);

    return NextResponse.json(
      { user: result.user },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[login] 登录异常:", error);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
