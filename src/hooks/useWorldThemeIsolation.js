// src/hooks/useWorldThemeIsolation.js
//
// 营销页（登录 / 落地）自带一套配色与排版，不该被站内「视觉世界」改造。
//
// 为什么需要它：浅色（paper 世界）下 theme.css 有一层批量重映射
//
//   html.theme-custom[data-mode="light"] [class*="text-white"] { color:#161616 !important }
//   html.theme-custom[data-mode="light"] [class*="bg-white"]   { … }
//
// 把全站硬编码白字统一转成墨字 —— 这在米白底的站内页面上是对的，但营销页
// 要压在**视频**上（白字才是可读的），营销区里还有深色 CTA 面板，转成墨字
// 就直接看不见了。world-shim.css 还会顺手改写 bg-white/xx 与图片滤镜。
// 实测（data-mode=light 时）：dark stage 的 h1 计算色 = rgb(22,22,22)，压深色画面。
//
// 这些重映射全部挂在 <html> 的三个开关上（.theme-custom / data-mode /
// data-visual-mode），所以这里在营销页挂载期间把它们摘掉，离开时原样还原。
// 与 Login.jsx 里临时改写 documentElement.scrollBehavior 是同一手法。
//
// 只动 CSS 重映射层：不改 React 状态、不删 --tp-* 变量（那是 ThemeProvider
// 写在行内样式上的，与本开关无关）、也不动 html.dark（Tailwind 的 dark: 变体）。
//
// 时序：React 的 effect 是子先父后，而 ThemeProvider 的 effect 写在 <html> 上、
// 晚于本页执行 —— 所以只摘一次不够，开关会被重新挂回来。
//
// 这里不再靠「同步摘一次 + 下一帧再摘一次」（那只在两个 effect 的先后恰好
// 如此、且 rAF 正常触发时才成立，实测在部分内嵌 webview 里 rAF 根本不回调，
// 白字会被刷成墨字、且在深色视频上直接看不见），而是改成盯着 <html> 的属性：
// 只要本页还挂着，谁把开关挂回来就再摘掉谁。

import { useEffect } from "react";

/* 三个开关：data-visual-mode / data-mode / theme-custom */
const WATCHED_ATTRS = ["data-visual-mode", "data-mode", "class"];

export function useWorldThemeIsolation() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;

    const saved = {
      visualMode: root.getAttribute("data-visual-mode"),
      mode: root.getAttribute("data-mode"),
      themeCustom: root.classList.contains("theme-custom"),
    };

    /* 只写有变化的属性：否则我们自己的写入会再次触发 observer，白跑一轮 */
    const strip = () => {
      if (root.hasAttribute("data-visual-mode")) root.removeAttribute("data-visual-mode");
      if (root.hasAttribute("data-mode")) root.removeAttribute("data-mode");
      if (root.classList.contains("theme-custom")) root.classList.remove("theme-custom");
    };

    strip();

    const observer = new MutationObserver(strip);
    observer.observe(root, { attributes: true, attributeFilter: WATCHED_ATTRS });

    return () => {
      observer.disconnect();
      if (saved.visualMode) root.setAttribute("data-visual-mode", saved.visualMode);
      if (saved.mode) root.setAttribute("data-mode", saved.mode);
      if (saved.themeCustom) root.classList.add("theme-custom");
    };
  }, []);
}

export default useWorldThemeIsolation;
