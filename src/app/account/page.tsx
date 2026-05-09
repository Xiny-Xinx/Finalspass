"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIER_PRICES, TIER_LIMITS, TOP_UP_PACKAGES, TOP_UP_RATE } from "@/lib/constants";
import { TIER_MODELS, type ModelId } from "@/lib/claude";

interface UserInfo {
  id: string;
  email: string;
  createdAt: string;
  balance: number;
  totalPurchased: number;
  verified: boolean;
  tier: string;
  tierExpiresAt: string | null;
}

interface QuotaInfo {
  dailyCap: number;
  dailyUsed: number;
}

const TIER_LABEL: Record<string, string> = {
  free: "免费版",
  pro: "Pro",
  premium: "Premium",
};

const TIER_COLOR: Record<string, string> = {
  free: "var(--muted)",
  pro: "var(--accent)",
  premium: "#a855f7",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [recharging, setRecharging] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/quota").then((r) => r.json()),
    ])
      .then(([authData, quotaData]) => {
        if (authData.user) {
          setUser(authData.user);
          setQuota({
            dailyCap: quotaData.dailyCap ?? 30000,
            dailyUsed: quotaData.dailyUsed ?? 0,
          });
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleRecharge(tokens: number) {
    setRecharging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        // 跳转到支付宝支付
        window.location.href = data.redirectUrl;
      } else {
        setMessage(`失败：${data.error}`);
        setRecharging(false);
      }
    } catch {
      setMessage("网络错误");
      setRecharging(false);
    }
  }

  async function handleSubscribe(tier: "pro" | "premium") {
    setSubscribing(tier);
    setMessage(null);
    try {
      const res = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        // 跳转到支付宝支付
        window.location.href = data.redirectUrl;
      } else {
        setMessage(`失败：${data.error}`);
        setSubscribing(null);
      }
    } catch {
      setMessage("网络错误");
      setSubscribing(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 20px" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>加载中…</p>
      </div>
    );
  }

  if (!user) return null;

  const currentTier = user.tier ?? "free";
  const dailyCap = quota?.dailyCap ?? TIER_LIMITS[currentTier] ?? 30000;
  const dailyUsed = quota?.dailyUsed ?? 0;
  const dailyPct = Math.min(100, Math.round((dailyUsed / dailyCap) * 100));
  const allowModels = TIER_MODELS[currentTier] ?? [];
  const restrictedModels = Object.values(TIER_MODELS).flat().filter((m) => !allowModels.includes(m));
  const restrictedLabels = Array.from(new Set(restrictedModels.map((m) => {
    const found = MODELS_LOOKUP[m];
    return found ? found.label : m;
  })));

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "40px auto",
        padding: "0 20px 60px",
      }}
    >
      {/* 顶栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <h1 style={{ fontSize: "1.4rem", margin: 0, fontWeight: 700 }}>账户中心</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/"
            style={{
              fontSize: "0.8rem",
              color: "var(--muted)",
              textDecoration: "none",
              padding: "6px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            ← 首页
          </a>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 14px",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            退出登录
          </button>
        </div>
      </div>

      {/* ── 当前状态卡片 ── */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 2 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: TIER_COLOR[currentTier],
                }}
              >
                {TIER_LABEL[currentTier] ?? currentTier}
              </span>
              {user.verified ? (
                <span style={{ fontSize: "0.65rem", color: "#00b84d" }}>✓ 已验证</span>
              ) : (
                <span style={{ fontSize: "0.65rem", color: "#e68a00" }}>未验证</span>
              )}
            </div>
          </div>
          {user.tierExpiresAt && (
            <div
              style={{
                marginLeft: "auto",
                fontSize: "0.7rem",
                color: "var(--muted)",
                textAlign: "right",
              }}
            >
              到期<br />{formatDate(user.tierExpiresAt)}
            </div>
          )}
        </div>

        {/* 每日用量进度条 */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--muted)",
              fontFamily: "monospace",
              marginBottom: 4,
            }}
          >
            <span>今日用量</span>
            <span>{(dailyUsed / 1000).toFixed(0)}K / {(dailyCap / 1000).toFixed(0)}K</span>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${dailyPct}%`,
                height: "100%",
                background: dailyPct > 80 ? "var(--accent)" : "var(--success)",
                borderRadius: 3,
                transition: "width .3s",
              }}
            />
          </div>
        </div>

        {/* Token 余额 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "monospace" }}>
              Token 余额
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {user.balance.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "monospace" }}>
              累计充值
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600 }}>
              {user.totalPurchased.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── 消息提示 ── */}
      {message && (
        <div
          style={{
            fontSize: "0.85rem",
            padding: "10px 14px",
            borderRadius: 8,
            background: message.includes("失败") ? "var(--danger-glow)" : "rgba(0,200,80,0.08)",
            color: message.includes("失败") ? "var(--danger)" : "#00b84d",
            marginBottom: 24,
            border: `1px solid ${message.includes("失败") ? "var(--danger)" : "rgba(0,200,80,0.2)"}`,
          }}
        >
          {message}
        </div>
      )}

      {/* ── 套餐选择 ── */}
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 16px", fontWeight: 600 }}>选择套餐</h2>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        {/* 免费版 */}
        <PlanCard
          name="免费版"
          price="$0"
          priceLabel="永久免费"
          dailyLimit="30K tokens/天"
          models="V4 Flash + V3"
          restricted={restrictedLabels}
          subscribed={currentTier === "free"}
          color={TIER_COLOR.free}
          onSubscribe={null}
        />

        {/* Pro */}
        <PlanCard
          name="Pro"
          price="$5"
          priceLabel="/月"
          dailyLimit="300K tokens/天"
          models="全部模型"
          restricted={[]}
          subscribed={currentTier === "pro"}
          color={TIER_COLOR.pro}
          onSubscribe={() => handleSubscribe("pro")}
          loading={subscribing === "pro"}
        />

        {/* Premium */}
        <PlanCard
          name="Premium"
          price="$12"
          priceLabel="/月"
          dailyLimit="1M tokens/天"
          models="全部模型"
          restricted={[]}
          subscribed={currentTier === "premium"}
          color={TIER_COLOR.premium}
          onSubscribe={() => handleSubscribe("premium")}
          loading={subscribing === "premium"}
          popular
        />
      </div>

      {/* ── 充值 ── */}
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 16px", fontWeight: 600 }}>按量充值</h2>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            margin: "0 0 16px",
          }}
        >
          充值后 tokens 永久有效，不会按月清零。约 ${TOP_UP_RATE}/百万 tokens。
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {TOP_UP_PACKAGES.map((pkg) => (
            <button
              key={pkg.tokens}
              onClick={() => handleRecharge(pkg.tokens)}
              disabled={recharging}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "14px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--paper2)",
                cursor: recharging ? "not-allowed" : "pointer",
                textAlign: "center",
                transition: "border-color .15s",
              }}
              onMouseEnter={(e) => { if (!recharging) e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>${pkg.price}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                {pkg.label} tokens
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 套餐卡片组件 ──

interface PlanCardProps {
  name: string;
  price: string;
  priceLabel: string;
  dailyLimit: string;
  models: string;
  restricted: string[];
  subscribed: boolean;
  color: string;
  onSubscribe: (() => void) | null;
  loading?: boolean;
  popular?: boolean;
}

function PlanCard({
  name,
  price,
  priceLabel,
  dailyLimit,
  models,
  restricted,
  subscribed,
  color,
  onSubscribe,
  loading,
  popular,
}: PlanCardProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 150,
        background: "var(--card)",
        border: subscribed
          ? `2px solid ${color}`
          : popular
          ? "2px solid var(--accent)"
          : "1px solid var(--card-border)",
        borderRadius: 12,
        padding: 16,
        position: "relative",
      }}
    >
      {popular && !subscribed && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: 12,
            fontSize: "0.6rem",
            fontFamily: "monospace",
            background: "var(--accent)",
            color: "white",
            padding: "1px 8px",
            borderRadius: 8,
          }}
        >
          推荐
        </div>
      )}

      <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 2 }}>{name}</div>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{price}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{priceLabel}</span>
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.8 }}>
        <div>📊 {dailyLimit}</div>
        <div>🤖 {models}</div>
        {restricted.length > 0 && (
          <div style={{ color: "var(--accent)", fontSize: "0.65rem" }}>
            ⚠️ 限用：{restricted.slice(0, 2).join("、")}
            {restricted.length > 2 ? ` 等${restricted.length}个` : ""}
          </div>
        )}
      </div>

      {onSubscribe && (
        <button
          type="button"
          onClick={onSubscribe}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            background: subscribed ? "color-mix(in srgb, var(--border) 60%, transparent)" : color,
            color: subscribed ? "var(--muted)" : "white",
            cursor: loading || subscribed ? "not-allowed" : "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
            transition: "opacity .2s",
          }}
        >
          {loading ? "处理中…" : subscribed ? "当前套餐" : `升级到 ${name}`}
        </button>
      )}
    </div>
  );
}

/** 用于根据 model id 查 label */
const MODELS_LOOKUP: Record<string, { label: string }> = {
  "deepseek-v4-flash": { label: "DeepSeek V4 Flash" },
  "deepseek-v4-pro": { label: "DeepSeek V4 Pro" },
  "deepseek-chat": { label: "DeepSeek V3" },
  "claude-sonnet-4-20250514": { label: "Claude Sonnet 4" },
};
