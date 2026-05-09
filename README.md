# FinalsPass · AI 考前冲刺助手

上传课堂 PPT / PDF,AI 自动提炼核心知识点,支持点击展开详解、AI 问答、练习测验。

## 功能

- 📂 **文件上传**:支持 `.pptx`、`.pdf`、`.txt`,拖拽或点击上传(单文件 ≤ 20MB)
- 📋 **知识卡片**:AI 自动过滤无关内容,提炼 5-10 个核心知识点
- 🔍 **详细解释**:点击任意卡片,AI 展开深度讲解
- 💬 **AI 问答**:基于课件内容的多轮对话
- ✏️ **练习测验**:自动生成单选题/判断题,点击即时批改
- 💾 **会话持久化**:刷新页面后自动恢复上次的卡片和课件内容

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

编辑 `.env.local`,填入你的 Claude API Key:

```
ANTHROPIC_API_KEY=sk-ant-api03-你的key
```

> 在 [console.anthropic.com](https://console.anthropic.com) 注册并创建 API Key

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 4. 类型检查 / Lint

```bash
npm run typecheck
npm run lint
```

### 5. 部署到 Vercel(可选)

```bash
npm install -g vercel
vercel
```

在 Vercel 控制台的 Environment Variables 中添加 `ANTHROPIC_API_KEY`。

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── extract/route.ts   # 提炼知识点 API
│   │   ├── chat/route.ts      # AI 问答 / 详解 API
│   │   └── quiz/route.ts      # 生成练习题 API
│   ├── page.tsx               # 主页面
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── UploadZone.tsx         # 文件上传区域
│   ├── KnowledgeCards.tsx     # 知识卡片网格
│   ├── DetailPanel.tsx        # 知识点详解弹层
│   ├── QATab.tsx              # AI 问答
│   └── QuizTab.tsx            # 练习测验
└── lib/
    ├── claude.ts              # Claude SDK 封装(服务端)+ JSON 鲁棒解析
    ├── parser.ts              # 文件解析(PPTX / PDF / TXT)+ 文件校验
    ├── api-client.ts          # 前端 API 调用封装
    ├── constants.ts           # 集中管理的常量
    └── errors.ts              # 统一错误处理
```

## 0.2.0 改动概要

- 修复 `package.json` 中错误的 `anthropic` 包名 → 正确的 `@anthropic-ai/sdk`
- API key 缺失时给出明确报错,不再静默失败
- 所有 API 路由加入 Zod 输入/输出校验
- LLM 输出 JSON 解析容错(自动剥离 markdown 围栏、截取首尾大括号)
- 详情面板使用 `AbortController` 修复切换知识点时的竞态条件
- 用 inline 错误条替代 `alert()`,体验更好
- localStorage 持久化:刷新不丢卡片
- 文件上传大小限制 20MB
- 测验进度统计:已答 N/M · 正确 X
- 全面消除 `any` 类型,补齐 ARIA 属性
- 顶层封装 `api-client.ts`,前端调用更整洁

## 注意事项

- **扫描件 PDF**(拍照转的 PDF)无法解析,需先用 OCR 工具处理
- 文件内容截取前 12000 字符发送给 AI,超长文件建议分章节上传
- 如果 AI 偶尔返回非 JSON 格式,系统会尝试自动修复,无需手动处理
