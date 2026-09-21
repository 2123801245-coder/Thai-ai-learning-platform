// src/components/dashboard/DailyMissionCard.jsx
//
// =========================================================
// 仪表盘右栏 · 今日学习任务（设计稿版）
// =========================================================
//
// 按设计稿改成了右栏里的紧凑卡：标题 + 环形进度（2/3） + 任务行 +
// 「查看全部任务 →」。原来那套「每项直达对应练习页 + 完成状态可读」的
// 行为一个没少 —— 只是从两列大卡变成了竖排清单：
//
//   左侧圆圈   自动任务：完成状态指示（真实记录判定，点不动）
//              手动任务：可点击勾选（与 /plan 共用 thai_ai_plan_v1）
//   整行       点击直达对应练习（vocab→/loop、speaking→/speaking、
//              chat→/conversation、video→下一节未完成课时…）
//   底部按钮   查看全部任务 → /plan（AI 生成的完整计划）
//
// 数据与判定全在 useDailyMissions（与 /plan 同一套），本文件只负责长相。
// =========================================================

import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ListChecks,
  MessageCircle,
  Mic,
  Play,
  RefreshCw,
  Target,
  Volume2,
} from "lucide-react";

import { useDailyMissions } from "@/hooks/useDailyMissions";
import { isAutoTask } from "@/lib/profileDriven";

const TASK_ICONS = {
  vocab: { Icon: BookOpen, tone: "text-emerald-300", bg: "bg-emerald-400/10" },
  video: { Icon: Play, tone: "text-purple-300", bg: "bg-purple-400/10" },
  speaking: { Icon: Mic, tone: "text-cyan-300", bg: "bg-cyan-400/10" },
  chat: { Icon: MessageCircle, tone: "text-pink-300", bg: "bg-pink-400/10" },
  review: { Icon: RefreshCw, tone: "text-amber-200", bg: "bg-amber-300/10" },
  reading: { Icon: BookOpen, tone: "text-lime-300", bg: "bg-lime-400/10" },
  listening: { Icon: Volume2, tone: "text-sky-300", bg: "bg-sky-400/10" },
  listen: { Icon: Volume2, tone: "text-sky-300", bg: "bg-sky-400/10" },
  scene: { Icon: MessageCircle, tone: "text-teal-300", bg: "bg-teal-400/10" },
  bizchat: { Icon: MessageCircle, tone: "text-teal-300", bg: "bg-teal-400/10" },
  line: { Icon: MessageCircle, tone: "text-teal-300", bg: "bg-teal-400/10" },
  shadow: { Icon: Mic, tone: "text-teal-300", bg: "bg-teal-400/10" },
  script: { Icon: BookOpen, tone: "text-violet-300", bg: "bg-violet-400/10" },
  lyric: { Icon: Volume2, tone: "text-violet-300", bg: "bg-violet-400/10" },
  culture: { Icon: BookOpen, tone: "text-violet-300", bg: "bg-violet-400/10" },
};

/** 环形进度：设计稿里的 2/3 圆环 */
function ProgressRing({ done, total }) {
  const size = 46;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? done / total : 0;

  return (
    <span className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#missionRing)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <defs>
          <linearGradient id="missionRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-bold text-white/85">
        {done}/{total}
      </span>
    </span>
  );
}

/** 右栏卡片最多展示几项（其余去 /plan 看） */
const RAIL_ROWS = 4;

export default function DailyMissionCard({ transparent = false }) {
  const navigate = useNavigate();
  const {
    profile,
    loading,
    tasks,
    isDone,
    doneCount,
    allDone,
    targetFor,
    progressLabelOf,
    handleToggle,
  } = useDailyMissions();

  if (!tasks.length) return null;

  const visible = tasks.slice(0, RAIL_ROWS);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-[22px] border shadow-lg shadow-black/25 backdrop-blur-xl ${
        transparent
          ? allDone
            ? "border-emerald-300/25 bg-emerald-500/[0.14]"
            : "border-white/[0.08] bg-black/30"
          : allDone
            ? "border-emerald-300/25 bg-emerald-400/[0.06]"
            : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[13px] font-bold text-white/90">今日学习任务</span>
          </div>
          <div className="mt-1 text-[10px] text-white/35">
            {allDone
              ? "今天已经全部完成 🎉"
              : profile?.thaiLevel
                ? `按你的画像定制 · ${profile.thaiLevel} 等级`
                : "完成入学测试可按等级定制"}
          </div>
        </div>
        <ProgressRing done={loading ? 0 : doneCount} total={tasks.length} />
      </div>

      <div className="mt-3 space-y-1.5 px-3">
        {visible.map((task) => {
          const meta = TASK_ICONS[task.id] || {
            Icon: Target,
            tone: "text-white/50",
            bg: "bg-white/[0.06]",
          };
          const done = isDone(task.id);
          const auto = isAutoTask(task.id);

          return (
            <div
              key={task.id}
              className={`group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                done
                  ? "border-emerald-300/20 bg-emerald-400/[0.07]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-emerald-300/25 hover:bg-emerald-400/[0.05]"
              }`}
            >
              {/* 自动任务：状态指示；手动任务：可勾选 */}
              {auto ? (
                <span
                  title={done ? "已按学习记录自动完成" : "完成对应练习后自动点亮"}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-emerald-400/25 text-emerald-200" : `${meta.bg} ${meta.tone}`
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <meta.Icon className="h-3.5 w-3.5" />}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggle(task.id)}
                  title={done ? "取消完成标记" : "标记为已完成"}
                  aria-label={done ? "取消完成标记" : "标记为已完成"}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                    done
                      ? "border-emerald-300/40 bg-emerald-400/25 text-emerald-200"
                      : "border-white/15 bg-white/[0.04] text-white/30 hover:border-emerald-300/40 hover:text-emerald-200"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <meta.Icon className="h-3.5 w-3.5" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate(targetFor(task))}
                title={`去练习：${task.title}`}
                aria-label={`去练习：${task.title}`}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[12px] ${
                    done ? "text-emerald-100/70" : "text-white/85"
                  }`}
                >
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] text-white/35">
                  {done
                    ? "已完成"
                    : auto
                      ? progressLabelOf(task)
                      : task.action || task.goal || "去练习"}
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate("/plan")}
        className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-white/[0.06] bg-black/25 px-4 py-3 text-[11px] font-semibold text-white/65 transition hover:bg-black/40 hover:text-white"
      >
        查看全部任务
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </motion.section>
  );
}
