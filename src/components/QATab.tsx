"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  askQuestionStream,
  type Card,
  type ChatMessage,
} from "@/lib/api-client";
import { MAX_CHAT_HISTORY } from "@/lib/constants";
import { getRelevantMemories, saveMemory } from "@/lib/store";
import MarkdownRenderer, { CopyButton } from "@/components/MarkdownRenderer";

interface QATabProps {
  pptContent: string;
  cards: Card[];
}

interface QATabHandle {
  focusInput: () => void;
}

/** 读取流式 Response body，逐个产出 text delta */
async function readStream(
  body: ReadableStream<string>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
}

interface QAMsg extends ChatMessage {
  failed?: boolean;
  streaming?: boolean;
  /** 完整目标文本（typewriter 用） */
  targetText?: string;
}

/** Typewriter hook: 边流式接收边逐字展现 */
function useTypewriter(
  fullText: string,
  streaming: boolean
): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);
  const fullRef = useRef(fullText);
  fullRef.current = fullText;

  // Reset when text clears
  useEffect(() => {
    if (fullText === "") {
      idxRef.current = 0;
      setDisplayed("");
    }
  }, [fullText]);

  useEffect(() => {
    if (!streaming || fullText.length === 0) {
      setDisplayed(fullText);
      idxRef.current = fullText.length;
      return;
    }

    const interval = setInterval(() => {
      const target = fullRef.current;
      if (idxRef.current >= target.length) {
        clearInterval(interval);
        return;
      }
      // Reveal 2-4 chars per tick
      const step = Math.min(2 + Math.floor(Math.random() * 3), target.length - idxRef.current);
      idxRef.current += step;
      setDisplayed(target.slice(0, idxRef.current));
    }, 18);

    return () => clearInterval(interval);
  }, [streaming, fullText]);

  return {
    displayed,
    done: !streaming || idxRef.current >= fullText.length,
  };
}

const QATab = forwardRef<QATabHandle, QATabProps>(function QATab(
  { pptContent, cards },
  ref
) {
  const [msgs, setMsgs] = useState<QAMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevSessionId = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const scrollToBottom = () => {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      80
    );
  };

  const send = async (retryText?: string) => {
    const q = retryText ?? input.trim();
    if (!q || loading) return;
    if (!retryText) setInput("");

    const history: ChatMessage[] = msgs.map(({ role, content }) => ({
      role,
      content,
    }));
    const fullHistory: QAMsg[] = [
      ...history,
      { role: "user", content: q },
      { role: "assistant", content: "", streaming: true, targetText: "" },
    ];
    setMsgs(fullHistory);
    setLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Retrieve relevant memories
      const memories = getRelevantMemories(q, 3).map((m) => ({
        question: m.question,
        answer: m.answer,
        timestamp: m.timestamp,
      }));

      const { stream } = askQuestionStream(
        {
          question: q,
          context: pptContent,
          history: history.slice(-MAX_CHAT_HISTORY),
          memories,
        },
        { signal: ctrl.signal }
      );

      const readable = await stream;
      let accumulated = "";

      await readStream(
        readable,
        (chunk) => {
          accumulated += chunk;
          setMsgs((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.content = accumulated;
              last.targetText = accumulated;
            }
            return next;
          });
          scrollToBottom();
        },
        ctrl.signal
      );

      // Stream complete
      setMsgs((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.streaming = false;
          last.targetText = accumulated;
        }
        return next;
      });

      // Save to memory
      if (accumulated.trim()) {
        try {
          saveMemory(q, accumulated);
        } catch {}
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "未知错误";
      setMsgs((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.content = message;
          last.streaming = false;
          last.failed = true;
        }
        return next;
      });
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const retry = (msgIndex: number) => {
    const userMsg = msgs.slice(0, msgIndex).findLast((m) => m.role === "user");
    if (!userMsg) return;
    const userIdx = msgs.lastIndexOf(userMsg);
    setMsgs(msgs.slice(0, userIdx));
    send(userMsg.content);
  };

  const clearHistory = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setLoading(false);
  };

  return (
    <div>
      {/* Quick reference chips */}
      {cards.length > 0 && msgs.length === 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {cards.slice(0, 5).map((c) => (
            <button
              key={c.title}
              type="button"
              onClick={() => {
                setInput(`解释「${c.title}」`);
                inputRef.current?.focus();
              }}
              style={{
                background: "var(--paper2)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: "0.72rem",
                cursor: "pointer",
                color: "var(--muted)",
                fontFamily: "monospace",
                transition: "all .15s",
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
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          minHeight: 180,
          maxHeight: 420,
          overflowY: "auto",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {msgs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "56px 20px",
              color: "var(--muted)",
              fontSize: "0.84rem",
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>💬</div>
            基于上传的课件内容，随时向 AI 提问！
            <br />
            <span style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>
              按 <kbd style={{background:"var(--border)",padding:"1px 5px",borderRadius:3,fontSize:"0.65rem"}}>/</kbd> 快速聚焦输入框
            </span>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i}>
              {m.role === "user" && (
                <div
                  style={{
                    padding: "11px 16px",
                    borderRadius: "10px 10px 2px 10px",
                    fontSize: "0.85rem",
                    lineHeight: 1.75,
                    maxWidth: "84%",
                    alignSelf: "flex-end" as const,
                    background: "var(--ink)",
                    color: "var(--paper)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              )}

              {m.role === "assistant" && (
                <div>
                  <div
                    style={{
                      padding: "11px 16px",
                      borderRadius: "2px 10px 10px 10px",
                      fontSize: "0.85rem",
                      lineHeight: 1.75,
                      maxWidth: "84%",
                      alignSelf: "flex-start" as const,
                      background: "var(--card)",
                      color: "var(--ink)",
                      border: "1.5px solid var(--border)",
                    }}
                  >
                    {m.streaming && !m.content ? (
                      <span
                        style={{
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            border: "2px solid var(--border)",
                            borderTopColor: "var(--accent)",
                            borderRadius: "50%",
                            animation: "spin .8s linear infinite",
                            display: "inline-block",
                          }}
                        />
                        思考中...
                      </span>
                    ) : m.failed ? (
                      <div>
                        <div
                          style={{ color: "var(--accent)", marginBottom: 8 }}
                        >
                          ⚠️ {m.content}
                        </div>
                        <button
                          type="button"
                          onClick={() => retry(i)}
                          style={{
                            background: "none",
                            border: "1.5px solid var(--accent)",
                            color: "var(--accent)",
                            padding: "4px 14px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontFamily: "monospace",
                            fontSize: "0.72rem",
                            transition: "all .2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "var(--accent)";
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                            e.currentTarget.style.color = "var(--accent)";
                          }}
                        >
                          ⟳ 重试
                        </button>
                      </div>
                    ) : (
                      <MarkdownRenderer
                        content={
                          m.streaming ? m.content : m.content
                        }
                      />
                    )}
                  </div>
                  {!m.streaming && m.content && !m.failed && (
                    <div
                      style={{
                        marginTop: 4,
                        marginLeft: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <CopyButton text={m.content} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          gap: 10,
          borderTop: "1.5px solid var(--border)",
          paddingTop: 16,
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder='输入问题，Enter 发送（Shift+Enter 换行）…'
          aria-label="向 AI 提问"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          style={{
            flex: 1,
            border: "1.5px solid var(--border)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: "0.85rem",
            background: "var(--card)",
            color: "var(--ink)",
            resize: "none",
            minHeight: 44,
            transition: "border-color .2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--ink)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            style={{
              background:
                loading || !input.trim() ? "var(--muted)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              fontSize: "0.77rem",
              whiteSpace: "nowrap",
              transition: "background .2s",
            }}
          >
            {loading ? "发送中…" : "发送"}
          </button>
          {msgs.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: "0.65rem",
              }}
            >
              清空
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default QATab;
