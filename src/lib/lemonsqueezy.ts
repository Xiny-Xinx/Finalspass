/**
 * Lemon Squeezy 支付集成
 *
 * 使用 LS Checkout API 创建动态结账会话，用户跳转到 LS 支付页面完成付款。
 * 付款成功后 LS 通过 Webhook 通知本服务器。
 *
 * 使用前在 .env.local 配置：
 *   LS_API_KEY=你的 Lemon Squeezy API Key
 *   LS_STORE_ID=你的店铺 ID
 *   LS_VARIANT_PRO=Pro 套餐变体 ID
 *   LS_VARIANT_PREMIUM=Premium 套餐变体 ID
 *   LS_WEBHOOK_SECRET=Webhook 签名密钥
 *   LS_TEST_MODE=true          （可选）启用测试模式，可用测试卡号支付不扣款
 *   NEXT_PUBLIC_BASE_URL=https://你的域名.com
 */

import crypto from "node:crypto";

const LS_BASE = "https://api.lemonsqueezy.com/v1";

function getConfig() {
  return {
    apiKey: process.env.LS_API_KEY || "",
    storeId: process.env.LS_STORE_ID || "",
    webhookSecret: process.env.LS_WEBHOOK_SECRET || "",
  };
}

/** 检查 LS 配置是否完整（仅检查店铺和 API，各套餐 variantId 由对应路由校验） */
export function isLsConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.apiKey && cfg.storeId);
}

/**
 * 创建 Lemon Squeezy Checkout，返回结账 URL
 *
 * @param priceCents  价格（美分），如 $5 = 500
 * @param name        商品名称
 * @param description 商品描述
 * @param customData  自定义数据（userId, type, tokens/tier 等），LS 在 webhook 中原样返回
 * @param redirectUrl 支付成功后的跳转地址
 */
export async function createCheckout(
  priceCents: number | undefined,
  name: string,
  description: string,
  customData: Record<string, string>,
  redirectUrl: string,
  variantId: string
): Promise<{ url: string; checkoutId: string } | { error: string }> {
  const cfg = getConfig();

  // 按 LS API v1 文档结构组织参数
  // checkout_data: 客户数据 + 自定义字段
  // product_options: 商品名称/描述/跳转URL
  const attributes: Record<string, unknown> = {
    checkout_data: {
      custom: customData,
    },
    product_options: {
      name,
      description,
      redirect_url: redirectUrl,
    },
  };
  if (priceCents !== undefined) {
    attributes.custom_price = priceCents;
  }
  // 测试模式：设置 LS_TEST_MODE=true 可用测试卡号支付，不产生真实扣款
  if (process.env.LS_TEST_MODE === "true") {
    attributes.test_mode = true;
  }

  try {
    const res = await fetch(`${LS_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes,
          relationships: {
            store: {
              data: { type: "stores", id: cfg.storeId },
            },
            variant: {
              data: { type: "variants", id: variantId },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[LS] createCheckout 失败:", res.status, errText);
      // 尝试解析 LS 返回的错误详情
      let detail = "";
      try {
        const errJson = JSON.parse(errText);
        if (errJson.errors?.[0]?.detail) detail = errJson.errors[0].detail;
      } catch {}
      return {
        error: `创建支付会话失败 (${res.status}${detail ? `: ${detail}` : ""})`,
      };
    }

    const json = await res.json();
    const checkoutId = json.data?.id;
    const url = json.data?.attributes?.url;

    if (!url) {
      return { error: "Lemon Squeezy 返回异常" };
    }

    return { url, checkoutId };
  } catch (err) {
    console.error("[LS] 网络错误:", err);
    return { error: "网络错误，请稍后重试" };
  }
}

/**
 * 验证 Lemon Squeezy Webhook 签名
 *
 * LS 发送 POST 到 webhook 地址，附带 `X-Signature` 头。
 * 使用 HMAC-SHA256 验证，timing-safe 比较防止时序攻击。
 */
export function verifyWebhook<T = any>(
  rawBody: string,
  signature: string
): T | null {
  const cfg = getConfig();
  if (!cfg.webhookSecret || !signature) return null;

  const expected = crypto
    .createHmac("sha256", cfg.webhookSecret)
    .update(rawBody, "utf-8")
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expected, "utf-8");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}
