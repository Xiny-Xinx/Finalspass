"use client";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/api-client";

export type { Card };

interface KnowledgeCardsProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
}

export default function KnowledgeCards({
  cards,
  onCardClick,
}: KnowledgeCardsProps) {
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭导出菜单
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  // 导出
  const doExport = (format: "md" | "txt" | "json") => {
    setExportOpen(false);
    const date = new Date().toISOString().slice(0, 10);
    const cardLines = cards.map((c, i) => `## ${i + 1}. ${c.title}\n\n${c.summary}\n\n---\n`).join("\n");

    let content: string;
    let mime: string;
    let ext: string;

    if (format === "md") {
      content = `# 知识点汇总\n\n共 ${cards.length} 个知识点\n\n${cardLines}`;
      mime = "text/markdown";
      ext = "md";
    } else if (format === "txt") {
      content = cards.map((c, i) => `${i + 1}. ${c.title}\n${c.summary}\n`).join("\n---\n\n");
      mime = "text/plain";
      ext = "txt";
    } else {
      content = JSON.stringify({ exportDate: date, total: cards.length, cards }, null, 2);
      mime = "application/json";
      ext = "json";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `知识卡片_${date}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = query.trim()
    ? cards.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q)
        );
      })
    : cards;

  return (
    <div>
      {/* 搜索栏 + 导出 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.85rem",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索知识点..."
            aria-label="搜索知识点"
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px 8px 36px",
              fontSize: "0.82rem",
              background: "var(--card)",
              color: "var(--ink)",
              transition: "border-color .2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清除搜索"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: "0.9rem",
                padding: "2px 6px",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Export dropdown */}
        <div ref={exportRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              fontSize: "0.73rem",
              fontFamily: "monospace",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all .2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            <span>📥</span>
            导出 ▾
          </button>
          {exportOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--card-shadow-hover)",
                zIndex: 50,
                minWidth: 200,
                overflow: "hidden",
                animation: "fadeUp .15s ease",
              }}
            >
              {[
                { key: "md" as const, icon: "📝", label: "Markdown", desc: "适用于 Obsidian / Notion" },
                { key: "txt" as const, icon: "📄", label: "纯文本", desc: "简洁文本，适合打印" },
                { key: "json" as const, icon: "📦", label: "JSON", desc: "完整数据结构，可备份" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => doExport(opt.key)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    font: "inherit",
                    padding: "10px 14px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ fontSize: "1rem" }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink)", fontWeight: 500 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 1 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {query.trim() && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.68rem",
              color: "var(--muted)",
              background: "var(--paper2)",
              padding: "4px 10px",
              borderRadius: 20,
            }}
          >
            显示 {filtered.length}/{cards.length} 个知识点
          </span>
        )}
      </div>

      {/* 空状态 */}
      {cards.length === 0 && !query.trim() ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "var(--muted)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>
            暂无知识点
          </div>
          <div style={{ fontSize: "0.82rem", lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
            上传课件后，AI 会自动提炼知识点。
            <br />
            如已上传文件仍无内容，请确认文件中包含可识别的文字，或尝试切换模型。
          </div>
        </div>
      ) : filtered.length === 0 && query.trim() ? (
        <div
          style={{
            textAlign: "center",
            padding: "56px 20px",
            color: "var(--muted)",
            fontSize: "0.84rem",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
          没有找到匹配「{query}」的知识点
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((card, i) => (
            <CardItem
              key={`${i}-${card.title}`}
              card={card}
              index={i}
              onClick={() => onCardClick(card)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardItemProps {
  card: Card;
  index: number;
  onClick: () => void;
}

function CardItem({ card, index, onClick }: CardItemProps) {
  const animationDelay = `${Math.min(index, 12) * 40}ms`;
  return (
    <button
      type="button"
      className="kcard"
      onClick={onClick}
      aria-label={`查看知识点详情:${card.title}`}
      style={{
        textAlign: "left",
        font: "inherit",
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: 8,
        padding: "18px 18px 14px",
        position: "relative",
        overflow: "hidden",
        animation: `fadeUp 0.3s ease ${animationDelay} both`,
      }}
    >
      <div
        className="kcard-bar"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: "var(--border)",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.62rem",
          color: "var(--muted)",
          marginBottom: 7,
        }}
      >
        NO.{String(index + 1).padStart(2, "0")}
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif SC', Georgia, serif",
          fontSize: "0.97rem",
          fontWeight: 600,
          marginBottom: 7,
          lineHeight: 1.4,
          color: "var(--card-title)",
        }}
      >
        {card.title}
      </div>
      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--muted)",
          lineHeight: 1.65,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {card.summary}
      </div>
      <div
        className="kcard-hint"
        style={{
          marginTop: 10,
          fontFamily: "monospace",
          fontSize: "0.65rem",
          color: "var(--accent)",
          opacity: 0,
          transition: "opacity .2s",
        }}
      >
        点击展开详细解释 →
      </div>
    </button>
  );
}
