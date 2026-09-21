#!/usr/bin/env bash
# ============================================================
# ThaiAI 服务器端发布（由 GitHub Actions SSH 触发，也可手动执行）
#
#   bash /opt/thaiai-src/deploy/build-on-server.sh
#
# 流程：
#   1. git fetch + reset 到 origin/main（Gitee 镜像，国内带宽秒级）
#   2. node:20 容器内 npm ci + vite build（npmmirror，带全局缓存卷）
#   3. 产物自检（主 JS 引用存在）
#   4. 备份当前 dist → rsync 同屏替换 /opt/thaiai/dist
#   5. 重启前端容器 + 本机验证（hash/首页/API），失败自动回滚
#
# 后端不在本脚本职责内（backend 容器独立运行，源码更新后另行重建）。
# ============================================================
set -euo pipefail

SRC=/opt/thaiai-src
DIST=/opt/thaiai/dist
NODE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim
SITE_CHECK=https://127.0.0.1

cd "$SRC"
echo "── [1/6] 拉取最新代码"
OLD=$(git rev-parse --short HEAD 2>/dev/null || echo none)
git fetch origin main
git reset --hard origin/main
NEW=$(git rev-parse --short HEAD)
if [ "$OLD" = "$NEW" ]; then
  echo "   代码已是最新（$NEW）——继续执行（可能是重试）"
else
  echo "   $OLD → $NEW"
fi

echo "── [2/6] Docker 内安装依赖 + 构建"
# 源码目录以卷挂进容器；npm 缓存卷让后续构建跳过重复下载
docker run --rm \
  -v "$SRC":/src -w /src \
  -v thaiai-npm-cache:/root/.npm \
  -e NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
  "$NODE_IMAGE" sh -c "npm ci --legacy-peer-deps --no-audit --no-fund && npm run build"

echo "── [3/6] 产物自检"
JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$SRC/dist/index.html" | head -1)
[ -n "$JS" ] || { echo "❌ dist/index.html 无主 JS 引用"; exit 1; }
echo "   构建产物: $JS"

echo "── [4/6] 备份当前线上 dist"
BAK="${DIST}.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$DIST" "$BAK"
echo "   备份: $BAK"
# 只保留最近 5 份备份，防止磁盘被旧版本吃满
ls -dt "${DIST}.bak-"* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "── [5/6] 替换 /opt/thaiai/dist + 重启前端容器"
rsync -a --delete "$SRC/dist/" "$DIST/"
docker restart thaiai_frontend >/dev/null
sleep 3

echo "── [6/6] 本机验证"
RJS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST/index.html" | head -1)
HOME_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_CHECK/")
API_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_CHECK/api/features")
echo "   线上 JS: $RJS | 首页: $HOME_CODE | API: $API_CODE"

FAIL=0
[ "$RJS" = "$JS" ] || { echo "❌ hash 不一致"; FAIL=1; }
[ "$HOME_CODE" = "200" ] || { echo "❌ 首页非 200"; FAIL=1; }
[ "$API_CODE" = "200" ] || { echo "❌ API 非 200"; FAIL=1; }

if [ "$FAIL" = "1" ]; then
  echo "❌ 验证失败，回滚到 $BAK"
  rm -rf "$DIST" && cp -a "$BAK" "$DIST"
  docker restart thaiai_frontend >/dev/null 2>&1 || true
  exit 1
fi

echo "✅ DEPLOY_OK commit=$NEW js=$JS"
