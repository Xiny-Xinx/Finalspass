import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signJWT, serializeCookie } from "@/lib/auth";
import { createUser } from "@/lib/user-store";

const schema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码过长"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);

    const result = await createUser(email, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // 签发 JWT，有效期 7 天
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
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
