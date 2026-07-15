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
- `NEXT_PUBLIC_RESUME_URL`、`NEXT_PUBLIC_PROJECT_URL`、`NEXT_PUBLIC_CONTACT_URL`：公开转化入口。未配置时不会展示虚假链接。

## 验证

```bash
npm test
npm run lint
npm run build
```

PRD 验收与完整评测设计见 `tests/prd-evaluation-draft.md`。

## 当前数据边界

仓库目前只包含 PRD 已确认的候选人定位与 Ask Me 项目信息。教育、任职、其他项目、简历和联系方式未被提供，因此不会被模型推测或写入公开知识库。补齐真实资料并完成 Claim-Source 人工校验后，才能通过正式上线门槛。
