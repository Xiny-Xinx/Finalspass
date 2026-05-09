/**
 * 用户认证工具（零外部依赖）
 *
 * 使用 Node.js 内置 crypto：
 *   - 密码哈希：scryptSync + 随机盐
 *   - JWT：HMAC-SHA256
 */

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

// ── 密码哈希 ──────────────────────────────────────────

const HASH_KEY_LEN = 64;
const SALT_LEN = 16;

/** 对密码做加盐哈希，返回 "salt:hash" 格式字符串 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const hash = scryptSync(password, salt, HASH_KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

/** 验证密码与存储的哈希是否匹配（timing-safe） */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, HASH_KEY_LEN);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ── JWT（无第三方依赖） ─────────────────────────────

/**
 * JWT 载荷
 */
export interface JwtPayload {
  userId: string;
  email: string;
  /** Token 用途: "auth" | "verify" | "reset" */
  purpose?: string;
  /** 签发时间（Unix 秒） */
  iat: number;
  /** 过期时间（Unix 秒） */
  exp: number;
}

function getJwtSecret(): string {
  // 优先用环境变量，否则生成一个进程级随机密钥（重启后失效）
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // 生产环境请务必设置 JWT_SECRET 环境变量！
  if (process.env.NODE_ENV === "production") {
    console.warn("WARNING: JWT_SECRET 未设置，使用临时密钥（重启后所有 token 失效）");
  }
  return process.env._JWT_SECRET_FALLBACK ??= randomBytes(32).toString("hex");
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

/** 签发 JWT，有效期默认 7 天 */
export function signJWT(
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresInSeconds = 7 * 24 * 3600
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64url(Buffer.from(JSON.stringify(fullPayload)));
  const signature = createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

/** 验证 JWT，返回 payload 或 null */
export function verifyJWT(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // 验证签名
  const expectedSig = createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSig = base64urlDecode(encodedSignature);
  if (expectedSig.length !== actualSig.length) return null;
  try {
    if (!timingSafeEqual(expectedSig, actualSig)) return null;
  } catch {
    return null;
  }

  // 解析 payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  // 检查过期
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

// ── Cookie 工具 ───────────────────────────────────────

/** Cookie 序列化（简化版，仅用于 auth token） */
export function serializeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join("; ");
}

/** 清除 cookie 的响应头 */
export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
