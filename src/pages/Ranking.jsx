import React from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Flame,
  Zap,
  Target,
  CalendarCheck,
  ArrowRight,
  Check,
  Info,
} from "lucide-react";

import { useLearningProgress } from "@/hooks/useLearningProgress";
import { getPlanOverview } from "@/api/plan";
import { getLevelInfo } from "@/lib/level";
import { PageShell } from "@/components/common/PageShell";
import { Section, SectionGrid, StatTile } from "@/components/common/Section";
import { useAsyncData } from "@/hooks/useAsyncData";

/* =========================================================
   学习排行榜 → 实际职责：**个人学习战绩**（Streak & 战绩中枢）
   ---------------------------------------------------------
   为什么改这一页
   --------------
   重构前站里有两套并行的「排行榜」，而且互相矛盾：
     • /ranking      —— 硬编码 demoUsers 数组，连"你"都是假数据
                        （第 6 名、连续 12 天、96 小时），页面自己标注
                        "排行榜服务准备中"，但假数据照常展示；
     • /challenges   —— 走 base44 外部 functions 拉真榜单，而本项目的
                        排行榜后端（Express）**根本没有这个接口**，
                        失败被 catch 吞掉 → 实际永远空榜。
   两页都在回答"我排第几"，而两页都给不出真话。

   现在这一页只做**能算准的事**：你的连续天数、XP、本周打卡、下一个
   奖励里程碑。这些都来自真实数据源——
     • useLearningProgress（本地学习进度，XP 唯一事实来源）
     • GET /api/plan/overview（服务端连续打卡与本周记录）
   公开排行榜等后端提供接口后再恢复，届时不改本页结构，只把数据源
   从「未开放」换成接口返回。
========================================================= */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 服务端返回的是 YYYY-MM-DD，这里只做展示用的星期缩写 */
function weekdayOf(date) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `周${WEEKDAYS[d.getDay()]}`;
}

export default function Ranking() {
  const { progress, loading } = useLearningProgress();

  const { data: overview } = useAsyncData(getPlanOverview, []);

  const xp = progress?.xp || 0;
  const level = getLevelInfo(xp);
  const streak = progress?.learning_streak || 0;
  const todayWords = progress?.today_words || 0;

  /* 服务端的连续天数与本周记录优先（服务端按真实打卡算） */
  const serverStreak = overview?.streak;
  const displayStreak = serverStreak != null ? serverStreak : streak;
  const week = overview?.week || [];
  const reward = overview?.reward || null;
  const checkedDays = week.filter((day) => day.completed).length;

  return (
    <PageShell
      width="default"
      title="学习战绩"
      subtitle="连续天数、经验值与本周打卡都来自你的真实记录。公开排行榜待后端接口就绪后开放。"
      icon={Trophy}
      badge="Ranking"
    >
      {/* ── 战绩总览 ── */}
      <Section
        title="我的战绩"
        desc={loading ? "正在读取学习记录…" : "以下数字均来自真实学习记录，不是示例数据"}
        divider={false}
      >
        <SectionGrid cols={4}>
          <StatTile
            icon={Flame}
            tone="orange"
            value={displayStreak}
            unit="天"
            label="连续学习"
            hint={serverStreak != null ? "服务端打卡记录" : "本地学习记录"}
          />
          <StatTile
            icon={Zap}
            tone="gold"
            value={xp.toLocaleString("en-US")}
            label={`学习经验 · Lv.${level.level}`}
            hint={level.next != null ? `距下一级还差 ${Math.max(0, level.next - xp)} XP` : "已达最高等级"}
          />
          <StatTile
            icon={Target}
            tone="emerald"
            value={todayWords}
            unit="词"
            label="今日学习词汇"
          />
          <StatTile
            icon={CalendarCheck}
            tone="sky"
            value={`${checkedDays}/7`}
            label="本周完成打卡"
          />
        </SectionGrid>
      </Section>

      {/* ── 本周打卡 ── */}
      <Section
        title="本周打卡"
        desc="每天完成学习计划即自动打卡，连续 7 天可领取 3 天 VIP"
      >
        {week.length ? (
          <div className="flex flex-wrap gap-2">
            {week.map((day) => (
              <div
                key={day.date}
                className={`flex min-w-[64px] flex-1 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 ${
                  day.completed
                    ? "border-emerald-300/30 bg-emerald-400/[0.1]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                <span className="text-[11px] font-semibold text-white/50">
                  {weekdayOf(day.date)}
                </span>
                {day.completed ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-white/15" />
                )}
                <span className="text-[10px] tabular-nums text-white/30">
                  {day.totalTasks ? `${day.completedTasks}/${day.totalTasks}` : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
            <p className="text-[12px] leading-relaxed text-white/45">
              还没有本周打卡记录。去「我的旅程」完成今天的任务就会开始记录连续天数。
            </p>
          </div>
        )}
      </Section>

      {/* ── 里程碑奖励 ── */}
      <Section title="里程碑奖励" desc="连续打卡达到里程碑，自动发放 VIP 天数">
        {reward ? (
          <div className="rounded-2xl border border-yellow-300/15 bg-gradient-to-br from-yellow-300/[0.08] via-transparent to-transparent p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Trophy className="h-5 w-5 text-yellow-300/80" />
                <div>
                  <p className="text-[13px] font-bold text-white/90">
                    连续 {reward.milestone || 7} 天 · 送 {reward.rewardDays || 3} 天 VIP
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    还差 {reward.daysToNext ?? "—"} 天到达下一个里程碑
                  </p>
                </div>
              </div>

              <Link
                to="/plan"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.2]"
              >
                去打卡 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
            <p className="text-[12px] leading-relaxed text-white/45">
              连续打卡 7 天可领取 3 天 VIP，奖励自动发放到账户。
            </p>
          </div>
        )}
      </Section>

      {/* ── 公开排行榜（未开放，明确说明而不是放假数据） ── */}
      <Section title="公开排行榜" desc="和其他学习者比较进度">
        <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300/60" />
          <div className="text-[12px] leading-relaxed text-white/45">
            <p className="font-semibold text-white/60">排行榜尚未开放</p>
            <p className="mt-0.5">
              后端还没有提供排行榜接口，所以这里**不展示任何虚构排名**。
              此前的页面上出现过一份示例榜单（含一个假的"你"），已下线，
              以免和你的真实连续天数冲突。
            </p>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
