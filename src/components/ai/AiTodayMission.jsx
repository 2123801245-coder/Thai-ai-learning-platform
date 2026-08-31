import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Target,
  BookOpen,
  PlayCircle,
  Mic,
  MessageCircle,
  Repeat,
  Volume2,
  Flame,
  ArrowRight,
  Brain,
  Check,
} from "lucide-react";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { getAiTeacherMemory } from "@/api/aiTeacher";

/* =========================================================
   AI 今日安排 · AiTodayMission
   - 首页顶部「第一 CTA」：告诉用户今天学什么、学多久，
     只保留一个主按钮「开始今日学习」，减少选择压力。
   - 数据来源：学习进度 hook + AI 生成的学习计划(localStorage)
     + AI 老师长期记忆(画像/弱点)，全部真实、可回退。
========================================================= */

const PLAN_KEY = "thai_ai_plan_tasks_v1";

/* 每类任务预计分钟数 */
const EST_MIN = {
  vocab: 3,
  review: 2,
  video: 5,
  speaking: 3,
  chat: 4,
  listening: 4,
  reading: 5,
};

const TASK_ICON = {
  vocab: BookOpen,
  review: Repeat,
  video: PlayCircle,
  speaking: Mic,
  chat: MessageCircle,
  listening: Volume2,
  reading: BookOpen,
};

const TASK_TONE = {
  vocab: "bg-emerald-400/12 text-emerald-300 border-emerald-300/20",
  review: "bg-amber-300/12 text-amber-200 border-amber-300/20",
  video: "bg-purple-400/12 text-purple-300 border-purple-300/20",
  speaking: "bg-cyan-400/12 text-cyan-300 border-cyan-300/20",
  chat: "bg-pink-400/12 text-pink-300 border-pink-300/20",
  listening: "bg-sky-400/12 text-sky-300 border-sky-300/20",
  reading: "bg-lime-400/12 text-lime-300 border-lime-300/20",
};

const DEFAULT_TASKS = [
  { id: "vocab", title: "复习 & 学习单词", description: "10 个今日词汇", goal: "10 词" },
  { id: "video", title: "看一节课程视频", description: "对应你水平的课程", goal: "1 节" },
  { id: "speaking", title: "开口练发音", description: "跟着句子朗读", goal: "5 分钟" },
  { id: "chat", title: "和 AI 老师对话", description: "练一个真实场景", goal: "1 次" },
];

const readJSON = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
};

export default function AiTodayMission() {
  const navigate = useNavigate();
  const { progress: p, loading } = useLearningProgress();
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    getAiTeacherMemory()
      .then((r) => setMemory(r?.data?.memory || null))
      .catch(() => setMemory(null));
  }, []);

  const plan = useMemo(() => readJSON(PLAN_KEY), []);
  const tasks = plan?.tasks?.length ? plan.tasks : DEFAULT_TASKS;
  const focus = plan?.focus || "打好今天的泰语基础";
  const tip = plan?.tip || "";

  const minutes = tasks.reduce((s, t) => s + (EST_MIN[t.id] || 3), 0);

  const streak = p?.learning_streak || 0;
  const mastered = p?.total_vocabulary || 0;
  const todayWords = p?.today_words || 0;
  const accuracy = p?.accuracy_rate || 0;
  const todayDone = tasks.filter(
    (t) =>
      t.id === "vocab"
        ? todayWords >= Math.min(10, p?.daily_goal || 10)
        : false
  ).length;

  /* AI Insight / 弱点：优先来自 AI 老师记忆，回退到进度数据 */
  const insight = memory?.mistakes?.length
    ? `我注意到你最近在「${memory.mistakes.slice(0, 3).join("、")}」上会犯错，今天我们先把它解决。`
    : memory?.level
    ? `你现在是 ${memory.level} 水平，今天的计划按这个难度来安排。`
    : accuracy > 0 && accuracy < 75
    ? "你的正确率还有提升空间，今天从错题与跟读开始会更高效。"
    : "今天保持节奏，把基础再巩固一遍。";

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 11 ? "早上好" : greetingHour < 18 ? "下午好" : "晚上好";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6 overflow-hidden rounded-[24px] border border-emerald-300/[0.12] bg-gradient-to-br from-[#0b1d1a]/90 via-[#0a1716]/85 to-[#0e221d]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-6"
    >
      {/* 顶部：AI 标签 + 能力摘要 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            <Brain className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-emerald-300/70">
              AI 今日安排 · วันนี้ของคุณ
            </div>
            <p className="mt-0.5 text-sm font-bold text-white">
              {greeting}，今天只需要 {minutes} 分钟
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/15 bg-yellow-300/[0.06] px-2.5 py-1 font-semibold text-yellow-200/80">
            <Flame className="h-3 w-3" /> 连学 {streak} 天
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[0.06] px-2.5 py-1 font-semibold text-emerald-200/80">
            <BookOpen className="h-3 w-3" /> {mastered} 词
          </span>
        </div>
      </div>

      {/* AI 建议语 */}
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#CB8DFF]/15 bg-[#CB8DFF]/[0.06] px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
        <div>
          <p className="text-[13px] font-medium leading-6 text-white/85">
            🎯 {focus}
          </p>
          {tip && (
            <p className="mt-1 text-[11px] leading-5 text-white/40">💡 {tip}</p>
          )}
        </div>
      </div>

      {/* 今日任务清单 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {tasks.slice(0, 5).map((task, i) => {
          const Icon = TASK_ICON[task.id] || Target;
          const tone = TASK_TONE[task.id] || "bg-white/[0.05] text-white/50 border-white/10";
          const est = EST_MIN[task.id] || 3;
          return (
            <div
              key={task.id + i}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/90">
                  {i + 1}. {task.title}
                </p>
                <p className="truncate text-[10px] text-white/35">{task.description || task.goal}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-white/45">
                {est} 分钟
              </span>
            </div>
          );
        })}
      </div>

      {/* AI Insight：老师主动指出问题 */}
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
          <Check className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold text-emerald-300/80">AI 洞察 · AI Insight</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">{insight}</p>
        </div>
      </div>

      {/* 唯一主 CTA + 次级动作 */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate("/loop")}
          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-3.5 text-sm font-bold text-[#061513] shadow-lg shadow-emerald-400/20 transition hover:shadow-emerald-400/30"
        >
          <Target className="h-4 w-4" />
          开始今日学习
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/conversation")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
        >
          <MessageCircle className="h-4 w-4 text-yellow-300" />
          和 AI 老师聊聊
        </button>
      </div>
    </motion.section>
  );
}