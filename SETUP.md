# FinalsPass 本地操作步骤

## 1. 更新 .env.local

在项目根目录打开 ` .env.local `，确保有以下内容：

```bash
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
ANTHROPIC_API_KEY=sk-ant-你的Claude密钥   # 不用 Claude 的话可以不加
JWT_SECRET=你的JWT密钥                      # 之前生成的，如果没保存就重新生成一个

# Lemon Squeezy 支付（可选，不配的话充值/订阅会提示"支付系统尚未配置"）
LS_API_KEY=你的 Lemon Squeezy API Key
LS_STORE_ID=你的店铺 ID
LS_VARIANT_ID=变量定价变体 ID
LS_WEBHOOK_SECRET=Webhook 签名密钥
NEXT_PUBLIC_BASE_URL=https://你的域名.com    # 用于支付回调
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
| `LS_API_KEY` | 你的 Lemon Squeezy API Key |
| `LS_STORE_ID` | 你的店铺 ID |
| `LS_VARIANT_ID` | 变量定价变体 ID |
| `LS_WEBHOOK_SECRET` | Webhook 签名密钥 |
| `NEXT_PUBLIC_BASE_URL` | 你的域名（如 https://finalspass.vercel.app） |

## 4. Lemon Squeezy 注册 & 配置指引

Lemon Squeezy 是面向个人开发者的国际支付平台，不需要营业执照。

### 4.1 注册账号

1. 打开 [lemonsqueezy.com](https://lemonsqueezy.com) → 点击 Get started
2. 用邮箱注册
3. 验证邮箱后，进入 Dashboard

### 4.2 创建店铺

1. Dashboard → Stores → Create store
2. 填写店铺名称（如 FinalsPass）、网址等基本信息
3. 创建后记下 **Store ID**（在 Stores 列表页能看到）

### 4.3 创建产品 & 变体（变量定价）

LS 要求所有商品必须有产品（Product）和变体（Variant），但我们只需要一个"变量定价"变体来覆盖所有的充值项和套餐。

1. Dashboard → Products → Create product
2. 产品名称：FinalsPass Credits
3. 创建后进入该产品 → Variants → Create variant
4. 变体名称：Variable Amount
5. **关键步骤**：在定价部分，勾选 **"Variable pricing"**（允许传入任意金额）
6. 保存后记下 **Variant ID**（在 URL 或页面中可以看到）

### 4.4 配置 Webhook

1. Dashboard → Settings → Webhooks → Create webhook
2. URL：`https://你的域名.com/api/lemonsqueezy/webhook`
3. 事件：勾选 **`order_created`**
4. 创建后记下 **Webhook secret**（签名密钥）

### 4.5 填入环境变量

把上面记下的四个值填到 `.env.local` 和 Vercel 的环境变量中。

---

搞定后项目就能在 https://finalspass.vercel.app 正常跑了。
