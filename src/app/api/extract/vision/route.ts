import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonFromLLM, DEFAULT_MODEL } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { withQuota } from "@/lib/quota-guard";
import { EXTRACT_QUOTA_COST } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const requestSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(30),
  model: z.string().optional().default(DEFAULT_MODEL),
});

const cardSchema = z.object({
  title: z.string(),
  summary: z.string(),
});

const responseSchema = z.object({
  cards: z.array(cardSchema),
});

/**
 * 调用 Anthropic Claude API 处理视觉提取（Claude 原生支持图片分析）
 */
async function callClaudeVision(
  images: string[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 未配置——视觉提取需要配置 Claude");

  // 构建 content 块：文字说明 + 图片
  const content: any[] = [
    {
      type: "text",
      text: `You are a course material analysis expert. I will give you images of slides or pages. Please:

1. Identify the CORE knowledge points only: definitions, formulas, theorems/laws, key conclusions, important processes
2. Use judgment: distinguish 'core knowledge' from 'supporting content'. Only extract core knowledge.
3. Do NOT extract:
   - Examples or illustrations
   - Tangential or secondary mentions
   - Detailed elaboration or extra explanation (keep only the core conclusion)
   - Repeated or rephrased statements of the same idea
4. If something is just an example or a passing comment, skip it
5. Different concepts MUST be separate cards
6. Each card: concise title + core explanation (15-40 words, key point only)
7. Order cards by the sequence they appear in the slides
8. Quality over quantity: 3 well-chosen cards are better than 15 trivial ones

Return strictly the following JSON with no other text:
{"cards":[{"title":"Point title","summary":"Core explanation (15-40 words)"}]}

Output in the same language as the slide content (Chinese or English).`,
    },
  ];

  for (const img of images) {
    // img 格式: data:image/jpeg;base64,xxxx
    const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: match[1], data: match[2] },
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { images } = requestSchema.parse(body);

    // 多页 PDF 分批处理，每批最多 3 页（减少超时和 token 消耗）
    const BATCH_SIZE = 3;
    const allCards: Array<{ title: string; summary: string }> = [];

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const raw = await callClaudeVision(batch);
      const parsed = parseJsonFromLLM(raw);
      const data = responseSchema.parse(parsed);
      allCards.push(...data.cards);
    }

    // AI 调用成功后扣除配额（按批次数扣）
    const batches = Math.ceil(images.length / BATCH_SIZE);
    await guard.deduct(EXTRACT_QUOTA_COST * batches);

    return NextResponse.json({ cards: allCards });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error("[extract-vision] Zod 校验失败:", error.issues);
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      console.error("[extract-vision]", error.message.slice(0, 300));
    }
    return errorResponse(error);
  }
}
