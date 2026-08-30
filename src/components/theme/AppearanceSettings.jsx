import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  RotateCcw,
  Type,
  CornerDownRight,
  GlassWater,
  Waves,
} from "lucide-react";

import { useTheme } from "@/lib/ThemeContext";
import ThemeSelector from "@/components/theme/ThemeSelector";
import ThemePreview from "@/components/theme/ThemePreview";
import ColorPicker from "@/components/theme/ColorPicker";
import {
  COLOR_FIELDS,
  THEMES,
  DEFAULT_CUSTOM_COLORS,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
} from "@/themes/theme";

const MODES = [
  { id: "dark", label: "深色", icon: Moon },
  { id: "light", label: "浅色", icon: Sun },
  { id: "system", label: "跟随系统", icon: Monitor },
];

const BG_EFFECTS = [
  { id: "none", label: "无", icon: Sparkles },
  { id: "soft", label: "柔和渐变", icon: Waves },
  { id: "glow", label: "光晕", icon: Sparkles },
  { id: "thai", label: "泰国文化", icon: Sparkles },
  { id: "star", label: "星空", icon: Sparkles },
  { id: "particle", label: "粒子", icon: Sparkles },
];

/* 外观与主题面板（Appearance & Theme Studio） */
export default function AppearanceSettings() {
  const {
    theme: themeId,
    setTheme,
    mode,
    setMode,
    customColors,
    setCustomColor,
    font,
    setFont,
    radius,
    setRadius,
    glass,
    setGlass,
    bgEffect,
    setBgEffect,
    resetTheme,
  } = useTheme();

  // 实时预览色：自定义优先，否则取预设
  const previewColors = useMemo(() => {
    const preset = THEMES[themeId];
    return { ...(preset?.colors || DEFAULT_CUSTOM_COLORS), ...customColors };
  }, [themeId, customColors]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Palette className="h-3.5 w-3.5" />
            APPEARANCE & THEME
          </p>
          <h2 className="mt-1 text-lg font-black text-white">外观与主题</h2>
          <p className="mt-0.5 text-[11px] text-white/35">Customize your ThaiAI experience</p>
        </div>
        <button
          type="button"
          onClick={resetTheme}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-white/55 transition hover:border-emerald-300/30 hover:text-white/80"
        >
          <RotateCcw className="h-3 w-3" />
          恢复默认
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* 左列：控制项 */}
        <div className="space-y-4">
          {/* 主题模式 */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="mb-2.5 text-[11px] font-bold text-white/60">主题模式</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                      active
                        ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
                        : "border-white/10 text-white/55 hover:border-white/25"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 主题预设 */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="mb-2.5 text-[11px] font-bold text-white/60">主题预设</p>
            <ThemeSelector value={themeId} onChange={setTheme} />
          </section>

          {/* 自定义颜色 */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="mb-2.5 text-[11px] font-bold text-white/60">自定义主题颜色</p>
            <p className="mb-3 text-[10px] leading-4 text-white/35">
              选择主色 / 强调色 / 背景等，修改后全站实时预览；与预设主题叠加生效。
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => (
                <ColorPicker
                  key={f.key}
                  label={f.label}
                  en={f.en}
                  value={customColors[f.key] || previewColors[f.key] || f.hint}
                  onChange={(v) => setCustomColor(f.key, v)}
                />
              ))}
            </div>
          </section>

          {/* 字体 */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white/60">
              <Type className="h-3.5 w-3.5" />字体
            </p>
            <div className="flex flex-wrap gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    font === f.id
                      ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
                      : "border-white/10 text-white/55 hover:border-white/25"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* 圆角 */}
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                <CornerDownRight className="h-3.5 w-3.5" />圆角程度
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRadius(r.id)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      radius === r.id
                        ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
                        : "border-white/10 text-white/55 hover:border-white/25"
                    }`}
                  >
                    {r.label}
                    <span className="ml-1 text-[9px] opacity-50">{r.value}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 玻璃效果 */}
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                <GlassWater className="h-3.5 w-3.5" />玻璃效果
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: true, label: "开启" },
                  { id: false, label: "关闭（纯色卡）" },
                ].map((o) => (
                  <button
                    key={String(o.id)}
                    type="button"
                    onClick={() => setGlass(o.id)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      glass === o.id
                        ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
                        : "border-white/10 text-white/55 hover:border-white/25"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* 背景氛围 */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white/60">
              <Sparkles className="h-3.5 w-3.5" />背景氛围
            </p>
            <p className="mb-2.5 text-[10px] text-white/35">保持阅读清晰，避免过于花哨。</p>
            <div className="flex flex-wrap gap-2">
              {BG_EFFECTS.map((b) => {
                const Icon = b.icon;
                const active = bgEffect === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBgEffect(b.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                      active
                        ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
                        : "border-white/10 text-white/55 hover:border-white/25"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {b.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* 右列：实时预览 */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              实时预览 <span className="font-normal text-white/30">Live Preview</span>
            </p>
            <ThemePreview colors={previewColors} />
            <p className="mt-2.5 text-[10px] leading-4 text-white/35">
              颜色、主题、圆角与玻璃效果的修改会实时应用到整个网站，无需刷新。
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}