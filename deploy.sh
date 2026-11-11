#!/usr/bin/env bash

# UniCenter 本地源码一键构建与部署脚本
#
# 用法:
#   ./deploy.sh                  # 生成配置（首次运行）+ 构建前端镜像 + 启动服务
#   ./deploy.sh --no-cache       # 不使用 Docker 构建缓存并启动服务
#   ./deploy.sh redeploy         # 重新构建镜像并强制重建 frontend 容器
#   ./deploy.sh build            # 仅构建 frontend/Dockerfile
#   ./deploy.sh up               # 使用现有镜像启动服务
#   ./deploy.sh down             # 停止服务（不删除数据卷）
#   ./deploy.sh restart          # 重启 frontend 服务
#   ./deploy.sh logs             # 跟随全部服务日志
#   ./deploy.sh status           # 查看服务状态
#
# 本脚本使用根目录 docker-compose.yml：前端镜像从 ./frontend 构建，
# PostgreSQL 使用 Compose 管理的数据卷。首次运行从 .env.example 初始化 .env。
# 公开访问地址默认按浏览器 Host 动态识别（AUTH_TRUST_HOST）；需要固定回调
# 地址（OIDC 等）时用 DEPLOY_PUBLIC_URL 写入 NEXTAUTH_URL/APP_URL。

# `sh deploy.sh` ignores the shebang. Re-enter with Bash before using Bash-only
# features so the three common invocation forms behave consistently.
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
    printf '%s\n' '[error] deploy.sh requires Bash, but bash was not found' >&2
    exit 1
fi

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE_PATH="${DEPLOY_COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.yml}"
DEPLOY_PROJECT_NAME="${DEPLOY_COMPOSE_PROJECT:-unicenter-esage}"
DOCKERFILE_PATH="$SCRIPT_DIR/frontend/Dockerfile"
BUILD_CONTEXT="$SCRIPT_DIR/frontend"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_FILE="${DEPLOY_ENV_FILE:-$ENV_FILE}"
ENV_EXAMPLE_FILE="${DEPLOY_ENV_EXAMPLE_FILE:-$SCRIPT_DIR/.env.example}"
IMAGE_NAME="${DEPLOY_IMAGE_NAME:-unicenter-frontend:local}"
export DEPLOY_IMAGE_NAME="$IMAGE_NAME"
SERVICE="${DEPLOY_SERVICE:-frontend}"
POSTGRES_SERVICE="${DEPLOY_POSTGRES_SERVICE:-postgres}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_WAIT_SECS="${HEALTH_WAIT_SECS:-120}"
BUILD_NETWORK="${BUILD_NETWORK:-host}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
TEMP_DOCKERFILE=""
BUILD_DOCKERFILE="$DOCKERFILE_PATH"

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warning]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "未找到命令: $1"
}

check_docker() {
    require_cmd docker
    docker compose version >/dev/null 2>&1 || die "未找到 Docker Compose v2 插件"
    docker info >/dev/null 2>&1 || die "Docker daemon 不可用，请先启动 Docker 服务"
}

compose() {
    local -a args=(-f "$COMPOSE_FILE_PATH" --env-file "$ENV_FILE" -p "$DEPLOY_PROJECT_NAME")
    docker compose "${args[@]}" "$@"
}

cleanup_temp_dockerfile() {
    if [[ -n "$TEMP_DOCKERFILE" ]]; then
        rm -f "$TEMP_DOCKERFILE"
        TEMP_DOCKERFILE=""
    fi
}

trap cleanup_temp_dockerfile EXIT
trap 'cleanup_temp_dockerfile; exit 130' INT
trap 'cleanup_temp_dockerfile; exit 143' TERM

env_has_key() {
    grep -Eq "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE"
}

env_value() {
    local key="$1" value
    value="$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -1)"
    value="${value#\"}"; value="${value%\"}"
    value="${value#\'}"; value="${value%\'}"
    printf '%s' "$value"
}

append_env_if_missing() {
    local key="$1" value="$2"
    if ! env_has_key "$key"; then
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
        log "已补充 .env 中的 $key"
    fi
}

set_env_value() {
    local key="$1" value="$2" temp_file
    temp_file="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
    awk -v key="$key" -v value="$value" '
        BEGIN { replaced = 0 }
        $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
            if (!replaced) print key "=" value
            replaced = 1
            next
        }
        { print }
        END { if (!replaced) print key "=" value }
    ' "$ENV_FILE" > "$temp_file"
    chmod 600 "$temp_file"
    mv "$temp_file" "$ENV_FILE"
}

random_hex() {
    local bytes="$1"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$bytes"
    else
        od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
    fi
}

is_secret_placeholder() {
    case "$1" in
        ""|change-me-please|your-app-secret-change-me|your-nextauth-secret-change-me|your-app-secret-here|your-nextauth-secret-here)
            return 0
            ;;
        *) return 1 ;;
    esac
}

ensure_random_secret() {
    local key="$1" bytes="$2" value
    value="$(env_value "$key")"
    if is_secret_placeholder "$value"; then
        set_env_value "$key" "$(random_hex "$bytes")"
        log "已为 .env 生成 $key"
    fi
}

is_url_placeholder() {
    case "$1" in
        ""|http://localhost:3001|http://127.0.0.1:3001|https://unicenter.example.com)
            return 0
            ;;
        *) return 1 ;;
    esac
}

detect_deploy_host() {
    local host=""
    if command -v ip >/dev/null 2>&1; then
        host="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }')" || true
    fi
    if [[ -z "$host" ]] && command -v hostname >/dev/null 2>&1; then
        host="$(hostname -I 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i !~ /^127\./) { print $i; exit } }')" || true
    fi
    printf '%s' "${host:-127.0.0.1}"
}

default_public_url() {
    printf 'http://%s:3001' "$(detect_deploy_host)"
}

validate_public_url() {
    case "$1" in
        http://*|https://*) return 0 ;;
        *) die "公开访问地址必须以 http:// 或 https:// 开头: $1" ;;
    esac
}

ensure_public_urls() {
    local created="$1" public_url="${DEPLOY_PUBLIC_URL:-}" nextauth_url app_url
    public_url="${public_url%/}"
    [[ -z "$public_url" ]] || validate_public_url "$public_url"

    nextauth_url="$(env_value NEXTAUTH_URL)"
    app_url="$(env_value APP_URL)"
    append_env_if_missing AUTH_TRUST_HOST true

    # Explicit override: bake a fixed public URL (OIDC / SSO / ops preference).
    if [[ -n "$public_url" ]]; then
        set_env_value NEXTAUTH_URL "$public_url"
        set_env_value APP_URL "$public_url"
        log "已按 DEPLOY_PUBLIC_URL 设置公开访问地址为 $public_url"
        return
    fi

    # Default: dynamic Host. Clear example placeholders so compose does not
    # inject a stale example.com / localhost into the container.
    if is_url_placeholder "$nextauth_url"; then
        set_env_value NEXTAUTH_URL ""
    fi
    if is_url_placeholder "$app_url"; then
        set_env_value APP_URL ""
    fi
    if [[ "$created" == "true" ]] || is_url_placeholder "$nextauth_url" || is_url_placeholder "$app_url"; then
        log "公开访问地址按浏览器 Host 自动识别（可用 DEPLOY_PUBLIC_URL 覆盖）"
    fi
}

ensure_env() {
    local created="false"
    if [[ ! -f "$ENV_FILE" ]]; then
        [[ -f "$ENV_EXAMPLE_FILE" ]] || die "环境变量模板不存在: $ENV_EXAMPLE_FILE"
        umask 077
        cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        created="true"
        log "已从 .env.example 初始化 .env"
    else
        append_env_if_missing POSTGRES_USER "unicenter"
        append_env_if_missing POSTGRES_DB "unicenter"
        chmod 600 "$ENV_FILE"
    fi

    ensure_random_secret APP_SECRET 32
    ensure_random_secret NEXTAUTH_SECRET 32
    ensure_random_secret POSTGRES_PASSWORD 24
    ensure_random_secret INTERNAL_API_TOKEN 32
    ensure_public_urls "$created"

    local key value
    for key in APP_SECRET NEXTAUTH_SECRET POSTGRES_PASSWORD INTERNAL_API_TOKEN; do
        value="$(env_value "$key")"
        if is_secret_placeholder "$value"; then
            die ".env 中的 $key 仍是空值或示例占位符"
        fi
    done
}

check_files() {
    local services images
    [[ -f "$COMPOSE_FILE_PATH" ]] || die "Compose 文件不存在: $COMPOSE_FILE_PATH"
    case "$(basename "$COMPOSE_FILE_PATH")" in
        docker-compose.community.yml)
            die "docker-compose.community.yml 属于 Community 发布安装流程，源码部署请使用根 docker-compose.yml；发布安装请使用 install-community.sh"
            ;;
    esac
    [[ -f "$DOCKERFILE_PATH" ]] || die "Dockerfile 不存在: $DOCKERFILE_PATH"
    ensure_env
    compose config --quiet || die "Compose 配置校验失败，请检查 .env 和 $COMPOSE_FILE_PATH"
    services="$(compose config --services)" || die "无法读取 Compose 服务清单: $COMPOSE_FILE_PATH"
    grep -Fxq "$SERVICE" <<< "$services" || die "Compose 缺少应用服务 $SERVICE，不符合源码栈契约: $COMPOSE_FILE_PATH"
    grep -Fxq "$POSTGRES_SERVICE" <<< "$services" || die "Compose 缺少 PostgreSQL 服务 $POSTGRES_SERVICE，不符合源码栈契约: $COMPOSE_FILE_PATH"
    images="$(compose config --images)" || die "无法读取 Compose 镜像清单: $COMPOSE_FILE_PATH"
    grep -Fxq "$IMAGE_NAME" <<< "$images" || die "Compose 未使用 DEPLOY_IMAGE_NAME=$IMAGE_NAME，不符合源码镜像契约: $COMPOSE_FILE_PATH"
}

env_value_or_default() {
    local key="$1" default="$2" value
    value="$(env_value "$key")"
    printf '%s' "${value:-$default}"
}

wait_for_postgres() {
    local deadline=$((SECONDS + HEALTH_WAIT_SECS))
    local container_id status app_user
    app_user="$(env_value_or_default POSTGRES_USER unicenter)"

    log "等待 PostgreSQL 可连接（最长 ${HEALTH_WAIT_SECS}s）"
    while (( SECONDS < deadline )); do
        container_id="$(compose ps -q "$POSTGRES_SERVICE" 2>/dev/null || true)"
        if [[ -n "$container_id" ]]; then
            if docker exec "$container_id" pg_isready -U "$app_user" -d postgres >/dev/null 2>&1; then
                return 0
            fi
            status="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
            if [[ "$status" == "exited" ]]; then
                compose logs --tail 80 "$POSTGRES_SERVICE" || true
                return 1
            fi
        fi
        sleep 2
    done

    compose logs --tail 80 "$POSTGRES_SERVICE" || true
    return 1
}

select_builder() {
    if [[ -n "${DOCKER_BUILDKIT+x}" ]]; then
        case "$DOCKER_BUILDKIT" in
            0|1) ;;
            *) die "DOCKER_BUILDKIT 仅支持 0 或 1，当前值: $DOCKER_BUILDKIT" ;;
        esac
    elif docker buildx version >/dev/null 2>&1; then
        export DOCKER_BUILDKIT=1
    else
        export DOCKER_BUILDKIT=0
    fi
    export DOCKER_BUILDKIT

    if [[ "$DOCKER_BUILDKIT" == "1" ]]; then
        export BUILDKIT_PROGRESS="${BUILDKIT_PROGRESS:-plain}"
        log "构建器: BuildKit（buildx 可用或由 DOCKER_BUILDKIT=1 指定）"
    else
        log "构建器: legacy builder（使用临时兼容 Dockerfile）"
    fi
}

prepare_build_dockerfile() {
    BUILD_DOCKERFILE="$DOCKERFILE_PATH"
    cleanup_temp_dockerfile
    if [[ "$DOCKER_BUILDKIT" == "0" ]]; then
        TEMP_DOCKERFILE="$(mktemp "${TMPDIR:-/tmp}/unicenter-Dockerfile.XXXXXX")"
        sed \
            -e 's/--chmod=[0-9]* //g' \
            -e 's/RUN --mount=type=cache,[^ \\]* */RUN /g' \
            "$DOCKERFILE_PATH" > "$TEMP_DOCKERFILE"
        BUILD_DOCKERFILE="$TEMP_DOCKERFILE"
    fi
}

do_build() {
    local started_at=$SECONDS
    check_files
    select_builder
    prepare_build_dockerfile
    log "开始构建镜像: $IMAGE_NAME"
    log "构建上下文: $BUILD_CONTEXT"
    log "构建网络: $BUILD_NETWORK"
    if ! docker build \
        --network="$BUILD_NETWORK" \
        --build-arg "NPM_REGISTRY=$NPM_REGISTRY" \
        "$@" \
        -t "$IMAGE_NAME" \
        -f "$BUILD_DOCKERFILE" \
        "$BUILD_CONTEXT"
    then
        cleanup_temp_dockerfile
        return 1
    fi
    cleanup_temp_dockerfile
    log "镜像构建完成（耗时 $((SECONDS - started_at))s）"
    docker image inspect "$IMAGE_NAME" --format '    {{.RepoTags}}  {{.Size}} bytes' || true
}

wait_for_http() {
    local deadline=$((SECONDS + HEALTH_WAIT_SECS))
    if ! command -v curl >/dev/null 2>&1; then
        warn "未找到 curl，无法执行宿主机 HTTP 健康检查: $HEALTH_URL"
        return 1
    fi

    log "等待宿主机 HTTP 可访问（最长 ${HEALTH_WAIT_SECS}s）"
    while (( SECONDS < deadline )); do
        if curl -fsS -o /dev/null "$HEALTH_URL"; then
            log "HTTP 健康检查通过: $HEALTH_URL"
            return 0
        fi
        sleep 1
    done

    warn "容器健康，但宿主机 HTTP 健康检查在 ${HEALTH_WAIT_SECS}s 内未通过: $HEALTH_URL"
    return 1
}

wait_for_service() {
    local deadline=$((SECONDS + HEALTH_WAIT_SECS))
    local container_id status health
    local started_at=$SECONDS

    log "等待 frontend 健康（最长 ${HEALTH_WAIT_SECS}s）"
    while (( SECONDS < deadline )); do
        container_id="$(compose ps -q "$SERVICE" 2>/dev/null || true)"
        if [[ -n "$container_id" ]]; then
            status="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
            health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
            if [[ "$status" == "running" && "$health" == "healthy" ]]; then
                log "服务已就绪: $(env_value_or_default APP_URL '按浏览器 Host 访问（默认 :3001）')（等待健康耗时 $((SECONDS - started_at))s）"
                compose ps
                if wait_for_http; then
                    return 0
                fi
                warn "宿主机访问失败，frontend 最近日志如下"
                compose logs --tail 80 "$SERVICE" || true
                return 1
            fi
            if [[ "$status" == "exited" || "$health" == "unhealthy" ]]; then
                warn "frontend 未能启动，最近日志如下"
                compose logs --tail 80 "$SERVICE" || true
                return 1
            fi
        fi
        sleep 2
    done

    warn "服务在 ${HEALTH_WAIT_SECS}s 内未就绪，当前状态和日志如下"
    compose ps || true
    compose logs --tail 80 "$SERVICE" "$POSTGRES_SERVICE" || true
    return 1
}

do_up() {
    local force_recreate="${1:-false}"
    local started_at=$SECONDS
    check_files
    docker image inspect "$IMAGE_NAME" >/dev/null 2>&1 || die "本地镜像 $IMAGE_NAME 不存在，请先执行: $0 build"
    log "启动 PostgreSQL 服务"
    if [[ "$force_recreate" == "true" ]]; then
        compose up -d --no-build --pull missing --no-recreate "$POSTGRES_SERVICE"
    else
        compose up -d --no-build --pull missing "$POSTGRES_SERVICE"
    fi
    wait_for_postgres || die "PostgreSQL 未能在 ${HEALTH_WAIT_SECS}s 内启动"
    if [[ "$force_recreate" == "true" ]]; then
        log "强制重建 $SERVICE 服务（保留 PostgreSQL 和数据卷）"
        compose up -d --no-build --pull missing --force-recreate --no-deps "$SERVICE"
    else
        log "启动 Compose 应用服务"
        compose up -d --no-build --pull missing
    fi
    log "Compose 服务启动命令完成（耗时 $((SECONDS - started_at))s）"
    wait_for_service
}

do_down() {
    check_files
    log "停止 Compose 服务（保留数据卷）"
    compose down
}

do_restart() {
    check_files
    log "重启 frontend 服务"
    compose restart "$SERVICE"
    wait_for_service
}

do_logs() {
    check_files
    compose logs --tail "${LOG_TAIL:-100}" -f "$@"
}

do_status() {
    check_files
    compose ps
}

usage() {
    cat <<EOF
UniCenter 本地源码部署脚本

用法:
  $0 [命令] [Docker 构建参数...]

命令:
  deploy / 无命令  构建 frontend 镜像并启动服务
  redeploy         构建镜像并仅强制重建 frontend；不重建现有 PostgreSQL 容器
  build            仅构建镜像，可追加 --no-cache / --pull 等参数
  up               使用已有镜像启动服务
  down             停止服务，不删除数据卷
  restart          重启 frontend 并等待健康
  logs [服务名]    跟随日志；不传服务名时查看全部服务
  status            查看服务状态
  init-env          从 .env.example 初始化/补齐 .env（不需要 Docker）

直接传入 -- 开头的参数时，按 deploy 处理，例如:
  $0 --no-cache

环境变量:
  DEPLOY_COMPOSE_FILE  源码栈 Compose 文件路径（默认 docker-compose.yml）；不支持预构建 Community Compose
  DEPLOY_COMPOSE_PROJECT  Compose 项目名（默认 unicenter-esage）
  DEPLOY_ENV_FILE      环境文件路径（默认 .env）
  DEPLOY_ENV_EXAMPLE_FILE  环境模板路径（默认 .env.example）
  DEPLOY_PUBLIC_URL    对外访问地址，例如 https://unicenter.example.com
  DEPLOY_IMAGE_NAME    构建及 Compose 启动使用的镜像名（默认 unicenter-frontend:local）
  DEPLOY_SERVICE       应用服务名（默认 frontend）
  DEPLOY_POSTGRES_SERVICE  PostgreSQL 服务名（默认 postgres）
  DEPLOY_HEALTH_URL    宿主机健康地址（默认 http://127.0.0.1:3001/api/health）
  DOCKER_BUILDKIT      构建器覆盖：1=BuildKit，0=legacy；未设置时自动检测 buildx
  BUILD_NETWORK        Docker 构建网络（默认 host）
  NPM_REGISTRY         npm 镜像地址（默认 https://registry.npmjs.org）
  HEALTH_WAIT_SECS     健康检查超时秒数（默认 120）
  LOG_TAIL             logs 默认显示的日志行数（默认 100）
EOF
}

main() {
    if [[ $# -gt 0 && ( "$1" == "-h" || "$1" == "--help" || "$1" == "help" ) ]]; then
        usage
        return 0
    fi

    if [[ $# -gt 0 && "$1" == --* ]]; then
        check_docker
        do_build "$@"
        do_up
        return
    fi

    local command="${1:-deploy}"
    case "$command" in
        deploy)
            check_docker
            if (( $# > 0 )); then shift; fi
            do_build "$@"
            do_up
            ;;
        redeploy)
            check_docker
            shift
            do_build "$@"
            do_up true
            ;;
        "") check_docker; do_build; do_up ;;
        build) check_docker; shift; do_build "$@" ;;
        up) check_docker; do_up ;;
        down) check_docker; do_down ;;
        restart) check_docker; do_restart ;;
        logs) check_docker; shift; do_logs "$@" ;;
        status) check_docker; do_status ;;
        init-env) ensure_env ;;
        *) die "未知命令: $command。使用 $0 --help 查看帮助" ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
