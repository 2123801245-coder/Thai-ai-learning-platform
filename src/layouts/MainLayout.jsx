import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate, useLocation } from "react-router-dom";

import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { ThaiPatternBand } from "@/components/common/ThaiMotifs";
import { MouseGlow } from "@/components/common/ThaiDecor";
import ThemeQuickSwitcher from "@/components/theme/ThemeQuickSwitcher";
import { useAuth } from "@/lib/AuthContext";
import OnboardingGuide from "@/components/OnboardingGuide";

const SITE_BG_NIGHT = '/site-bg-night.jpg';
const SITE_BG_COAST = '/site-bg-coast.jpg';

/* =========================================================
   MainLayout
   - 桌面端：左侧 Sidebar
   - 移动端：底部 MobileTabBar
   - 所有主页面路由统一鉴权：未登录跳转 /login
========================================================= */

const ONBOARDING_KEY = "thaiai_onboarding_completed";

export default function MainLayout({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  /* =====================================================
     用户引导：新用户首次登录后展示功能介绍
  ===================================================== */
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return false;
    }
  });

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  };



  /* 正在检查登录状态（避免登录页闪烁） */

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: 'var(--tp-bg, #0f1a1e)' }}>
        <div className="text-center">
          <div className="text-3xl font-black">
            <span className="bg-gradient-to-r from-emerald-400 via-white to-emerald-400 bg-clip-text text-transparent font-viaoda">
              ThaiAI
            </span>
          </div>

          <p className="mt-3 text-sm text-white/40">
            正在加载你的学习空间...
          </p>            <div className="mx-auto mt-5 h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  /* 未登录 → 登录页 */

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /* 引导结束后淡出 */
  if (showOnboarding) {
    return (
      <AnimatePresence>
        <OnboardingGuide onComplete={completeOnboarding} />
      </AnimatePresence>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--tp-bg, #0f1a1e)' }}>
      {/* === 全站背景层 === */}
      <div className="theme-site-backdrop pointer-events-none fixed inset-0 overflow-hidden" style={{ background: 'var(--tp-bg, #0f1a1e)' }}>
        {/* 寺庙夜景 */}
        <img src={SITE_BG_NIGHT} alt="" aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover site-bg-a" />
        {/* 海岸星空 */}
        <img src={SITE_BG_COAST} alt="" aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover site-bg-b" />
        {/* 暗色渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1a1e]/40 via-[#0f1a1e]/15 to-[#0f1a1e]/50" />
      </div>

      {/* 统一前景装饰：细微网格、金色光线与主题文案 */}
      <div className="thai-ambient-foreground pointer-events-none fixed inset-0 z-[6]" aria-hidden="true">
        <div className="thai-grid absolute inset-0 opacity-20" />
        <div className="thai-gold-line absolute left-[8%] right-[8%] top-20" />
      </div>

      {/* 鼠标跟随光晕 */}
      <MouseGlow />

      {/* 细微噪点层 */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-[5]" />

      {/* 侧边栏 */}
      <Sidebar />

      <MobileTabBar />

      {/* 移动端顶部品牌栏 */}
      <header className="safe-area-top fixed left-0 right-0 top-0 z-40 border-b border-white/[0.08] backdrop-blur-2xl md:hidden" style={{ background: 'color-mix(in srgb, var(--tp-bg, #0f1a1e) 72%, transparent)' }}>
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/20 via-emerald-600/10 to-[#050A14] shadow-lg shadow-emerald-400/10">
              <span className="relative text-xs font-black text-white/90">ไทย</span>
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(200,145,74,0.9)]" />
            </div>
            <div className="min-w-0 leading-none">
              <div className="truncate text-sm font-black tracking-tight text-white font-viaoda">ThaiAI</div>
              <div className="mt-1 truncate text-[9px] tracking-[0.16em] text-emerald-300/55">泰语学习空间</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeQuickSwitcher compact />
            <div className="hidden rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-300/75 sm:block">
              เรียนทุกวัน
            </div>
          </div>
        </div>
      </header>

      {/* 内容区 */}

      <main className="relative z-10 min-h-screen w-full md:ml-[220px] md:w-[calc(100%-220px)]">
        {/* 顶部泰式纹样带 */}
        <ThaiPatternBand
          className="absolute left-0 top-0"
          opacity={0.1}
          height={14}
        /        >

        <div className="min-h-screen w-full px-3.5 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] sm:px-6 md:pb-6 md:pt-9 lg:px-8 page-shell page-flow">
          {/* 页面入场动画（fade + slide，路由级过渡） */}

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
