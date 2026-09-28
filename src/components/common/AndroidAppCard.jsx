import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Download, Smartphone } from "lucide-react";
import { ANDROID_APP } from "@/lib/appDownload";
import { getShellInfo, isNativeShell, openExternal } from "@/lib/nativeShell";

/**
 * 安卓 App 入口。
 *
 * 两种身份说两种话：
 *   - 在浏览器里：给下载按钮 + 安装说明（安卓要「允许安装未知应用」）
 *   - 在 App 壳里：显示当前版本；有新版才出现更新按钮
 *     （覆盖安装不会丢登录态，但**不能**先卸载）
 */
export default function AndroidAppCard() {
  const native = isNativeShell();
  const [shell, setShell] = useState(null);

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

  const currentCode = Number(shell?.versionCode || 0);
  const hasUpdate = native && currentCode > 0 && currentCode < ANDROID_APP.versionCode;

  const download = () => {
    openExternal(ANDROID_APP.apkPath);
  };

  return (
    <section className="premium-glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.08]">
            <Smartphone className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/85">安卓 App</div>

            {native ? (
              <div className="mt-1 text-[11px] leading-relaxed text-white/40">
                当前版本 v{shell?.versionName || "…"}（内部版本 {shell?.versionCode ?? "…"}）
                {hasUpdate ? (
                  <span className="text-emerald-300/80">
                    {" "}
                    · 有新版本 v{ANDROID_APP.versionName}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 text-[11px] leading-relaxed text-white/40">
                装到手机上：朗读与跟读录音更稳，视频与逐句精听不会因为切后台断掉。
                <br />
                约 {ANDROID_APP.sizeMB} MB · 支持安卓 {ANDROID_APP.minAndroid} 及以上
              </div>
            )}
          </div>
        </div>

        {native ? (
          hasUpdate ? (
            <button
              type="button"
              onClick={download}
              className="shrink-0 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              更新
            </button>
          ) : (
            <span className="mt-1 flex shrink-0 items-center gap-1 text-[11px] text-emerald-300/70">
              <Check className="h-3.5 w-3.5" />
              已是最新
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={download}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
          >
            <Download className="h-3.5 w-3.5" />
            下载 APK
          </button>
        )}
      </div>

      {!native && (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/30">
          下载后在通知栏点安装包；首次会提示「允许安装未知应用」，允许即可。
          <span className="text-white/45">升级直接覆盖安装，不用卸载，登录状态保留。</span>
          <br />
          {/* 详细步骤、二维码、发给朋友的链接都在公开下载页上 */}
          <Link
            to="/get-app"
            className="mt-1.5 inline-block font-semibold text-emerald-300/80 underline underline-offset-2 transition hover:text-emerald-200"
          >
            查看安装说明 / 分享给朋友 →
          </Link>
        </p>
      )}
    </section>
  );
}
