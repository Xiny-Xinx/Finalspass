import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私政策 · FinalsPass",
  description: "FinalsPass 隐私政策 — 了解我们如何收集、使用和保护您的个人信息",
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "60px 24px 80px",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.8,
        fontSize: "0.92rem",
        color: "var(--ink)",
      }}
    >
      <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>隐私政策</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 32 }}>
        最后更新日期：2026 年 5 月 9 日
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>一、引言</h2>
        <p>
          FinalsPass（以下简称"本平台"或"我们"）深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。本隐私政策说明了当您使用 FinalsPass 网站及相关服务时，我们如何收集、使用、存储和披露您的个人信息。
        </p>
        <p>
          请您在使用本平台服务前仔细阅读并充分理解本隐私政策。如果您不同意本政策的任何内容，请立即停止使用我们的服务。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>二、我们收集的信息</h2>
        <p>在您使用本平台的过程中，我们可能会收集以下类型的信息：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>
            <strong>注册信息：</strong>当您创建账号时，我们会收集您的邮箱地址和密码（密码经过加密存储，我们无法查看您的原始密码）。
          </li>
          <li>
            <strong>上传的文件：</strong>您上传的 PPT、PDF、TXT 等文件内容，用于 AI 提取知识点、提供问答和测验服务。文件内容在处理后会被用于生成知识卡片，并保存在服务器上以便您随时访问。
          </li>
          <li>
            <strong>问答记录：</strong>您与 AI 助手的对话内容，用于提供问答服务及改善回答质量。
          </li>
          <li>
            <strong>使用数据：</strong>我们自动收集有关您如何使用本平台的信息，包括 IP 地址、浏览器类型、操作系统、访问时间、浏览的页面等。
          </li>
          <li>
            <strong>充值记录：</strong>当您进行账号充值时，我们会记录充值金额、充值时间及交易流水号。
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>三、信息的使用</h2>
        <p>我们收集的信息将用于以下目的：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>提供、维护和改善我们的服务（包括文件解析、AI 知识提取、问答、测验等核心功能）；</li>
          <li>处理您的注册、登录和账号管理请求；</li>
          <li>发送验证码、密码重置等必要的服务通知；</li>
          <li>跟踪您的 Token 使用量和配额；</li>
          <li>检测和防止滥用、欺诈或安全威胁；</li>
          <li>遵守适用的法律法规要求。</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>四、信息的存储与保护</h2>
        <p>
          <strong>存储位置：</strong>您的数据存储于阿里云（中国境内）及 Upstash Redis 云服务（海外），具体位置取决于服务部署情况。
        </p>
        <p>
          <strong>数据保留：</strong>我们仅在为您提供服务所必需的期限内保留您的个人信息。账号注销后，您的个人信息将在合理期限内删除或匿名化处理。
        </p>
        <p>
          <strong>安全措施：</strong>我们采用业界通行的安全技术和措施（包括 SSL/TLS 加密传输、密码加密存储、访问权限控制等）来保护您的个人信息。但请注意，互联网上的数据传输无法保证 100% 的安全。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>五、第三方服务</h2>
        <p>本平台使用了以下第三方服务，这些服务可能会收集和处理您的数据：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li><strong>Vercel：</strong>网站托管服务，负责提供应用的基础运行环境；</li>
          <li><strong>Upstash Redis：</strong>数据存储服务，用于存储用户信息、会话数据和验证码；</li>
          <li><strong>Resend：</strong>邮件发送服务，用于发送验证码和密码重置邮件；</li>
          <li><strong>Anthropic Claude API：</strong>AI 模型服务，用于知识提取、问答和测验生成（您的文件内容和问题会被发送至 Anthropic 进行处理）。</li>
        </ul>
        <p>
          上述第三方服务提供商均在其各自的服务条款和隐私政策下运营，我们建议您查阅他们的隐私政策以了解更多信息。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>六、AI 服务特别说明</h2>
        <p>
          本平台的核心功能基于人工智能大语言模型（Anthropic Claude）提供服务。您上传的文件内容和提问会被发送至 AI 模型进行处理，以生成知识卡片、回答问题和创建测验。我们不会将您的数据用于训练或改进 AI 模型本身（Anthropic 的 API 服务承诺不会使用客户数据进行模型训练）。
        </p>
        <p>
          AI 生成的内容仅供参考和学习使用，不构成专业建议。由于 AI 模型的局限性，生成的内容可能存在不准确或错误的情况，请您在使用时保持理性判断。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>七、Cookie 及本地存储</h2>
        <p>
          我们使用 Cookie 来维持您的登录状态（JWT Token）。此外，我们还在浏览器本地存储（localStorage）中保存您的主题偏好（亮色/暗色模式）和最近一次处理会话的信息，以改善您的使用体验。
        </p>
        <p>
          您可以通过浏览器设置管理或清除 Cookie 和本地存储数据。但请注意，清除登录 Cookie 将导致您需要重新登录。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>八、您的权利</h2>
        <p>根据适用的数据保护法律，您享有以下权利：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li><strong>访问权：</strong>您可以要求查阅我们持有的您的个人信息；</li>
          <li><strong>更正权：</strong>如您的个人信息不准确，您可以要求更正；</li>
          <li><strong>删除权：</strong>您可以要求删除您的账号及相关个人信息；</li>
          <li><strong>限制处理权：</strong>在特定条件下，您可以要求限制对您个人信息的处理；</li>
          <li><strong>数据可携带权：</strong>您可以要求获取您的个人信息的电子副本。</li>
        </ul>
        <p>
          如需行使上述权利，请通过本政策末尾的联系方式与我们联系。我们将在合理期限内响应您的请求。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>九、未成年人保护</h2>
        <p>
          本平台不建议未成年人独立使用。如果您是未满 18 周岁的未成年人，请在法定监护人的陪同下阅读本政策，并在征得监护人同意后使用我们的服务。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>十、隐私政策的更新</h2>
        <p>
          我们可能会不时更新本隐私政策。更新后的政策将在本页面上公布，并标明最后更新日期。重大变更时，我们可能会通过电子邮件或网站公告的方式通知您。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>十一、联系我们</h2>
        <p>
          如果您对本隐私政策有任何疑问、意见或投诉，请通过以下方式与我们联系：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>邮箱：<a href="mailto:support@finalspass.top" style={{ color: "var(--accent)" }}>support@finalspass.top</a></li>
        </ul>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "40px 0" }} />

      <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>返回首页</Link>
        <span style={{ margin: "0 12px" }}>|</span>
        <Link href="/terms" style={{ color: "var(--accent)", textDecoration: "none" }}>用户协议</Link>
      </div>
    </div>
  );
}
