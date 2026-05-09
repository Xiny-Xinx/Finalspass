/**
 * 充值接口（模拟）
 *
 * 当前为纯模拟模式 —— 直接增加余额，不经过真实支付。
 * 后期接入 Stripe / Lemon Squeezy 后，在此处加入支付验证逻辑。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/quota-guard";
import { addUserBalance } from "@/lib/user-store";

const schema = z.object({
  tokens: z.number().int().positive("充值数量必须大于 0"),
});

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tokens } = schema.parse(body);

    const result = await addUserBalance(auth.userId, tokens);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `充值 ${tokens.toLocaleString()} tokens 成功`,
      balance: result.balance,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "充值失败" }, { status: 500 });
  }
}
