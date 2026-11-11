# Contributing to UniCenter

感谢参与 UniCenter。提交代码前，请先搜索现有 Issue；较大的功能或行为变更建议先创建 Issue 说明目标、兼容性和部署影响。

## 开发环境

- Node.js 版本以 `frontend/.nvmrc` 为准。
- 在 `frontend/` 目录执行 `npm ci --legacy-peer-deps` 安装依赖。
- 本地配置写入 Git 忽略的 `.env` 或 `frontend/.env.local`，不要提交真实账号、Token、私钥、证书、内网地址或客户数据。

## 验证

根据改动范围在 `frontend/` 下执行：

```bash
npm run lint
npm run build
npm test
npm run test:scripts
```

需要 PostgreSQL 的测试还需设置 `POSTGRES_TEST_URL_BASE`。部署脚本变更应检查源码部署和 Community 预构建 Compose 的兼容性。尚未交付的 Enterprise、HA 和外部编排器不在当前版本的贡献范围内。

## 提交要求

- 一个提交聚焦一个目的，说明行为变化和验证结果。
- 新增或修改源码必须遵守本仓库的 `AGPL-3.0-or-later` 许可证。
- 不要提交内部需求、评审记录、现场交付资料、构建制品或未经脱敏的截图。
- 第三方代码或资源必须保留其许可证和版权声明，并确认与 AGPL 分发兼容。

提交 Pull Request 即表示你有权贡献该内容，并同意按本仓库许可证发布该贡献。
