"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ConvInfo {
  userId: string;
  email: string;
  tier: string;
  lastMsg: { role: string; content: string; ts: number } | null;
  msgCount: number;
}

interface SupportMessage {
  role: "user" | "assistant" | "admin";
  content: string;
  ts: number;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const [convs, setConvs] = useState<ConvInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceMsg, setAnnounceMsg] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [grantTier, setGrantTier] = useState<"pro" | "premium">("pro");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");

  useEffect(() => {
    fetch("/api/announcement").then((r) => r.json()).then((d) => { if (d.text) setAnnounceText(d.text); }).catch(() => {});
  }, []);

  async function saveAnnouncement() {
    if (!announceText.trim()) return;
    try {
      const res = await fetch("/api/announcement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: announceText.trim() }),
      });
      setAnnounceMsg(res.ok ? "✅ 公告已发布" : "❌ 发布失败");
    } catch { setAnnounceMsg("❌ 网络错误"); }
    setTimeout(() => setAnnounceMsg(""), 3000);
  }

  async function clearAnnouncement() {
    try { await fetch("/api/announcement", { method: "DELETE" }); setAnnounceText(""); setAnnounceMsg("✅ 公告已关闭"); }
    catch {}
    setTimeout(() => setAnnounceMsg(""), 3000);
  }

  async function grantPro() {
    if (!grantEmail.trim()) return;
    setGranting(true); setGrantMsg("");
    try {
      const res = await fetch("/api/admin/grant-pro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: grantEmail.trim(), days: grantDays, tier: grantTier }),
      });
      const data = await res.json();
      setGrantMsg(res.ok ? `✅ 已赠送 ${data.email} ${grantDays}天 ${grantTier === "premium" ? "Premium" : "Pro"}` : `❌ ${data.error}`);
    } catch { setGrantMsg("❌ 网络错误"); }
    setGranting(false);
    setTimeout(() => setGrantMsg(""), 4000);
  }

  useEffect(() => {
    fetch("/api/user/support/admin")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations) setConvs(data.conversations);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function selectConv(userId: string) {
    setSelectedId(userId);
    const res = await fetch(`/api/user/support/admin/conv?userId=${userId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setReplyText("");
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      await fetch("/api/user/support/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedId, content: replyText.trim() }),
      });
      setMessages((prev) => [...prev, { role: "admin", content: replyText.trim(), ts: Date.now() }]);
      setReplyText("");
    } catch {}
    setSending(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", color: "var(--muted)", fontSize: "0.85rem" }}>
        加载中…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      {/* 顶栏 */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem" }}>← 首页</a>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>客服消息</h1>
      </div>

      {/* ── 公告管理 ── */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", background: "var(--accent-subtle)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>📢 公告</span>
        <input value={announceText} onChange={(e) => setAnnounceText(e.target.value)} placeholder="输入公告内容…"
          style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }} />
        <button onClick={saveAnnouncement} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500 }}>发布</button>
        <button onClick={clearAnnouncement} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer" }}>关闭</button>
        {announceMsg && <span style={{ fontSize: "0.72rem", color: "var(--success)" }}>{announceMsg}</span>}
      </div>
      {/* ── 赠送 Pro ── */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", background: "rgba(52,211,153,0.04)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>🎁 赠送</span>
        <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="用户邮箱…"
          style={{ width: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }} />
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
          <button onClick={() => setGrantTier("pro")} style={{ background: grantTier === "pro" ? "#2563eb" : "var(--input-bg)", color: grantTier === "pro" ? "white" : "var(--muted)", border: "none", padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer", fontWeight: grantTier === "pro" ? 600 : 400 }}>Pro</button>
          <button onClick={() => setGrantTier("premium")} style={{ background: grantTier === "premium" ? "#7c3aed" : "var(--input-bg)", color: grantTier === "premium" ? "white" : "var(--muted)", border: "none", padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer", fontWeight: grantTier === "premium" ? 600 : 400 }}>Premium</button>
        </div>
        <input type="number" value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} min={1} max={3650}
          style={{ width: 55, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none", textAlign: "center" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>天</span>
        <button onClick={grantPro} disabled={granting}
          style={{ background: granting ? "var(--border)" : "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: "0.78rem", cursor: granting ? "not-allowed" : "pointer", fontWeight: 500, opacity: granting ? 0.6 : 1 }}>{granting ? "赠送中…" : "赠送"}</button>
        {grantMsg && <span style={{ fontSize: "0.72rem", color: grantMsg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>{grantMsg}</span>}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 客户列表 */}
        <div style={{ width: 280, minWidth: 200, borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--sidebar-bg)" }}>
          {convs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
              暂无客户消息
            </div>
          ) : (
            convs.map((c) => (
              <button
                key={c.userId}
                onClick={() => selectConv(c.userId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  background: selectedId === c.userId ? "var(--accent-subtle)" : "none",
                  cursor: "pointer",
                  transition: "background .1s",
                }}
                onMouseEnter={(e) => { if (selectedId !== c.userId) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                onMouseLeave={(e) => { if (selectedId !== c.userId) e.currentTarget.style.background = "none"; }}
              >
                <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.email}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2, display: "flex", gap: 6 }}>
                  <span>{c.tier}</span>
                  <span>{c.msgCount} 条</span>
                </div>
                {c.lastMsg && (
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 }}>
                    {c.lastMsg.content.slice(0, 40)}…
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* 对话区 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selectedId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
              选择一个客户查看对话
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontSize: "0.82rem",
                    lineHeight: 1.6,
                    background: m.role === "user" ? "var(--accent)" : m.role === "admin" ? "#dbeafe" : "var(--accent-glow)",
                    color: m.role === "user" ? "white" : "var(--ink)",
                    borderBottomRightRadius: m.role === "user" ? 4 : 12,
                    borderBottomLeftRadius: m.role === "admin" ? 4 : 12,
                    whiteSpace: "pre-wrap",
                  }}>
                    {m.content}
                    <div style={{ fontSize: "0.6rem", opacity: 0.5, marginTop: 4, textAlign: "right" }}>
                      {new Date(m.ts).toLocaleString("zh-CN")}
                      {m.role === "admin" && " (你)"}
                      {m.role === "assistant" && " (AI)"}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: "0.8rem" }}>
                    暂无消息
                  </div>
                )}
              </div>
              <form onSubmit={handleReply} style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="输入回复…"
                  disabled={sending}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: replyText.trim() && !sending ? "var(--accent)" : "var(--border)",
                    color: replyText.trim() && !sending ? "white" : "var(--muted)",
                    cursor: replyText.trim() && !sending ? "pointer" : "not-allowed",
                    fontWeight: 500,
                    fontSize: "0.82rem",
                  }}
                >
                  {sending ? "发送中…" : "回复"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
