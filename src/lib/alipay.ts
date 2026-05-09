/**
 * 支付宝支付集成
 *
 * 使用 Node.js 内置 crypto 实现 RSA-SHA256 签名，
 * 不依赖第三方 SDK。
 *
 * 使用前在 .env.local 配置：
 *   ALIPAY_APP_ID=你的APPID
 *   ALIPAY_PRIVATE_KEY=你的商户私钥（PKCS8 格式，含换行符）
 *   ALIPAY_PUBLIC_KEY=支付宝公钥
 *   NEXT_PUBLIC_BASE_URL=https://你的域名.com
 */

import crypto from "crypto";

export interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  notifyUrl: string;
  returnUrl: string;
}

function getConfig(): AlipayConfig {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return {
    appId: process.env.ALIPAY_APP_ID || "",
    privateKey: (process.env.ALIPAY_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    alipayPublicKey: (process.env.ALIPAY_PUBLIC_KEY || "").replace(/\\n/g, "\n"),
    gateway: "https://openapi.alipay.com/gateway.do",
    notifyUrl: `${baseUrl}/api/alipay/notify`,
    returnUrl: `${baseUrl}/payment/result`,
  };
}

/** 检查支付宝配置是否完整 */
export function isAlipayConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.appId && cfg.privateKey && cfg.alipayPublicKey);
}

/**
 * 生成支付宝电脑网站支付重定向 URL
 *
 * @param outTradeNo 商户订单号（唯一）
 * @param subject    订单标题（显示在支付宝页面）
 * @param totalAmount 订单金额（元，精确到分，如 "35.00"）
 * @param body       订单描述（可选）
 */
export function createPaymentUrl(
  outTradeNo: string,
  subject: string,
  totalAmount: string,
  body?: string
): string {
  const cfg = getConfig();

  const bizContent: Record<string, string> = {
    out_trade_no: outTradeNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: totalAmount,
    subject,
  };
  if (body) bizContent.body = body;

  // 构造公共请求参数
  const params: Record<string, string> = {
    app_id: cfg.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(new Date()),
    version: "1.0",
    notify_url: cfg.notifyUrl,
    return_url: cfg.returnUrl,
    biz_content: JSON.stringify(bizContent),
  };

  params.sign = sign(params, cfg.privateKey);

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  return `${cfg.gateway}?${query}`;
}

/**
 * 验证支付宝异步通知（POST notify）
 * 返回解析后的参数，验证失败返回 null
 */
export function verifyNotify(
  bodyParams: Record<string, string>
): Record<string, string> | null {
  const cfg = getConfig();
  return verifyParams(bodyParams, cfg.alipayPublicKey);
}

/**
 * 验证支付宝同步跳转（GET return）
 * 返回解析后的参数，验证失败返回 null
 */
export function verifyReturn(query: Record<string, string>): Record<string, string> | null {
  const cfg = getConfig();
  return verifyParams(query, cfg.alipayPublicKey);
}

// ── 内部工具 ──

/**
 * RSA-SHA256 签名
 */
function sign(params: Record<string, string>, privateKey: string): string {
  const signStr = buildSignString(params);
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signStr, "utf-8");
  return signer.sign(privateKey, "base64");
}

/**
 * 验证签名
 */
function verify(
  params: Record<string, string>,
  signature: string,
  publicKey: string
): boolean {
  const signStr = buildSignString(params);
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signStr, "utf-8");
  return verifier.verify(publicKey, signature, "base64");
}

/**
 * 验证参数并返回原参数（过滤掉 sign/sign_type）
 */
function verifyParams(
  raw: Record<string, string>,
  publicKey: string
): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== "sign" && k !== "sign_type" && v) {
      params[k] = v;
    }
  }

  const signature = raw.sign || "";
  if (!signature) return null;

  return verify(params, signature, publicKey) ? raw : null;
}

/**
 * 按字母序拼接 key=value&key=value
 */
function buildSignString(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${params[k]}`).join("&");
}

/**
 * 生成支付宝格式的时间戳：yyyy-MM-dd HH:mm:ss
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
