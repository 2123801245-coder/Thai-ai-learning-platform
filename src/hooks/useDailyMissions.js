// src/hooks/useDailyMissions.js
//
// =========================================================
// 今日任务的**数据与判定**（单一来源）
// =========================================================
//
// 这段逻辑原来长在 DailyMissionCard 里。首页按设计稿改成「右栏卡片」后，
// 卡片变紧凑了，但判定一行都没变——所以把它抽出来，卡片只负责长什么样。
//
// 任务清单来源：画像生成（profileDriven.buildDailyTasks；在 /plan 用 AI
// 生成过则用那份）——与 /plan 页同一个 localStorage 键。
//
// 自动完成来源（真实学习记录，不靠用户自述）：
//   vocab    → useLearningProgress().today_words >= target
//   video    → 课程完成数 >= target
//   speaking → daily_history 今日口语分钟数 >= target
//   chat     → daily_history 今日对话次数 >= 1
//   review   → 没有错题视为完成
// 其余任务（精读 / 场景 / 台词 / 歌词 / 文化…）没有可靠自动信号，用
// 「当日手动完成」记录（与 /plan 共用 thai_ai_plan_v1）。
// =========================================================

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useUserProfile } from "@/lib/userProfile";
import {
  getDailyTaskList,
  isAutoTask,
  readPlanRecords,
  resolveTaskTarget,
  taskProgressLabel,
  todayLocal,
  togglePlanRecord,
} from "@/lib/profileDriven";
import { BASIC_READER_COURSE_ID, courses, getCourseLessons } from "@/data/courses";
import { lessons as textLessons } from "@/data/courseTexts";
import {
  getCourseProgress,
  getCourseStats,
  isLessonCompleted,
} from "@/lib/courseProgress";
import { fetchWrongBook } from "@/lib/wordBooks";

const getToday = () => new Date().toISOString().split("T")[0];

export function useDailyMissions() {
  const { profile } = useUserProfile();
  const { progress, loading } = useLearningProgress();

  const [wrongCount, setWrongCount] = useState(0);
  const [manualDone, setManualDone] = useState(() => {
    const today = todayLocal();
    return readPlanRecords()[today] || {};
  });

  useEffect(() => {
    let alive = true;
    fetchWrongBook()
      .then((book) => alive && setWrongCount(book?.count || 0))
      .catch(() => alive && setWrongCount(0));
    return () => {
      alive = false;
    };
  }, []);

  /* 任务清单：AI 生成过就用那份，否则画像定制（与 /plan 同源） */
  const tasks = useMemo(() => getDailyTaskList(profile), [profile]);

  /* 全站课程完成数（video 任务自动完成判定） */
  const courseCompleted = useMemo(() => {
    let completed = 0;
    for (const course of courses) {
      const lessons = getCourseLessons(course.id);
      completed += getCourseStats(course.id, lessons).completedCount;
    }
    return completed;
  }, []);

  /* 今日真实计数 */
  const today = getToday();
  const todayStats = useMemo(() => {
    const day = (progress?.daily_history || []).find((d) => d.date === today);
    return {
      words: progress?.today_words || 0,
      speaking: day?.speaking_minutes || day?.speakingMinutes || 0,
      chat: day?.chat_count || day?.chatCount || 0,
    };
  }, [progress, today]);

  const autoDone = useMemo(() => {
    /* 任务目标写在任务自己身上（画像定制的目标不同人不一样） */
    const targetOf = (id, fallback) =>
      tasks.find((task) => task.id === id)?.target ?? fallback;

    return {
      vocab: todayStats.words >= targetOf("vocab", 10),
      video: courseCompleted >= targetOf("video", 1),
      speaking: todayStats.speaking >= targetOf("speaking", 5),
      chat: todayStats.chat >= 1,
      review: wrongCount === 0,
    };
  }, [tasks, todayStats, courseCompleted, wrongCount]);

  const isDone = useCallback(
    (taskId) => {
      if (isAutoTask(taskId)) return Boolean(autoDone[taskId]);
      return Boolean(manualDone[taskId]);
    },
    [autoDone, manualDone]
  );

  const doneCount = tasks.filter((task) => isDone(task.id)).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  /* 断点续学：最近学过的课程优先（课程进度里的 updatedAt） */
  const lastCourseId = useMemo(() => {
    let best = null;
    for (const course of courses) {
      const entry = getCourseProgress(course.id);
      if (!entry?.updatedAt) continue;
      if (!best || entry.updatedAt > best.updatedAt) {
        best = { courseId: course.id, updatedAt: entry.updatedAt };
      }
    }
    return best?.courseId || null;
  }, []);

  /* 点一下就能开练的落点 */
  const targetFor = useCallback(
    (task) =>
      resolveTaskTarget(task, {
        courses,
        getCourseLessons,
        getCourseProgress,
        lastCourseId,
        textLessons,
        isLessonCompleted: (lessonId) =>
          isLessonCompleted(BASIC_READER_COURSE_ID, lessonId),
      }),
    [lastCourseId]
  );

  const handleToggle = useCallback((taskId) => {
    const day = togglePlanRecord(taskId);
    setManualDone({ ...day });
  }, []);

  /** 自动任务的真实进度文案（3 / 18 词） */
  const progressLabelOf = useCallback(
    (task) =>
      taskProgressLabel(task, {
        words: todayStats.words,
        video: courseCompleted,
        speaking: todayStats.speaking,
        chat: todayStats.chat,
      }),
    [todayStats, courseCompleted]
  );

  return {
    profile,
    loading,
    tasks,
    todayStats,
    courseCompleted,
    autoDone,
    isDone,
    doneCount,
    allDone,
    percent,
    targetFor,
    progressLabelOf,
    handleToggle,
  };
}

export default useDailyMissions;
