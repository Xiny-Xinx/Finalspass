import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, chatStream } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { MAX_CHAT_HISTORY, MAX_QA_CONTEXT_CHARS } from "@/lib/constants";
import { withQuota } from "@/lib/quota-guard";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const memorySchema = z.object({
  question: z.string(),
  answer: z.string(),
  timestamp: z.number(),
});

const requestSchema = z.object({
  question: z.string().min(1, "问题不能为空"),
  context: z.string().optional().default(""),
  history: z.array(messageSchema).optional().default([]),
  mode: z.enum(["qa", "detail"]).optional().default("qa"),
  stream: z.boolean().optional().default(false),
  memories: z.array(memorySchema).optional().default([]),
});

const DETAIL_SYSTEM =
  `你是课堂知识点讲解助手。请对指定知识点进行详细解释。
要求:深入浅出,包含核心概念、重要细节、实际意义或举例,200-350字,中文,可以用 Markdown 格式(加粗、列表等)。`;

function buildSystem(mode: string, context: string, memories: { question: string; answer: string }[]): string {
  if (mode === "detail") return DETAIL_SYSTEM;

  let sys = `你是课堂学习助手。基于以下课件内容回答学生问题,简洁准确,必要时举例,用中文回答。

课件内容:
${context.slice(0, MAX_QA_CONTEXT_CHARS)}`;

  if (memories.length > 0) {
    sys += `\n\n## 历史记忆参考(你之前和学生的对话记录)\n`;
    for (const m of memories) {
      sys += `- 学生问: ${m.question}\n  你答: ${m.answer.slice(0, 300)}\n`;
    }
    sys += `\n如果当前问题与以上记忆相关,请参考历史回答保持一致性;如果不相关,请忽略。`;
  }

  return sys;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { question, context, history, mode, stream, memories } = requestSchema.parse(body);

    const system = buildSystem(mode, context, memories);

    const trimmedHistory =
      mode === "detail" ? [] : history.slice(-MAX_CHAT_HISTORY);

    // 流式模式
    if (stream) {
      const readable = await chatStream(question, {
        system,
        history: trimmedHistory,
        onUsage(usage) {
          // 流结束后自动扣除 tokens
          guard.deduct(usage.input_tokens + usage.output_tokens);
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 非流式
    const { text: answer, usage } = await chat(question, {
      system,
      history: trimmedHistory,
    });

    // 自动扣除 tokens
    await guard.deduct(usage.input_tokens + usage.output_tokens);

    return NextResponse.json({ answer });
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
