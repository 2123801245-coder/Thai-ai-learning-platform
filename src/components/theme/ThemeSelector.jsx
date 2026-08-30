import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { THEMES, THEME_ORDER } from "@/themes/theme";

/* 预设主题卡片网格：每张卡展示真实配色预览 + 选中勾 */
export default function ThemeSelector({ value, onChange }) {
  const cards = useMemo(() => THEME_ORDER.map((id) => THEMES[id]), []);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative overflow-hidden rounded-2xl border p-2 text-left transition ${
              active
                ? "border-emerald-300/50 ring-2 ring-emerald-400/30"
                : "border-white/10 hover:border-white/25"
            }`}
            style={{ background: t.colors.surface }}
            aria-pressed={active}
          >
            {/* 色卡预览 */}
            <div className="flex h-11 items-end gap-1 rounded-lg px-1.5 pb-1.5" style={{ background: t.colors.background }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.colors.primary }} />
              <span className="h-4 w-2.5 rounded-full" style={{ background: t.colors.secondary }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.colors.accent }} />
              <span className="ml-auto h-3 w-6 rounded-sm" style={{ background: t.colors.text }} />
            </div>

            <div className="mt-1.5 px-0.5 pb-0.5">
              <p className="truncate text-[11px] font-bold text-white/85">{t.name}</p>
              <p className="text-[9px] text-white/35">{t.tag}</p>
            </div>

            {active && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] text-black">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}