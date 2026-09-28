import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Info,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import QRCode from "qrcode";

import { ANDROID_APP } from "@/lib/appDownload";
import { absoluteUrl } from "@/lib/siteUrl";
import { getShellInfo, isNativeShell, openExternal } from "@/lib/nativeShell";
import { copyText } from "@/lib/vipConfig";
import { useWorldThemeIsolation } from "@/hooks/useWorldThemeIsolation";

/* =========================================================
   安卓 App 下载落地页（公开）
   =========================================================
   为什么单独做一页而不是只在设置中心放个按钮：
   这一页是要**发出去**的 —— 微信里发给朋友、印在二维码里、贴到群里。
   所以它必须：无需登录、能在微信内置浏览器里打开、桌面访问时给二维码。

   微信的两条限制（页面必须替用户跨过去，不能装作不存在）：
     1. 微信内置浏览器会拦掉 apk 下载 → 提示「右上角 ⋯ → 在浏览器中打开」；
     2. 抓取器不执行 JS → 分享卡片的标题/图来自构建期生成的
        dist/get-app/index.html（见 scripts/build-share-pages.mjs）。
   ========================================================= */

const INK = "#1d1d1f";
const INK_SOFT = "#6e6e73";
const GREEN = "#0b7a5a";

/* APK 文件名从发行信息里取，避免页面里再抄一份版本号 */
const APK_NAME = ANDROID_APP.apkPath.split("/").pop();

/* 运行环境判定：微信内置浏览器要不要给「在浏览器中打开」提示、iOS 要不要
   直接劝退、桌面要不要突出二维码 —— 全靠这几个布尔值。 */
function detectEnv() {
  if (typeof navigator === "undefined") {
    return { wechat: false, ios: false, mobile: false };
  }
  const ua = navigator.userAgent || "";
  /* iPadOS 13+ 伪装成 Macintosh，用触摸点数把它认回来 */
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);

  return {
    wechat: /MicroMessenger/i.test(ua),
    ios,
    mobile: /Android|Mobile|iPad|iPhone|iPod/i.test(ua),
  };
}

const STEPS = [
  {
    title: "点上面的按钮下载",
    body: `浏览器会保存 ${APK_NAME}（约 ${ANDROID_APP.sizeMB} MB）。文件名里的版本号变了，就说明是新包。`,
  },
  {
    title: "若提示「此类文件可能有害」，选「仍要下载」",
    body: "这是安卓对所有非应用商店安装包的标准提醒，不是病毒告警。",
  },
  {
    title: "打开下载好的安装包，允许本次安装",
    body: "首次会问「允许安装未知应用」——允许来自浏览器（或文件管理器）的来源即可。",
  },
  {
    title: "安装完成，用原账号登录",
    body: "学习进度、错题本与 VIP 都在账号里，换设备自动同步。",
  },
];

export default function GetApp() {
  /* 落地页自带配色，不该被站内「视觉世界」重映射（详见 hook 注释） */
  useWorldThemeIsolation();

  const env = detectEnv();
  const native = isNativeShell();

  const apkUrl = absoluteUrl(ANDROID_APP.apkPath);
  const pageUrl = absoluteUrl("/get-app");

  const [qrPage, setQrPage] = useState("");
  const [qrApk, setQrApk] = useState("");
  const [copied, setCopied] = useState("");
  const [shell, setShell] = useState(null);

  /* 两枚二维码都离线生成（站内 qrcode 依赖，同 VipPanel 用法，无外部 API）：
     - qrPage → 安装说明页（微信用户扫它：先看说明，再跳系统浏览器下载）
     - qrApk  → APK 直链（自带浏览器/信任本站的人扫它：一步到安装包）
     两枚颜色不同：说明页墨黑、安装包墨绿，发到群里也好区分。 */
  useEffect(() => {
    let cancelled = false;
    const make = (text, dark, setState) =>
      QRCode.toDataURL(text, {
        width: 260,
        margin: 1,
        color: { dark, light: "#ffffff" },
      })
        .then((url) => !cancelled && setState(url))
        .catch(() => !cancelled && setState(""));

    make(pageUrl, "#1d1d1f", setQrPage);
    make(apkUrl, "#0b7a5a", setQrApk);

    return () => {
      cancelled = true;
    };
  }, [pageUrl, apkUrl]);

  useEffect(() => {
    if (!native) return;
    let alive = true;
    getShellInfo()
      .then((info) => alive && setShell(info))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [native]);

  const flash = (key) => {
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const copyLink = async () => {
    if (await copyText(pageUrl)) flash("link");
  };

  /* 分享：系统分享面板优先（壳里已由 nativeShell 补上），
     不支持就退回复制链接 —— 微信场景下粘贴比调起分享更顺手。 */
  const share = async () => {
    if (typeof navigator?.share === "function") {
      try {
        await navigator.share({ title: "ThaiAI 安卓 App", url: pageUrl });
        return;
      } catch {
        /* 用户取消或系统拒绝：落到复制 */
      }
    }
    copyLink();
  };

  /* 浏览器里走原生链接下载（比 window.open 可靠，不会被拦截成空白页）；
     壳里则交给系统浏览器 —— WebView 自己下不了 apk。 */
  const onDownload = (event) => {
    if (!native) return;
    event.preventDefault();
    openExternal(apkUrl);
  };

  return (
    <div className="apple-ui min-h-screen bg-[#fbfbfd]">
      {/* ---- 顶栏 ---- */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <ArrowLeft className="h-4 w-4" style={{ color: INK_SOFT }} />
            <img
              src="/brand/thaiai-logo-64.png"
              alt="ThaiAI"
              data-no-theme-filter
              className="h-8 w-8 rounded-[9px] shadow-sm"
            />
            <span
              className="text-[17px] font-semibold tracking-[-0.02em]"
              style={{ color: INK }}
            >
              ThaiAI
            </span>
          </Link>

          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition hover:bg-black/[0.04]"
            style={{ color: INK_SOFT }}
          >
            {copied === "link" ? (
              <>
                <Check className="h-3.5 w-3.5" style={{ color: GREEN }} />
                链接已复制
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                分享给朋友
              </>
            )}
          </button>
        </div>
      </header>

      {/* ---- 微信 / iOS 的提前说明：这两条不解决，用户会以为页面坏了 ---- */}
      {env.wechat && (
        <div className="border-b border-amber-500/15 bg-amber-50 px-5 py-3 sm:px-8">
          <div className="mx-auto flex w-full max-w-5xl items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[13px] leading-relaxed text-amber-900">
              微信里点不动下载（微信会拦截安装包）。
              <strong>点右上角 ⋯ → 在浏览器中打开</strong>
              ，就能正常安装；也可以点下方的
              <strong>「复制下载页链接」</strong>，粘贴到手机自带浏览器打开。
            </p>
          </div>
        </div>
      )}

      {/* ---- 首屏 ---- */}
      <section className="px-6 pb-14 pt-12 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <Smartphone className="h-3.5 w-3.5" style={{ color: GREEN }} />
              <span className="text-[12px] sm:text-[13px]" style={{ color: INK_SOFT }}>
                安卓 App · v{ANDROID_APP.versionName} · {ANDROID_APP.sizeMB} MB
              </span>
            </div>

            <h1
              className="mt-6 text-[34px] font-semibold leading-[1.1] sm:text-[46px]"
              style={{ color: INK, letterSpacing: "-0.03em" }}
            >
              把泰语老师
              <br />
              装到手机上
            </h1>

            <p
              className="mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: INK_SOFT }}
            >
              和网页版是同一个账号。装成 App 后：朗读与跟读录音更稳、
              视频与逐句精听切到后台不会断、
              连不上网也能打开看看上次的进度。
            </p>

            {native ? (
              <div className="mt-8 rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
                <p className="flex items-center gap-2 text-[14px] font-medium" style={{ color: INK }}>
                  <Check className="h-4 w-4" style={{ color: GREEN }} />
                  你已经在 App 里了（v{shell?.versionName || ANDROID_APP.versionName}）
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
                  有新版本时会在「设置 → 安卓 App」里提示更新，直接覆盖安装即可，
                  不用卸载，登录状态保留。
                </p>
              </div>
            ) : (
              <>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={apkUrl}
                    onClick={onDownload}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-8 py-3.5 text-[16px] font-medium text-white transition hover:bg-black"
                  >
                    <Download className="h-4 w-4" />
                    下载 APK（{ANDROID_APP.sizeMB} MB）
                  </a>

                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] transition hover:bg-black/[0.04]"
                    style={{ color: INK }}
                  >
                    {copied === "link" ? (
                      <>
                        <Check className="h-4 w-4" style={{ color: GREEN }} />
                        链接已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        复制下载页链接
                      </>
                    )}
                  </button>
                </div>

                <p
                  className="mt-3.5 flex items-center gap-1.5 text-[13px]"
                  style={{ color: INK_SOFT }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: GREEN }} />
                  支持安卓 {ANDROID_APP.minAndroid} 及以上 · 下载自本站，非应用商店分发
                </p>
              </>
            )}

            {env.ios && (
              <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
                <p className="text-[14px] font-medium" style={{ color: INK }}>
                  这台是 iPhone / iPad
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
                  安卓安装包装不到 iOS 上。iPhone 请直接用网页版：Safari 打开本站 →
                  分享 → 「添加到主屏幕」，图标和 App 一样，录音与朗读也能正常用。
                </p>
              </div>
            )}
          </div>

          {/* ---- 双二维码：只在桌面显示。手机上给自己看二维码没有意义 ---- */}
          {!native && !env.ios && !env.mobile && (
            <div className="w-full max-w-md">
              <div className="grid gap-5 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:grid-cols-2">
                {/* 码 ①：安装说明页 —— 给微信用户 / 第一次装的人 */}
                <div className="flex flex-col items-center">
                  <div className="flex h-[148px] w-[148px] items-center justify-center rounded-xl border border-black/[0.04] sm:h-[168px] sm:w-[168px]">
                    {qrPage ? (
                      <img
                        src={qrPage}
                        alt="扫码打开安装说明页"
                        className="h-[136px] w-[136px] sm:h-[156px] sm:w-[156px]"
                      />
                    ) : (
                      <QrCode className="h-7 w-7" style={{ color: INK_SOFT }} />
                    )}
                  </div>

                  <p
                    className="mt-3 text-center text-[13px] font-semibold"
                    style={{ color: INK }}
                  >
                    安装说明（推荐）
                  </p>
                  <p
                    className="mt-1 max-w-[168px] text-center text-[11px] leading-relaxed"
                    style={{ color: INK_SOFT }}
                  >
                    微信里扫码扫这个：先看安装步骤，再跳手机浏览器下载
                  </p>
                </div>

                {/* 码 ②：APK 直链 —— 给已用系统浏览器 / 信任本站的人 */}
                <div className="flex flex-col items-center">
                  <div className="flex h-[148px] w-[148px] items-center justify-center rounded-xl border border-emerald-900/[0.08] sm:h-[168px] sm:w-[168px]">
                    {qrApk ? (
                      <img
                        src={qrApk}
                        alt="扫码直接下载 APK 安装包"
                        className="h-[136px] w-[136px] sm:h-[156px] sm:w-[156px]"
                      />
                    ) : (
                      <QrCode className="h-7 w-7" style={{ color: INK_SOFT }} />
                    )}
                  </div>

                  <p
                    className="mt-3 text-center text-[13px] font-semibold"
                    style={{ color: INK }}
                  >
                    直接下载 APK
                  </p>
                  <p
                    className="mt-1 max-w-[168px] text-center text-[11px] leading-relaxed"
                    style={{ color: INK_SOFT }}
                  >
                    手机浏览器直接扫：一步到安装包，适合已经很熟本站的人
                  </p>
                </div>
              </div>

              <p
                className="mt-3 max-w-md text-center text-[12px] leading-relaxed"
                style={{ color: INK_SOFT }}
              >
                两枚码内容不同：黑色到说明页，墨绿色到安装包。发到群里建议用左边那枚。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---- 安装步骤 ---- */}
      <section className="border-t border-black/[0.06] bg-white px-6 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-5xl">
          <h2
            className="text-[26px] font-semibold sm:text-[34px]"
            style={{ color: INK, letterSpacing: "-0.02em" }}
          >
            安装只要四步
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: INK_SOFT }}>
            安卓装商店外的应用都会问一次权限，通过之后以后升级都不再问。
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-black/[0.06] bg-[#fbfbfd] px-5 py-5"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  {index + 1}
                </div>
                <p className="mt-3.5 text-[15px] font-semibold" style={{ color: INK }}>
                  {step.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-black/[0.06] bg-[#fbfbfd] px-5 py-5">
            <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: INK }}>
              <Info className="h-4 w-4" style={{ color: GREEN }} />
              升级不用卸载
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
              以后收到新版本，直接下载新的安装包覆盖安装即可。卸载重装会丢掉本机缓存
              （账号里的学习记录不受影响，重新登录就会回来）。
            </p>
          </div>
        </div>
      </section>

      {/* ---- 页脚 ---- */}
      <footer className="bg-[#f5f5f7] px-6 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px]" style={{ color: INK_SOFT }}>
            © {new Date().getFullYear()} ThaiAI · 泰语学习空间
          </p>
          <Link
            to="/login"
            className="text-[13px] transition hover:text-[#1d1d1f]"
            style={{ color: INK_SOFT }}
          >
            没有账号？先在网页版免费注册 →
          </Link>
        </div>
      </footer>
    </div>
  );
}
