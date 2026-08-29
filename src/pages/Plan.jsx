import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { courses } from "@/data/courses";
import { getLessonsByCourseId } from "@/data/lessons";
import { getCourseStats, useCourseProgress } from "@/lib/courseProgress";
import { motion } from "framer-motion";
import {
  Target,
  Check,
  BookOpen,
  PlayCircle,
  Mic,
  MessageCircle,
  Flame,
  CalendarDays,
} from "lucide-react";

import {
  ThaiCorner,
  LotusLineArt,
} from "@/components/common/ThaiDecor";

/* =========================================================
   任务数据（数据驱动，未来可接后端）
========================================================= */

const STORAGE_KEY = "thai_ai_plan_v1";

const defaultTasks = [
  {
    id: "vocab",
    title: "学习 10 个单词",
    description: "完成今日词汇任务",
    goal: "10 词",
    icon: "BookOpen",
  },
  {
    id: "video",
    title: "观看 1 节视频",
    description: "完成一节课程视频",
    goal: "1 节",
    icon: "PlayCircle",
  },
  {
    id: "speaking",
    title: "完成 5 分钟口语",
    description: "开口练习泰语发音",
    goal: "5 分钟",
    icon: "Mic",
  },
  {
    id: "chat",
    title: "进行 1 次 AI 对话",
    description: "和 AI 老师聊一个场景",
    goal: "1 次",
    icon: "MessageCircle",
  },
];

const iconMap = {
  BookOpen,
  PlayCircle,
  Mic,
  MessageCircle,
};

const getToday = () =>
  new Date().toISOString().split("T")[0];

/* 最近 7 天的日期与星期标签 */
const getWeekDays = () => {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split("T")[0],
      label: labels[d.getDay()],
      isToday: i === 0,
    });
  }

  return days;
};

/* 读取 / 写入任务记录 */
const readRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

/* =========================================================
   Plan
========================================================= */

export default function Plan() {
  const [records, setRecords] = useState(readRecords);
  const navigate = useNavigate();
  const { progress: learningProgress, loading: progressLoading } = useLearningProgress();
  const courseSummary = useMemo(() => courses.reduce((summary, course) => {
    const lessons = getLessonsByCourseId(course.id);
    const stats = getCourseStats(course.id, lessons);
    return { completed: summary.completed + stats.completedCount, lessons: summary.lessons + lessons.length };
  }, { completed: 0, lessons: 0 }), []);
  const autoCompleted = {
    vocab: (learningProgress?.today_words || 0) >= Math.min(10, learningProgress?.daily_goal || 10),
    video: courseSummary.completed > 0,
    speaking: Boolean(learningProgress?.daily_history?.some((day) => day.date === getToday() && (day.speaking_minutes || day.speakingMinutes) >= 5)),
    chat: Boolean(learningProgress?.daily_history?.some((day) => day.date === getToday() && (day.chat_count || day.chatCount) >= 1)),
  };

  const today = getToday();
  const weekDays = useMemo(getWeekDays, []);

  const todayDone = { ...(records[today] || {}), ...autoCompleted };

  const completed = defaultTasks.filter(
    (t) => todayDone[t.id]
  ).length;

  const progress = Math.round(
    (completed / defaultTasks.length) * 100
  );

  /* 本周完成天数（近 7 天里完成过任务的天数） */
  const weekDone = weekDays.filter(
    (d) =>
      records[d.date] &&
      Object.keys(records[d.date]).length > 0
  ).length;

  const weekProgress = Math.round(
    (weekDone / 7) * 100
  );

  /* 连续学习天数（从今天或昨天往前数） */
  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();

    // 如果今天还没完成，从昨天开始算，避免误伤
    if (!todayDone || Object.keys(todayDone).length === 0) {
      d.setDate(d.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
      const date = d.toISOString().split("T")[0];
      const rec = records[date];

      if (rec && Object.keys(rec).length > 0) {
        count++;
      } else {
        break;
      }

      d.setDate(d.getDate() - 1);
    }

    return count;
  }, [records]);

  /* 勾选 / 取消任务 */
  const toggleTask = (taskId) => {
    setRecords((prev) => {
      const day = { ...(prev[today] || {}) };

      if (day[taskId]) {
        delete day[taskId];
      } else {
        day[taskId] = true;
      }

      const next = {
        ...prev,
        [today]: day,
      };

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch (e) {
        // 忽略存储错误
      }

      return next;
    });
  };

  /* 重置今日任务 */
  const resetToday = () => {
    setRecords((prev) => {
      const next = { ...prev };
      delete next[today];

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch (e) {
        // 忽略存储错误
      }

      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] px-4 py-3">
        <span className="text-[11px] text-white/35">学习旅程 · 记录每天的进步</span>
        <button type="button" onClick={() => navigate("/ranking")} className="rounded-lg border border-yellow-300/15 px-3 py-1.5 text-[11px] text-yellow-200/75 transition hover:bg-yellow-300/[0.08]">查看学习排行榜 →</button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* 莲花线稿（成长旅程符号） */}

        <LotusLineArt
          className="pointer-events-none absolute -right-2 top-1/2 hidden h-12 w-16 -translate-y-1/2 opacity-[0.20] sm:block"
          opacity={0.9}
        />

        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
          <CalendarDays className="h-4 w-4" />
          MY LEARNING PLAN
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          学习计划
        </h1>

        <p className="mt-2 text-sm text-white/40">              每天一点点，让泰语学习成为习惯 · 进度会自动读取词汇与课程记录

        </p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 今日目标 */}

        <div className="premium-glass card-lift card-glow-emerald relative overflow-hidden rounded-3xl p-6 lg:col-span-2">
          <ThaiCorner
            corners={["tl", "br"]}
            size={24}
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/35">
                今日学习目标
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                {completed} / {defaultTasks.length}
              </h2>
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10">
              <Target className="h-6 w-6 text-emerald-300" />
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8 }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-white/30">
              今日完成度 {progress}%
            </p>

            <button
              onClick={resetToday}
              className="text-[10px] text-white/25 transition hover:text-white/50"
            >
              重置今日
            </button>
          </div>
        </div>

        {/* 连续学习 */}

        <div className="premium-glass card-lift card-glow-gold rounded-3xl p-6">
          <Flame className="h-6 w-6 text-yellow-300" />

          <p className="mt-5 text-xs text-white/35">
            连续学习
          </p>

          <p className="mt-1 text-3xl font-black text-white">
            {streak}
            <span className="ml-1 text-sm font-normal text-white/35">
              天
            </span>
          </p>

          <p className="mt-2 text-xs text-yellow-200/50">
            {streak > 0 ? "保持这个节奏！" : "完成今天的任务开始连续记录"}
          </p>
        </div>
      </div>

      {/* 本周完成度 */}

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              本周完成度
            </h2>

            <p className="mt-1 text-xs text-white/30">
              近 7 天里完成过任务的天数
            </p>
          </div>

          <div className="rounded-xl bg-emerald-400/[0.08] px-3 py-1.5 text-sm font-bold text-emerald-300">
            {weekDone} / 7
          </div>
        </div>

        <div className="flex items-center gap-2">
          {weekDays.map((day) => {
            const done =
              records[day.date] &&
              Object.keys(records[day.date]).length > 0;

            return (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    done
                      ? "border-emerald-300/20 bg-emerald-400/[0.14]"
                      : day.isToday
                      ? "border-white/[0.12] bg-white/[0.06]"
                      : "border-white/[0.05] bg-white/[0.02]"
                  }`}
                >
                  {done ? (
                    <Check className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <span
                      className={`text-xs font-bold ${
                        day.isToday
                          ? "text-white/60"
                          : "text-white/20"
                      }`}
                    >
                      {day.isToday ? "今" : day.label}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-white/25">
                  {day.isToday ? "今天" : `周${day.label}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weekProgress}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300"
          />
        </div>

        <p className="mt-2 text-right text-[10px] text-white/25">
          本周完成度 {weekProgress}%
        </p>
      </div>

      {/* 今日任务 */}

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
        <h2 className="mb-4 text-sm font-bold text-white">
          今日任务
        </h2>

        <div className="grid gap-2 sm:grid-cols-2">
          {defaultTasks.map((task) => {
            const Icon = iconMap[task.icon] || BookOpen;
            const done = !!todayDone[task.id];

            return (
              <motion.button
                key={task.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleTask(task.id)}
                className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                  done
                    ? "border-emerald-300/15 bg-emerald-400/[0.08]"
                    : "border-white/[0.05] bg-white/[0.025] hover:bg-white/[0.05]"
                }`}
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                    done
                      ? "bg-emerald-400/15"
                      : "bg-white/[0.05]"
                  }`}
                >
                  {done ? (
                    <Check className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <Icon className="h-5 w-5 text-white/30" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      done
                        ? "text-white/45 line-through"
                        : "text-white"
                    }`}
                  >
                    {task.title}
                  </p>

                  <p className="mt-1 text-xs text-white/25">
                    {task.description}
                  </p>
                </div>

                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    done
                      ? "bg-emerald-400/10 text-emerald-300/70"
                      : "bg-white/[0.04] text-white/30"
                  }`}
                >
                  {done ? "已完成" : task.goal}
                </span>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-4 text-center text-[10px] text-white/20">
          词汇与课程任务会自动读取学习记录；未接入数据的任务仍可手动勾选
        </p>
      </div>
    </div>
  );
}
