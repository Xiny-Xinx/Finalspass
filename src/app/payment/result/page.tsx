"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type Status = "loading" | "success" | "failed" | "not_found";

interface OrderInfo {
  outTradeNo: string;
  type: "recharge" | "subscription";
  status: string;
  amount: number;
  tokens?: number;
  tier?: string;
  paidAt?: string;
}

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [countdown, setCountdown] = useState(5);

  const outTradeNo = searchParams.get("out_trade_no");

  const checkOrder = useCallback(async () => {
    if (!outTradeNo) {
      setStatus("not_found");
      return;
    }
    try {
      const res = await fetch(`/api/order/status?out_trade_no=${outTradeNo}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus("not_found");
        return;
      }
      setOrder(data);
      if (data.status === "success") {
        setStatus("success");
      } else if (data.status === "failed") {
        setStatus("failed");
      } else {
        // pending — 异步通知可能有延迟，继续等待
        setTimeout(checkOrder, 2000);
      }
    } catch {
      setStatus("not_found");
    }
  }, [outTradeNo]);

  useEffect(() => {
    checkOrder();
  }, [checkOrder]);

  // 倒计时跳转
  useEffect(() => {
    if (status === "success" || status === "failed") {
      if (countdown > 0) {
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
      }
    }
  }, [status, countdown]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <div>
            <div
              style={{
                width: 48,
                height: 48,
                border: "3px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 8px" }}>
              支付处理中
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--muted)",
                margin: 0,
              }}
            >
              正在确认您的支付结果，请稍候…
            </p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(0,200,80,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "2rem",
                color: "#00b84d",
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 8px" }}>
              支付成功！
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--muted)",
                margin: "0 0 4px",
              }}
            >
              {order?.type === "recharge"
                ? `已充值 ${order?.tokens?.toLocaleString()} tokens`
                : `已升级到 ${order?.tier === "pro" ? "Pro" : "Premium"} 套餐`}
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                fontFamily: "monospace",
                margin: "0 0 24px",
              }}
            >
              支付金额：A${order?.amount?.toFixed(2)}
            </p>
            <button
              onClick={() => router.push("/account")}
              style={{
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              返回账户中心 {countdown > 0 ? `(${countdown}s)` : ""}
            </button>
          </div>
        )}

        {(status === "failed" || status === "not_found") && (
          <div>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--danger-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "2rem",
                color: "var(--danger)",
              }}
            >
              ✕
            </div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 8px" }}>
              支付未完成
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--muted)",
                margin: "0 0 24px",
              }}
            >
              {status === "not_found"
                ? "未找到订单信息"
                : "您的支付未能成功完成，如有问题请联系客服。"}
            </p>
            <button
              onClick={() => router.push("/account")}
              style={{
                background: "var(--paper2)",
                color: "var(--ink)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                marginRight: 10,
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              返回重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
            }}
          />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
