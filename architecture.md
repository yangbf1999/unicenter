# UniCenter 架构

UniCenter 是面向 eSage UniSphere 与 eSage Backup Server 的管理控制面。本仓库当前包含 Community Edition 的 Web 控制面和部署文件。

本仓库源码由根目录 `LICENSE`（GNU AGPL-3.0-or-later）授权。

## 组件

- `frontend/`：Next.js 16、React 19 和 TypeScript/JavaScript 应用。Prisma 访问 PostgreSQL，浏览器侧包含 WebSocket、noVNC 和 SPICE。
- `frontend/src/app/`：路由与页面。`components/`、`views/`、`hooks/`、`lib/` 承载页面、交互和领域逻辑。
- `frontend/prisma/`：数据库 schema 与迁移。
- `frontend/server/`、`frontend/scripts/`：服务端辅助、启动和构建脚本。
- 根目录 `docker-compose.yml`：源码部署，构建本地前端镜像并附带 PostgreSQL，宿主机端口 3001。
- `docker-compose.community.yml`：预构建社区版，宿主机端口 3000，默认使用 `ghcr.io/yangbf1999/unicenter-frontend` 的固定版本镜像，可通过 `UNICENTER_IMAGE` 覆盖。
- `nginx/`：可选的反向代理配置。

## 运行关系

```text
用户
  |
  v
UniCenter Web :3001（源码部署）或 :3000（预构建社区版）
  Next.js + API + WebSocket
  |
  +------------------+---------------------------+
  |                  |                           |
  v                  v                           v
PostgreSQL      eSage UniSphere :8006      eSage Backup Server :8007
```

Web 进程同时提供 HTTP 和 WebSocket。PostgreSQL 是控制面的持久化数据源，schema 迁移在启动时执行。对 eSage 和迁移来源的访问由控制面向外发起，被管理主机上不部署 UniCenter agent。

当前 v1.0 只提供单控制面 Community 部署。源码中保留的未来扩展页面、接口类型和功能门禁不代表相应企业后端已经交付。

## 标识

| 用途 | 当前值 |
| --- | --- |
| 产品名 | UniCenter |
| GitHub 仓库 | `yangbf1999/unicenter` |
| GHCR organization | `yangbf1999` |
| SonarCloud project key | 待配置 |
| 安装目录 | `/opt/unicenter` |
| npm 包名 | `unicenter`（`private`，不发布到 npm） |

版本检查绑定到 `yangbf1999/unicenter`，通过 GitHub Releases 查询最新版本。

## 品牌与底层兼容

公开界面和文档使用 UniCenter、UniSphere 与 eSage 品牌资源。底层 API 路径、协议字段和平台原生命令在兼容性需要时保持原值，不作为用户界面品牌展示。UniSphere ISO 随社区版发行说明提供官方下载地址。

## 公开文档

项目介绍见 `README.md`，文档入口见 `docs/index.md`，安全问题报告方式见 `SECURITY.md`。需求、评审、测试证据和现场交付资料不属于公开源码发布内容。
