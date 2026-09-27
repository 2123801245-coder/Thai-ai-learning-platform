import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import PrimaryNav from "@/components/PrimaryNav";
import Breadcrumb, { PageTrailProvider } from "@/components/common/Breadcrumb";
import { ThaiPatternBand } from "@/components/common/ThaiMotifs";
import { MouseGlow } from "@/components/common/ThaiDecor";
import ThemeToggle from "@/components/motion/theme-toggle";
import PageDepth from "@/components/motion/page-depth";
import AiFloatingAssistant from "@/components/ai/AiFloatingAssistant";
import { useAuth } from "@/lib/AuthContext";
import { ensureProfileHydrated, hasProfile } from "@/lib/userProfile";
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
const PLACEMENT_ROUTE = "/placement-test";

export default function MainLayout({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  /*
   * 引导结束 → 直接进入入学测试。
   * 新人注册后本来就走 /placement-test（Register 跳的），但登录进来的用户
   * 停在首页，测试只剩一张小卡片，定级画像就一直是空的 —— 星图、路线、
   * 推荐全都因此退化成「未测」状态。所以「引导结束」这个一次性时点用来补这一跳。
   *
   * 先水合一次后端画像再判断：换设备 / 清了浏览器缓存的用户本机没有画像，
   * 但账号里有，不该被再抓去测一遍。测过的人（或后端有画像的人）原地不动。
   */
  const completeOnboarding = async () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setShowOnboarding(false);

    if (hasProfile()) return;

    /* 引导里点功能卡会自己跳走（goFeature → navigate），已经跳了就别再拽回来 */
    const from = location.pathname;

    try {
      await ensureProfileHydrated();
    } catch {
      // 后端不可达就用本机缓存判断
    }

    if (hasProfile() || window.location.pathname !== from) return;

    navigate(PLACEMENT_ROUTE, { replace: true });
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

      {/* AI 浮动老师助手（全站） */}
      <AiFloatingAssistant />

      {/* 移动端顶部品牌栏 */}
      <header className="safe-area-top fixed left-0 right-0 top-0 z-40 border-b border-white/[0.08] backdrop-blur-2xl md:hidden" style={{ background: 'color-mix(in srgb, var(--tp-bg, #0f1a1e) 72%, transparent)' }}>
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* 品牌 Logo：App 图标版（与侧栏同图） */}
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-emerald-300/25 shadow-lg shadow-emerald-400/15">
              <img
                src="/brand/thaiai-logo-512.png"
                alt="ThaiAI"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 leading-none">
              <div className="truncate text-sm font-black tracking-tight text-white font-viaoda">ThaiAI</div>
              <div className="mt-1 truncate text-[9px] tracking-[0.16em] text-emerald-300/55">泰语学习空间</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 手机顶栏右上角：揭示从这颗按钮扩散 */}
            <ThemeToggle
              start="top-right"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-2 transition hover:border-emerald-300/30 hover:bg-white/[0.08]"
              iconClassName="h-3.5 w-3.5 text-emerald-300/80"
            />
            <div className="hidden rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-300/75 sm:block">
              เรียนทุกวัน
            </div>
          </div>
        </div>
      </header>

      {/* 内容区 */}

      <main className="relative z-10 min-h-screen w-full md:ml-[240px] md:w-[calc(100%-240px)]">
        {/* 顶部泰式纹样带 */}
        <ThaiPatternBand
          className="absolute left-0 top-0"
          opacity={0.1}
          height={14}
        />

        {/*
         * 桌面顶部一级导航（只有六个入口，其余功能在侧栏与页内二级导航）。
         * 它占的是文档流里的位置而不是浮在内容之上：内容自己往下让，
         * 不用每个页面各自再加一段 padding。滚动时吸顶，内容从它下面穿过。
         */}
        <div
          className="sticky top-0 z-40 hidden justify-center px-4 py-3 backdrop-blur-xl md:flex lg:px-6"
          style={{
            background: "color-mix(in srgb, var(--tp-bg, #0f1a1e) 78%, transparent)",
            borderBottom: "1px solid var(--tp-hairline, rgba(255, 255, 255, 0.1))",
          }}
        >
          <PrimaryNav />
        </div>

        <div className="min-h-screen w-full px-3.5 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] sm:px-6 md:pb-6 md:pt-9 lg:px-8 page-shell page-flow">
          {/*
           * 路由级过渡：淡入淡出 + 缩放位移（景深），实现在 PageDepth 里。
           * ---------------------------------------------------------
           * 这里**仍然不能**用 filter blur：只要元素身上存在非 none 的 filter
           * （包括静止时的 blur(0px)），它就会成为 `position: fixed` 后代的
           * **包含块** —— 页面里所有全屏浮层都会被锁在这个容器里。
           * 实测：学习星系在手机上的"全屏"详情弹窗被压成 334px（视口 390px），
           * 看起来像"弹窗比屏幕窄"。
           *
           * 所以失焦/合焦的模糊没有打在页面上，而是打在 PageDepth 内部的
           * 一层 `backdrop-blur` 覆盖层上：它只把身后的内容糊掉，自己不承载
           * 内容、不参与布局，也就不影响任何 fixed 后代。
           */}

          {/*
           * 页面层级面包屑 —— 一级页面上它自己隐藏（只有一段时没有层级可说）。
           * Provider 同时罩着面包屑与页面：页面用 usePageTrail 交上来的
           * 「课程名 / 课文名」这类只有它自己知道的层级，落在同一条链的尾部。
           */}
          <PageTrailProvider>
            <Breadcrumb />

            {/* PageDepth 自带 AnimatePresence 与 rAF 探测，过渡用 mode="wait" */}
            <PageDepth mode="wait">{children}</PageDepth>
          </PageTrailProvider>
        </div>
      </main>
    </div>
  );
}
