#!/usr/bin/env bash
# ============================================================
# 把本地构建好的安卓正式签名包发布到服务器
#   —— 发布完，网页上的「下载 APK」按钮就真的能下到东西了
#
# 用法：
#   export SSHPASS='服务器密码' && ./deploy/publish-apk.sh
#   export SSHPASS='服务器密码' && ./deploy/publish-apk.sh /path/to/app-release.apk
#
# 为什么需要它：
#   网页的下载入口指向 https://<站点>/uploads/app/thaiai-<版本>.apk，这个文件放在
#   服务器的**持久卷**里（docker-compose.prod.yml 的 ./data/uploads → 容器
#   /app/backend/uploads，后端用 express.static 托管 /uploads）。它是后端数据目录的
#   一部分，所以前端 dist 每次整目录替换都不会冲掉它。
#   CI（.github/workflows/android.yml）在 push 触发时做同样的事；这个脚本是「不想推
#   代码 / CI 还没配密钥 / 只想先手动发一版」时的直通路径。
#
# 依赖：sshpass（brew install esolitos/ipa/sshpass）、node、android build-tools（校验签名）
# 配置：同目录 deploy.env（DEPLOY_SERVER / DEPLOY_USER / DEPLOY_SITE_URL）
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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
SITE_URL="${DEPLOY_SITE_URL:-https://thai-ai.online}"
# 与 .github/workflows/android.yml 的 APK_PUBLISH_DIR 保持一致（宿主机上的持久卷目录）
PUBLISH_DIR="${APK_PUBLISH_DIR:-/opt/thaiai/data/uploads/app}"

APK="${1:-$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk}"

echo "═══════════════════════════════════════════"
echo " ThaiAI 安卓包发布"
echo "   服务器: $SERVER_USER@$SERVER"
echo "   目标:   $PUBLISH_DIR"
echo "   站点:   $SITE_URL"
echo "═══════════════════════════════════════════"

# ---------- 1. 校验产物与版本号 ----------
echo ""
echo "▶ [1/5] 校验产物与版本号..."
[ -f "$APK" ] || {
  echo "❌ 找不到 APK：$APK"
  echo "   先构建：cd android && ./gradlew assembleRelease"
  exit 1
}
# 网页指向的文件名 = 这里要传的文件名，两处版本号必须一致（CI 也跑这一步）
node "$PROJECT_ROOT/scripts/check-android-app.mjs"

VN=$(sed -n 's/^versionName=//p' "$PROJECT_ROOT/android/version.properties" | tr -d ' \r')
FILE="thaiai-${VN}.apk"
SIZE=$(du -h "$APK" | cut -f1)
SHA=$(shasum -a 256 "$APK" | awk '{print $1}')
echo "   APK: $APK（$SIZE）"
echo "   sha256: $SHA"

# ---------- 2. 必须是正式签名包 ----------
# debug 签名每个环境都不同，发出去用户装过一次，以后就再也覆盖升级不了。
echo ""
echo "▶ [2/5] 确认是正式签名包..."
BT=""
for dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools; do
  [ -n "$dir" ] && [ -d "$dir/build-tools" ] || continue
  BT=$(ls -d "$dir"/build-tools/* 2>/dev/null | sort -V | tail -1)
  [ -n "$BT" ] && break
done
if [ -z "$BT" ] || [ ! -x "$BT/apksigner" ]; then
  echo "❌ 找不到 apksigner（在 ANDROID_HOME/build-tools 下）"
  echo "   校验签名是发布前的必要一步：debug 签名的包发出去，用户以后无法覆盖升级。"
  echo "   装一个：brew install --cask android-commandlinetools"
  exit 1
fi
CERT=$("$BT/apksigner" verify --print-certs "$APK" | sed -n 's/^Signer #1 certificate DN: //p')
echo "   证书: $CERT"
case "$CERT" in
  *CN=ThaiAI*) ;;
  *) echo "❌ 不是 ThaiAI 发布密钥签的包（实际：$CERT）——拒绝发布"; exit 1 ;;
esac

# ---------- 3. 上传到持久卷 ----------
echo ""
echo "▶ [3/5] 上传到服务器..."
: "${SSHPASS:?请先 export SSHPASS='服务器密码'}"
export SSHPASS
SSH="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 $SERVER_USER@$SERVER"
$SSH "mkdir -p $PUBLISH_DIR" < /dev/null
sshpass -e scp -o StrictHostKeyChecking=no "$APK" "$SERVER_USER@$SERVER:$PUBLISH_DIR/$FILE"
echo "   已上传 $FILE"

# ---------- 4. 公开地址自检 ----------
# 从服务器**内侧**访问自己的域名：本机跨境访问常被 SNI 干扰，这个结论才可信。
echo ""
echo "▶ [4/5] 公网可下载性自检..."
CODE=$($SSH "curl -sk -o /dev/null -w '%{http_code} %{content_type} %{size_download}' --max-time 30 -r 0-1024 '$SITE_URL/uploads/app/$FILE'" < /dev/null)
echo "   HTTP: $CODE"
case "$CODE" in
  206*|200*) ;;
  *) echo "❌ 公网拿不到这个文件（$CODE）"; echo "   检查后端容器是否在跑：docker ps | grep thaiai_backend"; exit 1 ;;
esac

# ---------- 5. 完整性核对 ----------
# 下载回来的内容必须和本地一致：nginx/后端中间任何一环截断都在这暴露。
echo ""
echo "▶ [5/5] 远端文件大小核对..."
REMOTE_SIZE=$($SSH "stat -c%s '$PUBLISH_DIR/$FILE'" < /dev/null)
LOCAL_SIZE=$(wc -c < "$APK" | tr -d ' ')
echo "   本地 $LOCAL_SIZE 字节 / 服务器 $REMOTE_SIZE 字节"
[ "$REMOTE_SIZE" = "$LOCAL_SIZE" ] || { echo "❌ 两边大小不一致，传输可能被截断"; exit 1; }

echo ""
echo "═══════════════════════════════════════════"
echo " ✅ 发布成功"
echo "   下载地址: $SITE_URL/uploads/app/$FILE"
echo "   体积/校验: $SIZE / $SHA"
echo "   分发提示: 直接把上面的地址发给用户即可（微信里也能直接打开下载）"
echo "═══════════════════════════════════════════"
