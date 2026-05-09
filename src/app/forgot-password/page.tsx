"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "请求失败");
        return;
      }
      setSent(true);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>忘记密码</h1>

      {sent ? (
        <div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            如果该邮箱已注册，你将收到一封密码重置邮件。
            请检查收件箱（包括垃圾邮件），点击邮件中的链接重置密码。
          </p>
          <a
            href="/login"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 24,
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            返回登录
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "var(--muted)", marginBottom: 8, fontSize: "0.9rem" }}>
            输入注册时使用的邮箱，我们将发送密码重置链接。
          </p>

          {error && (
            <p style={{
              color: "var(--accent)",
              background: "rgba(255,0,0,0.06)",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: "0.85rem",
              margin: 0,
            }}>
              {error}
            </p>
          )}

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--muted)" }}>
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1.5px solid var(--border)",
                background: "transparent",
                color: "inherit",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginTop: 8,
            }}
          >
            {loading ? "发送中…" : "发送重置链接"}
          </button>

          <a
            href="/login"
            style={{
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            返回登录
          </a>
        </form>
      )}
    </div>
  );
}
