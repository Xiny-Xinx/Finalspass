import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { changePassword } from "@/lib/user-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少 6 位").max(128, "密码过长"),
});

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { oldPassword, newPassword } = schema.parse(body);

    const result = await changePassword(auth.userId, oldPassword, newPassword);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "密码修改成功" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[change-password] 修改密码失败:", error);
    return NextResponse.json({ error: "修改密码失败" }, { status: 500 });
  }
}
