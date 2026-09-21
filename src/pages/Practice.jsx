import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlags } from "@/lib/features";
import { resolvePracticeGroups } from "@/lib/navigation";
import { PageShell } from "@/components/common/PageShell";
import { Section, SectionGrid } from "@/components/common/Section";

/* =========================================================
   练习中心 · Practice（移动端底部导航「练习」的落地页）
   ---------------------------------------------------------
   职责：**所有练习玩法的唯一权威入口**。
   分组与条目来自 src/lib/navigation.js 的 resolvePracticeGroups()，
   与侧边栏同一份数据源——重构前这里另写了一份 GROUPS 数组，
   和 Sidebar 的 16 项、Navbar 的 8 项互相对不上。

   这一页不做练习本身，只负责「让你知道有哪些练法、分别练什么」。
   每个条目点击后进入对应页面的真实实现，功能一处都没少。
========================================================= */

export default function Practice() {
  const flags = useFeatureFlags(["aiTeacher"]);
  const groups = resolvePracticeGroups((name) => Boolean(flags[name]));

  return (
    <PageShell
      width="default"
      title="练习中心"
      subtitle="所有练习板块共用你的词书、错题本与学习记录。AI 老师会根据最近表现推荐今天最该练的方向。"
      icon={Sparkles}
      badge="ฝึ ก"
    >
      <div className="space-y-7">
        {groups.map((group, index) => (
          <Section
            key={group.id}
            title={group.name}
            desc={group.desc}
            divider={index > 0}
          >
            <SectionGrid cols={3}>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  onMouseEnter={() => prefetchRoute(item.to.split("?")[0])}
                  className="group relative flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5 transition hover:border-emerald-300/25 hover:bg-white/[0.07]"
                >
                  <div className="flex items-start justify-between">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[17px]"
                    >
                      {item.emoji}
                    </span>
                    {item.badge ? (
                      <span className="rounded-full border border-amber-300/25 bg-amber-400/[0.1] px-1.5 py-px text-[9px] font-bold text-amber-300/90">
                        {item.badge === "vip" ? "VIP" : item.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90">{item.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-white/35">
                      {item.desc}
                    </div>
                  </div>

                  <span className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-300/50 transition group-hover:text-emerald-300">
                    开始练习 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </SectionGrid>
          </Section>
        ))}
      </div>

      {/* AI 老师引导：唯一的主行动，不进卡片网格 */}
      <div className="mt-8 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.08] via-transparent to-teal-400/[0.04] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-gradient-to-br from-[#0e241f] to-[#0a1615]">
              <span
                className="absolute inset-0 animate-ping rounded-full bg-emerald-400/[0.12] [animation-duration:3s]"
                style={{ pointerEvents: "none" }}
              />
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </span>
            <div>
              <div className="text-sm font-bold text-white/90">不知道今天练什么？</div>
              <p className="mt-0.5 text-xs text-white/40">
                让 AI 老师根据你的水平和学习记录安排今日练习
              </p>
            </div>
          </div>
          <Link
            to="/conversation"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-[#061513] transition hover:bg-emerald-300"
          >
            问 AI 老师 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
