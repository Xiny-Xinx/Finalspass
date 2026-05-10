"use client";
import { useState, useEffect, useCallback } from "react";

interface DayPlan {
  day: number; title: string; focus: string; tasks: string[]; hours: string;
}

interface StudyPlan {
  overview: string; dailyPlan: DayPlan[]; tips: string[]; keyFormulas: string;
}

const STORAGE_KEY = "finalspass:studyplan";

function savePlan(plan: StudyPlan, completed: number[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, completed, savedAt: Date.now() })); } catch {}
}

function loadPlan(): { plan: StudyPlan; completed: number[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.plan?.dailyPlan) return { plan: data.plan, completed: data.completed || [] };
    return null;
  } catch { return null; }
}

export default function StudyPlanTab() {
  const [examName, setExamName] = useState("MATH1062 Mathematics 1B");
  const [days, setDays] = useState(14);
  const [chapters, setChapters] = useState("微分方程（可分离/线性/二阶）、3D曲线与曲面、偏导数与方向导数、梯度与优化、置信区间与假设检验、线性模型与卡方检验");
  const [hours, setHours] = useState(3);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "result">("form");
  const [progressMsg, setProgressMsg] = useState("");

  // 恢复上次计划
  useEffect(() => {
    const saved = loadPlan();
    if (saved) { setPlan(saved.plan); setCompletedDays(saved.completed); setStep("result"); }
  }, []);

  const progress = plan ? Math.round((completedDays.length / plan.dailyPlan.length) * 100) : 0;

  function toggleDay(day: number) {
    setCompletedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      if (plan) savePlan(plan, next);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!examName || !chapters) return;
    setLoading(true);
    setProgressMsg("AI 正在分析考试范围…");
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, daysUntilExam: days, chapters, hoursPerDay: hours }),
      });
      const data = await res.json();
      if (res.ok && data.dailyPlan?.length > 0) {
        setPlan(data);
        setCompletedDays([]);
        setStep("result");
        savePlan(data, []);
      } else {
        setProgressMsg(data.error || "生成失败，请重试");
      }
    } catch { setProgressMsg("网络错误"); }
    setLoading(false);
  }

  function reset() {
    setPlan(null);
    setCompletedDays([]);
    setStep("form");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // ── 表单视图 ──
  if (step === "form") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>📋</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px" }}>AI 考前速成</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            输入考试信息，AI 为你量身定制每日复习计划<br />
            覆盖所有知识点，科学安排考前每一天
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" }}>考试名称</label>
              <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="如：MATH1062 Mathematics 1B" required style={inputS} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" }}>还剩几天</label>
                <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} min={1} max={365} required style={inputS} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" }}>每天几小时</label>
                <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min={0.5} max={16} step={0.5} required style={inputS} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" }}>考试范围</label>
              <textarea value={chapters} onChange={(e) => setChapters(e.target.value)} placeholder="输入考试范围，如：微分方程（可分离/线性/二阶）、3D曲线与曲面、偏导数与方向导数、梯度与优化、置信区间与假设检验、线性模型与卡方检验" required rows={3} style={{ ...inputS, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            <button type="submit" disabled={loading}
              style={{
                marginTop: 8,
                background: loading ? "var(--border)" : "var(--accent)",
                color: loading ? "var(--muted)" : "white",
                border: "none", borderRadius: 12, padding: "14px", fontSize: "0.9rem", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer", transition: "all .2s",
                letterSpacing: "0.03em",
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin .8s linear infinite", display: "inline-block" }} />
                  {progressMsg}
                </span>
              ) : "生成备考计划"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!plan) return null;

  // ── 计划结果视图 ──
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* 顶部进度概览 */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent), #6366f1)",
        borderRadius: 16, padding: 24, marginBottom: 24, color: "white",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: 2 }}>备考计划</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{examName || "考试"}</div>
          </div>
          <button onClick={reset} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
            padding: "6px 12px", color: "white", fontSize: "0.72rem", cursor: "pointer",
          }}>重新生成</button>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{days}</div><div style={{ fontSize: "0.7rem", opacity: 0.7 }}>剩余天数</div></div>
          <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{plan.dailyPlan.length}</div><div style={{ fontSize: "0.7rem", opacity: 0.7 }}>复习计划</div></div>
          <div><div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{completedDays.length}</div><div style={{ fontSize: "0.7rem", opacity: 0.7 }}>已完成</div></div>
        </div>
        {/* 进度条 */}
        <div style={{ marginTop: 14, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "white", borderRadius: 2, transition: "width .3s ease" }} />
        </div>
      </div>

      {/* 备考策略 */}
      {plan.overview && (
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: "0.84rem", lineHeight: 1.7, color: "var(--ink-dim)" }}>
          📌 {plan.overview}
        </div>
      )}

      {/* 每日计划列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {plan.dailyPlan.map((d) => {
          const done = completedDays.includes(d.day);
          return (
            <div key={d.day} style={{
              background: "var(--card)", border: `1px solid ${done ? "var(--success)" : "var(--card-border)"}`,
              borderRadius: 12, padding: "14px 16px",
              opacity: done ? 0.75 : 1,
              transition: "all .2s",
              animation: "fadeUp .2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* Day 圆圈 */}
                <div onClick={() => toggleDay(d.day)} style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 700,
                  background: done ? "var(--success)" : "var(--accent-glow)",
                  color: done ? "white" : "var(--accent)",
                  transition: "all .2s",
                  userSelect: "none",
                }}>
                  {done ? "✓" : d.day}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: done ? "var(--muted)" : "var(--ink)" }}>
                      {d.title}
                    </span>
                    {d.hours && <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--muted)", opacity: 0.7 }}>{d.hours}h</span>}
                  </div>
                  {d.focus && <div style={{ fontSize: "0.72rem", color: "var(--accent)", marginBottom: 6 }}>{d.focus}</div>}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                    {d.tasks.map((t, i) => (
                      <li key={i} style={{
                        fontSize: "0.78rem", color: done ? "var(--muted)" : "var(--ink-dim)",
                        paddingLeft: 14, position: "relative", lineHeight: 1.5,
                      }}>
                        <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>·</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 必记要点 */}
      {plan.keyFormulas && (
        <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: "0.82rem", fontWeight: 600, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
            <span>📌</span> 必记要点
          </h4>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--ink-dim)", margin: 0, whiteSpace: "pre-wrap" }}>{plan.keyFormulas}</p>
        </div>
      )}

      {/* 备考建议 */}
      {plan.tips.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <h4 style={{ fontSize: "0.82rem", fontWeight: 600, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <span>💡</span> 备考建议
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.tips.map((t, i) => (
              <li key={i} style={{ fontSize: "0.8rem", lineHeight: 1.5, color: "var(--ink-dim)", paddingLeft: 16, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.84rem", outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};
