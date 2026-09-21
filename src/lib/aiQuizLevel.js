// src/lib/aiQuizLevel.js
//
// 入学测评等级 → 词汇测验默认难度档。
//
// 词库 difficulty 取值：beginner / intermediate / advanced（见 src/data/vocabulary.js）。
// 映射逻辑与后端 backend/learnerProfile.js 的 quizDifficultyFor() 保持一致：
//   A0/A1 → beginner     还在打底，先吃透高频词
//   A2/B1 → intermediate 能应付日常交流，混入中级词
//   B2/C1 → advanced     接近真实语速，上专业与书面词汇
//
// 独立成模块（而不是放 placement.js）是因为它同时被
// VocabQuiz 组件与后端对照使用，保持单一数据源语义。

const LEVEL_TO_QUIZ = {
  A0: "beginner",
  A1: "beginner",
  A2: "intermediate",
  B1: "intermediate",
  B2: "advanced",
  C1: "advanced",
};

/** 无画像/等级未知返回 null（调用方保持现有默认行为） */
export function quizDifficultyFor(profile) {
  return LEVEL_TO_QUIZ[profile?.thaiLevel] || null;
}
