// src/api/vocabulary.js
//
// 词汇 / 对话场景 API 客户端
// 复用 auth.js 导出的 axios 实例（自带 baseURL + Bearer token 拦截器）

import api from "./auth";

// ============================================================
// 词库
// ============================================================

// 获取词库（后端已内置 src/data/vocabulary.js 的同步数据）
// 可选参数：{ category, difficulty }
export const getVocabulary = (params = {}) =>
  api.get("/vocabulary", { params });

// ============================================================
// 词汇学习进度（需登录）
// ============================================================

// 获取当前用户词汇进度（认识/不认识/收藏/已掌握）
export const getVocabularyProgress = () =>
  api.get("/vocabulary/progress");

// 保存单个单词状态
// data: { wordId, status?, favorite?, mastered? }
export const saveVocabularyProgress = (data) =>
  api.post("/vocabulary/progress", data);

// ============================================================
// 对话场景
// ============================================================

// 获取 AI 对话场景脚本（后端已内置 src/data/conversations.js 的同步数据）
export const getConversationScenes = () =>
  api.get("/conversations/scenes");
