#!/usr/bin/env node
/**
 * 安卓包版本一致性检查。
 *
 * 为什么要检查：APK 的版本号写在 android/version.properties（构建用），
 * 而下载入口指向的文件名写在 src/lib/appDownload.js（网页用）。
 * 这两处一旦不一致，页面上的按钮会指向一个**不存在的 APK**——
 * 只有用户点下去才会发现。所以在这里提前拦住：
 *
 *   node scripts/check-android-app.mjs
 *
 * CI 的 APK 构建流水线会先跑它；本地改完版本号也可以自己跑一遍。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const propsPath = path.join(root, "android", "version.properties");
const webPath = path.join(root, "src", "lib", "appDownload.js");

const fail = (msg) => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};

if (!fs.existsSync(propsPath)) fail(`找不到 ${propsPath}`);
if (!fs.existsSync(webPath)) fail(`找不到 ${webPath}`);

const props = {};
for (const line of fs.readFileSync(propsPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const versionCode = Number(props.versionCode);
const versionName = String(props.versionName || "").trim();

if (!Number.isInteger(versionCode) || versionCode < 1) {
  fail(`android/version.properties 的 versionCode 不是正整数：${props.versionCode}`);
}
if (!versionName) fail("android/version.properties 缺少 versionName");

const web = fs.readFileSync(webPath, "utf8");
const webCode = web.match(/versionCode:\s*(\d+)/)?.[1];
const webName = web.match(/versionName:\s*"([^"]+)"/)?.[1];
const webPath_ = web.match(/apkPath:\s*"([^"]+)"/)?.[1];

if (webCode !== String(versionCode)) {
  fail(
    `版本号不一致：android/version.properties versionCode=${versionCode}，` +
      `src/lib/appDownload.js versionCode=${webCode ?? "<缺失>"}\n` +
      `   两处要一起改（versionCode 每次发布必须递增，否则老版本无法覆盖安装）。`
  );
}
if (webName !== versionName) {
  fail(
    `版本号不一致：android/version.properties versionName=${versionName}，` +
      `src/lib/appDownload.js versionName=${webName ?? "<缺失>"}`
  );
}
if (!webPath_ || !webPath_.endsWith(`thaiai-${versionName}.apk`)) {
  fail(
    `下载地址与版本对不上：appDownload.js 的 apkPath=${webPath_ ?? "<缺失>"}，` +
      `期望以 thaiai-${versionName}.apk 结尾`
  );
}

console.log(
  `✅ 安卓包版本一致：v${versionName} (${versionCode}) → ${webPath_}`
);
