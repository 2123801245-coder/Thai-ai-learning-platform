// src/api/vocabStats.js
//
// 词汇测验学习记录 API 客户端
// 复用 auth.js 导出的 axios 实例（自带 baseURL + Bearer token 拦截器）

import api from "./auth";

// 记录一次词汇测验（错题本 / 生词本 / 词书）
// data: { quizType, difficulty, source: 'book' | 'wrong', correct, total }
export const recordVocabQuiz = (data) =>
  api.post("/vocabulary/quiz/record", data);

// 获取汇总统计（测验次数 / 正确率 / 最高分 / 最近记录）
export const getVocabQuizStats = () =>
  api.get("/vocabulary/quiz/stats");
