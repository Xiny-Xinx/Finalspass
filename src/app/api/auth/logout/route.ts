import { NextResponse } from "next/server";
import { clearCookie } from "@/lib/auth";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearCookie("fp_token") } }
  );
}
