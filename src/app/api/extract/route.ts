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
        ? "你是课件知识点提取专家。从以下文字中提取关键知识点，输出 JSON 格式的知识卡片。\n\n要求：\n1. 过滤无关内容（页码、页脚装饰、版权声明、导航文字、目录、重复标题等）\n2. 仅提取核心知识点——定义、公式、定理/定律、重要结论、分类/对比、流程/步骤、关键日期/事件、统计数据、人名/理论\n3. 学会判断：区分「核心知识点」和「辅助说明」，只提取核心知识点\n4. 以下内容不要提取：\n   - 举例说明（例如「比如」、「例如」后面的具体示例）\n   - 顺带提及的次要信息\n   - 对某个知识点的详细展开（保留核心结论即可）\n   - 同一观点的不同表达/重复说明\n5. 不同概念必须拆成不同卡片\n6. 每个卡片：标题 + 核心说明（15-40字，讲清要点即可，不需要展开）"
        : "You are a course material knowledge extraction expert. Extract KEY knowledge points from the text below as JSON cards.\n\nRequirements:\n1. Filter irrelevant content (page numbers, decorative footers, copyright notices, navigation text, table of contents, repeated headings, etc.)\n2. Extract ONLY core knowledge points — definitions, formulas, theorems/laws, key conclusions, comparisons/contrasts, processes/steps, important dates/events, statistics/data, people/theories\n3. Use judgment: distinguish 'core knowledge' from 'supporting content'. Only extract core knowledge.\n4. Do NOT extract:\n   - Examples or illustrations (text following 'for example', 'such as', 'e.g.')\n   - Tangential or secondary mentions\n   - Detailed elaboration (keep only the core conclusion)\n   - Repeated or rephrased statements of the same idea\n5. Different concepts MUST be separate cards\n6. Each card: concise title + core explanation (15-40 words, key point only)"}
7. ${instruction}
8. ${lang === "zh" ? "质量比数量重要：提取 3 个精炼的核心点，好过提取 15 个琐碎的细节点。" : "Quality over quantity: 3 well-chosen cards are better than 15 trivial ones."}

${lang === "zh" ? "严格按照以下 JSON 格式返回，不要有任何其他文字：" : "Return strictly the following JSON format with no other text:"}
{"cards":[{"title":"${lang === "zh" ? "知识点标题" : "Point title"}","summary":"${lang === "zh" ? "核心说明（15-40字）" : "Core explanation (15-40 words)"}"}]}

${langInstruction}

${lang === "zh" ? "课件内容：" : "Course material:"}
${content.slice(0, MAX_EXTRACT_CHARS)}`;

    // 第一次：系统性提取
    const prompt1 = buildPrompt(
      lang === "zh"
        ? "通读全文，先识别所有核心主题，再逐个输出。按课件内容出现的顺序排列卡片。只提取核心知识点，过滤非关键内容。"
        : "Read through the full content. First identify all core topics, then output each one by one. Order by sequence. Extract only core knowledge points."
    );
    let { text: raw, usage } = await chat(prompt1, { model: model as ModelId });
    let parsed = parseJsonFromLLM(raw);
    let data = responseSchema.parse(parsed);

    // 如果第一次返回空卡片，用更宽松的提示重试
    if (data.cards.length === 0) {
      const prompt2 = buildPrompt(
        lang === "zh"
          ? "请重新分析。重点关注课件中明显强调的核心概念和关键结论，忽略举例和次要说明。注意：定义、公式、定理、重要结论是必须提取的。"
          : "Re-analyze. Focus on clearly emphasized core concepts and key conclusions. Skip examples and secondary explanations. Note: definitions, formulas, theorems, and key conclusions MUST be extracted."
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
