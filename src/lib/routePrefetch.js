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
};

/* 触发预取（静默失败，不打断交互） */
export function prefetchRoute(path) {
  const loader = routePrefetch[path];

  if (loader) {
    loader().catch(() => {});
  }
}
