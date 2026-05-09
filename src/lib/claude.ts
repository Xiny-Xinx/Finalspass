/**
 * 多模型 AI 封装
 *
 * 支持 DeepSeek（OpenAI 兼容格式）和 Anthropic Claude。
 * 所有函数通过 model 参数自动派发到对应 provider。
 */

export type Message = { role: "user" | "assistant" | "system"; content: string };

export type ModelId = "deepseek-v4-flash" | "deepseek-v4-pro" | "deepseek-chat" | "claude-sonnet-4-20250514";

export interface ModelOption {
  id: ModelId;
  label: string;
  provider: "deepseek" | "anthropic";
  description: string;
}

export const MODELS: ModelOption[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "deepseek", description: "最新 V4，速度快，1M 上下文" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "deepseek", description: "V4 旗舰版，最强能力" },
  { id: "deepseek-chat", label: "DeepSeek V3（旧）", provider: "deepseek", description: "旧版别名，2026-07-24 停用" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic", description: "质量高，适合复杂任务" },
];

/** 各套餐可用的模型 ID */
export const TIER_MODELS: Record<string, ModelId[]> = {
  free: ["deepseek-v4-flash", "deepseek-chat"],
  pro: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "claude-sonnet-4-20250514"],
  premium: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "claude-sonnet-4-20250514"],
};

/** 各模型的详细规格说明 */
export const MODEL_DETAILS: Record<ModelId, {
  summary: string;
  badge?: string;
}> = {
  "deepseek-v4-flash": {
    summary: "日常使用性价比最高，速度快、上下文 1M tokens",
    badge: "推荐",
  },
  "deepseek-v4-pro": {
    summary: "旗舰版，复杂推理/编程任务首选，上下文 1M tokens",
    badge: "最强",
  },
  "deepseek-chat": {
    summary: "旧版 V3 别名，将于 2026-07-24 停用，建议迁移到 V4 Flash",
    badge: "旧版",
  },
  "claude-sonnet-4-20250514": {
    summary: "Anthropic 最新 Sonnet，高质量回复，需配置 ANTHROPIC_API_KEY",
    badge: "高质量",
  },
};

export const DEFAULT_MODEL: ModelId = "deepseek-v4-flash";
const DEFAULT_MAX_TOKENS = 1500;

export interface ChatOptions {
  system?: string;
  history?: Message[];
  model?: ModelId;
  maxTokens?: number;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
}

// ─── DeepSeek Provider ────────────────────────────────────────────────

async function deepseekFetch(
  body: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY。请在 .env.local 中填入有效的 DeepSeek API Key。");
  }
  return fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function deepseekChat(
  messages: Message[],
  maxTokens: number,
  model: string
): Promise<{ text: string; usage: UsageInfo }> {
  const res = await deepseekFetch({
    model,
    max_tokens: maxTokens,
    messages,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DeepSeek API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? "",
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

async function deepseekChatStream(
  messages: Message[],
  maxTokens: number,
  model: string,
  onUsage?: (usage: UsageInfo) => void
): Promise<ReadableStream<string>> {
  const res = await deepseekFetch({
    model,
    max_tokens: maxTokens,
    messages,
    stream: true,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DeepSeek API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
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

// ─── Anthropic Provider ──────────────────────────────────────────────

async function anthropicFetch(
  body: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 ANTHROPIC_API_KEY。请在 .env.local 中填入有效的 Anthropic API Key。");
  }
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
}

/** 从 messages 中分离 system 和 user/assistant 消息 */
function splitSystemMessages(messages: Message[]): {
  system: string | undefined;
  normal: Message[];
} {
  const system = messages.find((m) => m.role === "system")?.content;
  const normal = messages.filter((m) => m.role !== "system") as {
    role: "user" | "assistant";
    content: string;
  }[];
  return { system, normal };
}

async function anthropicChat(
  messages: Message[],
  maxTokens: number
): Promise<{ text: string; usage: UsageInfo }> {
  const { system, normal } = splitSystemMessages(messages);

  const res = await anthropicFetch({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: normal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("")
    .trim();

  return {
    text,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * 读取 Anthropic SSE 流。
 *
 * Anthropic 使用 event/data 格式:
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
 *
 *   event: message_delta
 *   data: {"type":"message_delta","...":...,"usage":{"output_tokens":100}}
 */
async function anthropicChatStream(
  messages: Message[],
  maxTokens: number,
  onUsage?: (usage: UsageInfo) => void
): Promise<ReadableStream<string>> {
  const { system, normal } = splitSystemMessages(messages);

  const res = await anthropicFetch({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: normal,
    stream: true,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
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
        let currentEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.slice(6).trim();
            } else if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trim();
              if (!data) continue;

              if (currentEvent === "message_start") {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.message?.usage) {
                    inputTokens = parsed.message.usage.input_tokens ?? 0;
                    outputTokens = parsed.message.usage.output_tokens ?? 0;
                  }
                } catch { /* ignore */ }
              } else if (currentEvent === "content_block_delta") {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                    controller.enqueue(parsed.delta.text);
                  }
                } catch { /* ignore */ }
              } else if (currentEvent === "message_delta") {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.usage) {
                    outputTokens = parsed.usage.output_tokens ?? outputTokens;
                  }
                } catch { /* ignore */ }
              }

              currentEvent = "";
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

// ─── 派发函数 ─────────────────────────────────────────────────────────

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

  if (model.startsWith("claude")) {
    return anthropicChat(messages, maxTokens);
  }
  return deepseekChat(messages, maxTokens, model);
}

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

  if (model.startsWith("claude")) {
    return anthropicChatStream(messages, maxTokens, onUsage);
  }
  return deepseekChatStream(messages, maxTokens, model, onUsage);
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
