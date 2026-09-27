// src/components/motion/theme-toggle.jsx
//
// beui 的主题切换按钮（vendored，https://beui.dev/components/motion/theme-toggle）。
//
// 它做的事和普通主题按钮不一样：不是让颜色直接跳过去，而是用 **View Transition
// API** 把整页重绘成一次转场 —— 矩形/圆形的 clip-path 揭示，或者像百叶窗一样
// 从一侧刷开。图标交叉淡化那一下由 components/motion/action-swap 负责。
//
// 与上游的三处差异（都写在这里，方便日后照着上游 diff）：
//   ① 主题状态用本站的 lib/ThemeContext（深/浅两态），不是 next-themes。
//      所以没有 `mounted`：这是纯客户端 SPA，没有 SSR 水合不一致的问题。
//   ② motion/react → framer-motion（同一个库，项目里已经装了）。
//   ③ 默认 variant 从上游的 "rectangle" 改成 "circle-blur"（见下方注释）。
//
// 转场期间不能同时跑 ThemeContext 那套 420ms 全局配色过渡：View Transition
// 的「新」快照是在切换后一帧拍的，那时颜色还停在过渡起点，揭开后会看到
// 旧配色再跳一下。所以有 VT 时走 setModeInstantly（跳过那条过渡）。
import { Moon, Sun } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { ActionSwapIcon } from "@/components/motion/action-swap";
import { EASE_OUT_CSS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/ThemeContext";

const VT_STYLE_ID = "beui-theme-toggle-vt";

/*
 * 转场本身由 CSS 驱动（不是 motion spring），所以缓动只能是 EASE_OUT_CSS
 * 或者关键字。圆形两种用 Material 标准曲线 —— 它是从中心对称扩散，不是减速；
 * 各变体时长不同，对齐系统原生切换主题的观感。
 */
const VT_CSS = `
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
html[data-beui-vt="circle"]::view-transition-old(root),
html[data-beui-vt="circle-blur"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="circle"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="circle-blur"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-blur-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="blinds"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
/* 百叶窗：每条 72px 的瓦片里一条带子逐渐变宽，新主题像卷帘一样刷过去。
   带子的边缘必须用注册过的自定义属性 —— mask-image 本身不可动画，但
   属性每帧变化会让它重新求值。mask-size 把瓦片钉在 72px，而不是让重复
   渐变的最后一个色标决定宽度，这样 20px 的软边不会把瓦片撑得比缝隙还宽、
   留下一条永远合不拢的缝；两端也因此落得干净：-20px 全透、72px 全不透。
   属性没注册时 var 无效、mask 整条失效，退化成一次性揭示。 */
@property --beui-vt-slat {
  syntax: "<length>";
  inherits: false;
  initial-value: 72px;
}
html[data-beui-vt="blinds"]::view-transition-new(root) {
  mix-blend-mode: normal;
  mask-image: linear-gradient(
    90deg,
    #000 0 var(--beui-vt-slat),
    transparent calc(var(--beui-vt-slat) + 20px)
  );
  mask-size: 72px 100%;
  mask-repeat: repeat;
  animation: beui-blinds-reveal 700ms ${EASE_OUT_CSS};
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes beui-circle-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); }
}
@keyframes beui-circle-blur-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); filter: blur(8px); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); filter: blur(0px); }
}
@keyframes beui-blinds-reveal {
  from { --beui-vt-slat: -20px; }
  to   { --beui-vt-slat: 72px; }
}
`;

/** 变体：矩形 / 圆形 / 模糊圆形 / 百叶窗。 */
export const THEME_VARIANTS = ["rectangle", "circle", "circle-blur", "blinds"];

const RECT_FROM = {
  "top-left": "inset(0 100% 100% 0)",
  "top-right": "inset(0 0 100% 100%)",
  "bottom-left": "inset(100% 100% 0 0)",
  "bottom-right": "inset(100% 0 0 100%)",
  center: "inset(50% 50% 50% 50%)",
  "bottom-up": "inset(100% 0 0 0)",
};

const CIRCLE_ORIGIN = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
  center: "50% 50%",
  "bottom-up": "50% 100%",
};

function useThemeToggle({ variant, start }) {
  const { isDark, setMode, setModeInstantly } = useTheme();
  const reduce = useReducedMotion() ?? false;

  /* 转场用的 CSS 只注入一次（三个按钮共用一份） */
  useEffect(() => {
    if (document.getElementById(VT_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = VT_STYLE_ID;
    el.textContent = VT_CSS;
    document.head.appendChild(el);
  }, []);

  const toggle = () => {
    const next = isDark ? "light" : "dark";

    /*
     * 没有 VT 支持（或用户要求减少动效）时退回原来的平滑过渡。
     * 这里判可调用而不是 `"startViewTransition" in document`（上游写法）：
     * 属性存在但不可调用时（被打包工具/测试桩/旧实验实现塞成 undefined），
     * 那种写法会走到下面直接抛异常，主题反而不切了；实测踩到过。
     */
    if (reduce || typeof document.startViewTransition !== "function") {
      setMode(next);
      return;
    }

    const root = document.documentElement;
    if (variant === "rectangle") {
      root.style.setProperty("--beui-vt-from", RECT_FROM[start]);
      root.dataset.beuiVt = "rect";
    } else if (variant === "blinds") {
      /* 百叶窗横扫整个视口，没有原点可言 */
      root.dataset.beuiVt = "blinds";
    } else {
      root.style.setProperty("--beui-vt-origin", CIRCLE_ORIGIN[start]);
      root.dataset.beuiVt = variant;
    }

    /*
     * 兜底（非上游代码）：View Transition 的主题切换写在转场的**更新回调**里，
     * 而那个回调只有在文档拿到一次渲染机会时才会被执行 —— 窗口被完全遮挡、
     * 标签页在后台时不会。那种情况下按钮就成了「点了没反应」，而且
     * data-beui-vt 会永久留在 <html> 上（转场 CSS 一直挂着）。
     * 实测踩到过：日志里 startViewTransition 已调用、回调始终没跑。
     * 所以一秒内没切过去就自己切，并把转场状态清干净。
     */
    let applied = false;
    let watchdog = null;
    const apply = () => {
      if (applied) return;
      applied = true;
      setModeInstantly(next);
    };
    const cleanup = () => {
      delete root.dataset.beuiVt;
      clearTimeout(watchdog);
    };

    document.startViewTransition(apply).finished.finally(cleanup);

    watchdog = setTimeout(() => {
      if (applied) return;
      apply();
      cleanup();
    }, 1000);
  };

  return { isDark, toggle };
}

/**
 * 主题切换按钮。
 *
 * @param {object}  props
 * @param {"rectangle"|"circle"|"circle-blur"|"blinds"} [props.variant]
 *        转场形态。**上游默认 rectangle，本站默认 circle-blur** —— 从按钮位置
 *        扩散开的一圈模糊揭示，和这套电影感的视觉最合。
 * @param {"top-left"|"top-right"|"bottom-left"|"bottom-right"|"center"|"bottom-up"} [props.start]
 *        揭示的起点，按按钮在页面里的位置给（右上角的按钮就给 top-right）。
 * @param {string} [props.className]      按钮本体样式
 * @param {string} [props.iconClassName]  图标尺寸/颜色
 */
export default function ThemeToggle({
  variant = "circle-blur",
  start = "bottom-up",
  className,
  iconClassName = "h-4 w-4",
  ...rest
}) {
  const { isDark, toggle } = useThemeToggle({ variant, start });

  return (
    <button
      type="button"
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      onClick={toggle}
      className={cn("flex items-center justify-center", className)}
      {...rest}
    >
      <ActionSwapIcon value={isDark ? "dark" : "light"} className={iconClassName}>
        {isDark ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
      </ActionSwapIcon>
    </button>
  );
}
