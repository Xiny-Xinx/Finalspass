import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";

const schema = z.object({
  examName: z.string().min(1, "请输入考试名称"),
  daysUntilExam: z.number().int().min(1, "至少 1 天").max(365),
  chapters: z.string().min(1, "请输入考试范围"),
  hoursPerDay: z.number().int().min(0.5).max(16).optional().default(3),
});

const SYSTEM = `你是一名专业的考试备考规划师。根据用户提供的考试信息，生成一份详细的备考计划。

输出格式为 JSON，严格按以下结构，不要包含 Markdown 代码块：

{
  "overview": "整体备考策略概述（2-3句话）",
  "dailyPlan": [
    {
      "day": 1,
      "title": "Day 1 的标题",
      "focus": "当天学习重点",
      "tasks": ["任务1", "任务2", "任务3"],
      "duration": "时长（小时）"
    }
  ],
  "tips": ["备考建议1", "备考建议2", "备考建议3"],
  "keyFormulas": "必记公式/要点总结（一段话，50-100字）"
}

要求：计划切实可行，按天分配，每天任务具体可执行，包含复习和练习的安排。`;

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = await req.json();
    const { examName, daysUntilExam, chapters, hoursPerDay } = schema.parse(body);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI 暂不可用" }, { status: 500 });

    const prompt = `考试名称：${examName}
距离考试：${daysUntilExam} 天
考试范围：${chapters}
每天可用时间：${hoursPerDay} 小时

请生成一份详细的备考计划。`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[study-plan] AI 调用失败:", res.status, errText);
      return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "{}";

    // 解析 JSON
    let clean = raw.replace(/```(?:json)?/gi, "").trim();
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first !== -1 && last > first) clean = clean.slice(first, last + 1);
    clean = clean.replace(/,(\s*[}\]])/g, "$1");

    const plan = JSON.parse(clean);
    return NextResponse.json(plan);
  } catch (err) {
    console.error("[study-plan] 错误:", err);
    return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
