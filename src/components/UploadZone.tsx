"use client";
import { useRef, useState } from "react";
import { validateFile } from "@/lib/parser";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/constants";

interface UploadZoneProps {
  onFile: (file: File) => void;
}

export default function UploadZone({ onFile }: UploadZoneProps) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    try {
      validateFile(file);
      setError(null);
      onFile(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "无法处理该文件");
    }
  };

  const accept = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
  const maxMb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const files = e.dataTransfer.files;
          if (files.length > 1) {
            setError("仅支持单文件上传，请一次拖入一个文件");
            return;
          }
          const f = files[0];
          if (f) handle(f);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="上传课件文件"
        style={{
          border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "60px 28px",
          textAlign: "center",
          cursor: "pointer",
          background: drag
            ? "color-mix(in srgb, var(--accent) 6%, var(--card))"
            : "var(--card)",
          transform: drag ? "scale(1.01)" : "scale(1)",
          boxShadow: drag ? "var(--shadow-md)" : "var(--shadow-sm)",
          transition: "all .25s ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              handle(f);
              e.target.value = "";
            }
          }}
        />
        <div
          style={{
            fontSize: "3rem",
            marginBottom: 16,
            filter: drag ? "drop-shadow(0 2px 8px rgba(0,0,0,.12))" : "none",
            transition: "filter .25s ease",
          }}
        >
          {drag ? "📥" : "📂"}
        </div>
        <h2
          style={{
            fontFamily: "'Noto Serif SC', Georgia, serif",
            fontSize: "1.15rem",
            marginBottom: 10,
          }}
        >
          {drag ? "松开以上传" : "上传课堂资料"}
        </h2>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.84rem",
            lineHeight: 1.7,
          }}
        >
          支持 {ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(" · ")}{" "}
          (单文件 ≤ {maxMb}MB)
          <br />
          AI 自动提炼核心知识点,过滤无关内容
        </p>
        <div
          style={{
            marginTop: 20,
            display: "inline-block",
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "10px 28px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.84rem",
            fontFamily: "monospace",
            letterSpacing: "0.04em",
            transition: "background .2s, transform .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--ink)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          点击上传 或 拖拽文件至此
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            border: "1.5px solid var(--danger)",
            background: "var(--danger-glow)",
            color: "var(--danger)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            textAlign: "center",
            animation: "fadeUp .25s ease",
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
