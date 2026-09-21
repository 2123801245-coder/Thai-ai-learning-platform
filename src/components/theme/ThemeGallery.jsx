// src/components/theme/ThemeGallery.jsx
//
// =========================================================
// Theme Gallery · 四个视觉世界的选择器
// =========================================================
//
// 为什么要重做选择器
// ------------------
// 原来是一个下拉/色块列表 —— 用户看到的是"一堆相似的颜色"，看不出
// 换主题之后**世界会变成什么样**。这里是四个大型 Preview，
// 每个 Preview 用该世界真实的 token 渲染：
//   背景色 + 纹理 + 标题字体 + 一张小卡片 + 一个按钮 + 一个强调点
// 用户不需要读主题名，看缩略图就知道区别。
//
// 关键实现细节：每个 Preview 自己包一层 `data-visual-mode` +
// 内联 token，所以**预览本身就是那个世界**，不是硬编码的示意图。
// 以后改 worlds.js 的数值，预览自动跟着变，不会两边不同步。

import React from "react";
import { Check } from "lucide-react";

import { WORLDS, WORLD_ORDER, worldTokens, resolveWorld } from "@/themes/worlds";
import { useTheme } from "@/lib/ThemeContext";

/** 一个世界的预览卡 */
function WorldPreview({ world, active, onPick }) {
  const tokens = worldTokens(world);
  const isPaper = world.visualMode === "paper";

  return (
    <button
      type="button"
      onClick={() => onPick(world.id)}
      aria-pressed={active}
      className="group relative w-full overflow-hidden text-left transition-transform duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{
        ...tokens,
        borderRadius: "calc(var(--tp-radius-lg) + 2px)",
        border: `1px solid ${active ? "var(--tp-accent)" : "var(--tp-border)"}`,
        boxShadow: active ? "var(--tp-shadow-deep)" : "var(--tp-shadow-soft)",
      }}
    >
      {/* 预览画布：用该世界**真实的 token** 渲染，不是示意图 */}
      <div
        data-visual-mode={world.visualMode}
        className="relative px-4 pb-4 pt-4"
        style={{
          ...tokens,
          background: world.colors.background,
          color: world.colors.text,
          fontFamily: world.form.fontBody,
        }}
      >
        {/* 纹理层：与真实主题同一套规则 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: world.form.textureOpacity,
            mixBlendMode: isPaper ? "multiply" : "screen",
            backgroundImage:
              world.form.texture === "grain"
                ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
                : world.form.texture === "grid"
                  ? `linear-gradient(${isPaper ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${isPaper ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"} 1px, transparent 1px)`
                  : world.form.texture === "mist"
                    ? "linear-gradient(180deg, rgba(180,205,185,0.18), transparent 45%), linear-gradient(180deg, transparent 55%, rgba(120,160,130,0.2))"
                    : "radial-gradient(120% 80% at 50% -10%, rgba(31,107,82,0.28), transparent 60%)",
            backgroundSize: world.form.texture === "grid" ? "22px 22px" : "auto",
          }}
        />

        <div className="relative">
          {/* 标题：用该世界的 display 字体 —— PAPER 会立刻变成衬线 */}
          <p
            className="text-[9px] uppercase tracking-[0.28em]"
            style={{ color: world.colors.accent, opacity: 0.9 }}
          >
            {world.tagline}
          </p>
          <h4
            className="mt-1.5 text-[17px] leading-tight"
            style={{
              fontFamily: world.form.fontDisplay,
              fontWeight: world.form.fontDisplayWeight,
              letterSpacing: world.form.fontDisplayTracking,
            }}
          >
            泰国语学习
          </h4>

          {/* 一张小卡片 + 一个按钮：展示 radius / border / shadow 的差别 */}
          <div
            className="mt-3 flex items-center gap-2.5 px-2.5 py-2"
            style={{
              borderRadius: "var(--tp-radius-md)",
              border: "1px solid var(--tp-border)",
              background: world.colors.surface,
              boxShadow: "var(--tp-shadow-soft)",
            }}
          >
            <span
              className="grid h-6 w-6 shrink-0 place-items-center text-[10px]"
              style={{
                borderRadius: "var(--tp-radius-sm)",
                background: world.colors.primary,
                color: world.colors.background,
              }}
            >
              ก
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] opacity-90">基础泰语</span>
              <span
                className="mt-0.5 block h-[3px] w-full overflow-hidden"
                style={{ borderRadius: "999px", background: "var(--tp-border)" }}
              >
                <span
                  className="block h-full"
                  style={{
                    width: world.visualMode === "modern" ? "72%" : "58%",
                    background: world.colors.accent,
                  }}
                />
              </span>
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span
              className="px-2.5 py-1 text-[10px]"
              style={{
                borderRadius: "var(--tp-radius-sm)",
                background: world.colors.accent,
                color: world.colors.background,
                fontWeight: 600,
              }}
            >
              继续学习
            </span>
            <span
              className="h-4 w-4"
              style={{
                borderRadius: world.visualMode === "paper" ? "1px" : "999px",
                background: world.colors.primary,
                opacity: 0.85,
                boxShadow: `0 0 10px ${world.form.glow}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 名称与说明 */}
      <div
        className="flex items-start justify-between gap-2 px-4 py-3"
        style={{
          ...tokens,
          /*
           * 必须是**不透明**底色。
           * 原来用 `rgba(0,0,0,0.28)`：预览卡是画在页面上的，深色世界那三张
           * 卡的页脚是"浅黑压在白纸上"→ 实际是很浅的灰，而页脚文字是浅色
           * （#EDF1F2）→ 对比度实测只有 1.0，完全读不出。
           * 不透明底色让页脚不依赖身后的页面，四个世界都稳。
           */
          background: world.base === "light" ? "#EFE8D8" : "#0B1210",
          borderTop: "1px solid var(--tp-border)",
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[12.5px] font-semibold"
            style={{ color: world.base === "light" ? "#241F17" : "#EDF1F2" }}
          >
            {world.name}
          </p>
          <p
            className="mt-0.5 truncate text-[10.5px]"
            style={{ color: world.base === "light" ? "#6B6250" : "rgba(237,241,242,0.55)" }}
          >
            {world.nameCn} · {world.style}
          </p>
        </div>
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-opacity"
          style={{
            background: active ? world.colors.accent : "transparent",
            border: active ? "none" : `1px solid ${world.base === "light" ? "rgba(36,31,23,0.3)" : "rgba(255,255,255,0.25)"}`,
            opacity: active ? 1 : 0.7,
          }}
        >
          {active ? <Check className="h-3 w-3" style={{ color: world.colors.background }} /> : null}
        </span>
      </div>
    </button>
  );
}

export default function ThemeGallery({ className = "" }) {
  const { theme, setWorld, world: current } = useTheme();
  /* 老 id（emerald/bangkok…）会映射到某个世界，所以按世界判断选中 */
  const activeWorldId = resolveWorld(theme).id;

  return (
    <div className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Visual Worlds
          </p>
          <h3 className="mt-1 text-[15px] font-medium text-white/90">
            选择你的学习世界
          </h3>
        </div>
        <p className="hidden text-[11px] text-white/35 sm:block">
          当前：{current?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {WORLD_ORDER.map((id) => (
          <WorldPreview
            key={id}
            world={WORLDS[id]}
            active={activeWorldId === id}
            onPick={setWorld}
          />
        ))}
      </div>
    </div>
  );
}
