// src/lib/todayActivity.js
//
// =========================================================
// ThaiAI World · 今日活动（「今天发生了什么」）
// =========================================================
//
// 星系在上一轮已经会表达**累计**进度（轨道半径 = 掌握度、星尘 = 还没轮到）。
// 但累计值回答不了用户最关心的问题：我今天做的事，有没有被看到？
//
// 这一层把「今天」从现有数据里量出来，交给星系做**当场反应**：
//   今日脉冲环   —— 今天练过的星球持续向外扩环
//   汇入光丝     —— 有一条能量线从该星球连回中央恒星
//   星尘被吹开   —— 今天的活动把尘埃推开（视觉，路线安排不变）
//   一次性冲击波 —— 你正在看的时候新发生的事，会「炸」一下
//
// ── 四条硬规则（都不是风格问题，是正确性问题） ──
//
// ① 只认真实时间戳。今天 = **本地日历日**。课程进度里的 updatedAt 是
//    `toISOString()`（UTC），直接用前 10 个字符比对会在晚上 8 点后把
//    昨天算成今天（东八区）。所以一律 `new Date(iso)` 后再取本地日。
//
// ② 不发明数据。累计分钟数（mediaState.lessons[id].minutes）**不是**今天
//    的时长，所以永远不显示「今天 X 分钟」。没有时间戳的信号（例如
//    markLessonComplete 不写时间）就不算今天，不猜。
//
// ③ 不含用户自己勾的完成。每日计划里手动打勾的任务是**自述**，不是测量；
//    把它并进「今天练过」会让脉冲变成可以点出来的装饰。这里只看真实记录。
//
// ④ 归不到星球就说归不到。今天学了一门不在路线里的课，就如实列在
//    `unmapped` 里（「另有 1 门课不在你的路线里」），不硬塞给某颗星球。
//
// 纯函数。不新增任何数据源，不写 localStorage，也不 import 任何需要
// 浏览器环境的模块（订阅式 Hook 在 useTodayActivity.js，UI 用它）。
// =========================================================

import { getCourseById, getCourseLessons } from "@/data/courses";
import { getLessonById, mediaCategories } from "@/data/mediaLessons";
import { planetOfStage } from "@/lib/worldData";
import { todayKey } from "@/lib/mediaProgress";
import { TODAY_SOURCE_EVENTS } from "@/lib/progressEvents";

export { todayKey, TODAY_SOURCE_EVENTS };

/* =========================================================
   二、归属表（今天做过的事算到哪颗星球头上）
========================================================= */

/**
 * 课程 category → 星球。
 *
 * 这只是**兜底**：课在路线里（stage.courseId 命中）时以路线的归属为准，
 * 因为同一门课可以服务不同阶段（thai-listening 同时挂在泰剧/影视/歌曲/
 * 听力四个阶段上，按 category 只能归到一颗星球）。
 */
export const COURSE_CATEGORY_PLANET = {
  精读: "foundation",
  基础: "foundation",
  发音: "foundation",
  语法: "foundation",
  口语: "speaking",
  场景: "speaking",
  听力: "speaking",
  文化: "culture",
  阅读: "culture",
  商务: "professional",
  外交: "professional",
};

/**
 * 媒体课 type → 星球。
 * 文学归文化星球（读的是长文本，不是听/看），其余五种都是「沉浸式媒体」。
 */
export const MEDIA_TYPE_PLANET = {
  drama: "media",
  song: "media",
  variety: "media",
  news: "media",
  social: "media",
  literature: "culture",
};

/**
 * 这门课今天算在哪颗星球上？
 *
 * ① 路线里挂了这门课 → 用路线的归属（优先「当前阶段」那一颗）
 * ② 否则 → 按 category 兜底
 * ③ 都没有 → null（调用方如实报「没归到星球」，不硬塞）
 */
export function coursePlanet(courseId, path = null) {
  if (!courseId) return null;

  const stages = Array.isArray(path?.stages) ? path.stages : [];
  const owned = stages.filter((stage) => stage.courseId === courseId);

  if (owned.length) {
    const currentId = path?.current?.id || null;
    const onCurrent = owned.find((stage) => stage.id === currentId);
    const planet = planetOfStage(onCurrent || owned[0]);
    if (planet) return planet;
  }

  const category = getCourseById?.(courseId)?.category;
  return COURSE_CATEGORY_PLANET[category] || null;
}

export const courseTitle = (courseId) => getCourseById?.(courseId)?.title || courseId;

export const mediaCategoryName = (type) =>
  mediaCategories.find((category) => category.id === type)?.label || type;

/* =========================================================
   三、能量强度
   ---------------------------------------------------------
   脉冲幅度、光丝亮度、星尘吹开的程度都由它决定。
   纯视觉量，不参与任何进度计算——所以可以放心调，不会影响学习数据。
========================================================= */

export const TODAY_ENERGY = {
  /** 每认识/复习对一个词（词汇操练是高频小动作，所以要很多次才满格） */
  vocabRep: 0.03,
  /** 每完成一次口语评分 */
  speakingTry: 0.25,
  /** 每节媒体课有进展 */
  mediaLesson: 0.3,
  /** 每节课有播放记录 */
  courseLesson: 0.34,
  /** 通过一次结业测试 */
  certificate: 0.5,
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

/* =========================================================
   四、按来源提取「今天」
   ---------------------------------------------------------
   每个提取器只吃一个数据源，返回 { planetId: partial }。
   分开写是为了能被逐个断言（见 .check-world.mjs）。
========================================================= */

/** 词汇操练（useLearningProgress 的 daily_history，date 已是本地日） */
export function todayFromVocab(progress, date) {
  const history = Array.isArray(progress?.daily_history) ? progress.daily_history : [];
  const day = history.find((item) => item?.date === date);
  if (!day) return {};

  const words = Math.max(0, Number(day.words) || 0);
  const reviewed = Math.max(0, Number(day.review_correct) || 0);
  const xp = Math.max(0, Number(day.xp) || 0);

  /* 有今天这一行但三项都是 0（例如当天只答错）→ 不算「练过」 */
  if (!words && !reviewed && !xp) return {};

  const items = [];
  if (words) items.push({ label: "新词 · 认识", detail: `${words} 个`, to: "/loop" });
  if (reviewed) items.push({ label: "复习 · 答对", detail: `${reviewed} 个`, to: "/loop" });

  return {
    foundation: {
      count: words + reviewed,
      energy: clamp01((words + reviewed) * TODAY_ENERGY.vocabRep),
      xp,
      items,
      detail: words && reviewed
        ? `练了 ${words} 个新词 · 复习对了 ${reviewed} 个`
        : words
          ? `练了 ${words} 个新词`
          : `复习对了 ${reviewed} 个词`,
    },
  };
}

/** 口语评分（speakingHistory，timestamp 是毫秒） */
export function todayFromSpeaking(records, date) {
  const list = (Array.isArray(records) ? records : []).filter((record) => {
    const at = Number(record?.timestamp);
    return Number.isFinite(at) && todayKey(new Date(at)) === date;
  });
  if (!list.length) return {};

  const scores = list.map((record) => Number(record.score) || 0).filter((score) => score > 0);
  const avg = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;
  const best = scores.length ? Math.max(...scores) : 0;
  const modes = [...new Set(list.map((record) => record.mode).filter(Boolean))];
  const lastAt = Math.max(...list.map((record) => Number(record.timestamp)));

  return {
    speaking: {
      count: list.length,
      energy: clamp01(list.length * TODAY_ENERGY.speakingTry),
      score: avg,
      best,
      lastAt,
      items: [
        {
          label: "口语评分",
          detail: `${list.length} 次${avg ? ` · 平均 ${avg} 分` : ""}${
            modes.length === 1 ? ` · ${MODE_LABEL[modes[0]] || modes[0]}` : ""
          }`,
          to: "/speaking-practice",
        },
      ],
      detail: `${list.length} 次跟读${avg ? `，平均 ${avg} 分` : ""}`,
    },
  };
}

const MODE_LABEL = { word: "单词", sentence: "句子", paragraph: "段落" };

/**
 * 媒体学习（mediaProgress 的学习记录 + 每节课的 updatedAt）。
 *
 * 注意：`lessons[id].minutes` 是**累计**时长，不是今天的，所以这里只用它
 * 判断「今天有过进展」这个事实，绝不把累计值当今天报出来。
 */
export function todayFromMedia(state, date) {
  if (!state) return {};

  const records = Array.isArray(state.records) ? state.records : [];
  const fromRecords = records.filter((record) => record?.date === date);

  const todayLessons = new Set(fromRecords.map((record) => record.lessonId).filter(Boolean));

  Object.entries(state.lessons || {}).forEach(([lessonId, entry]) => {
    const at = entry?.updatedAt;
    if (!at) return;
    const when = new Date(at);
    if (!Number.isNaN(when.getTime()) && todayKey(when) === date) {
      todayLessons.add(lessonId);
    }
  });

  if (!todayLessons.size) return {};

  /* 按媒体分类聚合：同一个分类下学两节只给一个入口（不多按钮通向同一页） */
  const byType = new Map();
  todayLessons.forEach((lessonId) => {
    const lesson = getLessonById?.(lessonId);
    const type = lesson?.type || null;
    const bucket = byType.get(type) || { type, ids: [], titles: [], actions: [] };
    bucket.ids.push(lessonId);
    if (lesson?.title) bucket.titles.push(lesson.title);
    const record = fromRecords.find((item) => item.lessonId === lessonId);
    if (record?.action) bucket.actions.push(record.action);
    byType.set(type, bucket);
  });

  /** @type {Record<string, object>} */
  const result = {};
  byType.forEach((bucket) => {
    const planetId = MEDIA_TYPE_PLANET[bucket.type] || "media";
    const label = bucket.type ? mediaCategoryName(bucket.type) : "媒体课";
    const part = {
      count: bucket.ids.length,
      energy: clamp01(bucket.ids.length * TODAY_ENERGY.mediaLesson),
      items: [
        {
          label,
          detail: `${bucket.ids.length} 节${
            bucket.titles[0] ? ` · 最近「${bucket.titles[0]}」` : ""
          }`,
          to: bucket.type ? `/media?category=${bucket.type}` : "/media",
        },
      ],
      detail: `${label} ${bucket.ids.length} 节`,
      lastAt: maxRecordTime(fromRecords, bucket.ids),
    };

    result[planetId] = mergePartial(result[planetId], part);
  });

  return result;
}

const maxRecordTime = (records, lessonIds) => {
  const times = records
    .filter((record) => lessonIds.includes(record.lessonId) && record.at)
    .map((record) => new Date(record.at).getTime())
    .filter((value) => Number.isFinite(value));
  return times.length ? Math.max(...times) : null;
};

/**
 * 课程进度（courseProgress）。
 *
 * 时间来自 `lessonProgress[lessonId].updatedAt`（ISO/UTC）与结业证书的
 * issuedAt/updatedAt。**没有时间戳就不算今天**——markLessonComplete 走的
 * 是「点一下就算学完」的路径，它不写时间，所以不参与今日活动。
 */
export function todayFromCourses(allProgress, date, path = null) {
  const result = {};
  const unmapped = [];

  Object.entries(allProgress || {}).forEach(([courseId, entry]) => {
    if (!entry || typeof entry !== "object") return;

    const lessons = getCourseLessons?.(courseId) || [];
    const titleOf = (lessonId) =>
      lessons.find((lesson) => lesson.id === lessonId)?.title || lessonId;

    const touched = Object.entries(entry.lessonProgress || {})
      .filter(([, value]) => {
        if (!value?.updatedAt) return false;
        const when = new Date(value.updatedAt);
        return !Number.isNaN(when.getTime()) && todayKey(when) === date;
      })
      .map(([lessonId]) => lessonId);

    const certificate = entry.certificate || null;
    const certificateToday =
      certificate &&
      [certificate.issuedAt, certificate.updatedAt].some((at) => {
        if (!at) return false;
        const when = new Date(at);
        return !Number.isNaN(when.getTime()) && todayKey(when) === date;
      });

    if (!touched.length && !certificateToday) return;

    const planetId = coursePlanet(courseId, path);
    const title = courseTitle(courseId);

    const items = [];
    if (touched.length) {
      const detail = `${touched.length} 节 · 最近「${titleOf(touched[touched.length - 1])}」`;
      items.push({ label: title, detail, to: `/course/${courseId}` });
    }
    if (certificateToday) {
      items.push({
        label: "结业测试",
        detail: `${title}${certificate.percent ? ` · ${certificate.percent} 分` : ""}`,
        to: `/course/${courseId}`,
      });
    }

    const timeStrings = touched
      .map((lessonId) => entry.lessonProgress?.[lessonId]?.updatedAt)
      .concat(certificateToday ? [certificate?.updatedAt || certificate?.issuedAt] : [])
      .filter(Boolean)
      .map((at) => new Date(at).getTime())
      .filter((value) => Number.isFinite(value));

    const partial = {
      count: touched.length + (certificateToday ? 1 : 0),
      energy: clamp01(
        touched.length * TODAY_ENERGY.courseLesson +
          (certificateToday ? TODAY_ENERGY.certificate : 0)
      ),
      items,
      detail: touched.length
        ? `${title} 学了 ${touched.length} 节`
        : `${title} 结业测试通过`,
      lastAt: timeStrings.length ? Math.max(...timeStrings) : null,
    };

    if (!planetId) {
      unmapped.push({ courseId, title, count: partial.count });
      return;
    }

    result[planetId] = mergePartial(result[planetId], partial);
  });

  /* 附带字段：调用方要用它如实报告「没归到星球」的部分 */
  Object.defineProperty(result, "unmapped", {
    value: unmapped,
    enumerable: false,
  });

  return result;
}

/** 合并同一颗星球的多个来源（数量相加、能量相加后夹紧、条目拼接去重） */
function mergePartial(current, next) {
  if (!current) {
    return {
      count: next.count || 0,
      energy: clamp01(next.energy),
      xp: next.xp || 0,
      score: next.score ?? null,
      best: next.best ?? null,
      lastAt: next.lastAt ?? null,
      items: [...(next.items || [])],
      details: [next.detail].filter(Boolean),
    };
  }

  const items = [...(current.items || [])];
  (next.items || []).forEach((item) => {
    const duplicate = items.find((existing) => existing.to === item.to);
    if (duplicate) {
      /* 同一落点只留一个入口：合并成一行，而不是两个按钮通向同一页 */
      duplicate.detail = `${duplicate.detail} · ${item.detail}`;
    } else if (item.to) {
      items.push({ ...item });
    }
  });

  return {
    ...current,
    count: (current.count || 0) + (next.count || 0),
    energy: clamp01((current.energy || 0) + (next.energy || 0)),
    xp: (current.xp || 0) + (next.xp || 0),
    score: next.score ?? current.score,
    best: Math.max(current.best || 0, next.best || 0) || null,
    lastAt: Math.max(current.lastAt || 0, next.lastAt || 0) || null,
    items,
    details: [...(current.details || []), next.detail].filter(Boolean),
  };
}

/* =========================================================
   五、装配：把「今天」贴到星球上
========================================================= */

const relativeLabel = (at, now) => {
  if (!at) return "";
  const diff = now.getTime() - at;
  if (diff < 2 * 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)} 分钟前`;
  if (diff < 12 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)} 小时前`;
  return "今天早些时候";
};

/**
 * @param {Array}  planets   buildPlanets() 的结果（提供 id/cn/accent/glyph）
 * @param {object} sources
 *   path            学习路线（决定课程归到哪颗星球）
 *   progress        useLearningProgress 的 progress
 *   courseProgress  courseProgress 的原始快照（readAllCourseProgress）
 *   mediaState      mediaProgress 的原始 state
 *   speakingRecords speakingHistory 的原始记录
 *   now             可注入的时间（测试用）
 */
export function buildToday(planets = [], sources = {}) {
  const {
    path = null,
    progress = null,
    courseProgress = null,
    mediaState = null,
    speakingRecords = null,
    now = new Date(),
  } = sources;

  const date = todayKey(now);
  const list = Array.isArray(planets) ? planets : [];

  /* ① 各来源 → { planetId: partial } */
  const vocab = todayFromVocab(progress, date);
  const speaking = todayFromSpeaking(speakingRecords, date);
  const media = todayFromMedia(mediaState, date);
  const courses = todayFromCourses(courseProgress, date, path);

  /* ② 合并成 planetId → partial */
  const merged = new Map();
  [vocab, speaking, media, courses].forEach((source) => {
    Object.entries(source).forEach(([planetId, partial]) => {
      merged.set(planetId, mergePartial(merged.get(planetId), partial));
    });
  });

  const unknownPlanets = [...merged.keys()].filter(
    (planetId) => !list.some((planet) => planet.id === planetId)
  );

  /* ③ 贴到星球上（**不修改入参**，返回新数组） */
  const enriched = list.map((planet) => {
    const partial = merged.get(planet.id);
    if (!partial) {
      return {
        ...planet,
        today: {
          active: false,
          count: 0,
          intensity: 0,
          xp: 0,
          score: null,
          items: [],
          detail: "",
          lastAt: null,
          lastLabel: "",
          dustBlown: false,
        },
      };
    }

    return {
      ...planet,
      today: {
        active: true,
        count: partial.count,
        intensity: clamp01(partial.energy),
        xp: partial.xp || 0,
        score: partial.score ?? null,
        best: partial.best ?? null,
        items: partial.items || [],
        detail: (partial.details || []).join(" · "),
        lastAt: partial.lastAt || null,
        lastLabel: relativeLabel(partial.lastAt, now),
        /* 今天来过 → 星尘被吹开（纯视觉；路线安排与累计编码都不变） */
        dustBlown: true,
      },
    };
  });

  const active = enriched.filter((planet) => planet.today.active);
  const sorted = [...active].sort((a, b) => b.today.intensity - a.today.intensity);

  const totalSignals = active.reduce((sum, planet) => sum + planet.today.count, 0);
  const unmapped = courses.unmapped || [];

  return {
    date,
    now,
    planets: enriched,
    activeCount: active.length,
    totalSignals,
    intensity: clamp01(active.reduce((sum, planet) => sum + planet.today.intensity, 0)),
    list: sorted,
    ids: sorted.map((planet) => planet.id),
    unmapped,
    /* 人话总述：没有活动时也不编（宁可让用户知道今天还没开始） */
    headline: active.length
      ? `今天练过 ${sorted.map((planet) => `「${planet.cn}」`).join(" ")}`
      : "今天还没有练过 —— 选一颗星球开始",
    hint: active.length
      ? "这些星球正在向外扩环，尘埃被吹开了"
      : "今天一开练，那颗星球就会当场亮起来",
    empty: active.length === 0,
  };
}

/* =========================================================
   六、爆发检测（「你正在看的时候发生的事」）
   ---------------------------------------------------------
   挂载时的第一遍**不算爆发**：那时用户还没看见任何东西，
   给一次冲击波等于在庆祝一件他不知道的事。
========================================================= */

/**
 * 哪些星球的今日数量变多了（= 刚刚发生的事）。
 *
 * `previous.ready === false` 表示上一次读数还在**水合期**（localStorage 里的
 * 进度是异步读上来的，首屏那几帧一切都是 0）。那种「从 0 变到 8」不是用户
 * 此刻做了什么，而是数据刚到位——所以一律不算爆发，只当作基线。
 */
export function diffToday(previous, next) {
  if (!previous || previous.ready === false) return [];
  const before = previous.counts || {};
  const after = next?.counts || {};
  return Object.keys(after).filter((planetId) => (after[planetId] || 0) > (before[planetId] || 0));
}

export const todayCounts = (today) =>
  (today?.planets || []).reduce((acc, planet) => {
    acc[planet.id] = planet.today?.count || 0;
    return acc;
  }, {});

export default { buildToday, todayCounts, todayKey };
