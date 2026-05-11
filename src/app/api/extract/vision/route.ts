import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonFromLLM, DEFAULT_MODEL } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { withQuota } from "@/lib/quota-guard";
import { EXTRACT_QUOTA_COST } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const apiKey = process.env.DEEPSEEK_API_KEY;

async function callDeepSeekVision(
  images: string[],
  model: string
): Promise<string> {
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

  const content: any[] = [
    {
      type: "text",
      text: `You are a lecture note assistant. I will give you images of course slides/pages. Please:
1. Extract ALL text and information visible in each image
2. Identify the key knowledge points, definitions, formulas, theorems, and important concepts
3. Return the knowledge points as JSON cards

Return strictly the following JSON with no other text:
{"cards":[{"title":"Point title","summary":"Brief description"}]}

Output in the same language as the content (Chinese or English).`,
    },
  ];

  for (const img of images) {
    content.push({
      type: "image_url",
      image_url: { url: img, detail: "high" },
    });
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DeepSeek API 请求失败 (HTTP ${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { images, model } = requestSchema.parse(body);

    // 多页 PDF 分批处理，每批最多 3 页（减少超时和 token 消耗）
    const BATCH_SIZE = 3;
    const allCards: Array<{ title: string; summary: string }> = [];

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const raw = await callDeepSeekVision(batch, model);
      const parsed = parseJsonFromLLM(raw);
      const data = responseSchema.parse(parsed);
      allCards.push(...data.cards);
    }

    // AI 调用成功后扣除配额（按批次数扣）
    const batches = Math.ceil(images.length / BATCH_SIZE);
    await guard.deduct(EXTRACT_QUOTA_COST * batches, model);

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
