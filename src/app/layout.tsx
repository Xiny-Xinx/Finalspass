import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinalsPass · AI 学习助手",
  description: "上传 PPT / PDF，AI 自动提炼核心知识点，支持问答和练习测验",
};

/** 在浏览器解析 CSS 之前读取 localStorage 主题偏好,防止闪白/闪黑 */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem("finalspass:theme");
    if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <footer
          style={{
            textAlign: "center",
            padding: "32px 20px 24px",
            fontSize: "0.78rem",
            color: "var(--muted)",
            borderTop: "1px solid var(--border)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <a href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>隐私政策</a>
            <a href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>用户协议</a>
          </div>
          <div>&copy; {new Date().getFullYear()} FinalsPass. All rights reserved.</div>
        </footer>
      </body>
    </html>
  );
}
