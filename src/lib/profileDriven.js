// src/lib/profileDriven.js
//
// =========================================================
// 画像驱动：把「学习画像」翻译成产品行为
// =========================================================
//
//  1) 默认词书   按等级 + 画像关键词挑一本，等级变化时自动切换
//                （用户自己选过词书时，只在「重新测试 / 等级变化」才覆盖）
//  2) 课程推荐   按目标 / 方向 / 兴趣 / 学习方式给课程打分排序，
//                可立即学的永远排在前面，其次是画像最匹配的
//  3) 每日任务   等级决定词量与时长，画像追加 1 项定向任务
//
// 一切都「无画像即退化」：没有画像时返回中性结果，页面行为与以前一致。
// =========================================================

import { getLevelMeta, optionById } from "@/lib/placement";
import { getSavedBookId, getVocabBooks, saveBookId } from "@/lib/wordBooks";

/* =========================================================
   一、默认词书
========================================================= */

export const PROFILE_DEFAULTS_KEY = "thai_ai_profile_defaults_v1";

// 等级 → 建议词书名称关键词（越靠前越优先）
const LEVEL_BOOK_HINTS = {
  A0: ["问候", "数字", "基础泰语1", "日常"],
  A1: ["日常", "生活泰语", "时间", "地点"],
  A2: ["生活泰语", "旅行", "点餐泰语", "购物泰语", "人物"],
  B1: ["文化泰语", "交通泰语", "健康泰语", "情绪泰语"],
  B2: ["经济泰语", "职业泰语", "科技泰语", "情绪泰语"],
  C1: ["政治泰语", "经济泰语", "法律泰语", "科技泰语"],
};

// 画像关键词 → 词书（与 placement.js 的推荐互补：这里只做兜底）
const PROFILE_BOOK_HINTS = {
  travel: ["旅行", "交通泰语", "点餐泰语"],
  business: ["商务泰语", "经济泰语"],
  study: ["校园泰语", "学习"],
  drama: ["情绪泰语", "日常"],
  music: ["情绪泰语", "文化泰语"],
  // 兴趣媒体选项里的其它 id（song / movie / variety 等）
  song: ["情绪泰语", "文化泰语"],
  movie: ["情绪泰语", "日常"],
  variety: ["日常", "生活泰语"],
  culture: ["文化泰语", "食物泰语"],
  major: ["生活泰语", "学习", "日常"],
  tourism: ["点餐泰语", "旅行", "购物泰语"],
  news: ["政治泰语", "经济泰语"],
  academic: ["学习", "科技泰语"],
  newmedia: ["日常", "生活泰语"],
  food: ["食物泰语", "点餐泰语"],
  novel: ["文化泰语"],
  tiktok: ["日常"],
};

/**
 * 给一本词书打分（两者都命中最高）。
 *
 * 等级权重（3.0）略高于画像权重（2.2），所以：
 *   - 同时命中等级与画像 → 最高分（5.2），最该选它
 *   - 只命中等级 → 3.0 左右，仍优先于只命中画像（2.2）
 *   - 提示词在数组里越靠前，得分越高（尊重手动排的优先序）
 * 这样「按等级选词书」始终成立，画像只在同等级内部做偏向。
 */
function scoreBook(book, levelHints = [], profileHints = []) {
  const name = String(book?.name || "");

  const levelIndex = levelHints.findIndex((hint) => name.includes(hint));
  const profileIndex = profileHints.findIndex((hint) => name.includes(hint));

  const levelScore = levelIndex >= 0 ? 3 - levelIndex * 0.15 : 0;
  const profileScore = profileIndex >= 0 ? 2.2 - profileIndex * 0.15 : 0;

  return levelScore + profileScore;
}

/**
 * 挑一本画像最合适的词书。
 * books 可传入已加载的词书列表（LearnLoop 已持有，避免重复扫描全量词库）。
 */
export function pickDefaultBook(profile, books = null) {
  let list = books;

  if (!list) {
    try {
      list = getVocabBooks() || [];
    } catch (error) {
      console.error("读取词书失败:", error);
      return null;
    }
  }

  if (!list.length) return null;

  const levelHints = LEVEL_BOOK_HINTS[profile?.thaiLevel] || [];

  const profileHints = [
    ...(PROFILE_BOOK_HINTS[profile?.learningGoal] || []),
    ...(profile?.professionalDirection || []).flatMap(
      (id) => PROFILE_BOOK_HINTS[id] || []
    ),
    ...(profile?.mediaInterest || []).flatMap(
      (id) => PROFILE_BOOK_HINTS[id] || []
    ),
  ];

  // 分数最高的一本（同分时保留词书列表原序，结果可预期）
  return list.reduce((best, book) => {
    if (!best) return book;

    const bookScore = scoreBook(book, levelHints, profileHints);
    const bestScore = scoreBook(best, levelHints, profileHints);

    return bookScore > bestScore ? book : best;
  }, null);
}

/** 只取词书 id（练习页兜底用） */
export function getDefaultBookId(profile, books = null) {
  return pickDefaultBook(profile, books)?.id || null;
}

/**
 * 读取「画像应用的默认词书」快照（同步、零扫描）。
 * 供 Home 画像卡等只读场景展示，不触发词库遍历。
 */
export function getProfileBookHint() {
  const applied = readApplied();
  if (!applied?.bookId) return null;
  return {
    id: applied.bookId,
    name: applied.name || "",
    emoji: applied.emoji || "📖",
    count: applied.count || 0,
    level: applied.level || "",
  };
}

/* ---- 记录「上次应用的等级」，用于判断要不要自动切换 ---- */

function readApplied() {
  try {
    const raw = localStorage.getItem(PROFILE_DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeApplied(data) {
  try {
    localStorage.setItem(PROFILE_DEFAULTS_KEY, JSON.stringify(data));
  } catch (error) {
    /* ignore */
  }
}

/**
 * 应用画像默认值（目前只有默认词书）。
 *
 * 覆盖策略：
 *   - force（刚做完/重做入学测试）→ 一定切换到画像推荐
 *   - 等级变了 → 切换（这就是「按等级切换默认词书」）
 *   - 用户从没选过词书 → 写入一本作为起点
 *   - 用户自己选过、等级也没变 → 不打扰
 *
 * 返回 { id, name, emoji, count, changed, replaced }，供 UI 提示。
 */
export function applyProfileDefaults(profile, { force = false, books = null } = {}) {
  if (!profile?.thaiLevel) return null;

  const book = pickDefaultBook(profile, books);
  if (!book) return null;

  const applied = readApplied();
  const savedId = getSavedBookId();

  const levelChanged = !!applied?.level && applied.level !== profile.thaiLevel;
  const shouldApply = force || !savedId || levelChanged;

  if (shouldApply) {
    saveBookId(book.id);
    writeApplied({
      level: profile.thaiLevel,
      bookId: book.id,
      // 一并快存名称：Home 画像卡可直接展示，无需再扫全量词库
      name: book.name,
      emoji: book.emoji,
      count: book.count || 0,
      appliedAt: new Date().toISOString(),
    });
  }

  return {
    id: book.id,
    name: book.name,
    emoji: book.emoji,
    count: book.count || 0,
    changed: shouldApply,
    replaced: shouldApply && !!savedId && savedId !== book.id,
  };
}

/* =========================================================
   二、课程推荐排序
========================================================= */

// 课程 id → 命中的画像标签（goal / direction / media / style 的 id）
const COURSE_TAGS = {
  // 唯一已上线的真实课程（14 篇课文精读）：覆盖面最广，任何画像都该优先看到
  "thai-basic-reader": [
    "major",
    "study",
    "travel",
    "business",
    "culture",
    "drama",
    "music",
    "food",
    "tourism",
    "academic",
    "news",
    "newmedia",
    "visual",
    "reading",
    "listening",
    "speaking",
  ],
  "thai-pronunciation": ["major", "study", "visual"],
  "thai-spelling": ["major", "study", "visual"],
  "daily-thai": ["travel", "drama", "music", "newmedia", "tiktok", "food"],
  "thai-pronunciation-advanced": ["major", "study", "speaking"],
  "thai-grammar-advanced": ["major", "study", "academic", "reading"],
  "thai-listening": ["drama", "music", "tiktok", "news", "listening"],
  "thai-conversation": [
    "travel",
    "drama",
    "variety",
    "speaking",
    "food",
    "tourism",
  ],
  "thai-culture": ["culture", "novel", "movie", "reading"],
  "thai-tourism": ["travel", "tourism", "food"],
  "thai-news": ["news", "academic", "reading"],
  "thai-business": ["business"],
  "thai-diplomacy": ["business", "academic", "news"],
};

// 标签权重：目标最重，其次专业方向、兴趣媒体、学习方式
const TAG_WEIGHTS = {
  goal: 3,
  direction: 2,
  media: 1.5,
  style: 1,
};

const TAG_GROUP_LABEL = {
  goal: "学习目标",
  direction: "专业方向",
  media: "兴趣媒体",
  style: "学习方式",
};

/** 画像 → [{ id, label, group, weight }] */
export function profileTags(profile) {
  if (!profile) return [];

  const build = (ids, group) =>
    (Array.isArray(ids) ? ids : []).map((id) => ({
      id,
      label: optionById(id, group)?.title || id,
      group,
      weight: TAG_WEIGHTS[group] || 1,
    }));

  return [
    ...(profile.learningGoal
      ? build([profile.learningGoal], "goals").map((tag) => ({
          ...tag,
          group: "goal",
        }))
      : []),
    ...build(profile.professionalDirection, "directions").map((tag) => ({
      ...tag,
      group: "direction",
    })),
    ...build(profile.mediaInterest, "media"),
    ...build(profile.learningStyle, "styles").map((tag) => ({
      ...tag,
      group: "style",
    })),
  ];
}

/**
 * 按画像排序课程。
 *
 * 排序规则：可立即学习的优先（available），再看画像匹配分与等级契合度。
 * 返回 [{ course, available, matchReason, matchedTags }]。
 */
export function recommendCourses(profile, courseList = [], limit = 3) {
  if (!Array.isArray(courseList) || !courseList.length) return [];

  const tags = profileTags(profile);
  const levelId = profile?.thaiLevel || null;
  const preferAdvanced = ["B1", "B2", "C1"].includes(levelId);

  const scored = courseList.map((course) => {
    const courseTags = COURSE_TAGS[course.id] || [];

    const matched = tags.filter((tag) => courseTags.includes(tag.id));
    const matchScore = matched.reduce((sum, tag) => sum + tag.weight, 0);

    const available = course.status !== "coming";

    // 等级契合：初级画像偏 basic，中高级画像偏 advanced
    const levelFit =
      course.levelKey === "advanced"
        ? preferAdvanced
          ? 1
          : 0
        : preferAdvanced
          ? 0
          : 1;

    const top = [...matched].sort((a, b) => b.weight - a.weight)[0];

    let matchReason = "";

    if (top) {
      matchReason = `${TAG_GROUP_LABEL[top.group]}：${top.label}`;
    } else if (levelId) {
      matchReason = levelFit ? `适合 ${levelId} 起点` : "";
    }

    return {
      course,
      available,
      matchedTags: matched.map((tag) => tag.label),
      matchReason,
      score: (available ? 100 : 0) + matchScore * 10 + levelFit * 4,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/* =========================================================
   三、每日任务（画像定制）
========================================================= */

// 学习目标 → 定向任务
const GOAL_TASKS = {
  travel: {
    id: "scene",
    title: "练 1 个旅行场景对话",
    description: "机场、酒店、点餐任选一个场景",
    goal: "1 个场景",
    // ?scene= 由 /conversation 直接开场景（见 Conversation.jsx）
    route: "/conversation?scene=travel",
    action: "练旅行场景",
  },
  business: {
    id: "bizchat",
    title: "练 1 个商务场景对话",
    description: "会议、报价或邮件跟进",
    goal: "1 个场景",
    route: "/conversation?scene=workplace",
    action: "练职场场景",
  },
  study: {
    id: "reading",
    title: "精读 1 篇课文",
    description: "中泰对照读一遍，圈出生词",
    goal: "1 篇",
    // 卡片会解析成「第一篇未读课文」
    route: "/lessons",
    action: "开始精读",
  },
  major: {
    id: "reading",
    title: "精读 1 篇课文",
    description: "抓语法点与长句结构",
    goal: "1 篇",
    route: "/lessons",
    action: "开始精读",
  },
  drama: {
    id: "line",
    title: "跟读 1 段台词",
    description: "模仿语调，注意连读与语气词",
    goal: "1 段",
    route: "/conversation?scene=daily",
    action: "练台词",
  },
  music: {
    id: "lyric",
    title: "学 1 首歌词表达",
    description: "挑 5 个歌词里的高频词",
    goal: "1 首",
    route: "/corpus",
    action: "去语料库",
  },
  culture: {
    id: "culture",
    title: "读 1 篇泰国文化短文",
    description: "了解节日与社交礼仪背景",
    goal: "1 篇",
    route: "/culture",
    action: "去阅读",
  },
};

// 学习方式 → 定向任务（目标没有专属任务时的兜底）
const STYLE_TASKS = {
  listening: {
    id: "listen",
    title: "精听 1 段课文音频",
    description: "逐句听写，抓声调与连读",
    goal: "1 段",
    route: "/corpus/listening",
    action: "开始精听",
  },
  reading: {
    id: "reading",
    title: "精读 1 篇课文",
    description: "中泰对照读一遍，圈出生词",
    goal: "1 篇",
    route: "/lessons",
    action: "开始精读",
  },
  visual: {
    id: "script",
    title: "复习字母表 3 分钟",
    description: "字母与声调闪卡快速过一遍",
    goal: "3 分钟",
    route: "/alphabet",
    action: "复习字母",
  },
  speaking: {
    id: "shadow",
    title: "跟读 1 段并录音",
    description: "录下来对比自己的发音",
    goal: "1 段",
    route: "/speaking",
    action: "开始跟读",
  },
};

/**
 * 画像定制今日任务。
 *
 * 基础 4 项：词量 / 课时 / 口语时长 / AI 对话 —— 数值随等级走；
 * 再追加 1 项定向任务（优先学习目标，其次学习方式）。
 * 每项带 target 数值，供 Plan 页做「自动完成」判定。
 */
/** 没有画像时的中性基准（与历史上的默认任务一致，不让老用户被动变难） */
export const NEUTRAL_DAILY = { words: 10, video: 1, speakingMinutes: 5 };

export function buildDailyTasks(profile) {
  const hasProfile = !!profile?.thaiLevel;
  const level = getLevelMeta(profile?.thaiLevel);
  const isAdvanced = ["B2", "C1"].includes(level.id);
  const styles = Array.isArray(profile?.learningStyle)
    ? profile.learningStyle
    : [];

  const words = hasProfile ? level.wordsPerDay : NEUTRAL_DAILY.words;
  const videoCount = hasProfile && isAdvanced ? 2 : NEUTRAL_DAILY.video;
  const speakingMinutes = styles.includes("speaking")
    ? 10
    : NEUTRAL_DAILY.speakingMinutes;

  const tasks = [
    {
      id: "vocab",
      title: `学习 ${words} 个单词`,
      description: "完成今日词汇任务",
      goal: `${words} 词`,
      target: words,
      // 直达「学 → 练 → 测」循环（按画像默认词书），而不是词库列表页
      route: "/loop",
      action: "开始背词",
    },
    {
      id: "video",
      title: `观看 ${videoCount} 节课程`,
      description: "完成课程课时，进度自动记录",
      goal: `${videoCount} 节`,
      target: videoCount,
      // 断点续学：卡片会把这里解析成「上次课程下一节未完成课时」
      route: "/course",
      action: "继续上课",
    },
    {
      id: "speaking",
      title: `完成 ${speakingMinutes} 分钟口语`,
      description: "开口练习泰语发音",
      goal: `${speakingMinutes} 分钟`,
      target: speakingMinutes,
      route: "/speaking",
      action: "开始练习",
    },
    {
      id: "chat",
      title: "进行 1 次 AI 对话",
      description: "和 AI 老师聊一个场景",
      goal: "1 次",
      target: 1,
      route: "/conversation",
      action: "开始对话",
    },
  ];

  const targeted =
    GOAL_TASKS[profile?.learningGoal] ||
    styles.map((id) => STYLE_TASKS[id]).find(Boolean);

  if (targeted) {
    tasks.push({ ...targeted, target: 1 });
  }

  return tasks;
}

/* =========================================================
   四、任务完成判定 / 直达目标

   首页「今日学习计划」与 /plan 需要完全一致的完成口径：
     - 能自动读到的（词量 / 课时 / 口语分钟 / 对话次数 / 错题）
       用真实学习记录判定，不需要手动勾选；
     - 读不到的（精读、场景对话、台词跟读、文化短文…）
       用「当日手动完成」记录（与 /plan 共用同一个 localStorage 键）。
========================================================= */

/** 手动完成记录（与 /plan 同键，一处勾选两边同步） */
export const DAILY_PLAN_RECORDS_KEY = "thai_ai_plan_v1";
/** AI 生成的个性化计划（有则优先于画像默认任务） */
export const DAILY_PLAN_TASKS_KEY = "thai_ai_plan_tasks_v1";

/** 能从真实学习记录自动判定的任务 id */
export const AUTO_TASK_IDS = ["vocab", "video", "speaking", "chat", "review"];

export const isAutoTask = (taskId) => AUTO_TASK_IDS.includes(taskId);

/** 本地日历日（与服务端打卡口径一致） */
export function todayLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function readPlanRecords() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(DAILY_PLAN_RECORDS_KEY) || "{}"
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 切换「今日手动完成」并返回新的完成集合 */
export function togglePlanRecord(taskId, dateStr = todayLocal()) {
  const records = readPlanRecords();
  const day = { ...(records[dateStr] || {}) };

  if (day[taskId]) delete day[taskId];
  else day[taskId] = true;

  const next = { ...records, [dateStr]: day };

  try {
    localStorage.setItem(DAILY_PLAN_RECORDS_KEY, JSON.stringify(next));
  } catch {
    /* 忽略无痕模式写入失败 */
  }

  return day;
}

export function readSavedPlanTasks() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(DAILY_PLAN_TASKS_KEY) || "null"
    );
    return Array.isArray(parsed?.tasks) && parsed.tasks.length
      ? parsed.tasks
      : null;
  } catch {
    return null;
  }
}

/** 今日任务清单：AI 生成过就用它，否则用画像默认任务（与 /plan 一致） */
export function getDailyTaskList(profile) {
  return readSavedPlanTasks() || buildDailyTasks(profile);
}

/**
 * 把任务解析成「点一下就能开始练」的目标地址。
 *
 *   video    → 上次学过的课程里「下一节未完成课时」，没有则课程列表
 *   reading  → 第一篇未精读的课文
 *   其余     → 任务自带 route（?scene= 由 /conversation 接管）
 */
export function resolveTaskTarget(task, context = {}) {
  const base = task?.route || "/plan";

  if (task?.id === "video") {
    const {
      courses = [],
      getCourseLessons,
      getCourseProgress,
      lastCourseId,
    } = context;
    if (!courses.length) return base;

    // 最近学过的课程优先，其次按 courses 原顺序
    const ordered = [
      ...courses.filter((c) => c.id === lastCourseId),
      ...courses.filter((c) => c.id !== lastCourseId),
    ];

    for (const course of ordered) {
      const lessons = getCourseLessons?.(course.id) || [];
      if (!lessons.length) continue;

      const entry = getCourseProgress?.(course.id);
      const next = lessons.find((lesson) => !entry?.completed?.[lesson.id]);
      if (next) return `/course/${course.id}/lesson/${next.id}`;
    }

    return base;
  }

  if (task?.id === "reading" || task?.id === "listen") {
    const { textLessons = [], isLessonCompleted } = context;
    const next = textLessons.find(
      (lesson) => !isLessonCompleted?.(lesson.id)
    );
    if (next) return `/lessons/${next.id}`;
  }

  return base;
}

/** 任务进度文字（待完成时显示「已完成量 / 目标」） */
export function taskProgressLabel(task, counts = {}) {
  switch (task?.id) {
    case "vocab":
      return `${Math.min(counts.words || 0, task.target || 0)} / ${task.target || 0} 词`;
    case "video":
      return `${Math.min(counts.video || 0, task.target || 0)} / ${task.target || 0} 节`;
    case "speaking":
      return `${Math.min(counts.speaking || 0, task.target || 0)} / ${task.target || 0} 分钟`;
    case "chat":
      return counts.chat ? "今天已聊过" : "还没开始";
    default:
      return task?.goal || "";
  }
}
