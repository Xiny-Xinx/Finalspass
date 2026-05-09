import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, parseJsonFromLLM } from "@/lib/claude";
import { errorResponse } from "@/lib/errors";
import { MAX_QUIZ_CHARS } from "@/lib/constants";
import { withQuota } from "@/lib/quota-guard";

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

/** 检测内容主体语言 */
function detectLang(text: string): "zh" | "en" {
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cjk > latin ? "zh" : "en";
}

const TYPE_LABEL: Record<string, string> = {
  mixed: "单选题和判断题混合",
  choice: "单选题",
  judge: "判断题",
};

const TYPE_LABEL_EN: Record<string, string> = {
  mixed: "multiple choice and true/false",
  choice: "multiple choice",
  judge: "true/false",
};

export async function POST(req: NextRequest) {
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { content, count, type } = requestSchema.parse(body);

    const lang = detectLang(content);
    const isZh = lang === "zh";

    const prompt = isZh
      ? `基于以下课件内容，生成 ${count} 道${TYPE_LABEL[type]}练习题。

规则:
- 单选题:4 个选项(A/B/C/D)，answer 字段填写完整选项文字(如 "A.牛顿第一定律")
- 判断题:选项为 ["正确", "错误"],answer 字段填写"正确"或"错误"
- 每题附 30 字内解析
- 题目来自课件核心内容,不出偏题

严格返回 JSON,不要其他文字:
{"questions":[
  {"type":"choice","question":"题目内容","options":["A.选项1","B.选项2","C.选项3","D.选项4"],"answer":"A.选项1","explanation":"解析"},
  {"type":"judge","question":"判断题内容","options":["正确","错误"],"answer":"正确","explanation":"解析"}
]}

课件内容:
${content.slice(0, MAX_QUIZ_CHARS)}`
      : `Based on the following course material, generate ${count} ${TYPE_LABEL_EN[type]} questions.

Rules:
- Multiple choice: 4 options (A/B/C/D), answer field should contain the full option text (e.g. "A. Newton's First Law")
- True/false: options are ["True", "False"], answer field should be "True" or "False"
- Each question must include a brief explanation (≤30 words)
- Questions must be based on the core content of the material, no off-topic questions

Return strictly the following JSON with no other text:
{"questions":[
  {"type":"choice","question":"Question text","options":["A. Option 1","B. Option 2","C. Option 3","D. Option 4"],"answer":"A. Option 1","explanation":"Explanation"},
  {"type":"judge","question":"Question text","options":["True","False"],"answer":"True","explanation":"Explanation"}
]}

Course material:
${content.slice(0, MAX_QUIZ_CHARS)}`;

    const { text: raw, usage } = await chat(prompt);
    const parsed = parseJsonFromLLM(raw);
    const data = responseSchema.parse(parsed);

    // 自动扣除 tokens
    await guard.deduct(usage.input_tokens + usage.output_tokens);

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
