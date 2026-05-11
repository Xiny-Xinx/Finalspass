"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardData {
  totalUsers: number; proUsers: number; premiumUsers: number;
  freeUsers: number; todayApiCalls: number; dateKey: string;
  pendingPayments: number;
}

interface UserInfo {
  email: string; username: string; tier: string;
  verified: boolean; tierExpiresAt: string | null; createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/dashboard").then(r => r.json()).then(d => {
      if (d.totalUsers !== undefined) setData(d);
    }).catch(() => router.push("/login")).finally(() => setLoading(false));
  }, []);

  async function searchUser() {
    if (!searchEmail.trim()) return;
    setSearching(true); setUserInfo(null); setUserNotFound(false); setActionMsg("");
    try {
      const res = await fetch("/api/admin/grant-pro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: searchEmail.trim(), days: 0 }),
      });
      const d = await res.json();
      if (d.error === "该邮箱未注册") {
        setUserNotFound(true);
      } else if (d.email) {
        setUserInfo({ email: d.email, username: d.username || "", tier: d.tier || "free", verified: d.verified ?? false, tierExpiresAt: d.tierExpiresAt || null, createdAt: d.createdAt || "" });
      }
    } catch {}
    setSearching(false);
  }

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", color: "var(--muted)" }}>加载中…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      {/* 顶栏 */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem" }}>← 首页</a>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>管理后台</h1>
        <a href="/admin/messages" style={{ marginLeft: "auto", fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none" }}>客服工单 →</a>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
        {/* 数据卡片 */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              ["👥", "总用户", data.totalUsers, "var(--accent)"],
              ["🆓", "免费版", data.freeUsers, "var(--muted)"],
              ["🚀", "Pro", data.proUsers, "#3b82f6"],
              ["💎", "Premium", data.premiumUsers, "#7c3aed"],
              ["📊", "今日调用", data.todayApiCalls, "#16a34a"],
              ["⏳", "待确认支付", data.pendingPayments, "#f59e0b"],
            ].map(([icon, label, val, color]) => (
              <div key={label as string} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "16px 14px" }}>
                <div style={{ color: color as string, fontSize: "1.2rem", marginBottom: 4 }}>{icon as string}</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)" }}>{val as number}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{label as string}</div>
              </div>
            ))}
          </div>
        )}

        {/* 用户查询 */}
        <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.95rem", margin: "0 0 4px", fontWeight: 600 }}>🔍 用户查询</h3>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 12px" }}>输入邮箱查看用户信息</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="输入用户邮箱…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.84rem", outline: "none" }} />
            <button onClick={searchUser} disabled={searching}
              style={{ background: searching ? "var(--border)" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: "0.82rem", cursor: searching ? "not-allowed" : "pointer", fontWeight: 500 }}>
              {searching ? "搜索中…" : "搜索"}
            </button>
          </div>

          {userNotFound && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--danger-glow)", borderRadius: 8, fontSize: "0.82rem", color: "var(--danger)" }}>
              ❌ {searchEmail} — 未找到该邮箱
            </div>
          )}

          {userInfo && (
            <div style={{ marginTop: 12, padding: "14px 16px", background: "var(--accent-glow)", borderRadius: 8, fontSize: "0.82rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
                <span style={{ color: "var(--muted)" }}>邮箱</span> <strong>{userInfo.email}</strong>
                <span style={{ color: "var(--muted)" }}>用户名</span> <strong>{userInfo.username || "—"}</strong>
                <span style={{ color: "var(--muted)" }}>套餐</span>
                  <strong style={{ color: userInfo.tier === "premium" ? "#7c3aed" : userInfo.tier === "pro" ? "#3b82f6" : "var(--muted)" }}>
                    {userInfo.tier === "free" ? "免费版" : userInfo.tier === "pro" ? "Pro" : "Premium"}
                  </strong>
                <span style={{ color: "var(--muted)" }}>过期时间</span> <span>{userInfo.tierExpiresAt ? new Date(userInfo.tierExpiresAt).toLocaleDateString("zh-CN") : "—"}</span>
                <span style={{ color: "var(--muted)" }}>邮箱验证</span> <span>{userInfo.verified ? "✅ 已验证" : "❌ 未验证"}</span>
                <span style={{ color: "var(--muted)" }}>注册时间</span> <span>{userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleDateString("zh-CN") : "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* 快捷操作 */}
        <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.95rem", margin: "0 0 12px", fontWeight: 600 }}>⚡ 快捷操作</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a href="/admin/messages" style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              💬 客服工单 {data && data.pendingPayments > 0 ? `(${data.pendingPayments} 未处理)` : ""}
            </a>
            <a href="/changelog" style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              📋 发布更新日志
            </a>
          </div>
          {actionMsg && <div style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--success)" }}>{actionMsg}</div>}
        </div>
      </div>
    </div>
  );
}
