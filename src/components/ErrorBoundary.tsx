"use client";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper)",
            color: "var(--ink)",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
            <h2
              style={{
                fontFamily: "'Noto Serif SC', Georgia, serif",
                fontSize: "1.2rem",
                marginBottom: 12,
              }}
            >
              页面出了点问题
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.84rem",
                lineHeight: 1.7,
                marginBottom: 20,
              }}
            >
              {this.state.error?.message || "发生了未知错误"}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                padding: "10px 28px",
                borderRadius: "var(--radius-md)",
                fontSize: "0.84rem",
                cursor: "pointer",
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
