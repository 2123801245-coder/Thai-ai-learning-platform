import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { THEMES, THEME_ORDER } from "@/themes/theme";

/* 预设主题卡片网格：每张卡展示真实配色预览 + 选中勾 */
export default function ThemeSelector({ value, onChange, mode = "dark" }) {
  const cards = useMemo(() => THEME_ORDER.map((id) => THEMES[id]), []);
  const isLight = mode === "light";

  function palette(theme) {
    return isLight ? (theme.lightColors || theme.colors) : theme.colors;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((t) => {
        const active = value === t.id;
        const c = palette(t);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="relative overflow-hidden rounded-2xl border p-2 text-left transition"
            style={{
              background: c.surface,
              borderColor: active ? `${c.primary}88` : (isLight ? "rgba(18, 45, 38, 0.12)" : "rgba(255,255,255,0.1)"),
              boxShadow: active ? `0 0 0 2px ${c.primary}33` : "none",
              color: c.text,
            }}
            aria-pressed={active}
          >
            {/* 色卡预览 */}
            <div className="flex h-11 items-end gap-1 rounded-lg px-1.5 pb-1.5" style={{ background: c.background }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.primary }} />
              <span className="h-4 w-2.5 rounded-full" style={{ background: c.secondary }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} />
              <span className="ml-auto h-3 w-6 rounded-sm" style={{ background: c.text }} />
            </div>

            <div className="mt-1.5 px-0.5 pb-0.5">
              <p className="truncate text-[11px] font-bold" style={{ color: c.text }}>{t.name}</p>
              <p className="truncate text-[9px]" style={{ color: c.text, opacity: 0.58 }}>{t.tag}</p>
              <p
                className="mt-0.5 inline-block rounded-md px-1 py-px text-[8px] font-semibold leading-tight"
                style={{ color: c.accent, background: `color-mix(in srgb, ${c.accent} 12%, transparent)` }}
              >
                {t.style}
              </p>
            </div>

            {active && (
              <span
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white"
                style={{ background: c.primary }}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}