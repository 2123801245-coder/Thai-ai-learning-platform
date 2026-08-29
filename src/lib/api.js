// =========================================================
// 后端 API / 静态资源基地址（统一配置，禁止散落硬编码）
// =========================================================
// 生产部署：构建时用环境变量指向后端，例如
//   VITE_API_BASE_URL=https://api.thaiai.app
// 未设置时默认同源（前端与后端部署在同一域名下，如 nginx 反代）。
// 本地开发：vite.config.js 已把 /api /videos /uploads /subtitles
// 代理到 http://localhost:3001，无需在此配置。

const envBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// 后端 API 基地址（已含 /api 前缀）
export const API_BASE_URL = envBase ? `${envBase}/api` : "/api";

// 后端静态资源基地址（头像 /uploads、视频 /videos、字幕 /subtitles）
export const SERVER_BASE_URL = envBase || "";
