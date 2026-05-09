import Anthropic from "@anthropic-ai/sdk";

export type Message = { role: "user" | "assistant"; content: string };

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1500;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-api03-xxxxxxxx")) {
    throw new Error(
      "未配置 ANTHROPIC_API_KEY。请在 .env.local 中填入有效的 Claude API Key。"
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

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

  const client = getClient();
  const messages = [...history, { role: "user" as const, content: userMsg }];

  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return { text, usage: res.usage };
}

/**
 * 流式对话（SSE）。返回一个 ReadableStream<string>，每次 yield 一个 text delta。
 * 通过 onUsage 回调返回精确的 token 消耗。
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

  const client = getClient();
  const messages = [...history, { role: "user" as const, content: userMsg }];

  const stream = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
    stream: true,
  });

  let inputTokens = 0;
  let outputTokens = 0;

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "message_start") {
            inputTokens = event.message.usage.input_tokens;
          }
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(event.delta.text);
          }
          if (event.type === "message_delta") {
            outputTokens = event.usage.output_tokens;
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
      // 客户端断开时仍然上报已消耗的 token（input 已确定，output 可能为 0）
      if (onUsage && (inputTokens > 0 || outputTokens > 0)) {
        onUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
      }
    },
  });
}

/**
 * 从 LLM 输出中稳健地抽取 JSON。
 * 处理 ```json 包裹、前后多余文字、首尾不平衡等常见问题。
 */
export function parseJsonFromLLM<T = unknown>(raw: string): T {
  // 去掉 markdown 代码围栏
  let s = raw.replace(/```(?:json)?/gi, "").trim();

  // 截取第一个 { 到最后一个 } 之间的内容(LLM 偶尔会前后多说一句话)
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
