// src/api/thai.js
//
// 泰语分词 + 词汇释义 API 客户端
//
// POST /api/thai/segment  { text, limit? }
//   → { success, tokens: [{ th, roman, cn, pos, source }] }
//
// source 说明：
//   dict  本地词典（backend/data/thaiDict.json，5234 词条）
//   cache SQLite 缓存（此前 AI 补过的词）
//   ai    本次 AI 老师现补的
//   none  词典和 AI 都没给出来（前端显示原始词即可）

import api from "./auth";

export const segmentThai = (text, limit = 12) =>
  api.post("/thai/segment", { text, limit }, { timeout: 20000 });

export default { segmentThai };
