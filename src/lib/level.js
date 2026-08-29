// src/lib/level.js

// =========================================================
// ThaiAI 等级 / 经验值（与 useLearningProgress 保持一致）
// =========================================================

const LEVELS = [
  { min: 0, name: "初学者" },
  { min: 150, name: "基础学习者" },
  { min: 400, name: "基础学习者" },
  { min: 700, name: "中级学习者" },
  { min: 1100, name: "中级学习者" },
  { min: 1600, name: "进阶学习者" },
  { min: 2200, name: "进阶学习者" },
  { min: 3000, name: "高级学习者" },
  { min: 4000, name: "高级学习者" },
  { min: 5000, name: "泰语大师" },
];

// 根据 XP 计算等级、名称、当前区间进度百分比
export const getLevelInfo = (xp = 0) => {
  let level = 1;
  let name = "初学者";
  let prev = 0;
  let next = LEVELS[1]?.min ?? 150;

  LEVELS.forEach((item, index) => {
    if (xp >= item.min) {
      level = index + 1;
      name = item.name;
      prev = item.min;
      next = LEVELS[index + 1]?.min ?? null;
    }
  });

  const percent =
    next != null && next > prev
      ? Math.min(
          100,
          Math.round(((xp - prev) / (next - prev)) * 100)
        )
      : 100;

  return { level, name, prev, next, percent };
};
