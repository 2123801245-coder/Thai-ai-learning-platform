// src/components/home/LevelCard.jsx
//
// =========================================================
// 仪表盘右栏 · 你的泰语等级（设计稿版）
// =========================================================
//
// 设计稿：小标签 + 大字「A2 Explorer」+「探索者」+ 右侧宝石图标 +
// 进度条 +「2,450 / 3,500 XP」+「下一等级 · A2+ →」。
//
// 两个数字都必须是真数：
//
//   XP 进度  ← getLevelInfo(xp)：真实等级曲线（0/150/400/700/1100/1600/
//              2200/3000/4000/5000）。设计稿那种「2,450 / 3,500」是 70%
//              的漂亮数字，照抄就成了假进度条。
//   下一等级 ← 入学测试的 CEFR 序列里下一个（A2 → B1），不是「A2+」——
//              A2+ 不是 CEFR 里的等级，写了会让学生以为存在这个档。
//
// 没有做入学测试时显示「待测」并给一条通往测试的路，不编等级。
// =========================================================

import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Gem, Sparkles } from "lucide-react";

import { getLevelInfo } from "@/lib/level";
import { LEVELS, getLevelMeta } from "@/lib/placement";

export default function LevelCard({ identity, transparent = false }) {
  const navigate = useNavigate();
  const xp = Number(identity?.xp) || 0;
  const info = getLevelInfo(xp);

  /* 下一级所需 XP（真实曲线；已是顶级则没有下一级） */
  const nextXp = info.next;
  const remaining = nextXp != null ? Math.max(0, nextXp - xp) : 0;

  /* CEFR 的下一档（A0→A1→A2→B1→B2→C1） */
  const index = LEVELS.findIndex((level) => level.id === identity?.cefr);
  const nextCefr = index >= 0 ? LEVELS[index + 1]?.id : null;
  const meta = getLevelMeta(identity?.cefr);

  const hasTest = Boolean(identity?.hasTest);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        "relative overflow-hidden rounded-[22px] p-4 shadow-lg shadow-black/25 backdrop-blur-xl " +
        (transparent
          ? "border border-white/[0.08] bg-black/30"
          : "border border-white/[0.07] bg-white/[0.025]")
      }
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/[0.09] blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] text-white/35">你的泰语等级</div>

          {hasTest ? (
            <>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[22px] font-black leading-none text-emerald-300">
                  {identity.cefr}
                </span>
                <span className="text-[15px] font-bold text-white/90">
                  {identity.title}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-white/40">
                {meta?.title || identity.cefrTitle}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-[18px] font-black leading-none text-white/85">
                待测
              </div>
              <button
                type="button"
                onClick={() => navigate("/placement-test")}
                className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#CB8DFF] transition hover:text-[#d8b1ff]"
              >
                <Sparkles className="h-3 w-3" />
                做一次 AI 入学测试
              </button>
            </>
          )}
        </div>

        {/* 设计稿右侧那枚宝石 */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/[0.1]">
          <Gem className="h-5 w-5 text-emerald-300" />
        </span>
      </div>

      {/* XP 进度（真实曲线） */}
      <div className="relative mt-3.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-700"
            style={{ width: `${info.percent}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px]">
          <span className="text-white/45">
            <span className="font-semibold text-white/75">{xp.toLocaleString("en-US")}</span>
            {nextXp != null ? ` / ${nextXp.toLocaleString("en-US")} XP` : " XP"}
          </span>
          <span className="text-white/40">
            {nextXp != null
              ? `距 Lv.${info.level + 1} 还差 ${remaining} XP`
              : "已是最高等级"}
          </span>
        </div>
      </div>

      {/* 下一等级：CEFR 序列里的下一个（不是 A2+） */}
      {hasTest && nextCefr ? (
        <button
          type="button"
          onClick={() => navigate("/plan")}
          className="relative mt-3 flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-left transition hover:border-emerald-300/25 hover:bg-black/40"
        >
          <span className="text-[10px] text-white/40">
            下一等级 · <span className="font-bold text-white/80">{nextCefr}</span>
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/35" />
        </button>
      ) : null}
    </motion.section>
  );
}
