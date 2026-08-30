import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { THEMES, THEME_ORDER } from "@/themes/theme";

/* 顶栏快捷主题切换器：预设下拉 + 深/浅模式快捷切换 */
export default function ThemeQuickSwitcher({ compact = false }) {
  const { theme, setTheme, mode, setMode, setCustomColors } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = THEMES[theme] || THEMES.emerald;

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(id) {
    setTheme(id);
    setCustomColors({}); // 切换预设时清掉自定义叠加，避免混淆
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] transition hover:border-emerald-300/30 hover:bg-white/[0.08] ${
          compact ? "px-2 py-1.5" : "px-2.5 py-2"
        }`}
        title="快捷切换主题"
      >
        <Palette className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} text-emerald-300/80`} />
        {!compact && (
          <>
            <span className="max-w-[92px] truncate text-[11px] font-semibold text-white/75">
              {current.nameCn}
            </span>
            <ChevronDown className={`h-3 w-3 text-white/40 transition ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-[90] mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a16]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
        >
          <p className="px-2 pb-1 pt-1.5 text-[9px] font-bold tracking-[0.16em] text-white/30">
            主题预设
          </p>
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(id)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                  active ? "bg-emerald-400/[0.12]" : "hover:bg-white/[0.06]"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-white/15" style={{ background: t.colors.accent }} />
                <span className="flex-1 truncate text-[11px] font-medium text-white/80">
                  {t.nameCn}
                  <span className="ml-1 text-[9px] text-white/35">{t.name}</span>
                </span>
                {active && <Check className="h-3 w-3 text-emerald-300" />}
              </button>
            );
          })}

          <div className="my-1.5 h-px bg-white/[0.08]" />

          <p className="px-2 pb-1 text-[9px] font-bold tracking-[0.16em] text-white/30">显示模式</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: "dark", label: "深色", icon: Moon },
              { id: "light", label: "浅色", icon: Sun },
            ].map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setOpen(false); }}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition ${
                    active
                      ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-200"
                      : "border-white/10 text-white/55 hover:border-white/25"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}