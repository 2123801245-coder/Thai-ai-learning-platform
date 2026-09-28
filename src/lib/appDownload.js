/**
 * 安卓壳的发行信息（网页侧）。
 *
 * 与 android/version.properties 保持一致 —— CI 构建 APK 时会校验两处，
 * 不一致就失败，免得网页指向一个不存在的 APK 文件名。
 *
 * 为什么 APK 放在服务端 /uploads/app/ 下：那是后端**持久卷**里的目录（docker
 * 挂载 ./data/uploads），走现有的 /uploads 静态服务，不需要改 nginx 或编排文件，
 * 也不会被前端 dist 的整体替换冲掉。文件名带版本号 = 天然不会命中旧缓存。
 */

export const ANDROID_APP = {
  versionCode: 1,
  versionName: "1.0.0",
  /** 相对路径：开发环境由 vite 代理到后端，生产走同域 nginx */
  apkPath: "/uploads/app/thaiai-1.0.0.apk",
  sizeMB: "3.4",
  minAndroid: "7.0",
};

/** 分享/引导用的完整地址（微信里发出去必须是绝对 URL） */
export function androidApkUrl(siteUrl = "") {
  const base = String(siteUrl || "").replace(/\/+$/, "");
  return `${base}${ANDROID_APP.apkPath}`;
}
