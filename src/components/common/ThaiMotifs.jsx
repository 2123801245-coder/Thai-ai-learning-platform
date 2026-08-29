import React from "react";

/* =========================================================
   ThaiMotifs —— 原创泰国元素装饰组件
   （所有 SVG 均为原创绘制，无侵权风险）
   - ThaiPatternBand  泰式织物纹样横幅（菱形/几何纹样）
   - LotusSilhouette  莲花剪影
   - ElephantSilhouette 大象剪影（几何化）
   - ThaiRoof         泰式屋顶剪影（wat 风格三层弧线）
   - ThaiDivider      纹样分隔线（两侧线条 + 中央莲花）
   - ThaiCorner       页面四角泰式装饰（可选）
========================================================= */

/* ---------- 泰式织物纹样横幅 ----------
   重复的菱形格子 + 中心菱形，模仿泰丝织纹。
   用 SVG <pattern> 平铺，低透明度，适合做横幅/背景。 */

export function ThaiPatternBand({
  className = "",
  patternId = "thai-weave-pattern",
  color = "#F5D67B",
  opacity = 0.14,
  height = 14,
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 14"
      >
        <defs>
          <pattern
            id={patternId}
            width="100"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            {/* 顶部小菱形串 */}
            <path
              d="M 6 2 L 9 5 L 6 8 L 3 5 Z"
              fill={color}
              opacity="0.55"
            />
            <path
              d="M 26 2 L 29 5 L 26 8 L 23 5 Z"
              fill={color}
              opacity="0.35"
            />
            <path
              d="M 46 2 L 49 5 L 46 8 L 43 5 Z"
              fill={color}
              opacity="0.55"
            />
            <path
              d="M 66 2 L 69 5 L 66 8 L 63 5 Z"
              fill={color}
              opacity="0.35"
            />
            <path
              d="M 86 2 L 89 5 L 86 8 L 83 5 Z"
              fill={color}
              opacity="0.55"
            />
            {/* 底部横线 + 小菱形 */}
            <path
              d="M 0 12 L 100 12"
              stroke={color}
              strokeWidth="0.6"
              opacity="0.5"
            />
            <path
              d="M 16 9 L 19 12 L 16 15 L 13 12 Z"
              fill={color}
              opacity="0.3"
            />
            <path
              d="M 56 9 L 59 12 L 56 15 L 53 12 Z"
              fill={color}
              opacity="0.3"
            />
            <path
              d="M 96 9 L 99 12 L 96 15 L 93 12 Z"
              fill={color}
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          opacity={opacity}
        />
      </svg>
    </div>
  );
}

/* ---------- 莲花剪影 ---------- */

export function LotusSilhouette({
  className = "",
  color = "#F5D67B",
  opacity = 0.5,
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 80"
      className={className}
      fill="none"
    >
      <path
        d="M 60 78 C 44 64 42 50 52 40 C 58 34 62 34 68 40 C 78 50 76 64 60 78 Z"
        fill={color}
        opacity={opacity * 0.9}
      />
      <path
        d="M 60 78 C 36 66 28 52 34 38 C 38 30 46 28 54 32 C 48 44 50 60 60 78 Z"
        fill={color}
        opacity={opacity * 0.75}
      />
      <path
        d="M 60 78 C 84 66 92 52 86 38 C 82 30 74 28 66 32 C 72 44 70 60 60 78 Z"
        fill={color}
        opacity={opacity * 0.75}
      />
      <path
        d="M 60 74 C 48 60 46 48 54 42 C 57 40 63 40 66 42 C 74 48 72 60 60 74 Z"
        fill={color}
        opacity={opacity * 0.5}
      />
      <path
        d="M 60 30 C 62 24 62 18 60 12 C 58 18 58 24 60 30 Z"
        fill={color}
        opacity={opacity}
      />
    </svg>
  );
}

/* ---------- 大象剪影（几何化、简洁） ---------- */

export function ElephantSilhouette({
  className = "",
  color = "#F5D67B",
  opacity = 0.5,
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 100"
      className={className}
      fill="none"
    >
      {/* 身体 */}
      <path
        d="M 30 62 C 20 62 14 54 14 46 C 14 38 22 32 34 32 C 46 32 56 26 70 22
           C 84 18 98 18 110 24 C 118 28 124 34 126 42 C 128 50 124 58 118 62
           L 118 84 C 118 88 114 90 112 86 L 108 72
           L 100 86 C 98 90 93 90 92 86 L 88 70 L 76 72
           L 72 88 C 70 92 64 92 63 88 L 60 72 L 48 74
           L 44 88 C 42 92 36 92 35 88 L 32 72 L 30 62 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 象鼻 */}
      <path
        d="M 126 42 C 132 34 136 34 138 40 C 140 46 138 52 132 56
           C 128 58 124 56 122 52 C 126 50 128 46 127 42 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 耳朵 */}
      <path
        d="M 50 38 C 42 34 40 40 44 48 C 48 54 56 54 60 48
           C 56 42 54 38 50 38 Z"
        fill={color}
        opacity={opacity * 0.65}
      />
      {/* 眼睛 */}
      <circle cx="116" cy="46" r="2.4" fill={color} opacity={opacity * 0.8} />
    </svg>
  );
}

/* ---------- 泰式屋顶剪影（wat 风格三层弧线） ---------- */

export function ThaiRoof({
  className = "",
  color = "#F5D67B",
  opacity = 0.5,
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 90"
      className={className}
      fill="none"
    >
      {/* 三层屋顶 */}
      <path
        d="M 100 4 L 196 24 L 194 30 L 100 12 L 6 30 L 4 24 Z"
        fill={color}
        opacity={opacity}
      />
      <path
        d="M 100 18 L 188 40 L 185 47 L 100 30 L 15 47 L 12 40 Z"
        fill={color}
        opacity={opacity * 0.8}
      />
      <path
        d="M 100 36 L 178 58 L 174 66 L 100 50 L 26 66 L 22 58 Z"
        fill={color}
        opacity={opacity * 0.6}
      />
      {/* 立柱 */}
      <path
        d="M 92 52 L 92 84 L 96 84 L 96 52 Z"
        fill={color}
        opacity={opacity * 0.8}
      />
      <path
        d="M 104 52 L 104 84 L 108 84 L 108 52 Z"
        fill={color}
        opacity={opacity * 0.8}
      />
      {/* 基座 */}
      <path
        d="M 80 84 L 120 84 L 122 88 L 78 88 Z"
        fill={color}
        opacity={opacity}
      />
    </svg>
  );
}

/* ---------- 纹样分隔线（标题装饰） ----------
   两侧金色渐变线 + 中央小莲花/菱形 */

export function ThaiDivider({
  className = "",
  compact = false,
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-center gap-3 ${className}`}
    >
      <div
        className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-300/40 to-yellow-300/70"
      />
      <div
        className="flex items-center justify-center"
      >
        <LotusSilhouette
          className={compact ? "h-4 w-6" : "h-5 w-8"}
          opacity={0.55}
        />
      </div>
      <div
        className="h-px flex-1 bg-gradient-to-l from-transparent via-yellow-300/40 to-yellow-300/70"
      />
    </div>
  );
}

/* ---------- 泰式背景纹样层（整页淡背景） ----------
   可放在页面根节点，给整个页面覆盖一层极淡的泰式几何纹样 */

export function ThaiPatternOverlay({
  className = "",
  patternId = "thai-bg-pattern",
  color = "#F5D67B",
  opacity = 0.045,
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg className="h-full w-full">
        <defs>
          <pattern
            id={patternId}
            width="140"
            height="140"
            patternUnits="userSpaceOnUse"
          >
            {/* 菱形格子（泰丝纹样） */}
            <path
              d="M 70 10 L 130 70 L 70 130 L 10 70 Z"
              fill="none"
              stroke={color}
              strokeWidth="0.8"
              opacity="0.5"
            />
            <path
              d="M 70 40 L 100 70 L 70 100 L 40 70 Z"
              fill="none"
              stroke={color}
              strokeWidth="0.6"
              opacity="0.35"
            />
            {/* 角上小菱形 */}
            <path
              d="M 20 15 L 26 21 L 20 27 L 14 21 Z"
              fill={color}
              opacity="0.4"
            />
            <path
              d="M 120 113 L 126 119 L 120 125 L 114 119 Z"
              fill={color}
              opacity="0.4"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          opacity={opacity}
        />
      </svg>
    </div>
  );
}
