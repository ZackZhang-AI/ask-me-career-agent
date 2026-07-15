# Ask Me

张倬玮的 AI Career Agent。它面向 AI 产品招聘经理和业务面试官，通过静态摘要、可追问对话、事实来源与能力边界，帮助招聘方快速获得可验证的候选人信息。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

未配置 `DEEPSEEK_API_KEY` 时，产品自动使用本地公开知识库的演示回答。配置后，`/api/chat` 会在服务端调用 DeepSeek，密钥不会进入浏览器。

## 环境变量

- `DEEPSEEK_API_KEY`：DeepSeek 服务端密钥。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-flash`。
- `CHAT_DISABLED`：紧急关闭模型问答。
- `DAILY_REQUEST_LIMIT`：单实例每日请求上限。

公开 GitHub、邮箱和电话统一维护在 `lib/profile.ts`，与模型知识库隔离。简历仍在持续更新，页面通过邮件入口获取最新版，不托管过期文件。

## 验证

```bash
npm test
npm run lint
npm run build
```

PRD 验收与完整评测设计见 `tests/prd-evaluation-draft.md`。

## 当前数据边界

知识库已纳入候选人授权公开的教育、技能、审计经历和项目资料，并用 GitHub 仓库验证公开项目存在。GitHub 不能单独证明个人贡献比例、生产规模或业务效果，这些内容仍标记为待面试核实。联系方式独立于模型上下文，不进入检索和问题日志。
