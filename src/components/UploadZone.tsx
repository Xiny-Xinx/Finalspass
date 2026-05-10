"use client";
import { useRef, useState } from "react";
import { validateFile } from "@/lib/parser";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/constants";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
}

export default function UploadZone({ onFiles }: UploadZoneProps) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of files) {
      try {
        validateFile(f);
        valid.push(f);
      } catch (err: unknown) {
        errors.push(`${f.name}: ${err instanceof Error ? err.message : "无法处理"}`);
      }
    }
    if (errors.length > 0) {
      setError(errors.join("；"));
    }
    if (valid.length > 0) {
      setError(null);
      onFiles(valid);
    }
  };

  const accept = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
  const maxMb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="上传课件文件"
        style={{
          border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "50px 28px",
          textAlign: "center",
          cursor: "pointer",
          background: drag ? "color-mix(in srgb, var(--accent) 6%, var(--card))" : "var(--card)",
          transform: drag ? "scale(1.01)" : "scale(1)",
          transition: "all .25s ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) { handleFiles(e.target.files); e.target.value = ""; } }}
        />
        <div style={{ fontSize: "3rem", marginBottom: 12, transition: "filter .25s ease" }}>
          {drag ? "📥" : "📂"}
        </div>
        <h2 style={{ fontFamily: "'Noto Serif SC', Georgia, serif", fontSize: "1.1rem", marginBottom: 8 }}>
          {drag ? "松开以上传" : "上传课堂资料"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.84rem", lineHeight: 1.7 }}>
          支持 {ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(" · ")} (每文件 ≤ {maxMb}MB)
          <br />支持多文件批量上传，AI 自动提炼全部知识点
        </p>
        <div style={{
          marginTop: 16, display: "inline-block", background: "var(--accent)", color: "#fff",
          padding: "10px 28px", borderRadius: "var(--radius-md)", fontSize: "0.84rem",
          fontFamily: "monospace", letterSpacing: "0.04em", transition: "background .2s, transform .2s",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-hover)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          选择文件 或 拖拽至此
        </div>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 14, padding: "10px 14px", border: "1.5px solid var(--danger)", background: "var(--danger-glow)", color: "var(--danger)", borderRadius: "var(--radius-md)", fontSize: "0.82rem", textAlign: "center", animation: "fadeUp .25s ease" }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
