import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { getUserById } from "@/lib/user-store";
import { addChangelog, deleteChangelog } from "@/lib/changelog-store";

const addSchema = z.object({
  action: z.literal("add"),
  date: z.string().min(1, "日期不能为空"),
  title: z.string().min(1, "标题不能为空").max(200),
  changes: z.array(z.string().min(1)).min(1, "至少填写一条变更"),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().min(1),
});

async function checkAdmin(req: NextRequest): Promise<{ ok: false } | { ok: true }> {
  const auth = getAuthUser(req);
  if (!auth) return { ok: false };

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { ok: false };

  const user = await getUserById(auth.userId);
  if (!user || user.email !== adminEmail) return { ok: false };

  return { ok: true };
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.action === "add") {
      const { date, title, changes } = addSchema.parse(body);
      const entry = await addChangelog({ date, title, changes });
      return NextResponse.json({ success: true, entry });
    }

    if (body.action === "delete") {
      const { id } = deleteSchema.parse(body);
      await deleteChangelog(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    console.error("[admin/changelog] 错误:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
