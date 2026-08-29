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

// ============================================================
// 今日 AI 老师免费对话额度
// 返回: { freeChatDaily, usedToday, remainingToday, isVip }
// 未登录会 401 —— 调用方需捕获
// ============================================================

export const getAiTeacherQuota = () =>
  api.get("/ai/teacher/quota");

// 学生长期记忆摘要（「老师记得你」）
export const getAiTeacherMemory = () =>
  api.get("/ai/teacher/memory");

export default { askAiTeacher, getAiTeacherQuota, getAiTeacherMemory };
