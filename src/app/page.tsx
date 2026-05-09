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
import { saveSession, listSessions, loadSession, deleteSession, clearAllSessions } from "@/lib/store";
import type { SessionMeta } from "@/lib/store";
import { MODELS, MODEL_DETAILS, DEFAULT_MODEL, type ModelId } from "@/lib/claude";

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [sessionList, setSessionList] = useState<SessionMeta[]>([]);
  const [scrollY, setScrollY] = useState(0);
  const [model, setModel] = useState<ModelId>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("finalspass-model") : null;
      return stored && MODELS.some(m => m.id === stored) ? stored as ModelId : DEFAULT_MODEL;
    } catch { return DEFAULT_MODEL; }
  });
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

  // 模型选择持久化
  useEffect(() => {
    try { localStorage.setItem("finalspass-model", model); } catch {}
  }, [model]);

  // 初始化主题 & 加载最近会话
  useEffect(() => {
    const el = document.documentElement;
    const cur = el.getAttribute("data-theme");
    setDark(cur === "dark");
    setSessionList(listSessions());
  }, []);

  // 获取今日配额 & 登录状态
  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then((data: any) => {
        if (typeof data.remaining === "number") {
          setQuota(data);
          setIsLoggedIn(data.isLoggedIn === true);
          if (data.isLoggedIn && data.balance !== undefined) {
            setUserEmail(data.email || null);
          }
        }
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

      if (e.key === "Escape") {
        setMenuOpen(false);
        setModelPopoverOpen(false);
      } else if (e.key === "1") setTab("cards");
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

  // 滚动监听（回到顶部按钮）
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

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
      const data = await extractCards(text, { model });

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

  const loadHistorySession = useCallback((id: string) => {
    const data = loadSession(id);
    if (!data) return;
    setFileName(data.fileName);
    setPptContent(data.pptContent);
    setCards(data.cards);
    setTab("cards");
    setStage("results");
    setMenuOpen(false);
  }, []);

  return (
    <ErrorBoundary>
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      {/* 顶部蓝色装饰条 */}
      <div
        style={{
          height: 3,
          background: "linear-gradient(90deg, var(--accent), #6366f1)",
        }}
      />

      {/* ── 顶栏 ── */}
      <header
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--paper)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          transition: "background .2s ease",
        }}
      >
        {/* 汉堡菜单 */}
        <button
          type="button"
          onClick={() => {
            setSessionList(listSessions());
            setMenuOpen(true);
          }}
          aria-label="打开菜单"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            color: "var(--muted)",
            transition: "color .2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
        >
          <span style={{ width: 18, height: 2, background: "currentColor", borderRadius: 1, display: "block" }} />
          <span style={{ width: 18, height: 2, background: "currentColor", borderRadius: 1, display: "block" }} />
          <span style={{ width: 18, height: 2, background: "currentColor", borderRadius: 1, display: "block" }} />
        </button>

        {/* Logo - 单击返回首页 */}
        <h1
          onClick={() => router.push("/")}
          style={{
            fontFamily: "'Noto Serif SC', Georgia, serif",
            fontSize: "1.15rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            color: "var(--accent)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          FinalsPass
        </h1>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: "0.6rem",
            color: "var(--muted)",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            padding: "2px 8px",
            borderRadius: 10,
            background: "var(--accent-subtle)",
          }}
        >
          AI 考前冲刺
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {/* 暗色模式切换（图标版） */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "切换亮色模式" : "切换暗色模式"}
            title={dark ? "切换亮色模式" : "切换暗色模式"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              fontSize: "1rem",
              color: "var(--muted)",
              borderRadius: 6,
              transition: "all .2s",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {/* 用户状态 */}
          {isLoggedIn ? (
            <a
              href="/account"
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                textDecoration: "none",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "3px 10px",
                whiteSpace: "nowrap",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
              {userEmail?.split("@")[0] || "账户"}
            </a>
          ) : (
            <a
              href="/login"
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                textDecoration: "none",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "3px 10px",
                whiteSpace: "nowrap",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
              登录
            </a>
          )}

          {/* 配额显示 */}
          {quota && quota.enabled && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.65rem",
                color: quota.remaining <= 10000 ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${quota.remaining <= 10000 ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 20,
                padding: "3px 10px",
                whiteSpace: "nowrap",
              }}
              title={isLoggedIn ? `余额 ${quota.remaining.toLocaleString()} tokens` : `已用 ${quota.used.toLocaleString()} tokens`}
            >
              {isLoggedIn
                ? `${(quota.remaining / 1000).toFixed(0)}k`
                : `${(quota.remaining / 1000).toFixed(0)}k/${(quota.limit / 1000).toFixed(0)}k`
              }
            </span>
          )}

          {stage === "results" && (
            <button
              type="button"
              onClick={reset}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                padding: "4px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.72rem",
                fontFamily: "monospace",
                cursor: "pointer",
                color: "var(--muted)",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--muted)";
              }}
            >
              重新上传
            </button>
          )}
        </div>
      </header>

      {/* ── 主体 ── */}
      <main
        style={{
          maxWidth: stage === "upload" || stage === "processing" ? 560 : 1200,
          margin: "0 auto",
          padding: stage === "results" ? "24px 20px 60px" : "48px 20px 60px",
          transition: "max-width .3s ease, padding .3s ease",
        }}
      >
        {error && stage === "upload" && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              border: "1px solid var(--danger)",
              background: "var(--danger-glow)",
              color: "var(--danger)",
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
                color: "var(--danger)",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {stage === "upload" && (
          <>
            <UploadZone onFile={handleFile} />

            {/* 最近文件 */}
            {sessionList.length > 0 && (
              <div
                style={{
                  marginTop: 40,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 24,
                }}
              >
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--ink)",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>🕐</span>
                  最近文件
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sessionList.slice(0, 5).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="recent-file-card"
                      onClick={() => loadHistorySession(s.id)}
                    >
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📄 {s.fileName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          fontSize: "0.68rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        <span>{new Date(s.timestamp).toLocaleDateString("zh-CN")}</span>
                        <span>{s.cardCount} 个知识点</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {stage === "processing" && <ProcessingSkeleton message={processMsg} />}

        {stage === "results" && (
          <>

            {/* Tab 栏（含文件信息） */}
            <div
              role="tablist"
              style={{
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                marginBottom: 24,
                gap: 2,
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
                    padding: "8px 16px",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    border: "none",
                    background: tab === id ? "var(--accent-subtle)" : "transparent",
                    color: tab === id ? "var(--accent)" : "var(--muted)",
                    borderBottom: `2px solid ${
                      tab === id ? "var(--accent)" : "transparent"
                    }`,
                    marginBottom: -1,
                    borderRadius: "6px 6px 0 0",
                    transition: "all .2s",
                    fontWeight: tab === id ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (tab !== id) e.currentTarget.style.background = "var(--accent-glow)";
                  }}
                  onMouseLeave={(e) => {
                    if (tab !== id) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {label}
                </button>
              ))}

              {/* 模型选择 + 文件信息 pill（靠右） */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {/* 模型选择器（自定义下拉） */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setModelPopoverOpen((v) => !v)}
                    aria-label="选择 AI 模型"
                    title={MODELS.find(m => m.id === model)?.description ?? ""}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.68rem",
                      background: "var(--paper2)",
                      border: "1px solid var(--border)",
                      borderRadius: 20,
                      padding: "2px 10px",
                      color: "var(--accent)",
                      cursor: "pointer",
                      outline: "none",
                      whiteSpace: "nowrap",
                      transition: "border-color .15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    {MODELS.find(m => m.id === model)?.label ?? model}
                    <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▾</span>
                  </button>

                  {modelPopoverOpen && (
                    <>
                      {/* 遮罩层用来捕获点击关闭 */}
                      <div
                        onClick={() => setModelPopoverOpen(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 199,
                        }}
                      />
                      {/* 弹出面板 */}
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          zIndex: 200,
                          background: "var(--paper)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-lg)",
                          minWidth: 280,
                          maxWidth: 320,
                          animation: "fadeUp .15s ease",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "0.7rem",
                            fontFamily: "monospace",
                            color: "var(--muted)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          切换 AI 模型
                        </div>
                        {MODELS.map((m) => {
                          const active = model === m.id;
                          const detail = MODEL_DETAILS[m.id];
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setModel(m.id); setModelPopoverOpen(false); }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                font: "inherit",
                                border: "none",
                                borderBottom: "1px solid var(--border)",
                                background: active ? "var(--accent-subtle)" : "transparent",
                                padding: "10px 14px",
                                cursor: "pointer",
                                transition: "background .1s",
                              }}
                              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--accent-glow)"; }}
                              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{
                                  fontWeight: 600,
                                  fontSize: "0.82rem",
                                  color: active ? "var(--accent)" : "var(--ink)",
                                }}>
                                  {m.label}
                                </span>
                                {detail?.badge && (
                                  <span style={{
                                    fontSize: "0.6rem",
                                    fontFamily: "monospace",
                                    background: active ? "var(--accent)" : "var(--border)",
                                    color: active ? "white" : "var(--muted)",
                                    padding: "1px 6px",
                                    borderRadius: 8,
                                    lineHeight: "1.4",
                                  }}>
                                    {detail.badge}
                                  </span>
                                )}
                                {active && (
                                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--accent)" }}>
                                    ✓
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.68rem", color: "var(--muted)", lineHeight: 1.5 }}>
                                {detail?.summary}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.68rem",
                    background: "var(--paper2)",
                    border: "1px solid var(--border)",
                    padding: "2px 10px",
                    borderRadius: 20,
                    color: "var(--muted)",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  📄 {fileName}
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.68rem",
                    background: "var(--paper2)",
                    border: "1px solid var(--border)",
                    padding: "2px 10px",
                    borderRadius: 20,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cards.length} 个知识点
                </span>
              </div>
            </div>

            {tab === "cards" && (
              <KnowledgeCards
                cards={cards}
                onCardClick={(card) => setDetailCard(card)}
              />
            )}
            {tab === "qa" && <QATab ref={qaRef} pptContent={pptContent} cards={cards} model={model} />}
            {tab === "quiz" && <QuizTab pptContent={pptContent} fileName={fileName} model={model} />}
          </>
        )}
      </main>

      {/* 知识点详情弹层 */}
      {detailCard && (
        <DetailPanel
          card={detailCard}
          pptContent={pptContent}
          onClose={() => setDetailCard(null)}
          model={model}
        />
      )}

      {/* ── 侧边栏菜单 ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "var(--overlay)",
            animation: "fadeIn .15s ease",
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 300,
              maxWidth: "80vw",
              height: "100%",
              background: "var(--paper)",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              animation: "slideIn .2s ease",
            }}
          >
            {/* 侧栏头部 */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: "'Noto Serif SC', Georgia, serif",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                FinalsPass
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="关闭菜单"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  color: "var(--muted)",
                  padding: 2,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* 新建上传 */}
            <button
              type="button"
              onClick={() => { reset(); setMenuOpen(false); }}
              style={{
                margin: "12px 12px 0",
                padding: "10px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontFamily: "monospace",
                fontWeight: 500,
                transition: "opacity .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              + 新建上传
            </button>

            {/* 历史记录列表 */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
              {sessionList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 12px",
                    color: "var(--muted)",
                    fontSize: "0.78rem",
                    lineHeight: 1.7,
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📂</div>
                  暂无历史记录<br />
                  上传文件后历史将自动保存
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sessionList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => loadHistorySession(s.id)}
                      style={{
                        textAlign: "left",
                        font: "inherit",
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                    >
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 500,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📄 {s.fileName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          fontSize: "0.66rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        <span>{new Date(s.timestamp).toLocaleDateString("zh-CN")}</span>
                        <span>{s.cardCount} 知识点</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 侧栏底部 */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {/* 主题切换 */}
              <button
                type="button"
                onClick={() => { toggleTheme(); }}
                style={{
                  textAlign: "left",
                  font: "inherit",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                {dark ? "☀️ 切换亮色模式" : "🌙 切换暗色模式"}
              </button>

              {/* 账户设置 */}
              <a
                href={isLoggedIn ? "/account" : "/login"}
                onClick={() => setMenuOpen(false)}
                style={{
                  textAlign: "left",
                  font: "inherit",
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                👤 {isLoggedIn ? "账户设置" : "登录 / 注册"}
              </a>

              {/* 隐私政策 & 服务条款 */}
              <div style={{ display: "flex", gap: 4, padding: "4px 12px" }}>
                <a
                  href="/privacy"
                  onClick={() => setMenuOpen(false)}
                  style={{ fontSize: "0.68rem", color: "var(--muted)", textDecoration: "none" }}
                >隐私政策</a>
                <span style={{ fontSize: "0.68rem", color: "var(--border)" }}>·</span>
                <a
                  href="/terms"
                  onClick={() => setMenuOpen(false)}
                  style={{ fontSize: "0.68rem", color: "var(--muted)", textDecoration: "none" }}
                >服务条款</a>
              </div>

              {/* Token 额度 */}
              {quota && quota.enabled && (
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                    color: "var(--muted)",
                    borderTop: "1px solid var(--border)",
                    marginTop: 4,
                    paddingTop: 8,
                  }}
                >
                  今日已用: {(quota.used / 1000).toFixed(0)}k / {(quota.limit / 1000).toFixed(0)}k tokens
                </div>
              )}

              {/* 清除历史 */}
              {sessionList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("确定清除所有历史记录？")) {
                      clearAllSessions();
                      setSessionList([]);
                    }
                  }}
                  style={{
                    textAlign: "left",
                    font: "inherit",
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    color: "var(--danger)",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-glow)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  🗑 清除所有历史
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 回到顶部按钮 */}
      {scrollY > 400 && (
        <button
          type="button"
          className="back-to-top"
          onClick={scrollToTop}
          aria-label="回到顶部"
        >
          ↑
        </button>
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
