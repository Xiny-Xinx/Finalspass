"use client";
import { useState } from "react";

interface DayPlan {
  day: number; title: string; focus: string; tasks: string[]; duration: string;
}

interface StudyPlan {
  overview: string;
  dailyPlan: DayPlan[];
  tips: string[];
  keyFormulas: string;
}

export default function StudyPlanTab() {
  const [examName, setExamName] = useState("");
  const [days, setDays] = useState(7);
  const [chapters, setChapters] = useState("");
  const [hours, setHours] = useState(3);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!examName || !chapters) return;
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, daysUntilExam: days, chapters, hoursPerDay: hours }),
      });
      const data = await res.json();
      if (res.ok) setPlan(data);
      else setError(data.error || "生成失败");
    } catch { setError("网络错误"); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {!plan ? (
        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>📋 AI 考前速成</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
            输入考试信息，AI 为你量身定制每日复习计划
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="考试名称（如：微积分期末）" required
              style={inputStyle} />
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} max={365}
                placeholder="距离考试天数" required style={{ ...inputStyle, width: 120 }} />
              <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min={0.5} max={16} step={0.5}
                placeholder="每天可用小时" required style={{ ...inputStyle, width: 140 }} />
            </div>
            <textarea value={chapters} onChange={(e) => setChapters(e.target.value)} placeholder="考试范围（如：第1-5章、微分方程、矩阵运算）" required rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

            <button type="submit" disabled={loading}
              style={{
                background: loading ? "var(--border)" : "var(--accent)",
                color: loading ? "var(--muted)" : "white",
                border: "none", borderRadius: 10, padding: "12px", fontSize: "0.85rem", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer", transition: "opacity .2s",
              }}
            >
              {loading ? "AI 正在规划…" : "生成备考计划"}
            </button>
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
        </form>
      ) : (
        <div>
          {/* 概览 */}
          <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 6px" }}>📋 备考策略</h3>
            <p style={{ fontSize: "0.84rem", lineHeight: 1.7, color: "var(--ink)", margin: 0 }}>{plan.overview}</p>
          </div>

          {/* 每日计划 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {plan.dailyPlan.map((d) => (
              <div key={d.day} style={{
                background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 14,
                animation: "fadeUp .2s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", background: "var(--accent-glow)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", flexShrink: 0,
                  }}>
                    {d.day}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{d.focus} · {d.duration}h</div>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {d.tasks.map((t, i) => (
                    <li key={i} style={{ fontSize: "0.8rem", color: "var(--ink-dim)", paddingLeft: 12, position: "relative", lineHeight: 1.5 }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>·</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 必记公式 */}
          {plan.keyFormulas && (
            <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 6px" }}>📌 必记要点</h4>
              <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--ink-dim)", margin: 0 }}>{plan.keyFormulas}</p>
            </div>
          )}

          {/* 备考建议 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 10px" }}>💡 备考建议</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {plan.tips.map((t, i) => (
                <li key={i} style={{ fontSize: "0.82rem", lineHeight: 1.5, color: "var(--ink-dim)", paddingLeft: 16, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <button onClick={() => setPlan(null)}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: 10,
              fontSize: "0.82rem", color: "var(--muted)", cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            重新生成
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.84rem", outline: "none",
  fontFamily: "inherit",
};
