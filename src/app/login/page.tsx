"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirect");
    if (r) setRedirectTo(r);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!login.trim()) {
      setError("请输入邮箱或用户名");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      router.push(redirectTo);
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>登录</h1>
      <p style={{ color: "var(--accent)", marginBottom: 24, fontSize: "0.9rem" }}>
        登录后可使用已充值的 Token
      </p>

      {error && (
        <p
          style={{
            color: "var(--danger)",
            background: "var(--danger-glow)",
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
          <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--accent)" }}>
            邮箱 / 用户名
          </label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="your@email.com 或用户名"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "inherit",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--accent)" }}>
            密码
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
              border: "1px solid var(--border)",
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
          {loading ? "登录中…" : "登录"}
        </button>

        <a
          href="/forgot-password"
          style={{
            textAlign: "center",
            color: "var(--accent)",
            fontSize: "0.83rem",
            textDecoration: "none",
            marginTop: 4,
          }}
        >
          忘记密码？
        </a>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.85rem", color: "var(--accent)" }}>
        还没有账号？{" "}
        <a href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
          注册
        </a>
      </p>
      <p style={{ textAlign: "center", marginTop: 12, fontSize: "0.75rem", color: "var(--accent)" }}>
        <a href="/privacy" style={{ color: "var(--accent)", textDecoration: "none" }}>隐私</a>
        <span style={{ margin: "0 8px" }}>·</span>
        <a href="/terms" style={{ color: "var(--accent)", textDecoration: "none" }}>条款</a>
      </p>
    </div>
  );
}
