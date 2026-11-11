#!/bin/bash
set -e

# ============================================
# UniCenter Community Installation Script
# ============================================
# Official defaults target the UniCenter v1.0.0 release on GitHub and GHCR.
# Set UNICENTER_COMPOSE_URL and UNICENTER_IMAGE only when using a mirror or
# a release candidate.
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Release configuration. Every value can be overridden for a release-candidate
# installation without editing this script. Official installs remain pinned to
# the immutable Git tag and image version below.
INSTALL_DIR="${UNICENTER_INSTALL_DIR:-/opt/unicenter}"
RELEASE_VERSION="${UNICENTER_VERSION:-1.0.0}"
RELEASE_REF="${UNICENTER_RELEASE_REF:-v${RELEASE_VERSION}}"
COMPOSE_URL="${UNICENTER_COMPOSE_URL:-https://raw.githubusercontent.com/yangbf1999/unicenter/${RELEASE_REF}/docker-compose.community.yml}"
FRONTEND_IMAGE="${UNICENTER_IMAGE:-ghcr.io/yangbf1999/unicenter-frontend:${RELEASE_VERSION}}"

TOTAL_STEPS=4
START_TIME=$(date +%s)

# ============================================
# Helper Functions
# ============================================

step() {
    local step_num=$1
    local msg=$2
    echo ""
    echo -e "${BOLD}${BLUE}[$step_num/$TOTAL_STEPS]${NC} ${BOLD}$msg${NC}"
}

log_info() {
    echo -e "    ${DIM}$1${NC}"
}

log_success() {
    echo -e "    ${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "    ${YELLOW}!${NC} $1"
}

log_error() {
    echo -e "\n    ${RED}✗ $1${NC}"
    exit 1
}

validate_release_config() {
    if [[ -z "$COMPOSE_URL" || -z "$FRONTEND_IMAGE" ]]; then
        log_error "社区发行包地址不能为空。请检查 UNICENTER_COMPOSE_URL 和 UNICENTER_IMAGE。"
    fi
}

upsert_env_value() {
    local file=$1
    local key=$2
    local value=$3
    local temp_file

    temp_file=$(mktemp "${file}.XXXXXX")
    awk -v prefix="${key}=" -v replacement="${key}=${value}" '
        index($0, prefix) == 1 {
            if (!updated) print replacement
            updated = 1
            next
        }
        { print }
        END { if (!updated) print replacement }
    ' "$file" > "$temp_file"
    mv "$temp_file" "$file"
}

spinner() {
    local pid=$1
    local msg=${2:-"Please wait"}
    local chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local i=0
    tput civis 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r    ${DIM}%s %s${NC}" "${chars:i++%${#chars}:1}" "$msg"
        sleep 0.1
    done
    printf "\r\033[K"
    tput cnorm 2>/dev/null || true
}

format_duration() {
    local secs=$1
    if [ "$secs" -lt 60 ]; then
        echo "${secs}s"
    else
        echo "$((secs / 60))m $((secs % 60))s"
    fi
}

cleanup_on_error() {
    echo ""
    echo -e "${RED}${BOLD}Installation failed.${NC}"
    echo -e "${DIM}    Logs may help diagnose the issue:${NC}"
    echo -e "${DIM}    - Check Docker: docker compose -f $INSTALL_DIR/docker-compose.yml logs${NC}"
    echo -e "${DIM}    - Re-run this script to retry${NC}"
    echo ""
    tput cnorm 2>/dev/null || true
    exit 1
}

trap cleanup_on_error ERR

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'
    ┌─────────────────────────────────────────────┐
    │                  UniCenter                  │
    └─────────────────────────────────────────────┘
EOF
    echo -e "${NC}"
    echo -e "    ${GREEN}${BOLD}Community Edition${NC}  ${DIM}— Free & Open Source${NC}"
    echo ""
}

# ============================================
# Pre-flight Checks
# ============================================

preflight_checks() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root. Use: sudo bash install-community.sh"
    fi

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION_ID=$VERSION_ID
    elif [ -f /etc/debian_version ]; then
        OS="debian"
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        log_error "Unsupported operating system"
    fi

    case $OS in
        ubuntu|debian)
            PKG_MANAGER="apt-get"
            PKG_UPDATE="apt-get update"
            PKG_INSTALL="apt-get install -y"
            ;;
        centos|rhel|rocky|almalinux|fedora|openEuler|openeuler)
            PKG_MANAGER="dnf"
            PKG_UPDATE="dnf check-update || true"
            PKG_INSTALL="dnf install -y"
            ;;
        *)
            log_error "Unsupported OS: $OS"
            ;;
    esac

    log_info "OS: $OS $VERSION_ID"
}

# ============================================
# Step 1: Install Docker
# ============================================

validate_docker() {
    local docker_version
    local docker_major
    local compose_version
    local compose_major

    if ! docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null); then
        log_error "Docker daemon is not available. Start Docker and re-run this script."
    fi

    docker_version=${docker_version#v}
    docker_major=${docker_version%%.*}
    if ! [[ "$docker_major" =~ ^[0-9]+$ ]] || [ "$docker_major" -lt 24 ]; then
        log_error "Docker Engine 24+ is required (found: ${docker_version:-unknown}). Install or upgrade Docker and re-run this script."
    fi

    if ! compose_version=$(docker compose version --short 2>/dev/null); then
        log_error "Docker Compose v2 is required. Install the Docker Compose plugin and re-run this script."
    fi

    compose_version=${compose_version#v}
    compose_major=${compose_version%%.*}
    if ! [[ "$compose_major" =~ ^[0-9]+$ ]] || [ "$compose_major" -ne 2 ]; then
        log_error "Docker Compose v2 is required (found: ${compose_version:-unknown}). Install the Docker Compose v2 plugin and re-run this script."
    fi

    log_success "Docker Engine $docker_version and Docker Compose v$compose_version are ready"
}

install_docker() {
    step 1 "Installing Docker"

    if command -v docker &> /dev/null; then
        validate_docker
        return
    fi

    case $OS in
        openEuler|openeuler)
            log_error "openEuler requires Docker Engine 24+ and Docker Compose v2 to be installed before running this script. Automatic Docker installation or upgrade is not supported on openEuler."
            ;;
    esac

    log_info "Installing dependencies..."
    $PKG_INSTALL openssl curl ca-certificates > /dev/null 2>&1

    case $OS in
        ubuntu|debian)
            apt-get remove -y docker docker-engine docker.io containerd runc > /dev/null 2>&1 || true
            $PKG_INSTALL gnupg lsb-release > /dev/null 2>&1
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update > /dev/null 2>&1
            $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
            ;;
        centos|rhel|rocky|almalinux|fedora)
            dnf remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine > /dev/null 2>&1 || true
            $PKG_INSTALL dnf-plugins-core > /dev/null 2>&1
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo > /dev/null 2>&1
            $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
            ;;
    esac

    systemctl start docker
    systemctl enable docker > /dev/null 2>&1

    validate_docker
}

# ============================================
# Step 2: Configure UniCenter
# ============================================

setup_unicenter() {
    step 2 "Configuring UniCenter"

    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Download docker-compose
    log_info "Release: $RELEASE_REF"
    log_info "Image: $FRONTEND_IMAGE"
    curl -fsSL "$COMPOSE_URL" -o docker-compose.yml 2>/dev/null
    log_success "Downloaded compose configuration"

    if [ -f "$INSTALL_DIR/.env" ]; then
        # A retry or upgrade must not rotate auth/database secrets. Only move
        # the deployment to the explicitly selected immutable image.
        upsert_env_value "$INSTALL_DIR/.env" "UNICENTER_IMAGE" "$FRONTEND_IMAGE"
        log_success "Existing secrets preserved and image version updated"
    else
        # Generate secrets
        APP_SECRET=$(openssl rand -hex 32)
        NEXTAUTH_SECRET=$(openssl rand -hex 32)
        # Postgres password is required by the compose file (it uses the
        # `${VAR:?msg}` form); generate one here so docker compose up doesn't
        # bail. POSTGRES_USER/DB stay defaulted via the compose ${VAR:-default}
        # pattern, so we don't need to write them.
        POSTGRES_PASSWORD=$(openssl rand -hex 24)

        # Create .env file (public origin is derived from Host; set NEXTAUTH_URL only for OIDC)
        cat > "$INSTALL_DIR/.env" << EOF
# UniCenter Community Edition
# Generated on $(date -Iseconds)

APP_SECRET=$APP_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
AUTH_TRUST_HOST=true
UNICENTER_IMAGE=$FRONTEND_IMAGE

# Postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

        log_success "Secrets generated and configuration saved"
    fi

    chmod 600 "$INSTALL_DIR/.env"

    if ! docker compose config --images | grep -Fxq "$FRONTEND_IMAGE"; then
        log_error "Compose does not use the requested UniCenter image: $FRONTEND_IMAGE"
    fi
    log_success "Compose image contract verified"
}

# ============================================
# Step 3: Pull & Initialize
# ============================================

pull_and_init() {
    step 3 "Pulling image and initializing"

    cd "$INSTALL_DIR"

    docker compose pull 2>&1 | tail -3
    log_success "Image pulled"

    # Create volumes. postgres_data is declared external in the compose
    # file, so docker compose up won't auto-create it; the absence of
    # this line is what made fresh installs fail before.
    docker volume create unicenter_data > /dev/null 2>&1 || true
    docker volume create postgres_data > /dev/null 2>&1 || true

    # Init the frontend data directory so the non-root container user
    # (uid 1001) can write into it. The Postgres volume gets initialised
    # by the postgres image itself on first boot — no prep needed here.
    docker run --rm --user root --entrypoint "" \
        -v unicenter_data:/app/data \
        "$FRONTEND_IMAGE" \
        sh -c "mkdir -p /app/data && chown -R 1001:1001 /app/data" > /dev/null 2>&1

    log_success "Volumes initialized"
}

# ============================================
# Step 4: Start Services
# ============================================

start_and_wait() {
    step 4 "Starting UniCenter"

    cd "$INSTALL_DIR"
    docker compose up -d 2>&1 | grep -v "^$"
    log_success "Container started"

    # Wait for frontend with spinner
    log_info "Waiting for service to be ready..."
    (
        local attempt=1
        while [ $attempt -le 60 ]; do
            if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
                exit 0
            fi
            sleep 2
            attempt=$((attempt + 1))
        done
        exit 1
    ) &
    local wait_pid=$!
    spinner $wait_pid "Starting frontend..."
    wait $wait_pid || log_error "Frontend failed to start within 2 minutes. Check: docker compose logs"

    log_success "Service healthy"
}

# ============================================
# Final Summary
# ============================================

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    SERVER_IP=$(hostname -I | awk '{print $1}' | head -1)

    echo ""
    echo -e "${GREEN}${BOLD}  ┌─────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}${BOLD}  │      UniCenter Community is ready!         │${NC}"
    echo -e "${GREEN}${BOLD}  └─────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "    ${BOLD}URL${NC}         ${CYAN}http://$SERVER_IP:3000${NC}"
    echo -e "    ${BOLD}Install${NC}     $INSTALL_DIR"
    echo -e "    ${BOLD}Duration${NC}    $(format_duration $duration)"
    echo ""
    echo -e "    ${DIM}Features: Dashboard, Inventory, VM/CT Management, Backups, Storage${NC}"
    echo ""
    echo -e "    ${DIM}Manage:${NC}"
    echo -e "      ${DIM}docker compose -f $INSTALL_DIR/docker-compose.yml logs -f${NC}     ${DIM}# Logs${NC}"
    echo -e "      ${DIM}docker compose -f $INSTALL_DIR/docker-compose.yml down${NC}        ${DIM}# Stop${NC}"
    echo -e "      ${DIM}docker compose -f $INSTALL_DIR/docker-compose.yml pull && \\${NC}"
    echo -e "      ${DIM}docker compose -f $INSTALL_DIR/docker-compose.yml up -d${NC}       ${DIM}# Update${NC}"
    echo ""
}

# ============================================
# Main
# ============================================

main() {
    validate_release_config
    print_banner
    preflight_checks

    $PKG_UPDATE > /dev/null 2>&1 || true
    install_docker
    setup_unicenter
    pull_and_init
    start_and_wait

    print_summary
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
