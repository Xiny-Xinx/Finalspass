# FinalsPass 本地操作步骤

## 1. 更新 .env.local

在项目根目录打开 ` .env.local `，确保有以下内容：

```bash
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
ANTHROPIC_API_KEY=sk-ant-你的Claude密钥   # 不用 Claude 的话可以不加
JWT_SECRET=你的JWT密钥                      # 之前生成的，如果没保存就重新生成一个
```

## 2. 安装依赖 & 推送代码

```bash
cd finalspass

# 更新 lockfile（之前移除了 @anthropic-ai/sdk）
npm install

# 推送到 GitHub
git push origin main
```

## 3. Vercel 环境变量

去 Vercel 项目的 Settings → Environment Variables，添加：

| Name | Value |
|---|---|
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key |
| `ANTHROPIC_API_KEY` | 你的 Anthropic API Key（可选） |
| `JWT_SECRET` | 你的 JWT 密钥 |
| `KV_URL` | 应该已经有了 |
| `KV_REST_API_URL` | 应该已经有了 |
| `KV_REST_API_TOKEN` | 应该已经有了 |
| `KV_REST_API_READ_ONLY_TOKEN` | 应该已经有了 |

---

搞定后项目就能在 https://finalspass.vercel.app 正常跑了，侧边栏底部可以切换 DeepSeek V3 / Claude Sonnet 4。
