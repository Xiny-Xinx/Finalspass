/**
 * 前端调用后端 API 的轻量封装。
 * 统一处理 JSON 解析、错误窄化、AbortSignal 透传。
 */

import { DEFAULT_MODEL, type ModelId } from "@/lib/claude";

interface FetchJsonOptions {
  signal?: AbortSignal;
}

async function postJson<T>(
  url: string,
  body: unknown,
  options: FetchJsonOptions = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("网络请求失败,请检查连接");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`服务端响应异常 (HTTP ${res.status})`);
  }

  if (!res.ok || (data && typeof data === "object" && "error" in data)) {
    const message =
      (data as { error?: string })?.error ?? `请求失败 (HTTP ${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

export interface Card {
  title: string;
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MemoryRef {
  question: string;
  answer: string;
  timestamp: number;
}

export interface QuizQuestion {
  type: "choice" | "judge";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export function extractCards(
  content: string,
  options?: FetchJsonOptions & { model?: ModelId }
): Promise<{ cards: Card[] }> {
  return postJson("/api/extract", { content, model: options?.model ?? DEFAULT_MODEL }, options);
}

/** 视觉提取：将 PDF 页面图片发给 AI 直接看图提炼知识点 */
export function extractCardsFromImages(
  images: string[],
  options?: FetchJsonOptions & { model?: ModelId }
): Promise<{ cards: Card[] }> {
  return postJson("/api/extract/vision", { images, model: options?.model ?? DEFAULT_MODEL }, options);
}

export function askQuestion(
  payload: {
    question: string;
    context?: string;
    history?: ChatMessage[];
    mode?: "qa" | "detail";
    lang?: "zh" | "en";
    memories?: MemoryRef[];
    model?: ModelId;
  },
  options?: FetchJsonOptions
): Promise<{ answer: string }> {
  return postJson("/api/chat", { ...payload, model: payload.model ?? DEFAULT_MODEL }, options);
}

export function generateQuiz(
  payload: {
    content: string;
    count: number;
    type: "mixed" | "choice" | "judge";
    model?: ModelId;
  },
  options?: FetchJsonOptions
): Promise<{ questions: QuizQuestion[] }> {
  return postJson("/api/quiz", { ...payload, model: payload.model ?? DEFAULT_MODEL }, options);
}

/**
 * 流式问答: 返回一个 ReadableStream<string>，逐步产出 text delta。
 * 如果请求被取消，通过 signal 触发 AbortError。
 */
export function askQuestionStream(
  payload: {
    question: string;
    context?: string;
    history?: ChatMessage[];
    mode?: "qa" | "detail";
    memories?: MemoryRef[];
    model?: ModelId;
  },
  options?: FetchJsonOptions
): { stream: Promise<ReadableStream<string>>; abort: () => void } {
  const ctrl = new AbortController();
  const stream = (async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model: payload.model ?? DEFAULT_MODEL, stream: true }),
      signal: options?.signal ?? ctrl.signal,
    });

    if (!res.ok) {
      let msg = `请求失败 (HTTP ${res.status})`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {}
      throw new Error(msg);
    }

    return res.body!.pipeThrough(new TextDecoderStream());
  })();

  return { stream, abort: () => ctrl.abort() };
}
