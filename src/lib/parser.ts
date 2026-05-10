import JSZip from "jszip";
import {
  ALLOWED_EXTENSIONS,
  AllowedExtension,
  MAX_UPLOAD_BYTES,
} from "./constants";

export interface ParseProgress {
  (current: number, total: number): void;
}

/** PDF.js TextItem 的最小化类型(只用到 str 字段) */
interface PdfTextItem {
  str: string;
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function getExtension(filename: string): AllowedExtension | null {
  const ext = filename.toLowerCase().split(".").pop();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext ?? "")
    ? (ext as AllowedExtension)
    : null;
}

export function validateFile(file: File): AllowedExtension {
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`文件超过 ${mb}MB 上限,请压缩或拆分后重新上传`);
  }
  const ext = getExtension(file.name);
  if (!ext) {
    throw new Error(
      `仅支持 ${ALLOWED_EXTENSIONS.map((e) => "." + e).join("、")} 格式`
    );
  }
  return ext;
}

// ── PPTX 解析 ─────────────────────────────────────────────────────────────────

export async function extractPptx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);

  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error("未找到幻灯片内容,请确认是有效的 .pptx 文件");
  }

  const parts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    let xml = await zip.files[slideFiles[i]].async("string");
    // 把 <a:br/> 替换为换行标记,保留段落分隔
    xml = xml.replace(/<a:br\s*\/?>/gi, "\n");
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g))
      .map((m) => m[1]?.trim())
      .filter((s): s is string => !!s);
    if (texts.length) {
      parts.push(`[第${i + 1}张幻灯片] ${texts.join(" ")}`);
    }
  }

  return parts.join("\n\n");
}

// ── PDF 解析 ──────────────────────────────────────────────────────────────────

export async function extractPdf(
  file: File,
  onProgress?: ParseProgress
): Promise<string> {
  // 动态导入,避免 Next.js 服务端渲染时报错
  const pdfjsLib = await import("pdfjs-dist");
  // 使用 CDN worker，避免 webpack 打包 worker 文件时的路径问题
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, verbosity: 0 }).promise;

  const MAX_PAGES = 30;
  const totalPages = Math.min(pdf.numPages, MAX_PAGES);
  const parts: string[] = [];
  let skipped = 0;
  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, pdf.numPages);
    try {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const text = (tc.items as PdfTextItem[])
        .map((x) => x.str)
        .join(" ")
        .trim();
      if (text) parts.push(`[第${i}页] ${text}`);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  if (pdf.numPages > MAX_PAGES) {
    parts.push(`\n\n[注意：文件共 ${pdf.numPages} 页，仅处理了前 ${MAX_PAGES} 页]`);
  }

  if (parts.length === 0) {
    throw new Error(
      "未能提取到文字。若是扫描件/图片 PDF,请先用 OCR 工具(如 ilovepdf.com)转换后再上传。"
    );
  }

  let result = parts.join("\n\n");
  if (skipped > 0) {
    result += `\n\n⚠️ 提示:有 ${skipped} 页未能提取到文字(可能是图片页或扫描件),已自动跳过。`;
  }
  return result;
}

// ── 纯文本 ────────────────────────────────────────────────────────────────────

export async function extractTxt(file: File): Promise<string> {
  return file.text();
}

// ── 统一入口 ──────────────────────────────────────────────────────────────────

export async function extractFile(
  file: File,
  onProgress?: ParseProgress
): Promise<string> {
  const ext = validateFile(file);
  let text: string;
  if (ext === "pptx") text = await extractPptx(file);
  else if (ext === "pdf") text = await extractPdf(file, onProgress);
  else text = await extractTxt(file);

  if (!text.trim()) {
    throw new Error("未能读取到文字内容,文件可能为空或格式异常");
  }
  return text;
}
