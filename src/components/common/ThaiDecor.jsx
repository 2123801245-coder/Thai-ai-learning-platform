import React, { useEffect, useRef, useState } from "react";

/* =========================================================
   ThaiDecor —— ThaiAI 强化装饰层（原创 SVG，无侵权风险）
   ---------------------------------------------------------
   五层视觉空间中的「背景文化纹样 + 环境光 + 微粒子」层：
   - ThaiCorner        金色泰式角饰（卡片/Hero 四角）
   - ThaiSectionDivider 泰式装饰分隔线（双金线 + 莲花 + 光点）
   - BangkokSkyline    曼谷夜景剪影（郑王庙 + 天际线）
   - LotusLineArt      莲花线稿（金色描边）
   - OrbitRing         AI 轨道粒子环（AI 导师头像 / 核心）
   - ParticleField     漂浮微粒子 + 连接线（克制）
   - MouseGlow         鼠标跟随光晕（桌面端，低消耗）
   全部 GPU 友好（transform/opacity），尊重 prefers-reduced-motion。
========================================================= */

/* ---------- 金色泰式角饰 ----------
   在卡片/Hero 四角绘制「L 形双线 + 菱形角点」的泰式描金角饰。
   corners: 数组，如 ["tl","tr","bl","br"]；size 控制角饰尺寸。 */

export function ThaiCorner({
  className = "",
  corners = ["tl", "tr", "bl", "br"],
  size = 22,
  color = "rgba(245, 214, 123, 0.4)",
}) {
  const arm = size * 0.62;
  const pos = {
    tl: { top: 0, left: 0, rotate: 0 },
    tr: { top: 0, right: 0, rotate: 90 },
    bl: { bottom: 0, left: 0, rotate: -90 },
    br: { bottom: 0, right: 0, rotate: 180 },
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      {corners.map((corner) => {
        const p = pos[corner];
        if (!p) return null;
        return (
          <div
            key={corner}
            className="absolute"
            style={{ ...p }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 40 40"
              fill="none"
              style={{ transform: `rotate(${p.rotate}deg)` }}
            >
              {/* 外线 */}
              <path
                d={`M 2 38 L 2 2 L ${arm} 2`}
                stroke={color}
                strokeWidth="1.2"
              />
              {/* 内线（双线） */}
              <path
                d={`M 6 34 L 6 6 L ${arm - 4} 6`}
                stroke={color}
                strokeWidth="0.6"
                opacity="0.55"
              />
              {/* 角点菱形 */}
              <path
                d="M 2 2 L 6 6 L 2 10 L -2 6 Z"
                fill={color}
                opacity="0.7"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 泰式装饰分隔线 ----------
   双金线 + 中央莲花 + 呼吸光点，用于模块之间的 Section Divider。 */

export function ThaiSectionDivider({
  className = "",
  compact = false,
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-center gap-4 ${className}`}
    >
      {/* 左金线（双线） */}
      <div className="relative h-[3px] flex-1">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-300/50 to-yellow-300/70" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-300/20 to-yellow-300/35" />
      </div>

      {/* 中央莲花 + 光点 */}
      <div className="relative flex shrink-0 items-center justify-center">
        <LotusLineArt
          className={compact ? "h-5 w-7" : "h-7 w-10"}
          opacity={0.75}
        />
        <span className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-yellow-300/80 shadow-[0_0_10px_rgba(250,204,21,0.9)] thai-gold-pulse" />
      </div>

      {/* 右金线（双线） */}
      <div className="relative h-[3px] flex-1">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-yellow-300/50 to-yellow-300/70" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-yellow-300/20 to-yellow-300/35" />
      </div>
    </div>
  );
}

/* ---------- 莲花线稿（金色描边） ---------- */

export function LotusLineArt({
  className = "",
  opacity = 0.6,
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 80"
      className={className}
      fill="none"
    >
      {/* 外瓣 */}
      <path
        d="M 60 76 C 42 62 40 48 52 38 C 58 32 62 32 68 38 C 80 48 78 62 60 76 Z"
        stroke="#F5D67B"
        strokeWidth="1.1"
        opacity={opacity}
      />
      {/* 侧瓣 */}
      <path
        d="M 60 76 C 36 64 28 50 34 36 C 38 28 46 26 54 30 C 48 42 50 58 60 76 Z"
        stroke="#F5D67B"
        strokeWidth="0.8"
        opacity={opacity * 0.7}
      />
      <path
        d="M 60 76 C 84 64 92 50 86 36 C 82 28 74 26 66 30 C 72 42 70 58 60 76 Z"
        stroke="#F5D67B"
        strokeWidth="0.8"
        opacity={opacity * 0.7}
      />
      {/* 内瓣 */}
      <path
        d="M 60 72 C 48 58 46 46 54 40 C 57 38 63 38 66 40 C 74 46 72 58 60 72 Z"
        stroke="#F5D67B"
        strokeWidth="0.6"
        opacity={opacity * 0.55}
      />
      {/* 花蕊 */}
      <path
        d="M 60 30 C 62 24 62 18 60 12 C 58 18 58 24 60 30 Z"
        stroke="#F5D67B"
        strokeWidth="0.9"
        opacity={opacity}
      />
    </svg>
  );
}

/* ---------- 曼谷夜景剪影（郑王庙 + 天际线） ----------
   极低透明度 + 深色处理 + 渐变遮罩，像夜幕下若隐若现的背景层。 */

export function BangkokSkyline({
  className = "",
  opacity = 0.5,
  color = "#F5D67B",
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 220"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      fill="none"
    >
      {/* 郑王庙（中央主塔） */}
      <g opacity={opacity}>
        <path
          d="M 600 220 L 600 150 L 620 150 L 620 220 Z"
          fill={color}
          opacity="0.5"
        />
        <path
          d="M 596 150 L 610 96 L 624 150 Z"
          fill={color}
          opacity="0.6"
        />
        <path
          d="M 610 96 L 610 84 L 612 84 L 612 96 Z"
          fill={color}
          opacity="0.6"
        />
        {/* 塔顶尖 */}
        <path
          d="M 608 84 L 610 60 L 612 84 Z"
          fill={color}
          opacity="0.7"
        />
        {/* 侧塔 */}
        <path
          d="M 560 220 L 560 168 L 580 168 L 580 220 Z"
          fill={color}
          opacity="0.35"
        />
        <path
          d="M 556 168 L 570 128 L 584 168 Z"
          fill={color}
          opacity="0.45"
        />
        <path
          d="M 620 220 L 620 168 L 640 168 L 640 220 Z"
          fill={color}
          opacity="0.35"
        />
        <path
          d="M 616 168 L 630 128 L 644 168 Z"
          fill={color}
          opacity="0.45"
        />
      </g>

      {/* 天际线楼群 */}
      <g opacity={opacity * 0.6}>
        <path
          d="M 80 220 L 80 150 L 120 150 L 120 220 Z"
          fill={color}
        />
        <path
          d="M 150 220 L 150 120 L 190 120 L 190 220 Z"
          fill={color}
        />
        <path
          d="M 210 220 L 210 170 L 250 170 L 250 220 Z"
          fill={color}
        />
        <path
          d="M 280 220 L 280 140 L 330 140 L 330 220 Z"
          fill={color}
        />
        <path
          d="M 360 220 L 360 160 L 400 160 L 400 220 Z"
          fill={color}
        />
        <path
          d="M 430 220 L 430 130 L 480 130 L 480 220 Z"
          fill={color}
        />
        <path
          d="M 700 220 L 700 140 L 750 140 L 750 220 Z"
          fill={color}
        />
        <path
          d="M 780 220 L 780 160 L 820 160 L 820 220 Z"
          fill={color}
        />
        <path
          d="M 850 220 L 850 120 L 900 120 L 900 220 Z"
          fill={color}
        />
        <path
          d="M 930 220 L 930 150 L 980 150 L 980 220 Z"
          fill={color}
        />
        <path
          d="M 1010 220 L 1010 170 L 1050 170 L 1050 220 Z"
          fill={color}
        />
        <path
          d="M 1080 220 L 1080 130 L 1130 130 L 1130 220 Z"
          fill={color}
        />
      </g>

      {/* 河面波光 */}
      <g opacity={opacity * 0.4}>
        <path
          d="M 0 205 L 40 205"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 120 212 L 170 212"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 260 206 L 310 206"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 480 213 L 540 213"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 660 205 L 720 205"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 900 212 L 960 212"
          stroke={color}
          strokeWidth="1"
        />
        <path
          d="M 1100 206 L 1160 206"
          stroke={color}
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

/* ---------- AI 轨道粒子环 ----------
   中心元素周围：多个微小光点沿轨道缓慢公转。 */

export function OrbitRing({
  className = "",
  size = 120,
  dots = 8,
  color = "#34d399",
  speed = 26,
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`}
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
    >
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i / dots) * Math.PI * 2;
        const radius = size / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              left: x - 1.5,
              top: y - 1.5,
              background: color,
              boxShadow: `0 0 ${i % 3 === 0 ? 12 : 6}px ${color}`,
              opacity: 0.7,
              animation: `orbitSpin ${speed}s linear infinite`,
              animationDelay: `${(i / dots) * speed * -1}s`,
              transformOrigin: `${-x}px ${-y}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- 漂浮微粒子 + 连接线（克制） ----------
   少量粒子缓慢漂浮，粒子间有若隐若现的连接线。
   纯 CSS transform 动画，无高频 JS。 */

const PARTICLE_PARAMS = [
  { left: "12%", top: "22%", size: 2, dur: 11, delay: 0 },
  { left: "28%", top: "68%", size: 3, dur: 13, delay: 1.2 },
  { left: "44%", top: "14%", size: 2, dur: 12, delay: 2.1 },
  { left: "62%", top: "58%", size: 2, dur: 14, delay: 0.6 },
  { left: "78%", top: "30%", size: 3, dur: 11, delay: 1.8 },
  { left: "90%", top: "72%", size: 2, dur: 13, delay: 2.6 },
  { left: "55%", top: "82%", size: 2, dur: 12, delay: 3.2 },
  { left: "8%", top: "80%", size: 2, dur: 14, delay: 0.3 },
];

export function ParticleField({
  className = "",
  color = "#6ee7b7",
  opacity = 0.4,
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="ai-constellation absolute inset-0"
        style={{ opacity: opacity * 0.5 }}
      />
      {PARTICLE_PARAMS.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: color,
            boxShadow: `0 0 ${p.size * 4}px ${color}`,
            opacity: opacity,
            animation: `particleFloat ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- 鼠标跟随光晕（桌面端，低消耗） ----------
   用单个 div 的 transform 跟随鼠标（rAF 节流），移动端关闭。 */

export function MouseGlow({
  className = "",
  size = 420,
  color = "rgba(52, 211, 153, 0.07)",
}) {
  const ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isDesktop =
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(min-width: 1024px)").matches;

    if (!isDesktop) return;

    const reduce =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      el.style.transform = `translate(${currentX - size / 2}px, ${currentY - size / 2}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none fixed left-0 top-0 z-[2] rounded-full will-change-transform ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
      }}
    />
  );
}
