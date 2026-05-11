"use client";

import { useEffect, useState } from "react";
import type { ChangelogEntry } from "@/lib/changelog-store";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--paper)",
      color: "var(--ink)",
    }}>
      {/* 顶栏 */}
      <header style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--paper)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <a href="/" style={{
          fontFamily: "'Noto Serif SC', Georgia, serif",
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "var(--accent)",
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}>
          FinalsPass
        </a>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{
          fontSize: "0.82rem",
          color: "var(--muted)",
          fontFamily: "monospace",
        }}>
          更新日志
        </span>
      </header>

      <main style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 20px 60px",
      }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--accent), #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            margin: "0 auto 16px",
            color: "white",
          }}>
            📋
          </div>
          <h1 style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            margin: "0 0 6px",
            fontFamily: "'Noto Serif SC', Georgia, serif",
          }}>
            更新日志
          </h1>
          <p style={{
            fontSize: "0.82rem",
            color: "var(--muted)",
            margin: 0,
            lineHeight: 1.7,
          }}>
            FinalsPass 的每一次改进与修复
          </p>
        </div>

        {loading && (
          <div style={{
            textAlign: "center",
            padding: 60,
            color: "var(--muted)",
            fontSize: "0.85rem",
          }}>
            加载中…
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: 60,
            color: "var(--muted)",
            fontSize: "0.85rem",
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
            暂无更新记录
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ position: "relative" }}>
            {/* 时间线竖线 */}
            <div style={{
              position: "absolute",
              left: 15,
              top: 0,
              bottom: 0,
              width: 2,
              background: "var(--border)",
              borderRadius: 1,
            }} />

            {entries.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  position: "relative",
                  paddingLeft: 48,
                  paddingBottom: i < entries.length - 1 ? 28 : 0,
                  animation: `fadeUp .3s ease ${i * 0.06}s both`,
                }}
              >
                {/* 时间线圆点 */}
                <div style={{
                  position: "absolute",
                  left: 9,
                  top: 6,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  border: "3px solid var(--paper)",
                  zIndex: 1,
                }} />

                {/* 日期标签 */}
                <div style={{
                  fontSize: "0.68rem",
                  fontFamily: "monospace",
                  color: "var(--muted)",
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                }}>
                  {entry.date}
                </div>

                {/* 卡片 */}
                <div style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}>
                  <h3 style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    margin: "0 0 10px",
                    color: "var(--ink)",
                  }}>
                    {entry.title}
                  </h3>
                  <ul style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}>
                    {entry.changes.map((change, ci) => (
                      <li
                        key={ci}
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--muted)",
                          lineHeight: 1.6,
                          paddingLeft: 18,
                          position: "relative",
                        }}
                      >
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: "0.55em",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          opacity: 0.5,
                        }} />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <footer style={{
        textAlign: "center",
        padding: "20px",
        fontSize: "0.72rem",
        color: "var(--muted)",
        borderTop: "1px solid var(--border)",
      }}>
        <a href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>返回首页</a>
        <span style={{ margin: "0 8px", opacity: 0.3 }}>·</span>
        <span>FinalsPass</span>
      </footer>
    </div>
  );
}
