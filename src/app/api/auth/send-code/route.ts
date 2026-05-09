import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

/**
 * 验证码存储（Redis）
 * key: verify_code:{email}
 * value: 6 位数字验证码
 * TTL: 10 分钟
 */

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
});

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const redis = await getRedis();
    if (!redis) {
      return NextResponse.json({ error: "Redis 未配置" }, { status: 500 });
    }

    // 检查 60 秒内是否已发过（防刷）
    const ttl = await redis.ttl(`verify_code:${email}`);
    if (ttl > 540) {
      // 剩余 9+ 分钟说明刚发过
      return NextResponse.json(
        { error: "验证码已发送，请 60 秒后再试" },
        { status: 429 }
      );
    }

    const code = generateCode();

    // 存到 Redis，10 分钟过期
    await redis.set(`verify_code:${email}`, code, { ex: 600 });
    console.log(`[send-code] 已存储验证码 email="${email}" code="${code}"`);

    // 发送邮件
    const appUrl = getAppUrl(req);
    const result = await sendEmail({
      to: email,
      subject: "FinalsPass 注册验证码",
      html: `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="padding:40px 32px 32px;text-align:center">
          <h1 style="margin:0 0 8px;font-size:20px;color:#111">FinalsPass 注册验证码</h1>
          <p style="margin:12px 0 24px;font-size:15px;color:#555">请使用以下验证码完成注册：</p>
          <div style="background:#f0f4ff;border-radius:12px;padding:20px;margin:0 0 24px;letter-spacing:8px;font-size:32px;font-weight:700;color:#0066ff">${code}</div>
          <p style="margin:0;font-size:13px;color:#999">验证码 10 分钟内有效，请勿泄露给他人。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px">
          <p style="margin:0;font-size:12px;color:#999">FinalsPass &middot; AI 考前冲刺助手<br><a href="${appUrl}" style="color:#0066ff;font-size:12px">${appUrl}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "验证码已发送" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "发送失败" }, { status: 500 });
  }
}
