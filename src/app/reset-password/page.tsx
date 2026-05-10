"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function sendCode() {
    if (!email.includes("@")) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setStep("code");
      else { const d = await res.json(); setErr(d.error || "发送失败"); }
    } catch { setErr("网络错误"); }
    setLoading(false);
  }

  function handleCode(i: number, val: string) {
    if (val.length > 1) return;
    const next = [...code]; next[i] = val; setCode(next);
    if (val && i < 5) {
      document.querySelector<HTMLInputElement>(`[data-ci="${i+1}"]`)?.focus();
    }
    if (next.every((d) => d)) verifyCode(next.join(""));
  }

  async function verifyCode(full: string) {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: full }),
      });
      if (res.ok) setStep("password");
      else { const d = await res.json(); setErr(d.error || "验证失败"); }
    } catch { setErr("网络错误"); }
    setLoading(false);
  }

  async function resetPw(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setErr("密码至少6位"); return; }
    if (password !== confirm) { setErr("两次密码不一致"); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join(""), newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) router.push("/login?reset=1");
      else setErr(data.error || "重置失败");
    } catch { setErr("网络错误"); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px", fontFamily: "'Noto Serif SC', serif", color: "var(--accent)" }}>FinalsPass</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
            {step === "email" ? "输入邮箱获取验证码" : step === "code" ? "输入6位验证码" : "设置新密码"}
          </p>
        </div>
        {err && <div style={{ fontSize: "0.82rem", color: "var(--danger)", textAlign: "center", marginBottom: 16, padding: "8px 12px", background: "var(--danger-glow)", borderRadius: 8 }}>{err}</div>}
        {step === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入注册邮箱" type="email" style={inputS} />
            <button onClick={sendCode} disabled={loading || !email.includes("@")} style={btnS(loading || !email.includes("@"))}>{loading ? "发送中…" : "发送验证码"}</button>
            <button onClick={() => router.push("/login")} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: "0.84rem", color: "var(--muted)", cursor: "pointer" }}>返回登录</button>
          </div>
        )}
        {step === "code" && (
          <div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              {code.map((d, i) => (
                <input key={i} data-ci={i} value={d} onChange={(e) => handleCode(i, e.target.value)} maxLength={1}
                  style={{ width: 44, height: 48, textAlign: "center", fontSize: "1.2rem", fontWeight: 700, borderRadius: 10, border: "2px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", outline: "none" }} />
              ))}
            </div>
            <button onClick={sendCode} disabled={loading} style={{ width: "100%", background: "none", border: "none", fontSize: "0.78rem", color: "var(--accent)", cursor: "pointer", padding: 4 }}>重新发送</button>
          </div>
        )}
        {step === "password" && (
          <form onSubmit={resetPw} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密码（至少6位）" minLength={6} style={inputS} />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="确认新密码" style={inputS} />
            <button type="submit" disabled={loading || password.length < 6 || password !== confirm} style={btnS(loading || password.length < 6 || password !== confirm)}>{loading ? "重置中…" : "重置密码"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
const inputS: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--ink)", fontSize: "0.9rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
function btnS(dis: boolean): React.CSSProperties { return { width: "100%", padding: "11px", borderRadius: 10, border: "none", background: dis ? "var(--border)" : "var(--accent)", color: dis ? "var(--muted)" : "white", fontSize: "0.9rem", fontWeight: 600, cursor: dis ? "not-allowed" : "pointer" }; }
