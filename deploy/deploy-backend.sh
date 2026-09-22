#!/usr/bin/env bash
# ============================================================
# ThaiAI 服务器端 · 后端容器重建
#
#   bash deploy/deploy-backend.sh [commit]           # 由 build-on-server.sh 调用
#   BACKEND_FORCE=1 bash deploy/deploy-backend.sh    # 忽略变更检测，强制重建
#
# 为什么不能直接 `docker compose build`：compose 的构建上下文是 /opt/thaiai
# （运行目录，其中那份 backend/ 是旧快照），从它构建会打出旧代码。本脚本
# 一律用 git 源码目录 $SRC 作上下文，构建完再把镜像 tag 成 compose 认的名字。
#
# 流程：
#   1. 变更检测（backend/ 或 src/data/ —— 后者也被烘进后端镜像用于建库播种）
#   2. 一致性备份 SQLite（python3 sqlite3 backup API，WAL 下也安全）
#   3. 旧镜像留档 $IMG:rollback，从 $SRC 构建新镜像
#   4. compose 重建 backend 容器（--no-deps，不碰 nginx）
#   5. 健康断言：容器 healthy + 跑的是新镜像 + 网络未漂移 + /api/features 200
#   6. 失败自动回滚（镜像 + 数据库 + 容器）
#
# 输出约定（供调用方判定）：
#   BACKEND_OK commit=<sha>   成功重建并上线
#   BACKEND_SKIP              后端无变化，未做任何事
#   退出码 1                  失败（已回滚到重建前状态）
# ============================================================
set -euo pipefail

SRC=${SRC:-/opt/thaiai-src}
PROJ=${PROJ:-/opt/thaiai}
CONTAINER=${BACKEND_CONTAINER:-thaiai_backend}
DATA=$PROJ/data
DB=$DATA/users.db
MARKER=$PROJ/.deployed-backend-commit
BACKUP_DIR=$PROJ/backups
KEEP_BACKUPS=5
SITE_CHECK=https://127.0.0.1
NEW=${1:-}
RECREATED=0
DBBAK=""

cd "$SRC"
[ -n "$NEW" ] || NEW=$(git rev-parse --short HEAD)

# ── 1. 变更检测 ─────────────────────────────────────────────
BASE=$(cat "$MARKER" 2>/dev/null || true)
REASON=""
if [ "${BACKEND_FORCE:-0}" = "1" ]; then
  REASON="BACKEND_FORCE=1 强制重建"
elif [ -n "$BASE" ] && git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  FILES=$(git diff --name-only "$BASE..$NEW" -- backend src/data || true)
  if [ -n "$FILES" ]; then
    REASON="$BASE → $NEW 共 $(printf '%s\n' "$FILES" | wc -l | tr -d ' ') 个文件"
  fi
else
  # 基线不可用（首次纳入本流程 / 历史被重写）→ 宁愿多重建一次
  REASON="后端基线不可用（首次纳入或提交历史被重写）"
fi

if [ -z "$REASON" ]; then
  echo "   backend/ 与 src/data/ 无变化（基线 $BASE → $NEW），跳过后端重建"
  echo "BACKEND_SKIP"
  exit 0
fi
echo "   需重建：$REASON"

# ── 2. 数据库一致性备份 ─────────────────────────────────────
if [ -f "$DB" ]; then
  mkdir -p "$BACKUP_DIR"
  DBBAK="$BACKUP_DIR/users.db.$(date +%Y%m%d-%H%M%S).bak"
  python3 - "$DB" "$DBBAK" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
s = sqlite3.connect(src)
d = sqlite3.connect(dst)
s.backup(d)
d.commit()
users = d.execute("select count(*) from users").fetchone()[0]
d.close(); s.close()
print(f"   数据库已备份: {dst}（含 {users} 个用户）")
PY
  ls -t "$BACKUP_DIR"/users.db.*.bak 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
else
  echo "   ⚠️ 未找到 $DB，跳过数据库备份（若为首次部署属正常）"
fi

# ── 3. 旧镜像留档 + 构建新镜像 ──────────────────────────────
# 镜像名取运行中容器实际使用的那个（compose 未显式指定 image，用的是
# 自动推导名），避免硬编码猜错导致重建后跑的还是旧镜像。
IMG=$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || echo thaiai-backend)
IMG=${IMG%%:*}
OLD_IMG_ID=$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)
if [ -n "$OLD_IMG_ID" ]; then
  docker tag "$OLD_IMG_ID" "$IMG:rollback"
fi

echo "   构建 $IMG（上下文 $SRC；含 sqlite3 源码编译，约 2~5 分钟）"
if ! docker build -f "$SRC/backend/Dockerfile" -t "$IMG" "$SRC"; then
  echo "❌ 后端重建失败：镜像构建失败"
  echo "   容器未重建，线上仍运行原镜像，无需回滚"
  exit 1
fi
NEW_IMG_ID=$(docker image inspect -f '{{.Id}}' "$IMG")
echo "   新镜像: ${NEW_IMG_ID:0:26}…（旧镜像留档为 $IMG:rollback）"

# ── 4~6. 重建 + 健康断言 + 失败回滚 ─────────────────────────
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

# 回滚到重建前状态：镜像指回留档 tag、数据库还原到备份、容器重建、等健康
rollback() {
  echo "❌ 后端重建失败：$1"
  if [ "${RECREATED:-0}" != "1" ]; then
    echo "   容器未重建，线上仍运行原镜像，无需回滚"
    exit 1
  fi
  echo "   回滚中……"
  if docker image inspect "$IMG:rollback" >/dev/null 2>&1; then
    docker tag "$IMG:rollback" "$IMG"
  fi
  if [ -n "$DBBAK" ] && [ -f "$DBBAK" ]; then
    cd "$PROJ"
    # 先停容器：SQLite 带 WAL，在线覆盖数据文件不安全
    $COMPOSE stop backend >/dev/null 2>&1 || true
    cp -f "$DBBAK" "$DB"
    rm -f "$DB-wal" "$DB-shm"
    echo "   数据库已还原到重建前快照"
  fi
  cd "$PROJ"
  $COMPOSE up -d --no-build --no-deps --force-recreate backend >/dev/null 2>&1 || true
  for _ in $(seq 1 24); do
    sleep 5
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo none)" = "healthy" ] && break
  done
  echo "   回滚后状态: $(docker inspect -f '{{.State.Status}} / {{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo 无容器)"
  exit 1
}

NET_BEFORE=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER" 2>/dev/null || true)
cd "$PROJ"
echo "   重建容器（$COMPOSE up --no-deps --force-recreate backend）"
# 从这里开始容器状态就“不确定”了（可能已停但没起来），失败一律走恢复流程
RECREATED=1
if ! $COMPOSE up -d --no-build --no-deps --force-recreate backend; then
  rollback "容器重建命令失败"
fi

echo "   等待健康检查（最多 120s）"
HEALTH=none
for _ in $(seq 1 24); do
  sleep 5
  ST=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo missing)
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo none)
  [ "$ST" = "running" ] && [ "$HEALTH" = "healthy" ] && break
done
RUN_IMG_ID=$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)
NET_AFTER=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER" 2>/dev/null || true)
API_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 --resolve thai-ai.online:443:127.0.0.1 "$SITE_CHECK/api/features" || true)
# 只有新代码才有的路由：404 说明跑的还是旧镜像（旧镜像没有 routes/thai.js）。
# 只在源码里确实定义了该路由时才探测，避免以后路由改名造成误报。
PROBE="skip"
if grep -q 'thai/segment' "$SRC/backend/routes/thai.js" 2>/dev/null; then
  PROBE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 -X POST \
    --resolve thai-ai.online:443:127.0.0.1 "$SITE_CHECK/api/thai/segment" -H 'Content-Type: application/json' -d '{}' || true)
fi

echo "   容器: $(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null) / $HEALTH | 镜像: ${RUN_IMG_ID:0:19}… | API: $API_CODE | 新路由探测: $PROBE（404=旧代码）"

[ "$HEALTH" = "healthy" ] || rollback "容器健康检查未通过（$HEALTH）"
if [ -n "$NEW_IMG_ID" ] && [ "$RUN_IMG_ID" != "$NEW_IMG_ID" ]; then
  rollback "运行中的镜像不是刚构建的新镜像（compose 可能自行用旧上下文重建了）"
fi
if [ -n "$NET_BEFORE" ] && [ "$NET_AFTER" != "$NET_BEFORE" ]; then
  rollback "容器网络发生变化（$NET_BEFORE → $NET_AFTER），nginx 可能解析不到后端"
fi
[ "$API_CODE" = "200" ] || rollback "API 未返回 200（$API_CODE）"
[ "$PROBE" != "404" ] || rollback "新路由 /api/thai/segment 返回 404，运行的不是新代码"
docker logs --tail 5 "$CONTAINER" 2>&1 | sed 's/^/   │ /' || true

# 每次重建都会把上一版镜像降级为悬空（rollback tag 只留一份），长期会堆盘。
# 只清「24 小时前」的悬空镜像：它们已被 latest/rollback 取代，不可能是刚失败的退路。
PRUNED=$(docker image prune -f --filter "until=24h" 2>&1 | tail -1 || true)
echo "   清理悬空镜像: ${PRUNED:-跳过}"

echo "$NEW" > "$MARKER"
echo "BACKEND_OK commit=$NEW image=${NEW_IMG_ID:7:12}"
