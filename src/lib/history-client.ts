/**
 * 历史数据客户端：登录用户走 API（云端），未登录走 localStorage
 */
import type { Card, ChatMessage } from "./api-client";
import type { SessionMeta, SessionData } from "./store";

// ── localStorage 后备 ──
const HISTORY_INDEX_KEY = "finalspass:history:index";
const SESSION_PREFIX = "finalspass:session:data:";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}
function lsRemove(key: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(key); } catch {}
}

// ── 云端 API ──
async function apiGet<T>(url: string, fallback: T): Promise<T> {
  try { const r = await fetch(url); if (!r.ok) return fallback; return (await r.json()).sessions ?? fallback; }
  catch { return fallback; }
}

async function apiGetFull<T>(url: string, fallback: T): Promise<T> {
  try { const r = await fetch(url); if (!r.ok) return fallback; return await r.json(); }
  catch { return fallback; }
}

async function apiPost(url: string, body: unknown): Promise<{ id?: string }> {
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.ok ? await r.json() : {}; }
  catch { return {}; }
}

async function apiDelete(url: string): Promise<boolean> {
  try { const r = await fetch(url, { method: "DELETE" }); return r.ok; }
  catch { return false; }
}

// ── 导出函数 ──

/** 获取历史列表 */
export async function fetchSessions(isLoggedIn: boolean): Promise<SessionMeta[]> {
  if (isLoggedIn) return apiGet<SessionMeta[]>("/api/user/history", []);
  return lsGet<SessionMeta[]>(HISTORY_INDEX_KEY, []);
}

/** 保存新会话 */
export async function createSession(
  isLoggedIn: boolean,
  data: { fileName: string; pptContent: string; cards: Card[]; qaHistory: ChatMessage[] }
): Promise<string> {
  if (isLoggedIn) {
    const res = await apiPost("/api/user/history", data);
    return res.id || "";
  }
  // localStorage
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const index = lsGet<SessionMeta[]>(HISTORY_INDEX_KEY, []);
  index.unshift({ id, fileName: data.fileName, timestamp: Date.now(), cardCount: data.cards.length });
  lsSet(HISTORY_INDEX_KEY, index);
  lsSet(SESSION_PREFIX + id, { fileName: data.fileName, pptContent: data.pptContent, cards: data.cards, qaHistory: data.qaHistory });
  return id;
}

/** 加载指定会话 */
export async function loadSessionData(isLoggedIn: boolean, id: string): Promise<SessionData | null> {
  if (isLoggedIn) return apiGetFull<SessionData | null>(`/api/user/history/session?id=${id}`, null);
  return lsGet<SessionData | null>(SESSION_PREFIX + id, null);
}

/** 清空全部历史 */
export async function clearAllSessions(isLoggedIn: boolean): Promise<void> {
  if (isLoggedIn) { await apiDelete("/api/user/history?id=all"); return; }
  const index = lsGet<SessionMeta[]>(HISTORY_INDEX_KEY, []);
  for (const s of index) lsRemove(SESSION_PREFIX + s.id);
  lsSet(HISTORY_INDEX_KEY, []);
}
