// =========================================================
// 路由级悬停预取：鼠标悬停导航项时预下载目标页面 chunk，
// 点击进入时模块已在浏览器缓存中，实现「零等待」切页。
// 与 App.jsx 的 React.lazy 共用同一 import()，Vite 自动去重。
// =========================================================
//
// 重构说明：这张表要与 src/lib/navigation.js 的 navItems **保持同一批路径**。
// 此前它注册的是 /speaking-practice（已重定向）与 /challenges（已并入
// /ranking），而真正的一级入口 /loop、/universe、/practice、
// /culture-universe、/corpus、/alphabet、/professional 反而没有预取 —— 预取白做。

export const routePrefetch = {
  /* 今天 */
  "/": () => import("@/pages/Home"),
  "/loop": () => import("@/pages/LearnLoop"),
  "/conversation": () => import("@/pages/Conversation"),
  "/universe": () => import("@/pages/LearningUniverse"),

  /* 内容 */
  "/course": () => import("@/pages/Course"),
  "/lessons": () => import("@/pages/LessonText"),
  "/media": () => import("@/pages/MediaLearning"),
  "/culture-universe": () => import("@/pages/CultureUniverse"),
  "/corpus": () => import("@/pages/ThaiCorpus"),

  /* 更多 */
  "/vocabulary": () => import("@/pages/Vocabulary"),
  "/speaking": () => import("@/pages/SpeakingPractice"),
  "/practice": () => import("@/pages/Practice"),
  "/plan": () => import("@/pages/Plan"),
  "/alphabet": () => import("@/pages/ThaiAlphabet"),
  "/culture": () => import("@/pages/Culture"),
  "/professional": () => import("@/pages/ThaiProfessionalHub"),
  "/ranking": () => import("@/pages/Ranking"),
  "/settings": () => import("@/pages/Settings"),
  "/profile": () => import("@/pages/Profile"),

  /* 兼容路径：旧链接直接进来时也预取对应实现 */
  "/speaking-practice": () => import("@/pages/SpeakingPractice"),
  "/wrong-notebook": () => import("@/pages/WrongNotebook"),

  /*
   * 认证流程：登录 / 注册 / 忘记密码 / 重置密码。
   * 这四页不放导航（不是一级入口），但它们是**同一条连续路程** ——
   * 登录卡下面就是「注册新账号 / 忘记密码」，且四页之间有景深过渡
   * （AuthDepthLayout）。过渡再顺，分包没到就还是白屏等下载，
   * 所以这四页在进任意一页时就被备好（见 AuthDepthLayout）。
   */
  "/login": () => import("@/pages/Login"),
  "/register": () => import("@/pages/Register"),
  "/forgot-password": () => import("@/pages/ForgotPassword"),
  "/reset-password": () => import("@/pages/ResetPassword"),
};

/* 触发预取（静默失败，不打断交互） */
export function prefetchRoute(path) {
  const loader = routePrefetch[path];

  if (loader) {
    loader().catch(() => {});
  }
}

/* 已经排过队的路径不再重复排（同一个 tab 里切来切去只预取一次） */
const idleScheduled = new Set();

/**
 * 空闲预取一批路由：等当前页面自己安顿下来，再悄悄下载这些页面的分包。
 * 与 onMouseEnter 的即时预取互补 —— 触屏没有 hover，而转化路径
 * （登录 → 注册 → 找回密码）几乎是紧接着发生的，得在挂载时就把后手备好。
 *
 * 三处保守，都是为了不抢当前页面的带宽（登录页首屏自己在拉视频）：
 *   · Data Saver / 省流模式不预取；
 *   · 标签页在后台不预取；
 *   · requestIdleCallback 与 setTimeout 竞速 —— 部分内嵌 webview 的
 *     requestIdleCallback 永不回调（本项目已经为 rAF 吃过同样的亏）。
 */
export function prefetchRoutesWhenIdle(paths, { delay = 1200, timeout = 2500 } = {}) {
  if (typeof window === "undefined") return;

  /* 省流模式不预取。放在最前：否则下面会把路径标成「已处理」却什么都没取。
     connection 不在标准 lib.dom 类型里，所以显式转型后读取。 */
  const conn = /** @type {{ saveData?: boolean } | undefined} */ (
    /** @type {any} */ (navigator).connection
  );
  if (conn?.saveData) return;

  const todo = paths.filter((p) => routePrefetch[p] && !idleScheduled.has(p));
  if (!todo.length) return;
  todo.forEach((p) => idleScheduled.add(p));

  const run = () => {
    if (document.visibilityState === "hidden") {
      todo.forEach((p) => idleScheduled.delete(p));
      return;
    }
    todo.forEach(prefetchRoute);
  };

  let fired = false;
  const once = () => {
    if (fired) return;
    fired = true;
    run();
  };

  const idle = typeof window.requestIdleCallback === "function";
  if (idle) window.requestIdleCallback(once, { timeout });
  /* 竞速兜底：idle 回调不来的环境里也能按延迟预取 */
  window.setTimeout(once, delay);
}
