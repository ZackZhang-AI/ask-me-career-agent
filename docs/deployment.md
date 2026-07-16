# Vercel 部署与上线检查

本文描述 Ask Me 从 Pull Request Preview 到 Production 的标准流程。部署动作需要仓库与 Vercel 管理权限；在权限、资源或密钥未准备好时，不得把本地验证描述为线上已完成。

## 1. 前置资源

在 Vercel 中连接 GitHub 仓库，并准备以下外部资源：

- DeepSeek API：只使用轮换后的密钥。此前出现在对话或日志中的密钥一律撤销，不能复用。
- Upstash Redis：用于跨实例分钟限流、会话次数和每日请求/Token 预算。
- Neon Postgres：用于匿名漏斗事件。首次写入或清理时会自动创建 `ask_me_events` 表及索引，无需手工迁移。
- Vercel Blob：通过本地上传脚本固定覆盖 `resume/latest.pdf`；脚本输出 Blob URL，但不会修改 Vercel 环境变量。

## 2. 环境变量

敏感变量只写入 Vercel Environment Variables，不提交 `.env` 文件。Preview 和 Production 使用隔离的 Redis、Neon 与预算；Production 密钥仅对 Production 开放。

| 变量 | 必需 | 默认值 / 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | Production 必需 | 轮换后的服务端密钥 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-flash` |
| `UPSTASH_REDIS_REST_URL` | Production 必需 | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Production 必需 | Upstash REST Token |
| `PRIVACY_HASH_SALT` | Production 必需 | 至少 32 位随机值，用于 IP 单向哈希 |
| `RATE_LIMIT_PER_MINUTE` | 否 | `5` |
| `SESSION_QUESTION_LIMIT` | 否 | `20` |
| `DAILY_REQUEST_LIMIT` | 否 | `200` |
| `DAILY_TOKEN_LIMIT` | 否 | `300000` |
| `TOKEN_RESERVATION` | 否 | `1500`，请求前预留的 Token 预算 |
| `DATABASE_URL` | Production 必需 | Neon 连接字符串 |
| `RESUME_BLOB_READ_WRITE_TOKEN` | 上传时必需 | 只用于本地简历上传，不暴露给浏览器 |
| `RESUME_BLOB_URL` | Production 必需 | 上传脚本输出的 HTTPS URL；手动同步至 Vercel |
| `CRON_SECRET` | Production 必需 | 保护 `/api/cron/events` |
| `CHAT_DISABLED` | 否 | 紧急停用模型问答时设为 `true` |

生成盐值或 Cron 密钥时使用密码管理器或系统安全随机源。不要把实际值写入工单、截图、聊天记录或部署文档。

## 3. Preview 到 Production

1. 从功能分支创建 Pull Request，等待 GitHub Actions 的测试、Lint、构建、密钥扫描、浏览器 Bundle 扫描和公开来源检查全部通过。
2. 打开 Vercel Preview，验证首页、移动端、核心 20 题、未知拒答、引用展开和全部外链。Preview 不应使用 Production 数据库或高预算密钥。
3. 用有效 PDF 运行仓库提供的简历上传脚本，将输出 URL 写入 Preview 的 `RESUME_BLOB_URL`，确认 `GET /resume` 返回 `307`；未配置时应返回 `404`。
4. 检查事件接口始终返回 `204`，且 `page_viewed`、`summary_viewed`、`question_sent`、`answer_completed`、二轮提问及各类点击能异步进入 Neon。事件写入失败不得阻塞主流程。
5. 检查 Redis：同一 IP 每分钟第 6 次模型请求被限流、单会话第 21 题被拒绝、每日请求或 Token 预算耗尽时返回明确状态。数据库仅出现加盐哈希，不得出现原始 IP、邮箱或手机号。
6. 检查 `GET /api/cron/events`：无 Bearer 密钥时拒绝，使用 `Authorization: Bearer ${CRON_SECRET}` 时清理 30 天前事件。Vercel Cron 每日 UTC 03:00 调用一次。
7. 合并 Pull Request，由 Vercel 生成 Production 部署；不要绕过失败的 CI 直接提升 Preview。
8. Production 冒烟测试通过后再公开仓库与域名；若问答异常，先将 `CHAT_DISABLED=true`，保留静态资料和项目证据入口。

## 4. 上线验收与回滚

必须逐项记录 URL、时间和结果：

- `npm test`、`npm run lint`、`npm run build` 全部通过；核心检索与引用定位率为 100%。
- 桌面与 390px 移动端无横向溢出，首屏可交互与首字响应均不超过 3 秒。
- `/resume`、GitHub、来源、邮箱和电话入口可用；联系方式不进入模型上下文或匿名事件详情。
- 401、429、预算耗尽、上游超时和流中断均显示稳定、可理解的状态。
- Neon、Upstash、Blob 和 Cron 均在 Production 真实验证，日志中无密钥、原始 IP 或联系方式。

出现严重事实错误、隐私泄露、密钥暴露或预算失控时立即关闭聊天、轮换受影响密钥并回滚至上一稳定部署。修复后必须重新走完整 CI 与 Preview 验收，不在 Production 直接试错。
