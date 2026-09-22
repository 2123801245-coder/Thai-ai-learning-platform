#!/usr/bin/env bash
# ============================================================
# ThaiAI 服务器端发布（由 GitHub Actions SSH 触发，也可手动执行）
#
#   bash /opt/thaiai-src/deploy/build-on-server.sh
#
# 三条触发通道共用本脚本（并发安全）：
#   - GitHub Actions：mirror push 到 Gitee 后 SSH 执行
#   - Gitee WebHook：push 后由 deploy/gitee-webhook.py 触发
#   - Gitee 轮询兜底：thaiai-gitee-sync.timer 每 3 分钟拉一次
# 后到者在这里等锁获得串行，拿到锁后多半被「无变更」直接短路。
#
# 流程：
#   1. git fetch + reset 到 origin/main（Gitee 镜像，国内带宽秒级）
#   2. 后端容器：backend/ 或 src/data/ 有变化时自动重建（deploy/deploy-backend.sh，
#      含数据库备份与失败回滚）。**先做后端**——前端验证要查 /api/features。
#   3. 前端：只有非 backend/ 路径有变化时才构建
#      node:20 容器内 npm ci + vite build（npmmirror，带全局缓存卷）
#   4. 产物自检 + 备份 dist → rsync 同屏替换
#   5. 同步 nginx.conf 到容器挂载源 + 同步 WebHook/轮询服务 + 重启前端容器
#   6. 本机验证（hash/首页/API/音频 MIME/WebHook 存活），失败自动回滚
#
# 后端改动只重建后端、前端改动只重建前端；两边都没变则整个脚本秒退。
# ============================================================
set -euo pipefail

SRC=/opt/thaiai-src
DIST=/opt/thaiai/dist
NODE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim
SITE_CHECK=https://127.0.0.1
# 记录最近一次发布成功的 commit，用于判定「哪些部分需要重建」与短路重复构建
MARKER=/opt/thaiai/.deployed-commit
LOCK=/var/lock/thaiai-deploy.lock
# 触发来源（由调用方注入：GitHub Actions / Gitee WebHook / 轮询兜底），只用于通知文案
TRIGGER=${THAIAI_TRIGGER:-未标注}
START=$(date +%s)
NEW=""
SUBJECT=""
BACKEND_NOTE="未涉及（无变化）"
NEED_FRONT=1
STEP=0

step() { STEP=$((STEP + 1)); echo "── [$STEP] $*"; }

# 发布通知（钉钉/企业微信/个人推送）。配置缺失或推送失败都只记一行，**绝不影响发布本身**。
# 配置在服务器 /etc/thaiai-notify.env（600，不进仓库）；实现在 deploy/notify.py。
notify() {
  [ -f "$SRC/deploy/notify.py" ] || return 0
  python3 "$SRC/deploy/notify.py" "$1" \
    --commit "${NEW:-}" --subject "${SUBJECT:-}" --trigger "$TRIGGER" \
    --backend "${BACKEND_NOTE:-}" \
    "${@:2}" 2>&1 | sed 's/^/   /' || true
  return 0
}

# 未预期中断（set -e 触发）也要通知：否则「没消息」和「失败了」分不清
on_abort() {
  local code=$?
  trap - ERR
  notify failure --stage "未预期中断" --detail "脚本以退出码 $code 中止"
  exit "$code"
}
trap on_abort ERR

# 两条通道可能几乎同时触发。并发跑构建会同时 rsync dist 并把容器重启到中间状态，
# 所以在最前面就排它：后到者等锁（最多 15 分钟），拿到后一般会被「无变更」短路。
# 手动强制重建：FORCE=1 bash build-on-server.sh
exec 9>"$LOCK"
if ! flock -w 900 9; then
  echo "❌ 等待发布锁超时（另一发布仍在执行）"
  exit 1
fi

cd "$SRC"
step "拉取最新代码"
OLD=$(git rev-parse --short HEAD 2>/dev/null || echo none)
git fetch origin main
git reset --hard origin/main
NEW=$(git rev-parse --short HEAD)
SUBJECT=$(git log -1 --pretty=%s 2>/dev/null | cut -c1-60 || true)
if [ "$OLD" = "$NEW" ]; then
  echo "   代码已是最新（$NEW）——继续执行（可能是重试）"
else
  echo "   $OLD → $NEW"
fi

# 变更判定：以「上次前端成功发布的 commit」为基线，看非 backend/ 路径是否动过。
# 基线不可用（首次 / 历史被重写）时按「需要重建」处理，宁可多构建一次。
FBASE=$(cat "$MARKER" 2>/dev/null || true)
if [ "${FORCE:-0}" != "1" ] && [ -n "$FBASE" ] && git cat-file -e "${FBASE}^{commit}" 2>/dev/null; then
  if [ -n "$(git diff --name-only "$FBASE..$NEW" -- . ':(exclude)backend' | head -1)" ]; then
    NEED_FRONT=1
  else
    NEED_FRONT=0
  fi
else
  NEED_FRONT=1
fi

step "后端容器（有变更时自动重建）"
BOUT=$(mktemp)
TOK=""
# 用 if 包裹以避开 set -e 的立即退出，同时拿到管道整体退出码
if bash "$SRC/deploy/deploy-backend.sh" "$NEW" 2>&1 | tee "$BOUT"; then
  BOK=1
else
  BOK=0
fi
if [ "$BOK" = "1" ] && grep -q '^BACKEND_OK ' "$BOUT"; then
  TOK=$(sed -n 's/^BACKEND_OK commit=\([^ ]*\).*/\1/p' "$BOUT" | head -1)
  BACKEND_NOTE="已重建并上线（$TOK）"
fi
rm -f "$BOUT"
if [ "$BOK" != "1" ]; then
  notify failure --stage "后端容器重建" \
    --detail "后端重建失败并已回滚（镜像+数据库）；前端本次未发布"
  exit 1
fi

if [ "$NEED_FRONT" = "0" ]; then
  # 前端内容与线上一致（例如本次只改了 backend/）：不构建、不重启
  echo "   非 backend/ 路径无变化（基线 $FBASE → $NEW），跳过前端构建"
  HOME_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_CHECK/" || true)
  JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST/index.html" | head -1 || true)
else
  step "Docker 内安装依赖 + 构建"
  # 源码目录以卷挂进容器；npm 缓存卷让后续构建跳过重复下载
  docker run --rm \
    -v "$SRC":/src -w /src \
    -v thaiai-npm-cache:/root/.npm \
    -e NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    "$NODE_IMAGE" sh -c "npm ci --legacy-peer-deps --no-audit --no-fund && npm run build"

  step "产物自检"
  JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$SRC/dist/index.html" | head -1)
  [ -n "$JS" ] || { echo "❌ dist/index.html 无主 JS 引用"; exit 1; }
  echo "   构建产物: $JS"

  step "备份当前线上 dist"
  BAK="${DIST}.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$DIST" "$BAK"
  echo "   备份: $BAK"
  # 只保留最近 5 份备份，防止磁盘被旧版本吃满
  ls -dt "${DIST}.bak-"* 2>/dev/null | tail -n +6 | xargs -r rm -rf

  step "替换 /opt/thaiai/dist + 同步 nginx 配置 + 重启前端容器"
  rsync -a --delete "$SRC/dist/" "$DIST/"
  # nginx 配置的挂载源在 /opt/thaiai（compose 项目目录），不在 /opt/thaiai-src；
  # 不同步的话仓库里改的 nginx.conf 永远不会生效（例如音频 MIME/缓存、SPA 回退）。
  # 目标路径从运行中的容器反查，避免硬编码挂载点悄悄漂移。
  NGINX_CONF=$(docker inspect thaiai_frontend \
    --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
  # nginx 在容器里：要代理到宿主机（WebHook 接收端）必须走 docker 网桥网关，
  # 而该地址会随网络重建变化。这里按容器实际网关重写这一行，避免端点静默 502。
  GW=$(docker inspect thaiai_frontend \
    --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' 2>/dev/null || true)
  [ -n "$GW" ] || GW=172.18.0.1
  CONF_NEW=$(mktemp)
  sed "s#\(proxy_pass http://\)[0-9.]*\(:9911;\)#\1${GW}\2#" "$SRC/deploy/nginx.conf" > "$CONF_NEW"
  if [ -z "$NGINX_CONF" ] || [ ! -f "$NGINX_CONF" ]; then
    echo "   ⚠️ 未找到 nginx 配置挂载源，跳过配置同步（$NGINX_CONF）"
  elif cmp -s "$CONF_NEW" "$NGINX_CONF"; then
    echo "   nginx.conf 无变化（WebHook 网关 $GW）"
  else
    cp -a "$NGINX_CONF" "$NGINX_CONF.orig"
    cp "$CONF_NEW" "$NGINX_CONF"
    # 先验语法：坏配置在下面的 restart 时会直接让前端容器起不来（站点全挂）
    if docker exec thaiai_frontend nginx -t >/dev/null 2>&1; then
      rm -f "$NGINX_CONF.orig"
      echo "   nginx.conf 已更新并通过 nginx -t（WebHook 网关 $GW）"
    else
      cp "$NGINX_CONF.orig" "$NGINX_CONF"   # 用 cp 而非 mv：保留 inode，文件型 bind mount 才看得到还原
      rm -f "$NGINX_CONF.orig"
      echo "❌ nginx 配置语法错误，已还原（未重启，站点不受影响）"
      docker exec thaiai_frontend nginx -t || true
      notify failure --stage "nginx 配置语法检查" --detail "配置已还原，未重启容器"
      exit 1
    fi
  fi
  rm -f "$CONF_NEW"

  # WebHook 接收端（第二条发布通道）：unit 随发布同步；只在已安装（存在密钥文件）时管它
  if [ -f /etc/thaiai-webhook.env ]; then
    if ! cmp -s "$SRC/deploy/thaiai-webhook.service" /etc/systemd/system/thaiai-webhook.service; then
      install -m 644 "$SRC/deploy/thaiai-webhook.service" /etc/systemd/system/thaiai-webhook.service
      systemctl daemon-reload
      echo "   thaiai-webhook.service 已更新"
    fi
    systemctl is-enabled --quiet thaiai-webhook 2>/dev/null || systemctl enable thaiai-webhook >/dev/null 2>&1 || true
    # 重启以加载最新的 gitee-webhook.py（发布本身是独立会话，不会被带走）
    systemctl restart thaiai-webhook
  fi

  # Gitee 轮询兜底（拉取式）：WebHook 投递失败时靠它保证 Gitee → 部署仍然可用。
  # 不需要密钥，所以无条件安装启用；共用同一发布脚本，本身自带锁与短路。
  for U in thaiai-gitee-sync.service thaiai-gitee-sync.timer; do
    if ! cmp -s "$SRC/deploy/$U" "/etc/systemd/system/$U"; then
      install -m 644 "$SRC/deploy/$U" "/etc/systemd/system/$U"
      systemctl daemon-reload
      echo "   $U 已更新"
    fi
  done
  systemctl enable --now thaiai-gitee-sync.timer >/dev/null 2>&1 || true

  docker restart thaiai_frontend >/dev/null
  sleep 3

  step "本机验证"
  RJS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST/index.html" | head -1)
  HOME_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_CHECK/")
  API_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_CHECK/api/features")
  # 课文音频必须是 audio/*（曾以 application/octet-stream 下发，Safari/WebView 直接拒播）
  AUDIO_CT=$(curl -sk -o /dev/null -w '%{content_type}' --max-time 15 "$SITE_CHECK/lessons/audio/lesson-1/01.m4a")
  echo "   线上 JS: $RJS | 首页: $HOME_CODE | API: $API_CODE | 音频: $AUDIO_CT"

  FAIL=0
  [ "$RJS" = "$JS" ] || { echo "❌ hash 不一致"; FAIL=1; }
  [ "$HOME_CODE" = "200" ] || { echo "❌ 首页非 200"; FAIL=1; }
  [ "$API_CODE" = "200" ] || { echo "❌ API 非 200"; FAIL=1; }
  case "$AUDIO_CT" in audio/*) ;; *) echo "❌ 音频 MIME 异常（$AUDIO_CT）"; FAIL=1 ;; esac
  # 已安装 WebHook 服务时，它必须活着（否则第二条发布通道静默失效）
  if [ -f /etc/thaiai-webhook.env ]; then
    HOOK=$(curl -s --max-time 5 "http://127.0.0.1:9911/hooks/gitee" || true)
    echo "   WebHook 接收端: ${HOOK:-无响应}"
    echo "$HOOK" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("ok") else 1)' \
      2>/dev/null || { echo "❌ WebHook 接收端无响应"; FAIL=1; }
    # 走公网 vhost 的完整链路（nginx → 宿主机接收端）才是 Gitee 真实走的路径。
    # 用错误密钥探测（永远不可能触发发布），401=通、502=没打到接收端。
    # 只告警不阻断：第二条通道的管线问题不该拖垮主发布通道。
    HOOK_PUB=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 -X POST \
      "https://127.0.0.1/hooks/gitee" -H "X-Gitee-Token: probe-invalid" -d '{}' || true)
    echo "   WebHook 公网链路: ${HOOK_PUB:-无响应}（401=通）"
    [ "$HOOK_PUB" = "401" ] || echo "   ⚠️ WebHook 公网链路异常（$HOOK_PUB），第二条发布通道可能不可用"
  fi
  # 轮询兜底是 Gitee 通道的保底，必须活着（否则 Gitee 侧改动无人拉取）
  echo "   Gitee 轮询兜底: $(systemctl is-active thaiai-gitee-sync.timer 2>/dev/null)"

  if [ "$FAIL" = "1" ]; then
    echo "❌ 验证失败，回滚到 $BAK"
    rm -rf "$DIST" && cp -a "$BAK" "$DIST"
    docker restart thaiai_frontend >/dev/null 2>&1 || true
    notify failure --stage "本机验证未通过" --detail "已回滚到上一版（hash/首页/API/音频/接收端之一未过）"
    exit 1
  fi
fi

echo "$NEW" > "$MARKER"
echo "✅ DEPLOY_OK commit=$NEW js=$JS backend=$BACKEND_NOTE"
notify success --elapsed "$(( $(date +%s) - START ))" --site-code "$HOME_CODE"
