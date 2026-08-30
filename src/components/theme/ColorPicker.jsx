import React, { useState } from "react";

/* 颜色选择器：原生色盘 + HEX/RGBA 输入框 */
export default function ColorPicker({ label, en, value, onChange }) {
  const [text, setText] = useState(value || "");
  const isDark = true; // 面板位于深色设置中

  function handleText(v) {
    setText(v);
    if (/^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s]+\))$/.test(v.trim())) {
      onChange(v.trim());
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15"
        style={{ background: value || "transparent" }}
      >
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => { onChange(e.target.value); setText(e.target.value); }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`选择${label || en}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-white/75">
          {label}<span className="ml-1 text-[9px] text-white/35">{en}</span>
        </p>
        <input
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setText(value || "")}
          spellCheck={false}
          className="mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/80 outline-none focus:border-emerald-300/40"
          aria-label={`${label}颜色值`}
        />
      </div>
    </div>
  );
}

function normalizeHex(v) {
  if (!v) return "#10B981";
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v.slice(0, 7);
  return "#10B981";
}