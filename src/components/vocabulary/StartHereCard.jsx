// src/components/vocabulary/StartHereCard.jsx
//
// =========================================================
// 词汇星球 · 「今天从这里开始」引导卡
// =========================================================
//
// 解决的问题
// ----------
// 词汇星球原来一进页面就是：统计数字 + 六个等权重按钮
// （浏览 / 翻转 / 测验 / 配对 / 填空 / 分词），外加一个最显眼的
// 「添加生词」。用户的原话是「不知道要先干什么」——因为：
//
//   ① 六个模式没有先后关系，也没有一句话说明各自是干嘛的；
//   ② 最大的按钮是「添加生词」（内容管理动作），而不是「开始学」；
//   ③ 页面不告诉用户"今天练了多少、还差多少"。
//
// 这个组件把入口收敛成**一条有顺序的路**：
//   认识 → 测验 → 巩固 → 清错题
// 每一轮只高亮"现在该做的那一步"，其余步骤保持可见但降权，
// 用户既能立刻开始，也能看到整条路有多长。

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Clock, Sparkles, Target } from "lucide-react";
import { LEARNING_STEPS } from "@/lib/vocabularyGuidance";

/* 四步路径沿用 lib/vocabularyGuidance 的定义（与推荐逻辑同源） */
export { LEARNING_STEPS };

export function StartHereCard({
  /** 当前推荐做第几步（LEARNING_STEPS 的 id） */
  recommendId,
  /** 推荐理由（一句话，说明"为什么现在做这个"） */
  reason,
  /** 主按钮文案与动作 */
  ctaLabel,
  onStart,
  /** 今日进度：已学词数 / 目标词数 */
  todayWords = 0,
  dailyGoal = 20,
  /** 错题本待复习数量 */
  wrongCount = 0,
  /** 当前词书名（让用户知道自己在学哪本） */
  bookName,
}) {
  const percent = dailyGoal ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0;
  const goalDone = todayWords >= dailyGoal;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="tv-start relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/[0.10] via-teal-400/[0.05] to-transparent p-4 backdrop-blur-xl sm:p-5"
    >
      {/* 氛围光 */}
      <div
        aria-hidden="true"
        className="tv-ornament pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/[0.12] blur-3xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tv-start-kicker flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-emerald-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              START HERE · 今天从这里开始
            </p>
            <h2 className="tv-start-title mt-1.5 text-lg font-black text-white sm:text-xl">
              {LEARNING_STEPS.find((s) => s.id === recommendId)?.label || "认识"}
              <span className="ml-2 text-[13px] font-semibold text-white/45">
                {LEARNING_STEPS.find((s) => s.id === recommendId)?.hint}
              </span>
            </h2>
            {reason ? (
              <p className="tv-start-reason mt-1.5 max-w-xl text-[12.5px] leading-6 text-white/55">{reason}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onStart}
            className="tv-start-cta group flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 px-5 py-3 text-sm font-bold text-[#04110f] shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:shadow-emerald-400/30 active:scale-[0.98]"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 四步路径：当前步高亮，已完成/待做的降权但可见 */}
        <ol className="tv-start-steps mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {LEARNING_STEPS.map((step, index) => {
            const active = step.id === recommendId;
            const isReview = step.id === "review";

            return (
              <li key={step.id} className="flex items-center gap-1.5">
                <span
                  className={`tv-start-step flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                    active
                      ? "tv-start-step-on border-emerald-300/45 bg-emerald-400/[0.16] text-emerald-50"
                      : "border-white/[0.08] bg-white/[0.03] text-white/40"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                      active ? "bg-emerald-300 text-[#04110f]" : "bg-white/[0.08] text-white/40"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {step.label}
                  {isReview && wrongCount > 0 ? (
                    <span className="rounded-full bg-red-400/15 px-1.5 py-px text-[9.5px] font-bold text-red-200/90">
                      {wrongCount}
                    </span>
                  ) : null}
                </span>
                {index < LEARNING_STEPS.length - 1 ? (
                  <ArrowRight className="h-3 w-3 shrink-0 text-white/15" />
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* 今日进度：把"还差多少"讲清楚 */}
        <div className="tv-start-progress mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.07] pt-3.5">
          <div className="flex min-w-[190px] flex-1 items-center gap-3">
            <Target className={`h-4 w-4 shrink-0 ${goalDone ? "text-emerald-300" : "text-white/35"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/45">
                  今日已学 <span className="font-bold text-white/80">{todayWords}</span> / {dailyGoal} 词
                </span>
                <span className={`font-bold tabular-nums ${goalDone ? "text-emerald-300" : "text-white/50"}`}>
                  {percent}%
                </span>
              </div>
              <div className="tv-start-track mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`tv-start-fill h-full rounded-full transition-all duration-500 ${
                    goalDone
                      ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                      : "bg-gradient-to-r from-emerald-400/80 to-teal-300/80"
                  }`}
                  style={{ width: `${Math.max(2, percent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/40">
            {bookName ? (
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-300/70" />
                当前词书：<span className="font-semibold text-white/70">{bookName}</span>
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {goalDone ? "今日目标已完成，可自由练习" : `还差 ${Math.max(0, dailyGoal - todayWords)} 词达标`}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default StartHereCard;
