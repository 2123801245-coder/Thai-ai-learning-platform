import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { courses } from "@/data/courses";
import { getLessonsByCourseId } from "@/data/lessons";
import { getCourseStats, useCourseProgress } from "@/lib/courseProgress";
import { fetchWrongBook } from "@/lib/wordBooks";
import { getAiTeacherMemory, getAiTeacherPlan } from "@/api/aiTeacher";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Check,
  BookOpen,
  PlayCircle,
  Mic,
  MessageCircle,
  Flame,
  CalendarDays,
  Sparkles,
  Wand2,
  Repeat,
  Volume2,
  ArrowRight,
  RotateCcw,
  Loader2,
} from "lucide-react";

import {
  ThaiCorner,
  LotusLineArt,
} from "@/components/common/ThaiDecor";

/* =========================================================
   任务数据
   - 默认任务（未用 AI 生成时的兜底）
   - AI 生成计划会覆盖默认任务并持久化到 localStorage
========================================================= */

const STORAGE_KEY = "thai_ai_plan_v1";
const PLAN_KEY = "thai_ai_plan_tasks_v1";

const defaultTasks = [
  { id: "vocab", title: "学习 10 个单词", description: "完成今日词汇任务", goal: "10 词" },
  { id: "video", title: "观看 1 节视频", description: "完成一节课程视频", goal: "1 节" },
  { id: "speaking", title: "完成 5 分钟口语", description: "开口练习泰语发音", goal: "5 分钟" },
  { id: "chat", title: "进行 1 次 AI 对话", description: "和 AI 老师聊一个场景", goal: "1 次" },
];

/* 每个任务类型的图标 / 配色 / 能力入口路由 */
const TASK_META = {
  vocab: {
    Icon: BookOpen,
    chip: "bg-emerald-400/10 text-emerald-300",
    icon: "bg-emerald-400/12",
    ring: "border-emerald-300/15",
    route: "/vocabulary",
  },
  review: {
    Icon: Repeat,
    chip: "bg-amber-300/10 text-amber-200",
    icon: "bg-amber-300/12",
    ring: "border-amber-300/20",
    route: "/wrong-notebook",
  },
  video: {
    Icon: PlayCircle,
    chip: "bg-purple-400/10 text-purple-300",
    icon: "bg-purple-400/12",
    ring: "border-purple-300/20",
    route: "/course",
  },
  speaking: {
    Icon: Mic,
    chip: "bg-cyan-400/10 text-cyan-300",
    icon: "bg-cyan-400/12",
    ring: "border-cyan-300/20",
    route: "/speaking",
  },
  chat: {
    Icon: MessageCircle,
    chip: "bg-pink-400/10 text-pink-300",
    icon: "bg-pink-400/12",
    ring: "border-pink-300/20",
    route: "/dialogue",
  },
  listening: {
    Icon: Volume2,
    chip: "bg-sky-400/10 text-sky-300",
    icon: "bg-sky-400/12",
    ring: "border-sky-300/20",
    route: "/corpus",
  },
  reading: {
    Icon: BookOpen,
    chip: "bg-lime-400/10 text-lime-300",
    icon: "bg-lime-400/12",
    ring: "border-lime-300/20",
    route: "/corpus",
  },
};

const DEFAULT_META = {
  Icon: Target,
  chip: "bg-white/[0.06] text-white/40",
  icon: "bg-white/[0.05]",
  ring: "border-white/[0.06]",
  route: null,
};

const iconMap = {
  BookOpen,
  PlayCircle,
  Mic,
  MessageCircle,
};

const getToday = () => new Date().toISOString().split("T")[0];

const getWeekDays = () => {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().split("T")[0], label: labels[d.getDay()], isToday: i === 0 });
  }
  return days;
};

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 忽略存储错误 */
  }
};

const readRecords = () => readJSON(STORAGE_KEY, {});

export default function Plan() {
  const navigate = useNavigate();
  const [records, setRecords] = useState(readRecords);
  const [savedPlan, setSavedPlan] = useState(() => readJSON(PLAN_KEY, null));
  const [wrongCount, setWrongCount] = useState(0);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  const { progress: learningProgress, loading: progressLoading } = useLearningProgress();

  /* 错题本数量（用于「复习错题」任务提示，无错题则视为已完成） */
  useEffect(() => {
    fetchWrongBook()
      .then((b) => setWrongCount(b?.count || 0))
      .catch(() => setWrongCount(0));
  }, []);

  const courseSummary = useMemo(
    () =>
      courses.reduce(
        (s, course) => {
          const lessons = getLessonsByCourseId(course.id);
          const stats = getCourseStats(course.id, lessons);
          return {
            completed: s.completed + stats.completedCount,
            lessons: s.lessons + lessons.length,
          };
        },
        { completed: 0, lessons: 0 }
      ),
    []
  );

  /* AI 个性化任务（有则用之，否则回退默认任务） */
  const taskList =
    savedPlan?.tasks?.length > 0 ? savedPlan.tasks : defaultTasks;

  /* 「每日闭环」自动完成：直接读取学习进度真实计数，任务无需手动勾选 */
  const autoCompleted = {
    vocab:
      (learningProgress?.today_words || 0) >=
      Math.min(10, learningProgress?.daily_goal || 10),
    video: courseSummary.completed > 0,
    speaking: Boolean(
      learningProgress?.daily_history?.some(
        (day) =>
          day.date === getToday() &&
          (day.speaking_minutes || day.speakingMinutes) >= 5
      )
    ),
    chat: Boolean(
      learningProgress?.daily_history?.some(
        (day) =>
          day.date === getToday() &&
          (day.chat_count || day.chatCount) >= 1
      )
    ),
    /* 没有错题则无需复习，视为完成 */
    review: wrongCount === 0,
  };

  const today = getToday();
  const weekDays = useMemo(getWeekDays, []);
  const todayDone = { ...(records[today] || {}), ...autoCompleted };

  const completed = taskList.filter((t) => todayDone[t.id]).length;
  const progress = Math.round((completed / taskList.length) * 100);

  const weekDone = weekDays.filter(
    (d) => records[d.date] && Object.keys(records[d.date]).length > 0
  ).length;
  const weekProgress = Math.round((weekDone / 7) * 100);

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    if (!todayDone || Object.keys(todayDone).length === 0) {
      d.setDate(d.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const date = d.toISOString().split("T")[0];
      const rec = records[date];
      if (rec && Object.keys(rec).length > 0) count++;
      else break;
      d.setDate(d.getDate() - 1);
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  const toggleTask = (taskId) => {
    setRecords((prev) => {
      const day = { ...(prev[today] || {}) };
      if (day[taskId]) delete day[taskId];
      else day[taskId] = true;
      const next = { ...prev, [today]: day };
      writeJSON(STORAGE_KEY, next);
      return next;
    });
  };

  const resetToday = () => {
    setRecords((prev) => {
      const next = { ...prev };
      delete next[today];
      writeJSON(STORAGE_KEY, next);
      return next;
    });
  };

  /* ── AI 生成个性化今日计划 ── */
  const generatePlan = async () => {
    setGenBusy(true);
    setGenError("");
    try {
      let memory = {};
      try {
        const m = await getAiTeacherMemory();
        memory = m?.data?.memory || {};
      } catch (e) {
        /* 无画像也允许生成 */
      }
      const total = learningProgress?.total_vocabulary || 0;
      const level = memory.level
        ? memory.level
        : total >= 200
        ? "elementary"
        : total >= 50
        ? "beginner"
        : "beginner";
      const profile = {
        level,
        mastered: total,
        streak: learningProgress?.learning_streak || 0,
        name: memory.studentName || "",
      };
      const res = await getAiTeacherPlan(profile);
      const plan = res?.data?.plan;
      if (!plan || !plan.tasks || plan.tasks.length === 0) {
        throw new Error("AI 未返回有效计划，请重试");
      }
      const payload = { ...plan, ts: Date.now() };
      writeJSON(PLAN_KEY, payload);
      setSavedPlan(payload);
    } catch (err) {
      setGenError(err?.response?.data?.message || err?.message || "生成失败，请稍后重试");
    } finally {
      setGenBusy(false);
    }
  };

  const goTo = (route) => {
    if (route) navigate(route);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] px-4 py-3">
        <span className="text-[11px] text-white/35">学习旅程 · 记录每天的进步</span>
        <button type="button" onClick={() => navigate("/ranking")} className="rounded-lg border border-yellow-300/15 px-3 py-1.5 text-[11px] text-yellow-200/75 transition hover:bg-yellow-300/[0.08]">查看学习排行榜 →</button>
      </div>

      {/* 页面标题 */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <LotusLineArt className="pointer-events-none absolute -right-2 top-1/2 hidden h-12 w-16 -translate-y-1/2 opacity-[0.20] sm:block" opacity={0.9} />
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
          <CalendarDays className="h-4 w-4" />
          MY LEARNING PLAN
        </div>
        <h1 className="mt-3 text-3xl font-black text-white">学习计划</h1>
        <p className="mt-2 text-sm text-white/40">每天一点点，让泰语学习成为习惯 · 进度会自动读取词汇与课程记录</p>
      </motion.div>

      {/* AI 智能计划面板 */}
      <div className="premium-glass card-lift card-glow-emerald relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <ThaiCorner corners={["tl", "br"]} size={22} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-yellow-300/15">
              <Sparkles className="h-5 w-5 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">AI 智能生成今日计划</p>
                {savedPlan && (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">已按你的档案定制</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-white/35">根据你的水平、兴趣与常见错误，自动生成贴身的每日任务清单</p>
            </div>
          </div>
          <button
            type="button"
            onClick={generatePlan}
            disabled={genBusy}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-400/5 transition hover:bg-emerald-400/20 disabled:opacity-60"
          >
            {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {genBusy ? "阿泰正在生成…" : savedPlan ? "重新生成" : "智能生成计划"}
          </button>
        </div>

        {savedPlan?.focus && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.05] px-4 py-3">
            <p className="text-xs text-yellow-200/70">今日学习主题</p>
            <p className="mt-1 text-sm font-medium text-white/85">🎯 {savedPlan.focus}</p>
            {savedPlan.tip && <p className="mt-2 text-xs leading-relaxed text-white/40">💡 {savedPlan.tip}</p>}
          </motion.div>
        )}

        {genError && (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">生成失败：{genError}</p>
        )}

        <p className="mt-3 text-[10px] text-white/25">AI 生成的任务自动保存到本机，可随时重新生成覆盖；生成免费不占用对话额度。</p>
      </div>

      {/* 今日目标 + 连续学习 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="premium-glass card-lift card-glow-emerald relative overflow-hidden rounded-3xl p-6 lg:col-span-2">
          <ThaiCorner corners={["tl", "br"]} size={24} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/35">今日学习目标</p>
              <h2 className="mt-2 text-2xl font-black text-white">{completed} / {taskList.length}</h2>
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
            <p className="text-xs text-white/30">今日完成度 {progress}%</p>
            <button onClick={resetToday} className="inline-flex items-center gap-1 text-[10px] text-white/25 transition hover:text-white/50">
              <RotateCcw className="h-3 w-3" /> 重置今日
            </button>
          </div>
        </div>

        <div className="premium-glass card-lift card-glow-gold rounded-3xl p-6">
          <Flame className="h-6 w-6 text-yellow-300" />
          <p className="mt-5 text-xs text-white/35">连续学习</p>
          <p className="mt-1 text-3xl font-black text-white">{streak}<span className="ml-1 text-sm font-normal text-white/35">天</span></p>
          <p className="mt-2 text-xs text-yellow-200/50">{streak > 0 ? "保持这个节奏！" : "完成今天的任务开始连续记录"}</p>
        </div>
      </div>

      {/* 本周完成度 */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">本周完成度</h2>
            <p className="mt-1 text-xs text-white/30">近 7 天里完成过任务的天数</p>
          </div>
          <div className="rounded-xl bg-emerald-400/[0.08] px-3 py-1.5 text-sm font-bold text-emerald-300">{weekDone} / 7</div>
        </div>
        <div className="flex items-center gap-2">
          {weekDays.map((day) => {
            const done = records[day.date] && Object.keys(records[day.date]).length > 0;
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                  done ? "border-emerald-300/20 bg-emerald-400/[0.14]" : day.isToday ? "border-white/[0.12] bg-white/[0.06]" : "border-white/[0.05] bg-white/[0.02]"
                }`}>
                  {done ? <Check className="h-5 w-5 text-emerald-300" /> : <span className={`text-xs font-bold ${day.isToday ? "text-white/60" : "text-white/20"}`}>{day.isToday ? "今" : day.label}</span>}
                </div>
                <span className="text-[10px] text-white/25">{day.isToday ? "今天" : `周${day.label}`}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div initial={{ width: 0 }} animate={{ width: `${weekProgress}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300" />
        </div>
        <p className="mt-2 text-right text-[10px] text-white/25">本周完成度 {weekProgress}%</p>
      </div>

      {/* 今日任务 */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">今日任务</h2>
            <p className="mt-1 text-xs text-white/30">{savedPlan ? "AI 为你定制的个性化任务" : "默认基础任务 · 可用 AI 一键定制"}</p>
          </div>
          <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/30">{taskList.length} 项</span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {taskList.map((task) => {
              const meta = TASK_META[task.id] || DEFAULT_META;
              const Icon = meta.Icon || iconMap[task.icon] || BookOpen;
              const done = !!todayDone[task.id];
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => toggleTask(task.id)}
                  className={`group flex cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    done ? "border-emerald-300/15 bg-emerald-400/[0.08]" : `bg-white/[0.025] hover:bg-white/[0.05] ${meta.ring}`
                  }`}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition ${done ? "bg-emerald-400/15" : meta.icon}`}>
                    {done ? <Check className="h-5 w-5 text-emerald-300" /> : <Icon className="h-5 w-5 text-white/35" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? "text-white/45 line-through" : "text-white"}`}>{task.title}</p>
                    <p className="mt-1 text-xs text-white/25">{task.description}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${done ? "bg-emerald-400/10 text-emerald-300/70" : meta.chip}`}>
                      {done ? "已完成" : task.goal || "待办"}
                    </span>
                    {meta.route && !done && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goTo(meta.route);
                        }}
                        aria-label="前往练习"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/40 transition hover:border-emerald-300/30 hover:text-emerald-300"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {wrongCount > 0 && (
          <button type="button" onClick={() => navigate("/wrong-notebook")} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-left transition hover:bg-amber-300/[0.1]">
            <div>
              <p className="text-xs font-medium text-amber-200">📕 你有 {wrongCount} 个错题待复习</p>
              <p className="mt-0.5 text-[10px] text-white/25">把易错词再练一遍，巩固记忆</p>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-200/70" />
          </button>
        )}

        <p className="mt-4 text-center text-[10px] text-white/20">词汇、课程、口语、AI 对话任务会自动读取学习记录完成；错题/生词等仍可手动勾选 · 点击任务即可标记完成</p>
      </div>
    </div>
  );
}