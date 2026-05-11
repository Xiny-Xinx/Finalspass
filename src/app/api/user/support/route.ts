import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { addMessage, getUnread, setUnread } from "@/lib/support-store";
import { getUserById } from "@/lib/user-store";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  question: z.string().min(1, "问题不能为空"),
});

/** FAQ 关键词匹配规则 */
const FAQ: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["使用", "怎么用", "如何", "上传", "课件", "开始"],
    answer: "上传您的课件文件（PPT/PDF/DOCX），AI 会自动提炼核心知识点并生成知识卡片。之后您可以使用 AI 问答、练习测验、记忆闪卡等功能进行学习。",
  },
  {
    keywords: ["套餐", "价格", "订阅", "pro", "premium", "免费", "多少钱", "费用", "付费"],
    answer: "FinalsPass 提供三档套餐：免费版（30次/天）、Pro（¥30/月，150次/天）、Premium（¥59/月，500次/天）。Pro 和 Premium 可使用全部功能，免费版可用知识卡片和问答。",
  },
  {
    keywords: ["取消", "退订", "停止", "取消订阅"],
    answer: "在账户中心点击「取消订阅」即可停止自动续费，当前套餐权益可继续使用至到期日。取消后不会立即降级。",
  },
  {
    keywords: ["充值", "额外", "配额", "不够", "用完", "额度"],
    answer: "每日额度用完后，可在账户中心购买额外配额（50次/¥3.99、150次/¥9.99、500次/¥35），不限时间，永不过期。",
  },
  {
    keywords: ["退款", "退钱", "refund"],
    answer: "如需退款，请联系管理员邮箱 support@finalspass.top，我们会尽快处理。",
  },
  {
    keywords: ["密码", "忘记密码", "重置", "登录不了"],
    answer: "在登录页点击「忘记密码」，输入注册邮箱获取验证码后即可重置密码。",
  },
  {
    keywords: ["联系", "客服", "人工", "转人工", "管理员"],
    answer: "已为您转接人工客服，请稍候。您的问题已提交，管理员会尽快回复。",
  },
  {
    keywords: ["模型", "模型选择", "v4", "flash", "deepseek", "claude"],
    answer: "FinalsPass 支持 DeepSeek V4 Flash、V4 Pro 和 Claude Sonnet 4 等多种模型。Pro 及以上套餐可在页面右上角切换模型，不同模型消耗不同配额。",
  },
  {
    keywords: ["错误", "报错", "bug", "崩溃", "异常", "失败"],
    answer: "遇到技术问题请先刷新页面重试。如果问题持续，请联系管理员邮箱 support@finalspass.top，并附上报错截图。",
  },
  {
    keywords: ["次数", "限额", "上限", "每天", "每日", "限制"],
    answer: "每日配额根据套餐不同：免费版30次、Pro 150次、Premium 500次。用量用完可购买额外配额，或等次日重置。",
  },
];

function findAnswer(question: string): string | null {
  const q = question.toLowerCase();
  for (const faq of FAQ) {
    if (faq.keywords.some((kw) => q.includes(kw))) return faq.answer;
  }
  // 检查是否要求转人工
  if (/人工|客服|admin|真人|帮忙/.test(q)) return null;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "请先登录后使用客服" }, { status: 401 });
    }
    const userId = auth.userId;

    const body = await req.json();
    const { question } = schema.parse(body);

    // 保存用户消息
    await addMessage(userId, { role: "user", content: question });

    // 检查是否有管理员未读回复
    const unread = await getUnread(userId);
    const hasUnread = unread > 0;
    if (hasUnread) {
      await setUnread(userId, 0);
    }

    // FAQ 自动匹配（有未读时不自动回复，让用户看管理员回复）
    const answer = !hasUnread ? findAnswer(question) : null;

    if (answer) {
      // 有匹配的 FAQ 答案
      await addMessage(userId, { role: "assistant", content: answer });
    } else {
      // 没有匹配或用户有未读 → 转人工
      if (!hasUnread) {
        const transferMsg = "暂未找到匹配的答案，已为您转接人工客服。您的问题已提交，管理员会尽快回复。";
        await addMessage(userId, { role: "assistant", content: transferMsg });
      }
    }

    // 无论是否 FAQ 匹配，都邮件通知管理员有新消息
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const user = await getUserById(userId);
      if (user) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: `💬 客服新消息 - ${user.email}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#2563eb">客服新消息通知</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#666">用户</td><td><strong>${user.email}</strong>${user.username ? ` (${user.username})` : ""}</td></tr>
    <tr><td style="padding:6px 0;color:#666">套餐</td><td><strong>${user.tier}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">时间</td><td>${new Date().toLocaleString("zh-CN")}</td></tr>
  </table>
  <div style="margin:16px 0;padding:12px;background:#f5f5f5;border-radius:8px">
    <div style="font-size:0.82rem;color:#666;margin-bottom:4px">用户消息：</div>
    <div style="font-size:0.95rem;white-space:pre-wrap">${question}</div>
  </div>
  <a href="https://finalspass.top/login?redirect=/admin/messages" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:0.85rem">前往后台回复 →</a>
</div>`,
          });
          console.log("[support] 邮件通知成功");
        } catch (err) {
          console.error("[support] 邮件通知失败:", err);
        }
      }
    }

    return NextResponse.json({
      reply: answer ?? null,
      unread: hasUnread ? true : undefined,
      transfer: !hasUnread && !answer ? true : undefined,
    });
  } catch (err) {
    console.error("[support] 处理失败:", err);
    return NextResponse.json({ error: "客服系统暂不可用" }, { status: 500 });
  }
}
