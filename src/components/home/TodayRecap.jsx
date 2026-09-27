// src/components/home/TodayRecap.jsx
//
// =========================================================
// 「老师今天给你的安排」· AI 教室右栏
// =========================================================
// 这里以前只有「今天的回声」（今天动过哪些星球），没做过测验的人看到的
// 是一块空状态；老师手里明明有真实任务（useDailyMissions，与 /plan 和
// 仪表盘任务卡同一个数据源），却没在这里用。
//
// 现在的三层，全部来自真实记录，不另造数据：
//   ① 今日进度   doneCount / tasks.length（真实完成判定，不是自述）
//   ② 老师指定   下一条未完成任务 + 它的真实进度（「3 / 18 词」），点一下直达
//   ③ 今天的回声 今天真的动过的星球与条目（todayActivity，与星系脉冲同源）
//
// 与仪表盘的任务卡分工：那张卡是「完整清单 + 手动勾选」，这里是老师的
// 判断与下一步 —— 所以只给「下一项 + 还没轮到的两项」，不做第二份清单。
//
// 没有画像也有安排：buildDailyTasks 会回落到中性基准（NEUTRAL_DAILY），
// 并在底部提示可以做一次入学测试，让任务跟着等级走。
// =========================================================

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Circle, Sparkles, Target } from "lucide-react";

import { useDailyMissions } from "@/hooks/useDailyMissions";

export default function TodayRecap({ today, onOpenPlan }) {
  const navigate = useNavigate();
  const {
    profile,
    tasks,
    doneCount,
    percent,
    allDone,
    isDone,
    targetFor,
    progressLabelOf,
  } = useDailyMissions();

  const active = today?.list || [];
  const hasProfile = !!profile?.thaiLevel;

  const pending = tasks.filter((task) => !isDone(task.id));
  const nextTask = pending[0] || null;
  /* 老师只点出「下一项 + 排后面的两项」，避免和仪表盘清单重复 */
  const upcoming = pending.slice(1, 3);

  return (
    <div className="space-y-2.5">
      {/* ── ① 今日进度 ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-white/80">
            {allDone
              ? "今天的安排已经完成了 🎉"
              : `今日安排 · 完成 ${doneCount} / ${tasks.length}`}
          </p>
          <span className="text-[10px] tabular-nums text-white/40">{percent}%</span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {nextTask ? (
          <button
            type="button"
            onClick={() => navigate(targetFor(nextTask))}
            className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-2.5 text-left transition hover:bg-emerald-400/[0.13]"
          >
            <Target className="h-3.5 w-3.5 shrink-0 text-emerald-200/80" />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-semibold text-white/90">
                {nextTask.title}
              </span>
              <span className="mt-0.5 block text-[10px] text-white/45">
                老师建议先做这一项 · {progressLabelOf(nextTask)}
              </span>
            </span>

            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-200/80" />
          </button>
        ) : (
          <p className="mt-3 text-[10.5px] leading-relaxed text-emerald-100/80">
            今天该做的都做完了。想多练一组的话，我可以再给你排一项。
          </p>
        )}
      </div>

      {/* ── ② 接下来（真实完成状态，点一行直达） ── */}
      {upcoming.length ? (
        <ul className="space-y-1">
          {upcoming.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => navigate(targetFor(task))}
                className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition hover:border-emerald-300/20 hover:text-white"
              >
                <Circle className="h-2.5 w-2.5 shrink-0 text-white/25" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/65">
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] text-white/30">
                  {progressLabelOf(task)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── ③ 今天的回声：今天真的动过的星球 ── */}
      {active.length ? (
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
                  <span className="text-[10px] text-white/40">
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
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
            <Circle className="h-3 w-3 text-white/40" />
            今天还没有练过
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/45">
            上面那一项点开就算开始。今天练过的星球，会在星系里当场亮起来。
          </p>
        </div>
      )}

      {/* ── 底部：完整计划（AI 生成的那份）+ 没有画像时的提示 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenPlan}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-[10.5px] font-semibold text-white/65 transition hover:border-emerald-300/25 hover:text-white"
        >
          查看全部安排
          <ArrowRight className="h-3 w-3" />
        </button>

        {!hasProfile ? (
          <button
            type="button"
            onClick={() => navigate("/placement-test")}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-[10.5px] font-semibold text-white/50 transition hover:border-emerald-300/25 hover:text-white/80"
          >
            <Check className="h-3 w-3" />
            做入学测试，按等级排任务
          </button>
        ) : null}
      </div>
    </div>
  );
}
