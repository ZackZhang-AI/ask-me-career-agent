# Obsidian 知识同步

Ask Me 不在线连接私人 Vault。同步只在本地执行，并且遵循“只读扫描、风险阻断、人工审核、显式发布”四个阶段。

## 同步范围

首批默认只扫描两个明确白名单文件：

- `02-知识库/项目/企业级RAG知识库问答系统.md`
- `02-知识库/项目/DeepFlow.md`

新增来源时必须在 `config/obsidian-sync.json` 逐文件加入。`01-原始资料`、`90-系统`、Obsidian 配置、隐藏目录和百度相关页面不进入候选集。

## 本地同步

在 `.env.local` 设置 `OBSIDIAN_VAULT_PATH`，然后执行：

```bash
npm run knowledge:sync
```

也可以显式传入路径：

```bash
npm run knowledge:sync -- --vault "C:\path\to\Obsidian Vault"
```

审核报告默认写入 `output/obsidian-review.json`。`output/` 已被 Git 忽略，报告不得提交或部署。

## 审核与发布

每个候选项有稳定 `candidateId`、Vault 相对路径、文档 SHA-256、证据类型和风险标记。

1. 只审核 `publicationStatus=review_required` 的项目。
2. 确认个人贡献、数字、项目状态和证据边界。
3. 为候选项关联已有 Claim 与 Source，或先新增经确认的 Claim/Source。
4. 将完整的公开 `KnowledgeItem` 写入 `content/obsidian-approved.json`，并保留不含 Vault 路径的 `provenance`。
5. 运行测试、Lint 和构建后才能发布。

候选内容、源文档或文档 SHA 变化后，下次同步会标记已批准条目过期。存在过期批准、重复批准、无对应候选项的批准，或已批准项目被安全策略阻断时，`npm run knowledge:sync` 会以非零状态退出。发布前必须先通过该门禁。

`--output` 和 `OBSIDIAN_SYNC_OUTPUT` 只允许指向当前 Ask Me 仓库 `output/` 根目录下的 JSON 文件，不得指向 Vault、`content/`、配置或其他已跟踪文件。

## 强制阻断

以下内容只记录风险和内容哈希，审核报告不复制原文：

- 邮箱、手机号、微信、身份证号。
- API Key、Token、密码和私钥。
- 客户名称、底稿、企业机密和未公开数据。
- Prompt Injection 或诱导系统泄露的指令。
- 百度经历和依赖该经历才能成立的表述。
- 未经用户确认的 Codex 推断。
