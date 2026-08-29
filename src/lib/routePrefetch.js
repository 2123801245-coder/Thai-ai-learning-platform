// =========================================================
// 路由级悬停预取：鼠标悬停导航项时预下载目标页面 chunk，
// 点击进入时模块已在浏览器缓存中，实现「零等待」切页。
// 与 App.jsx 的 React.lazy 共用同一 import()，Vite 自动去重。
// =========================================================

export const routePrefetch = {
  "/": () => import("@/pages/Home"),
  "/course": () => import("@/pages/Course"),
  "/speaking": () => import("@/pages/SpeakingPractice"),
  "/speaking-practice": () =>
    import("@/pages/SpeakingPractice"),
  "/lessons": () => import("@/pages/LessonText"),
  "/vocabulary": () => import("@/pages/Vocabulary"),
  "/conversation": () => import("@/pages/Conversation"),
  "/plan": () => import("@/pages/Plan"),
  "/ranking": () => import("@/pages/Ranking"),
  "/settings": () => import("@/pages/Settings"),
  "/profile": () => import("@/pages/Profile"),
  "/challenges": () => import("@/pages/Challenges"),
  "/wrong-notebook": () => import("@/pages/WrongNotebook"),
};

/* 触发预取（静默失败，不打断交互） */
export function prefetchRoute(path) {
  const loader = routePrefetch[path];

  if (loader) {
    loader().catch(() => {});
  }
}
