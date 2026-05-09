"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Card } from "@/lib/api-client";
import { askQuestion } from "@/lib/api-client";
import { MAX_DETAIL_CONTEXT_CHARS } from "@/lib/constants";
import MarkdownRenderer, { CopyButton } from "@/components/MarkdownRenderer";
import type { ModelId } from "@/lib/claude";

interface DetailPanelProps {
  card: Card;
  pptContent: string;
  onClose: () => void;
  model?: ModelId;
}

export default function DetailPanel({
  card,
  pptContent,
  onClose,
  model,
}: DetailPanelProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: lock Tab inside the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0]?.focus();
    }

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [loading, errored, text]);

  // 检测卡片语言：含中文字符则为中文，否则英文
  const cardLang: "zh" | "en" = /[一-龥]/.test(card.title + card.summary) ? "zh" : "en";

  const fetchDetail = useCallback(
    (signal?: AbortSignal) => {
      setText("");
      setLoading(true);
      setErrored(false);
      setErrorMsg("");

      const question = cardLang === "en"
        ? `Explain the knowledge point "${card.title}" in detail.\nSummary: ${card.summary}\n\nExcerpt: ${pptContent.slice(0, MAX_DETAIL_CONTEXT_CHARS)}`
        : `对知识点"${card.title}"进行详细解释。\n概述:${card.summary}\n\n课件节选:${pptContent.slice(0, MAX_DETAIL_CONTEXT_CHARS)}`;

      askQuestion(
        {
          mode: "detail",
          lang: cardLang,
          model,
          question,
        },
        { signal }
      )
        .then((data) => {
          setText(data.answer);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setErrored(true);
          setErrorMsg(
            err instanceof Error ? err.message : "获取失败:未知错误"
          );
          setLoading(false);
        });
    },
    [card.title, card.summary, pptContent, model]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchDetail(ctrl.signal);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      ctrl.abort();
      window.removeEventListener("keydown", onKey);
    };
  }, [fetchDetail, onClose]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`知识点详情:${card.title}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          background: "var(--paper)",
          borderTop: "3px solid var(--accent)",
          borderRadius: "12px 12px 0 0",
          padding: "28px 32px 40px",
          width: "100%",
          maxWidth: 720,
          maxHeight: "76vh",
          overflowY: "auto",
          animation: "fadeUp .3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontFamily: "'Noto Serif SC', Georgia, serif",
              fontSize: "1.15rem",
              fontWeight: 700,
              flex: 1,
              paddingRight: 16,
              lineHeight: 1.4,
            }}
          >
            {card.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all .2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "inherit";
            }}
          >
            ✕
          </button>
        </div>

        {/* 加载中 */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--muted)",
              fontSize: "0.87rem",
              lineHeight: 1.9,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                border: "2px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                display: "inline-block",
              }}
            />
            AI 正在深度解析...
          </div>
        )}

        {/* 失败状态 */}
        {errored && !loading && (
          <div>
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.87rem",
                lineHeight: 1.9,
                marginBottom: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              ⚠️ {errorMsg}
            </div>
            <button
              type="button"
              onClick={() => fetchDetail()}
              style={{
                background: "none",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
                padding: "4px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: "0.72rem",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "var(--accent)";
              }}
            >
              ⟳ 重试
            </button>
          </div>
        )}

        {/* 正常内容 */}
        {!loading && !errored && text && (
          <div>
            <div
              style={{
                fontSize: "0.87rem",
                lineHeight: 1.9,
              }}
            >
              <MarkdownRenderer content={text} />
            </div>
            <div style={{ marginTop: 16 }}>
              <CopyButton text={text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
