#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
#  ai-dev-pro 部署脚本 (PM2)
#  用法: bash scripts/deploy.sh [--init]
#    --init  首次部署时使用，安装全局依赖
# ─────────────────────────────────────────────

APP_NAME="ai-dev-pro"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_MINIMUM="20"
REQUIRED_CMDS=(git node pnpm)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── 参数解析 ──
INIT_MODE=false
for arg in "$@"; do
  case "$arg" in
    --init) INIT_MODE=true ;;
    *) warn "未知参数: $arg" ;;
  esac
done

# ── 环境检查 ──
check_env() {
  log "检查运行环境..."

  for cmd in "${REQUIRED_CMDS[@]}"; do
    command -v "$cmd" &>/dev/null || err "未找到命令: $cmd，请先安装"
  done

  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( NODE_VER < NODE_MINIMUM )); then
    err "Node.js 版本需要 >= ${NODE_MINIMUM}，当前版本: $(node -v)"
  fi

  if ! command -v pm2 &>/dev/null; then
    if $INIT_MODE; then
      log "安装 PM2..."
      npm install -g pm2
    else
      err "未找到 pm2，首次部署请使用: bash scripts/deploy.sh --init"
    fi
  fi
}

# ── 拉取最新代码 ──
pull_code() {
  log "拉取最新代码..."
  cd "$PROJECT_DIR"

  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  log "当前分支: $CURRENT_BRANCH"

  git pull origin "$CURRENT_BRANCH"

  COMMIT_SHORT=$(git rev-parse --short HEAD)
  log "当前版本: $COMMIT_SHORT"
}

# ── 安装依赖 ──
install_deps() {
  log "安装依赖..."
  cd "$PROJECT_DIR"
  pnpm install --frozen-lockfile
}

# ── 构建 ──
build_all() {
  log "构建所有包..."
  cd "$PROJECT_DIR"
  pnpm run build
}

# ── 数据库迁移 ──
migrate_db() {
  log "执行数据库迁移..."
  cd "$PROJECT_DIR"

  mkdir -p data
  pnpm run db:migrate
}

# ── 环境变量检查 ──
check_dotenv() {
  cd "$PROJECT_DIR"
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      warn ".env 文件不存在，已从 .env.example 复制模板"
      cp .env.example .env
      warn "请编辑 .env 填入实际配置后重新执行部署"
      exit 1
    else
      err "未找到 .env 或 .env.example"
    fi
  fi
}

# ── 日志目录 ──
ensure_dirs() {
  mkdir -p "$PROJECT_DIR/logs"
  mkdir -p "$PROJECT_DIR/data"
}

# ── PM2 启动 / 重载 ──
start_or_reload() {
  cd "$PROJECT_DIR"

  if pm2 describe "$APP_NAME" &>/dev/null; then
    log "重载 $APP_NAME..."
    pm2 reload ecosystem.config.cjs
  else
    log "首次启动 $APP_NAME..."
    pm2 start ecosystem.config.cjs
  fi

  pm2 save

  if $INIT_MODE; then
    log "设置 PM2 开机自启..."
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || \
      warn "PM2 开机自启设置需要 root 权限，请手动执行上面输出的命令"
  fi
}

# ── 健康检查 ──
health_check() {
  log "等待服务启动..."
  sleep 3

  API_PORT=$(grep -E '^API_PORT=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2)
  API_PORT=${API_PORT:-3000}

  for i in $(seq 1 10); do
    if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
      log "✅ 服务启动成功！ http://localhost:${API_PORT}"
      return 0
    fi
    sleep 2
  done

  warn "健康检查未通过，请查看日志: pm2 logs $APP_NAME"
  return 1
}

# ── 主流程 ──
main() {
  echo ""
  echo "=============================="
  echo "  $APP_NAME 部署"
  echo "=============================="
  echo ""

  check_env
  check_dotenv
  ensure_dirs
  pull_code
  install_deps
  build_all
  migrate_db
  start_or_reload
  health_check

  echo ""
  log "部署完成！"
  log "常用命令:"
  log "  pm2 status           查看进程状态"
  log "  pm2 logs $APP_NAME   查看日志"
  log "  pm2 restart $APP_NAME 重启服务"
  log "  pm2 monit            监控面板"
  echo ""
}

main
