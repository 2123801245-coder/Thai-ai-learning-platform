// src/lib/siteUrl.js
//
// 站点对外地址：**分享链接必须是绝对 URL**。
//
// 分享出去的东西会被别人在微信 / 浏览器里打开，或者被爬虫抓去生成卡片；
// 这两条路都不认「相对路径」或「本机地址」，所以这里统一给一个真源：
//
//   VITE_SITE_URL=https://thai-ai.online   （见 .env.example，与 index.html 的
//                                            og:image / og:url 用的是同一个变量）
//
// 没配置时退回当前 origin —— 本地开发、内网预览都能直接点开分享链接。

const raw = (import.meta.env.VITE_SITE_URL || "").trim();

export const SITE_URL = (
  raw || (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/+$/, "");

/** 把站内路径拼成绝对地址（已带域名的完整 URL 原样返回）。 */
export function absoluteUrl(pathname = "/") {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
