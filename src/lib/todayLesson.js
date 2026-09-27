// src/lib/todayLesson.js
//
// =========================================================
// 今日课程的本地例句进度
// =========================================================
//
// 「今天这节课练到第几句」用 localStorage 记（thai_today_lesson_done:<date>）：
//   - 点一句例句跟读 → markSentenceDone(date, i) 立刻记下
//   - 回到 /loop / 回到对话室 → doneCount(date) 读回来接续
//
// 只存一个数字（已练完的例句数），课程内容本身以服务端
// today_lessons 表为准（PUT /api/ai/today-lesson），这里不重复存课。
// 读写全包 try/catch：隐私模式 / 存储满时静默退化，不拦主流程。
// =========================================================

const key = (date) => `thai_today_lesson_done:${date}`;

const todayKey = () => {
  // 泰国时区 (UTC+7) 日期，与后端 thaiToday() 同口径，避免跨日错位
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
};

/* 记一句例句已练（i = 例句下标）；done = i+1（比它小的都算过了） */
export function markSentenceDone(date, i) {
  try {
    const d = date || todayKey();
    const prev = doneCount(d);
    const next = Math.max(prev, Math.round(Number(i) || 0) + 1);
    localStorage.setItem(key(d), String(next));
    return next;
  } catch {
    return 0;
  }
}

/* 读今天的已练句数 */
export function doneCount(date) {
  try {
    const d = date || todayKey();
    return Math.max(0, Math.round(Number(localStorage.getItem(key(d))) || 0));
  } catch {
    return 0;
  }
}
