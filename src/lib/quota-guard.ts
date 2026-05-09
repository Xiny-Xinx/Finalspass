/**
 * 统一配额守卫
 *
 * 根据请求是否携带有效 JWT 自动选择：
 *   - 已登录用户 → 从余额扣减 tokens
 *   - 未登录游客 → 沿用 IP-based 每日限额（免费层）
 *
 * 用法：
 *   const guard = await withQuota(req);
 *   // ... AI 调用 ...
 *   await guard.deduct(actualTokens);
 */

import { verifyJWT, JwtPayload } from "./auth";
import { deductUserBalance, getUserById } from "./user-store";
import { checkTokenBudget, recordTokens, getClientIP } from "./rate-limit";

export type QuotaGuard = Awaited<ReturnType<typeof withQuota>>;

/**
 * 解析请求中的 JWT cookie，返回用户信息或 null
 */
export function getAuthUser(req: Request): JwtPayload | null {
  const cookie = req.headers.get("cookie") ?? "";
  // 查找 fp_token=xxx 的 cookie 值
  const match = cookie.match(/(?:^|;\s*)fp_token=([^;]+)/);
  if (!match) return null;
  return verifyJWT(match[1]);
}

/**
 * 在 AI 调用前检查配额，返回一个 deduct 函数用于调用后扣除
 *
 * 如果配额不足会直接抛错（statusCode 402 或 429）
 */
export async function withQuota(req: Request) {
  const ip = getClientIP(req);
  const auth = getAuthUser(req);

  if (auth) {
    // ── 已登录用户：检查余额 ──
    const user = await getUserById(auth.userId);
    if (!user) {
      throw Object.assign(new Error("用户不存在"), { statusCode: 401 });
    }

    // 检查余额是否 > 0（至少能发起一次请求，精确扣减在 AI 调用后）
    // 这里粗略判断一下；如果余额为 0 则直接拒绝
    if (user.balance <= 0) {
      throw Object.assign(
        new Error("Token 余额不足，请充值"),
        { statusCode: 402 }
      );
    }

    return {
      userId: auth.userId,
      ip,
      /** AI 调用后，扣除实际消耗的 token 数 */
      deduct: async (tokens: number) => {
        if (tokens > 0) {
          await deductUserBalance(auth.userId, tokens);
        }
      },
    };
  }

  // ── 未登录游客：IP-based 每日限额 ──
  await checkTokenBudget(ip);
  return {
    userId: null,
    ip,
    deduct: async (tokens: number) => {
      if (tokens > 0) {
        await recordTokens(ip, tokens);
      }
    },
  };
}
