"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIER_PRICES, TIER_LIMITS, EXTRA_QUOTA_PACKS } from "@/lib/constants";
import { TIER_MODELS, type ModelId } from "@/lib/claude";

interface UserInfo {
  id: string;
  email: string;
  createdAt: string;
  verified: boolean;
  tier: string;
  tierExpiresAt: string | null;
}

interface QuotaInfo {
  dailyCap: number;
  dailyUsed: number;
  extraQuota?: number;
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
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [stats, setStats] = useState<{ sessions: number; cards: number; flashcards: number } | null>(null);
  const [qrModal, setQrModal] = useState<{ label: string; amount: number; qrUrl: string; message: string } | null>(null);

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
            extraQuota: quotaData.extraQuota ?? 0,
          });
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // 加载使用统计
    fetch("/api/user/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, [router]);

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
      if (res.ok && data.qrPayment) {
        setQrModal({ label: data.label, amount: data.amount, qrUrl: data.qrUrl, message: data.message });
      } else {
        setMessage(`失败：${data.error}`);
      }
    } catch {
      setMessage("网络错误");
    }
    setSubscribing(null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function handleCancelClick() {
    setShowCancelConfirm(true);
  }

  async function handleCancelConfirm() {
    setShowCancelConfirm(false);
    setCancelling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage("已取消自动续费，当前套餐权益保留至到期日");
        // 刷新用户信息
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();
        if (authData.user) setUser(authData.user);
      } else {
        setMessage(`取消失败：${data.error}`);
      }
    } catch {
      setMessage("网络错误");
    } finally {
      setCancelling(false);
    }
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
          {currentTier !== "free" && (
            <button
              onClick={handleCancelClick}
              disabled={cancelling}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "1px solid var(--danger)",
                borderRadius: 8,
                padding: "4px 10px",
                color: "var(--danger)",
                cursor: cancelling ? "not-allowed" : "pointer",
                fontSize: "0.7rem",
                opacity: cancelling ? 0.6 : 1,
              }}
            >
              {cancelling ? "取消中…" : "取消订阅"}
            </button>
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
            <span>{dailyUsed} / {dailyCap} 次{quota?.extraQuota ? ` +${quota.extraQuota}` : ""}</span>
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

      {/* 使用统计 */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "14px 16px" }}>
          {[
            ["📄", "课件", stats.sessions],
            ["📇", "卡片", stats.cards],
            ["🃏", "闪卡", stats.flashcards],
          ].map(([icon, label, count]) => (
            <div key={label as string} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", fontFamily: "monospace" }}>{count}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>{icon} {label as string}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 额外配额 ── */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-subtle), rgba(99,102,241,0.04))",
        border: "1px solid var(--accent)", borderRadius: 12, padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: "1.1rem" }}>⚡</span>
          <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 600 }}>额外配额</h3>
          {quota?.extraQuota ? (
            <span style={{ marginLeft: "auto", fontSize: "0.82rem", fontFamily: "monospace", color: "var(--success)", fontWeight: 600 }}>
              剩余 {quota.extraQuota} 次
            </span>
          ) : null}
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 14px" }}>
          每日额度用完后自动扣减，不限时间，永不过期
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {EXTRA_QUOTA_PACKS.map((pack) => {
            const loading = subscribing === `extra_${pack.units}`;
            return (
            <button
              key={pack.units}
              onClick={async () => {
                setSubscribing(`extra_${pack.units}`);
                setMessage(null);
                try {
                  const res = await fetch("/api/user/extra-quota", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ units: pack.units }),
                  });
                  const data = await res.json();
                  if (res.ok && data.qrPayment) {
                    setQrModal({ label: data.label, amount: data.amount, qrUrl: data.qrUrl, message: data.message });
                  } else setMessage(`失败：${data.error}`);
                } catch { setMessage("网络错误"); }
                setSubscribing(null);
              }}
              disabled={loading}
              style={{
                flex: 1, minWidth: 130, position: "relative", overflow: "hidden",
                background: loading ? "var(--border)" : "var(--card)",
                border: `2px solid ${loading ? "var(--border)" : "var(--card-border)"}`,
                borderRadius: 12, padding: "14px 12px 12px", cursor: loading ? "not-allowed" : "pointer",
                textAlign: "center", transition: "all .2s", opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
              onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.borderColor = "var(--card-border)"; e.currentTarget.style.transform = "translateY(0)"; }}}
            >
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>+{pack.units}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 4 }}>{pack.label.split("（最值")[0]}</div>
              <div style={{
                display: "inline-block", background: "var(--accent)", color: "white",
                borderRadius: 8, padding: "3px 14px", fontSize: "0.85rem", fontWeight: 700,
              }}>
                A${pack.priceAUD.toFixed(2)}
              </div>
            </button>
          );})}
        </div>
      </div>

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
          dailyLimit="30次/天"
          models="V4 Flash + V3"
          restricted={restrictedLabels}
          subscribed={currentTier === "free"}
          color={TIER_COLOR.free}
          onSubscribe={null}
        />

        {/* Pro */}
        <PlanCard
          name="Pro"
          price="A$8.99"
          priceLabel="/月"
          dailyLimit="150次/天"
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
          price="A$18.49"
          priceLabel="/月"
          dailyLimit="500次/天"
          models="全部模型"
          restricted={[]}
          subscribed={currentTier === "premium"}
          color={TIER_COLOR.premium}
          onSubscribe={() => handleSubscribe("premium")}
          loading={subscribing === "premium"}
          popular
        />
      </div>


      {/* ── 取消订阅二次确认弹窗 ── */}
      {showCancelConfirm && (
        <div
          onClick={() => setShowCancelConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn .12s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--paper)",
              borderRadius: 16,
              padding: 28,
              maxWidth: 380,
              width: "calc(100% - 32px)",
              boxShadow: "0 16px 48px rgba(0,0,0,.2)",
              animation: "fadeUp .2s ease",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--danger-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                marginBottom: 16,
                color: "var(--danger)",
              }}
            >
              ⚠
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 8px" }}>
              确认取消自动续费？
            </h3>
            <p style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.7, margin: "0 0 20px" }}>
              取消后下个月将不再自动扣费，但您可以在当前套餐到期前继续使用全部 Pro / Premium 权益，到期后将自动转为免费版。
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: "0.84rem",
                  color: "var(--muted)",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                再想想
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelling}
                style={{
                  background: "var(--danger)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: cancelling ? "not-allowed" : "pointer",
                  opacity: cancelling ? 0.6 : 1,
                  transition: "opacity .15s",
                }}
                onMouseEnter={(e) => { if (!cancelling) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = cancelling ? "0.6" : "1"; }}
              >
                {cancelling ? "处理中…" : "确认取消"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 支付宝收款码弹窗 ── */}
      {qrModal && (
        <div
          onClick={() => setQrModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn .12s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--paper)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: "calc(100% - 32px)",
              boxShadow: "0 16px 48px rgba(0,0,0,.2)",
              animation: "fadeUp .2s ease",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, #1677ff, #0958d9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                margin: "0 auto 16px",
                color: "white",
              }}
            >
              💳
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>
              支付宝扫码支付
            </h3>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 4 }}>
              {qrModal.label}
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent)", marginBottom: 20 }}>
              ¥{qrModal.amount.toFixed(2)}
            </div>

            {/* 收款码图片 */}
            <div
              style={{
                width: 240,
                height: 240,
                margin: "0 auto 20px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
              }}
            >
              <img
                src={qrModal.qrUrl}
                alt="支付宝收款码"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.parentElement!.querySelector(".fallback") as HTMLElement).style.display = "flex";
                }}
              />
              <div className="fallback" style={{ display: "none", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: "0.78rem" }}>
                <span>⚠️ 收款码加载失败</span>
                <span>请检查 ALIPAY_QR_URL 配置</span>
              </div>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.7, margin: "0 0 20px", textAlign: "left" }}>
              {qrModal.message}
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <a
                href="/"
                style={{
                  background: "var(--accent)",
                  color: "white",
                  textDecoration: "none",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity .15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                💬 联系客服
              </a>
              <button
                onClick={() => setQrModal(null)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
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

      <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 2, color: "var(--ink)" }}>{name}</div>
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
