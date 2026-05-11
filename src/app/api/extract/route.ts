import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, parseJsonFromLLM, DEFAULT_MODEL, type ModelId } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { MAX_EXTRACT_CHARS } from "@/lib/constants";
import { withQuota } from "@/lib/quota-guard";
import { EXTRACT_QUOTA_COST } from "@/lib/constants";

const requestSchema = z.object({
  content: z.string().min(1, "内容为空"),
  model: z.string().optional().default(DEFAULT_MODEL),
});

const responseSchema = z.object({
  cards: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
    })
  ),
});

/** 检测内容主体语言 */
function detectLang(text: string): "zh" | "en" {
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cjk > latin ? "zh" : "en";
}

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { content, model } = requestSchema.parse(body);

    const lang = detectLang(content);
    const langInstruction =
      lang === "zh"
        ? "请用中文输出总结。"
        : "Output the summary in English.";

    const buildPrompt = (instruction: string): string =>
      `${lang === "zh" ? "你是课堂笔记助手。以下是课件文字内容，请：" : "You are a lecture note assistant. Given the following course material:"}
1. ${lang === "zh" ? "过滤无关内容（页码、装饰文字、版权信息、重复内容等）" : "Filter out irrelevant content (page numbers, decorative text, copyright info, repetitions, etc.)"}
2. ${instruction}
3. ${lang === "zh" ? "每个知识点：标题简短 + 简要说明（10-30字）" : "Each point: a short title + brief description (10-30 words)"}

${lang === "zh" ? "严格返回以下 JSON，不要有任何其他文字：" : "Return strictly the following JSON with no other text:"}
{"cards":[{"title":"${lang === "zh" ? "知识点标题" : "Point title"}","summary":"${lang === "zh" ? "简要说明" : "Brief description"}"}]}

${langInstruction}

${lang === "zh" ? "课件内容：" : "Course material:"}
${content.slice(0, MAX_EXTRACT_CHARS)}`;

    // 第一次：尽量提炼
    const prompt1 = buildPrompt(
      lang === "zh"
        ? "尽可能从文字中提炼知识点，即使内容不完整、格式混乱也要尽力提取，每个知识点用一句话概括"
        : "Extract every possible knowledge point. If the text is incomplete or messy, still extract whatever you can. Summarize each point in one sentence."
    );
    let { text: raw, usage } = await chat(prompt1, { model: model as ModelId });
    let parsed = parseJsonFromLLM(raw);
    let data = responseSchema.parse(parsed);

    // 如果第一次返回空卡片，用更宽松的提示重试
    if (data.cards.length === 0) {
      const prompt2 = buildPrompt(
        lang === "zh"
          ? "请直接从以下文字中提取关键信息，每一条信息都算一个知识点，不要遗漏任何内容"
          : "Extract ALL key information from the text below. Every piece of information counts as a knowledge point. Do not skip anything."
      );
      const retry = await chat(prompt2, { model: model as ModelId });
      raw = retry.text;
      parsed = parseJsonFromLLM(raw);
      data = responseSchema.parse(parsed);
    }

    // AI 调用成功后扣除配额（超时/失败不扣费）
    await guard.deduct(EXTRACT_QUOTA_COST, model);

    return NextResponse.json({ cards: data.cards });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error("[extract] Zod 校验失败:", error.issues);
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      console.error("[extract]", error.message.slice(0, 300));
    }
    return errorResponse(error);
  }
}
