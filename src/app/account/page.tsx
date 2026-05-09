"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  id: string;
  email: string;
  createdAt: string;
  balance: number;
  totalPurchased: number;
  verified: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState(50000);
  const [recharging, setRecharging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleRecharge() {
    setRecharging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: rechargeAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, balance: data.balance, totalPurchased: prev.totalPurchased + rechargeAmount } : prev);
        setMessage(`充值成功！当前余额 ${data.balance.toLocaleString()} tokens`);
      } else {
        setMessage(`失败：${data.error}`);
      }
    } catch {
      setMessage("网络错误");
    } finally {
      setRecharging(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "var(--muted)" }}>加载中…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>账户</h1>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            color: "var(--muted)",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          退出登录
        </button>
      </div>

      {/* 用户信息卡片 */}
      <div
        style={{
          background: "rgba(128,128,128,0.04)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          border: "1px solid var(--border)",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "var(--muted)" }}>邮箱</p>
        <p style={{ margin: "0 0 16px", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          {user.email}
          <span
            style={{
              fontSize: "0.7rem",
              padding: "2px 8px",
              borderRadius: 10,
              background: user.verified ? "rgba(0,200,80,0.12)" : "rgba(255,170,0,0.15)",
              color: user.verified ? "#00b84d" : "#e68a00",
              fontWeight: 500,
            }}
          >
            {user.verified ? "已验证" : "未验证"}
          </span>
        </p>

        <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "var(--muted)" }}>Token 余额</p>
        <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700 }}>
          {user.balance.toLocaleString()}
        </p>

        <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
          累计充值：{user.totalPurchased.toLocaleString()} tokens
        </p>
      </div>

      {/* 未验证提示 */}
      {!user.verified && (
        <div
          style={{
            background: "rgba(255,170,0,0.06)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: "1px solid rgba(255,170,0,0.2)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 600 }}>
            邮箱未验证
          </p>
          <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--muted)" }}>
            请检查收件箱（包括垃圾邮件），点击验证链接完成验证。
          </p>
          <button
            onClick={async () => {
              const res = await fetch("/api/auth/resend-verification", { method: "POST" });
              const data = await res.json();
              setMessage(data.message || data.error || "已发送");
            }}
            style={{
              background: "none",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              padding: "8px 16px",
              color: "inherit",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            重新发送验证邮件
          </button>
        </div>
      )}

      {/* 充值区域 */}
      <div
        style={{
          background: "rgba(128,128,128,0.04)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          border: "1px solid var(--border)",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px" }}>充值</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[10000, 50000, 100000, 500000].map((amount) => (
            <button
              key={amount}
              onClick={() => setRechargeAmount(amount)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1.5px solid ${rechargeAmount === amount ? "var(--accent)" : "var(--border)"}`,
                background: rechargeAmount === amount ? "rgba(0,120,255,0.08)" : "transparent",
                color: rechargeAmount === amount ? "var(--accent)" : "inherit",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: rechargeAmount === amount ? 600 : 400,
              }}
            >
              {(amount / 10000).toFixed(0)} 万
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)", whiteSpace: "nowrap" }}>自定义：</span>
          <input
            type="number"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(Math.max(1, Number(e.target.value) || 0))}
            min={1}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "transparent",
              color: "inherit",
              fontSize: "0.9rem",
            }}
          />
        </div>

        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            margin: "0 0 16px",
            fontStyle: "italic",
          }}
        >
          * 当前为模拟充值模式，后期将接入 Stripe/Lemon Squeezy 支付
        </p>

        {message && (
          <p
            style={{
              fontSize: "0.85rem",
              padding: "8px 12px",
              borderRadius: 8,
              background: message.includes("成功") ? "rgba(0,200,80,0.1)" : "rgba(255,0,0,0.06)",
              color: message.includes("成功") ? "var(--success, #00b84d)" : "var(--accent)",
              margin: "0 0 16px",
            }}
          >
            {message}
          </p>
        )}

        <button
          onClick={handleRecharge}
          disabled={recharging}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: "1rem",
            cursor: recharging ? "not-allowed" : "pointer",
            opacity: recharging ? 0.6 : 1,
          }}
        >
          {recharging ? "充值中…" : `充值 ${(rechargeAmount / 10000).toFixed(0)} 万 Tokens`}
        </button>
      </div>

      <a
        href="/"
        style={{
          display: "block",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: "0.85rem",
          textDecoration: "none",
        }}
      >
        ← 返回首页
      </a>
    </div>
  );
}
