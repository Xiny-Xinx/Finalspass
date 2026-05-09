"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("缺少重置参数");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "重置失败");
        return;
      }
      setDone(true);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>密码已重置</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>请使用新密码重新登录。</p>
        <a
          href="/login"
          style={{
            display: "block",
            textAlign: "center",
            padding: "10px 0",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          去登录
        </a>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>无效链接</h1>
        <p style={{ color: "var(--muted)" }}>密码重置链接无效，请重新申请。</p>
        <a href="/forgot-password" style={{ color: "var(--accent)", textDecoration: "none" }}>
          重新申请
        </a>
      </div>
    );
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>设置新密码</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        输入你的新密码。
      </p>

      {error && (
        <p
          style={{
            color: "var(--accent)",
            background: "rgba(255,0,0,0.06)",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: 16,
          }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--muted)" }}>
            新密码（至少 6 位）
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
          {loading ? "重置中…" : "重置密码"}
        </button>
      </form>
    </div>
  );
}
