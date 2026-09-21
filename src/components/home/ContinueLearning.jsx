// src/components/home/ContinueLearning.jsx
//
// =========================================================
// 继续学习 · 一条浮层，不是一排卡
// =========================================================
//
// 数据与跳转逻辑全部来自 Home.jsx 原有的 continueCourses / resumeCourse
//（真实课程进度：完成百分比 + 上次学到的课 + 最后学习时间），这里只负责
// 「沉浸式空间」的呈现：横向一条，信息浮在一条进度线上，不做成三张大卡。
//
// 没有学习记录时不渲染 —— 不编一条假的「继续学习」。

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";

const relTime = (text) => {
  if (!text) return "";
  const t = new Date(String(text).replace(" ", "T") + (String(text).includes("Z") ? "" : "Z"));
  if (Number.isNaN(t.getTime())) return "";
  const diff = Date.now() - t.getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return "今天";
  if (diff < 48 * 60 * 60 * 1000) return "昨天";
  return `${t.getMonth() + 1}月${t.getDate()}日`;
};

export default function ContinueLearning({ items = [], onResume, transparent = false }) {
  /* 透明柱内空间有限：只展示前两门 + 全部课程出口（其余在课程页） */
  const shown = transparent ? items.slice(0, 2) : items;
  if (!items.length) return null;

  const [first] = items;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={transparent ? "" : "mt-4"}
      aria-label="继续学习"
    >
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-bold tracking-wide text-white/85">
          接着上次的学
        </h2>
        <span className="text-[10px] text-white/35">
          {items.length > 1 ? `${items.length} 门课在进行中` : "1 门课在进行中"}
        </span>
      </div>

      <div
        className={
          transparent
            ? "mt-2 flex flex-col gap-2"
            : "mt-2 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {shown.map((item) => {
          const last = item.lessons.find(
            (lesson) => lesson.id === item.entry?.lastLessonId
          );
          const title = last?.title || item.course.title;
          const pct = item.stats.progressPercent;
          const at = relTime(item.entry?.updatedAt);

          return (
            <button
              key={item.course.id}
              type="button"
              onClick={() => onResume?.(item)}
              className={
                "group shrink-0 rounded-2xl border border-white/[0.07] p-3 text-left backdrop-blur-xl transition hover:border-emerald-300/25 " +
                (transparent
                  ? "w-full border-white/[0.08] bg-black/30 hover:bg-[#050807]/80"
                  : "w-[240px] bg-[#050807]/62 hover:bg-[#050807]/80")
              }
            >
              <p className="truncate text-[11px] text-white/45">
                {item.course.title}
              </p>
              <p className="mt-1 truncate text-[13px] font-bold text-white/90">
                {title}
              </p>

              {/* 进度线：完成百分比是真实的（getCourseStats） */}
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-white/40">
                  {pct}%{at ? ` · ${at}` : ""}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 transition group-hover:translate-x-0.5">
                  <Play className="h-3 w-3" />
                  继续
                </span>
              </div>
            </button>
          );
        })}

        {/* 「从头看看」出口：课程库 */}
        <button
          type="button"
          onClick={() => onResume?.({ __all: true })}
          className={
            "flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/[0.1] bg-black/25 text-white/45 transition hover:text-white " +
            (transparent ? "w-full flex-row py-2.5" : "w-[120px]")
          }
        >
          <ArrowRight className="h-4 w-4" />
          <span className="text-[11px] font-semibold">全部课程</span>
        </button>
      </div>
    </motion.section>
  );
}
