// TEMP: 首页第一屏的临时验收页（验完即删）。
// 只渲染真实组件 + 固定夹具，用来在浏览器里看构图（不接鉴权、不碰真实数据）。
import React from "react";
import GuardianScene from "@/components/world/GuardianScene";
import UniverseRow from "@/components/home/UniverseRow";

const PLANETS = [
  { id: "foundation", cn: "基础基石", glyph: "◈", accent: "#6ee7a8", glow: "rgba(110,231,168,0.55)", state: "current", stageCount: 2, doneCount: 1, progress: 50, to: "/plan", today: { active: true } },
  { id: "speaking", cn: "口语交流", glyph: "◉", accent: "#7fd8c4", glow: "rgba(127,216,196,0.55)", state: "uncharted", stageCount: 0, doneCount: 0, progress: 0, to: "/plan" },
  { id: "culture", cn: "文化探索", glyph: "❖", accent: "#e8c684", glow: "rgba(232,198,132,0.55)", state: "uncharted", stageCount: 0, doneCount: 0, progress: 0, to: "/plan" },
  { id: "media", cn: "媒体沉浸", glyph: "▲", accent: "#d99a63", glow: "rgba(217,154,99,0.55)", state: "ahead", stageCount: 2, doneCount: 0, progress: 0, to: "/plan", today: { active: true } },
  { id: "professional", cn: "专业方向", glyph: "✦", accent: "#c9b98a", glow: "rgba(201,185,138,0.55)", state: "active", stageCount: 1, doneCount: 0, progress: 0, to: "/plan" },
];

const IDENTITY = {
  name: "预览验收",
  streak: 20,
  xp: 1650,
  mastered: 326,
  cefr: "A2",
  title: "Thai Explorer",
  hasTest: true,
};

export default function AssetPreview() {
  return (
    <div className="min-h-screen w-full bg-[#050807] px-3.5 py-4">
      <GuardianScene
        identity={IDENTITY}
        onStartConversation={() => {}}
        onPlacement={() => {}}
        dateWidget={
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/45 px-3 py-2 backdrop-blur-xl sm:gap-3 sm:px-4">
            <span className="text-[13px] font-semibold text-white/85 sm:text-sm">9月19日 星期六</span>
            <span className="h-4 w-px bg-white/15" />
            <span className="flex items-center gap-1.5 text-[11px] text-yellow-200/80 sm:text-xs">
              <span>☀️</span>
              下午好，继续加油!
            </span>
          </div>
        }
      >
        <UniverseRow bare planets={PLANETS} onSelect={() => {}} />

        <div className="relative mx-4 mb-4 flex items-start gap-2 rounded-2xl border border-white/[0.08] bg-black/55 py-2.5 pl-4 pr-24 backdrop-blur-xl sm:mx-5 sm:pr-4 lg:mx-6">
          <span className="text-[12px] leading-none">💡</span>
          <p className="text-[11px] leading-relaxed text-white/45">
            小贴士：每天坚持学习，你的星球会变得更加美丽！
          </p>
        </div>
      </GuardianScene>
    </div>
  );
}
