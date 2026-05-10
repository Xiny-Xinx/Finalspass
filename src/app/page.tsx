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
import { MAX_EXTRACT_CHARS, STORAGE_KEY, THEME_KEY, MODEL_QUOTA_COST } from "@/lib/constants";
import { fetchSessions, createSession, loadSessionData, clearAllSessions as clearHistory } from "@/lib/history-client";
import type { SessionMeta } from "@/lib/store";
import { MODELS, MODEL_DETAILS, DEFAULT_MODEL, TIER_MODELS, type ModelId } from "@/lib/claude";

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
  tier?: string;
  isLoggedIn?: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportChat, setSupportChat] = useState<{role:"user"|"assistant"; content:string}[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
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
    fetchSessions(isLoggedIn).then(setSessionList);
  }, [isLoggedIn]);

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
          // 根据套餐限制可用模型（免费用户只能使用偏低性能的模型）
          const currentTier = data.tier ?? "free";
          const allowedModels = TIER_MODELS[currentTier] ?? TIER_MODELS.free;
          setModel((prev) => allowedModels.includes(prev) ? prev : allowedModels[0]);
        }
      })
      .catch(() => {});
    fetch("/api/user/support/admin/check")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.admin === true))
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
      createSession(isLoggedIn, { fileName, pptContent, cards, qaHistory: [] });
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

  const loadHistorySession = useCallback(async (id: string) => {
    const data = await loadSessionData(isLoggedIn, id);
    if (!data) return;
    setFileName(data.fileName);
    setPptContent(data.pptContent);
    setCards(data.cards);
    setTab("cards");
    setStage("results");
    setMenuOpen(false);
  }, [isLoggedIn]);

  // 打开客服时加载历史消息和管理员回复
  useEffect(() => {
    if (!supportOpen) return;
    fetch("/api/user/support/conv")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setSupportChat(data.messages);
      })
      .catch(() => {});
  }, [supportOpen]);

  async function handleSupportSend(e: React.FormEvent) {
    e.preventDefault();
    if (!supportMsg.trim() || supportLoading) return;
    const q = supportMsg.trim();
    setSupportMsg("");
    setSupportChat((prev) => [...prev, { role: "user", content: q }]);
    setSupportLoading(true);
    try {
      const res = await fetch("/api/user/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.unread) {
        // 有管理员新回复，重新拉取完整对话
        const r2 = await fetch("/api/user/support/conv");
        const d2 = await r2.json();
        setSupportChat(d2.messages || []);
      } else if (data.transfer) {
        setSupportChat((prev) => [...prev, { role: "assistant", content: "已为您转接人工客服，请稍候。您的问题已提交，管理员会尽快回复。" }]);
      } else {
        setSupportChat((prev) => [...prev, { role: "assistant", content: data.reply || "抱歉，暂时无法回复。" }]);
      }
    } catch {
      setSupportChat((prev) => [...prev, { role: "assistant", content: "网络错误，请稍后重试。" }]);
    } finally {
      setSupportLoading(false);
    }
  }

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
        className="main-header"
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
            fetchSessions(isLoggedIn).then(setSessionList);
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

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {/* 配额显示：圆形进度环 */}
          {quota && quota.enabled && (
            <div
              title={isLoggedIn ? `今日已用 ${quota.used} / ${quota.limit} 次` : `已用 ${quota.used} 次`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "default",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="11" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle
                  cx="15" cy="15" r="11"
                  fill="none"
                  stroke={quota.remaining <= 10 ? "var(--accent)" : "var(--muted)"}
                  strokeWidth="3"
                  strokeDasharray={`${(quota.used / quota.limit) * 69.12} 69.12`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90, 15, 15)"
                  style={{ transition: "stroke-dasharray .3s ease, stroke .3s ease" }}
                />
                <text
                  x="15" y="19"
                  textAnchor="middle"
                  fill={quota.remaining <= 10 ? "var(--accent)" : "var(--muted)"}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight={600}
                >
                  {quota.remaining}
                </text>
              </svg>
              {quota.remaining <= 5 && (
                <span style={{ fontSize: "0.6rem", color: "var(--accent)", fontFamily: "monospace" }}>
                  即将用完
                </span>
              )}
            </div>
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
        className="main-content"
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
            {/* 新用户引导 */}
            {sessionList.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 28,
                  animation: "fadeUp .35s ease",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    margin: "0 0 6px",
                    fontFamily: "'Noto Serif SC', Georgia, serif",
                  }}
                >
                  欢迎使用 FinalsPass
                </h2>
                <p
                  style={{
                    fontSize: "0.84rem",
                    color: "var(--muted)",
                    margin: 0,
                    lineHeight: 1.7,
                  }}
                >
                  上传课堂讲义或课件（PDF / PPTX / DOCX）<br />
                  AI 将自动提取核心知识点，并支持智能问答与练习测验
                </p>
              </div>
            )}

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
                          const currentTier = quota?.tier ?? "free";
                          const allowedModels = TIER_MODELS[currentTier] ?? TIER_MODELS.free;
                          const isAllowed = allowedModels.includes(m.id);
                          const active = model === m.id;
                          const detail = MODEL_DETAILS[m.id];
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { if (isAllowed) { setModel(m.id); setModelPopoverOpen(false); } }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                font: "inherit",
                                border: "none",
                                borderBottom: "1px solid var(--border)",
                                background: active ? "var(--accent-subtle)" : "transparent",
                                padding: "10px 14px",
                                cursor: isAllowed ? "pointer" : "not-allowed",
                                opacity: isAllowed ? 1 : 0.45,
                                transition: "background .1s",
                              }}
                              onMouseEnter={(e) => { if (!active && isAllowed) e.currentTarget.style.background = "var(--accent-glow)"; }}
                              onMouseLeave={(e) => { if (!active && isAllowed) e.currentTarget.style.background = "transparent"; }}
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
                                <span style={{
                                  marginLeft: "auto",
                                  fontSize: "0.6rem",
                                  fontFamily: "monospace",
                                  color: "var(--muted)",
                                  opacity: 0.6,
                                }}>
                                  {MODEL_QUOTA_COST[m.id] || 1} 单位/次
                                </span>
                                {active && (
                                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--accent)" }}>
                                    ✓
                                  </span>
                                )}
                                {!isAllowed && !active && (
                                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "var(--accent)", fontFamily: "monospace" }}>
                                    🔒 升级可用
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.68rem", color: isAllowed ? "var(--muted)" : "var(--accent)", lineHeight: 1.5 }}>
                                {isAllowed ? `${detail?.summary} · ${MODEL_QUOTA_COST[m.id] || 1}单位/次` : "升级套餐即可使用此模型"}
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

      {/* ── 侧边栏（类 Claude 风格） ── */}
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
            className="sidebar-aside"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320,
              maxWidth: "85vw",
              height: "100%",
              background: "var(--sidebar-bg)",
              borderRight: "1px solid var(--sidebar-border)",
              display: "flex",
              flexDirection: "column",
              animation: "slideIn .2s ease",
            }}
          >
            {/* ── 顶部品牌 ── */}
            <div
              style={{
                padding: "18px 18px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    fontFamily: "'Noto Serif SC', serif",
                  }}
                >
                  F
                </div>
                <span
                  style={{
                    fontFamily: "'Noto Serif SC', Georgia, serif",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                    letterSpacing: "0.02em",
                  }}
                >
                  FinalsPass
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="关闭菜单"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: "var(--muted)",
                  padding: 4,
                  lineHeight: 1,
                  borderRadius: 6,
                  opacity: 0.6,
                  transition: "opacity .2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              >
                ✕
              </button>
            </div>

            {/* ── 新建按钮 ── */}
            <div style={{ padding: "0 14px 14px" }}>
              <button
                type="button"
                onClick={() => { reset(); setMenuOpen(false); }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "opacity .2s, transform .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>+</span>
                新建上传
              </button>
            </div>

            {/* ── 历史记录列表 ── */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "0 10px 8px",
              }}
            >
              {sessionList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--muted)",
                    fontSize: "0.78rem",
                    lineHeight: 1.8,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "var(--sidebar-hover)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 14px",
                      fontSize: "1.2rem",
                    }}
                  >
                    📂
                  </div>
                  暂无历史记录
                  <br />
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", opacity: 0.7 }}>
                    上传文件后自动保存
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {sessionList.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => loadHistorySession(s.id)}
                      style={{
                        textAlign: "left",
                        font: "inherit",
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        animation: `fadeUp .25s ease ${i * 0.03}s both`,
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
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
                        {s.fileName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          fontSize: "0.65rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                          opacity: 0.7,
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

            {/* ── 底部用户区 ── */}
            <div
              style={{
                borderTop: "1px solid var(--sidebar-border)",
                padding: "10px 10px 12px",
              }}
            >
              {/* 用量 */}
              {quota && quota.enabled && (
                <div
                  style={{
                    padding: "6px 10px 10px",
                    fontSize: "0.68rem",
                    fontFamily: "monospace",
                    color: "var(--muted)",
                    opacity: 0.7,
                  }}
                >
                  今日 {quota.used} / {quota.limit} 次
                </div>
              )}

              {/* 账户 */}
              <a
                href={isLoggedIn ? "/account" : "/login"}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  fontSize: "0.82rem",
                  color: "var(--ink)",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "var(--accent-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    color: "var(--accent)",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {isLoggedIn && userEmail ? userEmail[0].toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isLoggedIn ? "账户设置" : "登录 / 注册"}
                  </div>
                  {isLoggedIn && userEmail && (
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--muted)",
                        opacity: 0.7,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userEmail}
                    </div>
                  )}
                </div>
              </a>

              {/* 底部工具栏 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 4px 0",
                  marginTop: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => { toggleTheme(); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {dark ? "☀️" : "🌙"} {dark ? "浅色" : "深色"}
                </button>
                <div style={{ display: "flex", gap: 2 }}>
                  <a
                    href="/privacy"
                    onClick={() => setMenuOpen(false)}
                    style={{ fontSize: "0.68rem", color: "var(--muted)", textDecoration: "none", padding: "4px 6px", borderRadius: 4, opacity: 0.6 }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                  >
                    隐私
                  </a>
                  <span style={{ fontSize: "0.68rem", color: "var(--sidebar-border)" }}>·</span>
                  <a
                    href="/terms"
                    onClick={() => setMenuOpen(false)}
                    style={{ fontSize: "0.68rem", color: "var(--muted)", textDecoration: "none", padding: "4px 6px", borderRadius: 4, opacity: 0.6 }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                  >
                    条款
                  </a>
                  <span style={{ fontSize: "0.68rem", color: "var(--sidebar-border)" }}>·</span>
                  {isAdmin && (
                  <>
                    <a
                      href="/admin/messages"
                      onClick={() => setMenuOpen(false)}
                      style={{ fontSize: "0.68rem", color: "var(--muted)", textDecoration: "none", padding: "4px 6px", borderRadius: 4, opacity: 0.6 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                    >
                      工单
                    </a>
                    <span style={{ fontSize: "0.68rem", color: "var(--sidebar-border)" }}>·</span>
                  </>
                )}
                <button
                    onClick={() => { setMenuOpen(false); setSupportOpen(true); }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      padding: "4px 6px",
                      borderRadius: 4,
                      opacity: 0.6,
                      transition: "opacity .15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                  >
                    帮助
                  </button>
                </div>
              </div>
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

      {/* ── 客服聊天窗口 ── */}
      {supportOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            right: 24,
            zIndex: 600,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "0 -4px 24px rgba(0,0,0,.12)",
            display: "flex",
            flexDirection: "column",
            maxHeight: 480,
            animation: "fadeUp .2s ease",
          }}
        >
          {/* 头部 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                F
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>在线客服</span>
            </div>
            <button
              onClick={() => { setSupportOpen(false); setSupportChat([]); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
                color: "var(--muted)",
                padding: 2,
                lineHeight: 1,
                opacity: 0.6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
            >
              ✕
            </button>
          </div>

          {/* 消息区域 */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 200,
            }}
          >
            {supportChat.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 12px",
                  color: "var(--muted)",
                  fontSize: "0.78rem",
                  lineHeight: 1.8,
                  margin: "auto",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>💬</div>
                您好！我是 FinalsPass 客服助手<br />
                有什么可以帮您的？
              </div>
            )}
            {supportChat.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: "0.8rem",
                  lineHeight: 1.6,
                  background: m.role === "user" ? "var(--accent)" : "var(--accent-glow)",
                  color: m.role === "user" ? "white" : "var(--ink)",
                  borderBottomRightRadius: m.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: m.role === "user" ? 12 : 4,
                  animation: "fadeUp .15s ease",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {supportLoading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 12,
                  fontSize: "0.8rem",
                  background: "var(--accent-glow)",
                  color: "var(--muted)",
                  borderBottomLeftRadius: 4,
                  animation: "pulse 1.2s ease infinite",
                }}
              >
                正在输入…
              </div>
            )}
          </div>

          {/* 输入框 */}
          <form
            onSubmit={handleSupportSend}
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <input
              value={supportMsg}
              onChange={(e) => setSupportMsg(e.target.value)}
              placeholder="输入您的问题…"
              disabled={supportLoading}
              style={{
                flex: 1,
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: "0.82rem",
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!supportMsg.trim() || supportLoading}
              style={{
                background: supportMsg.trim() && !supportLoading ? "var(--accent)" : "var(--border)",
                color: supportMsg.trim() && !supportLoading ? "white" : "var(--muted)",
                border: "none",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: "0.82rem",
                cursor: supportMsg.trim() && !supportLoading ? "pointer" : "not-allowed",
                transition: "background .15s",
              }}
            >
              发送
            </button>
          </form>
        </div>
      )}

      {/* 客服浮动按钮（仅在不显示窗口时） */}
      {!supportOpen && (
        <button
          onClick={() => setSupportOpen(true)}
          aria-label="在线客服"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 600,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "1.2rem",
            boxShadow: "0 4px 16px rgba(37,99,235,.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform .2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          💬
        </button>
      )}
    </div>
    </ErrorBoundary>
  );
}
