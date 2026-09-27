// src/components/PrimaryNav.jsx
//
// =========================================================
// 桌面端顶部一级导航
// ---------------------------------------------------------
// 只有六个入口：首页 / 学习 / AI 老师 / 练习 / 探索 / 我的。
// 其余功能不再各占一个一级入口 —— 侧边栏分组与页内二级导航承载它们，
// 这正是「左侧栏不要直接放十几个页面」那一条的落地处。
//
// 三件事都不在这里定义：
//   入口是什么、叫什么、指向哪  → src/lib/navigation.js 的 primaryNav()
//   现在该高亮哪一项            → sectionOf()：按 parent 链爬到根，二级页面
//                                 高亮它所属的一级入口（与面包屑同一条链）
//   条体与选中块的颜色          → src/themes/theme.css 的 --gv-*
// 这里只把三者接起来，顺带在悬停时预取目标路由。
// =========================================================

import { useLocation } from "react-router-dom";

import { GooeyNav } from "@/components/ui/gooey-nav";
import { primaryNav, sectionOf } from "@/lib/navigation";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlags } from "@/lib/features";
import { useIsWide } from "@/hooks/use-mobile";

export default function PrimaryNav() {
  const location = useLocation();
  const isWide = useIsWide();
  const flags = useFeatureFlags(["aiTeacher"]);

  const entries = primaryNav((name) => Boolean(flags[name]));
  const section = sectionOf(location.pathname, location.search);

  /*
   * 二级页面高亮它所属的一级入口（/vocabulary → 练习，/lessons/x → 学习），
   * 与面包屑第一段同源。
   * 不属于任何入口的路径（入学测试、未匹配地址）：-1，整条保持完整、不假装高亮。
   */
  const active = entries.findIndex((entry) => entry.id === section?.id);

  return (
    <GooeyNav
      aria-label="一级导航"
      items={entries.map(({ id, name, short, path, icon: Icon }) => ({
        label: short || name,
        to: path,
        icon: <Icon aria-hidden="true" data-icon={id} />,
      }))}
      value={active}
      /* 侧栏 240px 之后，768~1023 的窗口只剩四百来像素，xs 档才放得下六个入口 */
      size={isWide ? "sm" : "xs"}
      onItemHover={(index) => prefetchRoute(entries[index].path)}
    />
  );
}
