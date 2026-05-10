import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const emails = ["demo1@finalspass.top", "demo2@finalspass.top"];
  const d = new Date();
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const results: string[] = [];

  for (const email of emails) {
    const id = await redis.get<string>(`user:email:${email}`);
    if (!id) { results.push(`${email}: 未找到`); continue; }

    // 旧系统记录的大量 token 数，需要清掉
    await redis.del(`user:daily:${id}:${dateKey}`);
    results.push(`${email}: 已重置今日用量`);
  }

  return NextResponse.json({ results, note: "访问后刷新页面即可" });
}
