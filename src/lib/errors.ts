import { NextResponse } from "next/server";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

export function errorResponse(error: unknown, status = 500): NextResponse {
  const message = getErrorMessage(error);
  // 在服务端打日志,方便排查;返回给前端的只有错误信息
  // eslint-disable-next-line no-console
  console.error("[api]", message, error);
  return NextResponse.json({ error: message }, { status });
}
