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
      `${lang === "zh"
        ? "你是课件知识点提取专家。从以下文字中提取所有独立的知识点，输出 JSON 格式的知识卡片。\n\n要求：\n1. 过滤无关内容（页码、页脚装饰、版权声明、导航文字、目录、重复标题等）\n2. 识别每个独立的知识点——定义、公式、定理/定律、重要结论、分类/对比、流程/步骤、关键日期/事件、统计数据、人名/理论\n3. 不同概念必须拆成不同卡片，不要合并到一条\n4. 每个卡片：标题（简洁概括）+ 核心说明（15-50字，讲清要点）"
        : "You are a course material knowledge extraction expert. Extract ALL distinct knowledge points from the text below as JSON cards.\n\nRequirements:\n1. Filter irrelevant content (page numbers, decorative footers, copyright notices, navigation text, table of contents, repeated headings, etc.)\n2. Identify each distinct knowledge point — definitions, formulas, theorems/laws, key conclusions, comparisons/contrasts, processes/steps, important dates/events, statistics/data, people/theories\n3. Different concepts MUST be separate cards, do NOT merge them\n4. Each card: concise title + core explanation (15-50 words covering the key point)"}
5. ${instruction}
6. ${lang === "zh" ? "宁可多提取也不要遗漏。拿不准的内容也作为知识点提取。" : "Better to over-extract than miss something. If unsure, still extract it as a knowledge point."}

${lang === "zh" ? "严格按照以下 JSON 格式返回，不要有任何其他文字：" : "Return strictly the following JSON format with no other text:"}
{"cards":[{"title":"${lang === "zh" ? "知识点标题" : "Point title"}","summary":"${lang === "zh" ? "核心说明（15-50字）" : "Core explanation (15-50 words)"}"}]}

${langInstruction}

${lang === "zh" ? "课件内容：" : "Course material:"}
${content.slice(0, MAX_EXTRACT_CHARS)}`;

    // 第一次：系统性提取
    const prompt1 = buildPrompt(
      lang === "zh"
        ? "通读全文，系统性地提取所有知识点。先扫描一遍全文识别所有主题，再逐个输出。按照课件内容出现的顺序排列卡片。"
        : "Read through the entire content systematically. First scan the full text to identify all topics, then output each one one by one. Order the cards by the sequence they appear in the material."
    );
    let { text: raw, usage } = await chat(prompt1, { model: model as ModelId });
    let parsed = parseJsonFromLLM(raw);
    let data = responseSchema.parse(parsed);

    // 如果第一次返回空卡片，用更宽松的提示重试
    if (data.cards.length === 0) {
      const prompt2 = buildPrompt(
        lang === "zh"
          ? "请重新仔细分析。每一句承载了独立信息的话都应该作为一个知识点输出，不要遗漏任何内容。特别留意：小标题、列表项、定义句、结论句、标注或强调内容。"
          : "Re-analyze carefully. Every sentence carrying distinct information should be a knowledge point. Pay special attention to: subheadings, list items, definitions, conclusions, highlighted or emphasized content."
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
