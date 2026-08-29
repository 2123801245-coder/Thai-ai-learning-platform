import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import StarParticles from "@/components/StarParticles";

/* ─── Thai temple SVG silhouette ─── */
function ThaiTempleSVG({ className = "", style = {} }) {
  return (
    <svg
      viewBox="0 0 400 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Central spire (chedi) */}
      <path
        d="M200 10 L195 30 L190 50 L185 80 L180 110 L175 140 L170 170 L160 210 L150 250 L140 290 L130 330 L120 370 L110 410 L100 450 L90 480 L310 480 L300 450 L290 410 L280 370 L270 330 L260 290 L250 250 L240 210 L230 170 L225 140 L220 110 L215 80 L210 50 L205 30 Z"
        fill="url(#templeGrad)"
        opacity="0.3"
      />
      {/* Upper spire detail */}
      <path
        d="M200 10 L197 25 L194 40 L191 55 L200 45 L209 55 L206 40 L203 25 Z"
        fill="url(#templeGrad)"
        opacity="0.5"
      />
      {/* Left wing temple */}
      <path
        d="M90 480 L80 440 L75 400 L85 370 L95 350 L110 330 L130 330 L140 350 L145 370 L150 400 L155 440 L160 480 Z"
        fill="url(#templeGrad)"
        opacity="0.2"
      />
      {/* Right wing temple */}
      <path
        d="M310 480 L320 440 L325 400 L315 370 L305 350 L290 330 L270 330 L260 350 L255 370 L250 400 L245 440 L240 480 Z"
        fill="url(#templeGrad)"
        opacity="0.2"
      />
      {/* Horizontal tier lines */}
      <line x1="130" y1="330" x2="270" y2="330" stroke="url(#templeGrad)" strokeWidth="1" opacity="0.3" />
      <line x1="110" y1="410" x2="290" y2="410" stroke="url(#templeGrad)" strokeWidth="1" opacity="0.2" />
      <line x1="100" y1="450" x2="300" y2="450" stroke="url(#templeGrad)" strokeWidth="1" opacity="0.15" />
      {/* Lotus top ornament */}
      <circle cx="200" cy="8" r="4" fill="#d4a574" opacity="0.6" />
      <path
        d="M196 12 Q200 6 204 12"
        stroke="#d4a574"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <defs>
        <linearGradient id="templeGrad" x1="200" y1="0" x2="200" y2="480">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="50%" stopColor="#c8956a" />
          <stop offset="100%" stopColor="#8b6544" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Lotus SVG ─── */
function LotusSVG({ className = "" }) {
  return (
    <svg viewBox="0 0 120 80" fill="none" className={className}>
      <path d="M60 10 Q55 30 40 50 Q50 45 60 40 Q70 45 80 50 Q65 30 60 10Z" fill="#d4a574" opacity="0.4" />
      <path d="M60 10 Q45 35 25 55 Q40 48 60 38 Q48 32 60 10Z" fill="#d4a574" opacity="0.25" />
      <path d="M60 10 Q75 35 95 55 Q80 48 60 38 Q72 32 60 10Z" fill="#d4a574" opacity="0.25" />
      <path d="M60 10 Q35 40 15 60 Q35 50 60 36 Q42 30 60 10Z" fill="#d4a574" opacity="0.15" />
      <path d="M60 10 Q85 40 105 60 Q85 50 60 36 Q78 30 60 10Z" fill="#d4a574" opacity="0.15" />
    </svg>
  );
}

/* ─── Stats data ─── */
const STATS = [
  { title: "泰语词汇", value: "5,300+", footer: "本地化精准词条", details: ["覆盖日常/商务/旅行/文化", "每词含泰文/读音/中文释义", "自然例句辅助记忆"] },
  { title: "词书数量", value: "18", footer: "按场景分类词书", details: ["基础泰语 · 日常对话", "商务泰语 · 文化礼仪", "旅行泰语 · 校园泰语"] },
  { title: "测验模式", value: "3", footer: "多维度学习验证", details: ["泰翻中选择题", "中文翻泰拼写练习", "发音听写 + 拼写"] },
  { title: "AI 对话", value: "24/7", footer: "随时练习泰语口语", details: ["模拟真实场景对话", "AI 实时纠正发音", "渐进式难度提升"] },
  { title: "学习进度", value: "∞", footer: "无限制持续学习", details: ["错题本自动收录", "掌握度追踪", "个性化复习推荐"] },
  { title: "难度分级", value: "3", footer: "初级 · 中级 · 高级", details: ["按记忆难度自动分级", "测验可筛选难度", "循序渐进学习路径"] },
];

/* ─── Main Component ─── */
export default function ThaiLanding() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [entered, setEntered] = useState(false);
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const targetRef = useRef(0);

  const isDark = scrollProgress < 0.15;

  /* ─── Scroll tracking ─── */
  useEffect(() => {
    function onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      targetRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Animation loop ─── */
  useEffect(() => {
    const video = videoRef.current;
    let start = performance.now();

    function tick(now) {
      /* smooth scroll */
      setSmoothProgress((prev) => {
        const diff = targetRef.current - prev;
        if (Math.abs(diff) < 0.0001) return targetRef.current;
        return prev + diff * 0.1;
      });

      /* video blur + scale */
      if (video && video.readyState >= 1) {
        const p = targetRef.current;
        const blur = p < 0.5 ? p * 10 : 5 + (p - 0.5) * 50;
        const scale = 1.03 + p * 0.08;
        video.style.filter = `blur(${blur}px)`;
        video.style.transform = `scale(${scale})`;

        /* seek video to scroll progress */
        if (video.duration > 0) {
          const target = Math.max(0, Math.min(video.duration * 0.95, p * video.duration));
          if (Math.abs(video.currentTime - target) > 0.05) {
            video.currentTime = target;
          }
        }
      }

      /* entrance animation */
      if (!entered && now - start > 800) {
        setEntered(true);
      }

      setScrollProgress(targetRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [entered]);

  /* ─── Derived animation values ─── */
  const heroOpacity = Math.max(0, 1 - scrollProgress / 0.25);
  const heroScale = 1 - (1 - 0.96) * Math.min(1, scrollProgress / 0.25);
  const templeOpacity = Math.max(0, 1 - scrollProgress / 0.3);
  const templeY = -60 * Math.min(1, scrollProgress / 0.3);
  const templeScale = 1 + scrollProgress * 0.15;

  /* cinematic paragraph */
  let cinOpacity = 0;
  if (scrollProgress > 0.1 && scrollProgress < 0.25) cinOpacity = (scrollProgress - 0.1) / 0.15;
  else if (scrollProgress >= 0.25 && scrollProgress < 0.45) cinOpacity = 1;
  else if (scrollProgress >= 0.45 && scrollProgress < 0.6) cinOpacity = 1 - (scrollProgress - 0.45) / 0.15;
  const cinY = -80 * Math.min(1, scrollProgress / 0.5);

  /* stats section */
  const statsVisible = scrollProgress > 0.55;

  /* CTA */
  const ctaOpacity = scrollProgress > 0.75 ? Math.min(1, (scrollProgress - 0.75) / 0.15) : 0;

  return (
    <section className="relative w-full bg-black overflow-hidden">
      {/* ─── Video background ─── */}
      <div className="fixed inset-0 z-0">
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4"
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scale(1.03)", opacity: entered ? 1 : 0, transition: "opacity 1.2s ease-out" }}
        />
      </div>

      {/* ─── Star particles ─── */}
      <div className="fixed inset-0 z-[2] pointer-events-none">
        <StarParticles count={60} opacity={0.5} speed={0.6} />
      </div>

      {/* ─── Bottom gradient fade to black ─── */}
      <div
        className="fixed bottom-0 left-0 w-full h-[200px] z-[3] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, #000)",
          maskImage: "linear-gradient(to top, #000 50%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, #000 50%, transparent)",
        }}
      />

      {/* ─── Scrollable content ─── */}
      <div className="relative z-10" style={{ height: "500vh" }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">

          {/* ─── Fixed header ─── */}
          <header
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 sm:px-10 h-[72px]"
            style={{
              opacity: entered ? 1 : 0,
              transition: "opacity 0.8s ease-out 0.4s",
            }}
          >
            <Link
              to="/"
              className="text-white text-xl sm:text-2xl italic tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              ThaiAI
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-white/80 hover:text-white transition"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", fontFamily: "system-ui, sans-serif" }}
              >
                登录
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                开始学习
              </Link>
            </div>
          </header>

          {/* ─── SCENE 1: Hero + Temple ─── */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-5"
            style={{
              opacity: heroOpacity,
              transform: `scale(${heroScale})`,
              pointerEvents: heroOpacity > 0.05 ? "auto" : "none",
            }}
          >
            {/* Badge */}
            <div
              className="rounded-full px-5 py-2 mb-6 sm:mb-8"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                opacity: entered ? 1 : 0,
                transform: `translateY(${entered ? 0 : 20}px)`,
                transition: "all 0.8s ease-out 0.3s",
              }}
            >
              <p className="text-xs sm:text-sm text-white/70" style={{ fontFamily: "system-ui, sans-serif" }}>
                AI 泰语学习 · 沉浸式体验
              </p>
            </div>

            {/* Thai temple silhouette - central visual */}
            <div
              className="relative mb-4 sm:mb-6"
              style={{
                opacity: templeOpacity,
                transform: `translateY(${templeY}px) scale(${templeScale})`,
              }}
            >
              <ThaiTempleSVG
                className="w-[200px] sm:w-[280px] md:w-[340px] h-auto"
              />
              {/* Glow behind temple */}
              <div
                className="absolute inset-0 blur-3xl"
                style={{
                  background: "radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)",
                  transform: "scale(1.5)",
                }}
              />
            </div>

            {/* Main heading */}
            <h1
              className="text-center text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-normal text-white leading-[1.05]"
              style={{
                fontFamily: "'Instrument Serif', serif",
                letterSpacing: "-0.02em",
                opacity: entered ? 1 : 0,
                transform: `translateY(${entered ? 0 : 30}px)`,
                transition: "all 1s ease-out 0.5s",
              }}
            >
              เรียนภาษาไทย
              <br />
              <span className="italic text-[#d4a574]">เรียน</span>{" "}
              <span className="text-white/60">with AI</span>
            </h1>

            {/* Subtitle */}
            <p
              className="mt-4 sm:mt-6 max-w-lg text-center text-sm sm:text-base leading-relaxed text-white/60"
              style={{
                fontFamily: "system-ui, sans-serif",
                opacity: entered ? 1 : 0,
                transform: `translateY(${entered ? 0 : 20}px)`,
                transition: "all 0.9s ease-out 0.7s",
              }}
            >
              从发音到对话，AI 为你打造沉浸式泰语学习体验。
              <br className="hidden sm:block" />
              无论旅行、工作还是探索文化——开口说泰语。
            </p>

            {/* CTA buttons */}
            <div
              className="mt-8 sm:mt-10 flex items-center gap-4"
              style={{
                opacity: entered ? 1 : 0,
                transform: `translateY(${entered ? 0 : 20}px)`,
                transition: "all 0.9s ease-out 0.9s",
              }}
            >
              <Link
                to="/register"
                className="px-8 py-3.5 bg-[#d4a574] text-black text-sm font-semibold rounded-full hover:bg-[#e0b88a] transition-all hover:scale-105 active:scale-95"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                免费开始
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 text-sm text-white/80 hover:text-white rounded-full transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                已有账号
              </Link>
            </div>

            {/* Scroll hint */}
            <div
              className="absolute bottom-8 sm:bottom-12 flex flex-col items-center gap-2"
              style={{
                opacity: entered ? 1 : 0,
                transition: "opacity 1s ease-out 1.2s",
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40" style={{ fontFamily: "system-ui, sans-serif" }}>
                探索更多
              </span>
              <div
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"
                style={{ animation: "bobUp 1.8s ease-in-out infinite" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* ─── SCENE 2: Cinematic paragraph ─── */}
          <div
            className="absolute inset-0 flex items-center justify-center px-5 sm:px-12 pointer-events-none"
            style={{
              opacity: cinOpacity,
              perspective: "600px",
            }}
          >
            <div
              className="max-w-4xl text-center"
              style={{
                transform: `rotateX(18deg) translateY(${cinY}px) translateZ(20px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <p
                className="text-xl sm:text-3xl md:text-4xl lg:text-5xl text-white/90 leading-relaxed"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  letterSpacing: "-0.02em",
                }}
              >
                泰语学习不再是枯燥的单词背诵。
                <br />
                <span className="text-[#d4a574]">沉浸于</span> 泰国文化的每一个细节，
                <br />
                <span className="italic">让语言成为探索世界的钥匙。</span>
              </p>
              <LotusSVG className="w-24 sm:w-32 mx-auto mt-8 opacity-50" />
            </div>
          </div>

          {/* ─── SCENE 3: Stats carousel ─── */}
          <div
            className="absolute inset-0 flex items-center justify-center px-5 sm:px-12 pointer-events-none"
            style={{
              opacity: statsVisible ? 1 : 0,
              transform: `translateY(${statsVisible ? 0 : 40}px)`,
              transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
            }}
          >
            <div className="w-full max-w-6xl overflow-x-auto pb-4 scrollbar-hide pointer-events-auto">
              <div className="flex gap-4 sm:gap-5" style={{ minWidth: "max-content" }}>
                {STATS.map((stat, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[260px] sm:w-[300px] rounded-3xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      opacity: statsVisible ? 1 : 0,
                      transform: `translateY(${statsVisible ? 0 : 30}px)`,
                      transition: `all 0.5s ease-out ${0.1 + i * 0.08}s`,
                    }}
                  >
                    {/* Card inner */}
                    <div className="p-6 sm:p-7 flex flex-col justify-between" style={{ minHeight: "320px" }}>
                      <div>
                        <span
                          className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/50"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          {stat.title}
                        </span>
                        <div
                          className="mt-3 text-5xl sm:text-6xl font-normal text-white"
                          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: "-0.04em", lineHeight: 1 }}
                        >
                          {stat.value}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 mt-4">
                        {stat.details.map((d, j) => (
                          <div key={j} className="flex items-start gap-2 text-[11px] sm:text-xs text-white/50 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a574]/40 mt-1 flex-shrink-0" />
                            <span style={{ fontFamily: "system-ui, sans-serif" }}>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Card footer */}
                    <div
                      className="px-6 py-3 text-[10px] sm:text-[11px] uppercase tracking-wider text-white/40 border-t border-white/5"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {stat.footer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── SCENE 4: CTA ─── */}
          <div
            className="absolute inset-0 flex items-center justify-center px-5 pointer-events-none"
            style={{ opacity: ctaOpacity }}
          >
            <div className="text-center pointer-events-auto">
              <h2
                className="text-4xl sm:text-6xl md:text-7xl text-white mb-6"
                style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: "-0.02em", lineHeight: 1.05 }}
              >
                เริ่มต้น<span className="text-[#d4a574] italic">วันนี้</span>
              </h2>
              <p className="text-white/60 text-sm sm:text-base mb-8 max-w-md mx-auto" style={{ fontFamily: "system-ui, sans-serif" }}>
                加入数千名泰语学习者，开启你的泰语之旅
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-10 py-4 bg-[#d4a574] text-black text-sm font-semibold rounded-full hover:bg-[#e0b88a] transition-all hover:scale-105 active:scale-95"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                免费注册
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
