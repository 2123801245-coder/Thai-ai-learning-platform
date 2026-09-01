import React from "react";
import { Link, useLocation } from "react-router-dom";
import { prefetchRoute } from "@/lib/routePrefetch";
import {
  Home as HomeIcon,
  BookOpen,
  Dumbbell,
  User,
  Sparkles,
} from "lucide-react";

/* =========================================================
   移动端底部导航 · MobileTabBar
   - 5 Tab：首页 / 课程 / 练习 / AI老师 / 我的
   - AI老师按钮突出显示（居中凸起 + 墨绿渐变 + 呼吸光晕）
   - 桌面端自动隐藏，仅 md 以下显示
   - 与右下角 AI 浮动助手（AiFloatingAssistant）共存，
     浮动助手底部偏移已让出 Tab 栏高度
========================================================= */

function isActive(pathname, tabPath) {
  return (
    pathname === tabPath ||
    (tabPath !== "/" && pathname.startsWith(tabPath))
  );
}

export default function MobileTabBar() {
  const location = useLocation();

  const tabs = [
    { label: "首页", path: "/", icon: HomeIcon },
    { label: "课程", path: "/course", icon: BookOpen, vip: true },
    { label: "练习", path: "/practice", icon: Dumbbell },
  ];

  const aiTab = { label: "AI 老师", path: "/conversation", icon: Sparkles };
  const profileTab = { label: "我的", path: "/profile", icon: User };

  const aiActive = isActive(location.pathname, aiTab.path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#121e24]/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,.3)] backdrop-blur-2xl md:hidden">
      <div className="relative mx-auto flex h-[4.25rem] max-w-lg items-stretch justify-around px-1">
        {/* 左侧两个 Tab */}
        {tabs.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const active = isActive(location.pathname, tab.path);

          return (
            <Link
              key={tab.path}
              to={tab.path}
              onMouseEnter={() => prefetchRoute(tab.path)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all ${
                active
                  ? "text-emerald-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
              )}
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" />
                {tab.vip && (
                  <span className="absolute -right-3 -top-1 rounded-full border border-amber-300/25 bg-amber-400/[0.1] px-1 py-px text-[7px] font-bold text-amber-300/90">
                    VIP
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium">
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* 练习（居中偏左） */}
        {(() => {
          const tab = tabs[2];
          const Icon = tab.icon;
          const active = isActive(location.pathname, tab.path);

          return (
            <Link
              key={tab.path}
              to={tab.path}
              onMouseEnter={() => prefetchRoute(tab.path)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all ${
                active
                  ? "text-emerald-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
              )}
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" />
              </span>
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium">
                {tab.label}
              </span>
            </Link>
          );
        })()}

        {/* AI老师 —— 居中凸起主按钮 */}
        <Link
          to={aiTab.path}
          onMouseEnter={() => prefetchRoute(aiTab.path)}
          aria-label={aiTab.label}
          className="relative z-10 -mt-5 flex w-[4.75rem] shrink-0 flex-col items-center justify-start gap-0.5"
        >
          <span
            className={`relative flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-full border transition-all ${
              aiActive
                ? "border-emerald-200/70 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_6px_24px_rgba(16,185,129,0.5)]"
                : "border-emerald-300/30 bg-gradient-to-br from-[#0e241f] to-[#0a1615] shadow-xl shadow-emerald-400/15"
            }`}
          >
            {/* 呼吸光晕 */}
            <span
              className="absolute inset-0 animate-ping rounded-full bg-emerald-400/[0.14] [animation-duration:2.8s]"
              style={{ pointerEvents: "none" }}
            />
            <span
              className="absolute -inset-1 -z-10 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/10 blur-md"
              style={{ pointerEvents: "none" }}
            />
            <Sparkles
              className={`h-6 w-6 ${aiActive ? "text-white" : "text-emerald-300"}`}
            />
            {/* 在线状态点 */}
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
          </span>
          <span
            className={`max-w-full truncate text-[10px] font-bold ${
              aiActive ? "text-emerald-300" : "text-white/45"
            }`}
          >
            AI 老师
          </span>
        </Link>

        {/* 我的 */}
        {(() => {
          const Icon = profileTab.icon;
          const active = isActive(location.pathname, profileTab.path);

          return (
            <Link
              key={profileTab.path}
              to={profileTab.path}
              onMouseEnter={() => prefetchRoute(profileTab.path)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all ${
                active
                  ? "text-emerald-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
              )}
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" />
              </span>
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium">
                {profileTab.label}
              </span>
            </Link>
          );
        })()}
      </div>
    </nav>
  );
}
