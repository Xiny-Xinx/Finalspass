import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail, updatePassword } from "@/lib/user-store";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(128),
});

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redisClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = schema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    const redis = await getRedis();
    if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

    // 验证验证码
    const storedCode = await redis.get<any>(`verify_code:${normalizedEmail}`);
    if (!storedCode) {
      return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 });
    }
    if (String(storedCode) !== code) {
      return NextResponse.json({ error: "验证码错误" }, { status: 400 });
    }

    // 删除已使用的验证码
    await redis.del(`verify_code:${normalizedEmail}`);

    // 查找用户
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: "该邮箱未注册" }, { status: 404 });
    }

    // 更新密码
    const saved = await updatePassword(user.id, newPassword);
    if (!saved) {
      return NextResponse.json({ error: "保存失败，请重试" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "密码已重置" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    console.error("[reset-password] 错误:", err);
    return NextResponse.json({ error: "重置失败" }, { status: 500 });
  }
}
