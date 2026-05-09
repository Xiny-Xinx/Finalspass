import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyJWT } from "@/lib/auth";
import { updatePassword } from "@/lib/user-store";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码过长"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const payload = verifyJWT(token);
    if (!payload || (payload as any).purpose !== "reset") {
      return NextResponse.json(
        { error: "重置链接无效或已过期" },
        { status: 400 }
      );
    }

    const ok = await updatePassword(payload.userId, password);
    if (!ok) {
      return NextResponse.json({ error: "重置失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "密码已重置，请重新登录" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "重置失败" }, { status: 500 });
  }
}
