// src/lib/courseProgress.js

// =========================================================
// ThaiAI 课程学习进度（后端 SQLite 优先 + localStorage 兜底）
// =========================================================
//
// 数据模型（前后端一致）：
//
// {
//   [courseId]: {
//     completed: { [lessonId]: true },          // 已完成的视频
//     lessonProgress: {                          // 每节视频的播放进度
//       [lessonId]: {
//         progress: 0-100,                       // 播放百分比
//         lastPosition: 秒,                      // 上次播放位置
//         updatedAt: ISO 时间
//       }
//     },
//     lastLessonId: string,                      // 最近学习的视频
//     updatedAt: ISO 时间
//   }
// }
//
// 存储策略：
// 1. localStorage 始终即时写入（同步、离线可用、保证 UI 不闪）——
//    所有对外接口保持同步调用，调用方无需改动。
// 2. 登录且后端可用时：
//    - 写入操作 fire-and-forget 同步到 POST /api/lesson-progress
//    - 页面挂载 / 模块加载时从 GET /api/progress 水合（服务端覆盖合并）
// 3. 未登录或后端不可用 → 静默回退 localStorage（进度不丢，恢复后自动续传）。
//
// 视频播放到 >= 90% 或自然结束 → 自动标记完成。
// =========================================================

import { useEffect, useState } from "react";

import api from "@/api/auth";

const STORAGE_KEY = "thai_ai_course_progress_v1";
const CHANGE_EVENT = "thai-ai-course-progress-change";
const AUTO_COMPLETE_THRESHOLD = 90; // 播放到 90% 自动完成

// 进度变化事件名（供外部组件订阅，例如水合完成后刷新 UI）
export const COURSE_PROGRESS_CHANGE_EVENT = CHANGE_EVENT;

/* =========================================================
   水合状态（模块级，整个会话只水合一次）
========================================================= */

let hydratingPromise = null; // 进行中的水合请求
let hydratedForToken = null; // 已水合的 token
let lastHydrateAttemptAt = 0; // 上次尝试水合时间（失败后冷却，避免高频重试）
const HYDRATE_COOLDOWN = 30000; // 失败后 30 秒内不再重试

// =========================================================
// 读取全部（localStorage）
// =========================================================

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("读取课程进度失败:", error);
    return {};
  }
}

// =========================================================
// 写入全部 + 广播变化（同页面组件可同步）
// =========================================================

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch (error) {
    console.error("保存课程进度失败:", error);
  }
}

/* =========================================================
   合并服务端进度到 localStorage（服务端按节覆盖，保留本地独有）
========================================================= */

function mergeServerData(serverData) {
  const all = readAll();

  Object.entries(serverData || {}).forEach(
    ([courseId, serverEntry]) => {
      const localEntry = all[courseId] || {
        completed: {},
        lessonProgress: {},
        lastLessonId: null,
        updatedAt: null,
      };

      localEntry.completed = {
        ...(localEntry.completed || {}),
        ...(serverEntry.completed || {}),
      };

      localEntry.lessonProgress = {
        ...(localEntry.lessonProgress || {}),
        ...(serverEntry.lessonProgress || {}),
      };

      if (serverEntry.lastLessonId) {
        localEntry.lastLessonId = serverEntry.lastLessonId;
      }

      if (
        serverEntry.updatedAt &&
        (!localEntry.updatedAt ||
          serverEntry.updatedAt > localEntry.updatedAt)
      ) {
        localEntry.updatedAt = serverEntry.updatedAt;
      }

      all[courseId] = localEntry;
    }
  );

  writeAll(all);
}

/* =========================================================
   从后端水合进度（登录 + 后端可用时）
   幂等：同一 token 只水合一次；失败后冷却 30 秒再试。
========================================================= */

function ensureHydrated() {
  if (hydratingPromise) return;

  const token = localStorage.getItem("token");
  if (!token) return;

  if (hydratedForToken === token) return;

  if (Date.now() - lastHydrateAttemptAt < HYDRATE_COOLDOWN) {
    return;
  }

  lastHydrateAttemptAt = Date.now();

  hydratingPromise = api
    .get("/progress")
    .then((res) => {
      mergeServerData(res.data?.data);
      hydratedForToken = token;
    })
    .catch((error) => {
      // 后端不可用 → 保持 localStorage 数据，冷却后允许重试
      console.error(
        "从服务器加载课程进度失败，使用本地数据:",
        error
      );
    })
    .finally(() => {
      hydratingPromise = null;
    });
}

/* =========================================================
   把单节进度同步到后端（fire-and-forget，失败静默）
========================================================= */

function syncLessonToServer(courseId, lessonId, payload) {
  const token = localStorage.getItem("token");
  if (!token) return;

  api
    .post("/lesson-progress", {
      courseId,
      lessonId,
      ...payload,
    })
    .catch((error) => {
      // 离线 / 后端不可用 → 进度已在 localStorage，下次登录自动续传
      console.error(
        "同步课程进度到服务器失败，已保留在本地:",
        error
      );
    });
}

// =========================================================
// 获取某门课程的进度
// =========================================================

export function getCourseProgress(courseId) {
  ensureHydrated();

  const all = readAll();
  return (
    all[courseId] || {
      completed: {},
      lessonProgress: {},
      lastLessonId: null,
      updatedAt: null,
    }
  );
}

// =========================================================
// 某节是否已完成
// =========================================================

export function isLessonCompleted(courseId, lessonId) {
  if (!courseId || !lessonId) return false;
  return !!getCourseProgress(courseId).completed[lessonId];
}

// =========================================================
// 标记一节完成
// =========================================================

export function markLessonComplete(courseId, lessonId) {
  if (!courseId || !lessonId) return;

  ensureHydrated();

  const all = readAll();
  const entry = all[courseId] || {
    completed: {},
    lessonProgress: {},
    lastLessonId: null,
    updatedAt: null,
  };

  // 首次创建时写回，确保后续写入生效
  all[courseId] = entry;

  if (!entry.completed[lessonId]) {
    entry.completed[lessonId] = true;
    entry.lastLessonId = lessonId;
    entry.updatedAt = new Date().toISOString();
    writeAll(all);

    syncLessonToServer(courseId, lessonId, {
      completed: true,
      progress: 100,
    });
  }
}

// =========================================================
// 保存播放位置（内部：>=90% 自动完成）
// =========================================================

export function saveLessonPosition(
  courseId,
  lessonId,
  position = 0,
  duration = 0
) {
  if (!courseId || !lessonId) return;

  ensureHydrated();

  const all = readAll();
  const entry = all[courseId] || {
    completed: {},
    lessonProgress: {},
    lastLessonId: null,
    updatedAt: null,
  };

  // 首次创建时写回，确保后续写入生效
  all[courseId] = entry;

  const percent =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((position / duration) * 100)
          )
        )
      : 0;

  entry.lessonProgress[lessonId] = {
    progress: percent,
    lastPosition: Math.max(0, position),
    updatedAt: new Date().toISOString(),
  };

  entry.lastLessonId = lessonId;
  entry.updatedAt = new Date().toISOString();

  // 播放到阈值 → 自动完成
  const autoCompleted =
    percent >= AUTO_COMPLETE_THRESHOLD &&
    !entry.completed[lessonId];

  if (autoCompleted) {
    entry.completed[lessonId] = true;
  }

  writeAll(all);

  syncLessonToServer(courseId, lessonId, {
    progress: percent,
    lastPosition: Math.max(0, position),
    completed: autoCompleted || !!entry.completed[lessonId],
  });
}

// =========================================================
// 获取课程统计（完成数 / 进度百分比）
// =========================================================

export function getCourseStats(courseId, lessons = []) {
  const entry = getCourseProgress(courseId);
  const total = lessons.length;

  const completedCount = lessons.filter(
    (lesson) => !!entry.completed[lesson.id]
  ).length;

  const progressPercent =
    total > 0
      ? Math.round((completedCount / total) * 100)
      : 0;

  return {
    completedCount,
    progressPercent,
    lastLessonId: entry.lastLessonId || null,
  };
}

// =========================================================
// 重置某门课程进度（本地 + 尽力同步到服务器）
// =========================================================

export function resetCourseProgress(courseId) {
  if (!courseId) return;

  const all = readAll();
  const entry = all[courseId];

  if (!entry) return;

  delete all[courseId];
  writeAll(all);

  // 尽力而为：把该课程所有已完成 / 有记录的节标记为未完成
  const lessonIds = [
    ...new Set([
      ...Object.keys(entry.completed || {}),
      ...Object.keys(entry.lessonProgress || {}),
    ]),
  ];

  lessonIds.forEach((lessonId) => {
    syncLessonToServer(courseId, lessonId, {
      completed: false,
      progress: 0,
      lastPosition: 0,
    });
  });
}

// =========================================================
// 重置全部课程进度（本地 + 尽力同步到服务器）
// =========================================================

export function resetAllCourseProgress() {
  const all = readAll();

  Object.entries(all).forEach(([courseId, entry]) => {
    const lessonIds = [
      ...new Set([
        ...Object.keys(entry.completed || {}),
        ...Object.keys(entry.lessonProgress || {}),
      ]),
    ];

    lessonIds.forEach((lessonId) => {
      syncLessonToServer(courseId, lessonId, {
        completed: false,
        progress: 0,
        lastPosition: 0,
      });
    });
  });

  writeAll({});
}

// =========================================================
// 全部课程汇总（完成视频总数 + 最近学习记录）
// =========================================================

export function getAllCourseSummary() {
  ensureHydrated();

  const all = readAll();
  let completedCount = 0;
  const recent = [];

  Object.entries(all).forEach(([courseId, entry]) => {
    completedCount += Object.keys(entry.completed || {}).length;

    if (entry.lastLessonId) {
      recent.push({
        courseId,
        lessonId: entry.lastLessonId,
        updatedAt: entry.updatedAt || null,
      });
    }
  });

  // 最近学习的排最前
  recent.sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );

  return { completedCount, recent };
}

// =========================================================
// React Hook：订阅课程进度变化
// =========================================================

export function useCourseProgress(courseId, lessons = []) {
  const [stats, setStats] = useState(() =>
    getCourseStats(courseId, lessons)
  );

  useEffect(() => {
    const refresh = () =>
      setStats(getCourseStats(courseId, lessons));

    // 初次挂载时也刷新一次（localStorage 可能已被其他标签页修改）
    refresh();

    // 从服务器水合（登录 + 后端可用时，完成后广播变化触发 refresh）
    ensureHydrated();

    window.addEventListener(CHANGE_EVENT, refresh);
    return () =>
      window.removeEventListener(CHANGE_EVENT, refresh);
  }, [courseId]);

  return stats;
}
