/**
 * 用户存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   user:{id}          → { id, email, passwordHash, createdAt, balance }
 *   user:email:{email}  → userId（唯一索引）
 *   user:id:{id}:email  → email（反向校验）
 */

import { randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "./auth";

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

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  /** 当前可用 token 余额 */
  balance: number;
  /** 累计充值总额（tokens） */
  totalPurchased: number;
  /** 邮箱是否已验证 */
  verified: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
  balance: number;
  totalPurchased: number;
  verified: boolean;
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    balance: user.balance,
    totalPurchased: user.totalPurchased,
    verified: user.verified,
  };
}

function newId(): string {
  return randomUUID();
}

/** 注册新用户 */
export async function createUser(
  email: string,
  password: string
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const redis = await getRedis();
  if (!redis) {
    return { ok: false, error: "Redis 未配置，无法注册" };
  }

  // 检查邮箱是否已注册
  const existing = await redis.get(`user:email:${email}`);
  if (existing) {
    return { ok: false, error: "该邮箱已注册" };
  }

  const id = newId();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const user: User = {
    id,
    email,
    passwordHash,
    createdAt: now,
    balance: 0,
    totalPurchased: 0,
    verified: false,
  };

  // 使用 multi 保证原子性
  const multi = redis.multi();
  multi.set(`user:${id}`, JSON.stringify(user));
  multi.set(`user:email:${email}`, id);
  const results = await multi.exec();

  // 检查是否成功
  const allOk = results.every((r) => r === "OK");
  if (!allOk) {
    // 回滚
    await redis.del(`user:${id}`, `user:email:${email}`);
    return { ok: false, error: "创建用户失败，请重试" };
  }

  return { ok: true, user: toPublic(user) };
}

/** 根据邮箱查找用户 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const id = await redis.get<string>(`user:email:${email}`);
  if (!id) return null;

  const raw = await redis.get<string>(`user:${id}`);
  if (!raw) return null;

  return JSON.parse(raw) as User;
}

/** 根据 ID 查找用户 */
export async function getUserById(id: string): Promise<User | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get<string>(`user:${id}`);
  if (!raw) return null;

  return JSON.parse(raw) as User;
}

/** 验证登录 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const user = await getUserByEmail(email);
  if (!user) {
    return { ok: false, error: "邮箱或密码错误" };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "邮箱或密码错误" };
  }

  return { ok: true, user: toPublic(user) };
}

/** 标记邮箱已验证 */
export async function markVerified(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  user.verified = true;
  return saveUser(user);
}

/** 更新密码 */
export async function updatePassword(
  userId: string,
  newPassword: string
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  user.passwordHash = hashPassword(newPassword);
  return saveUser(user);
}

/** 更新用户信息到 Redis */
async function saveUser(user: User): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  const r = await redis.set(`user:${user.id}`, JSON.stringify(user));
  return r === "OK";
}

/** 增加用户 token 余额 */
export async function addUserBalance(
  userId: string,
  tokens: number
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, error: "用户不存在" };

  user.balance += tokens;
  user.totalPurchased += tokens;
  const ok = await saveUser(user);
  if (!ok) return { ok: false, error: "保存失败" };

  return { ok: true, balance: user.balance };
}

/** 扣除用户 token 余额（用于 AI 调用消耗） */
export async function deductUserBalance(
  userId: string,
  tokens: number
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, error: "用户不存在" };
  if (user.balance < tokens) return { ok: false, error: "余额不足" };

  user.balance -= tokens;
  const ok = await saveUser(user);
  if (!ok) return { ok: false, error: "保存失败" };

  return { ok: true, balance: user.balance };
}
