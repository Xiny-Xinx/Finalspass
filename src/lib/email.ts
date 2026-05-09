/**
 * 邮件发送模块（基于 Resend REST API）
 *
 * 使用 POST https://api.resend.com/emails 发送邮件。
 * 不依赖 Resend SDK，直接 fetch。
 *
 * 环境变量：
 *   RESEND_API_KEY = re_xxx（必填）
 *   RESEND_FROM    = FinalsPass <noreply@你的域名>（可选，默认用 Resend 测试地址）
 *
 * Resend 免费计划：100 封/天，测试模式只能发到已验证邮箱。
 * 正式使用前请在 Resend Dashboard 添加并验证域名。
 */

const RESEND_API = "https://api.resend.com/emails";

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function getFrom(): string {
  return process.env.RESEND_FROM || "FinalsPass <onboarding@resend.dev>";
}

/** 发送邮件 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY 未配置，跳过发件");
    return { ok: false, error: "邮件服务未配置" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFrom(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("[email] Resend error:", body);
      return { ok: false, error: body.message ?? "发送失败" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[email] Network error:", err);
    return { ok: false, error: "网络错误" };
  }
}
