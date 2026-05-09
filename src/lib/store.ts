/**
 * 持久化存储工具：会话历史、记忆型 AI、测验状态
 *
 * 分层存储方案:
 *   - HISTORY_INDEX_KEY → SessionMeta[]（轻量索引，列表展示用）
 *   - SESSION_PREFIX + id → SessionData（完整会话数据）
 *   - MEMORY_KEY → MemoryItem[]（积累的 Q&A 记忆）
 *   - QUIZ_PREFIX + fileName → QuizState（测验进度）
 */

import type { Card } from "./api-client";
import type { ChatMessage } from "./api-client";

/* ── Types ── */

export interface SessionMeta {
  id: string;
  fileName: string;
  timestamp: number;
  cardCount: number;
}

export interface SessionData {
  fileName: string;
  pptContent: string;
  cards: Card[];
  qaHistory: ChatMessage[];
}

export interface MemoryItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  timestamp: number;
}

export interface QuizState {
  type: "mixed" | "choice" | "judge";
  count: number;
  questions: import("./api-client").QuizQuestion[];
  answers: Record<number, string>;
}

/* ── Constants ── */

const HISTORY_INDEX_KEY = "finalspass:history:index";
const SESSION_PREFIX = "finalspass:session:data:";
const MEMORY_KEY = "finalspass:memory";
const QUIZ_PREFIX = "finalspass:quiz:";

const MAX_MEMORIES = 200;

/* ── Helpers ── */

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* ── Session History ── */

export function listSessions(): SessionMeta[] {
  return safeGet<SessionMeta[]>(HISTORY_INDEX_KEY, []);
}

export function saveSession(data: {
  fileName: string;
  pptContent: string;
  cards: Card[];
  qaHistory: ChatMessage[];
}): string {
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const meta: SessionMeta = {
    id,
    fileName: data.fileName,
    timestamp: Date.now(),
    cardCount: data.cards.length,
  };

  // Prepend to index
  const index = listSessions();
  index.unshift(meta);
  safeSet(HISTORY_INDEX_KEY, index);

  // Save full data
  const sessionData: SessionData = {
    fileName: data.fileName,
    pptContent: data.pptContent,
    cards: data.cards,
    qaHistory: data.qaHistory,
  };
  safeSet(SESSION_PREFIX + id, sessionData);

  return id;
}

export function loadSession(id: string): SessionData | null {
  return safeGet<SessionData | null>(SESSION_PREFIX + id, null);
}

export function updateSessionQaHistory(
  id: string,
  qaHistory: ChatMessage[]
): void {
  const data = loadSession(id);
  if (data) {
    data.qaHistory = qaHistory;
    safeSet(SESSION_PREFIX + id, data);
  }
}

export function deleteSession(id: string): void {
  safeRemove(SESSION_PREFIX + id);
  const index = listSessions().filter((s) => s.id !== id);
  safeSet(HISTORY_INDEX_KEY, index);
}

export function clearAllSessions(): void {
  const index = listSessions();
  for (const s of index) {
    safeRemove(SESSION_PREFIX + s.id);
  }
  safeSet(HISTORY_INDEX_KEY, []);
}

/* ── Memory AI ── */

/** Extract simple keywords from Chinese/English text */
function extractKeywords(text: string): string[] {
  // Split on spaces, punctuation, and Chinese characters
  const tokens = text
    .toLowerCase()
    .replace(/[^\w一-鿿]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Remove very short tokens and common stop words
  const stopWords = new Set([
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
    "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你",
    "会", "着", "没有", "看", "好", "自己", "这", "他", "她", "它",
    "们", "那", "些", "什么", "怎么", "为什么", "如何", "哪个",
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "shall",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "about", "like", "through", "after", "over",
  ]);

  return Array.from(new Set(tokens)).filter(
    (t) => t.length >= 2 && !stopWords.has(t)
  );
}

/** Store a Q&A pair as a memory item */
export function saveMemory(question: string, answer: string): void {
  const keywords = extractKeywords(question + " " + answer);
  const item: MemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    question: question.slice(0, 200),
    answer: answer.slice(0, 500),
    keywords,
    timestamp: Date.now(),
  };

  const memories = safeGet<MemoryItem[]>(MEMORY_KEY, []);
  memories.unshift(item);

  // Trim to max
  if (memories.length > MAX_MEMORIES) {
    memories.length = MAX_MEMORIES;
  }

  safeSet(MEMORY_KEY, memories);
}

/** Find memories relevant to a query */
export function getRelevantMemories(query: string, maxResults = 3): MemoryItem[] {
  const memories = safeGet<MemoryItem[]>(MEMORY_KEY, []);
  if (memories.length === 0) return [];

  const queryKeywords = new Set(extractKeywords(query));

  // Score each memory by keyword overlap
  const scored = memories
    .map((m) => {
      const overlap = m.keywords.filter((k) => queryKeywords.has(k)).length;
      // Bonus for recency (within last 7 days)
      const recencyBonus =
        Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000 ? 0.5 : 0;
      return { memory: m, score: overlap + recencyBonus };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map((s) => s.memory);
}

export function getAllMemories(): MemoryItem[] {
  return safeGet<MemoryItem[]>(MEMORY_KEY, []);
}

export function clearAllMemories(): void {
  safeRemove(MEMORY_KEY);
}

/* ── Quiz Persistence ── */

export function saveQuizState(fileName: string, state: QuizState): void {
  safeSet(QUIZ_PREFIX + fileName, state);
}

export function loadQuizState(fileName: string): QuizState | null {
  return safeGet<QuizState | null>(QUIZ_PREFIX + fileName, null);
}

export function clearQuizState(fileName: string): void {
  safeRemove(QUIZ_PREFIX + fileName);
}
