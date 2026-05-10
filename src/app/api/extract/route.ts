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

    const prompt = `${lang === "zh" ? "你是课堂笔记助手。以下是课件文字内容，请：" : "You are a lecture note assistant. Given the following course material:"}
1. ${lang === "zh" ? "过滤无关内容（页码、装饰文字、版权信息、重复内容等）" : "Filter out irrelevant content (page numbers, decorative text, copyright info, repetitions, etc.)"}
2. ${lang === "zh" ? "提炼核心知识点，知识点多就多提炼、少就少提炼，不要凑数" : "Extract the core knowledge points — more if the material is rich, fewer if it is sparse. Do not pad."}
3. ${lang === "zh" ? "每个知识点：标题简短 + 简要说明（10-30字）" : "Each point: a short title + brief description (10-30 words)"}

${lang === "zh" ? "严格返回以下 JSON，不要有任何其他文字：" : "Return strictly the following JSON with no other text:"}
{"cards":[{"title":"${lang === "zh" ? "知识点标题" : "Point title"}","summary":"${lang === "zh" ? "简要说明" : "Brief description"}"}]}

${langInstruction}

${lang === "zh" ? "课件内容：" : "Course material:"}
${content.slice(0, MAX_EXTRACT_CHARS)}`;

    const { text: raw, usage } = await chat(prompt, { model: model as ModelId });
    const parsed = parseJsonFromLLM(raw);
    const data = responseSchema.parse(parsed);

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
