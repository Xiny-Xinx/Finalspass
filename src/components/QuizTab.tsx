"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { generateQuiz, type QuizQuestion } from "@/lib/api-client";
import { saveQuizState, loadQuizState, clearQuizState } from "@/lib/store";
import type { ModelId } from "@/lib/claude";

type QuizType = "mixed" | "choice" | "judge";

interface QuizTabProps {
  pptContent: string;
  fileName?: string;
  model?: ModelId;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizTab({ pptContent, fileName, model }: QuizTabProps) {
  const [count, setCount] = useState<number>(5);
  const [type, setType] = useState<QuizType>("mixed");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [reviewWrong, setReviewWrong] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<string[][]>([]);
  const restoredRef = useRef(false);

  // Restore quiz state
  useEffect(() => {
    if (!fileName || restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadQuizState(fileName);
    if (saved) {
      setQuestions(saved.questions);
      setAnswers(saved.answers);
      setType(saved.type);
      setCount(saved.count);
      setShuffledOptions(saved.questions.map((q) => shuffle(q.options)));
    }
  }, [fileName]);

  // Auto-save
  useEffect(() => {
    if (!fileName || questions.length === 0) return;
    saveQuizState(fileName, { type, count, questions, answers });
  }, [fileName, type, count, questions, answers]);

  function getOptions(qi: number): string[] {
    return shuffledOptions[qi] || questions[qi]?.options || [];
  }

  const generate = useCallback(async () => {
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setError(null);
    setShowResults(false);
    setReviewWrong(false);
    if (fileName) clearQuizState(fileName);
    try {
      const data = await generateQuiz({ content: pptContent, count, type, model });
      setQuestions(data.questions);
      setShuffledOptions(data.questions.map((q) => shuffle(q.options)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }, [pptContent, count, type, model]);

  const select = (qi: number, opt: string) => {
    setAnswers((a) => {
      if (a[qi] === opt) {
        const n = { ...a }; delete n[qi]; return n;
      }
      return { ...a, [qi]: opt };
    });
  };

  const isCorrect = (q: QuizQuestion, opt: string): boolean => {
    const norm = (s: string) => s.replace(/^[A-Z]\.\s*/, "").trim();
    return opt === q.answer || norm(opt) === norm(q.answer);
  };

  const answered = Object.keys(answers).length;
  const correct = questions.reduce((n, q, i) => answers[i] !== undefined && isCorrect(q, answers[i]) ? n + 1 : n, 0);
  const wrongIndices = questions.map((_, i) => i).filter((i) => answers[i] !== undefined && !isCorrect(questions[i], answers[i]));

  const selectStyle: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px",
    fontSize: "0.8rem", background: "var(--card)", color: "var(--ink)", cursor: "pointer",
  };

  // ── 结果页面 ──
  if (showResults && questions.length > 0) {
    const pct = Math.round((correct / questions.length) * 100);
    const wrongOnes = questions.filter((_, i) => answers[i] !== undefined && !isCorrect(questions[i], answers[i]));
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* 成绩卡片 */}
        <div style={{
          background: "linear-gradient(135deg, var(--accent), #6366f1)", borderRadius: 16, padding: 28,
          textAlign: "center", color: "white", marginBottom: 20,
        }}>
          <div style={{ fontSize: "3rem", marginBottom: 8 }}>{pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚"}</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{correct}/{questions.length}</div>
          <div style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: 4 }}>{pct}% 正确率</div>
          <div style={{ marginTop: 12, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "white", borderRadius: 3, transition: "width .5s ease" }} />
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => { setShowResults(false); }} style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: "0.82rem", color: "var(--muted)", cursor: "pointer" }}>查看详情</button>
          {wrongIndices.length > 0 && (
            <button onClick={() => { setReviewWrong(true); setShowResults(false); }} style={{ flex: 1, background: "var(--danger-glow)", border: "1px solid var(--danger)", borderRadius: 10, padding: "10px", fontSize: "0.82rem", color: "var(--danger)", cursor: "pointer" }}>复习错题 ({wrongIndices.length})</button>
          )}
          <button onClick={() => generate()} style={{ flex: 1, background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "10px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>再来一套</button>
        </div>
      </div>
    );
  }

  const displayQuestions = reviewWrong ? questions.filter((_, i) => wrongIndices.includes(i)) : questions;

  return (
    <div>
      {/* 控制区 */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
          题目 <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={selectStyle} disabled={loading}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} 题</option>)}
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
          题型 <select value={type} onChange={(e) => setType(e.target.value as QuizType)} style={selectStyle} disabled={loading}>
            <option value="mixed">混合</option><option value="choice">单选</option><option value="judge">判断</option>
          </select>
        </label>

        {/* 进度 */}
        {questions.length > 0 && !reviewWrong && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 80, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${(answered / questions.length) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 2, transition: "width .4s ease" }} />
            </div>
            <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--muted)" }}>
              {answered}/{questions.length}
            </span>
          </div>
        )}

        <button onClick={() => generate()} disabled={loading || !pptContent.trim()}
          style={{ marginLeft: "auto", background: loading ? "var(--muted)" : "var(--accent)", color: "white", border: "none", padding: "10px 20px", borderRadius: 5, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.79rem", transition: "background .2s" }}>
          {loading ? "⏳ 生成中…" : questions.length > 0 ? "↻ 重来" : "✨ 出题"}
        </button>
      </div>

      {reviewWrong && (
        <div style={{ fontSize: "0.82rem", color: "var(--accent)", marginBottom: 16 }}>
          🔄 正在复习 {wrongIndices.length} 道错题
          <button onClick={() => setReviewWrong(false)} style={{ marginLeft: 10, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.78rem", textDecoration: "underline" }}>看全部</button>
        </div>
      )}

      {error && <div role="alert" style={{ marginBottom: 20, padding: "10px 14px", border: "1.5px solid var(--danger)", background: "var(--danger-glow)", color: "var(--danger)", borderRadius: 8, fontSize: "0.82rem" }}>⚠️ {error}</div>}

      {questions.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: "56px 20px", color: "var(--muted)", fontSize: "0.84rem", lineHeight: 1.7 }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>✏️</div>
          点击「出题」，AI 会根据课件内容生成练习题
        </div>
      )}

      {/* 提交按钮 */}
      {questions.length > 0 && !showResults && answered > 0 && (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <button onClick={() => setShowResults(true)}
            style={{
              background: answered === questions.length ? "var(--accent)" : "var(--accent-glow)",
              color: answered === questions.length ? "white" : "var(--accent)",
              border: answered === questions.length ? "none" : "1px solid var(--accent)",
              borderRadius: 10, padding: "10px 28px", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
              transition: "all .2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            提交答案 ({answered}/{questions.length})
          </button>
        </div>
      )}

      {/* 题目列表 */}
      {displayQuestions.map((q, di) => {
        const qi = reviewWrong ? questions.indexOf(q) : di;
        const opts = getOptions(qi);
        return (
          <div key={qi} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "20px 24px", marginBottom: 16, animation: "fadeUp .25s ease" }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.68rem", background: "color-mix(in srgb, var(--ink) 8%, var(--paper))", color: "var(--muted)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 20 }}>
              {q.type === "choice" ? "单选" : "判断"}
            </span>
            <div style={{ fontWeight: 600, fontSize: "0.94rem", marginTop: 8, marginBottom: 14, lineHeight: 1.55 }}>
              {qi + 1}. {q.question}
            </div>
            {opts.map((opt, oi) => {
              const chosen = answers[qi] === opt;
              return (
                <button key={oi} type="button" onClick={() => select(qi, opt)}
                  style={{
                    width: "100%", textAlign: "left", font: "inherit", padding: "10px 14px",
                    border: `1.5px solid ${chosen ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", gap: 10,
                    background: chosen ? "var(--accent-subtle)" : "var(--paper)",
                    color: chosen ? "var(--accent)" : "var(--ink)",
                    cursor: "pointer", fontSize: "0.84rem",
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => { if (!chosen) e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { if (!chosen) e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <span style={{
                    fontFamily: "monospace", fontSize: "0.7rem", width: 22, height: 22, borderRadius: "50%",
                    border: `1px solid ${chosen ? "var(--accent)" : "currentColor"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: chosen ? "var(--accent)" : "none",
                    color: chosen ? "white" : "inherit",
                  }}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {chosen && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
