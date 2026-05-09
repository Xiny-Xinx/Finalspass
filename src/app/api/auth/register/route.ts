import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signJWT, serializeCookie } from "@/lib/auth";
import { createUser } from "@/lib/user-store";
import { getAppUrl } from "@/lib/app-url";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return redisClient;
}

const schema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  username: z
    .string()
    .min(3, "用户名至少 3 个字符")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码过长"),
  code: z.string().length(6, "验证码为 6 位数字"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, password, code } = schema.parse(body);
    const normalizedEmail = email.toLowerCase().trim(); // 统一小写（仅用于 verify_code key）

    // 验证验证码
    const redis = await getRedis();
    if (!redis) {
      return NextResponse.json({ error: "Redis 未配置，无法注册" }, { status: 500 });
    }

    const storedCode = await redis.get<string>(`verify_code:${normalizedEmail}`);
    console.log(`[register] 验证码校验 email="${normalizedEmail}" storedCode="${storedCode}" submittedCode="${code}" storedType=${typeof storedCode} submittedType=${typeof code}`);

    if (!storedCode) {
      return NextResponse.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      );
    }
    // 注意：Upstash Redis 可能把纯数字字符串反序列化为 number 类型
    // 所以用 String(storedCode) 统一转字符串再比较
    if (String(storedCode) !== code) {
      return NextResponse.json(
        { error: `验证码错误` },
        { status: 400 }
      );
    }

    // 验证通过，删除已使用的验证码
    await redis.del(`verify_code:${normalizedEmail}`);

    // 创建用户
    const result = await createUser(email, username, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

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
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
