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
  const [extraEmail, setExtraEmail] = useState("");
  const [extraUnits, setExtraUnits] = useState(50);
  const [extraGranting, setExtraGranting] = useState(false);
  const [extraMsg, setExtraMsg] = useState("");
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  // ── 更新日志管理 ──
  interface ChangelogEntry {
    id: string;
    date: string;
    title: string;
    changes: string[];
    createdAt: number;
  }
  const [clEntries, setClEntries] = useState<ChangelogEntry[]>([]);
  const [clDate, setClDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clTitle, setClTitle] = useState("");
  const [clChanges, setClChanges] = useState("");
  const [clMsg, setClMsg] = useState("");
  const [clAdding, setClAdding] = useState(false);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data) => setClEntries(data.entries ?? []))
      .catch(() => {});
  }, []);

  async function handleClAdd() {
    if (!clTitle.trim() || !clChanges.trim()) return;
    setClAdding(true); setClMsg("");
    const changes = clChanges.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/admin/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", date: clDate, title: clTitle.trim(), changes }),
      });
      const data = await res.json();
      if (res.ok) {
        setClEntries((prev) => [data.entry, ...prev]);
        setClTitle("");
        setClChanges("");
        setClDate(new Date().toISOString().slice(0, 10));
        setClMsg("✅ 已添加");
      } else {
        setClMsg(`❌ ${data.error}`);
      }
    } catch {
      setClMsg("❌ 网络错误");
    }
    setClAdding(false);
    setTimeout(() => setClMsg(""), 3000);
  }

  async function handleClDelete(id: string) {
    try {
      await fetch("/api/admin/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      setClEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {}
  }

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

  async function grantExtra() {
    if (!extraEmail.trim()) return;
    setExtraGranting(true); setExtraMsg("");
    try {
      const res = await fetch("/api/admin/grant-extra", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: extraEmail.trim(), units: extraUnits }),
      });
      const data = await res.json();
      setExtraMsg(res.ok ? `✅ 已为 ${data.email} 添加 ${extraUnits} 次（共 ${data.total} 次）` : `❌ ${data.error}`);
    } catch { setExtraMsg("❌ 网络错误"); }
    setExtraGranting(false);
    setTimeout(() => setExtraMsg(""), 4000);
  }

  async function handleConfirmPayment(pendingId: string) {
    try {
      const res = await fetch("/api/admin/pending-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, action: "confirm" }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingPayments((prev) => prev.filter((p: any) => p.id !== pendingId));
        setGrantMsg(data.message || "✅ 已确认");
      } else {
        setGrantMsg(`❌ ${data.error}`);
      }
    } catch { setGrantMsg("❌ 网络错误"); }
    setTimeout(() => setGrantMsg(""), 4000);
  }

  async function handleRejectPayment(pendingId: string) {
    try {
      await fetch("/api/admin/pending-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, action: "reject" }),
      });
      setPendingPayments((prev) => prev.filter((p: any) => p.id !== pendingId));
    } catch {}
  }

  useEffect(() => {
    fetch("/api/user/support/admin")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations) setConvs(data.conversations);
      })
      .catch(() => router.push("/login?redirect=/admin/messages"))
      .finally(() => setLoading(false));

    fetch("/api/admin/pending-payments")
      .then((r) => r.json())
      .then((data) => {
        if (data.payments) setPendingPayments(data.payments);
      })
      .catch(() => {});
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
      {/* ── 赠送 Pro/额外配额 ── */}
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
        <span style={{ fontSize: "0.65rem", color: "var(--border)", margin: "0 4px" }}>│</span>
        <input value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} placeholder="赠送额度邮箱…"
          style={{ width: 160, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }} />
        <input type="number" value={extraUnits} onChange={(e) => setExtraUnits(Number(e.target.value))} min={1} max={10000}
          style={{ width: 55, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none", textAlign: "center" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>次</span>
        <button onClick={grantExtra} disabled={extraGranting}
          style={{ background: extraGranting ? "var(--border)" : "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: "0.78rem", cursor: extraGranting ? "not-allowed" : "pointer", fontWeight: 500, opacity: extraGranting ? 0.6 : 1 }}>{extraGranting ? "添加中…" : "添加"}</button>
        {extraMsg && <span style={{ fontSize: "0.72rem", color: extraMsg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>{extraMsg}</span>}
      </div>

      {/* ── 待确认支付 ── */}
      {pendingPayments.length > 0 && (
        <div style={{ borderBottom: "1px solid var(--border)", background: "rgba(251,191,36,0.04)" }}>
          <div style={{ padding: "8px 20px", fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            🕐 待确认支付（{pendingPayments.length}）
          </div>
          {pendingPayments.map((p: any) => (
            <div key={p.id} style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)" }}>{p.email}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <span>{p.label}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>¥{p.amount?.toFixed(2)}</span>
                  <span>📱 {p.phone}</span>
                  <span style={{ opacity: 0.6 }}>{new Date(p.timestamp).toLocaleString("zh-CN")}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleConfirmPayment(p.id)}
                  style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 500 }}
                >
                  确认收款
                </button>
                <button
                  onClick={() => handleRejectPayment(p.id)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 更新日志管理 ── */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.03)" }}>
        <div style={{ padding: "8px 20px", fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          📋 更新日志管理
        </div>
        <div style={{ padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={clDate} onChange={(e) => setClDate(e.target.value)}
              style={{ width: 140, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }} />
            <input value={clTitle} onChange={(e) => setClTitle(e.target.value)} placeholder="标题（如：知识点提取优化）"
              style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none" }} />
          </div>
          <textarea value={clChanges} onChange={(e) => setClChanges(e.target.value)} placeholder="每行一条变更内容&#10;例如：&#10;优化知识提取提示词，减少遗漏&#10;修复注册频率限制过严问题"
            rows={3} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.82rem", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleClAdd} disabled={clAdding || !clTitle.trim() || !clChanges.trim()}
              style={{ background: clAdding || !clTitle.trim() || !clChanges.trim() ? "var(--border)" : "#6366f1", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: "0.78rem", cursor: clAdding || !clTitle.trim() || !clChanges.trim() ? "not-allowed" : "pointer", fontWeight: 500, opacity: clAdding || !clTitle.trim() || !clChanges.trim() ? 0.6 : 1 }}>
              {clAdding ? "添加中…" : "发布更新"}
            </button>
            {clMsg && <span style={{ fontSize: "0.72rem", color: clMsg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>{clMsg}</span>}
          </div>
          {clEntries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
              {clEntries.slice(0, 10).map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 6, background: "var(--accent-subtle)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "monospace" }}>{e.date}</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)", marginTop: 1 }}>{e.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {e.changes.slice(0, 3).map((c, i) => (
                        <span key={i} style={{ background: "var(--paper2)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{c}</span>
                      ))}
                      {e.changes.length > 3 && <span style={{ opacity: 0.6 }}>+{e.changes.length - 3}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleClDelete(e.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "2px 4px", opacity: 0.5, flexShrink: 0 }}
                    onMouseEnter={(ee) => { ee.currentTarget.style.opacity = "1"; ee.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={(ee) => { ee.currentTarget.style.opacity = "0.5"; ee.currentTarget.style.color = "var(--muted)"; }}
                    title="删除">✕</button>
                </div>
              ))}
              {clEntries.length > 10 && (
                <a href="/changelog" target="_blank" style={{ fontSize: "0.72rem", color: "var(--accent)", textDecoration: "none", padding: "4px 8px" }}>
                  查看全部 {clEntries.length} 条 →
                </a>
              )}
            </div>
          )}
        </div>
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
