// src/pages/LearningUniverse.jsx
//
// =========================================================
// 学习宇宙（/universe）
// =========================================================
//
// 首页「学习星系」以下的板块全部归拢于此（用户指定划线）：
//
//   ① 泰语技能树（SkillTree：五条能力枝随真实能力值生长）
//   ② 泰国数字博物馆（DigitalMuseum：五个展厅，进度来自真实媒体记录）
//   ③ 成就卡（SharePostcard：可下载 / 可分享的世界快照）
//   ④ 泰语能力评估（AbilitySection：六维雷达 + 成长曲线）
//
// 星系本身与佛像英雄区仍留在首页；本页数据走 useWorldData —— 与首页
// 同一份星球/技能树/主题数据源，在哪一页看状态都一致，不新增存储，
// 不改任何组件契约。
//
// 首屏用共享的 WorldHero（同一张宽幅世界 + 左侧泰中文案 + 右侧真实数字），
// 与首页、对话室、文化宇宙同一套构图语言：打开任何一页都像走进了同一个
// 世界，而不是四个不同的后台。

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { ArrowLeft, Compass, Flame, Landmark, MessageCircle, Sparkles, Sprout, Zap } from "lucide-react";

import SkillTree from "@/components/world/SkillTree";
import DigitalMuseum from "@/components/world/DigitalMuseum";
import SharePostcard from "@/components/world/SharePostcard";
import AbilitySection from "@/components/dashboard/AbilitySection";
import WorldHero, { HeroChip } from "@/components/world/WorldHero";
import useWorldData from "@/hooks/useWorldData";

export default function LearningUniverse() {
  const navigate = useNavigate();
  const sectionsRef = useRef({});

  /* 与首页共用的世界数据：星球 / 路线 / 主题 / 技能树 / 博物馆 */
  const {
    progress,
    loading,
    theme: worldTheme,
    planets: worldPlanets,
    skillTree,
    skillSummary,
    museumRooms,
    identity: worldIdentity,
  } = useWorldData();

  const jumpTo = useCallback((key) => {
    sectionsRef.current?.[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const jumpItems = [
    { key: "skill", label: "技能树" },
    { key: "museum", label: "数字博物馆" },
    { key: "postcard", label: "成就卡" },
    { key: "ability", label: "能力评估" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-0 py-4 sm:px-2">
      {/* 首屏：与首页同一构图语言（佛像世界 + 左侧文案 + 右侧真实数字） */}
      <WorldHero
        eyebrow="ThaiAi Learning Universe"
        thai="จักรวาลการเรียนรู้"
        title="学习宇宙"
        subtitle="技能树、数字博物馆、成就卡与能力评估都在这里。全部数据来自你的真实学习记录——没有造出来的进度。"
        focus="38% 40%"
        accent="#e8c684"
        ariaLabel="学习宇宙"
        stats={[
          {
            Icon: Flame,
            value: worldIdentity?.streak ?? 0,
            label: `连续学习 ${worldIdentity?.streak ?? 0} 天`,
            tone: "text-orange-300",
          },
          {
            Icon: Zap,
            value: (worldIdentity?.xp ?? 0).toLocaleString("en-US"),
            label: `学习经验 ${worldIdentity?.xp ?? 0} XP`,
            tone: "text-[#e8c684]",
          },
          {
            Icon: Sprout,
            value: `${skillSummary?.avg ?? 0} 分`,
            label: "五条能力枝的平均分",
            tone: "text-emerald-300",
          },
          {
            Icon: Landmark,
            value: `${museumRooms?.length ?? 0} 个展厅`,
            label: "数字博物馆展厅数（进度来自媒体学习记录）",
            tone: "text-amber-200",
          },
        ]}
        chips={
          <>
            <HeroChip accent="#e8c684">
              {worldIdentity?.hasTest ? `${worldIdentity.cefr} · ${worldIdentity.cefrTitle}` : "还没做入学测试"}
            </HeroChip>
            {skillSummary?.strongest ? (
              <HeroChip accent="#6ee7a8">最强 {skillSummary.strongest.cn} {skillSummary.strongest.score}</HeroChip>
            ) : null}
            {skillSummary?.weakest ? (
              <HeroChip accent="#f8a5a5">最弱 {skillSummary.weakest.cn} {skillSummary.weakest.score}</HeroChip>
            ) : null}
            <HeroChip accent="#c4b5fd">
              {worldIdentity?.title || "探索者"} · Lv.{worldIdentity?.xpLevel ?? 1}
            </HeroChip>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => jumpTo("skill")}
              className="group flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/[0.14] px-4 py-2.5 text-[12px] font-bold text-emerald-50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/[0.22]"
            >
              <Sparkles className="h-4 w-4 text-emerald-300 transition group-hover:scale-110" />
              看我的技能树
            </button>
            <button
              type="button"
              onClick={() => navigate("/conversation")}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#e8c684]" />
              去 AI 对话室练一轮
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-white/50" />
              回到佛像大厅
            </button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-white/35" />
            {jumpItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => jumpTo(item.key)}
                className="rounded-full border border-white/[0.08] bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white/65 backdrop-blur-xl transition hover:border-white/20 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ① 泰语技能树（取代进度条的表达） */}
      <section
        id="universe-skill"
        ref={(node) => {
          sectionsRef.current.skill = node;
        }}
        className="scroll-mt-6"
      >
        <SkillTree tree={skillTree} summary={skillSummary} />
      </section>

      {/* ② 泰国数字博物馆（五个可走进去的展厅） */}
      <section
        id="universe-museum"
        ref={(node) => {
          sectionsRef.current.museum = node;
        }}
        className="scroll-mt-6"
      >
        <DigitalMuseum rooms={museumRooms} />
      </section>

      {/* ③ 成就卡（把「我的泰语世界」变成一张可以晒出去的图） */}
      <section
        id="universe-postcard"
        ref={(node) => {
          sectionsRef.current.postcard = node;
        }}
        className="scroll-mt-6"
      >
        <SharePostcard
          identity={worldIdentity}
          planets={worldPlanets}
          theme={worldTheme}
        />
      </section>

      {/* ④ 泰语能力评估（六维雷达 + 成长曲线） */}
      <section
        id="universe-ability"
        ref={(node) => {
          sectionsRef.current.ability = node;
        }}
        className="scroll-mt-6"
      >
        <AbilitySection progress={progress} loading={loading} planets={worldPlanets} />
      </section>
    </div>
  );
}
