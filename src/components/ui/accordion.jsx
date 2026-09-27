// src/components/ui/accordion.jsx
//
// =========================================================
// Accordion · transitions.dev「手风琴」过渡
// =========================================================
// 来源：transitions.dev 的 Accordion（Jakub Antalik, transitions.dev，MIT）。
// CSS 原样落在 src/themes/theme.css 尾部（运行时注入只是 theme.css 单独
// 被移除时的自愈兑底），React 部分按本项目形态收成两个薄组件：
//
// 动效原理（为什么不是 max-height / JS 测高）：
//   面板高度动画用 grid-template-rows 0fr ↔ 1fr —— 展开收起都是纯 CSS，
//   内容多高都行，不需要测高、不会闪动；内层裁掉溢出并做透明度 + 轻模糊。
//   箭头用 scaleY 翻转，中点恰好是一条平线，观感与路径 morph 一致，
//   但所有浏览器都能跑（CSS `d:` morph 只有 Chromium 支持）。
//
// 运动令牌（CSS 变量，可在任何作用域改）：
//   --acc-expand / --acc-collapse / --acc-chevron / --acc-ease
//
// 用法一（直接用类名，自己管状态）：
//   <div className="t-acc" data-open={open ? "true" : "false"}>
//     <button className="t-acc-head" aria-expanded={open}>…</button>
//     <div className="t-acc-panel"><div className="t-acc-panel-inner">…</div></div>
//   </div>
//
// 用法二（本项目封装）：
//   import { AccordionPanel, AccordionChevron } from "@/components/ui/accordion";
// =========================================================

import React from "react";

/*
 * 唯一的样式事实在 src/themes/theme.css（与其他过渡/主题 CSS 同处一处，
 * 不走运行时注入）。下面这份常量仅供单测/文档引用，页面不要 import 它。
 */
export const ACCORDION_STYLES = `\
/* Transitions.dev — Accordion expand (https://transitions.dev/transitions/accordion/) */
:root {
  --acc-expand: 250ms;
  --acc-collapse: 250ms;
  --acc-chevron: 250ms;
  --acc-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

/* grid-template-rows 0fr → 1fr gives a clean height animation
with no JS measurement; the inner element clips overflow. */
.t-acc-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--acc-collapse) var(--acc-ease);
}

.t-acc[data-open="true"] .t-acc-panel {
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--acc-expand) var(--acc-ease);
}

.t-acc-panel-inner {
  overflow: hidden;
  opacity: 0;
  filter: blur(2px);
  transition:
    opacity var(--acc-collapse) var(--acc-ease),
    filter var(--acc-collapse) var(--acc-ease);
}

.t-acc[data-open="true"] .t-acc-panel-inner {
  opacity: 1;
  filter: blur(0);
  transition:
    opacity var(--acc-expand) var(--acc-ease),
    filter var(--acc-expand) var(--acc-ease);
}

/* Flip the chevron vertically to turn the "v" into a "^".
scaleY(-1) about the centre passes through a flat line at
the midpoint (same look as a \`d:\` path morph) but animates
in every browser, unlike CSS \`d:\` morphing (Chromium only). */
.t-acc-chevron {
  display: inline-flex;
  transform: scaleY(1);
  transform-origin: center;
  transition: transform var(--acc-chevron) var(--acc-ease);
}

.t-acc-chevron path { vector-effect: non-scaling-stroke; }

.t-acc[data-open="true"] .t-acc-chevron {
  transform: scaleY(-1);
}

@media (prefers-reduced-motion: reduce) {
  .t-acc-panel, .t-acc-panel-inner, .t-acc-chevron {
    transition: none !important;
  }
}
`;

/*
 * 上游的 React 版本在首次 import 时往 <head> 注入同一份样式；
 * 本项目的样式已静态化到 theme.css，这里保留一次防御性注入
 * —— theme.css 那段被单独移除时组件仍能自愈（幂等，按 id 去重）。
 */
if (typeof document !== "undefined" && !document.getElementById("transitions-acc")) {
  const style = document.createElement("style");
  style.id = "transitions-acc";
  style.textContent = ACCORDION_STYLES;
  document.head.appendChild(style);
}

/**
 * 本项目封装：只包「展开区 + 箭头」，头部按钮由调用方自己写
 * （各页头部结构差异太大 —— Profile 的统计行、LessonText 的生词行 ——
 * 收在这里反而要开一堆洞）。挂 `data-open` 即得整套过渡。
 */
export function AccordionPanel({ open, children, className = "" }) {
  return (
    <div className={`t-acc ${className}`} data-open={open ? "true" : "false"}>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">{children}</div>
      </div>
    </div>
  );
}

/**
 * 上游示例里那颗箭头（16×16，stroke 1.5）。
 * 单独导出而不是藏死在 AccordionPanel 里：调用自己的头部的页面也要同一颗。
 */
export function AccordionChevron({ className = "" }) {
  return (
    <span className={`t-acc-chevron ${className}`} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M4 6.5L8 10.5L12 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
