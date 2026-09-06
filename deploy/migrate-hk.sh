#!/usr/bin/env bash
# ============================================================
# ThaiAI 一键迁移：大陆服务器 → 香港服务器（免备案）
#
# 在【新服务器】上以 root 执行。从旧服务器 rsync /opt/thaiai
# 全部状态 → 重建镜像 → compose up（固定容器名）→ 本机健康检查。
# 本脚本【不切换 DNS】，切换与回滚见 docs/migration-hk.md。
#
# 用法：
#   方式一（SSH 密钥，推荐）：
#     export MIGRATE_SSH_KEY=/root/.ssh/old_server_key
#     bash deploy/migrate-hk.sh
#   方式二（密码）：
#     export SSHPASS='旧服务器root密码'
#     bash deploy/migrate-hk.sh
#
# 环境变量：
#   MIGRATE_OLD_SERVER  旧服务器 IP（默认 8.140.225.225）
#   MIGRATE_OLD_USER    旧服务器 SSH 用户（默认 root）
#   MIGRATE_SSH_KEY     旧服务器 SSH 私钥路径（与 SSHPASS 二选一）
#   SSHPASS             旧服务器 SSH 密码（与 MIGRATE_SSH_KEY 二选一）
#   MIGRATE_COMPOSE_VER  compose v2 版本（默认 v5.5.1，与旧服务器一致）
# ============================================================
set -euo pipefail

OLD_SERVER="${MIGRATE_OLD_SERVER:-8.140.225.225}"
OLD_USER="${MIGRATE_OLD_USER:-root}"
SSH_KEY="${MIGRATE_SSH_KEY:-}"
DEST="/opt/thaiai"
COMPOSE_VERSION="${MIGRATE_COMPOSE_VER:-v5.5.1}"
ARCH="$(uname -m)"
[ "$ARCH" = "x86_64" ] && COMPOSE_ARCH="x86_64" || COMPOSE_ARCH="$ARCH"

log()  { printf '\033[1;32m[%s]\033[0m %s\n' "$1" "$2"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$1"; }
die()  { printf '\033[1;31m[✗] %s\033[0m\n' "$1"; exit 1; }

[ "$(id -u)" = 0 ] || die "请以 root 运行（sudo bash deploy/migrate-hk.sh）"
command -v rsync >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq rsync; }

# ---- 0. 预检：确认能连上旧服务器，且结构符合预期 ----
log "0/6" "预检：旧服务器 ${OLD_USER}@${OLD_SERVER}"
if [ -n "$SSH_KEY" ]; then
  [ -f "$SSH_KEY" ] || die "SSH 密钥不存在：$SSH_KEY"
  RSH="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=15"
else
  command -v sshpass >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq sshpass; }
  [ -n "${SSHPASS:-}" ] || die "请设置 MIGRATE_SSH_KEY（私钥路径）或 SSHPASS（密码）"
  RSH="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15"
fi

$RSH ${OLD_USER}@${OLD_SERVER} 'echo ok' >/dev/null 2>&1 \
  || die "无法连接旧服务器 ${OLD_SERVER}，请检查 IP/凭据/22 端口"
$RSH ${OLD_USER}@${OLD_SERVER} \
  'test -f /opt/thaiai/docker-compose.prod.yml && test -f /opt/thaiai/.env && test -d /opt/thaiai/data && test -d /opt/thaiai/dist && test -d /opt/thaiai/backend' \
  || die "旧服务器 /opt/thaiai 结构异常（缺少 compose/.env/data/dist/backend 之一）"

# ---- 1. 安装 docker + compose v2（静态二进制插件，与旧服务器做法一致）----
log "1/6" "安装 docker + compose v2（${COMPOSE_VERSION}）"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker version --format '{{.Server.Version}}' >/dev/null 2>&1 \
  || { systemctl start docker; sleep 2; }
if ! docker compose version >/dev/null 2>&1; then
  PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"
  mkdir -p "$PLUGIN_DIR"
  curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
    -o "$PLUGIN_DIR/docker-compose"
  chmod +x "$PLUGIN_DIR/docker-compose"
fi
docker compose version

# ---- 2. rsync /opt/thaiai 全部状态（排除开发/备份垃圾）----
log "2/6" "从旧服务器 rsync /opt/thaiai（首次全量 + 二次 data 最终同步）"
mkdir -p "$DEST"
RSYNC_RSH="${RSH}"
RSYNC_EXCLUDES=(
  --exclude=node_modules
  --exclude='**/node_modules'
  --exclude=.git
  --exclude=.freebuff
  --exclude=_extract
  --exclude=base44
  --exclude='*.log'
  --exclude='._*'
  --exclude=.DS_Store
  --exclude='dist.bak-*'
  --exclude='dist-backup-*'
  --exclude='dist.next'
  --exclude='backend.bak-plan'
  --exclude='*.bak-*'
  --exclude='*.legacy-*'
)

echo "    首次全量同步（dist/backend/data/certs/src/public/.env 等）..."
rsync -a --delete "${RSYNC_EXCLUDES[@]}" -e "$RSYNC_RSH" \
  ${OLD_USER}@${OLD_SERVER}:${DEST}/ "${DEST}/"

echo "    data 卷最终同步（users.db/uploads，缩短 DNS 切换前的数据窗口）..."
rsync -a --delete --exclude='*.log' --exclude='._*' --exclude=.DS_Store \
  -e "$RSYNC_RSH" ${OLD_USER}@${OLD_SERVER}:${DEST}/data/ "${DEST}/data/"

# 校验关键文件到位
[ -f "$DEST/docker-compose.prod.yml" ] || die "rsync 后缺少 docker-compose.prod.yml"
[ -f "$DEST/.env" ]                    || die "rsync 后缺少 .env（密钥）"
[ -f "$DEST/data/users.db" ]           || die "rsync 后缺少 data/users.db（用户数据）"
[ -f "$DEST/certs/thaiai.crt" ]        || die "rsync 后缺少 certs/thaiai.crt（HTTPS 证书）"
[ -d "$DEST/src/data" ]                || warn "缺少 src/data（后端镜像构建需要，前端词库将为空）"
[ -L "$DEST/docker-compose.yml" ] || ln -sf docker-compose.prod.yml "$DEST/docker-compose.yml"
du -sh "$DEST"

# ---- 3. 重建镜像并启动（固定容器名 thaiai_backend / thaiai_frontend）----
log "3/6" "docker compose up -d --build（构建后端+前端镜像，可能需数分钟）"
cd "$DEST"
docker compose up -d --build

# ---- 4. 等待后端健康 ----
log "4/6" "等待后端容器 healthy（最长 2 分钟）"
BACKEND_HEALTHY=""
for _ in $(seq 1 24); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' thaiai_backend 2>/dev/null || echo starting)"
  [ "$STATUS" = "healthy" ] && { BACKEND_HEALTHY=1; break; }
  sleep 5
done
[ -n "$BACKEND_HEALTHY" ] || warn "thaiai_backend 未在 2 分钟内 healthy，请查看 docker logs thaiai_backend"

# ---- 5. 本机健康检查（不依赖 DNS，用 --resolve 直连本机）----
log "5/6" "本机健康检查（首页 / features / plan 401 保护 / 容器命名）"
RESOLVE="thai-ai.online:443:127.0.0.1"
BASE="https://thai-ai.online"

CODE_HOME="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$RESOLVE" "$BASE/" || true)"
CODE_FEAT="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$RESOLVE" "$BASE/api/features" || true)"
CODE_PLAN="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$RESOLVE" "$BASE/api/plan/overview" || true)"
CODE_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --resolve "thai-ai.online:80:127.0.0.1" "http://thai-ai.online/" || true)"
INDEX_HTML="$(curl -sk --resolve "$RESOLVE" "$BASE/" || true)"
MAIN_JS="$(printf '%s' "$INDEX_HTML" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1 || true)"
CROSSORIGIN_COUNT="$(printf '%s' "$INDEX_HTML" | grep -c crossorigin || true)"

echo "    首页 https          -> ${CODE_HOME}（期望 200）"
echo "    /api/features       -> ${CODE_FEAT}（期望 200）"
echo "    /api/plan/overview  -> ${CODE_PLAN}（期望 401，未登录被保护）"
echo "    http 80 跳转        -> ${CODE_HTTP}（期望 301）"
echo "    主 JS 引用          -> ${MAIN_JS:-未找到}"
echo "    crossorigin 残留    -> ${CROSSORIGIN_COUNT}（期望 0）"

[ "$CODE_HOME" = "200" ] || die "首页非 200（实际 ${CODE_HOME}）"
[ "$CODE_FEAT" = "200" ] || die "/api/features 非 200（实际 ${CODE_FEAT}）"
case "$CODE_PLAN" in 401|403) ;; *) die "/api/plan/overview 未受保护（实际 ${CODE_PLAN}，期望 401）";; esac
[ "$CROSSORIGIN_COUNT" = "0" ] || warn "index.html 仍有 crossorigin 属性（微信浏览器白屏隐患）"

echo "    容器清单："
docker ps --format '{{.Names}} | {{.Status}}' | sort \
  | grep -E '^thaiai_(backend|frontend) ' || die "容器名不符合预期（期望 thaiai_backend/thaiai_frontend）"
CONTAINER_COUNT="$(docker ps --format '{{.Names}}' | grep -cE '^thaiai_(backend|frontend)$' || true)"
[ "$CONTAINER_COUNT" = "2" ] || die "应恰好 2 个服务容器（实际 ${CONTAINER_COUNT}）"

# ---- 6. 完成 ----
log "6/6" "迁移完成，站点已在香港服务器就绪"
echo
echo "============================================================"
echo "  下一步（人工操作，见 docs/migration-hk.md）："
echo "  1. 验证：手机/大陆网络可先改 hosts 或 curl --resolve 试访问"
echo "  2. 阿里云控制台 → 云解析 DNS → thai-ai.online"
echo "     A 记录从 ${OLD_SERVER} 改为本机公网 IP"
echo "  3. 切换后全量验证（注册/登录/打卡/TTS）"
echo "  4. 出问题：A 记录切回 ${OLD_SERVER} 即回滚（旧服务器未停机）"
echo "============================================================"