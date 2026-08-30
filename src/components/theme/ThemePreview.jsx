import React from "react";
import { Bot, Sparkles } from "lucide-react";

const { useMemo } = React;

/* 主题实时预览：模拟一个 ThaiAI Dashboard，颜色取自 theme 变量 */
export default function ThemePreview({ colors }) {
  const c = useMemo(() => {
    const bg = colors.background || "#0f1a1e";
    const card = colors.surface && colors.surface !== "none"
      ? colors.surface
      : "rgba(255,255,255,0.06)";
    const text = colors.text || "#ffffff";
    const primary = colors.primary || "#10B981";
    const accent = colors.accent || "#F5C451";
    return { bg, card, text, primary, accent, secondary: colors.secondary || primary };
  }, [colors]);

  const { bg, card, text, primary, accent } = c;

  // 判断背景明暗以选择文字可读性
  const isLight = isLightColor(bg);

  return (
    <div
      className="pointer-events-none w-full overflow-hidden rounded-xl border border-white/10"
      style={{ background: c.bg, color: c.text, borderRadius: "inherit" }}
    >
      {/* 预览顶部导航 */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.1)" }}
      >
        <span className="text-xs font-black tracking-tight">ThaiAI</span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ background: `${primary}22`, color: primary }}
        >
          AI 泰语老师
        </span>
      </div>

      <div className="space-y-2 p-3">
        {/* 问候块 */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: card, border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-[10px]" style={{ opacity: 0.6 }}>今日学习</p>
          <p className="mt-0.5 text-sm font-bold">คำศัพท์</p>
          <p className="mt-1 text-[11px]">
            <span style={{ color: primary }}>你好</span>
            <span className="ml-1" style={{ opacity: 0.85 }}>สวัสดี</span>
          </p>
        </div>

        {/* 进度条 */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: card, border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ opacity: 0.7 }}>学习进度</span>
            <span style={{ color: accent }}>75%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)" }}>
            <div className="h-full rounded-full" style={{ width: "75%", background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
          </div>
        </div>

        {/* AI Teacher 卡片 */}
        <div
          className="flex items-center gap-2 rounded-lg p-2.5"
          style={{ background: card, border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${primary}22` }}>
            <Bot className="h-3.5 w-3.5" style={{ color: primary }} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold">AI Teacher</p>
            <p className="text-[9px]" style={{ opacity: 0.6 }}>随时陪你练泰语</p>
          </div>
          <Sparkles className="h-3 w-3" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

function isLightColor(c) {
  if (typeof c !== "string") return false;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
    return lum > 155;
  }
  let hex = c.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((h) => h + h).join("");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
  }
  return false;
}