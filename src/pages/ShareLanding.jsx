import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useWorldThemeIsolation } from "@/hooks/useWorldThemeIsolation";
import {
  FeaturesSection,
  PricingSection,
  CommunitySection,
  LandingFooter,
} from "@/components/landing/LandingSections";

/* 视觉与登录页同一套：Apple 官网观感（系统字体 + 紧字距 + 大留白） */
const INK = "#1d1d1f";
const INK_SOFT = "#6e6e73";
const GREEN = "#0b7a5a";

/* 分享链接会带上分享者的上下文（情景名 / 学了几个词 / 完成轮次 / 昵称）。
   query 是外部输入 —— 只当作纯文本渲染，并截断长度，避免有人塞一整篇进来。 */
function useSharedContext() {
  const [params] = useSearchParams();
  return useMemo(() => {
    const clean = (key, max = 24) => {
      const value = (params.get(key) || "").trim();
      return value ? value.slice(0, max) : "";
    };
    return {
      scene: clean("scene", 20),
      from: clean("from", 16),
      vocab: clean("vocab", 6),
      stages: clean("stages", 6),
    };
  }, [params]);
}

export default function ShareLanding() {
  /* 落地页自带配色与排版，不该被站内「视觉世界」重映射（详见 hook 注释） */
  useWorldThemeIsolation();

  const { scene, from, vocab, stages } = useSharedContext();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  /* 登录与否只影响按钮文案：落地页对两种人都是「接下来去哪」 */
  const primary = isAuthenticated
    ? { to: "/", label: "继续学习" }
    : { to: "/register", label: "免费开始" };

  const stats = [
    vocab && { value: vocab, label: "个词汇" },
    stages && { value: stages, label: "轮对话" },
  ].filter(Boolean);

  return (
    <div className="apple-ui min-h-screen bg-[#fbfbfd]">
      {/* ---- 顶栏：固定毛玻璃，与登录页滚动后的导航同一手法 ---- */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/brand/thaiai-logo-64.png"
              alt="ThaiAI"
              data-no-theme-filter
              className="h-8 w-8 rounded-[9px] shadow-sm"
            />
            <span
              className="text-[17px] font-semibold tracking-[-0.02em]"
              style={{ color: INK }}
            >
              ThaiAI
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="rounded-full px-3.5 py-1.5 text-[13px] transition hover:bg-black/[0.04]"
                style={{ color: INK_SOFT }}
              >
                登录
              </Link>
            )}
            <Link
              to={primary.to}
              className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-black"
            >
              {isLoadingAuth ? "…" : primary.label}
            </Link>
          </div>
        </div>
      </header>

      {/* ---- 首屏：把「谁分享了什么」讲清楚，然后给一个出口 ---- */}
      <section className="px-6 pb-16 pt-14 sm:pb-20 sm:pt-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <Sparkles className="h-3.5 w-3.5" style={{ color: GREEN }} />
            <span className="text-[12px] sm:text-[13px]" style={{ color: INK_SOFT }}>
              {from ? `${from} 分享给你的` : "来自朋友的分享"}
            </span>
          </div>

          <h1
            className="mt-7 text-[34px] font-semibold leading-[1.1] sm:text-[52px] lg:text-[62px]"
            style={{ color: INK, letterSpacing: "-0.03em" }}
          >
            {scene ? `有人在 ThaiAI 练了「${scene}」` : "一个每天陪你开口的 AI 泰语老师"}
            <br />
            <span
              className="italic"
              style={{
                fontFamily: "'Instrument Serif', serif",
                backgroundImage: "linear-gradient(90deg, #e8c26a, #0b7a5a)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Now it&apos;s your turn.
            </span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: INK_SOFT }}
          >
            AI 对话陪练、逐句纠音与今日定制课都在同一个入口，
            注册即可免费开始，先测水平再排第一节课。
          </p>

          {stats.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-[30px] font-semibold leading-none tracking-[-0.03em] sm:text-[38px]"
                    style={{ color: INK }}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[13px]" style={{ color: INK_SOFT }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primary.to}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1d1d1f] px-7 text-[16px] font-medium text-white transition hover:bg-black"
            >
              {isLoadingAuth ? "读取进度…" : primary.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="inline-flex h-12 items-center rounded-full px-6 text-[15px] transition hover:bg-black/[0.04]"
                style={{ color: INK }}
              >
                已有账号？登录
              </Link>
            )}
          </div>
        </div>
      </section>

      <FeaturesSection />
      <PricingSection />
      <CommunitySection />
      <LandingFooter />
    </div>
  );
}
