import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function GET() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const accounts = [
    { email: "demo1@finalspass.top", username: "demo1", password: "demo123456", label: "Pro 演示账号 1" },
    { email: "demo2@finalspass.top", username: "demo2", password: "demo123456", label: "Pro 演示账号 2" },
  ];

  const results: { email: string; username: string; password: string; status: string }[] = [];

  for (const acct of accounts) {
    const existing = await redis.get(`user:email:${acct.email}`);
    if (existing) {
      results.push({ ...acct, status: "已存在,跳过" });
      continue;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 86400000).toISOString(); // 1年

    const user = {
      id,
      email: acct.email,
      username: acct.username,
      passwordHash: hashPassword(acct.password),
      createdAt: now,
      balance: 1000000,
      totalPurchased: 0,
      verified: true,
      tier: "pro",
      tierExpiresAt: expiresAt,
    };

    const multi = redis.multi();
    multi.set(`user:${id}`, JSON.stringify(user));
    multi.set(`user:email:${acct.email}`, id);
    multi.set(`user:username:${acct.username}`, id);
    multi.set(`user:${id}:balance`, 1000000);
    await multi.exec();

    results.push({ ...acct, status: "✅ 创建成功" });
  }

  return NextResponse.json({ accounts: results });
}
