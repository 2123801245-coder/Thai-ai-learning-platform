import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 安卓壳（Capacitor）桥接层。
 *
 * 壳做的事很少：加载 https://thai-ai.online 并补上 WebView 里的三个缺口。
 * 本文件是网页这一侧的补丁，浏览器里访问时每个函数都是无操作，
 * 不会改变现有网页行为（所以不需要在各页面里判断「是不是 App」）。
 *
 * 补的是这三件：
 *   1. window.open：WebView 打开不了新窗口（Capacitor 8 没有实现 onCreateWindow），
 *      VIP 收银台那种 window.open(url, "_blank") 会**静默失败**，用户点了没反应。
 *      这里改走系统浏览器。
 *   2. navigator.share：WebView 里没有这个 API，成就卡/证书分享会退化成下载图片。
 *      这里用壳的原生分享面板补回来（含图片，走 FileProvider）。
 *   3. 保存图片：`a.download = ...; a.href = canvas.toDataURL(); a.click()` 这套
 *      在浏览器里能存图，在 WebView 里**点了毫无反应**（WebView 不会下载 data:/blob:）。
 *      站内场景证书、学习成就图、世界明信片都走这条路，这里改走原生 Shell.saveFile。
 *   4. 壳版本信息：给「关于」类界面判断是否需要让用户更新 APK。
 *
 * 依赖的 Shell 插件定义在 android/app/src/main/java/online/thaiai/app/ShellPlugin.java。
 */

// 分享图片上限：原生侧解码 base64 进内存，太大容易 OOM。
// 定得比原生硬上限（12MB）更保守，超了就走原来的下载图兜底。
const MAX_SHARE_FILE_BYTES = 8 * 1024 * 1024;

const Shell = registerPlugin("Shell");

let installed = false;

/** 是否运行在安卓壳里（浏览器/PWA 返回 false） */
export function isNativeShell() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** 用系统浏览器打开外链；普通浏览器环境退化成新标签页。传相对路径也安全（会补成绝对 URL） */
export async function openExternal(url) {
  if (!url) return false;

  // 原生 Intent 只认真实 URL：相对路径（如 /uploads/app/xxx.apk）必须先补全
  let absolute = String(url);
  try {
    absolute = new URL(absolute, window.location.href).href;
  } catch {
    /* 保持原样，交给下层报错 */
  }

  if (!isNativeShell()) {
    window.open(absolute, "_blank", "noopener,noreferrer");
    return true;
  }
  try {
    await Shell.openExternal({ url: absolute });
    return true;
  } catch {
    // 插件不可用（旧版本壳）时至少不要让点击变成死链
    window.open(absolute, "_blank", "noopener,noreferrer");
    return false;
  }
}

/** 读取壳的版本信息；浏览器里返回 null */
export async function getShellInfo() {
  if (!isNativeShell()) return null;
  try {
    return await Shell.appInfo();
  } catch {
    return null;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function canSharePayload(payload, files) {
  if (!files || files.length === 0) return true;
  return files.every((f) => f && typeof f.size === "number" && f.size > 0 && f.size <= MAX_SHARE_FILE_BYTES);
}

async function nativeShare(payload = {}) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  const encoded = [];
  for (const file of files) {
    encoded.push(await fileToDataUrl(file));
  }
  await Shell.share({
    title: payload.title || "",
    text: payload.text || "",
    url: payload.url || "",
    files: encoded,
  });
}

/**
 * 把外链交给系统浏览器。
 * 判定标准只看「是不是本站」：站内链接保持原样（同窗口导航），
 * 跨域与自定义 scheme（weixin://、alipays://、tel: 等）一律外抛。
 */
function patchWindowOpen() {
  const originalOpen = window.open;
  if (typeof originalOpen !== "function") return;

  window.open = function patchedOpen(url, target, features) {
    if (!url) return originalOpen.call(window, url, target, features);

    let absolute;
    try {
      absolute = new URL(String(url), window.location.href);
    } catch {
      return originalOpen.call(window, url, target, features);
    }

    const sameOrigin = absolute.origin === window.location.origin;
    if (sameOrigin) return originalOpen.call(window, url, target, features);

    // 跨域：系统浏览器 / 对应 App（微信、支付宝收银台）
    openExternal(absolute.href);
    return null;
  };
}

function patchNavigatorShare() {
  if (typeof navigator.share === "function" && typeof navigator.canShare === "function") return;

  const shareFn = (payload) => nativeShare(payload);
  const canShareFn = (payload) => canSharePayload(payload, payload?.files);

  try {
    if (typeof navigator.share !== "function") {
      Object.defineProperty(navigator, "share", { value: shareFn, configurable: true, writable: true });
    }
    if (typeof navigator.canShare !== "function") {
      Object.defineProperty(navigator, "canShare", { value: canShareFn, configurable: true, writable: true });
    }
  } catch {
    // 某些 WebView 不允许改写 navigator：那就保持原状，分享按钮会走下载兜底
  }
}

/** blob: 原生读不到，先在这里取回内容转成 data URL */
async function toDataUrl(url) {
  if (url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return fileToDataUrl(blob);
}

/**
 * 保存图片/文件到设备（相册或「下载」）。
 *
 * 浏览器里返回 false（交给浏览器自己的下载行为）；壳里交给原生：
 * Android 10+ 走 MediaStore，不需要任何权限。
 */
export async function saveFile(url, filename = "") {
  if (!url || !isNativeShell()) return false;
  const dataUrl = await toDataUrl(url);
  // 原生侧解码 base64 进内存，这里先拦一道（base64 比原文件大约 1/3）
  if (dataUrl.length > MAX_SHARE_FILE_BYTES * 1.35) {
    throw new Error("file too large to save");
  }
  await Shell.saveFile({ dataUrl, filename });
  return true;
}

/** 保存失败时退化成系统分享面板：用户仍能「保存到相册」或发给别人，而不是毫无反应 */
async function downloadToDevice(url, filename) {
  try {
    await saveFile(url, filename);
  } catch {
    try {
      const blob = await (await fetch(url)).blob();
      await nativeShare({
        title: filename || "ThaiAI",
        files: [new File([blob], filename || "thaiai.png", { type: blob.type || "image/png" })],
      });
    } catch {
      // 两条路都不通：保持与浏览器里被拦截时一致的「无反应」
    }
  }
}

/**
 * 接住网页的「保存图片」。
 *
 * 站内三处（场景证书、学习成就图、世界明信片）都是现建一个游离的 <a>，
 * 设好 download + data: 地址后直接 .click() —— 元素没进 DOM，事件不会冒泡到
 * document，所以只能在原型上拦 click。判定条件卡得很死（必须同时有 download
 * 属性和本地 data:/blob: 地址），不会碰到页面里正常的链接跳转。
 */
let anchorDownloadPatched = false;

function patchAnchorDownload() {
  const proto = typeof HTMLAnchorElement !== "undefined" ? HTMLAnchorElement.prototype : null;
  if (!proto || typeof proto.click !== "function" || anchorDownloadPatched) return;

  const originalClick = proto.click;
  anchorDownloadPatched = true;

  proto.click = function patchedAnchorClick(...args) {
    try {
      const href = this.href || "";
      const local = href.startsWith("blob:") || href.startsWith("data:");
      if (this.hasAttribute("download") && local) {
        // 网页调用方是同步的，保存异步做；原生成功后自己弹提示
        downloadToDevice(href, this.getAttribute("download") || "");
        return undefined;
      }
    } catch {
      // 判定失败就落回默认行为
    }
    return originalClick.apply(this, args);
  };
}

/** 在应用挂载前调用一次；重复调用无副作用 */
export function installNativeShell() {
  if (installed || typeof window === "undefined") return isNativeShell();
  installed = true;
  if (!isNativeShell()) return false;

  patchWindowOpen();
  patchNavigatorShare();
  patchAnchorDownload();
  document.documentElement.classList.add("native-shell");
  return true;
}
