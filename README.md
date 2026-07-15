# Ask Me

张倬玮的 AI Career Agent。它面向 AI 产品招聘经理和业务面试官，通过静态摘要、可追问对话、事实来源与能力边界，帮助招聘方快速获得可验证的候选人信息。

在线演示：[ask-me-career-agent.vercel.app](https://ask-me-career-agent.vercel.app)。当前未配置生产 DeepSeek 密钥与最新版简历，仅用于验证公开内容、稳定问答和界面流程。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

未配置 `DEEPSEEK_API_KEY` 时，产品自动使用本地公开知识库的演示回答。配置后，`/api/chat` 会在服务端调用 DeepSeek，密钥不会进入浏览器。

内容统一维护在 `content/`，启动和构建时由 Zod 校验状态、可见性以及 Claim-Source 引用完整性。未确认 STAR 保持 `private + draft + unverified`，不会进入公开检索。

## 环境变量

- `DEEPSEEK_API_KEY`：DeepSeek 服务端密钥。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-flash`。
- `CHAT_DISABLED`：紧急关闭模型问答。
- `DAILY_REQUEST_LIMIT`、`DAILY_TOKEN_LIMIT`：每日请求与 Token 预算。
- `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`：跨实例限流。
- `DATABASE_URL`：Neon 匿名事件存储。
- `RESUME_BLOB_URL`：最新版 PDF 地址，站内入口固定为 `/resume`。

完整变量说明见 `.env.example`。公开 GitHub、邮箱和电话统一维护在 `lib/profile.ts`，与模型知识库隔离。

## 更新简历

将 Vercel Blob Token 写入 `.env.local` 后运行：

```bash
npm run upload:resume -- "C:\path\to\resume.pdf"
```

把命令输出的 URL 同步到 Vercel `RESUME_BLOB_URL`；页面 `/resume` 地址无需改变，旧 PDF 不进入 Git 历史。

## 验证

```bash
npm test
npm run lint
npm run build
```

PRD 验收与完整评测设计见 `tests/prd-evaluation-draft.md`。

Vercel、Upstash、Neon、Blob、Cron 和 Preview 到 Production 流程见 `docs/deployment.md`；5 人软测试记录见 `docs/soft-launch-test.md`。

## 当前数据边界

知识库已纳入候选人授权公开的教育、技能、审计经历和项目资料，并用 GitHub 仓库验证公开项目存在。GitHub 不能单独证明个人贡献比例、生产规模或业务效果，这些内容仍标记为待面试核实。联系方式独立于模型上下文，不进入检索和问题日志。

当前 8 个 STAR 是待本人逐条确认的私有草稿。真人软测试、Vercel 托管资源验证和生产发布必须真实执行，不以本地测试代替。
