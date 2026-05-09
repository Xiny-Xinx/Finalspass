"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      router.push("/");
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>注册</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        创建账号，充值 Token 后可无限制使用
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

        <div>
          <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--muted)" }}>
            密码（至少 6 位）
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
          {loading ? "注册中…" : "注册"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.85rem", color: "var(--muted)" }}>
        已有账号？{" "}
        <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>
          登录
        </a>
      </p>
    </div>
  );
}
