// src/components/home/TodayRecap.jsx
//
// =========================================================
// 「老师今天给你的安排」· 今日回顾（设计稿版）
// =========================================================
//
// 设计稿把「今日任务」和「老师推荐」都收进右栏之后，AI 教室那块原本注入
// 的两张卡就空出来了。空着不如放真正该在那儿的东西：**老师今天注意到了
// 什么**——也就是今天真实发生过的学习（todayActivity，与星系里的脉冲环
// 同源），以及下一步该点哪里。
//
// 所以这里不是又一份任务清单，而是「今天的回声」：
//   今天练过 → 逐颗星球列出真实条目（点回对应练习页）
//   今天没练 → 直说没练，并给一个能马上开始的按钮（不假装在夸你）
// =========================================================

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Circle, Sparkles } from "lucide-react";

export default function TodayRecap({ today, onOpenPlan }) {
  const navigate = useNavigate();
  const active = today?.list || [];

  if (today && active.length) {
    return (
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.05] p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-100">
          <Sparkles className="h-3 w-3" />
          今天你已经动过 {active.length} 颗星球
        </p>

        <ul className="mt-2 space-y-2">
          {active.map((planet) => (
            <li key={planet.id} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: planet.accent, boxShadow: `0 0 8px ${planet.glow}` }}
                />
                <span className="text-[11.5px] font-semibold text-white/85">{planet.cn}</span>
                <span className="text-[10px] text-white/35">
                  {planet.today.lastLabel || "今天"}
                </span>
              </div>
              {planet.today.detail ? (
                <p className="mt-0.5 pl-3.5 text-[10.5px] leading-relaxed text-white/55">
                  {planet.today.detail}
                </p>
              ) : null}
              {planet.today.items?.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5 pl-3.5">
                  {planet.today.items.map((item) => (
                    <button
                      key={`${planet.id}-${item.to}-${item.label}`}
                      type="button"
                      onClick={() => navigate(item.to)}
                      title={item.to}
                      className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10px] text-white/70 transition hover:border-emerald-300/30 hover:text-white"
                    >
                      {item.label} · {item.detail}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onOpenPlan}
          className="mt-3 flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-[10.5px] font-semibold text-white/65 transition hover:border-emerald-300/25 hover:text-white"
        >
          接着练下一项
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
        <Circle className="h-3 w-3 text-white/40" />
        今天还没有练过
      </p>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/45">
        挑一项开始就行 —— 词汇、口语、对话、一节课都算。今天练过的星球，会在
        星系里当场亮起来。
      </p>
      <button
        type="button"
        onClick={onOpenPlan}
        className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.1] px-3 py-2 text-[10.5px] font-bold text-emerald-50 transition hover:bg-emerald-400/[0.18]"
      >
        看看今天的任务
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
