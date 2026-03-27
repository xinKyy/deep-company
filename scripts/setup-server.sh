#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
#  ai-dev-pro 服务器初始化脚本
#  在全新的 Linux 服务器上运行，安装所有系统依赖
#  用法: bash scripts/setup-server.sh
# ─────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

if [ "$(id -u)" -eq 0 ]; then
  err "请勿使用 root 用户运行此脚本，使用普通用户（需有 sudo 权限）"
fi

detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then
    echo "apt"
  elif command -v yum &>/dev/null; then
    echo "yum"
  elif command -v dnf &>/dev/null; then
    echo "dnf"
  else
    err "不支持的包管理器，请手动安装依赖"
  fi
}

install_system_deps() {
  local PKG_MGR
  PKG_MGR=$(detect_pkg_manager)

  log "使用 $PKG_MGR 安装系统依赖..."

  case "$PKG_MGR" in
    apt)
      sudo apt-get update
      sudo apt-get install -y curl git build-essential python3 nginx
      ;;
    yum)
      sudo yum install -y curl git gcc gcc-c++ make python3 nginx
      ;;
    dnf)
      sudo dnf install -y curl git gcc gcc-c++ make python3 nginx
      ;;
  esac
}

install_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if (( NODE_VER >= 20 )); then
      log "Node.js $(node -v) 已安装，跳过"
      return
    fi
  fi

  log "安装 Node.js 20.x (via fnm)..."
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
  fnm install 20
  fnm use 20
  fnm default 20

  log "Node.js $(node -v) 安装完成"
}

install_pnpm() {
  if command -v pnpm &>/dev/null; then
    log "pnpm $(pnpm -v) 已安装，跳过"
    return
  fi

  log "安装 pnpm..."
  npm install -g pnpm
  log "pnpm $(pnpm -v) 安装完成"
}

install_pm2() {
  if command -v pm2 &>/dev/null; then
    log "PM2 $(pm2 -v) 已安装，跳过"
    return
  fi

  log "安装 PM2..."
  npm install -g pm2
  log "PM2 安装完成"
}

setup_nginx() {
  local NGINX_CONF="/etc/nginx/sites-available/ai-dev-pro"

  if [ -f "$NGINX_CONF" ]; then
    warn "Nginx 配置已存在，跳过"
    return
  fi

  log "配置 Nginx 反向代理..."

  local PROJECT_DIR
  PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

  sudo tee "$NGINX_CONF" > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 50m;

    # 前端静态文件
    location / {
        root /opt/ai-dev-pro/packages/web/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX

  if [ -d /etc/nginx/sites-enabled ]; then
    sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/ai-dev-pro
    sudo rm -f /etc/nginx/sites-enabled/default
  fi

  sudo nginx -t && sudo systemctl reload nginx
  log "Nginx 配置完成"
}

print_summary() {
  echo ""
  echo "=============================="
  echo "  服务器初始化完成！"
  echo "=============================="
  echo ""
  log "已安装:"
  log "  Node.js $(node -v)"
  log "  pnpm   $(pnpm -v)"
  log "  PM2    $(pm2 -v 2>/dev/null || echo 'N/A')"
  log "  Nginx  $(nginx -v 2>&1 | cut -d/ -f2)"
  echo ""
  log "下一步:"
  log "  1. 克隆项目到 /opt/ai-dev-pro"
  log "     sudo mkdir -p /opt/ai-dev-pro && sudo chown \$(whoami) /opt/ai-dev-pro"
  log "     git clone <your-repo-url> /opt/ai-dev-pro"
  log "  2. 配置环境变量"
  log "     cp .env.example .env && vi .env"
  log "  3. 修改 Nginx 配置中的 root 路径和 server_name"
  log "     sudo vi /etc/nginx/sites-available/ai-dev-pro"
  log "  4. 执行部署"
  log "     bash scripts/deploy.sh --init"
  echo ""
}

main() {
  echo ""
  echo "=============================="
  echo "  ai-dev-pro 服务器初始化"
  echo "=============================="
  echo ""

  install_system_deps
  install_node
  install_pnpm
  install_pm2
  setup_nginx
  print_summary
}

main
