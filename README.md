English | [简体中文](README.zh-CN.md)

<p align="center">
  <img src="docs/logo.png" alt="UniCenter" width="360">
</p>

<p align="center">
  <strong>UniCenter</strong><br>
  Web management control plane for eSage UniSphere and eSage Backup Server
</p>

<p align="center">
  <a href="LICENSE">AGPL-3.0</a>
  ·
  <a href="https://github.com/yangbf1999/unicenter">GitHub repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/eSage-8.x%20%7C%209.x-E57000" alt="eSage 8.x or 9.x">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="AGPL-3.0"></a>
</p>


UniCenter brings multiple eSage clusters into one web console. It provides inventory and topology views, guest consoles, backup management, user and role management, and audit information. This repository contains the **Community Edition** source code.

| Name | Meaning in this repository |
| --- | --- |
| UniCenter | Product name used by the About page, version information, and repository license materials |
| eSage UniSphere | Managed virtualization platform; default API port 8006 |
| eSage Backup Server | Managed backup platform; default API port 8007 |
| Public source repository | [github.com/yangbf1999/unicenter](https://github.com/yangbf1999/unicenter) |
| UniSphere ISO | Community platform companion, downloaded from the official release address |
| Prebuilt image | `ghcr.io/yangbf1999/unicenter-frontend` |
| `unicenter` | npm package name in `frontend/package.json`; the package is private and is not published to npm |
| `/opt/unicenter` | Installation directory used by the installer |

This repository is released under the [GNU AGPL-3.0-or-later](LICENSE). The copyright holder will be added before the public release.

## Included in this repository

- `frontend/`: Next.js 16 and React 19 control plane, including pages, BFF/API routes, Prisma, and browser consoles
- `docker-compose.yml`: source deployment stack that builds the frontend and includes PostgreSQL
- `docker-compose.community.yml`: distribution stack that pulls the prebuilt Community image
- `deploy.sh`: source deployment entry point
- `install-community.sh`: prebuilt Community installation script

Version 1.0 provides an independently deployable and verifiable Community deployment. The source may retain pages, interface types, and feature gates needed for future extensions, but the Enterprise orchestrator, control-plane high availability, and PDF reporting services are not delivered or supported in this version and have no installation entry points.

## Quick deployment from source

Source deployment uses the root `docker-compose.yml` and exposes port **3001**. Prebuilt Community deployment uses `docker-compose.community.yml` and exposes port **3000**.

Supported hosts are Linux and Windows WSL2 with Docker Desktop WSL integration. Run the scripts from the WSL filesystem, for example `cd /mnt/d/work/unicenter && ./deploy.sh`. Native Windows Command Prompt, PowerShell, and Git Bash are not deployment environments.

```bash
./deploy.sh                         # build and start
./deploy.sh redeploy                # rebuild the frontend and keep PostgreSQL
./deploy.sh redeploy --no-cache     # rebuild without Docker layer cache
./deploy.sh status
./deploy.sh --help
```

On the first run, the script copies `.env.example` to the Git-ignored `.env`, generates local random secrets, builds `frontend/Dockerfile`, and waits for container and host health checks. Existing secrets and data volumes are preserved. `DEPLOY_PUBLIC_URL` updates `NEXTAUTH_URL` and `APP_URL` in an existing `.env`.

```bash
DEPLOY_PUBLIC_URL=https://unicenter.example.com ./deploy.sh redeploy
```

`deploy.sh` accepts the root `docker-compose.yml`, or a custom Compose file following the same `frontend` + `postgres` contract. It rejects `docker-compose.community.yml`, which belongs to the prebuilt Community installation flow.

When the stack is ready, open `http://<host>:3001` and create the first administrator. For deployments behind a reverse proxy, enable **Behind reverse proxy** in connection settings so failover does not switch to a node's private address.

## Prebuilt Community installation

```bash
curl -fsSL \
  https://raw.githubusercontent.com/yangbf1999/unicenter/v1.0.0/install-community.sh \
  | sudo bash
```

The installer downloads the Compose file from the immutable `v1.0.0` Git tag and uses a fixed image version. This avoids the non-reproducible changes that can come from `main` or `latest`. It prepares Docker, Compose, PostgreSQL, and persistent data under `/opt/unicenter`. When installation finishes, open `http://<host>:3000`.

Release-candidate verification can override the source with `UNICENTER_RELEASE_REF`, `UNICENTER_COMPOSE_URL`, `UNICENTER_IMAGE`, and `UNICENTER_INSTALL_DIR`. Official installations should continue to use a fixed Git tag and fixed image version.

This version does not provide an Enterprise or HA backend. The UniSphere ISO is a Community platform companion and is downloaded from its official release address together with UniCenter; it is not Enterprise-only content. The official ISO download address will be added to this section and the release notes when confirmed.

## Run directly from source

Running without Docker covers only the Community control plane. Use the Node.js version in `frontend/.nvmrc`, PostgreSQL 16 or newer, and an empty database. A production build needs about 4 GB of memory and the running service uses about 300 MB.

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

`UNICENTER_SKIP_TYPECHECK=1` skips the TypeScript check performed by `next build`. The check needs about 3 GB of additional heap beyond the compiler and is already run by CI for release tags. Keep type checking enabled when building modified source and prepare about 8 GB of memory with `NODE_OPTIONS=--max-old-space-size=4096`.

Example environment file at `/opt/unicenter_data/.env` (root-readable only):

```bash
NODE_ENV=production
DATABASE_URL=postgresql://unicenter:PASSWORD@localhost:5432/unicenter?schema=public
APP_SECRET=...        # openssl rand -base64 32
NEXTAUTH_SECRET=...   # openssl rand -base64 32
NEXTAUTH_URL=http://your-server:3000
APP_URL=http://your-server:3000
```

From the `frontend` directory:

```bash
set -a && . /opt/unicenter_data/.env && set +a
npx prisma migrate deploy
npx prisma db seed
node start.js           # listens on 0.0.0.0:3000; PORT and HOSTNAME can override it
```

Run `node start.js` under a service manager, for example with systemd using `WorkingDirectory=/opt/unicenter/frontend` and `EnvironmentFile=/opt/unicenter_data/.env`. To upgrade, pull a new tag, rebuild, run `npx prisma migrate deploy`, and restart the service. The seed can be run repeatedly.

## Upgrade the prebuilt stack

```bash
cd /opt/unicenter
docker compose pull
docker compose up -d
```

Database migrations run during startup.

Versions v1.3.x and earlier used SQLite. Version v1.4.0 and later support PostgreSQL only and do not provide in-place migration from SQLite.

## Requirements

- Linux, Docker Engine 24+, and Docker Compose v2
- openEuler 22.03 can be used as a Docker host, but Docker Engine 24+ and Docker Compose v2 must be installed first; the installer does not install or upgrade Docker on openEuler
- At least 2 GB RAM and 10 GB disk; database growth requires more space
- Inbound port 3001 for source deployment or 3000 for prebuilt Community deployment
- Outbound access to eSage UniSphere on port 8006 and eSage Backup Server on port 8007
- eSage UniSphere 8.x or 9.x

## Branding assets

The repository logo files are `docs/logo.png` and `docs/logo-dark.png`. The application icon is `frontend/public/images/unicenter-icon.png`. Screenshots are checked for demo data and sensitive information before they are published in the public documentation site.

## Security

Automated checks currently include the Lint/ESLint workflow. The security reporting channel will be completed before public release; do not disclose vulnerabilities through public Issues. See [SECURITY.md](SECURITY.md) for the handling scope.

## License

- **Community Edition**: GNU Affero General Public License v3.0. See [LICENSE](LICENSE). The copyright holder will be added before public release. When you run a modified version over a network, you must provide the corresponding source to the users of that service.

`frontend/package.json` uses the SPDX identifier `AGPL-3.0-or-later`. The `"private": true` setting only prevents publishing the package to the npm registry; it does not change the source license.

## Branding and platform compatibility

Public interfaces, documentation, installation packages, and screenshots use the UniCenter, UniSphere, and eSage brand resources. Platform API paths, protocol fields, and native commands retain their original values where compatibility requires them and are not presented as product branding. Confirm the applicable license before publishing third-party resources.

## Support and contribution

- Community issues: [GitHub Issues](https://github.com/yangbf1999/unicenter/issues)
- Usage questions: [GitHub Discussions](https://github.com/yangbf1999/unicenter/discussions)
- Project contact: [huangxin@esage.cn](mailto:huangxin@esage.cn)
- External documentation site: pending

See [architecture.md](architecture.md) for the architecture, [docs/index.md](docs/index.md) for the public documentation index, and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
