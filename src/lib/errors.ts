import { NextResponse } from "next/server";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

export function errorResponse(error: unknown, status = 500): NextResponse {
  const message = getErrorMessage(error);
  // 支持自定义 statusCode（如配额超限返回 429）
  const actualStatus =
    error instanceof Error && (error as any).statusCode
      ? (error as any).statusCode
      : status;
  // eslint-disable-next-line no-console
  console.error("[api]", message, error);
  return NextResponse.json({ error: message }, { status: actualStatus });
}
