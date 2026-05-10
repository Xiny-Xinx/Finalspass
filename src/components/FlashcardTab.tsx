"use client";
import { useEffect, useState, useCallback } from "react";
import type { Card } from "@/lib/api-client";

interface Flashcard {
  id: string; question: string; answer: string; source: string;
  interval: number; ease: number; nextReview: number; reviewed: number;
}

interface Props {
  cards: Card[];
  disabled?: boolean;
}

export default function FlashcardTab({ cards, disabled }: Props) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcard");
      const data = await res.json();
      if (data.due) { setFlashcards(data.due); setTotal(data.total); setReviewed(data.reviewed); }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function generate() {
    setGenerating(true);
    setMsg("正在生成闪卡…");
    try {
      const res = await fetch("/api/flashcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`✅ 已生成 ${data.count} 张闪卡`);
        fetchCards();
      } else {
        setMsg(`❌ ${data.error}`);
      }
    } catch { setMsg("网络错误"); }
    setGenerating(false);
    setTimeout(() => setMsg(""), 3000);
  }

  async function review(quality: 0 | 1 | 2 | 3) {
    if (!flashcards[index]) return;
    try {
      await fetch("/api/flashcard/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: flashcards[index].id, quality }),
      });
    } catch {}
    setFlipped(false);
    if (index < flashcards.length - 1) {
      setIndex(index + 1);
    } else {
      fetchCards();
      setIndex(0);
    }
  }

  // 暂无闪卡 → 显示生成按钮
  if (loaded && flashcards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🃏</div>
        <h3 style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "1rem" }}>记忆闪卡</h3>
        <p style={{ fontSize: "0.84rem", color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.7 }}>
          {total > 0
            ? `已有 ${total} 张闪卡，今天复习了 ${reviewed} 张，暂无到期待复习的卡片`
            : "从当前课件的知识点生成 Anki 风格记忆闪卡，按遗忘曲线安排复习"}
        </p>
        {!disabled && cards.length > 0 && (
          <button
            onClick={generate}
            disabled={generating}
            style={{
              background: generating ? "var(--border)" : "var(--accent)",
              color: generating ? "var(--muted)" : "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: generating ? "not-allowed" : "pointer",
              transition: "opacity .2s",
            }}
          >
            {generating ? "生成中…" : `从 ${cards.length} 个知识点生成闪卡`}
          </button>
        )}
        {disabled && (
          <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: 12 }}>
            请先上传课件以生成闪卡
          </p>
        )}
        {msg && <p style={{ fontSize: "0.8rem", marginTop: 12, color: "var(--muted)" }}>{msg}</p>}
      </div>
    );
  }

  if (!loaded) {
    return <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: "0.85rem" }}>加载中…</div>;
  }

  const card = flashcards[index];
  if (!card) return null;

  // 统计信息
  const totalCards = total;
  const reviewedToday = reviewed;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      {/* 统计 */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20, fontSize: "0.72rem", fontFamily: "monospace", color: "var(--muted)" }}>
        <span>总计 {totalCards} 张</span>
        <span>·</span>
        <span>今日复习 {reviewedToday}</span>
        <span>·</span>
        <span>待复习 {flashcards.length}</span>
      </div>

      {/* 闪卡 */}
      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          background: "var(--card)",
          border: "2px solid var(--card-border)",
          borderRadius: 16,
          padding: "32px 24px",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all .2s",
          boxShadow: flipped ? "var(--card-shadow-hover)" : "var(--card-shadow)",
          animation: "fadeUp .2s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--card-border)"; }}
      >
        <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: 12, opacity: 0.6 }}>
          {flipped ? "答案" : "问题"} · {card.source}
        </div>
        <div style={{ fontSize: "0.92rem", lineHeight: 1.7, textAlign: "center", maxWidth: "100%", wordBreak: "break-word" }}>
          {flipped ? card.answer : card.question}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 16, opacity: 0.5 }}>
          {flipped ? "点击卡片继续" : "点击翻转"}
        </div>
      </div>

      {/* 评价按钮（翻转后显示） */}
      {flipped && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, animation: "fadeUp .15s ease" }}>
          {([
            [0, "忘记", "var(--danger)"],
            [1, "困难", "#f59e0b"],
            [2, "良好", "var(--accent)"],
            [3, "轻松", "var(--success)"],
          ] as const).map(([q, label, color]) => (
            <button
              key={q}
              onClick={() => review(q)}
              style={{
                background: "none",
                border: `1.5px solid ${color}`,
                borderRadius: 10,
                padding: "8px 16px",
                color,
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 500,
                transition: "all .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = "white"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = color; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.72rem", color: "var(--muted)", opacity: 0.6 }}>
        {index + 1} / {flashcards.length}
      </div>
    </div>
  );
}
