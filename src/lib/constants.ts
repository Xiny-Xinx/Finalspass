/** 应用级常量 */

/** 上传文件大小上限(字节)。20MB,大于此值会拒绝。 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** 允许的文件扩展名 */
export const ALLOWED_EXTENSIONS = ["pptx", "pdf", "txt"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** 发送给 AI 的最大字符数(避免超长上下文与高额费用) */
export const MAX_EXTRACT_CHARS = 12000;
export const MAX_QUIZ_CHARS = 6000;
export const MAX_QA_CONTEXT_CHARS = 4000;
export const MAX_DETAIL_CONTEXT_CHARS = 3000;

/** 多轮对话保留的历史消息条数(单数表示成对) */
export const MAX_CHAT_HISTORY = 10;

/** 每个 AI 请求消耗的配额单位（按模型区分） */
export const MODEL_QUOTA_COST: Record<string, number> = {
  "deepseek-v4-flash": 1,
  "deepseek-chat": 2,
  "deepseek-v4-pro": 8,
  "claude-sonnet-4-20250514": 10,
};

/** 非聊天类请求的固定配额消耗（提取、测验等） */
export const EXTRACT_QUOTA_COST = 5;
export const QUIZ_QUOTA_COST = 3;

/** 未登录游客每日免费配额（单位：次） */
export const DAILY_TOKEN_LIMIT = 30;

/** 各套餐下各模型的每日调用次数上限（附加限制，在单位配额之上） */
export const TIER_MODEL_CAPS: Record<string, Record<string, number>> = {
  free: {},
  pro: { "deepseek-v4-pro": 25 },
  premium: { "deepseek-v4-pro": 30 },
};

/** 各套餐的每日配额（单位：次，按模型加权） */
export const TIER_LIMITS: Record<string, number> = {
  free: 30,
  pro: 220,
  premium: 500,
};

/** 各套餐的价格（澳元/月） */
export const TIER_PRICES: Record<string, number> = {
  free: 0,
  pro: 8.99,
  premium: 18.49,
};

/** 充值包：tokens -> 价格（美元） */
export const TOP_UP_PACKAGES: { tokens: number; price: number; label: string }[] = [
  { tokens: 200000, price: 2, label: "20 万" },
  { tokens: 1000000, price: 8, label: "100 万" },
  { tokens: 5000000, price: 30, label: "500 万" },
];

/** 充值包基准价格（美元/百万 tokens） */
export const TOP_UP_RATE = 8; // $8/百万 tokens

/** Token 重置窗口(小时)。默认 24 小时，可通过环境变量 QUOTA_WINDOW_HOURS 覆盖 */
export const QUOTA_WINDOW_HOURS = Number(process.env.QUOTA_WINDOW_HOURS) || 24;

/** 每次 AI 请求最低预扣 token（防止余额极低时仍发起请求） */
export const MIN_REQUEST_TOKENS = Number(process.env.MIN_REQUEST_TOKENS) || 1000;

/** 单个用户每日 token 消耗上限（防止恶意耗尽余额） */
export const USER_DAILY_CAP = Number(process.env.USER_DAILY_CAP) || 500000;

/** 速率限制: 每分钟最大请求数（游客） */
export const GUEST_RPM_LIMIT = Number(process.env.GUEST_RPM_LIMIT) || 10;

/** 速率限制: 每分钟最大请求数（已登录用户） */
export const USER_RPM_LIMIT = Number(process.env.USER_RPM_LIMIT) || 30;

/** localStorage 键 */
export const STORAGE_KEY = "finalspass:session:v1";

/** 主题偏好 localStorage 键 */
export const THEME_KEY = "finalspass:theme";
