// src/api/aiTeacher.js
//
// AI 泰语老师 API 客户端
// 复用 auth.js 导出的 axios 实例（自带 baseURL + Bearer token 拦截器）

import api from "./auth";

// ============================================================
// 调用 AI 泰语老师
// data: { message, action }   action: chat | pronunciation | speaking
// ============================================================

export const askAiTeacher = (data) =>
  api.post("/ai/teacher", data);

export default { askAiTeacher };
