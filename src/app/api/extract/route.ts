import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, parseJsonFromLLM } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { MAX_EXTRACT_CHARS } from "@/lib/constants";
import { withQuota } from "@/lib/quota-guard";

const requestSchema = z.object({
  content: z.string().min(1, "内容为空"),
});

const responseSchema = z.object({
  cards: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
      })
    )
    .min(1, "AI 未生成任何知识点"),
});

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { content } = requestSchema.parse(body);

    const prompt = `你是课堂笔记助手。以下是课件文字内容,请:
1. 过滤无关内容(页码、装饰文字、版权信息、重复内容等)
2. 提炼 5-10 个核心知识点
3. 每个知识点:标题(10字内) + 简要说明(60字内)

严格返回 JSON,不要有任何其他文字:
{"cards":[{"title":"知识点标题","summary":"简要说明"}]}

课件内容:
${content.slice(0, MAX_EXTRACT_CHARS)}`;

    const { text: raw, usage } = await chat(prompt);
    const parsed = parseJsonFromLLM(raw);
    const data = responseSchema.parse(parsed);

    // 自动扣除 tokens（登录用户扣余额，游客扣每日限额）
    await guard.deduct(usage.input_tokens + usage.output_tokens);

    return NextResponse.json({ cards: data.cards });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    return errorResponse(error);
  }
}
