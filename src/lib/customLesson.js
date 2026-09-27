// src/lib/customLesson.js
//
// =========================================================
// 「学 · AI 定制新课」→ AI 对话室 的一节课交接
// =========================================================
//
// 「学」拿到的定制课（主题 / 目标 / 生词 / 例句）原本只活在 LearnLoop 的
// React state 里：点「去 AI 老师练这节课」跳到对话室，老师对这节课一无所知，
// 后续只能从零开始寒暄。这里用一个会话级的短期存储把课带过去：
//
//   LearnLoop 点「去 AI 老师练这节课」→ saveCustomLesson(rec) + /conversation?lesson=1
//   对话室读 ?lesson=1                → loadCustomLesson() → 交给语音老师当场景
//
// 只存交接真正要用的字段（主题 / 目标 / 提示 / 生词 / 例句），并且关掉标签页
// 就失效（sessionStorage）；随堂练习的答案不往对话室带 —— 老师不需要它，
// 多存一份反而多一个会失同源的地方。
// =========================================================

const KEY = "thai_learn_loop_lesson";

const asText = (v) => String(v ?? "").trim();

/* 存一节课：字段缺失/不是对象都不报错，宁可让对话室退化成普通聊天 */
export function saveCustomLesson(rec) {
  if (!rec || typeof rec !== "object") return null;

  const lesson = {
    topic: asText(rec.topic),
    goal: asText(rec.goal),
    tip: asText(rec.tip),
    nextTopic: asText(rec.nextTopic),
    vocab: (Array.isArray(rec.vocab) ? rec.vocab : [])
      .slice(0, 7)
      .map((v) => ({ th: asText(v?.th || v?.thai), roman: asText(v?.roman), cn: asText(v?.cn || v?.meaning) }))
      .filter((v) => v.th),
    sentences: (Array.isArray(rec.sentences) ? rec.sentences : [])
      .slice(0, 4)
      .map((s) => ({ th: asText(s?.th), roman: asText(s?.roman), cn: asText(s?.cn) }))
      .filter((s) => s.th),
  };

  if (!lesson.topic) return null;

  try {
    sessionStorage.setItem(KEY, JSON.stringify(lesson));
  } catch (e) {
    /* 隐私模式/存储满：交接失败，但不该拦住跳转 */
    return null;
  }
  return lesson;
}

/* 读回这节课；没存过或存坏了都返回 null（对话室照常可用） */
export function loadCustomLesson() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object" || !asText(raw.topic)) return null;
    return {
      topic: asText(raw.topic),
      goal: asText(raw.goal),
      tip: asText(raw.tip),
      nextTopic: asText(raw.nextTopic),
      vocab: Array.isArray(raw.vocab) ? raw.vocab : [],
      sentences: Array.isArray(raw.sentences) ? raw.sentences : [],
    };
  } catch (e) {
    return null;
  }
}

/* 换了主题：旧课的交接立刻作废，免得对话室还拿着上一节课 */
export function clearCustomLesson() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (e) {
    /* 清不掉也不影响 */
  }
}
