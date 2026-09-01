import React, { useMemo } from "react";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import {
  estimateAbilities,
  buildLevelSeries,
  estimateDaysToNextLevel,
} from "@/lib/abilityModel";
import AbilityRadar from "@/components/dashboard/AbilityRadar";
import GrowthCurve from "@/components/dashboard/GrowthCurve";
import { Target, TrendingUp, Sparkles } from "lucide-react";

export default function AbilitySection({ progress: progressProp, loading: loadingProp }) {
  const hook = useLearningProgress();
  const progress = progressProp ?? hook.progress;
  const loading = loadingProp ?? hook.loading;

  const abilities = useMemo(() => estimateAbilities(progress), [progress]);
  const { series, cumulative } = useMemo(
    () => buildLevelSeries(progress?.daily_history),
    [progress]
  );
  const daysToNext = useMemo(
    () =>
      estimateDaysToNextLevel(
        progress?.daily_history,
        Number(progress?.total_vocabulary) || 0
      ),
    [progress]
  );

  const hasData = (Number(progress?.total_vocabulary) || 0) > 0 || series.length > 0;

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
        <div className="h-6 w-28 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-4 h-56 animate-pulse rounded-2xl bg-white/[0.04]" />
      </section>
    );
  }

  if (!hasData) {
    /* 空状态：引导用户从学习开始，能力评估会自动生成 */
    return (
      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Target className="h-4 w-4 text-emerald-300" />
          泰语能力评估
          <span className="ml-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/40">A1 · 入门</span>
        </div>
        <p className="mt-1 text-xs text-white/35">学几个词、练几次口语，能力雷达与成长曲线就会自动生成</p>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] py-8 text-center">
          <Sparkles className="h-6 w-6 text-emerald-300/70" />
          <p className="text-sm text-white/55">开始学习后，这里会展示你的六维能力与 A1→B1 成长曲线</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
      {/* 头部 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Target className="h-4 w-4 text-emerald-300" />
            泰语能力评估
          </div>
          <p className="mt-1 text-xs text-white/35">
            已掌握 {abilities.totalVocabulary} 词 · 正确率 {abilities.accuracy}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-r from-emerald-400/20 to-teal-400/10 px-3 py-1.5 text-sm font-black text-white">
            {abilities.cefr}
          </span>
          <div className="text-right">
            <p className="text-[10px] text-white/30">当前水平</p>
            <p className="text-[10px] font-medium text-white/50">{abilities.cefrLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* 六维雷达 */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3">
          <AbilityRadar data={abilities.starData} />
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {abilities.starData.map((a) => (
              <span key={a.subject} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/45">
                {a.subject} <b className="text-white/70">{a.score}</b>
              </span>
            ))}
          </div>
        </div>

        {/* 成长曲线 */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/60">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
              我的成长曲线
            </span>
            <span className="text-[9px] text-white/30">最近 30 天 · A1→B2</span>
          </div>
          {series.length ? (
            <GrowthCurve series={series} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-white/35">
              学习轨迹数据不足，今天学几个词就开始生成
            </div>
          )}
          {daysToNext !== null && series.length > 0 && (
            <p className="mt-2 rounded-xl bg-emerald-400/[0.06] px-3 py-2 text-center text-[10px] text-emerald-200/70">
              按当前节奏，约再坚持 {daysToNext} 天可晋级下一阶段
            </p>
          )}
        </div>
      </div>
    </section>
  );
}