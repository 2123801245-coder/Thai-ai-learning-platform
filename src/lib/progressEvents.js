// src/lib/progressEvents.js
//
// =========================================================
// 学习进度的变化广播（事件名的唯一来源）
// =========================================================
//
// 这些事件在上一轮为了「今天发生了什么」而加的：首页的星系必须在你刚练完
// 的那一刻就有反应，而不是刷新后才知道。四个模块各自写一份字符串很容易
// 漂移（改名一处、另一处静默失联，表现是「有时候会亮有时候不会」），
// 所以名字只在这里定义一次，各模块 import 后原样导出。
//
// ⚠️ 本文件必须保持**零依赖**：`todayActivity.js`（纯映射层，在 node 里跑
// 断言）会 import 它。一旦这里 import 了 axios（courseProgress → api/auth
// 那条链），测试包就会带上 axios 而跑不起来。
// =========================================================

export const PROGRESS_EVENT_NAMES = {
  /** 词汇操练进度（useLearningProgress） */
  learning: "thai-ai-learning-progress-change",
  /** 课程视频进度（courseProgress） */
  course: "thai-ai-course-progress-change",
  /** 媒体学习进度（mediaProgress） */
  media: "thai-ai-media-progress-change",
  /** 口语评分记录（speakingHistory） */
  speaking: "thai-ai-speaking-history-change",
};

/** 会改变「今天做了什么」的全部事件 */
export const TODAY_SOURCE_EVENTS = Object.values(PROGRESS_EVENT_NAMES);

/**
 * 订阅全部进度事件。返回取消订阅函数。
 * 同时监听 `storage`：别的标签页写入时只有它会把消息送过来。
 */
export function subscribeProgressEvents(handler) {
  if (typeof window === "undefined") return () => {};

  TODAY_SOURCE_EVENTS.forEach((name) => window.addEventListener(name, handler));
  window.addEventListener("storage", handler);

  return () => {
    TODAY_SOURCE_EVENTS.forEach((name) => window.removeEventListener(name, handler));
    window.removeEventListener("storage", handler);
  };
}

export default PROGRESS_EVENT_NAMES;
