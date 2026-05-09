import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, parseJsonFromLLM } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { MAX_QUIZ_CHARS } from "@/lib/constants";

const requestSchema = z.object({
  content: z.string().min(1, "内容为空"),
  count: z.number().int().min(1).max(20).optional().default(5),
  type: z.enum(["mixed", "choice", "judge"]).optional().default("mixed"),
});

const questionSchema = z.object({
  type: z.enum(["choice", "judge"]),
  question: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.string(),
  explanation: z.string(),
});

const responseSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

const TYPE_LABEL: Record<string, string> = {
  mixed: "单选题和判断题混合",
  choice: "单选题",
  judge: "判断题",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, count, type } = requestSchema.parse(body);

    const prompt = `基于以下课件内容,生成 ${count} 道${TYPE_LABEL[type]}练习题。

规则:
- 单选题:4 个选项(A/B/C/D),answer 字段填写完整选项文字(如 "A.牛顿第一定律")
- 判断题:选项为 ["正确", "错误"],answer 字段填写 "正确" 或 "错误"
- 每题附 30 字内解析
- 题目来自课件核心内容,不出偏题

严格返回 JSON,不要其他文字:
{"questions":[
  {"type":"choice","question":"题目内容","options":["A.选项1","B.选项2","C.选项3","D.选项4"],"answer":"A.选项1","explanation":"解析"},
  {"type":"judge","question":"判断题内容","options":["正确","错误"],"answer":"正确","explanation":"解析"}
]}

课件内容:
${content.slice(0, MAX_QUIZ_CHARS)}`;

    const raw = await chat(prompt);
    const parsed = parseJsonFromLLM(raw);
    const data = responseSchema.parse(parsed);

    return NextResponse.json({ questions: data.questions });
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
