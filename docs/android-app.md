# 安卓 App（Capacitor 套壳）运维说明

用户下载的 `ThaiAI 泰语.apk` 是一个 **Capacitor 壳**：它不打包网页，只加载
`https://thai-ai.online`。所以网页每次部署，App 里立刻就是新版（不用发版、不用过审），
APK 只在**壳的自身能力**变化时才需要迭代（外链、分享、保存、权限、图标、SDK 版本）。

## 一、为什么是「远程加载 + 系统 WebView」

| 方案 | 结论 |
|---|---|
| TWA / Custom Tabs | ✗ 国内多数机型没有 Chrome，装了打不开 |
| 打包网页进 APK | ✗ 每次改文案都要重新发版，还得让用户手动覆盖安装 |
| **远程加载（当前）** | ✓ 网页改完即生效；APK 只负责「系统级」的那几件事 |

代价是**每次启动都依赖网络**：断网时走 `android-www/offline.html`（品牌色兜底页 +
「重新连接」按钮），不会白屏。

## 二、目录与关键文件

| 位置 | 作用 |
|---|---|
| `capacitor.config.json` | 壳配置：加载地址、`errorPath: offline.html`、允许导航的域名 |
| `android-www/offline.html` | 断网/加载失败兜底页（唯一打进 APK 的本地页面） |
| `android/app/src/main/java/online/thaiai/app/MainActivity.java` | 返回键、TTS 自动播放、下载监听、调试开关 |
| `android/app/src/main/java/online/thaiai/app/ShellPlugin.java` | 原生桥：`openExternal` / `share` / `saveFile` / `appInfo` / `exitApp` |
| `src/lib/nativeShell.js` | 网页侧补丁：只有壳里才生效，浏览器里全是空操作 |
| `src/lib/appDownload.js` | 网页侧的版本号与下载地址（与 `android/version.properties` 必须一致） |
| `src/components/common/AndroidAppCard.jsx` | 设置中心里的「安卓 App」卡片（浏览器=下载，壳里=版本/更新） |
| `android/version.properties` | 版本号**唯一来源** |
| `scripts/check-android-app.mjs` | 版本一致性校验（CI 与发布脚本都会跑） |
| `deploy/publish-apk.sh` | 本地直接发布 APK 到服务器 |
| `.github/workflows/android.yml` | CI：构建 → 校验签名/清单 → 上传产物 → 发布到服务器 |

## 三、壳里补掉的 WebView 缺口

Android WebView 和 Chrome 不是一回事，下面这些都是**必须原生补**的：

| 网页里的写法 | WebView 原生行为 | 壳里的处理 |
|---|---|---|
| `window.open(url, "_blank")`（VIP 收银台） | Capacitor 8 没实现 `onCreateWindow`，**静默失败** | 改走系统浏览器（`nativeShell.js` 拦 `window.open`） |
| `navigator.share()`（成就卡、证书） | 没有这个 API | 原生分享面板 + FileProvider（含图片） |
| `a.download = ...; a.href = canvas.toDataURL(); a.click()`（保存证书/成就图/明信片） | **什么都不发生**（WebView 不下载 `data:`/`blob:`） | `Shell.saveFile`：Android 10+ 进相册（MediaStore，免权限），9 及以下写公共 Pictures 目录 |
| `<a href="https://..." download>` | 什么都不发生 | `DownloadListener` 交给系统浏览器 |
| 进入页面自动播放朗读音频 | 被「必须用户手势」拦住，没声音 | `setMediaPlaybackRequiresUserGesture(false)` |
| 录音（AI 跟读打分） | 需要系统授权 | 清单声明 `RECORD_AUDIO`，Capacitor 自动弹授权框 |
| 上传头像 / 选文件 | — | Capacitor 的 `onShowFileChooser` 原生已处理 |
| 返回键 | 直接退出 App | 有历史先回退，无历史才退出 |

## 四、版本号怎么升

两个地方要一起改，否则网页会指向一个不存在的文件（`check-android-app.mjs` 会拦住）：

1. `android/version.properties` → `versionCode`（**必须递增**，否则老版本无法覆盖安装，用户得先卸载 = 丢登录态）+ `versionName`
2. `src/lib/appDownload.js` → `versionCode` / `versionName` / `apkPath` 里的文件名

```bash
node scripts/check-android-app.mjs   # 校验两处一致
```

## 五、构建与发布

### 本地构建（需要 JDK 21 + Android SDK）

```bash
brew install openjdk@21
brew install --cask android-commandlinetools
cd android && ./gradlew assembleRelease      # 产物：app/build/outputs/apk/release/app-release.apk
```

### 发布（让用户能下到）

两条路，二选一：

```bash
# A. 本地直通发布（不推代码也能发）
export SSHPASS='服务器密码' && ./deploy/publish-apk.sh

# ⚠️ apksigner 需要 JDK 21：默认 PATH 没有 Java 时先
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"

# B. 推代码让 CI 发布（触发条件：改动 android/** 等路径）
git push origin main
```

发布目标都是服务器持久卷里的 `/opt/thaiai/data/uploads/app/thaiai-<版本>.apk`，
由后端 `/uploads` 静态服务托管（nginx `location /uploads/` 代理）。**不要**放进前端
`dist`：前端每次发布是整目录 `rsync --delete`，放里面会被冲掉。

发完之后用户能拿到的地址（可直接发微信）：

```
https://thai-ai.online/uploads/app/thaiai-<版本>.apk
```

### 分发入口：公开下载页 /get-app

比裸 APK 链接更好用的是落地页 `https://thai-ai.online/get-app`：
含双二维码（说明页 + APK 直链）、分步安装说明、微信内打开的引导。

- 微信里发这个地址，卡片由构建期静态页提供（`scripts/build-share-pages.mjs`
  的 PAGES 里有 get-app 一项），标题/描述/图都是专属的；
- 页面上的版本号、体积、最低安卓版本全部读自 `src/lib/appDownload.js`，
  升版本时改那一处即可，页面与卡片文案自动跟；
- 页面自带环境识别：微信 UA 显示「右上角 ⋯ → 在浏览器中打开」条幅，
  iOS 访客直接引导「添加到主屏幕」，桌面访客才显示二维码。

### CI 需要配置的 Secrets

| Secret | 说明 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i android/keystore/thaiai-release.jks` 的结果 |
| `ANDROID_KEYSTORE_PASSWORD` | 生成密钥时设置的密码（本地在 `android/keystore.properties`） |
| `ANDROID_KEY_ALIAS` | 默认 `thaiai` |
| `SSH_PASSWORD` | 与部署流水线共用，用于把 APK 传到服务器 |

缺签名相关密钥时 CI 会退化成 debug 签名并在摘要里标「勿分发」——仍是能装能测的产物。

## 六、签名密钥（最重要的一条）

- 位置：`android/keystore/thaiai-release.jks` + `android/keystore.properties`，**都不入库**（`.gitignore` 已忽略）
- 一旦丢失：已安装的用户**无法覆盖升级**，只能让所有人卸载重装（登录态丢失）
- 务必备份到密码管理器 / 私有仓库；换机器构建前先把这个文件恢复回来
- 本地生成命令（仅重建密钥时需要，**不要**在有用户之后再重建）：

```bash
keytool -genkeypair -v -keystore android/keystore/thaiai-release.jks \
  -alias thaiai -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN=ThaiAI, OU=Mobile, O=ThaiAI, C=CN"
```

## 七、已知取舍与排错

- **targetSdk 停在 34**：35+ 会强制 edge-to-edge，insets 交给应用自己处理，而这是个加载
  远程网页的壳，网页侧拿不到可靠的 `env(safe-area-inset-*)`；本 App 侧载分发，不受商店
  targetSdk 政策约束。见 `android/variables.gradle` 注释。
- **侧载安装**：用户首次会看到「允许安装未知应用」，属正常；升级直接覆盖安装，不用卸载。
- **进 App 看到的总是最新网页**：这是远程加载的好处，但也意味着网页出问题会同时影响 App。
- 用户反馈「打不开 / 白屏」→ 先看是不是 `offline.html`（网络问题），
  再确认系统 WebView 是否过低（页面会提示去应用商店更新 Android System WebView）。
- 用户反馈「点保存没反应」→ 大概率是旧版 APK（缺 `saveFile`）：让他在设置里更新到最新版本。
