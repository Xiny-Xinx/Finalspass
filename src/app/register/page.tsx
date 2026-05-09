"use client";

import { FormEvent, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 发送验证码
  async function sendCode() {
    if (!email.includes("@")) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "发送失败");
        setLoading(false);
        return;
      }
      setStep("code");
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
      // 聚焦第一个 code 输入框
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  // 处理验证码输入
  function handleCodeChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return; // 只允许数字
    const newCode = [...code];
    newCode[i] = val.slice(-1);
    setCode(newCode);
    setError(null);

    // 自动跳到下一个输入框
    if (val && i < 5) {
      codeRefs.current[i + 1]?.focus();
    }
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  }

  // 提交注册
  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    const codeStr = code.join("");
    if (codeStr.length !== 6) {
      setError("请输入完整的 6 位验证码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        setLoading(false);
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
        maxWidth: 420,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>注册 FinalsPass</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        {step === "email" ? "输入邮箱，获取验证码" : "输入验证码，完成注册"}
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

      {/* 步骤指示器 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          1
        </span>
        <span style={{ fontSize: "0.8rem", color: step === "email" ? "var(--ink)" : "var(--muted)", fontWeight: step === "email" ? 600 : 400 }}>
          验证邮箱
        </span>
        <span style={{ color: "var(--border)", margin: "0 4px" }}>→</span>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: step === "code" ? "var(--accent)" : "var(--border)",
            color: step === "code" ? "#fff" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          2
        </span>
        <span style={{ fontSize: "0.8rem", color: step === "code" ? "var(--ink)" : "var(--muted)", fontWeight: step === "code" ? 600 : 400 }}>
          设置密码
        </span>
      </div>

      {step === "email" ? (
        /* 第一步：输入邮箱 */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--muted)" }}>
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
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
            onClick={sendCode}
            disabled={loading || !email.includes("@")}
            style={{
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "1rem",
              cursor: loading || !email.includes("@") ? "not-allowed" : "pointer",
              opacity: loading || !email.includes("@") ? 0.6 : 1,
            }}
          >
            {loading ? "发送中…" : "发送验证码"}
          </button>
        </div>
      ) : (
        /* 第二步：输入验证码 + 密码 */
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--muted)" }}>
              验证码已发送至 <strong>{email}</strong>
            </p>

            {/* 6 位验证码输入 */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  style={{
                    width: 44,
                    height: 52,
                    textAlign: "center",
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    borderRadius: 8,
                    border: `2px solid ${digit ? "var(--accent)" : "var(--border)"}`,
                    background: "transparent",
                    color: "inherit",
                    outline: "none",
                  }}
                />
              ))}
            </div>

            {/* 重新发送 */}
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 16px" }}>
              {countdown > 0 ? (
                `${countdown} 秒后可重新发送`
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    textDecoration: "underline",
                  }}
                >
                  重新发送验证码
                </button>
              )}
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "var(--muted)" }}>
              设置密码（至少 6 位）
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

          {/* 同意条款 */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              required
              style={{ accentColor: "var(--accent)", cursor: "pointer" }}
            />
            我已阅读并同意{" "}
            <a href="/terms" target="_blank" style={{ color: "var(--accent)", textDecoration: "none" }}>用户协议</a>
            和{" "}
            <a href="/privacy" target="_blank" style={{ color: "var(--accent)", textDecoration: "none" }}>隐私政策</a>
          </label>

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
              marginTop: 4,
            }}
          >
            {loading ? "注册中…" : "完成注册"}
          </button>
        </form>
      )}

      <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.85rem", color: "var(--muted)" }}>
        已有账号？{" "}
        <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>
          登录
        </a>
      </p>
      <p style={{ textAlign: "center", marginTop: 12, fontSize: "0.75rem", color: "var(--muted)" }}>
        <a href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>隐私</a>
        <span style={{ margin: "0 8px" }}>·</span>
        <a href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>条款</a>
      </p>
    </div>
  );
}
