// src/components/world/WorldHero.jsx
//
// =========================================================
// World Hero Band —— 其余主要页面的首屏（对话室 / 学习宇宙 / 文化宇宙）
// =========================================================
//
// 首页第一屏（GuardianScene）是这一整套视觉语言的母版：同一张宽幅照片、
// 同一套压暗层与暗角、同一组灯笼光点、左侧「泰文 + 中文」文案块、右侧
// 玻璃 HUD。其余主要页面如果各写各的标题栏，站内就会有四种「打开方式」。
//
// 于是把母版的**构图**抽出来：竖版素材给窄屏、宽幅素材给桌面；左侧留出
// 文案安全区（压暗层照抄首页的那条 0.86 → 0.46@22% → 0.12@42% 梯度），
// 右侧放真实数据 HUD。区别只有两处，都按页面来：
//
//   focus  —— 取景位置（每页看这张世界的不同角落）
//   accent —— 页面自己的色相（一层很淡的径向光 + 文案与标签的颜色）
//
// 高度收成一条「带」而不是满屏：首屏第一眼是同一个世界，第二眼就能看到
// 这一页真正的功能（下面继续，不折叠、不隐藏）。

import React from "react";
import { Sparkles } from "lucide-react";

/*
 * 灯笼光点：与首页同一套坐标语言（固定坐标 + 不同时长，不做随机数，
 * 避免每次渲染重新布局）。
 */
const LANTERNS = [
  { x: 12, y: 18, s: 3, d: 9, o: 0.5 },
  { x: 26, y: 9, s: 2, d: 11, o: 0.42 },
  { x: 44, y: 15, s: 2.5, d: 10, o: 0.38 },
  { x: 62, y: 7, s: 2, d: 13, o: 0.45 },
  { x: 78, y: 12, s: 3, d: 8.5, o: 0.5 },
  { x: 88, y: 24, s: 2, d: 12, o: 0.36 },
  { x: 8, y: 42, s: 2, d: 14, o: 0.3 },
  { x: 70, y: 34, s: 2.5, d: 11.5, o: 0.4 },
  { x: 94, y: 46, s: 2, d: 10.5, o: 0.32 },
  { x: 34, y: 30, s: 2, d: 15, o: 0.28 },
];

/* #6ee7a8 → "110, 231, 168"，给 CSS 变量用（不引入 color-mix，兼容更稳） */
function rgbTriplet(hex) {
  const value = String(hex || "").replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (full.length !== 6) return "110, 231, 168";
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return "110, 231, 168";
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

/* 顶部 HUD 的数字药丸（与首页 StatPill 同一形状） */
function HeroStat({ Icon, value, label, tone }) {
  return (
    <span
      title={label}
      className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/45 px-2.5 py-1.5 backdrop-blur-xl"
    >
      {Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-emerald-300"}`} /> : null}
      <span className="text-[11px] font-bold text-white/85">{value}</span>
    </span>
  );
}

/*
 * 文案块下方的徽章（页眉里那排小标签的统一形状）。
 * 底色用内联的深色玻璃而不是很淡的主题色：这些芯片浮在照片上，
 * 淡色底在亮部（寺庙、水面）会直接消失；深底 + 主题色字则在深浅两种
 * 模式下都读得出来（浅色模式的全局重映射只改 class，不改内联值）。
 */
export function HeroChip({ children, accent }) {
  const rgb = rgbTriplet(accent);
  return (
    <span
      className="world-chip rounded-lg border px-2 py-0.5 text-[10px] font-bold backdrop-blur-xl"
      style={{
        borderColor: `rgba(${rgb}, 0.32)`,
        background: "rgba(5, 8, 7, 0.42)",
        color: `rgba(${rgb}, 0.95)`,
      }}
    >
      {children}
    </span>
  );
}

export default function WorldHero({
  eyebrow,
  thai,
  title,
  subtitle,
  focus = "50% 50%",
  accent = "#6ee7a8",
  stats = [],
  badge,
  chips,
  actions,
  footer,
  ariaLabel,
}) {
  const rgb = rgbTriplet(accent);

  return (
    <section
      aria-label={ariaLabel || title}
      className="world-scene world-band relative isolate overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#050807] shadow-2xl shadow-black/45"
      style={{
        "--hero-focus": focus,
        "--hero-accent-soft": `rgba(${rgb}, 0.16)`,
      }}
    >
      {/* ================= 背景：与首页同一张素材（窄屏竖幅 / 桌面宽幅） ============== */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <picture>
          <source
            media="(min-width: 1100px)"
            srcSet="/images/thai-guardian-hero-wide.webp"
            type="image/webp"
          />
          <source
            media="(min-width: 1100px)"
            srcSet="/images/thai-guardian-hero-wide.jpg"
            type="image/jpeg"
          />
          <source srcSet="/images/thai-guardian-hero.webp" type="image/webp" />
          <img
            src="/images/thai-guardian-hero.jpg"
            alt=""
            className="world-scene-subject world-band-subject absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
        </picture>

        {/*
         * 压暗：与首页同一套做法 —— 佛像身上不蒙任何东西。
         * 纵向层与暗角都撤掉了，只留文案底下的窄渐变（~30% 归零，
         * 佛像在 25%~75%，等于不碰它）；文字对比度交给 text-shadow。
         */}
        <div className="world-band-shade-r absolute inset-0" />

        {/* 这一页自己的色相：右上角一层很淡的径向光 */}
        <div className="world-band-accent absolute inset-0" />

        {/* 底缘融回页面底色，带子下沿不要出现硬边 */}
        <div className="world-band-fade absolute inset-x-0 bottom-0" />
      </div>

      {/* ================= 灯笼光点 ============== */}
      <div className="world-lanterns pointer-events-none absolute inset-0" aria-hidden="true">
        {LANTERNS.map((dot, index) => (
          <span
            key={index}
            className="world-lantern"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: `${dot.s}px`,
              height: `${dot.s}px`,
              opacity: dot.o,
              animationDuration: `${dot.d}s`,
              animationDelay: `${index * 0.7}s`,
            }}
          />
        ))}
      </div>

      {/* ================= 内容 ============== */}
      {/*
       * 高度：窄屏用视口比例（这样文案块靠底时还有余量落在佛像身前，
       * 与首页手机版的构图一致）；桌面固定 540px 的一条带子 ——
       * 首屏是同一个世界，第二眼就能看到这一页真正的功能。
       */}
      <div className="relative flex min-h-[70svh] flex-col sm:min-h-[62svh] min-[1100px]:min-h-[540px]">
        {/* 顶部 HUD：栏目定位（左） + 真实数字与状态（右） */}
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5 lg:p-6">
          <p
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: `rgba(${rgb}, 0.8)` }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {stats.map((stat, index) => (
              <HeroStat key={index} {...stat} />
            ))}
            {badge}
          </div>
        </div>

        {/*
         * 左侧文案块：位置与首页同一条基线 —— 窄屏靠底（mt-auto，把上方
         * 留给佛像的脸，与首页手机版一致），桌面由 CSS 居中并给 40px 左缩进。
         */}
        <div className="world-scene-copy mt-auto max-w-[560px] px-4 pb-6 sm:px-5 lg:pb-10">
          {thai ? (
            <p className="font-viaoda text-[24px] leading-tight text-white/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[30px]">
              {thai}
            </p>
          ) : null}

          <h1 className="mt-1.5 text-[27px] font-black leading-[1.22] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[32px] lg:text-[30px]">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-3 max-w-[430px] text-[12.5px] leading-relaxed text-white/65 sm:text-[13.5px]">
              {subtitle}
            </p>
          ) : null}

          {chips ? <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div> : null}

          {actions ? <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>

        {/*
         * 底部条：页面自己的入口提示（没有就只留出呼吸）。
         * 不带 mt-auto —— 窄屏它会跟文案一起落到带子底部，把上方整块留给
         * 佛像；桌面由 CSS（.world-scene .world-scene-bottom）压到画面底缘。
         */}
        <div className="world-scene-bottom px-4 pb-4 sm:px-5 lg:px-6">
          {footer || <span className="block h-1" />}
        </div>
      </div>
    </section>
  );
}
