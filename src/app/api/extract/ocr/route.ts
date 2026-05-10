import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/quota-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30 秒超时

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OCR 服务未配置" }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "请上传文件" }, { status: 400 });

    // 发送到 OCR.space（支持 PDF 直接上传）
    const body = new FormData();
    body.append("apikey", apiKey);
    body.append("file", file, file.name);
    body.append("language", "chs");      // 中文
    body.append("isOverlayRequired", "false");
    body.append("OCREngine", "2");        // Engine 2 更好

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body,
    });

    const json = await res.json();
    if (!res.ok || json.IsErroredOnProcessing) {
      console.error("[ocr] OCR.space 错误:", json.ErrorMessage || json);
      return NextResponse.json({ error: "OCR 识别失败" }, { status: 500 });
    }

    // 合并所有页的文字
    const text = (json.ParsedResults || [])
      .map((r: any) => r.ParsedText || "")
      .join("\n\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "未能识别到文字" }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[ocr] 错误:", err);
    return NextResponse.json({ error: "OCR 服务异常" }, { status: 500 });
  }
}
