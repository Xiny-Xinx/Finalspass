/**
 * 用量限额模块（基于 Vercel KV）
 *
 * 每个 IP 每天限制一定数量的 AI 请求。
 * 当 KV 未配置时自动降级为无限制（开发环境用）。
 */

import { DAILY_QUOTA_LIMIT } from "./constants";

// 动态导入 @vercel/kv，仅在 Vercel 运行时加载
type KvClient = import("@vercel/kv").VercelKV;
let kvClient: KvClient | null = null;
async function getKv(): Promise<KvClient | null> {
  if (!kvClient && process.env.KV_URL) {
    try {
      const mod = await import("@vercel/kv");
      kvClient = mod.kv;
    } catch {
      // KV 未安装或配置，降级
      return null;
    }
  }
  return kvClient;
}

function getDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 到当日 23:59:59 的秒数 */
function secondsUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  enabled: boolean;
}

/** 从请求头中提取客户端 IP */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

/** 检查是否超限，超限则抛错 */
export async function checkQuota(ip: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return; // KV 未配置 → 无限制

  const key = `ratelimit:${ip}:${getDateKey()}`;
  try {
    const count = (await kv.get<number>(key)) ?? 0;
    if (count >= DAILY_QUOTA_LIMIT) {
      throw Object.assign(new Error(`今日 AI 调用次数已达上限（${DAILY_QUOTA_LIMIT} 次），${getDateKey()} 重置`), {
        statusCode: 429,
      });
    }
    await kv.incr(key);
    if (count === 0) {
      await kv.expire(key, secondsUntilEndOfDay());
    }
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 429) throw err;
    console.error("[rate-limit] KV error:", err);
    // KV 出错不阻塞用户
  }
}

/** 查询当前配额使用情况 */
export async function getQuota(ip: string): Promise<QuotaInfo> {
  const kv = await getKv();
  if (!kv) {
    return { used: 0, limit: DAILY_QUOTA_LIMIT, remaining: DAILY_QUOTA_LIMIT, resetDate: getDateKey(), enabled: false };
  }

  const key = `ratelimit:${ip}:${getDateKey()}`;
  try {
    const count = (await kv.get<number>(key)) ?? 0;
    return {
      used: count,
      limit: DAILY_QUOTA_LIMIT,
      remaining: Math.max(0, DAILY_QUOTA_LIMIT - count),
      resetDate: getDateKey(),
      enabled: true,
    };
  } catch {
    return { used: 0, limit: DAILY_QUOTA_LIMIT, remaining: DAILY_QUOTA_LIMIT, resetDate: getDateKey(), enabled: false };
  }
}
