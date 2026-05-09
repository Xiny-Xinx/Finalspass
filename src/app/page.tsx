"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import UploadZone from "@/components/UploadZone";
import KnowledgeCards from "@/components/KnowledgeCards";
import DetailPanel from "@/components/DetailPanel";
import QATab from "@/components/QATab";
import QuizTab from "@/components/QuizTab";
import { extractFile } from "@/lib/parser";
import { extractCards, type Card } from "@/lib/api-client";
import { MAX_EXTRACT_CHARS, STORAGE_KEY, THEME_KEY } from "@/lib/constants";
import { saveSession } from "@/lib/store";

type Stage = "upload" | "processing" | "results";
type Tab = "cards" | "qa" | "quiz";

interface PersistedState {
  fileName: string;
  pptContent: string;
  cards: Card[];
}

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  enabled: boolean;
}

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ["cards", "📋 知识卡片"],
  ["qa", "💬 AI 问答"],
  ["quiz", "✏️ 练习测验"],
];

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (
      typeof data.fileName === "string" &&
      typeof data.pptContent === "string" &&
      Array.isArray(data.cards)
    ) {
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

function persist(state: PersistedState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (state === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // localStorage 满了或被禁用,静默忽略
  }
}

/** Process steps for skeleton display */
const PROCESS_STEPS = [
  "正在加载 PDF 解析器...",
  "正在解析 PPT 幻灯片...",
  "AI 正在提炼知识点...",
];

/** Skeleton loading for the processing state */
function ProcessingSkeleton({ message }: { message: string }) {
  const bars = [
    { label: "文件解析", width: "65%" },
    { label: "内容提取", width: "85%" },
    { label: "AI 分析", width: "45%" },
  ];
  const activeIdx = PROCESS_STEPS.findIndex((s) => message.startsWith(s.slice(0, 5)));
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
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
        <div>
          <div
            style={{
              fontFamily: "'Noto Serif SC', Georgia, serif",
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            正在处理
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.72rem",
              color: "var(--muted)",
            }}
          >
            {message}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {bars.map((bar, i) => {
          const active = i <= activeIdx;
          const done = i < activeIdx;
          return (
            <div key={bar.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "monospace",
                  fontSize: "0.65rem",
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                <span>{bar.label}</span>
                <span>{done ? "✓" : active ? "..." : ""}</span>
              </div>
              <div
                style={{
                  height: 4,
                  background: "var(--border)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {done ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "var(--success)",
                      borderRadius: 2,
                    }}
                  />
                ) : active ? (
                  <div
                    className="skeleton"
                    style={{ width: bar.width, height: "100%" }}
                  />
                ) : (
                  <div
                    style={{ width: 0, height: "100%", background: "var(--border)" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [processMsg, setProcessMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [pptContent, setPptContent] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [tab, setTab] = useState<Tab>("cards");
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const qaRef = useRef<{ focusInput: () => void } | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // 启动时尝试恢复上一次会话
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.cards.length > 0) {
      setFileName(persisted.fileName);
      setPptContent(persisted.pptContent);
      setCards(persisted.cards);
      setStage("results");
      setToast(`已恢复上次会话：${persisted.fileName}`);
      setTimeout(() => setToast(null), 3500);
    }
  }, []);

  // 初始化主题
  useEffect(() => {
    const el = document.documentElement;
    const cur = el.getAttribute("data-theme");
    setDark(cur === "dark");
  }, []);

  // 获取今日配额
  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json() as Promise<QuotaInfo>)
      .then((data) => {
        if (typeof data.remaining === "number") setQuota(data);
      })
      .catch(() => {});
  }, []);

  // 页面标题联动: 上传文件后显示文件名
  useEffect(() => {
    if (fileName) {
      document.title = `${fileName} · FinalsPass · AI 学习助手`;
    } else {
      document.title = "FinalsPass · AI 学习助手";
    }
  }, [fileName]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 不处理输入框内的快捷键
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") setTab("cards");
      else if (e.key === "2") setTab("qa");
      else if (e.key === "3") setTab("quiz");
      else if (e.key === "/" && stage === "results") {
        e.preventDefault();
        setTab("qa");
        setTimeout(() => qaRef.current?.focusInput(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage]);

  // 切换到 results 时自动保存历史
  useEffect(() => {
    if (stage === "results" && cards.length > 0) {
      try {
        saveSession({ fileName, pptContent, cards, qaHistory: [] });
      } catch {}
    }
  }, [stage, fileName, pptContent, cards]);

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
  }, [dark]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStage("processing");
    setProcessMsg("准备中...");
    setError(null);

    try {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "pdf") setProcessMsg("正在加载 PDF 解析器...");
      else if (ext === "pptx") setProcessMsg("正在解析 PPT 幻灯片...");

      const text = await extractFile(file, (cur, total) =>
        setProcessMsg(`正在解析第 ${cur} / ${total} 页...`)
      );
      const truncated = text.slice(0, MAX_EXTRACT_CHARS);

      setProcessMsg("AI 正在提炼知识点...");
      const data = await extractCards(text);

      setCards(data.cards);
      setPptContent(truncated);
      setTab("cards");
      setStage("results");
      persist({ fileName: file.name, pptContent: truncated, cards: data.cards });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "处理失败";
      setError(message);
      setStage("upload");
    }
  }, []);

  const reset = () => {
    setStage("upload");
    setCards([]);
    setPptContent("");
    setDetailCard(null);
    setFileName("");
    setError(null);
    persist(null);
  };

  return (
    <ErrorBoundary>
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      {/* ── 顶栏 ── */}
      <header
        style={{
          padding: "14px 24px",
          borderBottom: "2px solid var(--ink)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--paper)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          flexWrap: "wrap",
          transition: "background .3s ease",
        }}
      >
        <h1
          style={{
            fontFamily: "'Noto Serif SC', Georgia, serif",
            fontSize: "1.3rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          FinalsPass
        </h1>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "0.65rem",
            color: "var(--muted)",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          AI 考前冲刺
        </span>

        {/* 历史记录 */}
        <button
          type="button"
          onClick={() => router.push("/history")}
          title="历史记录"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "5px 10px",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--ink)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--muted)";
          }}
        >
          <span>📋</span>
          <span style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
            历史
          </span>
        </button>

        {/* 暗色模式切换 */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? "切换亮色模式" : "切换暗色模式"}
          title={dark ? "切换亮色模式" : "切换暗色模式"}
          style={{
            background: "none",
            border: "1.5px solid var(--border)",
            borderRadius: 20,
            padding: "5px 12px",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--ink)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--muted)";
          }}
        >
          <span>{dark ? "☀️" : "🌙"}</span>
          <span style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
            {dark ? "亮色" : "暗色"}
          </span>
        </button>

        {/* 配额显示 */}
        {quota && quota.enabled && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.65rem",
              color: quota.remaining <= 10000 ? "var(--accent)" : "var(--muted)",
              border: `1.5px solid ${quota.remaining <= 10000 ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 20,
              padding: "3px 10px",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            title={`已用 ${quota.used.toLocaleString()} tokens`}
          >
            剩余 {(quota.remaining / 1000).toFixed(0)}k/{(quota.limit / 1000).toFixed(0)}k
            {quota.remaining <= 10000 && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/quota/reset", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      setQuota({ ...quota, used: 0, remaining: quota.limit });
                      setToast("配额已重置");
                    }
                  } catch {
                    setToast("重置失败");
                  }
                }}
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: "0.6rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                重置
              </button>
            )}
          </span>
        )}

        {stage === "results" && (
          <button
            type="button"
            onClick={reset}
            style={{
              background: "none",
              border: "1.5px solid var(--border)",
              padding: "5px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.73rem",
              fontFamily: "monospace",
              cursor: "pointer",
              color: "var(--muted)",
              transition: "all .2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ink)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            重新上传
          </button>
        )}
      </header>

      {/* ── 主体 ── */}
      <main
        style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 60px" }}
      >
        {error && stage === "upload" && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              border: "1.5px solid var(--accent)",
              background: "color-mix(in srgb, var(--accent) 8%, var(--paper))",
              color: "var(--accent)",
              borderRadius: 6,
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>⚠️ 处理失败:{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="关闭"
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--accent)",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {stage === "upload" && <UploadZone onFile={handleFile} />}

        {stage === "processing" && <ProcessingSkeleton message={processMsg} />}

        {stage === "results" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 26,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Noto Serif SC', Georgia, serif",
                    fontSize: "1.15rem",
                  }}
                >
                  知识点总览
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {[fileName, `${cards.length} 个知识点`].map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.7rem",
                        background: "var(--paper2)",
                        border: "1px solid var(--border)",
                        padding: "3px 10px",
                        borderRadius: 20,
                        color: "var(--muted)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab 栏 */}
            <div
              role="tablist"
              style={{
                display: "flex",
                borderBottom: "2px solid var(--ink)",
                marginBottom: 26,
              }}
            >
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: "9px 20px",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    border: "none",
                    background: "none",
                    color: tab === id ? "var(--ink)" : "var(--muted)",
                    borderBottom: `3px solid ${
                      tab === id ? "var(--accent)" : "transparent"
                    }`,
                    marginBottom: -2,
                    transition: "all .2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "cards" && (
              <KnowledgeCards
                cards={cards}
                onCardClick={(card) => setDetailCard(card)}
              />
            )}
            {tab === "qa" && <QATab ref={qaRef} pptContent={pptContent} cards={cards} />}
            {tab === "quiz" && <QuizTab pptContent={pptContent} fileName={fileName} />}
          </>
        )}
      </main>

      {/* 知识点详情弹层 */}
      {detailCard && (
        <DetailPanel
          card={detailCard}
          pptContent={pptContent}
          onClose={() => setDetailCard(null)}
        />
      )}

      {/* 恢复会话 Toast */}
      {toast && (
        <div
          className="toast-enter"
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "10px 24px",
            borderRadius: 8,
            fontSize: "0.8rem",
            fontFamily: "monospace",
            boxShadow: "var(--shadow-lg)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>🔄</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
