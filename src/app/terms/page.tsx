import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "用户协议 · FinalsPass",
  description: "FinalsPass 用户协议 — 使用本平台服务前请仔细阅读",
};

export default function TermsPage() {
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
      <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>用户协议</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 32 }}>
        最后更新日期：2026 年 5 月 9 日
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>一、协议接受</h2>
        <p>
          欢迎使用 FinalsPass（以下简称"本平台"）。本协议是您与本平台之间关于使用服务的有效协议。通过注册、登录或使用本平台的任何服务，即表示您已阅读、理解并同意接受本协议的全部条款和条件。
        </p>
        <p>
          如果您不同意本协议的任何条款，请立即停止注册或使用本平台的服务。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>二、服务说明</h2>
        <p>
          FinalsPass 是一个基于人工智能技术的在线学习辅助平台，主要功能包括：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>上传 PPT、PDF、TXT 等文件，通过 AI 自动提取并生成知识卡片；</li>
          <li>基于上传内容提供 AI 问答交互服务；</li>
          <li>基于上传内容生成练习测验题目；</li>
          <li>查看和管理历史学习记录。</li>
        </ul>
        <p>
          我们保留随时修改、暂停或终止任何服务（整体或部分）的权利，恕不另行通知。对于任何服务的修改、暂停或终止，我们对您或任何第三方不承担责任。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>三、用户账号</h2>
        <p>在使用本平台的部分功能时，您需要注册一个账号。您同意：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>提供准确、完整、最新的注册信息（包括有效的邮箱地址）；</li>
          <li>对您的账号和密码安全负全部责任；</li>
          <li>对账号下发生的所有活动负责；</li>
          <li>如发现任何未经授权使用您账号的情况，立即通知我们；</li>
          <li>每个邮箱地址只能注册一个账号。</li>
        </ul>
        <p>
          我们有权在合理怀疑您的账号存在安全风险或违规使用的情况下，暂停或终止您的账号访问权限。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>四、用户行为规范</h2>
        <p>您同意在使用本平台服务时遵守以下行为规范：</p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>不得利用本平台从事任何违法违规活动；</li>
          <li>不得上传含有病毒、恶意代码、木马或其他可能损害系统的文件；</li>
          <li>不得上传侵犯第三方知识产权或其他合法权益的内容；</li>
          <li>不得试图绕过本平台的安全机制、配额限制或身份验证系统；</li>
          <li>不得对本平台的服务器或网络进行任何形式的攻击或压力测试；</li>
          <li>不得以任何方式滥用 AI 服务，包括但不限于自动批量请求、逆向工程等；</li>
          <li>不得将本平台用于任何非法或未经授权的目的。</li>
        </ul>
        <p>
          如发现违反上述规范的行为，我们有权采取包括但不限于警告、限制功能、封禁账号、追究法律责任等措施。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>五、计费与充值</h2>
        <p>
          <strong>Token 计费系统：</strong>本平台采用基于 Token 的计费模式。每次 AI 请求（包括知识提取、问答、测验生成）会消耗一定数量的 Token。具体消耗标准以平台公示为准。
        </p>
        <p>
          <strong>充值方式：</strong>用户可通过平台提供的充值选项购买 Token。充值金额和 Token 数量的对应关系以充值页面显示为准。
        </p>
        <p>
          <strong>配额有效期：</strong>购买的 Token 长期有效，除非本协议终止或法律另有规定。
        </p>
        <p>
          <strong>免费配额：</strong>未登录用户每天可享受一定量的免费 Token 配额。免费配额仅限当日有效，不可累积。我们保留随时调整免费配额数量和规则的权利。
        </p>
        <p>
          <strong>退款政策：</strong>鉴于数字产品和服务的特殊性，已充值的 Token 原则上不支持退款。如因平台原因导致服务无法正常使用，我们将会酌情处理。如有特殊情况，请联系客服协商。
        </p>
        <p>
          <strong>价格调整：</strong>我们保留根据运营成本等因素调整 Token 价格的权利，价格调整前会通过公告或邮件通知用户。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>六、知识产权</h2>
        <p>
          <strong>平台知识产权：</strong>本平台（包括但不限于网站界面、品牌名称、Logo、技术架构等）的知识产权归 FinalsPass 所有，受相关法律保护。未经我们书面许可，您不得复制、修改、分发或反向工程本平台的任何部分。
        </p>
        <p>
          <strong>用户内容：</strong>您上传的文件和内容的知识产权归您或原始权利人所有。您授予我们在提供服务所必需的范围内使用、复制和处理您上传内容的权利（例如，将文件内容发送至 AI 模型进行处理）。本协议终止后，此授权自动终止。
        </p>
        <p>
          <strong>AI 生成内容：</strong>由 AI 生成的知识卡片、问答答案和测验题目的知识产权归属，在法律允许的最大范围内，由 FinalsPass 享有。我们授予您个人、非独占、不可转让的使用许可，仅限用于个人学习目的。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>七、AI 服务免责声明</h2>
        <p>
          本平台的 AI 服务（包括知识提取、问答、测验生成）基于人工智能大语言模型技术。您理解并同意：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>AI 生成的内容仅供参考和学习用途，不构成任何形式的专业建议（包括但不限于学术、法律、医疗或财务建议）；</li>
          <li>AI 可能存在错误、不准确或过时的情况，您应对生成内容的准确性和适用性自行判断；</li>
          <li>AI 的回答不应作为考试、作业或其他学术评估的唯一依据；</li>
          <li>我们不对因依赖 AI 生成内容而产生的任何损失或损害承担责任；</li>
          <li>AI 服务可能因技术原因、API 限制或维护需要而中断，我们将尽力减少影响，但不承担服务中断造成的损失。</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>八、免责与责任限制</h2>
        <p>
          在法律允许的最大范围内，FinalsPass 及其运营者不对以下情况承担责任：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>因不可抗力（包括但不限于自然灾害、战争、政府行为、网络故障等）导致的服务中断或数据丢失；</li>
          <li>因第三方服务（包括但不限于 Vercel、Upstash、Anthropic、Resend）故障导致的服务异常；</li>
          <li>因用户自身原因（包括但不限于密码泄露、账号共享、操作失误）导致的损失；</li>
          <li>用户因使用本平台服务而产生的间接损失、附带损失或惩罚性赔偿。</li>
        </ul>
        <p>
          在任何情况下，我们对您的总赔偿责任不超过您在相关争议发生前 3 个月内向本平台支付的费用总额。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>九、服务终止</h2>
        <p>
          您可随时停止使用本平台服务并申请注销账号。我们保留在以下情况下终止或暂停您账号的权利：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>您违反了本协议的任何条款；</li>
          <li>您的行为可能对其他用户或本平台造成损害；</li>
          <li>法律或监管机构要求；</li>
          <li>平台停止运营。</li>
        </ul>
        <p>
          账号终止后，您将无法再访问您的账号数据。除非法律另有要求，我们将在合理期限内删除您的数据。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>十、协议修改</h2>
        <p>
          我们可能会不时修改本协议。修改后的协议将在本页面发布，并更新"最后更新日期"。重大变更时，我们会通过电子邮件或网站公告通知您。
        </p>
        <p>
          修改后的协议自发布之日起生效。如果您在协议修改后继续使用本平台服务，即视为您接受修改后的协议。如您不同意修改，应停止使用本平台服务。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>十一、法律适用与争议解决</h2>
        <p>
          本协议的订立、执行和解释适用中华人民共和国法律。因本协议引起的或与之相关的争议，双方应首先友好协商解决；协商不成的，任何一方均可提交至本平台运营者所在地有管辖权的人民法院诉讼解决。
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>十二、联系我们</h2>
        <p>
          如您对本协议有任何疑问或建议，请通过以下方式与我们联系：
        </p>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>邮箱：<a href="mailto:support@finalspass.top" style={{ color: "var(--accent)" }}>support@finalspass.top</a></li>
        </ul>
      </section>

      <section style={{ background: "rgba(255,0,0,0.04)", border: "1px solid var(--accent)", borderRadius: 8, padding: "12px 16px", marginBottom: 28 }}>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--accent)" }}>
          <strong>重要提示：</strong>本用户协议为模板性质，不构成法律意见。在实际运营中，建议您咨询专业律师，根据您的具体业务模式和需求进行调整和修改。
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "40px 0" }} />

      <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>返回首页</Link>
        <span style={{ margin: "0 12px" }}>|</span>
        <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "none" }}>隐私政策</Link>
      </div>
    </div>
  );
}
