// backend/env.js
//
// ============================================================
// 确定性加载 .env —— 不依赖「启动时的工作目录」
// ============================================================
//
// 之前的写法是各处 `dotenv.config()`，它只认 process.cwd()/.env。
// 于是：
//
//   cd 仓库根 && node backend/app.js     → cwd=仓库根   → 找到 .env  ✅
//   cd backend && node app.js            → cwd=backend   → 找不到    ❌
//   systemd/pm2/docker 指定 WorkingDirectory=backend    → 找不到    ❌
//
// 找不到 .env 的直接后果不是「启动失败」，而是**无声降级**：
// DEEPSEEK_API_KEY / SPEECH_KEY 为空 → AI 老师返回 503「未配置」、
// 口语评测 azureConfigured=false 自动退回浏览器本地估算、
// 新闻翻译静默不翻。所有 AI 服务都像「断了」。
//
// 本模块按固定优先级加载（先命中先赢，已存在的进程环境变量永远优先）：
//
//   1. backend/.env        部署时把密钥放在后端目录（常见做法）
//   2. <仓库根>/.env       本地开发（npm run dev 等）
//   3. $PWD/.env           兜底：以任意目录启动时仍能读到
//
// 用法：在入口第一行 `import "./env.js";`（必须在其它 import 之前，
// 因为 route 模块会在顶层读取 process.env）。
//
// docker-compose / 系统环境变量注入的密钥优先级最高，不会被文件覆盖。

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const backendDir = path.dirname(fileURLToPath(import.meta.url));

/** 按优先级排列的候选 .env 路径 */
export const ENV_CANDIDATES = [
  path.join(backendDir, ".env"),
  path.join(backendDir, "..", ".env"),
  path.join(process.cwd(), ".env"),
];

/** 本次实际加载到的 .env（诊断用，不含任何值） */
export const loadedEnvFiles = [];

for (const file of ENV_CANDIDATES) {
  let exists = false;
  try {
    exists = fs.existsSync(file);
  } catch {
    exists = false;
  }
  if (!exists) continue;

  // override: false —— 已存在的环境变量（docker/systemd/命令行）始终优先
  // quiet: true      —— 不往日志里打印「injected env …」噪声（启动日志保持干净）
  const result = dotenv.config({ path: file, override: false, quiet: true });
  if (result?.error) continue;
  if (!loadedEnvFiles.includes(file)) loadedEnvFiles.push(file);
}

/** 给状态自检用的可读描述 */
export function describeEnvSources() {
  return {
    loaded: loadedEnvFiles.map((f) => f.replace(process.env.HOME || "", "~")),
    candidates: ENV_CANDIDATES.map((f) => f.replace(process.env.HOME || "", "~")),
  };
}

export default loadedEnvFiles;
