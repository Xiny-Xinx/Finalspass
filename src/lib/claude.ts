/**
 * DeepSeek API 封装（OpenAI 兼容格式）
 *
 * 使用 fetch 直连 api.deepseek.com，无需额外 SDK。
 */

export type Message = { role: "user" | "assistant" | "system"; content: string };

const DEEPSEEK_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MAX_TOKENS = 1500;

export interface ChatOptions {
  system?: string;
  history?: Message[];
  model?: string;
  maxTokens?: number;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
}

/** 通用 fetch 封装 */
async function deepseekFetch(
  body: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "未配置 DEEPSEEK_API_KEY。请在 .env.local 中填入有效的 DeepSeek API Key。"
    );
  }
  return fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export async function chat(
  userMsg: string,
  options: ChatOptions = {}
): Promise<{ text: string; usage: UsageInfo }> {
  const {
    system,
    history = [],
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  const messages: Message[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    ...history,
    { role: "user" as const, content: userMsg },
  ];

  const res = await deepseekFetch({
    model,
    max_tokens: maxTokens,
    messages,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(
      `DeepSeek API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    text,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * 流式对话（SSE）。返回 ReadableStream<string>，逐步产出 text delta。
 */
export async function chatStream(
  userMsg: string,
  options: ChatOptions & { onUsage?: (usage: UsageInfo) => void } = {}
): Promise<ReadableStream<string>> {
  const {
    system,
    history = [],
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    onUsage,
  } = options;

  const messages: Message[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    ...history,
    { role: "user" as const, content: userMsg },
  ];

  const res = await deepseekFetch({
    model,
    max_tokens: maxTokens,
    messages,
    stream: true,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(
      `DeepSeek API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`
    );
  }

  let inputTokens = 0;
  let outputTokens = 0;
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  return new ReadableStream({
    async start(controller) {
      try {
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                controller.enqueue(delta.content);
              }
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
                outputTokens = parsed.usage.completion_tokens ?? outputTokens;
              }
            } catch {
              // 忽略解析失败的 chunk
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        if (onUsage && (inputTokens > 0 || outputTokens > 0)) {
          onUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
        }
      }
    },
    cancel() {
      reader.cancel();
      if (onUsage && (inputTokens > 0 || outputTokens > 0)) {
        onUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
      }
    },
  });
}

/**
 * 从 LLM 输出中稳健地抽取 JSON。
 */
export function parseJsonFromLLM<T = unknown>(raw: string): T {
  let s = raw.replace(/```(?:json)?/gi, "").trim();

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  try {
    return JSON.parse(s) as T;
  } catch (err) {
    throw new Error(
      `AI 返回的内容不是有效 JSON: ${
        err instanceof Error ? err.message : "解析失败"
      }`
    );
  }
}
