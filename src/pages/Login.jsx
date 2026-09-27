import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/api/auth";
import { useAuth } from "@/lib/AuthContext";
import {
  Mail,
  Lock,
  Loader2,
  Menu,
  X,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import StarParticles from "@/components/StarParticles";
import {
  NAV_ITEMS,
  FeaturesSection,
  PricingSection,
  CommunitySection,
  LandingFooter,
} from "@/components/landing/LandingSections";
import { useWorldThemeIsolation } from "@/hooks/useWorldThemeIsolation";

/* 本地静态背景（立即渲染，作为视频加载完成前的兜底） */
const FALLBACK_BG = "/thailand-hero.jpg";

const VIDEOS = [
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4",
    label: "Chao Phraya",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4",
    label: "Emerald Bay",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4",
    label: "Northern Pines",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4",
    label: "Quiet Dawn",
  },
];

const OVERLAY_URL =
  "https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png";

/* 输入框样式合并成常量：邮箱/密码两处不再各写一份长串。
   聚焦环用品牌绿的亮色调（#7fe0bb）—— 深色卡片上 #0b7a5a 基本看不见。 */
const FIELD_CLS =
  "h-12 w-full rounded-[14px] border border-white/15 bg-white/10 pl-11 pr-4 text-[15px] text-white outline-none transition placeholder:text-white/40 focus:border-[#7fe0bb] focus:ring-2 focus:ring-[#7fe0bb]/25";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  /* 营销页自带配色与排版，挂载期间摘掉站内「视觉世界」的 CSS 重映射层
     （浅色世界会把白字转墨字、给图片加 sepia、换掉标题字体）——
     详情与副作用范围见 hook 内注释。 */
  useWorldThemeIsolation();

  /* ---- video switching ---- */
  const [activeVideo, setActiveVideo] = useState(0);
  /* 自动轮播可以被用户打断：一旦自己挑过场景就停下来，不再把控制权抢回去 */
  const [autoPlay, setAutoPlay] = useState(true);

  /* 懒加载：仅当前激活视频设置 src + preload，其余不加载，避免首屏同时下载 4 个视频 */
  const [loadedVideos, setLoadedVideos] = useState(() => [true, false, false, false]);

  /* 用户点哪个都算数：不设“过渡中拒绝输入”的门禁（被吞掉的点击看起来
     就像按钮坏了），也不在意重复点当前项 —— 停掉轮播就行。 */
  const switchVideo = useCallback((idx) => {
    setAutoPlay(false);
    setActiveVideo((v) => (idx === v ? v : idx));
  }, []);

  /* 当前视频可播放后，预加载下一段（提前下载，轮播无缝） */
  const handleVideoReady = useCallback(
    (i) => {
      const next = (i + 1) % VIDEOS.length;
      if (!loadedVideos[next]) {
        setLoadedVideos((prev) => {
          if (prev[next]) return prev;
          const copy = [...prev];
          copy[next] = true;
          return copy;
        });
      }
    },
    [loadedVideos]
  );

  /* auto-cycle every 8s（函数式更新，不受上一次渲染的闭包影响）
     标签页在后台时不推进：回来时不会一来就撞上一次换镜头。 */
  useEffect(() => {
    if (!autoPlay) return undefined;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveVideo((v) => (v + 1) % VIDEOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  /* 第 3 段是亮画面：文字与表单需要切换成深色系 */
  const lightStage = activeVideo === 2;

  /* ---- nav：首屏透明，滚过首屏后变成 Apple 式毛玻璃白条 ---- */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* 锚点平滑滚动（仅此页；卸载时还原，避免影响站内其他页面） */
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  /* ---- mobile menu ---- */
  const [menuOpen, setMenuOpen] = useState(false);

  /* ---- form ---- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data);
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "登录失败，请检查账号密码");
    } finally {
      setLoading(false);
    }
  };

  /* nav 配色：未滚动时压在视频上（白字），滚动后转浅色 */
  const navInk = scrolled ? "text-[#1d1d1f]" : "text-white";
  const navLink = scrolled
    ? "text-[#1d1d1f]/70 hover:text-[#1d1d1f]"
    : "text-white/80 hover:text-white";

  return (
    <div className="apple-ui min-h-screen bg-[#fbfbfd]">
      {/* =========================================================
          首屏：沉浸视频 + 新英文标题 + 登录卡
      ========================================================= */}
      <section className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-black">
        {/* ===== 本地静态背景兜底（秒显，避免视频加载前的黑屏等待） ===== */}
        <img
          src={FALLBACK_BG}
          alt=""
          data-no-theme-filter
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* ===== Video layer（懒加载：仅当前激活视频下载，其余不占带宽） ===== */}
        {VIDEOS.map((v, i) => {
          const isActive = i === activeVideo;
          return (
            <video
              key={i}
              src={loadedVideos[i] ? v.url : undefined}
              muted
              loop
              playsInline
              autoPlay={isActive && loadedVideos[i]}
              onCanPlay={() => handleVideoReady(i)}
              preload={isActive ? "auto" : "none"}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1000ms] ease-in-out ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
          );
        })}

        {/* ===== Star / sparkle particles ===== */}
        <StarParticles count={90} opacity={0.6} speed={0.8} />

        {/* ===== Overlay PNG（加载失败静默隐藏，不影响页面） =====
            不再做 3s 上下浮动：背景视频自己就在动，两个不同节奏叠在一起会
            显得整个画面在“抖”，静态叠图反而稳。 */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <img
            src={OVERLAY_URL}
            alt=""
            data-no-theme-filter
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-full w-full object-cover"
            style={{ transform: "scale(1.03)" }}
          />
        </div>

        {/* 文字可读性渐变：上（标题）下（登录卡）压暗，中间留亮 */}
        <div
          className={`pointer-events-none absolute inset-0 z-[1] transition-opacity duration-700 ${
            lightStage
              ? "bg-gradient-to-b from-white/25 via-white/10 to-white/30 opacity-70"
              : "bg-gradient-to-b from-black/45 via-black/25 to-black/60 opacity-100"
          }`}
        />

        {/* ---- 视频与下方浅色营销区之间做一段溶解 ----
            硬切等于把「深色影像」和「近白版面」直接拼在一起，是页面上最
            突然的一处跳变；这里让画面在最后 112px 里渐变到页面底色。 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-b from-transparent to-[#fbfbfd]" />

        {/* ===== Content layer z-2 ===== */}
        <div className="relative z-[2] flex flex-1 flex-col">
          {/* ---- Nav（Apple 式：滚动后毛玻璃白条） ---- */}
          <nav
            className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
              scrolled
                ? "border-b border-black/[0.07] bg-white/75 backdrop-blur-2xl"
                : "border-b border-transparent"
            }`}
          >
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
              {/* Logo */}
              <Link
                to="/"
                className={`flex items-center gap-2.5 transition-colors ${navInk}`}
              >
                <img
                  src="/brand/thaiai-logo-64.png"
                  alt="ThaiAI"
                  data-no-theme-filter
                  className="h-8 w-8 rounded-[9px] shadow-sm sm:h-9 sm:w-9 sm:rounded-[10px]"
                />
                <span className="text-[17px] font-semibold tracking-[-0.02em]">
                  ThaiAI
                </span>
              </Link>

              {/* Desktop nav */}
              <div className="hidden items-center gap-1 md:flex">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${navLink}`}
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  to="/register"
                  className={`ml-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                    scrolled
                      ? "bg-[#1d1d1f] text-white hover:bg-black"
                      : "bg-white text-[#1d1d1f] hover:bg-white/90"
                  }`}
                >
                  免费开始
                </Link>
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="菜单"
                className={`flex h-10 w-10 items-center justify-center rounded-full transition md:hidden ${
                  scrolled
                    ? "bg-black/[0.05] text-[#1d1d1f]"
                    : "liquid-glass text-white"
                }`}
              >
                <div className="relative h-5 w-5">
                  <Menu
                    className={`absolute inset-0 transition-all duration-300 ${
                      menuOpen
                        ? "rotate-90 scale-75 opacity-0"
                        : "rotate-0 scale-100 opacity-100"
                    }`}
                  />
                  <X
                    className={`absolute inset-0 transition-all duration-300 ${
                      menuOpen
                        ? "rotate-0 scale-100 opacity-100"
                        : "-rotate-90 scale-75 opacity-0"
                    }`}
                  />
                </div>
              </button>
            </div>
          </nav>

          {/* ---- Mobile menu overlay（Apple 式白底大字） ---- */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-2xl"
              >
                <div className="flex items-center justify-between px-5 py-3">
                  <img
                    src="/brand/thaiai-logo-64.png"
                    alt="ThaiAI"
                    data-no-theme-filter
                    className="h-8 w-8 rounded-[9px]"
                  />
                  <button
                    onClick={() => setMenuOpen(false)}
                    aria-label="关闭"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8">
                  {NAV_ITEMS.map((item, i) => (
                    <motion.a
                      key={item.label}
                      href={item.href}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.06 + i * 0.05,
                        duration: 0.4,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      onClick={() => setMenuOpen(false)}
                      className="py-1.5 text-[28px] font-semibold tracking-[-0.02em] text-[#1d1d1f]"
                    >
                      {item.label}
                    </motion.a>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.24, duration: 0.4 }}
                    className="mt-6 flex flex-col items-center gap-3"
                  >
                    <Link
                      to="/register"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-full bg-[#1d1d1f] px-8 py-3 text-[16px] font-medium text-white"
                    >
                      免费开始
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="text-[14px] text-[#6e6e73]"
                    >
                      已有账号？登录
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---- Hero content (centered) ---- */}
          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8 pt-24 text-center sm:px-8">
            {/* Badge */}
            <div className="liquid-glass mb-6 flex items-center gap-2 rounded-full px-4 py-1.5 sm:mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7fe0bb]" />
              <p
                className={`text-[12px] sm:text-[13px] ${
                  lightStage ? "text-[#182C41]/80" : "text-white/85"
                }`}
              >
                AI 泰语老师 · 今日定制课已就绪
              </p>
            </div>

            {/* Heading — 新英文标题 */}
            <h1
              className={`max-w-4xl text-[42px] font-semibold leading-[1.05] transition-colors duration-700 sm:text-[64px] md:text-[76px] lg:text-[86px] ${
                lightStage ? "text-[#182C41]" : "text-white"
              }`}
              style={{ letterSpacing: "-0.035em" }}
            >
              Say it in Thai.
              <br />
              <span
                className={`italic ${
                  lightStage
                    ? ""
                    : "bg-gradient-to-r from-[#f7e0a8] via-[#e8c26a] to-[#7fe0bb] bg-clip-text text-transparent"
                }`}
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                From day one.
              </span>
            </h1>

            {/* Subtext */}
            <p
              className={`mt-5 max-w-xl text-[14px] leading-relaxed transition-colors duration-700 sm:mt-6 sm:text-[17px] ${
                lightStage ? "text-[#182C41]/70" : "text-white/75"
              }`}
            >
              5,000+ 词汇、声调发音、真实语料与 AI 对话陪练。
              <br className="hidden sm:block" />
              每天 10 分钟，把泰语练成真的说得出口。
            </p>

            {/* Login card — 一块固定的「烟熏玻璃」卡片
                表单控件不跟随背景视频换皮：同一个输入框在你手刚搭上键盘时
                突然从白底黑字变成黑底白字，是整页最刺眼的一处不协调；
                固定下来之后每一段视频下也都有稳定可读性。
                聚焦输入框即意味着人在打字，自动轮播到此为止。 */}
            <div
              onFocusCapture={() => setAutoPlay(false)}
              className="mt-8 w-full max-w-[400px] rounded-[26px] border border-white/[0.14] bg-black/55 p-6 text-left backdrop-blur-2xl sm:mt-9 sm:p-7"
              style={{
                boxShadow:
                  "0 18px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-white">
                登录 ThaiAI
              </h2>
              <p className="mt-1 text-[13px] text-white/55">
                用邮箱继续你的学习进度
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    placeholder="邮箱地址"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={FIELD_CLS}
                  />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="password"
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={FIELD_CLS}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] bg-white text-[15px] font-medium text-[#1d1d1f] transition hover:bg-white/90 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      登录
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-[13px] text-red-300"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-[13px]">
                <Link
                  to="/register"
                  className="font-medium text-[#7fe0bb] transition hover:text-[#a8ecd1]"
                >
                  注册新账号
                </Link>
                <Link
                  to="/forgot-password"
                  className="text-white/55 transition hover:text-white"
                >
                  忘记密码
                </Link>
              </div>
            </div>

            {/* Video switcher */}
            <div className="mt-7 flex items-center gap-3 sm:mt-8 sm:gap-4">
              {VIDEOS.map((v, i) => (
                <button
                  key={i}
                  onClick={() => switchVideo(i)}
                  className={`pb-1 text-[11px] transition-all duration-300 sm:text-[13px] ${
                    i === activeVideo
                      ? `border-b font-medium ${
                          lightStage
                            ? "border-[#182C41] text-[#182C41]"
                            : "border-white text-white"
                        }`
                      : `border-b border-transparent ${
                          lightStage
                            ? "text-[#182C41]/50 hover:text-[#182C41]/80"
                            : "text-white/50 hover:text-white/80"
                        }`
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- 首屏底部：向下滚动提示（上提到溶解段之上，才不会被冲淡） ---- */}
          <div className="flex justify-center pb-24">
            <a
              href="#features"
              className={`flex flex-col items-center gap-1 text-[11px] transition ${
                lightStage
                  ? "text-[#182C41]/55 hover:text-[#182C41]"
                  : "text-white/55 hover:text-white"
              }`}
            >
              查看功能
              <ChevronDown className="animate-hero-cue h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================
          营销区：Features / Pricing / Community / Footer
      ========================================================= */}
      <FeaturesSection />
      <PricingSection />
      <CommunitySection />
      <LandingFooter />
    </div>
  );
}
