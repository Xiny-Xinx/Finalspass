import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

const schema = z.object({
  examName: z.string().min(1, "请输入考试名称"),
  daysUntilExam: z.number().int().min(1, "至少 1 天").max(365),
  chapters: z.string().min(1, "请输入考试范围"),
  hoursPerDay: z.number().min(0.5).max(16).optional().default(3),
});

const SYSTEM = `你是一名考试备考规划专家。根据学生提供的信息，生成一份可执行的每日复习计划。

要求：
1. 输出严格按以下结构，不要多余内容，不要 Markdown 代码块
2. 每行开头必须是标记，不要多余空行

【整体策略】
2-3句话概括备考策略

【第1天】
标题：简要
重点：当天学习重点
任务：任务1 | 任务2 | 任务3
时长：X小时

【第2天】
...

【必记要点】
最重要的公式/概念总结

【备考建议】
建议1
建议2
建议3`;

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 消耗 3 单位配额
  const { withQuota } = await import("@/lib/quota-guard");
  try {
    const guard = await withQuota(req);
    const body = await req.json();
    const { examName, daysUntilExam, chapters, hoursPerDay } = schema.parse(body);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI 暂不可用" }, { status: 500 });

    const prompt = `考试名称：${examName}
距离考试：${daysUntilExam} 天
考试范围：${chapters}
每天可用时间：${hoursPerDay} 小时

请生成备考计划。`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[study-plan] AI 调用失败:", res.status, errText);
      return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content || "";

    // 服务端解析为结构化数据
    const overviewMatch = content.match(/【整体策略】\n([\s\S]*?)(?=\n【第\d+天】|$)/);
    const overview = overviewMatch?.[1]?.trim() || "";

    const dayBlocks: { day: number; title: string; focus: string; tasks: string[]; hours: string }[] = [];
    const dayRegex = /【第(\d+)天】\n(?:标题[：:]\s*(.*?)\n)?(?:重点[：:]\s*(.*?)\n)?(?:任务[：:]\s*(.*?)\n)?(?:时长[：:]\s*(.*?)\n?)/g;
    let match;
    while ((match = dayRegex.exec(content)) !== null) {
      dayBlocks.push({
        day: parseInt(match[1]),
        title: match[2]?.trim() || `第${match[1]}天`,
        focus: match[3]?.trim() || "",
        tasks: match[4] ? match[4].split("|").map((t: string) => t.trim()).filter(Boolean) : [],
        hours: match[5]?.trim() || "",
      });
    }

    const tipsMatch = content.match(/【备考建议】\n([\s\S]*?)$/);
    const tips = tipsMatch?.[1]
      ?.split("\n")
      .map((t: string) => t.replace(/^\d+[.、]?\s*/, "").trim())
      .filter(Boolean) || [];

    const formulasMatch = content.match(/【必记要点】\n([\s\S]*?)(?=\n【备考建议】|$)/);
    const keyFormulas = formulasMatch?.[1]?.trim() || "";

    await guard.deduct(3);
    return NextResponse.json({ overview, dailyPlan: dayBlocks, tips, keyFormulas, raw: content });
  } catch (err: any) {
    if (err.statusCode === 429) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[study-plan] 错误:", err);
    return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
