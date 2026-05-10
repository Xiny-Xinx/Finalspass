import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redisClient;
}

export async function GET() {
  const auth = getAuthUser({} as any);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "系统错误" }, { status: 500 });

  // 检查管理员
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const raw = await redis.get<any>(`user:${auth.userId}`);
    if (raw) {
      const user = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (user.email !== adminEmail) return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
  }

  // 统计用户数（通过 user:email 前缀扫描）
  let totalUsers = 0;
  let proUsers = 0;
  let premiumUsers = 0;
  let todayApiCalls = 0;

  try {
    // 用 SCAN 扫描 user:id 模式来统计用户
    let cursor = "0";
    const keys: string[] = [];
    do {
      const [next, ks] = await (redis as any).scan(cursor, { match: "user:*", count: 200 });
      cursor = next;
      for (const k of ks as string[]) {
        // user:email:xxx → skip, user:username:xxx → skip, user:{uuid}:balance → skip
        if (k.includes("email:") || k.includes("username:") || k.endsWith(":balance")) continue;
        // user:{uuid} → count as user
        if (k.match(/^user:[a-f0-9-]{36}$/)) {
          keys.push(k);
        }
      }
    } while (cursor !== "0");

    totalUsers = keys.length;

    // 统计套餐分布和今日用量
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    for (const k of keys) {
      const raw = await redis.get<any>(k);
      if (raw) {
        const u = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (u.tier === "pro") proUsers++;
        else if (u.tier === "premium") premiumUsers++;

        // 今日 API 调用
        const daily = await redis.get<number>(`user:daily:${u.id}:${dateKey}`);
        if (daily) todayApiCalls += daily;
      }
    }
  } catch {}

  return NextResponse.json({
    totalUsers,
    proUsers,
    premiumUsers,
    freeUsers: totalUsers - proUsers - premiumUsers,
    todayApiCalls,
    dateKey: new Date().toISOString().slice(0, 10),
  });
}
