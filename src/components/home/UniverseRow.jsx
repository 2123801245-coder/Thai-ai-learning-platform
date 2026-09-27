// src/components/home/UniverseRow.jsx
//
// =========================================================
// 「我的泰语世界」· 五尊白色石雕 Orb（首页第二视觉中心）
// =========================================================
//
// 这一块不是导航按钮排，而是「佛像下方展开的五个学习世界」：
// 佛像 → 泰国文化空间 → 五个石雕世界 → 泰语学习。
//
// 视觉本体在 StoneOrbCanvas.jsx（懒加载，three 不进主包）：
// 一个 Canvas、五个 Mesh、程序化浮雕法线贴图、统一的白色石雕材质语言，
// 但内部世界各不相同（石经板 / 声波对话 / 古籍书页 / 佛塔火焰 / 城市天际线）。
//
// 这里只负责**数据与交互的真相**，三件事一件都没少：
//   · 状态（已完成 / 进行中 / 未开始 / 锁定）→ 球的受光与内光
//   · 真实进度（N/M 阶段 · X%）→ 标签
//   · 锁是真门禁（2026-09-20 起）：点锁定球不跳转，当场说明先完成哪一阶段
//
// 布局：桌面一行五尊、错落排布（不是等距一排）；手机 3 + 2 两行，
// 不横向溢出、不压住佛像与 Hero 文案。

import { useTheme } from "@/lib/ThemeContext";
import { inkForWorld } from "@/themes/worlds";
import { orbPalette } from "@/components/world/stoneOrbGlsl";
import { hasWebGL } from "@/components/world/WorldStage";
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, PlayCircle, Sparkles } from "lucide-react";

/* 视觉本体单独成 chunk：没有 WebGL / 不在视口 → 一个字节都不下载 */
const StoneOrbCanvas = lazy(() => import("@/components/world/StoneOrbCanvas"));

const STATE_SHORT = {
  done: { label: "已完成", Icon: CheckCircle2, tone: "text-[#e8c684]" },
  current: { label: "探索中", Icon: PlayCircle, tone: "text-emerald-200" },
  active: { label: "进行中", Icon: PlayCircle, tone: "text-emerald-200/85" },
  ahead: { label: "锁定中", Icon: Lock, tone: "text-white/45" },
  uncharted: { label: "锁定中", Icon: Lock, tone: "text-white/40" },
};

/* 锁：优先用 worldData 给的 locked；没有就用状态兜底 */
const isLocked = (planet) =>
  planet.locked ?? (planet.state === "ahead" || planet.state === "uncharted");

const lockHintOf = (planet) =>
  planet.unlockHint || "按学习路线的顺序解锁：先完成前面的阶段";

/* =========================================================
   布局：归一化画布坐标（0..1）
   ---------------------------------------------------------
   同一组坐标同时喂给 3D（换算成世界坐标）和 DOM 标签（CSS 百分比），
   所以文字永远贴在它那颗球下面，与宽高比无关。
   相位 0° / 72° / 144° / 216° / 288°：五颗球各漂各的，不会齐步走。
========================================================= */
const DESKTOP_SLOTS = [
  { x: 0.14, y: 0.32, scale: 1.0 },
  { x: 0.32, y: 0.48, scale: 0.92 },
  { x: 0.5, y: 0.26, scale: 1.06 },
  { x: 0.68, y: 0.46, scale: 0.92 },
  { x: 0.86, y: 0.34, scale: 1.0 },
];
const MOBILE_SLOTS = [
  { x: 0.2, y: 0.24, scale: 0.9 },
  { x: 0.5, y: 0.2, scale: 1.0 },
  { x: 0.8, y: 0.24, scale: 0.9 },
  { x: 0.36, y: 0.66, scale: 0.94 },
  { x: 0.64, y: 0.66, scale: 0.94 },
];

const BAND = {
  desktop: { h: 250, orb: 92, gap: 8 },
  mobile: { h: 320, orb: 72, gap: 8 },
};

/** 减弱动效：石雕照画（它是静态雕刻），但不再漂移/呼吸 */
function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 是否窄屏（与项目其它地方一致：767px 断点） */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = (e) => setMobile(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export default function UniverseRow({ planets = [], onSelect, bare = false }) {
  /*
   * 强调色按**真正画出来的世界**调整后再用：这些是 inline style，
   * CSS 重映射够不到；浅色模式下若取错世界，浅色字会落到米白纸上。
   */
  const { visualMode } = useTheme();
  const accentInk = React.useCallback((c) => inkForWorld(c, visualMode), [visualMode]);

  const mobile = useIsMobile();
  const box = mobile ? BAND.mobile : BAND.desktop;
  /* 无 WebGL：直接停在静态石雕上（探测结论由 WorldStage 统一缓存） */
  const [gl] = useState(() => hasWebGL());
  const reduced = useMemo(prefersReducedMotion, []);

  /* 滑出视口就停帧：首页往下滚之后不该还在跑 3D */
  const bandRef = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = bandRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries[0]?.isIntersecting ?? true),
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const slots = useMemo(
    () =>
      (mobile ? MOBILE_SLOTS : DESKTOP_SLOTS).map((s, i) => ({
        ...s,
        phase: (i * 72 * Math.PI) / 180,
      })),
    [mobile]
  );

  /* 点锁定世界的即时反馈：在标题栏说清楚「先完成哪一阶段」（不弹 toast） */
  const [lockHint, setLockHint] = useState(null);
  const hintTimer = useRef(null);
  /* 悬停：只在进入/离开时改一次 state，球内的插值在 useFrame 里 */
  const [hoverId, setHoverId] = useState(null);
  /* 3D 就绪后把静态兜底层淡出，避免「先看到占位、再闪一下」 */
  const [glReady, setGlReady] = useState(false);
  /* 点击后的世界扩展：先让球亮起并推开，再跳转 */
  const [expanding, setExpanding] = useState(null);
  const navTimer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    /*
     * 严格模式下 effect 会「挂载 → 清理 → 再挂载」。只在清理里置 false，
     * 会让这个守卫在开发态永远是 false —— 点击后的跳转被自己静默吃掉。
     * 所以挂载时显式置回 true。
     */
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(hintTimer.current);
      clearTimeout(navTimer.current);
    };
  }, []);

  const flashLockHint = (planet) => {
    setLockHint(`${planet.cn} · ${lockHintOf(planet)}`);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setLockHint(null), 4200);
  };

  /* 点球 = 世界扩展（300~700ms）→ 路由。业务跳转仍交给 onSelect */
  const enterWorld = (planet, locked) => {
    if (locked) {
      flashLockHint(planet);
      return;
    }
    setExpanding(planet.id);
    clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      if (mounted.current) onSelect?.(planet);
    }, 420);
  };

  if (!planets.length) return null;

  const labelOffsetPct = ((box.orb / 2 + box.gap) / box.h) * 100;

  return (
    <section
      id="universe"
      className={
        bare
          ? "relative scroll-mt-24 px-4 pb-3 pt-4 sm:px-5 lg:px-6 lg:pt-2"
          : "mt-4 scroll-mt-24 rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-4 shadow-lg shadow-black/20 backdrop-blur-xl sm:p-5"
      }
    >
      {/* 可读性底色：这一行常落在佛像胸前亮部上，小字直接躺在照片上会糊 */}
      {bare ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-8px)] bg-gradient-to-b from-transparent via-[#050807]/28 to-[#050807]/58"
          /* 深色世界的可读性压暗层；纸上直接退掉（world-shim data-plate） */
          data-plate="scrim"
        />
      ) : null}

      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-black text-white sm:text-[19px]">
            我的泰语世界
          </h2>
          <p className="mt-1 text-[11px] text-white/45">点击石雕进入对应的学习世界</p>
        </div>
        {lockHint ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-200/90">
            <Lock className="h-3 w-3" />
            {lockHint}
          </span>
        ) : (
          <span className="text-[10px] text-white/45">
            <span className="hidden sm:inline">当前世界受光最亮 · </span>
            🔒 锁定中＝尚未解锁，需先完成当前阶段
          </span>
        )}
      </div>

      {/* ---------------------------------------------------------
          石雕世界带：一个 WebGL 画布 + 五个归一化槽位
      --------------------------------------------------------- */}
      <div ref={bandRef} className="relative mt-3 w-full" style={{ height: box.h }}>
        {/* 静态兜底：无 WebGL / 减弱动效。3D 就绪后淡出 */}
        <div
          aria-hidden="true"
          className="transition-opacity duration-500"
          style={{ opacity: glReady ? 0 : 1 }}
        >
          {slots.map((slot, i) => (
            <StaticStone
              key={planets[i]?.id || i}
              slot={slot}
              size={box.orb * slot.scale}
              highlight={hoverId === planets[i]?.id || expanding === planets[i]?.id}
            />
          ))}
        </div>

        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: glReady ? 1 : 0, pointerEvents: glReady ? "auto" : "none" }}
        >
          {gl ? (
            <Suspense fallback={null}>
              <StoneOrbCanvas
                planets={planets}
                slots={slots}
                palette={orbPalette(visualMode)}
                orbPx={box.orb}
                hoverId={hoverId}
                expandingId={expanding}
                /* 减弱动效留在 demand：只画一次静态雕刻，不持续跑帧 */
                paused={!onScreen || reduced}
                dpr={mobile ? [1, 1.5] : [1, 1.75]}
                antialias={!mobile}
                onReady={() => setGlReady(true)}
                /* 上下文丢了就退回静态石雕，不要让英雄区空成一条白带 */
                onContextLost={() => setGlReady(false)}
                onHover={(id, on) => setHoverId(on ? id : null)}
                onSelect={(planet, locked) => enterWorld(planet, locked)}
              />
            </Suspense>
          ) : null}
        </div>

        {/* 文字标签：与球同一组归一化坐标，所以永远贴在球下方 */}
        {planets.map((planet, i) => {
          const slot = slots[i];
          if (!slot) return null;
          const meta = STATE_SHORT[planet.state] || STATE_SHORT.ahead;
          const locked = isLocked(planet);
          const active = hoverId === planet.id;
          return (
            <button
              key={planet.id}
              type="button"
              onMouseEnter={() => setHoverId(planet.id)}
              onMouseLeave={() => setHoverId((h) => (h === planet.id ? null : h))}
              onClick={() => enterWorld(planet, locked)}
              aria-disabled={locked || undefined}
              title={locked ? `${planet.cn} · 尚未解锁 · ${lockHintOf(planet)}` : `进入 ${planet.cn}`}
              className={
                "absolute max-w-[86px] -translate-x-1/2 text-center transition-colors sm:max-w-[116px] " +
                (locked ? "cursor-not-allowed" : "cursor-pointer")
              }
              style={{
                left: `${slot.x * 100}%`,
                top: `${(slot.y + labelOffsetPct / 100) * 100}%`,
              }}
            >
              <span
                className={
                  "block truncate text-[12px] font-bold transition sm:text-[12.5px] " +
                  (locked ? "text-white/45" : active ? "text-white" : "text-white/90")
                }
              >
                {planet.cn}
              </span>
              <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px]">
                <meta.Icon className={`h-3 w-3 ${meta.tone}`} />
                <span className={meta.tone}>{meta.label}</span>
              </span>
              <span className="mt-0.5 block text-[10px] text-white/45">
                {planet.stageCount > 0
                  ? `${planet.doneCount}/${planet.stageCount} 阶段 · ${planet.progress}%`
                  : "不在当前路线"}
              </span>
              {planet.today?.active ? (
                <span
                  className="mt-1 inline-block rounded-full border px-1.5 py-[1px] text-[9px] font-bold"
                  style={{
                    borderColor: `${planet.accent}66`,
                    background: "rgba(0,0,0,0.55)",
                    color: accentInk(planet.accent),
                  }}
                  data-plate="panel"
                >
                  今日
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect?.({ to: "/plan", cn: "学习路线" })}
        className="relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/55 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:bg-black/70 hover:text-white"
      >
        <Sparkles className="h-3.5 w-3.5 text-emerald-300/70" />
        查看完整学习路线
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

/* 无 WebGL 时的静态石雕：同一套「白色石材」语言，只是画不出浮雕。
   调色板见 stoneOrbGlsl.orbPalette（按 visualMode 取，而不是用户选的 world）。 */
function StaticStone({ slot, size, highlight }) {
  return (
    <span
      aria-hidden="true"
      className="absolute rounded-full transition-transform duration-500"
      style={{
        left: `${slot.x * 100}%`,
        top: `${slot.y * 100}%`,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${highlight ? 1.06 : 1})`,
        background:
          "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.92), rgba(238,232,220,0.86) 42%, rgba(206,198,182,0.9) 78%, rgba(168,160,144,0.95))",
        boxShadow:
          "inset 0 -6px 14px rgba(60,48,30,0.22), inset 0 4px 10px rgba(255,255,255,0.5), 0 10px 24px -12px rgba(0,0,0,0.55)",
      }}
    />
  );
}
