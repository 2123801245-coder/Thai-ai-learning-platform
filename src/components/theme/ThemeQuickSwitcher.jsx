import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { THEMES, THEME_ORDER } from "@/themes/theme";

/* 顶栏快捷主题切换器：预设下拉 + 深/浅模式快捷切换
   下拉用 position:fixed 按视口定位，绕开 Sidebar/MainLayout 的 overflow 裁剪 */
export default function ThemeQuickSwitcher({ compact = false }) {
  const { theme, setTheme, mode, setMode, setCustomColors } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // {top, left, right} 视口坐标
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const current = THEMES[theme] || THEMES.emerald;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    function onScroll() { if (open) setOpen(false); }
    function onResize() { if (open) setOpen(false); }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        const MENU_W = 216;
        const vw = window.innerWidth;
        // left 对齐按钮左缘，若超出视口右则收窄以完全可见
        let left;
        if (r.left + MENU_W > vw) left = Math.max(4, vw - MENU_W - 4);
        else left = Math.max(4, r.left);
        setPos({ top: r.bottom + 6, left });
      }
    }
    setOpen((o) => !o);
  }

  function pick(id) {
    setTheme(id);
    setCustomColors({}); // 切换预设时清掉自定义叠加，避免混淆
    setOpen(false);
  }

  return (
    <div ref={btnRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`theme-quick-toggle flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] transition hover:border-emerald-300/30 hover:bg-white/[0.08] ${
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
          ref={menuRef}
          role="listbox"
          className="fixed z-[200] w-[216px] origin-top-left overflow-visible rounded-2xl border border-white/10 bg-[#0d1a16]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 12 }}
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
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[11px] font-medium text-white/80">
                    {t.nameCn}
                    <span className="ml-1 text-[9px] text-white/35">{t.name}</span>
                  </span>
                  <span className="block truncate text-[8.5px] text-white/35">{t.style}</span>
                </span>
                {active && <Check className="h-3 w-3 shrink-0 text-emerald-300" />}
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