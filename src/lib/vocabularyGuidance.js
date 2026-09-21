// src/lib/vocabularyGuidance.js
//
// =========================================================
// 词汇星球 · 「今天该先做什么」推荐器
// =========================================================
//
// 为什么把这段逻辑单独放出来
// --------------------------
// 用户的反馈是「进了词汇星球不知道要先干什么」。原因是页面把六个模式
// 平铺成等权重按钮，没有任何先后关系，而最显眼的按钮是「添加生词」——
// 那是个内容管理动作，不是"开始学"。
//
// 这段逻辑负责回答那个问题：**现在唯一该做的一步是什么**。
// 它抽成纯函数（不依赖 React、不读 localStorage）有两个好处：
//   ① 可以直接用断言测试三条分支，不用起浏览器
//   ② 规则集中一处，以后要调优先级只改这里
//
// 优先级（都有真实数据支撑，不是固定文案）：
//   ① 今日目标未达标   → 认识新词（flip）——新用户最该做、也最容易开始
//   ② 达标但有积压错题 → 清错题（跳错题本）——遗忘曲线优先于学新词
//   ③ 都已清空         → 巩固练习（match）——自由练习

/** 一轮学习里的固定四步，与 Vocabulary 页的 mode id 对应 */
export const LEARNING_STEPS = [
  { id: "flip", label: "认识", hint: "翻转卡过一遍新词" },
  { id: "quiz", label: "测验", hint: "自测记住多少" },
  { id: "match", label: "巩固", hint: "配对/填空加深印象" },
  { id: "review", label: "清错题", hint: "把答错的复习掉" },
];

export const DEFAULT_DAILY_GOAL = 20;

/**
 * 计算"今天从这里开始"的推荐。
 *
 * @param {object} input
 *   todayWords  今日已学词数
 *   dailyGoal   每日目标词数（缺省 20）
 *   wrongCount  错题本待复习数量
 * @returns {{
 *   recommendId: "flip"|"review"|"match",
 *   reason: string,
 *   ctaLabel: string,
 *   mode: "flip"|"quiz"|"match",
 *   goto: string|null,   // 非空时表示要跳到别的页面（错题本）
 *   goalDone: boolean,
 *   remaining: number,
 *   percent: number,
 * }}
 */
export function getVocabularyGuidance({
  todayWords = 0,
  dailyGoal = DEFAULT_DAILY_GOAL,
  wrongCount = 0,
} = {}) {
  const goal = dailyGoal > 0 ? dailyGoal : DEFAULT_DAILY_GOAL;
  const words = Math.max(0, Math.round(todayWords));
  const remaining = Math.max(0, goal - words);
  const goalDone = words >= goal;
  const percent = Math.min(100, Math.round((words / goal) * 100));

  const base = { goalDone, remaining, percent };

  /* ① 今天还没达标 —— 先认识新词 */
  if (!goalDone) {
    return {
      ...base,
      recommendId: "flip",
      reason: `今天还差 ${remaining} 词达标。用翻转卡过一遍，每张卡点「认识」就算学会一个；答错会自动进错题本。`,
      ctaLabel: "开始认识新词",
      mode: "flip",
      goto: null,
    };
  }

  /* ② 达标了但有积压错题 —— 先清错题 */
  if (wrongCount > 0) {
    return {
      ...base,
      recommendId: "review",
      reason: `今日目标已完成，但错题本里还有 ${wrongCount} 个词没清掉。趁热复习它们，比继续学新词更划算。`,
      ctaLabel: "去清错题",
      mode: "quiz",
      goto: "/wrong-notebook",
    };
  }

  /* ③ 都清空了 —— 巩固练习 */
  return {
    ...base,
    recommendId: "match",
    reason: "今日目标已完成，错题本也是空的。接下来用配对/填空把词从「认得出」练到「用得上」。",
    ctaLabel: "进入巩固练习",
    mode: "match",
    goto: null,
  };
}
