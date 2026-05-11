/**
 * 用户存储（基于 Upstash Redis）
 *
 * 数据结构：
 *   user:{id}          → { id, email, username, passwordHash, createdAt }
 *   user:email:{email}  → userId（唯一索引）
 *   user:username:{username} → userId（唯一索引）
 *   user:id:{id}:email  → email（反向校验）
 */

import { randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "./auth";
import { getRedis } from "@/lib/redis";

export type UserTier = "free" | "pro" | "premium";

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  /** 邮箱是否已验证 */
  verified: boolean;
  /** 套餐等级 */
  tier: UserTier;
  /** 套餐到期时间(ISO)，pro/premium 有值，free 为 null */
  tierExpiresAt: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  verified: boolean;
  tier: UserTier;
  tierExpiresAt: string | null;
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
    verified: user.verified,
    tier: user.tier,
    tierExpiresAt: user.tierExpiresAt,
  };
}

function newId(): string {
  return randomUUID();
}

/** 注册新用户 */
export async function createUser(
  email: string,
  username: string,
  password: string
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const redis = await getRedis();
  if (!redis) {
    return { ok: false, error: "Redis 未配置，无法注册" };
  }

  // 检查邮箱是否已注册
  const existingEmail = await redis.get(`user:email:${email}`);
  if (existingEmail) {
    return { ok: false, error: "该邮箱已注册" };
  }

  // 检查用户名是否已注册
  const existingUsername = await redis.get(`user:username:${username}`);
  if (existingUsername) {
    return { ok: false, error: "该用户名已被使用" };
  }

  const id = newId();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const user: User = {
    id,
    email,
    username,
    passwordHash,
    createdAt: now,
    verified: false,
    tier: "free",
    tierExpiresAt: null,
  };

  // 使用 multi 保证原子性
  const multi = redis.multi();
  multi.set(`user:${id}`, JSON.stringify(user));
  multi.set(`user:email:${email}`, id);
  multi.set(`user:username:${username}`, id);
  const results = await multi.exec();

  // 检查是否成功
  const allOk = results.every((r) => r === "OK");
  if (!allOk) {
    // 回滚
    await redis.del(`user:${id}`, `user:email:${email}`, `user:username:${username}`);
    return { ok: false, error: "创建用户失败，请重试" };
  }

  return { ok: true, user: toPublic(user) };
}

/** 根据邮箱查找用户 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const id = await redis.get<string>(`user:email:${email}`);
    if (!id) return null;

    const raw = await redis.get<any>(`user:${id}`);
    if (!raw) return null;

    return (typeof raw === "string" ? JSON.parse(raw) : raw) as User;
  } catch {
    return null;
  }
}

/** 根据用户名查找用户 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const id = await redis.get<string>(`user:username:${username}`);
    if (!id) return null;

    const raw = await redis.get<any>(`user:${id}`);
    if (!raw) return null;

    return (typeof raw === "string" ? JSON.parse(raw) : raw) as User;
  } catch {
    return null;
  }
}

/** 根据 ID 查找用户 */
export async function getUserById(id: string): Promise<User | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<any>(`user:${id}`);
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as User;
  } catch {
    return null;
  }
}

/** 验证登录（login 可以是邮箱或用户名） */
export async function loginUser(
  login: string,
  password: string
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const isEmail = login.includes("@");
  const user = isEmail ? await getUserByEmail(login) : await getUserByUsername(login);
  if (!user) {
    return { ok: false, error: "邮箱/用户名或密码错误" };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "邮箱/用户名或密码错误" };
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

/** 修改密码（需验证旧密码） */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserById(userId);
  if (!user) {
    return { ok: false, error: "用户不存在" };
  }
  if (!verifyPassword(oldPassword, user.passwordHash)) {
    return { ok: false, error: "旧密码错误" };
  }
  user.passwordHash = hashPassword(newPassword);
  const saved = await saveUser(user);
  if (!saved) {
    return { ok: false, error: "保存失败，请重试" };
  }
  return { ok: true };
}

/** 更新用户信息到 Redis */
async function saveUser(user: User): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  const r = await redis.set(`user:${user.id}`, JSON.stringify(user));
  return r === "OK";
}

/** 设置用户套餐等级 */
export async function setUserTier(
  userId: string,
  tier: UserTier,
  expiresAt: string | null
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  user.tier = tier;
  user.tierExpiresAt = expiresAt;
  return saveUser(user);
}

/**
 * 检查套餐是否已过期，过期则自动降级为免费版
 * 在每次获取用户信息时调用
 */
export async function checkTierExpiry(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;
  if (user.tier === "free" || !user.tierExpiresAt) return;

  const now = new Date();
  const expiresAt = new Date(user.tierExpiresAt);
  if (now >= expiresAt) {
    const oldTier = user.tier;
    user.tier = "free";
    user.tierExpiresAt = null;
    await saveUser(user);
    console.log(`[tier] 套餐到期降级 userId=${userId} 旧等级=${oldTier}`);
  }
}
