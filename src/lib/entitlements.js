// =========================================================
// ThaiAI 免费 / VIP 权益 · 单一数据源（Entitlements）
// ---------------------------------------------------------
// 目的：**权益文案与代码实现只有一处真值**。
//   之前 VipPanel 手写的权益文案和实际实现漂移了三处
//   （写了「5 门 VIP 课」实际 10 门、把本来免费的词书/学习数据
//   当成 VIP 权益卖），本文件就是那次盘点的落地。
//
// 消费者：
//   - VipPanel      → VIP_BENEFITS / COMPARE_ROWS / FREE_FOREVER / FREE_NOTE
//   - CourseDetail  → isLessonLocked / firstAccessibleLesson
//   - LessonVideo   → isLessonLocked
//   - Home          → isLessonLocked
//
// 配额数字（每日次数）由后端配置，管理端「设置中心」可调；
// FREE_QUOTA_DEFAULTS 只是默认值，用于对外文案。
// =========================================================

import {
  MessageCircle,
  Video,
  Mic,
  Headphones,
  Sparkles,
  BookOpenCheck,
} from "lucide-react";

/* 免费层每日额度（后端默认值，可被管理端调整） */
export const FREE_QUOTA_DEFAULTS = {
  aiChatDaily: 10,
  speakingWordDaily: 10,
  newsListeningDaily: 10,
};

/* 免费课程（isVip: false）每门前 N 课可试读 —— 与 lessons.js 的
   free 标记一致（发音入门 / 基础拼读 / 日常泰语表达 前 3 课）。 */
export const FREE_PREVIEW_LESSONS = 3;

/* VIP 课程数量提示：courses.js 里 isVip === true 的课（含精读）。
   文案里的「10 门」= 精读 1 + 进阶 9（其中 4 门尚未上线、无课时数据，
   所以权益描述里补了「新课上线即解锁」）；改 courses.js 时记得同步。 */
export const VIP_COURSE_COUNT = 10;

/* 免费层：完全免费、不设 VIP 门控的内容（实现如此，文案就明说，
   不当成 VIP 权益卖）。词条数来自 src/data/vocabAllBooks.js。 */
export const FREE_FOREVER = [
  {
    text: "30 本词书 · 近 6000 词条",
    desc: "全部免费开放，不设 VIP 门控",
  },
  {
    text: "能力雷达 · 成长曲线",
    desc: "学习数据完整展示，不锁任何图表",
  },
  {
    text: "基础练习不限次",
    desc: "字母表 · 词汇配对 · 句子填空 · 分词练习 · 错题本",
  },
];

/* VIP 权益列表（VipPanel 展示；icons 与文案同处一地） */
export const VIP_BENEFITS = [
  {
    icon: MessageCircle,
    text: "AI 老师无限对话",
    desc: `免费版每日 ${FREE_QUOTA_DEFAULTS.aiChatDaily} 次；VIP 不限次数，含语音输入与情景模拟`,
  },
  {
    icon: BookOpenCheck,
    text: `全部 ${VIP_COURSE_COUNT} 门课程解锁`,
    desc: "精读 14 课全开（含结业测试与证书）+ 发音/语法/听力/会话/文化/商务进阶课；新课上线即解锁",
  },
  {
    icon: Video,
    text: "全部视频与课时",
    desc: `视频库全部视频 + 各课全部课时；免费版每门课试看前 ${FREE_PREVIEW_LESSONS} 课`,
  },
  {
    icon: Mic,
    text: "完整口语训练",
    desc: "句子/段落跟读 + Azure 专业发音评测（免费版仅单词模式）",
  },
  {
    icon: Headphones,
    text: "新闻听力无限题",
    desc: `免费版每日 ${FREE_QUOTA_DEFAULTS.newsListeningDaily} 题；VIP 无限听音填空练习`,
  },
  {
    icon: Sparkles,
    text: "新课程抢先学",
    desc: "进阶课持续更新，VIP 第一时间解锁全部新内容",
  },
];

/* 免费 vs VIP 对比表（只放真的有差异的行；
   词书 / 学习数据这类「两边都免费」的不进对比表，见 FREE_FOREVER） */
export const COMPARE_ROWS = [
  {
    label: "AI 泰语老师",
    free: `每日 ${FREE_QUOTA_DEFAULTS.aiChatDaily} 次对话`,
    vip: "无限对话 · 语音输入",
  },
  {
    label: "口语训练",
    free: `仅单词模式 · 每日 ${FREE_QUOTA_DEFAULTS.speakingWordDaily} 次`,
    vip: "句子 + 段落 + 专业评分",
  },
  {
    label: "新闻听力",
    free: `每日 ${FREE_QUOTA_DEFAULTS.newsListeningDaily} 题`,
    vip: "无限听音填空",
  },
  {
    label: "课程与课时",
    free: `每门课试看前 ${FREE_PREVIEW_LESSONS} 课`,
    vip: `全部 ${VIP_COURSE_COUNT} 门课程 · 全部课时`,
  },
  {
    label: "精读结业测试",
    free: "第 1 课试读",
    vip: "结业测试 + 证书",
  },
];

/* 免费层说明文案（VipPanel 底部） */
export const FREE_NOTE = {
  title: "免费层：第一个学习循环能完整走完",
  body: `发音 / 拼读 / 日常表达 3 门课每门前 ${FREE_PREVIEW_LESSONS} 课免费，精读第 1 课试读，视频库每个分类都留 1 条免费精讲；每天还有 AI 对话与练习额度，随时可以升级。`,
};

/* =========================================================
   课时锁定判定 —— 全站统一规则
   ---------------------------------------------------------
   规则的唯一真值：**看课时自己的 free 标记**，不看课程 isVip。
   免费课（isVip: false）只开放前几课，其余同样需要 VIP；
   VIP 课程只开放试看课。
========================================================= */

export function isLessonLocked({ lesson, isVipUser = false } = {}) {
  if (isVipUser) return false;
  return lesson?.free !== true;
}

/* 第一节能看的课时（「开始学习」/「继续学习」找不到位置时兜底） */
export function firstAccessibleLesson(lessons = [], isVipUser = false) {
  return (
    lessons.find((lesson) => !isLessonLocked({ lesson, isVipUser })) || null
  );
}

/* 视频学习库同款判定：看 video.free（视频库每个分类留 1 条免费） */
export function isVideoLocked({ video, isVipUser = false } = {}) {
  if (isVipUser) return false;
  return video?.free !== true;
}
