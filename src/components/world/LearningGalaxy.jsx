// src/components/world/LearningGalaxy.jsx
//
// =========================================================
// 学习星系（学习路线的空间化表达）
// =========================================================
//
// 取代原来的「课程卡片列表」：五颗星球 + 真实的阶段进度。
//
// 两层结构：
//   上：WebGL 星系（GalaxyScene，懒加载 / 离屏暂停 / 无 WebGL 走 CSS 星图）
//   下：真实数据面板 —— 每颗星球的阶段数、完成度、剩余小时、画像原因，
//       以及选中星球的**真实阶段明细**（第 N~M 天、预计用时、入口）
//
// 为什么保留下面这层：3D 只能表达「大概在哪里」，学生要决定「今天点什么」
// 时需要的是确定的信息（哪个阶段、还剩多久）。空间感与准确性都要。
// =========================================================

import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@/lib/ThemeContext";
import { inkForWorld } from "@/themes/worlds";
import { ArrowRight, Clock, Compass, Info, Lock, Minus, Plus, RotateCcw, Sparkles, X } from "lucide-react";

import WorldStage, { useWorldQuality } from "./WorldStage";
import {
  ORBIT_LIMITS,
  applyDrag,
  applyPinch,
  applyZoom,
  clickAllowed,
  createOrbitState,
  exceedsDragThreshold,
  pointerSpread,
  resetOrbit,
} from "./orbitControls";

const GalaxyScene = lazy(() => import("./GalaxyScene"));

/* =========================================================
   星系背景视频
   ---------------------------------------------------------
   星系画布的深空背景改成**真实星空素材**（/starry-sky.mp4，
   与登录页同一份），3D 星域/轨迹/星云全部以加成方式叠在它上面 ——
   这样底色是真实天文影像，而不是渲染出来的纯黑。

   前提：WorldCanvas 已经是 alpha 透明的，挡住视频的是 GalaxyScene 里
   那个不透明的背景球，所以那边同步把它去掉了。

   「减弱动效」时不上视频：System 只要静态背景就够，也省掉一路视频解码。
   ========================================================= */
const GALAXY_BG_VIDEO = "/starry-sky.mp4";
const GALAXY_BG_POSTER = "/site-bg-coast.jpg";

/* =========================================================
   视觉世界 → 星图画布的皮
   ---------------------------------------------------------
   3D 内部的气氛由 GalaxyScene 的 mood 负责；**画布这一层**（底色、背景视频、
   压暗层、纸上网格）是 CSS/HTML 的事，放在这里。

   为什么"纸上星图"必须换掉整层底：容器原来是不透明的深蓝黑（#04090c/75）
   加一层更深的径向压暗 + 一张星空视频 —— 三者叠起来是一块夜空，
   3D 里再怎么把星点调成墨色，也读不出"印在纸上的星图"。
   纸世界要的是**不透明的米白纸面**，视频则完全不上（省一路解码，见 CSS 的
   [data-galaxy-mode="paper"] .galaxy-bg-video）。

   注意：这里只改"皮"，空间语义（轨道半径 = 掌握度）、today 探针、
   world-today-dot/ring、veil.tier 编码、拖拽/缩放/hover/click/focus 全部不动。
========================================================= */

/** 各世界的画布底色与压暗层（值是 CSS 颜色串） */
const GALAXY_SKIN = {
  midnight: {
    /*
     * 画布底色。历史值 0.75 —— 剩下 25% 会把**站点底色的金网格**透上来，
     * 在深空里读成一层莫名其妙的网格噪声（用户截图左侧那条网格带就是它）。
     * 深空要的是"真的黑"，所以抬到 0.94。
     */
    frame: "rgba(4, 9, 12, 0.94)",
    ring: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.09)",
    scrim:
      "radial-gradient(72% 78% at 50% 46%, rgba(4,9,12,0.52), rgba(4,9,12,0.84) 70%, rgba(4,9,12,0.94))",
    bottom: "linear-gradient(to bottom, transparent, rgba(4,9,12,0.75))",
    /* 顶部径向光晕：把视线引到星系中心 */
    glow: "rgba(110,231,168,0.10)",
  },
  paper: {
    frame: "#f6f1e6",
    ring: "rgba(108, 92, 62, 0.18)",
    border: "rgba(108, 92, 62, 0.30)",
    /* 纸面不做压暗：改成一层极淡的"旧纸中心发黄"，让画布中间更像是被光晒过 */
    scrim:
      "radial-gradient(78% 82% at 50% 46%, rgba(255, 252, 243, 0.55), rgba(246, 240, 226, 0.10) 62%, rgba(226, 214, 189, 0.22))",
    bottom: "linear-gradient(to bottom, transparent, rgba(233, 222, 198, 0.85))",
    glow: "rgba(154,123,46,0.10)",
  },
  forest: {
    frame: "rgba(6, 14, 11, 0.78)",
    ring: "rgba(200, 226, 205, 0.06)",
    border: "rgba(200, 226, 205, 0.12)",
    /* 林间：视频之上加一层很淡的自然绿雾，压对比（不是压暗） */
    scrim:
      "radial-gradient(76% 80% at 50% 46%, rgba(10,22,17,0.42), rgba(8,18,14,0.72) 66%, rgba(6,14,11,0.86)), linear-gradient(180deg, rgba(122,168,132,0.10), transparent 46%)",
    bottom: "linear-gradient(to bottom, transparent, rgba(6,16,12,0.78))",
    glow: "rgba(111,163,127,0.12)",
  },
  modern: {
    frame: "rgba(6, 9, 11, 0.82)",
    ring: "rgba(47, 176, 138, 0.10)",
    border: "rgba(255, 255, 255, 0.14)",
    scrim:
      "radial-gradient(74% 80% at 50% 46%, rgba(8,11,14,0.58), rgba(8,11,14,0.90) 68%, rgba(8,11,14,0.96))",
    bottom: "linear-gradient(to bottom, transparent, rgba(8,11,14,0.82))",
    glow: "rgba(47,176,138,0.09)",
  },
};

/**
 * 当前视觉世界。
 * 直接读 useTheme（组件本来就在 ThemeProvider 里），不用猜 DOM 属性 ——
 * 切世界时 themeId 变 → world 变 → 这里立刻跟着变，不需要监听 attribute。
 */
function useGalaxyWorld() {
  const { world } = useTheme();
  const visualMode = world?.visualMode || "midnight";
  return {
    visualMode,
    skin: GALAXY_SKIN[visualMode] || GALAXY_SKIN.midnight,
    /* 纸上星图 = 不透明的纸面：视频必须关掉（CSS 里也兜了一层 display:none） */
    paper: visualMode === "paper",
  };
}

function useAllowBackgroundVideo() {
  const [allow, setAllow] = React.useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setAllow(!event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return allow;
}

/* =========================================================
   无 WebGL 时的 CSS 星图
========================================================= */

/**
 * 无 WebGL 时的 CSS 星图。
 *
 * ⚠️ 轨道半径的**语义必须与 WebGL 版一致**（半径 = 掌握度），否则同一个
 * 用户开着 3D 与关掉 3D 会看到两套矛盾的空间关系，编码就白设计了。
 * 所以 px 每单位换算在两边用同一个函数（pxPerUnit）。
 */
const pxPerUnit = 36;

function StaticStarMap({ planets, activeId, onSelect, visualMode = "midnight" }) {
  const paper = visualMode === "paper";
  /* 无 WebGL 的兜底图同样按世界换色：否则纸世界的用户在静态模式下
     会看到一块深空底 + 金点，与 3D 版本是两个世界。 */
  return (
    <div className="relative h-full w-full" data-galaxy-mode={visualMode}>
      <div
        className="absolute inset-0"
        style={{
          background: paper
            ? "radial-gradient(circle at 50% 52%, rgba(154,123,46,0.10), rgba(154,123,46,0.03) 30%, transparent 56%)"
            : "radial-gradient(circle at 50% 52%, rgba(255,217,160,0.20), rgba(255,217,160,0.04) 26%, transparent 52%)",
        }}
      />
      {/* 五条轨道（半径 = 该星球掌握度收紧后的真实半径） */}
      {planets.map((planet, index) => {
        const orbit = (planet.radius ?? 2.15 + index * 0.52) * pxPerUnit;
        return (
          <div
            key={`orbit-${planet.id}`}
            className="absolute left-1/2 top-1/2 rounded-full border"
            style={{
              width: orbit * 2,
              height: orbit * 2,
              borderColor: paper ? "rgba(58, 74, 60, 0.22)" : `${planet.accent}22`,
              transform: "translate(-50%,-50%) scaleY(0.62)",
            }}
          />
        );
      })}
      {/*
       * 今天练过的星球在静态星图里也得有反应。
       * 静态模式不是「残缺版」：没有 WebGL 的用户照样要能看出今天做了事。
       */}
      {planets.map((planet, index) => {
        if (!planet.today?.active) return null;
        const orbit = (planet.radius ?? 2.15 + index * 0.52) * pxPerUnit;
        const angle = (index / planets.length) * Math.PI * 2 - Math.PI / 2;
        /* 环的直径随今天的活跃度长大，定位靠 margin + 外层 translate 居中 */
        const diameter = 21 + (planet.today.intensity || 0) * 26;
        return (
          <span
            key={`today-${planet.id}`}
            aria-hidden="true"
            className="world-today-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              marginLeft: Math.cos(angle) * orbit,
              marginTop: Math.sin(angle) * orbit * 0.62,
              width: diameter,
              height: diameter,
              border: `1px solid ${planet.accent}`,
            }}
          />
        );
      })}
      {planets.map((planet, index) => {
        const orbit = (planet.radius ?? 2.15 + index * 0.52) * pxPerUnit;
        const angle = (index / planets.length) * Math.PI * 2 - Math.PI / 2;
        const isActive = activeId === planet.id;
        /* dim 只降低透明度；点一下只是看详情（不算进入），
           真门禁在详情面板里的入口按钮上（planet.locked） */
        const dim = planet.veil?.tier === "heavy";
        return (
          <button
            key={planet.id}
            type="button"
            onClick={() => onSelect(planet)}
            title={`${planet.cn} · ${planet.progress}% · ${planet.veil?.label || ""}`}
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition"
            style={{
              marginLeft: Math.cos(angle) * orbit,
              marginTop: Math.sin(angle) * orbit * 0.62,
              width: isActive ? 34 : 24,
              height: isActive ? 34 : 24,
              background: paper
                ? "radial-gradient(circle at 35% 30%, #3a4a3c, rgba(58,74,60,0.35) 70%, transparent)"
                : `radial-gradient(circle at 35% 30%, ${planet.accent}, ${planet.accent}33 70%, transparent)`,
              opacity: dim ? 0.45 : 1,
              boxShadow: paper
                ? "0 1px 2px rgba(60,48,30,0.25)"
                : isActive
                  ? `0 0 26px ${planet.glow}`
                  : `0 0 12px ${planet.glow}`,
            }}
          >
            <span className={`text-[10px] font-black ${paper ? "text-[#f6f1e6]" : "text-black/70"}`}>
              {planet.glyph}
            </span>
          </button>
        );
      })}
      <div
        className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: paper
            ? "radial-gradient(circle, #9a7b2e, rgba(154,123,46,0.22) 60%, transparent)"
            : "radial-gradient(circle, #ffd9a0, rgba(255,217,160,0.25) 60%, transparent)",
          boxShadow: paper
            ? "0 0 18px rgba(154,123,46,0.35)"
            : "0 0 34px rgba(255,217,160,0.6)",
        }}
      />
    </div>
  );
}

/* =========================================================
   状态 → 文案
========================================================= */

const STATE_META = {
  done: { label: "已完成", className: "text-emerald-200/90", dot: "bg-emerald-300" },
  current: { label: "进行中 · 当前", className: "text-yellow-200", dot: "bg-yellow-300" },
  active: { label: "进行中", className: "text-emerald-200/80", dot: "bg-emerald-300/70" },
  ahead: { label: "待启程", className: "text-white/50", dot: "bg-white/30" },
  uncharted: { label: "未勘测", className: "text-white/35", dot: "bg-white/15" },
};

/*
 * 编码图例。
 *
 * 没有它，用户看到的是「五个球在转」；有了这三行，看到的是「我熟到哪、
 * 哪块被遮住、我卡在哪」。空间隐喻必须自解释，否则只是好看。
 */
const LEGEND = [
  { swatch: "radius", label: "轨道半径 = 掌握度", hint: "越熟越向中心靠拢" },
  { swatch: "dust", label: "星尘 = 还没排到你", hint: "厚尘是画像没推到这里（仍可点）" },
  { swatch: "amber", label: "琥珀脉冲环 = 进度最低", hint: "全星系里落后最多的那一块" },
  /*
   * 第四行是「今天」这一层。它必须单独占一行：上面三条都是**累计**状态，
   * 只有这条是**今天**的。混在一起用户会以为今天的行动改变了长期进度。
   */
  { swatch: "today", label: "向外扩的环 = 今天练过", hint: "尘埃会被吹开，还有一条光丝汇进中心" },
];

/* =========================================================
   主体
========================================================= */

export default function LearningGalaxy({ planets = [], path = null, theme = null, today = null }) {
  const navigate = useNavigate();
  const quality = useWorldQuality();
  const allowBgVideo = useAllowBackgroundVideo();
  /* 视觉世界：决定画布这一层的"皮"（底色/视频/压暗/纸上网格） */
  const { visualMode, skin, paper } = useGalaxyWorld();
  /*
   * 方向色要按世界调整过再用。
   * planet.accent 是 inline style，CSS 重映射够不到；原色（#6ee7a8 / #e8c684 …）
   * 落在米白纸上实测对比度只有 1.36 —— "FOUNDATION"、"未排入路线" 这类小标签
   * 在 PAPER 下基本看不见。inkForWorld 只在 paper 压深，深色世界原样返回。
   */
  const accentInk = React.useCallback(
    (c) => inkForWorld(c, visualMode),
    [visualMode]
  );

  const defaultId = useMemo(() => {
    const found =
      planets.find((planet) => planet.state === "current") ||
      planets.find((planet) => planet.state === "active") ||
      planets.find((planet) => planet.state === "ahead") ||
      planets[0];
    return found?.id || null;
  }, [planets]);

  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  /* 图例默认收起（减少画面文字），需要时展开 */
  const [legendOpen, setLegendOpen] = useState(false);
  /*
   * 开场揭示播完就把 class 拿掉。
   * ---------------------------------------------------------
   * 坑：`galaxy-reveal` 的关键帧带 transform / filter，而 transform/filter
   * 会让元素成为 `position: fixed` 后代的**包含块** —— 手机上那个
   * "全屏"详情弹窗实测被锁在画布框里（334px 而不是 390px 视口），
   * 屏幕上看起来像"弹窗比屏幕窄"。动画一结束就移除类，弹窗回到视口坐标系。
   */
  const [revealed, setRevealed] = useState(false);

  /*
   * 手机（<640px）判定：详情在手机上改为**全屏弹窗**。
   * 手机上内嵌详情块会把画布压成一条缝（画布本来就只有 38vh），
   * 弹窗让详情有自己的滚动空间，画布保持完整；
   * 桌面保持现在的浮动玻璃内嵌面板不变。
   */
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && Boolean(window.matchMedia?.("(max-width: 639px)").matches)
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = (event) => setIsMobile(event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* 弹窗打开时锁住页面滚动；Escape 关闭 */
  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobile, mobileOpen]);

  const selected = useMemo(
    () => planets.find((planet) => planet.id === (selectedId || defaultId)) || null,
    [planets, selectedId, defaultId]
  );

  const handleSelect = (planet) => {
    setSelectedId(planet.id);
    /* 手机：点星球/芯片直接弹全屏详情 */
    if (isMobile) setMobileOpen(true);
    /* 3D 里点一下先聚焦（看详情），再点底部按钮才跳转；
       这样不会因为手滑碰一下星球就被带离页面。
       锁定星球同样可以看详情——看得到「怎么解锁」比看不见更有用。 */
  };

  /*
   * 锁 = 真门禁（与首页星球行同一套字段）：锁定星球的任何入口都不跳转，
   * 只在面板顶部说一句「先完成哪一阶段」，几秒后自动收掉。
   * 详情里的阶段明细 / 画像卫星 / 今日入口都走这里。
   */
  const [lockNotice, setLockNotice] = useState("");
  const lockTimer = useRef(null);
  useEffect(() => () => clearTimeout(lockTimer.current), []);

  const flashLock = (planet, what) => {
    setLockNotice(
      `${what || "这颗星球"}还没解锁 · ${planet?.unlockHint || "按学习路线的顺序解锁：先完成前面的阶段"}`
    );
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setLockNotice(""), 4600);
  };

  const enter = (planet, to, what) => {
    if (planet?.locked) {
      flashLock(planet, what);
      return;
    }
    if (to) navigate(to);
  };

  /*
   * 卫星没有「详情」可看，它就是一个入口（例如「泰剧角」→ /media?category=drama），
   * 所以点一下直接走——与星球的行为刻意不一致，因为预期不同（用户点卫星
   * 就是要进去，而且卫星很小，误触概率高但代价也低）。
   *
   * 两者共用同一个 onSelect 回调，所以要先认出来：星球一定有 state，
   * 卫星没有。
   */
  const isSatellite = (node) => Boolean(node) && !node.state && Boolean(node.to);

  const handleSatellite = (sat) => {
    if (sat?.to) navigate(sat.to);
  };

  const handleSelectNode = (node) => {
    /*
     * 刚拖完就松手时，指针恰好落在星球上会触发 R3F 的 click——用户以为
     * 自己在转视角，结果被带进了课程。拖动结束后的一个短窗口内忽略点击。
     */
    if (controlsRef.current && !clickAllowed(controlsRef.current, performance.now())) {
      return;
    }
    if (isSatellite(node)) handleSatellite(node);
    else handleSelect(node);
  };

  /* 「我卡在哪」：只在 worldData 真的标出来时才展示（有真实数字才说） */
  const laggard = useMemo(
    () => planets.find((planet) => planet.laggard) || null,
    [planets]
  );

  /* =====================================================
     相机操控
     -----------------------------------------------------
     相机状态放在 ref 里而不是 state：拖动是每帧改目标值，走 React state
     会导致整棵树每帧重渲染。HTML 层的按钮（缩放/回位）直接改同一个 ref。
  ===================================================== */

  const controlsRef = useRef(null);
  if (controlsRef.current === null) controlsRef.current = createOrbitState();

  const canvasWrapRef = useRef(null);
  const pointersRef = useRef(new Map());
  const dragRef = useRef({ active: false, moved: 0, lastX: 0, lastY: 0 });
  const pinchRef = useRef({ startSpread: 0 });
  const [dragging, setDragging] = useState(false);

  const canDrag = quality.tier !== "static";

  /*
   * 开发态把相机的**目标值**写到容器 DOM 上。
   * 与 WorldCanvas 的渲染探针同一套做法，但比它更必要：相机角度无法从
   * DOM 断言、也不好在截图里量（尤其预览不可见时渲染循环是被暂停的），
   * 而这三个数能直接证明拖动/缩放/回位的管线真的动了。仅 DEV，生产零开销。
   */
  const publishOrbit = useCallback(() => {
    if (!import.meta.env.DEV) return;
    const el = canvasWrapRef.current;
    const state = controlsRef.current;
    if (!el || !state) return;
    el.dataset.orbitYaw = state.targetYaw.toFixed(4);
    el.dataset.orbitPitch = state.targetPitch.toFixed(4);
    el.dataset.orbitDistance = state.targetDistance.toFixed(4);
  }, []);

  const markInput = useCallback(() => {
    if (controlsRef.current) controlsRef.current.lastInputAt = performance.now() / 1000;
  }, []);

  /* 挂载时就写一次，否则「还没人碰过」的初始机位在 DOM 上读不到 */
  useEffect(() => {
    publishOrbit();
  }, [publishOrbit]);

  /*
   * 开发态「今天」探针。
   * 与机位探针同一套做法：3D 里的脉冲环、光丝、尘埃被吹开都无法从断言里
   * 看（渲染循环在后台标签页里是被暂停的），但「哪颗星球今天有活动、强度
   * 多少、有没有爆发」这些驱动值可以。仅 DEV，生产环境零开销。
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const el = canvasWrapRef.current;
    if (!el) return;
    el.dataset.today = JSON.stringify({
      date: today?.date || null,
      activeCount: today?.activeCount || 0,
      planets: (today?.planets || [])
        .filter((planet) => planet.today?.active)
        .map((planet) => ({
          id: planet.id,
          count: planet.today.count,
          intensity: Number((planet.today.intensity || 0).toFixed(3)),
          dustBlown: planet.today.dustBlown,
        })),
      burst: today?.burst ? { planetId: today.burst.planetId, seq: today.burst.seq } : null,
    });
  }, [today]);

  /* 改相机状态只走这里：一次搞定 ref + 时间戳 + 探针 */
  const commitOrbit = useCallback(
    (next) => {
      controlsRef.current = next;
      markInput();
      publishOrbit();
    },
    [markInput, publishOrbit]
  );

  const handlePointerDown = (event) => {
    if (!canDrag) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      pinchRef.current.startSpread = pointerSpread(pointersRef.current.values());
      /* 捏合期间不当作拖动，否则两指会同时转角度与缩放 */
      dragRef.current.active = false;
      return;
    }

    dragRef.current = { active: true, moved: 0, lastX: event.clientX, lastY: event.clientY };
    markInput();
  };

  const handlePointerMove = (event) => {
    if (!canDrag) return;
    const known = pointersRef.current.get(event.pointerId);
    if (known) {
      known.x = event.clientX;
      known.y = event.clientY;
    }

    /* 两指：捏合缩放 */
    if (pointersRef.current.size >= 2) {
      const spread = pointerSpread(pointersRef.current.values());
      if (pinchRef.current.startSpread > 0 && spread > 0) {
        commitOrbit(
          applyPinch(controlsRef.current, pinchRef.current.startSpread, spread)
        );
        /* 每次移动都把基准推到当前位置，得到相对增量缩放 */
        pinchRef.current.startSpread = spread;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag.active) return;

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved += Math.hypot(dx, dy);

    if (exceedsDragThreshold(drag.moved)) {
      if (!dragging) setDragging(true);
      /* 刚拖过就忽略星球的点击，避免松手瞬间被带进课程 */
      controlsRef.current.suppressClickUntil =
        performance.now() + ORBIT_LIMITS.suppressClickMs;
    }

    commitOrbit(applyDrag(controlsRef.current, dx, dy));
  };

  const endPointer = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current.startSpread = 0;
    if (pointersRef.current.size === 0) {
      dragRef.current.active = false;
      setDragging(false);
    }
  };

  /*
   * 键盘：画布交互不能只有指针能做。方向键转、+/- 缩、0 回位。
   */
  const handleKeyDown = (event) => {
    if (!canDrag) return;
    const step = 18;
    const actions = {
      ArrowLeft: () => applyDrag(controlsRef.current, -step, 0),
      ArrowRight: () => applyDrag(controlsRef.current, step, 0),
      ArrowUp: () => applyDrag(controlsRef.current, 0, -step),
      ArrowDown: () => applyDrag(controlsRef.current, 0, step),
      "+": () => applyZoom(controlsRef.current, ORBIT_LIMITS.zoomStep),
      "=": () => applyZoom(controlsRef.current, ORBIT_LIMITS.zoomStep),
      "-": () => applyZoom(controlsRef.current, 1 / ORBIT_LIMITS.zoomStep),
      "0": () => resetOrbit(controlsRef.current),
    };
    const run = actions[event.key];
    if (!run) return;
    event.preventDefault();
    commitOrbit(run());
  };

  const zoomBy = (factor) => commitOrbit(applyZoom(controlsRef.current, factor));

  const recenter = () => commitOrbit(resetOrbit(controlsRef.current));

  if (!planets.length) return null;

  return (
    /* data-galaxy-mode：CSS 按世界改这一块的皮（纸上网格、视频开关、压暗程度），
       组件的内联样式只管颜色串，几何与交互一律不在这里动 */
    <section className="relative my-10" data-galaxy-mode={visualMode}>
      {/* 标题 */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-emerald-300/55">
            My Thai Constellation
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-light tracking-tight text-white/95 sm:text-[30px]">
              我的泰语成长星图
            </h2>
            {/*
             * 主题色 chip。
             * 原来主题名是塞在 h2 里的普通 span（"学习星系 文化宇宙"），
             * 两个词同样重、同一行，很容易被读成板块叫"文化宇宙"。
             * 挪出来做成带色点的 chip，语义变成"当前处在哪个主题"。
             */}
            {theme?.name ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: `${theme.accent}44`,
                  background: `${theme.accent}12`,
                  color: theme.accent,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }}
                />
                {theme.name}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] font-light leading-6 tracking-wide text-white/38">
            看见你的泰语能力如何一点点形成。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 「我卡在哪」：只在真的有可比的差距时才出现（见 worldData.buildPlanets） */}
          {laggard ? (
            <button
              type="button"
              onClick={() => setSelectedId(laggard.id)}
              className="flex items-center gap-2 rounded-full border border-[#ffb37d]/30 bg-[#ffb37d]/[0.08] px-3 py-1.5 transition hover:bg-[#ffb37d]/[0.16]"
              title={laggard.laggardNote}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffb37d] shadow-[0_0_8px_#ffb37d]" />
              <span className="text-[11px] text-[#ffd3b3]">
                你卡在「{laggard.cn}」· {laggard.progress}%
              </span>
            </button>
          ) : null}

          {/*
           * 今日读数。刻意与「你卡在哪」并列（都在标题右侧），但颜色不同：
           * 琥珀 = 长期落后，主题色 = 今天动过。两个时间尺度不能混为一谈。
           */}
          {today ? (
            today.activeCount ? (
              <button
                type="button"
                onClick={() => setSelectedId(today.list[0]?.id || null)}
                title={today.headline}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 transition hover:brightness-125"
                style={{
                  borderColor: `${theme?.accent || "#6ee7a8"}55`,
                  background: `${theme?.accent || "#6ee7a8"}14`,
                }}
              >
                {/*
                 * 注意类名：这里必须用 -dot，不能用 -ring。
                 * -ring 的语义是唯一的：「今天练过的星球」，静态星图的断言
                 * 靠数它。把徽标小圆点也写成 -ring 会让「今天练过几颗星球」
                 * 再多出 1，测试与人工核对同时对不上。
                 */}
                <span
                  className="world-today-dot h-1.5 w-1.5 rounded-full"
                  style={{
                    background: theme?.accent || "#6ee7a8",
                    boxShadow: `0 0 8px ${theme?.accent || "#6ee7a8"}`,
                  }}
                />
                <span className="text-[11px] text-white/80">
                  今天练过 {today.activeCount} 颗星球
                </span>
                <span className="hidden text-[10px] text-white/40 sm:inline">
                  {today.list.map((planet) => planet.cn).join(" · ")}
                </span>
              </button>
            ) : (
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/45">
                {today.headline}
              </div>
            )
          ) : null}

          {path?.etaLabel ? (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-white/40" />
              <span className="text-[11px] text-white/60">{path.etaLabel}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 编码图例：让空间隐喻自己说话，而不是靠猜 ──
          原来是一行 10px / white-45 的散字，换行后像免责声明；窄屏还把 hint
          整句藏掉（恰恰是最需要解释的一层）。
          现在改成一条玻璃条：色块按实际观感画，标签 11.5px，hint 在窄屏
          压成短词而不是消失——图例读不出来，3D 就只是"五个球在转"。 */}
      {/*
       * 图例默认**收起**。
       * 用户这一轮明确要求"减少文字"：原来五行图例（含小字说明）
       * 在星系上方占掉一整行，把"深空"读成了"说明书"。
       * 编码本身看得懂（轨道半径=掌握度），需要时再展开即可。
       */}
      <button
        type="button"
        onClick={() => setLegendOpen((open) => !open)}
        aria-expanded={legendOpen}
        className="mb-3 flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/45 transition hover:border-white/15 hover:text-white/70"
      >
        <Info className="h-3 w-3" />
        {legendOpen ? "收起星图编码" : "星图编码怎么读"}
      </button>

      <div
        className={`mb-3 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 xl:gap-x-5 ${
          legendOpen ? "flex" : "hidden"
        }`}
      >
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={
                item.swatch === "radius"
                  ? { border: "1.5px solid rgba(232,200,138,0.95)", boxShadow: "0 0 8px rgba(232,200,138,0.35)" }
                  : item.swatch === "dust"
                    ? { background: "radial-gradient(circle, rgba(203,215,226,0.95), rgba(203,215,226,0.18) 70%)" }
                    : item.swatch === "today"
                      ? {
                          border: "1.5px solid rgba(255,255,255,0.85)",
                          boxShadow: "0 0 10px rgba(255,255,255,0.5)",
                        }
                      : { border: "1.5px solid #ffb37d", boxShadow: "0 0 9px rgba(255,179,125,0.55)" }
              }
            />
            <span className="whitespace-nowrap text-[11.5px] font-semibold text-white/75">
              {item.label}
            </span>
            {/* hint 只在足够宽时出现：窄屏挤成两行比不显示更难看 */}
            <span className="hidden whitespace-nowrap text-[10.5px] text-white/30 xl:inline">
              · {item.hint}
            </span>
          </span>
        ))}
      </div>

      {/*
       * 画布外框。
       * 原来只有 border-white/[0.07] + bg-black/40，而站点底色是 #0f1a1e —— 叠出来
       * 只差约 3% 亮度，左侧边界几乎看不见（截图里能明显看到这个毛病）。
       * 现在补三样：更实的底色、一圈内描边（ring-inset）、顶部径向光晕，
       * 让画布边界成为一条可见的线，而不是"消失的圆角"。
       */}
      <div
        className={`galaxy-frame relative overflow-hidden rounded-[28px] border ${revealed ? "" : "galaxy-reveal"}`}
        onAnimationEnd={() => setRevealed(true)}
        style={{
          background: skin.frame,
          borderColor: skin.border,
          /* 内描边（原来靠 Tailwind 的 ring-inset + ring-white/[0.05]，四个世界同一个值：
             纸上太亮看不见、纸上需要的是"细棕线"）→ 直接内联 */
          boxShadow: `inset 0 0 0 1px ${skin.ring}`,
        }}
      >
        {/* 顶部径向光晕：把视线引到星系中心，也给画布一点纵深 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, ${skin.glow}, transparent 70%)`,
          }}
        />

        {/* ── 背景视频（真实星空素材）：铺在画布下层，3D 内容叠于其上 ──
            纸世界直接不上视频：纸面是不透明的，"会动的星空"与纸上星图
            是两种媒介，叠在一起只会互相拆台。同时也省掉一路视频解码。 */}
        {allowBgVideo && !paper ? (
          <video
            className="galaxy-bg-video absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={GALAXY_BG_POSTER}
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={GALAXY_BG_VIDEO} type="video/mp4" />
          </video>
        ) : null}

        {/* 视频之上的压暗层：保证 3D 星域与浮层文字在亮部也读得清。
            深空要压狠一点（视频自带星点，不压星座浮不出来）；
            纸世界反过来 —— 它需要的是**亮**，只有极淡的旧纸泛黄。 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: skin.scrim }}
        />

        {/*
         * 电影光线：一束极淡的暖金从右上穿过画面。
         * 存在的意义是给画面一个**光源方向** —— 3D 里全是无光照的加光材质，
         * 没有方向就只剩均匀辉光，那是"特效"而不是"摄影"。
         *
         * ⚠️ 位置有讲究：它必须排在**视频之后**。
         * 原来排在视频之前，而视频是不透明的全覆盖层 —— 结果这束光在
         * midnight / forest / modern 三个世界里**从来没显示过**（纯死代码）。
         * 现在排在视频与压暗层之后、3D 画布之前：既不被盖住，也不压住星球。
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: paper
              ? "radial-gradient(120% 90% at 82% -12%, rgba(154,123,46,0.10), transparent 56%)"
              : "radial-gradient(120% 95% at 84% -14%, rgba(255,214,150,0.10), transparent 58%)",
          }}
        />

        {/*
          纸上星图 · 古典天文图的"网格皮"。
          纯 CSS/SVG，不引入任何资源：同心圆（轨道暗示）+ 十字经纬线 + 辐射细线。
          它不是"装饰背景"，而是**空间参照物** —— 古典星图没有网格就读不出
          星点在哪个圈层，而纸世界恰好没有夜空那种天然的中心亮区。
          交互一律穿透（pointer-events: none），也不进 DOM 的可点击树。
        */}
        {paper ? (
          <svg
            aria-hidden="true"
            focusable="false"
            className="galaxy-paper-grid pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 320 200"
            preserveAspectRatio="none"
          >
            {/* 同心圆：半径按轨道尺度的比例取，且是"断开的圆弧"，
                不画成完整闭合曲线（否则又变成太阳系轨道图） */}
            {[34, 58, 82, 106].map((r, i) => (
              <circle
                key={`ring-${r}`}
                cx="160"
                cy="100"
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth={i === 0 ? 0.7 : 0.5}
                strokeDasharray={i % 2 === 0 ? "100 26 14 40" : "42 18 70 22"}
                opacity={0.5 - i * 0.07}
              />
            ))}
            {/* 十字经纬线：古典星图的"极坐标架" */}
            <line x1="160" y1="18" x2="160" y2="182" stroke="currentColor" strokeWidth="0.4" opacity="0.34" />
            <line x1="44" y1="100" x2="276" y2="100" stroke="currentColor" strokeWidth="0.4" opacity="0.34" />
            {/* 辐射细线：每 30° 一条短刻度，像星图的刻度圈 */}
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r0 = 18;
              const r1 = i % 3 === 0 ? 30 : 24;
              return (
                <line
                  key={`tick-${i}`}
                  x1={160 + Math.cos(a) * r0}
                  y1={100 + Math.sin(a) * r0 * 0.62}
                  x2={160 + Math.cos(a) * r1}
                  y2={100 + Math.sin(a) * r1 * 0.62}
                  stroke="currentColor"
                  strokeWidth="0.4"
                  opacity="0.3"
                />
              );
            })}
          </svg>
        ) : null}

        {/*
          现代世界 · 理性坐标系。
          极淡的方格叠在画布层（视频之上、3D 之下）：现代世界的"星图"读起来
          该像一张数据图，而不是一片夜空。中心留空，网格不压住数据主体。
        */}
        {visualMode === "modern" ? (
          <div aria-hidden="true" className="galaxy-tech-grid pointer-events-none absolute inset-0" />
        ) : null}

        {/*
          林间世界 · 一层很轻的雾。
          只压对比、不遮星点：静态两层柔光即可 —— 动效交给 3D 里的星云浓度
          与慢速漂移，这里再动会显得廉价（也省掉一层 GPU 合成）。
        */}
        {visualMode === "forest" ? (
          <div aria-hidden="true" className="galaxy-mist-layer pointer-events-none absolute inset-0" />
        ) : null}

        {/* ── 星系画布（拖动旋转 / 捏合缩放 / 键盘可操作） ── */}
        <div
          ref={canvasWrapRef}
          className={`relative select-none ${
            canDrag ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          /*
           * touch-action: pan-y ——
           * 手机上这个画布占了半屏，如果连竖向滚动都吃掉，用户会被「困」在
           * 星系里下不去。所以竖向留给页面滚动，横向与双指才交给我们。
           */
          style={canDrag ? { touchAction: "pan-y" } : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={endPointer}
          onKeyDown={handleKeyDown}
          tabIndex={canDrag ? 0 : -1}
          role={canDrag ? "application" : undefined}
          aria-label={
            canDrag ? "学习星系：拖动旋转，加号减号缩放，0 回到默认角度" : undefined
          }
        >
          <WorldStage
            /* 高度：原来是 h-[50vh] 全宽 ⇒ 在 1440×900 下约 1100×450（≈2.4:1），
               星球只占中间一小团，上下都是死区。改成受上限约束后更接近 16:9，
               星系能撑满画布；窄屏仍保留足够触控高度。 */
            className="h-[38vh] min-h-[280px] max-h-[400px] w-full sm:h-[40vh] lg:h-[38vh]"
            camera={{ position: [0, 3.4, 7.2], fov: 42, near: 0.1, far: 60 }}
            rootMargin="200px"
            once
            fallback={
              <StaticStarMap
                planets={planets}
                activeId={hoveredId || selected?.id}
                onSelect={handleSelect}
                visualMode={visualMode}
              />
            }
            loading={
              <StaticStarMap
                planets={planets}
                activeId={null}
                onSelect={handleSelect}
                visualMode={visualMode}
              />
            }
          >
            {({ quality: q }) => (
              <Suspense fallback={null}>
                <GalaxyScene
                  planets={planets}
                  activeId={hoveredId || selected?.id}
                  /* 镜头跟随「选中」而不是「悬停」：悬停只做高亮，
                     否则鼠标扫过就会带动镜头，非常晕。 */
                  focusId={selected?.id || null}
                  onHover={setHoveredId}
                  onSelect={handleSelectNode}
                  quality={q}
                  reducedMotion={quality.reducedMotion}
                  theme={theme}
                  controls={controlsRef}
                  today={today}
                  visualMode={visualMode}
                />
              </Suspense>
            )}
          </WorldStage>

          {/* 悬浮星球名（3D 悬停时在画布上方显示，避免在 3D 里做文字） */}
          <AnimatePresence>
            {hoveredId ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 px-3 py-1.5 backdrop-blur-md ${
                  paper ? "bg-[#fdfaf2]/92 text-[#241f17]" : "bg-black/70"
                }`}
              >
                {(() => {
                  const planet = planets.find((item) => item.id === hoveredId);
                  if (!planet) return null;
                  return (
                    <span className={`text-[11px] ${paper ? "text-[#241f17]" : "text-white/85"}`}>
                      <span className="font-bold" style={{ color: accentInk(planet.accent) }}>
                        {planet.glyph}
                      </span>{" "}
                      {planet.cn} · {planet.progress}%
                    </span>
                  );
                })()}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 操控提示与按钮。没有 WebGL 时（静态星图）不显示，否则是死按钮。 */}
          {canDrag ? (
            <>
              {/*
               * 提示必须在手机上也能看到：它原来带 hidden sm:flex，而预览实测宽度
               * 是 372px（<640px），等于手机用户根本不知道这里能拖——而手机与
               * 桌面拖动正是这次要加的主要交互。窄屏换成短语，不堆一长串。
               */}
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] text-white/55 backdrop-blur-md">
                <Compass className="h-3 w-3 shrink-0" />
                <span className="sm:hidden">拖动旋转 · 双指缩放</span>
                <span className="hidden sm:inline">
                  拖动可自己转着看 · 双指或 +/− 缩放 · 0 回位
                </span>
              </div>

              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {[
                  { key: "zoom-in", icon: Plus, label: "拉近", factor: ORBIT_LIMITS.zoomStep },
                  { key: "zoom-out", icon: Minus, label: "拉远", factor: 1 / ORBIT_LIMITS.zoomStep },
                ].map(({ key, icon: Icon, label, factor }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    /* 不吃掉 pointerdown 的话，点按钮会同时开始转视角 */
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => zoomBy(factor)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/75 backdrop-blur-md transition hover:border-white/30 hover:bg-black/75 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button
                  type="button"
                  title="回到默认角度"
                  aria-label="回到默认角度"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={recenter}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/75 backdrop-blur-md transition hover:border-white/30 hover:bg-black/75 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* 画布底部的渐隐：详情面板是浮在画布上的，硬切会显得两块拼在一起 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{ background: skin.bottom }}
        />

        {/*
         * 胶片颗粒（全屏、静态）。
         * 放在面板之下、画布之上：让**影像**有摄影质感，但不给 UI 文字加噪声。
         * 强度极低（soft-light 5%），用户感受应该是"不像纯数字渲染"，
         * 而不是"这页有颗粒效果"。
         */}
        <div aria-hidden="true" className="galaxy-grain pointer-events-none absolute inset-0" />

        {/* ── 真实数据面板（浮动玻璃风格） ── */}
        <div className="galaxy-panel mx-3 mb-3 rounded-2xl border border-white/[0.08] bg-black/55 p-3 sm:mx-4 sm:mb-4 sm:p-4 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {planets.map((planet) => {
              const meta = STATE_META[planet.state] || STATE_META.ahead;
              const isSelected = selected?.id === planet.id;
              return (
                <button
                  key={planet.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(planet.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(planet)}
                  /* 选中态用**星球自己的 accent**，而不是通用白色描边：
                     五个球在同一排里，只有这样才一眼看出选中的是哪一个。 */
                  style={
                    isSelected
                      ? {
                          borderColor: `${planet.accent}66`,
                          background: `${planet.accent}14`,
                          boxShadow: `0 6px 20px ${planet.accent}1f`,
                        }
                      : undefined
                  }
                  className={`group flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                    isSelected ? "" : "border-white/[0.06] bg-white/[0.02] hover:border-white/16 hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-black transition"
                    style={{
                      color: accentInk(planet.accent),
                      background: "rgba(0,0,0,0.35)",
                      boxShadow: isSelected ? `0 0 14px ${planet.glow}` : "none",
                    }}
                  >
                    {planet.glyph}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      <span className="truncate text-[12.5px] font-bold text-white/92">
                        {planet.cn}
                      </span>
                      {planet.today?.active ? (
                        <span
                          className="shrink-0 rounded-full px-1 py-[1px] text-[8px] font-bold"
                          style={{
                            background: `${planet.accent}22`,
                            color: accentInk(planet.accent),
                          }}
                          title={planet.today.detail}
                        >
                          {planet.today.count}
                        </span>
                      ) : null}
                    </span>
                    {/* 这一行信息量最大（阶段进度），字号不该是全屏最小的 */}
                    <span
                      className="mt-0.5 block truncate text-[11px] font-semibold"
                      style={{ color: `${accentInk(planet.accent)}cc` }}
                    >
                      {planet.stageCount > 0
                        ? `${planet.doneCount}/${planet.stageCount} 阶段 · ${planet.progress}%`
                        : "未排入路线"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/*
           * 选中星球的真实明细（把 LearningPathCard 的信息量保住）。
           * 手机上只在用户**主动点开**后才荮全屏（mobileOpen）——
           * 否则一进页面就会被详情盖住，星系根本看不到（实测到过这个 bug）。
           */}
          <AnimatePresence mode="wait">
            {selected && (!isMobile || mobileOpen) ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: isMobile ? 24 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: isMobile ? 24 : -6 }}
                transition={{ duration: 0.22 }}
                className={
                  isMobile
                    ? "fixed inset-0 z-50 overflow-y-auto bg-[#04090c]/95 p-4 pb-10 backdrop-blur-xl"
                    : "mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5"
                }
              >
                {/* 手机弹窗：右上角关闭（桌面内嵌面板没有这一颗） */}
                {isMobile ? (
                  <button
                    type="button"
                    aria-label="关闭详情"
                    onClick={() => setMobileOpen(false)}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/80 backdrop-blur-md transition hover:bg-black/75 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* 徽标 + 名称：详情卡需要一眼认出"这是哪颗球"，
                        所以把 glyph 做成带 accent 的方块，而不是纯文字。 */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px] font-black"
                        style={{
                          color: accentInk(selected.accent),
                          background: `${selected.accent}1a`,
                          border: `1px solid ${selected.accent}44`,
                          boxShadow: `0 0 18px ${selected.accent}22`,
                        }}
                      >
                        {selected.glyph}
                      </span>
                      <span className="text-[15px] font-black text-white">{selected.cn}</span>
                      <span className="text-[9.5px] uppercase tracking-[0.18em]" style={{ color: accentInk(selected.accent) }}>
                        {selected.en}
                      </span>
                      <span className="text-[10.5px] text-white/30">{selected.th}</span>
                      <span className={`text-[10.5px] ${STATE_META[selected.state]?.className}`}>
                        {STATE_META[selected.state]?.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[10.5px] text-white/40">
                      {selected.roman} · {selected.tagline}
                    </p>

                    {/* accent 进度条：把"掌握度"从一行小字变成看得见的量 */}
                    {selected.stageCount > 0 ? (
                      <div className="mt-2 flex items-center gap-2.5">
                        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(2, selected.progress)}%`,
                              background: selected.accent,
                              boxShadow: `0 0 10px ${selected.accent}66`,
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color: accentInk(selected.accent) }}
                        >
                          {selected.progress}%
                        </span>
                      </div>
                    ) : null}

                    {/* 空间编码的文字回写 */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-white/35">
                      <span>
                        掌握度 <span className="font-semibold text-white/65">{selected.progress}%</span>
                        {selected.pullNote ? ` · 收紧 ${selected.pullNote} 单位` : " · 最外圈"}
                      </span>
                      {selected.veil?.tier !== "none" ? (
                        <span className={selected.veil.tier === "heavy" ? "text-white/50" : "text-white/35"}>
                          {selected.veil.label}
                        </span>
                      ) : (
                        <span>轨道清晰</span>
                      )}
                      {selected.affinity > 0 ? (
                        <span style={{ color: theme?.accent || "#e8c88a" }}>画像契合</span>
                      ) : null}
                    </div>

                    {/*
                     * 「今天在这颗星球上」——与上面的累计读数并列展示，但分成
                     * 两块：累计值回答「我练到哪了」，今日值回答「我今天做了
                     * 什么」。混在一起会让人以为今天的行动把长期进度改了。
                     */}
                    {today && selected.today?.active ? (
                      <div className="mt-2.5 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.06] px-3 py-2.5">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-emerald-100">
                          <Sparkles className="h-3 w-3" />
                          今天在这颗星球上
                          {selected.today.lastLabel ? (
                            <span className="font-normal text-white/45">
                              · {selected.today.lastLabel}
                            </span>
                          ) : null}
                        </p>
                        {selected.today.detail ? (
                          <p className="mt-1 text-[11px] text-white/70">{selected.today.detail}</p>
                        ) : null}
                        {selected.today.items.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selected.today.items.map((item) => (
                              <button
                                key={`${item.to}-${item.label}`}
                                type="button"
                                onClick={() => enter(selected, item.to, item.label)}
                                title={selected.locked ? `尚未解锁 · ${selected.unlockHint || ""}` : item.to}
                                className="flex items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-black/25 px-2.5 py-1.5 text-[11px] text-white/85 transition hover:border-emerald-300/45 hover:bg-black/40"
                              >
                                <span className="font-semibold">{item.label}</span>
                                <span className="text-[10px] text-white/45">{item.detail}</span>
                                <ArrowRight className="h-3 w-3 text-white/30" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-1.5 text-[10px] text-white/35">
                          今天来过，所以这颗星球的尘埃被吹开了（路线安排没有变）
                        </p>
                      </div>
                    ) : today ? (
                      <p className="mt-2.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[10px] text-white/35">
                        今天还没在这颗星球上练过
                      </p>
                    ) : null}

                    {selected.laggard ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#ffb37d]">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffb37d] shadow-[0_0_8px_#ffb37d]" />
                        这里是你进度最低的一块：{selected.laggardNote}
                      </p>
                    ) : null}

                    {selected.why ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#CB8DFF]/80">
                        <Sparkles className="h-3 w-3" />
                        为你安排的原因：{selected.why}
                      </p>
                    ) : null}
                  </div>

                  {selected.locked ? (
                    <button
                      type="button"
                      onClick={() => flashLock(selected, `「${selected.cn}」`)}
                      title={`尚未解锁 · ${selected.unlockHint || ""}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3.5 py-2 text-[11px] font-bold text-amber-100/90 transition hover:bg-amber-300/[0.14]"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      尚未解锁
                    </button>
                  ) : (
                    /* CTA 用星球 accent 实心：详情卡里需要一个明确的视觉落点，
                       原来和正文一样是描边按钮，一眼看不出该点哪。 */
                    <button
                      type="button"
                      onClick={() => navigate(selected.to)}
                      className="group flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-[#04110f] transition hover:brightness-110 active:scale-[0.98]"
                      style={{
                        background: selected.accent,
                        boxShadow: `0 8px 24px ${selected.accent}33`,
                      }}
                    >
                      {selected.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>

                {/* 锁：点锁定星球的任何入口时在这里说清楚怎么解锁 */}
                {lockNotice ? (
                  <p className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-[11px] font-semibold text-amber-100">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    {lockNotice}
                  </p>
                ) : selected.locked ? (
                  <p className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-dashed border-amber-300/20 px-3 py-2 text-[11px] text-amber-100/70">
                    <Lock className="h-3 w-3 shrink-0" />
                    这颗星球尚未解锁 · {selected.unlockHint}
                  </p>
                ) : null}

                {/* 阶段明细 */}
                {selected.stages.length ? (
                  <div className="mt-3 space-y-1.5">
                    {selected.stages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => enter(selected, stage.to, `「${stage.title}」`)}
                        title={selected.locked ? `尚未解锁 · ${selected.unlockHint || ""}` : stage.to}
                        className={
                          "flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2 text-left transition " +
                          (selected.locked
                            ? "cursor-not-allowed opacity-60"
                            : "hover:border-white/15 hover:bg-black/40")
                        }
                      >
                        <span className="w-16 shrink-0 text-[10px] text-white/35">
                          {stage.done ? "已完成" : stage.window}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[12px] ${stage.done ? "text-white/45" : "text-white/85"}`}>
                            {stage.title}
                            {stage.courseTitle && stage.courseTitle !== stage.title ? (
                              <span className="text-white/30"> · {stage.courseTitle}</span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-white/35">
                          {stage.estDays > 0 ? `${stage.estDays} 天` : "完成"}
                        </span>
                        <span className="w-10 shrink-0 text-right text-[10px] font-semibold text-white/55">
                          {stage.progress}%
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-white/10 px-3 py-3 text-[11px] text-white/35">
                    这颗星球还不在你的路线里。做一次 AI 入学测试，或去「专业方向」里选一条路线，
                    它就会出现在你的星系里。
                  </p>
                )}

                {/* 画像卫星：为什么这个账号的世界比别人多几个入口 */}
                {selected.satellites?.length ? (
                  <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                      你的画像给这颗星球带来 {selected.satellites.length} 个额外入口
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.satellites.map((sat) => (
                        <button
                          key={sat.id}
                          type="button"
                          onClick={() => enter(selected, sat.to, `「${sat.cn}」`)}
                          title={selected.locked ? `尚未解锁 · ${selected.unlockHint || ""}` : sat.to}
                          className={
                            "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/80 transition " +
                            (selected.locked ? "cursor-not-allowed opacity-60" : "hover:border-white/25 hover:bg-white/[0.09]")
                          }
                        >
                          <span className="text-[13px] leading-none">{sat.emoji}</span>
                          {sat.cn}
                          <span className="text-[9px] text-white/30">{sat.th}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
