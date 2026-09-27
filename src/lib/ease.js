// src/lib/ease.js
//
// beui 组件的共享动效 token（vendored，见 components/motion/theme-toggle.jsx）。
//
// 上游 lib/ease.ts 里还有 EASE_IN_OUT / EASE_DRAWER 和几个 spring 曲线，
// 目前只有主题切换用得到下面这一个，所以只搬这一个；需要时从
// https://beui.dev/r/<组件名>.json 取回其余即可。
//
// 注意：这里是 **CSS 字符串**形式。View Transition 的动画是 CSS 驱动、
// 不是 motion spring，所以只能给它 CSS 缓动（或 ease-out 这类关键字）。

/** EASE_OUT 的 CSS 字符串形式，用于 View Transition 的 animation 简写。 */
export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";
