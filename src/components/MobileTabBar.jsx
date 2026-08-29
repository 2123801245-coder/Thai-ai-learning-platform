import React from "react";
import { Link, useLocation } from "react-router-dom";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlag } from "@/lib/features";
import {
  Home as HomeIcon,
  BookOpen,
  BookOpenText,
  Languages,
  Mic,
  MessageCircle,
  User,
} from "lucide-react";

/* =========================================================
   移动端底部导航
   （桌面端自动隐藏，仅 md 以下显示）
========================================================= */

export default function MobileTabBar() {
  const location = useLocation();
  const aiTeacher = useFeatureFlag("aiTeacher");

  const tabs = [
    { label: "首页", path: "/", icon: HomeIcon },
    { label: "课程", path: "/course", icon: BookOpen },
    { label: "课文", path: "/lessons", icon: BookOpenText },
    { label: "词汇", path: "/vocabulary", icon: Languages },
    { label: "语料", path: "/corpus", icon: BookOpenText },
    { label: "口语", path: "/speaking", icon: Mic },
    ...(aiTeacher
      ? [{ label: "对话", path: "/conversation", icon: MessageCircle }]
      : []),
    { label: "我的", path: "/profile", icon: User },
  ];


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#121e24]/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,.3)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto flex h-[4.25rem] max-w-lg items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          const active =
            location.pathname === tab.path ||
            (tab.path !== "/" &&
              location.pathname.startsWith(tab.path));

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

                {(tab.label === "口语" || tab.label === "课文") && (                    <span className="absolute -right-3 -top-1 rounded-full border border-emerald-300/25 bg-emerald-400/[0.1] px-1 py-px text-[7px] font-bold text-emerald-400/90">
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
      </div>
    </nav>
  );
}
