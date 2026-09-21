import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlags } from "@/lib/features";
import { mobileTabs, findNavItem, MOBILE_TAB_LIMIT } from "@/lib/navigation";

/* =========================================================
   移动端底部导航 · MobileTabBar
   ---------------------------------------------------------
   菜单不再是本地数组，而是 src/lib/navigation.js 里的 navItems
   中标记了 `tabs: true` 的项——与桌面侧边栏**同一份数据**。

   重构前：底部栏写死 首页/课程/练习/AI老师/我的，侧边栏写死另外
   16 项，Navbar 又写死 8 项；同一个人在三端看到三种结构。
   现在三端只允许在「取舍」上不同（底部栏放不下就少放几个），
   不允许在「同一功能叫什么、指向哪」上不同。

   布局：AI 对话室作为中间凸起主按钮（唯一主行动），其余 Tab 平铺，
   数量由数据决定，不写死索引。
========================================================= */

export default function MobileTabBar() {
  const location = useLocation();
  const flags = useFeatureFlags(["aiTeacher"]);
  const isFlagOn = (name) => Boolean(flags[name]);

  const tabs = mobileTabs(isFlagOn).slice(0, MOBILE_TAB_LIMIT);
  const primary = tabs.find((item) => item.id === "conversation") || null;
  const rest = tabs.filter((item) => item.id !== primary?.id);

  /* 主按钮两侧各放一半，视觉上落在中间 */
  const primarySlot = primary ? Math.ceil(rest.length / 2) : -1;

  /* 当前页归属哪一项：用统一的 findNavItem，避免各页自己 startsWith 判断 */
  const current = findNavItem(location.pathname, location.search);

  return (
    <nav
      className="apple-mobile-tabbar fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#121e24]/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,.3)] backdrop-blur-2xl md:hidden"
      aria-label="主导航"
    >
      <div className="relative mx-auto flex h-[4.25rem] max-w-lg items-stretch justify-around px-1">
        {rest.map((tab, index) => {
          const Icon = tab.icon;
          const active = current?.id === tab.id;

          return (
            <React.Fragment key={tab.id}>
              <Link
                to={tab.path}
                onMouseEnter={() => prefetchRoute(tab.path)}
                aria-current={active ? "page" : undefined}
                className={`apple-tab-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all ${
                  active ? "text-emerald-400" : "text-white/40 hover:text-white/70"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                )}
                <span className="relative">
                  <Icon className="h-[19px] w-[19px]" />
                  {tab.badge === "vip" && (
                    <span className="absolute -right-3 -top-1 rounded-full border border-amber-300/25 bg-amber-400/[0.1] px-1 py-px text-[7px] font-bold text-amber-300/90">
                      VIP
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5 text-[10px] font-medium">
                  {tab.name}
                </span>
              </Link>

              {/* AI 主按钮落在视觉中间：左半 Tab 渲染完后插入 */}
              {primary && index === primarySlot - 1 ? (
                <PrimaryTab item={primary} active={current?.id === primary.id} />
              ) : null}
            </React.Fragment>
          );
        })}

        {/* 兜底：没有其他 Tab 时主按钮也不能消失 */}
        {primary && rest.length === 0 ? (
          <PrimaryTab item={primary} active />
        ) : null}
      </div>
    </nav>
  );
}

/* 中间凸起的唯一主行动 */
function PrimaryTab({ item, active }) {
  return (
    <Link
      to={item.path}
      onMouseEnter={() => prefetchRoute(item.path)}
      aria-label={item.name}
      aria-current={active ? "page" : undefined}
      className="apple-ai-tab relative z-10 -mt-5 flex w-[4.75rem] shrink-0 flex-col items-center justify-start gap-0.5"
    >
      <span
        className={`relative flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-full border transition-all ${
          active
            ? "border-emerald-200/70 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_6px_24px_rgba(16,185,129,0.5)]"
            : "border-emerald-300/30 bg-gradient-to-br from-[#0e241f] to-[#0a1615] shadow-xl shadow-emerald-400/15"
        }`}
      >
        <span
          className="absolute inset-0 animate-ping rounded-full bg-emerald-400/[0.14] [animation-duration:2.8s]"
          style={{ pointerEvents: "none" }}
        />
        <span
          className="absolute -inset-1 -z-10 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/10 blur-md"
          style={{ pointerEvents: "none" }}
        />
        <Sparkles className={`h-6 w-6 ${active ? "text-white" : "text-emerald-300"}`} />
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
      </span>
      <span
        className={`max-w-full truncate text-[10px] font-bold ${
          active ? "text-emerald-300" : "text-white/45"
        }`}
      >
        {item.name}
      </span>
    </Link>
  );
}
