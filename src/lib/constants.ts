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

/** 每日 API Token 限额(免费用户)。可通过环境变量 QUOTA_TOKEN_LIMIT 覆盖 */
export const DAILY_TOKEN_LIMIT = Number(process.env.QUOTA_TOKEN_LIMIT) || 100000;

/** Token 重置窗口(小时)。默认 6 小时，可通过环境变量 QUOTA_WINDOW_HOURS 覆盖 */
export const QUOTA_WINDOW_HOURS = Number(process.env.QUOTA_WINDOW_HOURS) || 6;

/** localStorage 键 */
export const STORAGE_KEY = "finalspass:session:v1";

/** 主题偏好 localStorage 键 */
export const THEME_KEY = "finalspass:theme";
