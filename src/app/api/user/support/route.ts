import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { addMessage, getUnread, setUnread } from "@/lib/support-store";

const schema = z.object({
  question: z.string().min(1, "问题不能为空"),
});

const SYSTEM = `你是 FinalsPass 的在线客服助手，请用中文友好地回答用户的问题。

关于 FinalsPass 的常见信息：
- FinalsPass 是一个 AI 学习工具，上传 PPT/PDF/DOCX 后可自动提取知识点
- 支持知识卡片、AI 问答、练习测验三种学习模式
- 有免费版、Pro (A$12.99/月)、Premium (A$24.99/月) 三档套餐
- Pro 支持 300K tokens/天，Premium 支持 1M tokens/天
- 取消订阅后当前周期内仍可使用，到期自动转为免费版
- 技术或支付问题请联系管理员邮箱 support@finalspass.top

回答要求：
- 简洁友好，100-200 字
- 涉及具体账户问题时，引导用户前往「账户中心」查看或联系管理员
- 不知道答案时，如实告知并建议联系 support@finalspass.top
- 如果用户明确要求转人工，请回复 "转人工" 三个字`;

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const userId = auth?.userId || "anonymous";

    const body = await req.json();
    const { question } = schema.parse(body);

    // 保存用户消息
    await addMessage(userId, { role: "user", content: question });

    // 检查是否有管理员未读回复
    const unread = await getUnread(userId);
    if (unread > 0) {
      await setUnread(userId, 0);
      return NextResponse.json({ reply: null, unread: true });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "客服系统暂不可用" }, { status: 500 });
    }

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: question },
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[support] DeepSeek 调用失败:", res.status, errText);
      return NextResponse.json({ error: "客服系统暂不可用" }, { status: 500 });
    }

    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content || "抱歉，我暂时无法回答这个问题。";

    // 保存 AI 回复
    if (reply !== "转人工") {
      await addMessage(userId, { role: "assistant", content: reply });
    }

    return NextResponse.json({ reply: reply === "转人工" ? null : reply, transfer: reply === "转人工" });
  } catch (err) {
    console.error("[support] 处理失败:", err);
    return NextResponse.json({ error: "客服系统暂不可用" }, { status: 500 });
  }
}
