#!/usr/bin/env bash
# ============================================================
# ThaiAI 一键部署：本地构建 → rsync 到服务器 → 重启前端 → 验证
#
# 用法：
#   ./deploy/deploy.sh                # 构建 + 部署
#   ./deploy/deploy.sh --skip-build   # 跳过构建，直接同步现有 dist/
#
# 依赖：rsync、sshpass（brew install esolitos/ipa/sshpass）
# 配置：同目录 deploy.env（参考 deploy.env.example），
#       SSHPASS 建议运行时 export 传入，不要写进文件。
#
# 行为说明：
#   - 主目录构建若超过 BUILD_TIMEOUT 秒（默认 240，iCloud dataless
#     文件可能导致 vite 卡死），自动回退到 /tmp 干净副本构建：
#     ditto 源码 → npm install → build → dist 拷回主目录
#   - 部署前自动备份服务器 dist 到 /opt/thaiai/dist.bak-<时间戳>
#   - 部署后校验：本地/线上 index.html 引用的 JS hash 一致、
#     crossorigin=0、首页与 API 均 200；任一失败自动回滚并退出 1
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_TIMEOUT="${BUILD_TIMEOUT:-240}"

# ---------- 配置 ----------
ENV_FILE="${DEPLOY_ENV:-$SCRIPT_DIR/deploy.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "❌ 未找到配置文件 $ENV_FILE"
  echo "   cp deploy/deploy.env.example deploy/deploy.env"
  exit 1
fi

SERVER="${DEPLOY_SERVER:?请在 deploy.env 中设置 DEPLOY_SERVER}"
SERVER_USER="${DEPLOY_USER:-root}"
REMOTE_DIST="${DEPLOY_REMOTE_DIST:-/opt/thaiai/dist}"
SITE_URL="${DEPLOY_SITE_URL:-https://thai-ai.online}"

SKIP_BUILD=false
[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=true

echo "═══════════════════════════════════════════"
echo " ThaiAI 一键部署"
echo "   服务器: $SERVER_USER@$SERVER"
echo "   目标:   $REMOTE_DIST"
echo "   站点:   $SITE_URL"
echo "═══════════════════════════════════════════"

# ---------- 1. 本地构建 ----------
# /tmp 干净副本回退构建：主目录构建超时或失败时使用
fallback_build() {
  local BUILD_DIR=/tmp/thaiai-deploy-$$
  rm -rf "$BUILD_DIR" && mkdir -p "$BUILD_DIR"
  ditto package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js index.html "$BUILD_DIR/" 2>/dev/null || true
  ditto src "$BUILD_DIR/src"
  mkdir -p "$BUILD_DIR/public"
  # public 只带小于 5M 的文件；单文件 ditto 卡住（iCloud 占位）时 20s 超时跳过
  find public -type f -size -5M 2>/dev/null | while IFS= read -r f; do
    mkdir -p "$BUILD_DIR/$(dirname "$f")"
    perl -e 'alarm 20; exec @ARGV' ditto "$f" "$BUILD_DIR/$f" 2>/dev/null || \
      echo "   ⚠️ 跳过 iCloud 卡住文件: $f"
  done
  echo "   /tmp 副本安装依赖..."
  (cd "$BUILD_DIR" && npm install --legacy-peer-deps --prefer-offline > /dev/null 2>&1) || {
    echo "❌ /tmp 副本 npm install 失败"; exit 1; }
  echo "   /tmp 副本构建..."
  (cd "$BUILD_DIR" && npm run build >> /tmp/thaiai-deploy-build.log 2>&1) || {
    echo "❌ /tmp 副本构建失败，日志：/tmp/thaiai-deploy-build.log"
    tail -20 /tmp/thaiai-deploy-build.log; exit 1; }
  rm -rf dist
  ditto "$BUILD_DIR/dist" dist
  rm -rf "$BUILD_DIR"
  echo "   ✅ /tmp 副本构建成功，dist 已拷回主目录"
}

cd "$PROJECT_ROOT"
if [ "$SKIP_BUILD" = true ]; then
  echo ""
  echo "▶ [1/5] 跳过构建（--skip-build），使用现有 dist/"
  [ -f dist/index.html ] || { echo "❌ dist/index.html 不存在，请先构建"; exit 1; }
else
  echo ""
  echo "▶ [1/5] 本地构建（主目录，最长 ${BUILD_TIMEOUT}s）..."
  rm -f /tmp/thaiai-deploy-build.log
  npm run build > /tmp/thaiai-deploy-build.log 2>&1 &
  BUILD_PID=$!
  WAITED=0
  while kill -0 "$BUILD_PID" 2>/dev/null && [ "$WAITED" -lt "$BUILD_TIMEOUT" ]; do
    sleep 5
    WAITED=$((WAITED + 5))
  done

  if kill -0 "$BUILD_PID" 2>/dev/null; then
    echo "   ⚠️  主目录构建超过 ${BUILD_TIMEOUT}s（疑似 iCloud dataless 卡死），终止并回退..."
    kill "$BUILD_PID" 2>/dev/null || true
    wait "$BUILD_PID" 2>/dev/null || true
    fallback_build
  elif wait "$BUILD_PID" 2>/dev/null; then
    echo "   ✅ 主目录构建成功 ($(grep -oE 'built in [0-9.]+s' /tmp/thaiai-deploy-build.log | tail -1))"
  else
    echo "   ⚠️  主目录构建失败（常见原因：public 大图为 iCloud 占位，复制 dist 时 ETIMEDOUT），回退..."
    fallback_build
  fi
  echo "   产物: $(ls dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ') 个 JS 文件"
fi

# ---------- 2. 校验本地产物 ----------
echo ""
echo "▶ [2/5] 校验本地产物..."
LOCAL_JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)
LOCAL_CROSSORIGIN=$(grep -c crossorigin dist/index.html || true)
[ -n "$LOCAL_JS" ] || { echo "❌ dist/index.html 中未找到主 JS 引用"; exit 1; }
[ "$LOCAL_CROSSORIGIN" = "0" ] || { echo "❌ 产物仍含 $LOCAL_CROSSORIGIN 处 crossorigin，构建异常"; exit 1; }
echo "   主 JS: $LOCAL_JS"
echo "   crossorigin: 0 ✅"

# ---------- 3. 备份 + 同步 ----------
echo ""
echo "▶ [3/5] 备份服务器 dist 并同步新版本..."
: "${SSHPASS:?请先 export SSHPASS='服务器密码'}"
export SSHPASS
run_ssh() { sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$SERVER_USER@$SERVER" "$@"; }

BACKUP_DIR="${REMOTE_DIST}.bak-$(date +%Y%m%d-%H%M%S)"
run_ssh "if [ -d $REMOTE_DIST ]; then cp -a $REMOTE_DIST $BACKUP_DIR && echo '   备份: $BACKUP_DIR'; else echo '   ⚠️ 服务器无现有 dist，跳过备份'; fi"

sshpass -e rsync -az --delete dist/ "$SERVER_USER@$SERVER:$REMOTE_DIST/" || { echo "❌ rsync 失败"; exit 1; }
echo "   rsync 完成"

# ---------- 4. 重启前端容器 ----------
echo ""
echo "▶ [4/5] 重启前端容器..."
run_ssh "FE=\$(docker ps --format '{{.Names}}' | grep -m1 thaiai_frontend || true); if [ -n \"\$FE\" ]; then docker restart \$FE > /dev/null && echo \"   ✅ 已重启 \$FE\"; else echo '   ⚠️ 未找到 thaiai_frontend 容器，跳过重启'; fi"
sleep 3

# ---------- 5. 验证 ----------
echo ""
echo "▶ [5/5] 验证部署..."
REMOTE_JS=$(run_ssh "grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' $REMOTE_DIST/index.html | head -1")
REMOTE_CROSSORIGIN=$(run_ssh "grep -c crossorigin $REMOTE_DIST/index.html || true")
HOME_STATUS=$(run_ssh "curl -sk -o /dev/null -w '%{http_code}' $SITE_URL/")
API_STATUS=$(run_ssh "curl -sk -o /dev/null -w '%{http_code}' $SITE_URL/api/features")

FAIL=0
echo "   线上主 JS: $REMOTE_JS"
if [ "$REMOTE_JS" != "$LOCAL_JS" ]; then echo "   ❌ hash 不一致（本地=$LOCAL_JS）"; FAIL=1; fi
echo "   线上 crossorigin: $REMOTE_CROSSORIGIN"
[ "$REMOTE_CROSSORIGIN" = "0" ] || { echo "   ❌ 线上产物含 crossorigin"; FAIL=1; }
echo "   首页: HTTP $HOME_STATUS"
[ "$HOME_STATUS" = "200" ] || FAIL=1
echo "   API:  HTTP $API_STATUS"
[ "$API_STATUS" = "200" ] || FAIL=1

if [ "$FAIL" = "1" ]; then
  echo ""
  echo "❌ 验证失败！回滚到 $BACKUP_DIR ..."
  run_ssh "rm -rf $REMOTE_DIST && cp -a $BACKUP_DIR $REMOTE_DIST; FE=\$(docker ps --format '{{.Names}}' | grep -m1 thaiai_frontend || true); [ -n \"\$FE\" ] && docker restart \$FE > /dev/null 2>&1; echo '   已回滚'"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo " ✅ 部署成功"
echo "   线上版本: $REMOTE_JS"
echo "   服务器备份: $BACKUP_DIR"
echo "   回滚: ssh $SERVER_USER@$SERVER 'rm -rf $REMOTE_DIST && cp -a $BACKUP_DIR $REMOTE_DIST'"
echo "═══════════════════════════════════════════"
