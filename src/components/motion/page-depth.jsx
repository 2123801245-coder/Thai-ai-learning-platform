import React from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";

import { useAnimationFrames } from "@/hooks/useAnimationFrames";

/* =========================================================
   PageDepth —— 路由切换时的「景深」过渡（自带 AnimatePresence）
   ---------------------------------------------------------
   一次换页同时做两件事，画面就有了纵深：

     · 旧页面往后收：缩小一点、轻微上移、并且**失焦**；
     · 新页面从后面推上来：由小放大、并且**合焦**。

   关键约束（MainLayout 里已经为它吃过一次亏）：
   `filter: blur()` 只要写在页面容器上（哪怕静止时是 blur(0px)），
   这个容器就会成为 `position: fixed` 后代的**包含块** —— 页面里的全屏浮层
   会被锁死在容器尺寸里（实测：学习星系的"全屏"弹窗被压成 334px / 视口 390px）。
   所以模糊打在**覆盖层**上，而不是页面上：一层盖在内容上方的 backdrop-blur
   材质，只负责把身后的东西糊掉，自己不承载内容、不参与布局。这层的不透明度
   就是"焦平面"：0.82 → 0 合焦（新页面推上来），0 → 0.82 失焦（旧页面退场）。

   两层显示的是**各自那一次的页面**（这一条是整件事的关键）：
     AnimatePresence 保留的是当时的那个元素（连同它的 props），所以
     退场层渲染出来的还是旧页面 —— 前提是 props 里放的是**已经解析成
     具体页面的元素**。如果放的是 `<Outlet/>` 这种"取当前路由"的间接
     引用，退场层会在换页后跟着解析成新页面，于是"新页面淡出的同时
     新页面又淡入"，两层长得一模一样。

     children 因此支持两种写法：
       · 传节点（MainLayout 内页）：元素本身在换页时就被替换了，这里
         只在同一位置渲染它，不需要冻结；
       · 传函数 (location) => ReactNode（认证流程）：函数与它闭包里的
         页面元素一起被冻结在图层上，退场层于是拿得到旧页面 ——
         外层用 `useOutlet()` 而不是 `<Outlet/>` 拿到已解析的元素。

   两组模式：
     · mode="wait"（默认）：旧页面退场完再挂新页面，同一时刻一棵页面树 —— 应用内换页用它；
     · mode="popLayout"：新页面立刻挂载，旧页面脱流淡出 —— 登录/注册这类转化路径用它，
       总时长只有一次动画，不必"等半秒"。

   兜底：prefers-reduced-motion → 只做透明度交叉淡入淡出；环境不推进 rAF
   （内嵌 webview）→ 直接换页、不做任何动画（否则会停在模糊/卡住不换页）；
   覆盖层 pointer-events-none —— 过渡期间点击不会被吞掉。
========================================================= */

/* 时长：默认给应用内换页（沿用原有 0.28s 节奏），quick 给认证流程。 */
const PACE = {
  default: { move: 0.28, focus: 0.3 },
  quick: { move: 0.18, focus: 0.22 },
};

/* 一个过渡图层：自带焦平面，并且按「它自己的 location」渲染内容。 */
function DepthLayer({ render, location, className = "", reduce = false, move, focus, veil }) {
  /* 正在退场的那一层可能还盖在最上面（popLayout 下它脱流后位置不变），
     所以必须让它彻底不吃事件：否则过渡那一两百毫秒里点哪里都点不动 ——
     看起来就像页面卡住了。 */
  const present = useIsPresent();

  return (
    <motion.div
      aria-hidden={!present || undefined}
      className={`relative ${className} ${present ? "" : "pointer-events-none"}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.982 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
      transition={move}
    >
      {typeof render === "function" ? render(location) : render}

      {/* 焦平面：降低不透明度 = 页面从模糊里合焦 */}
      <motion.div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[60] ${
          reduce ? "" : "backdrop-blur-[6px]"
        }`}
        style={{ background: "color-mix(in srgb, #04121a 58%, transparent)" }}
        initial={{ opacity: veil }}
        animate={{ opacity: 0 }}
        exit={{ opacity: veil }}
        transition={focus}
      />
    </motion.div>
  );
}

export function PageDepth({
  children,
  className = "",
  pace = "default",
  mode = "wait",
}) {
  const frames = useAnimationFrames();
  const reduce = useReducedMotion();
  const location = useLocation();

  const speed = PACE[pace] || PACE.default;

  /** @type {import("framer-motion").Transition} */
  const move = {
    duration: reduce ? 0.16 : speed.move,
    ease: [0.22, 1, 0.36, 1],
  };
  /* 合焦比位移略快：新页面要尽快变清楚，模糊停留久了会显得拖 */
  /** @type {import("framer-motion").Transition} */
  const focus = {
    duration: reduce ? 0.16 : speed.focus,
    ease: [0.22, 1, 0.36, 1],
  };

  /* 焦平面的最浓程度：再高就会盖过页面自身的淡入，退场时也会显得脏。
     它必须永远是"暗"的（推远的阴影），不能跟着世界主题变成浅色 ——
     浅色世界里 --tp-bg 是米白，用它会把页面越推越亮，像闪光而不是纵深。 */
  const veil = reduce ? 0 : 0.82;

  /* 环境不推进动画：直接换页。宁可没有过渡，也不要停在动画中间态。 */
  if (!frames) {
    return <div className={className}>{typeof children === "function" ? children(location) : children}</div>;
  }

  const presence = /** @type {"sync" | "wait" | "popLayout"} */ (mode);

  return (
    /*
     * 这层定位容器是给 mode="popLayout" 用的：退场层会脱流成 absolute，
     * 相对自己原来的文档位置定格。若没有定位祖先，它会锚在 body 上 ——
     * 页面一滚动，旧页面就跑到视口外面去了（transition 看起来像没生效）。
     * 也正因为它只是 position: relative，不会成为 fixed 后代的包含块。
     */
    <div className="relative">
      <AnimatePresence mode={presence} initial={false}>
        <DepthLayer
          key={location.pathname}
          render={children}
          location={location}
          className={className}
          reduce={reduce}
          move={move}
          focus={focus}
          veil={veil}
        />
      </AnimatePresence>
    </div>
  );
}

export default PageDepth;
