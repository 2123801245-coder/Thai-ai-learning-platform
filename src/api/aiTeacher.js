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

// 根据学生画像 + 长期记忆生成定制课程推荐（轻量免费）
// data: { message, action: "recommend", profile }
export const getAiTeacherRecommendation = (profile) =>
  api.post("/ai/teacher", {
    message: "请为我生成定制课程",
    action: "recommend",
    profile,
  });


// 学生长期记忆摘要（「老师记得你」）
export const getAiTeacherMemory = () =>
  api.get("/ai/teacher/memory");

// 手动修正 AI 老师记住的学生画像（个人中心编辑）
export const updateAiTeacherMemory = (memory) =>
  api.put("/ai/teacher/memory", { memory });


// ============================================================
// 语音识别（Azure 兜底）：浏览器不支持 Web Speech API 时，
// 把 WAV 上传到后端 /speaking/transcribe 转成文本。
// formData: { audio(file), language }
// ============================================================

export const transcribeSpeech = (formData) =>
  api.post("/speaking/transcribe", formData, { timeout: 30000 });

export default {
  askAiTeacher,
  getAiTeacherQuota,
  getAiTeacherRecommendation,
  getAiTeacherMemory,
  updateAiTeacherMemory,
  transcribeSpeech,
};

