/**
 * 邮件 HTML 模板
 */

/** 基础邮件外壳 */
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="padding:40px 32px 32px">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">${title}</h1>
          ${bodyHtml}
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px">
          <p style="margin:0;font-size:12px;color:#999">
            FinalsPass &middot; AI 考前冲刺助手<br>
            如果你没有进行此操作，请忽略此邮件。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** 邮箱验证邮件 */
export function verificationEmail(link: string): string {
  return shell("验证你的邮箱", `
    <p style="margin:12px 0 20px;font-size:15px;color:#555;line-height:1.5">
      感谢注册 FinalsPass！请点击下方按钮验证你的邮箱地址。
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
      <tr>
        <td align="center" style="background:#0066ff;border-radius:8px;padding:12px 32px">
          <a href="${link}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:block">
            验证邮箱
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#999">
      或复制以下链接在浏览器中打开：<br>
      <a href="${link}" style="color:#0066ff;word-break:break-all;font-size:13px">${link}</a>
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#999">链接 24 小时内有效。</p>
  `);
}

/** 密码重置邮件 */
export function resetPasswordEmail(link: string): string {
  return shell("重置密码", `
    <p style="margin:12px 0 20px;font-size:15px;color:#555;line-height:1.5">
      你收到了一个密码重置请求。点击下方按钮设置新密码。
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
      <tr>
        <td align="center" style="background:#0066ff;border-radius:8px;padding:12px 32px">
          <a href="${link}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:block">
            重置密码
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#999">
      或复制以下链接在浏览器中打开：<br>
      <a href="${link}" style="color:#0066ff;word-break:break-all;font-size:13px">${link}</a>
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#999">链接 1 小时内有效。如果你没有请求重置密码，请忽略此邮件。</p>
  `);
}
