// src/lib/mediaProgress.js
//
// =========================================================
// Media Learning · 收藏 / 学习记录 / 进度保存
// =========================================================
//
// 存储策略与站内其他轻量模块一致（参考 src/lib/dailyContent.js、
// src/lib/profileDriven.js 的 thai_ai_plan_v1）：
//
//   - 单一 localStorage 键，同步读写、离线可用、刷新不丢；
//   - 写入后派发 CustomEvent，同页多处订阅可即时刷新（收藏角标、
//     进度条、学习记录列表）；
//   - 未登录也能用；后端同步留给后续（课程进度走的是
//     src/lib/courseProgress.js 那套，媒体学习目前不需要账号级对齐）。
//
// 键结构：
//   {
//     favorites: { [lessonId]: { at: "2026-09-19" } },
//     lessons:   { [lessonId]: { steps: {scene:true,…}, status, minutes,
//                              updatedAt, lastStep } },
//     vocabulary:{ [thai]: { cn, roman, lessonId, at } },
//     records:   [ { at, date, lessonId, title, type, action } ]
//   }

import { useEffect, useState } from "react";

import { PROGRESS_EVENT_NAMES } from "@/lib/progressEvents";

export const MEDIA_PROGRESS_KEY = "thai_ai_media_progress_v1";
export const MEDIA_PROGRESS_EVENT = PROGRESS_EVENT_NAMES.media;

/* 七步学习流程（页面与进度统计共用同一份定义） */
export const MEDIA_STEPS = [
  { key: "scene", label: "原始内容", hint: "先知道这段话发生在什么场景" },
  { key: "subtitle", label: "泰文字幕", hint: "逐句听、逐句跟读" },
  { key: "translation", label: "中文翻译", hint: "先猜再看，效果最好" },
  { key: "keywords", label: "重点词汇", hint: "把生词收进生词本" },
  { key: "grammar", label: "语法解释", hint: "看懂句子怎么搭起来" },
  { key: "culture", label: "文化背景", hint: "为什么泰国人这么说" },
  { key: "ai", label: "AI 练习", hint: "开口用一次才算学会" },
];

const MAX_RECORDS = 60;

const emptyState = () => ({
  favorites: {},
  lessons: {},
  vocabulary: {},
  records: [],
});

export const todayKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export function readMediaState() {
  try {
    const raw = localStorage.getItem(MEDIA_PROGRESS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    return {
      ...emptyState(),
      ...parsed,
      favorites: parsed.favorites || {},
      lessons: parsed.lessons || {},
      vocabulary: parsed.vocabulary || {},
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return emptyState();
  }
}

function writeMediaState(next) {
  try {
    localStorage.setItem(MEDIA_PROGRESS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(MEDIA_PROGRESS_EVENT));
  } catch {
    /* 无痕模式等写入失败：不影响页面使用 */
  }
  return next;
}

const mutate = (fn) => writeMediaState(fn(readMediaState()));

/* =========================================================
   收藏
======================================================== */

export const isFavorite = (lessonId, state = readMediaState()) =>
  Boolean(state.favorites?.[lessonId]);

export function toggleFavorite(lessonId) {
  const next = mutate((state) => {
    const favorites = { ...state.favorites };
    if (favorites[lessonId]) {
      delete favorites[lessonId];
    } else {
      favorites[lessonId] = { at: todayKey() };
    }
    return { ...state, favorites };
  });
  return isFavorite(lessonId, next);
}

export const listFavoriteIds = (state = readMediaState()) =>
  Object.keys(state.favorites || {});

/* =========================================================
   进度（七步勾选 + 状态）
======================================================== */

export const getLessonProgress = (lessonId, state = readMediaState()) =>
  state.lessons?.[lessonId] || null;

export function markStep(lessonId, stepKey, done = true) {
  return mutate((state) => {
    const current = state.lessons?.[lessonId] || {
      steps: {},
      status: "learning",
      minutes: 0,
      updatedAt: null,
      lastStep: null,
    };
    const steps = { ...(current.steps || {}) };
    if (done) steps[stepKey] = true;
    else delete steps[stepKey];

    const doneCount = MEDIA_STEPS.filter((s) => steps[s.key]).length;
    const status =
      doneCount >= MEDIA_STEPS.length ? "done" : "learning";

    return {
      ...state,
      lessons: {
        ...state.lessons,
        [lessonId]: {
          ...current,
          steps,
          status,
          lastStep: stepKey,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
}

/** 一键标记整课学完（或取消） */
export function setLessonDone(lessonId, done = true) {
  return mutate((state) => {
    const current = state.lessons?.[lessonId] || { minutes: 0 };
    const steps = {};
    if (done) for (const s of MEDIA_STEPS) steps[s.key] = true;
    return {
      ...state,
      lessons: {
        ...state.lessons,
        [lessonId]: {
          ...current,
          steps,
          status: done ? "done" : "learning",
          lastStep: done ? MEDIA_STEPS[MEDIA_STEPS.length - 1].key : null,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
}

/** 累计学习时长（分钟），用于统计 */
export function addMinutes(lessonId, minutes = 0) {
  const value = Math.max(0, Math.round(minutes));
  if (!value) return readMediaState();
  return mutate((state) => {
    const current = state.lessons?.[lessonId] || { steps: {}, status: "learning" };
    return {
      ...state,
      lessons: {
        ...state.lessons,
        [lessonId]: {
          ...current,
          minutes: (current.minutes || 0) + value,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
}

/* =========================================================
   学习记录（时间线）
======================================================== */

const MERGE_WINDOW_MS = 30 * 60 * 1000;

export function recordStudy({ lessonId, title, type, action }) {
  return mutate((state) => {
    const now = new Date();
    const entry = {
      at: now.toISOString(),
      date: todayKey(now),
      lessonId,
      title: title || "",
      type: type || "",
      action: action || "打开课程",
    };

    const previous = state.records || [];
    const head = previous[0];

    // 同一条记录（同课程 + 同动作）在 30 分钟内重复出现时只更新时间，
    // 否则刷新页面就会往「学习记录」里堆一堆重复行。
    const isSameAsHead =
      head &&
      head.lessonId === entry.lessonId &&
      head.action === entry.action &&
      now.getTime() - new Date(head.at).getTime() < MERGE_WINDOW_MS;

    const records = isSameAsHead
      ? [entry, ...previous.slice(1)]
      : [entry, ...previous];

    return { ...state, records: records.slice(0, MAX_RECORDS) };
  });
}

export const listRecords = (state = readMediaState(), limit = 8) =>
  (state.records || []).slice(0, limit);

/* =========================================================
   生词本（课程里的重点词汇）
======================================================== */

export const isSavedWord = (thai, state = readMediaState()) =>
  Boolean(state.vocabulary?.[thai]);

export function toggleSavedWord(word, lessonId = "") {
  return mutate((state) => {
    const vocabulary = { ...state.vocabulary };
    if (!word?.th) return state;
    if (vocabulary[word.th]) {
      delete vocabulary[word.th];
    } else {
      vocabulary[word.th] = {
        cn: word.cn || "",
        roman: word.roman || "",
        lessonId,
        at: todayKey(),
      };
    }
    return { ...state, vocabulary };
  });
}

export const listSavedWords = (state = readMediaState()) =>
  Object.entries(state.vocabulary || {}).map(([th, v]) => ({ th, ...v }));

/* =========================================================
   汇总统计
======================================================== */

export function getMediaSummary(state = readMediaState()) {
  const lessons = state.lessons || {};
  const entries = Object.entries(lessons);
  return {
    favorites: Object.keys(state.favorites || {}).length,
    started: entries.length,
    completed: entries.filter(([, v]) => v.status === "done").length,
    minutes: entries.reduce((sum, [, v]) => sum + (v.minutes || 0), 0),
    words: Object.keys(state.vocabulary || {}).length,
    stepsDone: entries.reduce(
      (sum, [, v]) => sum + Object.keys(v.steps || {}).length,
      0
    ),
    records: (state.records || []).length,
  };
}

/** 「最近学过」：按 updatedAt 倒序的 lessonId 列表 */
export function listRecentlyStudied(state = readMediaState(), limit = 6) {
  return Object.entries(state.lessons || {})
    .filter(([, v]) => v?.updatedAt)
    .sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)))
    .slice(0, limit)
    .map(([lessonId]) => lessonId);
}

/* =========================================================
   React Hook：订阅上述状态
======================================================== */

export function useMediaProgress() {
  const [state, setState] = useState(() =>
    typeof window === "undefined" ? emptyState() : readMediaState()
  );

  useEffect(() => {
    const refresh = () => setState(readMediaState());
    refresh();
    window.addEventListener(MEDIA_PROGRESS_EVENT, refresh);
    // 多标签页同步：storage 事件只在其他标签页写入时触发
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MEDIA_PROGRESS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return {
    state,
    summary: getMediaSummary(state),
    isFavorite: (id) => isFavorite(id, state),
    progressOf: (id) => getLessonProgress(id, state),
    isSavedWord: (th) => isSavedWord(th, state),
    records: listRecords(state, 8),
    recentIds: listRecentlyStudied(state, 6),
  };
}
