// src/api/newsListening.js
//
// 新闻听力练习记录 API 客户端
// 复用 auth.js 导出的 axios 实例（自带 baseURL + Bearer token 拦截器）

import api from "./auth";

// 记录一次练习（填空成绩 + 跟读分数）
// data: { newsId, newsTitle, clozeCorrect?, clozeTotal?, repeatScores?: number[] }
export const recordNewsListening = (data) =>
  api.post("/news/listening/record", data);

// 获取汇总统计（每日新闻数 / 填空正确率 / 跟读平均分 / 最近记录）
export const getNewsListeningStats = () =>
  api.get("/news/listening/stats");

// ============================================================
// 会员配额（听音填空：免费用户每日限 N 题，VIP 无限）
// ============================================================

// 今日剩余题数
export const getNewsListeningQuota = () =>
  api.get("/news/listening/quota");

// 扣减 N 题（每答一题调用一次，VIP 后端自动跳过）
// data: { questions?: number }
export const consumeNewsListeningQuota = (data = {}) =>
  api.post("/news/listening/consume", data);
