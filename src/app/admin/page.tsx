"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardData {
  totalUsers: number; proUsers: number; premiumUsers: number;
  freeUsers: number; todayApiCalls: number; dateKey: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [userResult, setUserResult] = useState<any>(null);
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
    setSearching(true); setUserResult(null); setActionMsg("");
    try {
      const res = await fetch("/api/admin/grant-pro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: searchEmail.trim(), days: 0 }),
      });
      const d = await res.json();
      if (d.error === "请输入邮箱" || d.success) {
        // 用户存在，用 grant-pro 的查询方式找用户
        const redisUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? "" : "";
        const r2 = await fetch("/api/admin/dashboard");
        setUserResult({ email: searchEmail.trim(), msg: "需要手动查Redis" });
      }
      // 简单方式：直接调一个查询API
      setUserResult({ email: searchEmail.trim(), found: d.error !== "该邮箱未注册" && d.error !== "请输入邮箱" });
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              ["👥", "总用户", data.totalUsers, "var(--accent)"],
              ["🆓", "免费版", data.freeUsers, "var(--muted)"],
              ["🚀", "Pro", data.proUsers, "#3b82f6"],
              ["💎", "Premium", data.premiumUsers, "#7c3aed"],
              ["📊", "今日调用", data.todayApiCalls, "#16a34a"],
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
          {userResult && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: userResult.found ? "rgba(0,200,80,0.06)" : "var(--danger-glow)", borderRadius: 8, fontSize: "0.82rem", color: userResult.found ? "var(--success)" : "var(--danger)" }}>
              {userResult.found ? `✅ ${userResult.email} - 用户存在` : `❌ ${searchEmail} - 未找到该邮箱`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
