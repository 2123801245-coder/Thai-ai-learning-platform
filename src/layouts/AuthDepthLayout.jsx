import React, { useEffect } from "react";
import { useOutlet } from "react-router-dom";

import PageDepth from "@/components/motion/page-depth";
import { prefetchRoute, prefetchRoutesWhenIdle } from "@/lib/routePrefetch";

/* 这四页的路径（也都是 routePrefetch 表里的键） */
const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/* =========================================================
   认证流程外壳（登录 / 注册 / 忘记密码 / 重置密码）
   ---------------------------------------------------------
   这几页不在 MainLayout 里（它们是全屏营销页），所以自己带一层
   路由级景深过渡，让“登录 → 注册 → 找回密码”之间也是连续的换页，
   而不是硬切。

   和 MainLayout 里那条过渡的两点不同，都是为了不拖慢转化路径：

     · mode="popLayout"：新页面**立刻挂载**并开始淡入/合焦，旧页面
       脱流后自己淡出 —— 不必等旧页面退完场，整段只有一次动画的时长。
     · pace="quick"：退场 0.18s / 合焦 0.22s（应用内是 0.28 / 0.3）。

   ⚠️ 为什么不是直接写 `<Outlet/>`：
   Outlet 是"取当前路由"的间接引用，路由一跳它就跟着解析成新页面 ——
   退场层会变成"新页面淡出的同时新页面又淡入"，两层一模一样。
   useOutlet() 拿到的是**已解析的具体页面元素**，而 AnimatePresence 保留
   的是当时的那个元素（连同它的 props），所以每一层渲染的都是它自己
   那一次 location 的页面：退场层显示旧页面，进场层显示新页面。
   顺带的好处是同一个页面组件实例不重建（不重跑挂载副作用、视频不重载）。

   兜底由 PageDepth 提供：prefers-reduced-motion 时只交叉淡入淡出；
   环境不推进 rAF 时（内嵌 webview）直接换页，不做任何动画。

   分包预取也挂在这里：四页都是懒加载的，过渡再顺，分包没到就还是白屏。
   进任意一页时就把其余几页备好（空闲时），指针落到链接上时再补一手
   —— 点击往往比空闲预取早，这一手是给「手快」的用户兜底的。
========================================================= */

export default function AuthDepthLayout() {
  /* 当前 location 对应的页面元素（具体元素，不再是 Outlet 这层间接引用） */
  const outlet = useOutlet();

  useEffect(() => {
    /* 空闲预取：登录页首屏自己还在拉视频，所以让它先安顿下来再下这四页的分包 */
    prefetchRoutesWhenIdle(AUTH_PATHS);

    /*
     * 指针落到某个认证链接上就先下它那一页（触屏在 pointerover 时也会触发）。
     * 用事件委托而不是给每个 <Link> 挂 onMouseEnter：四页里的交叉链接
     * （登录卡下方的「注册新账号 / 忘记密码」、注册页的「立即登录」…）
     * 分散在各页源码里，挂在一处就不会漏。
     */
    const onPointerOver = (e) => {
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!el) return;
      const path = el.pathname;
      if (AUTH_PATHS.includes(path)) prefetchRoute(path);
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    return () => document.removeEventListener("pointerover", onPointerOver);
  }, []);

  return (
    <PageDepth mode="popLayout" pace="quick">
      {/* 每层渲染"它自己被创建时"的那个元素：退场层因此是旧页面 */}
      {() => outlet}
    </PageDepth>
  );
}
