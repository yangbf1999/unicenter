[English](README.md) | 简体中文

<p align="center">
  <img src="docs/logo.png" alt="UniCenter" width="360">
</p>

<p align="center">
  <strong>UniCenter</strong><br>
  面向 eSage UniSphere 与 eSage Backup Server 的 Web 管理控制面
</p>

<p align="center">
  <a href="LICENSE">AGPL-3.0</a>
  ·
  <a href="https://github.com/yangbf1999/unicenter">GitHub 仓库</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/eSage-8.x%20%7C%209.x-E57000" alt="eSage 8.x 或 9.x">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="AGPL-3.0"></a>
</p>


UniCenter 把多个 eSage 集群放进同一个 Web 控制台，用来查看库存与拓扑、打开客户机控制台、查看备份，并管理用户、角色和审计。本仓库公开的是 **Community Edition** 源码。

| 名称 | 在本仓库中的含义 |
| --- | --- |
| UniCenter | 产品名。关于页、版本信息和根目录许可证都使用这个名称 |
| eSage UniSphere | 被管理的虚拟化平台，默认 API 端口 8006 |
| eSage Backup Server | 被管理的备份平台，默认 API 端口 8007 |
| 公开代码仓库 | [github.com/yangbf1999/unicenter](https://github.com/yangbf1999/unicenter) |
| UniSphere ISO | 随 UniCenter 社区版发布，官方地址确认后补充 |
| 预构建镜像地址 | `ghcr.io/yangbf1999/unicenter-frontend` |
| `unicenter` | `frontend/package.json` 的 npm 包名。该包标记为 `private`，不发布到 npm |
| `/opt/unicenter` | 安装脚本使用的安装目录 |

本仓库使用 [GNU AGPL-3.0-or-later](LICENSE) 发布。版权主体将在公开发布前补充确认。

## 本仓库包含的内容

- `frontend/`：Next.js 16、React 19 控制面，含页面、BFF/API、Prisma 和浏览器控制台
- `docker-compose.yml`：从本仓库构建的源码部署栈，包含前端和 PostgreSQL
- `docker-compose.community.yml`：拉取预构建社区版镜像的发行栈
- `deploy.sh`：源码部署入口
- `install-community.sh`：社区版预构建安装脚本

当前 v1.0 只发布可独立运行和验证的 Community 部署。源码中可能保留未来扩展所需的页面、接口类型和功能门禁，但企业编排器、控制面高可用和 PDF 报告服务尚未形成可交付实现，不属于本版本支持范围，也不提供对应安装入口。

## 源码部署

源码部署使用仓库根目录的 `docker-compose.yml`，对外端口是 **3001**。社区版预构建安装使用 `docker-compose.community.yml`，对外端口是 **3000**。

支持的部署主机是 Linux，以及启用了 Docker Desktop WSL 集成的 Windows WSL2。请在 WSL 文件系统中执行脚本，例如 `cd /mnt/d/work/unicenter && ./deploy.sh`。原生 Windows 命令提示符、PowerShell 和 Git Bash 不能作为部署环境。

```bash
./deploy.sh                         # 构建并启动
./deploy.sh redeploy                # 重建前端，保留已有 PostgreSQL
./deploy.sh redeploy --no-cache     # 不使用 Docker 层缓存
./deploy.sh status
./deploy.sh --help
```

首次运行会把 `.env.example` 复制为 Git 忽略的 `.env`，写入本地随机密钥，构建 `frontend/Dockerfile`，并等待容器与宿主机健康检查。已有密钥和数据卷会保留。`DEPLOY_PUBLIC_URL` 会更新已有 `.env` 中的 `NEXTAUTH_URL` 和 `APP_URL`。

```bash
DEPLOY_PUBLIC_URL=https://unicenter.example.com ./deploy.sh redeploy
```

`deploy.sh` 接受根目录 `docker-compose.yml`，或符合同一份 `frontend` + `postgres` 约定的自定义 Compose 文件。它拒绝 `docker-compose.community.yml`，该文件属于 Community 预构建发行安装流程。

就绪后打开 `http://<主机>:3001`，创建第一个管理员。反向代理后面的部署，在连接设置中打开 “Behind reverse proxy”，避免故障切换改用节点内网地址。

## 预构建安装

社区版预构建安装：

```bash
curl -fsSL \
  https://raw.githubusercontent.com/yangbf1999/unicenter/v1.0.0/install-community.sh \
  | sudo bash
```

安装程序固定下载 Git 标签 `v1.0.0` 的 Compose，并使用固定版本镜像，避免 `main` 与 `latest` 变化造成不可重复部署。安装程序准备 Docker、Compose、PostgreSQL，以及 `/opt/unicenter` 下的持久化目录。完成后打开 `http://<主机>:3000`。

发布候选验证可以通过 `UNICENTER_RELEASE_REF`、`UNICENTER_COMPOSE_URL`、`UNICENTER_IMAGE` 和 `UNICENTER_INSTALL_DIR` 覆盖来源；正式安装应继续使用固定 Git 标签和固定镜像版本。

当前版本不提供 Enterprise 或 HA 后端。UniSphere ISO 是底层平台的社区发行配套物，和 UniCenter 一起从官方发布地址下载，不属于 Enterprise 专属内容。官方 ISO 下载地址确认后，将在本节和发行说明中补充。

## 从源码直接运行

不使用 Docker 时，只覆盖社区版控制面。Node.js 版本以 `frontend/.nvmrc` 为准，另需 PostgreSQL 16 或更高版本和一个空数据库。构建大约需要 4 GB 内存，运行大约 300 MB。

```bash
VERSION=vX.Y.Z
mkdir -p /opt/unicenter && cd /opt/unicenter
curl -fsSL https://github.com/yangbf1999/unicenter/archive/refs/tags/$VERSION.tar.gz | tar xz --strip-components=1
cd frontend

npm ci --legacy-peer-deps --ignore-scripts
npm run build:icons
npx prisma generate
UNICENTER_SKIP_TYPECHECK=1 npm run build
```

`UNICENTER_SKIP_TYPECHECK=1` 跳过 `next build` 的 TypeScript 检查。该检查在编译器之外大约还需要 3 GB 堆内存，已发布标签上的 CI 已经执行过。修改源码后自行构建时请保留类型检查，并准备约 8 GB 内存和 `NODE_OPTIONS=--max-old-space-size=4096`。

环境文件示例 `/opt/unicenter_data/.env`，仅 root 可读：

```bash
NODE_ENV=production
DATABASE_URL=postgresql://unicenter:PASSWORD@localhost:5432/unicenter?schema=public
APP_SECRET=...        # openssl rand -base64 32
NEXTAUTH_SECRET=...   # openssl rand -base64 32
NEXTAUTH_URL=http://your-server:3000
APP_URL=http://your-server:3000
```

在 `frontend` 目录执行：

```bash
set -a && . /opt/unicenter_data/.env && set +a
npx prisma migrate deploy
npx prisma db seed
node start.js           # 监听 0.0.0.0:3000，可用 PORT 和 HOSTNAME 覆盖
```

用服务管理器运行 `node start.js`，例如 systemd 的 `WorkingDirectory=/opt/unicenter/frontend`、`EnvironmentFile=/opt/unicenter_data/.env`。升级时拉取新标签、重新构建、执行 `npx prisma migrate deploy` 并重启服务。种子数据可以重复执行。

## 升级预构建栈

```bash
cd /opt/unicenter
docker compose pull
docker compose up -d
```

数据库迁移在启动时执行。

v1.3.x 及更早版本使用 SQLite。v1.4.0 起只支持 PostgreSQL，没有就地迁移。

## 运行要求

- Linux，Docker Engine 24+，Docker Compose v2
- openEuler 22.03 可作为 Docker 宿主机，但必须预先安装 Docker Engine 24+ 和 Docker Compose v2；安装脚本不负责在 openEuler 上自动安装或升级 Docker
- 最低 2 GB 内存、10 GB 磁盘；数据库增长需要更多空间
- 入站端口：源码部署 3001，预构建社区版 3000
- 出站访问 eSage UniSphere 8006 和 eSage Backup Server 8007
- eSage UniSphere 8.x 或 9.x

## 界面资源

Logo 文件是 `docs/logo.png` 和 `docs/logo-dark.png`，应用图标是 `frontend/public/images/unicenter-icon.png`。产品截图在发布前会经过演示数据和敏感信息检查，再由公开文档站提供。

## 安全

当前自动化检查包括 Lint/ESLint 工作流。安全报告入口将在公开发布前补充；不要通过公开 Issue 披露漏洞。处理范围见 [SECURITY.md](SECURITY.md)。

## 许可证

- **Community Edition**：GNU Affero General Public License v3.0。全文见 [LICENSE](LICENSE)。版权主体待确认。通过网络运行修改版时，需要向该服务的用户提供对应源码。
`frontend/package.json` 使用 SPDX 标识 `AGPL-3.0-or-later`；`"private": true` 仅表示该包不发布到 npm registry，不改变源码许可证。

## 品牌与底层兼容

公开界面、文档、安装包和截图统一使用 UniCenter、UniSphere 与 eSage 品牌资源。底层 API 路径、协议字段和平台原生命令在兼容性需要时保持原值，不作为用户界面品牌展示。展示第三方资源前，需要确认相应授权。

## 支持与参与

- 社区问题：[GitHub Issues](https://github.com/yangbf1999/unicenter/issues)
- 使用问题：[GitHub Discussions](https://github.com/yangbf1999/unicenter/discussions)
- 项目联系：[huangxin@esage.cn](mailto:huangxin@esage.cn)
- 外部文档站：待确认

架构说明见 [architecture.md](architecture.md)，公开文档入口见 [docs/index.md](docs/index.md)，贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。
