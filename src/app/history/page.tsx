"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_KEY } from "@/lib/constants";
import {
  listSessions,
  deleteSession,
  clearAllSessions,
  loadSession,
  getAllMemories,
  clearAllMemories,
  type SessionMeta,
  type MemoryItem,
} from "@/lib/store";

type Tab = "sessions" | "memories";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [tab, setTab] = useState<Tab>("sessions");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setSessions(listSessions());
    setMemories(getAllMemories());
  }, []);

  const refresh = () => {
    setSessions(listSessions());
    setMemories(getAllMemories());
  };

  const handleDelete = (id: string) => {
    deleteSession(id);
    refresh();
  };

  const handleRestore = (id: string) => {
    const data = loadSession(id);
    if (data) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            fileName: data.fileName,
            pptContent: data.pptContent,
            cards: data.cards,
          })
        );
        window.location.href = "/";
      } catch {}
    }
  };

  const handleClearAll = () => {
    clearAllSessions();
    setConfirmClear(false);
    refresh();
  };

  const handleClearMemories = () => {
    clearAllMemories();
    refresh();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--paper)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          transition: "background .3s ease",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "5px 12px",
            fontSize: "0.73rem",
            fontFamily: "monospace",
            cursor: "pointer",
            color: "var(--muted)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--ink)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--muted)";
          }}
        >
          ← 返回
        </button>
        <h1
          style={{
            fontFamily: "'Noto Serif SC', Georgia, serif",
            fontSize: "1.15rem",
            fontWeight: 700,
          }}
        >
          历史记录
        </h1>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Tab bar */}
        <div
          role="tablist"
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            marginBottom: 24,
          }}
        >
          {[
            ["sessions", `📋 会话记录 (${sessions.length})`] as const,
            ["memories", `🧠 AI 记忆 (${memories.length})`] as const,
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id as Tab)}
              style={{
                padding: "9px 20px",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
                cursor: "pointer",
                border: "none",
                background: "none",
                color: tab === id ? "var(--ink)" : "var(--muted)",
                borderBottom: `3px solid ${tab === id ? "var(--accent)" : "transparent"}`,
                marginBottom: -2,
                transition: "all .2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Sessions Tab ── */}
        {tab === "sessions" && (
          <div>
            {sessions.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "56px 20px",
                  color: "var(--muted)",
                  fontSize: "0.84rem",
                  lineHeight: 1.7,
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>📭</div>
                暂无历史记录
                <br />
                上传课件后会自动保存会话
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "var(--card)",
                      border: "1.5px solid var(--border)",
                      borderRadius: 8,
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      animation: "fadeUp .25s ease both",
                    }}
                  >
                    <div style={{ fontSize: "1.5rem" }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.fileName}
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.65rem",
                          color: "var(--muted)",
                          display: "flex",
                          gap: 12,
                        }}
                      >
                        <span>{formatDate(s.timestamp)}</span>
                        <span>{s.cardCount} 个知识点</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleRestore(s.id)}
                        style={{
                          background: "var(--ink)",
                          color: "var(--paper)",
                          border: "none",
                          padding: "6px 14px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        恢复
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        style={{
                          background: "none",
                          border: "1.5px solid var(--danger)",
                          color: "var(--danger)",
                          padding: "6px 14px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}

                {/* Clear all */}
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  {confirmClear ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        确定清除所有记录？
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        style={{
                          background: "var(--danger)",
                          color: "white",
                          border: "none",
                          padding: "6px 16px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                        }}
                      >
                        确认清除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          padding: "6px 16px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                          color: "var(--muted)",
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        padding: "8px 20px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.72rem",
                        fontFamily: "monospace",
                        cursor: "pointer",
                        color: "var(--muted)",
                      }}
                    >
                      清除所有历史记录
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Memories Tab ── */}
        {tab === "memories" && (
          <div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--muted)",
                marginBottom: 20,
                lineHeight: 1.7,
              }}
            >
              AI 会自动记住你和它的问答内容，在后续对话中参考相关记忆。
              记忆条数上限为 {200} 条，超出后自动淘汰旧记忆。
            </p>

            {memories.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "56px 20px",
                  color: "var(--muted)",
                  fontSize: "0.84rem",
                  lineHeight: 1.7,
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>🧠</div>
                暂无记忆
                <br />
                在问答 Tab 中提问后，AI 会自动记住关键信息
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {memories.slice(0, 50).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: "var(--card)",
                      border: "1.5px solid var(--border)",
                      borderRadius: 8,
                      padding: "14px 18px",
                      animation: "fadeUp .25s ease both",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.62rem",
                        color: "var(--muted)",
                        marginBottom: 6,
                      }}
                    >
                      {formatDate(m.timestamp)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      Q: {m.question}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--muted)",
                        lineHeight: 1.6,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginBottom: 6,
                      }}
                    >
                      A: {m.answer}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {m.keywords.slice(0, 6).map((kw) => (
                        <span
                          key={kw}
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.6rem",
                            background: "var(--paper2)",
                            border: "1px solid var(--border)",
                            padding: "1px 6px",
                            borderRadius: 10,
                            color: "var(--muted)",
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={handleClearMemories}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      padding: "8px 20px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.72rem",
                      fontFamily: "monospace",
                      cursor: "pointer",
                      color: "var(--muted)",
                    }}
                  >
                    清除所有记忆
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
