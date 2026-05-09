"use client";
import { useEffect, useRef, useState } from "react";
import { generateQuiz, type QuizQuestion } from "@/lib/api-client";
import { saveQuizState, loadQuizState, clearQuizState } from "@/lib/store";

type QuizType = "mixed" | "choice" | "judge";

interface QuizTabProps {
  pptContent: string;
  fileName?: string;
}

export default function QuizTab({ pptContent, fileName }: QuizTabProps) {
  const [count, setCount] = useState<number>(5);
  const [type, setType] = useState<QuizType>("mixed");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);

  // Restore quiz state on mount
  useEffect(() => {
    if (!fileName || restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadQuizState(fileName);
    if (saved) {
      setQuestions(saved.questions);
      setAnswers(saved.answers);
      setType(saved.type);
      setCount(saved.count);
    }
  }, [fileName]);

  // Auto-save progress
  const persistKey = fileName;
  useEffect(() => {
    if (!persistKey || questions.length === 0) return;
    saveQuizState(persistKey, { type, count, questions, answers });
  }, [persistKey, type, count, questions, answers]);

  const generate = async () => {
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setError(null);
    if (fileName) clearQuizState(fileName);
    try {
      const data = await generateQuiz({
        content: pptContent,
        count,
        type,
      });
      setQuestions(data.questions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const select = (qi: number, opt: string) => {
    if (answers[qi] !== undefined) return;
    setAnswers((a) => ({ ...a, [qi]: opt }));
  };

  const isCorrect = (q: QuizQuestion, opt: string): boolean => {
    const norm = (s: string) => s.replace(/^[A-Z]\.\s*/, "").trim();
    return opt === q.answer || norm(opt) === norm(q.answer);
  };

  // 进度统计
  const answered = Object.keys(answers).length;
  const correct = questions.reduce(
    (n, q, i) =>
      answers[i] !== undefined && isCorrect(q, answers[i]) ? n + 1 : n,
    0
  );
  const allDone = questions.length > 0 && answered === questions.length;
  const pct = questions.length > 0 ? (answered / questions.length) * 100 : 0;

  const selectStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 10px",
    fontSize: "0.8rem",
    background: "var(--card)",
    color: "var(--ink)",
    cursor: "pointer",
  };

  return (
    <div>
      {/* 控制区 */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 24,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          题目数量
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={selectStyle}
            disabled={loading}
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} 题
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          题型
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuizType)}
            style={selectStyle}
            disabled={loading}
          >
            <option value="mixed">混合题型</option>
            <option value="choice">单选题</option>
            <option value="judge">判断题</option>
          </select>
        </label>

        {questions.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* 进度条 */}
            <div
              style={{
                width: 100,
                height: 4,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: allDone ? "var(--success)" : "var(--accent)",
                  borderRadius: 2,
                  transition: "width .4s ease, background .3s",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.72rem",
                color: "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              {answered}/{questions.length}
              {allDone && ` · ${correct}/${questions.length} 正确`}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !pptContent.trim()}
          style={{
            marginLeft: "auto",
            background: loading ? "var(--muted)" : "var(--accent)",
            color: "white",
            border: "none",
            padding: "10px 24px",
            borderRadius: 5,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "monospace",
            fontSize: "0.79rem",
            transition: "background .2s",
          }}
        >
          {loading
            ? "⏳ 生成中…"
            : questions.length > 0
            ? "↻ 重新生成"
            : "✨ 生成练习题"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            border: "1.5px solid var(--danger)",
            background: "var(--danger-glow)",
            color: "var(--danger)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            animation: "fadeUp .25s ease",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 空状态 */}
      {questions.length === 0 && !loading && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "56px 20px",
            color: "var(--muted)",
            fontSize: "0.84rem",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>✏️</div>
          点击「生成练习题」,AI 会根据课件内容出题
        </div>
      )}

      {/* 题目列表 */}
      {questions.map((q, qi) => (
        <div
          key={qi}
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 16,
            animation: "fadeUp .3s ease",
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.68rem",
                background: "color-mix(in srgb, var(--ink) 8%, var(--paper))",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              {q.type === "choice" ? "单选" : "判断"}
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Noto Serif SC', Georgia, serif",
              fontWeight: 600,
              fontSize: "0.94rem",
              marginBottom: 14,
              lineHeight: 1.55,
            }}
          >
            {qi + 1}. {q.question}
          </div>
          {q.options.map((opt, oi) => {
            const isAnswered = answers[qi] !== undefined;
            const chosen = answers[qi] === opt;
            const correctOpt = isCorrect(q, opt);
            const bg = !isAnswered
              ? "var(--paper)"
              : correctOpt
              ? "color-mix(in srgb, var(--success) 12%, var(--paper))"
              : chosen
              ? "var(--danger-glow)"
              : "var(--paper)";
            const bc = !isAnswered
              ? "var(--border)"
              : correctOpt
              ? "var(--success)"
              : chosen
              ? "var(--danger)"
              : "var(--border)";
            const fc = !isAnswered
              ? "var(--ink)"
              : correctOpt
              ? "var(--success)"
              : chosen
              ? "var(--danger)"
              : "var(--ink)";
            return (
              <button
                type="button"
                key={oi}
                className={`opt-item${isAnswered ? " answered" : ""}`}
                onClick={() => select(qi, opt)}
                disabled={isAnswered}
                style={{
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  padding: "10px 14px",
                  border: `1px solid ${bc}`,
                  borderRadius: 6,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: bg,
                  color: fc,
                  cursor: isAnswered ? "default" : "pointer",
                  fontSize: "0.84rem",
                  transition: "all .15s",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.7rem",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "1px solid currentColor",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
                {isAnswered && correctOpt && (
                  <span style={{ fontSize: "1rem" }}>✓</span>
                )}
                {isAnswered && chosen && !correctOpt && (
                  <span style={{ fontSize: "1rem" }}>✗</span>
                )}
              </button>
            );
          })}
          {answers[qi] !== undefined && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 16px",
                background: "var(--paper2)",
                borderRadius: 6,
                fontSize: "0.81rem",
                lineHeight: 1.7,
                color: "var(--muted)",
                borderLeft: "3px solid var(--border)",
              }}
            >
              💡 解析:{q.explanation}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
