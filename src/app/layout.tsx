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
      <body>{children}</body>
    </html>
  );
}
