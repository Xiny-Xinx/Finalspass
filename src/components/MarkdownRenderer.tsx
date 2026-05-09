"use client";
import { useCallback, useState } from "react";

/**
 * 轻量级 Markdown 渲染组件（无需额外依赖）
 * 支持: 代码块、行内代码、加粗、列表、标题、分隔线
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tokenizeMarkdown(text: string): string {
  // 按行处理
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBuf: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        // 结束代码块
        const lang = escapeHtml(codeLang);
        const code = escapeHtml(codeBuf.join("\n"));
        result.push(
          `<div style="position:relative;">` +
            `<pre style="background:#1a1410;color:#f0ebe4;padding:14px 16px;border-radius:6px;overflow-x:auto;font-size:0.78rem;line-height:1.55;margin:8px 0;tab-size:2;"><code>${code}</code></pre>` +
            `<button onclick="(function(){navigator.clipboard.writeText(this.dataset.code).catch(()=>{})})()" data-code="${escapeHtml(codeBuf.join("\n"))}" style="position:absolute;top:6px;right:6px;background:rgba(255,255,255,.12);color:#f0ebe4;border:none;border-radius:4px;padding:3px 10px;font-size:0.65rem;cursor:pointer;">复制</button>` +
            `</div>`
        );
        codeBuf = [];
        codeLang = "";
        inCodeBlock = false;
        continue;
      }
      // 开始代码块
      inCodeBlock = true;
      codeLang = line.trim().slice(3).trim();
      codeBuf = [];
      continue;
    }

    if (inCodeBlock) {
      codeBuf.push(line);
      continue;
    }

    // 普通行
    if (line.trim() === "") {
      result.push("<br>");
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      const size = level === 1 ? "1.05rem" : level === 2 ? "0.95rem" : "0.88rem";
      result.push(
        `<div style="font-weight:600;font-size:${size};margin:12px 0 4px;line-height:1.5;">${content}</div>`
      );
      continue;
    }

    // 无序列表
    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      result.push(
        `<div style="display:flex;gap:8px;margin:3px 0;line-height:1.65;">` +
          `<span style="color:var(--muted);flex-shrink:0;">•</span>` +
          `<span>${renderInline(ulMatch[1])}</span></div>`
      );
      continue;
    }

    // 有序列表
    const olMatch = line.match(/^\d+[.)]\s+(.+)/);
    if (olMatch) {
      result.push(
        `<div style="display:flex;gap:8px;margin:3px 0;line-height:1.65;">` +
          `<span style="color:var(--muted);flex-shrink:0;font-family:monospace;font-size:0.75rem;">${Number(line.match(/^\d+/)?.[0] || "")}.</span>` +
          `<span>${renderInline(olMatch[1])}</span></div>`
      );
      continue;
    }

    // 分隔线
    if (/^[-*_]{3,}\s*$/.test(line)) {
      result.push(
        `<hr style="border:none;border-top:1.5px solid var(--border);margin:12px 0;">`
      );
      continue;
    }

    // 普通段落
    result.push(`<div style="margin:4px 0;line-height:1.75;">${renderInline(line)}</div>`);
  }

  // 未关闭的代码块
  if (inCodeBlock && codeBuf.length > 0) {
    const code = escapeHtml(codeBuf.join("\n"));
    result.push(
      `<pre style="background:#1a1410;color:#f0ebe4;padding:14px 16px;border-radius:6px;overflow-x:auto;font-size:0.78rem;line-height:1.55;margin:8px 0;"><code>${code}</code></pre>`
    );
  }

  return result.join("\n");
}

/** 渲染行内样式: 加粗、行内代码 */
function renderInline(text: string): string {
  let s = escapeHtml(text);
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, '<code style="background:var(--paper2);padding:1px 5px;border-radius:3px;font-size:0.82em;border:1px solid var(--border);">$1</code>');
  // 加粗 **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">$1</a>');
  return s;
}

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = tokenizeMarkdown(content);
  return (
    <div
      className="markdown-body"
      style={{ lineHeight: 1.75 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "复制" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="复制答案"
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: "0.65rem",
        color: copied ? "#27ae60" : "var(--muted)",
        cursor: "pointer",
        fontFamily: "monospace",
        transition: "color .2s",
      }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = "var(--ink)"; }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = "var(--muted)"; }}
    >
      {copied ? "✓ 已复制" : label}
    </button>
  );
}
