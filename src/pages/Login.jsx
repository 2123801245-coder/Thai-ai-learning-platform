import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/api/auth";
import { useAuth } from "@/lib/AuthContext";
import { Mail, Lock, Loader2, Menu, X, ArrowRight } from "lucide-react";
import StarParticles from "@/components/StarParticles";

const VIDEOS = [
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4",
    label: "Golden Hour",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4",
    label: "Still Water",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4",
    label: "Deep Woods",
  },
  {
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4",
    label: "Quiet Dawn",
  },
];

const OVERLAY_URL =
  "https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png";

const NAV_LINKS = ["Features", "Pricing", "Community"];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  /* ---- video switching ---- */
  const [activeVideo, setActiveVideo] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const switchVideo = useCallback(
    (idx) => {
      if (idx === activeVideo || isTransitioning) return;
      setActiveVideo(idx);
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 1000);
    },
    [activeVideo, isTransitioning]
  );

  /* auto-cycle every 8s */
  useEffect(() => {
    const timer = setInterval(() => {
      switchVideo((activeVideo + 1) % VIDEOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeVideo, switchVideo]);

  const isDark = activeVideo === 2;

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

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* ===== Video layer ===== */}
      {VIDEOS.map((v, i) => (
        <video
          key={i}
          src={v.url}
          muted
          loop
          playsInline
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1000ms] ease-in-out ${
            i === activeVideo ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* ===== Star / sparkle particles ===== */}
      <StarParticles count={90} opacity={0.6} speed={0.8} />

      {/* ===== Overlay PNG ===== */}
      <div className="absolute inset-0 z-[1] pointer-events-none animate-train-bob">
        <img
          src={OVERLAY_URL}
          alt=""
          className="w-full h-full object-cover"
          style={{ transform: "scale(1.03)" }}
        />
      </div>

      {/* ===== Content layer z-2 ===== */}
      <div className="relative z-[2] flex flex-col h-full">
        {/* ---- Nav ---- */}
        <nav className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
          {/* Logo */}
          <Link
            to="/"
            className="text-white text-xl sm:text-2xl italic tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            ThaiAI
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 liquid-glass rounded-full px-2 py-1.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="px-4 py-1.5 text-sm text-white/90 hover:text-white transition rounded-full"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {link}
              </a>
            ))}
            <Link
              to="/register"
              className="ml-1 px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white"
          >
            <div className="relative w-5 h-5">
              <Menu
                className={`absolute inset-0 transition-all duration-300 ${
                  menuOpen
                    ? "opacity-0 rotate-90 scale-75"
                    : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                className={`absolute inset-0 transition-all duration-300 ${
                  menuOpen
                    ? "opacity-100 rotate-0 scale-100"
                    : "opacity-0 -rotate-90 scale-75"
                }`}
              />
            </div>
          </button>
        </nav>

        {/* ---- Mobile menu overlay ---- */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
            >
              <button
                onClick={() => setMenuOpen(false)}
                className="absolute top-5 right-5 text-white"
              >
                <X className="w-7 h-7" />
              </button>
              <div className="flex flex-col items-center gap-6">
                {NAV_LINKS.map((link, i) => (
                  <motion.a
                    key={link}
                    href={`#${link.toLowerCase()}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.05,
                      duration: 0.5,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    onClick={() => setMenuOpen(false)}
                    className="text-white text-3xl"
                  >
                    {link}
                  </motion.a>
                ))}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="mt-4 px-8 py-3 bg-white text-black text-lg font-medium rounded-full"
                  >
                    Get Started
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Hero content (centered) ---- */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8">
          {/* Badge */}
          <div className="liquid-glass rounded-full px-5 py-2 mb-6 sm:mb-8">
            <p
              className="text-xs sm:text-sm text-white/80"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              AI泰语学习 · 让每一句话都有力量
            </p>
          </div>

          {/* Heading */}
          <h1
            className={`text-center text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.1] max-w-4xl font-normal transition-colors duration-700 ${
              isDark ? "text-[#182C41]" : "text-white"
            }`}
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Clarity in an Endlessly{"\n"}
            <span className="italic">Noisy</span> Universe
          </h1>

          {/* Subtext */}
          <p
            className={`mt-5 sm:mt-6 max-w-xl text-center text-sm sm:text-base leading-relaxed transition-colors duration-700 ${
              isDark ? "text-[#182C41]/70" : "text-white/70"
            }`}
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            掌握泰语，从发音到对话，AI为你打造沉浸式学习体验。
            <br className="hidden sm:block" />
            无论你在旅行、工作还是探索文化——开口说泰语。
          </p>

          {/* Login form as liquid-glass pill */}
          <form
            onSubmit={handleSubmit}
            className="mt-8 sm:mt-10 liquid-glass rounded-full flex items-center w-full max-w-xs sm:max-w-sm p-1.5"
          >
            <div className="flex items-center flex-1 px-4 gap-2">
              <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none min-w-0"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>
            <div className="flex items-center flex-1 px-4 gap-2 border-l border-white/10">
              <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none min-w-0"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="ml-1 px-5 sm:px-6 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-sm text-red-300"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Links */}
          <div
            className="mt-4 flex items-center gap-3 text-xs text-white/50"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <Link to="/register" className="hover:text-white transition">
              注册账号
            </Link>
            <span className="text-white/20">|</span>
            <Link to="/forgot-password" className="hover:text-white transition">
              忘记密码
            </Link>
          </div>

          {/* Video switcher */}
          <div className="mt-8 sm:mt-10 flex items-center gap-3 sm:gap-4">
            {VIDEOS.map((v, i) => (
              <button
                key={i}
                onClick={() => switchVideo(i)}
                className={`text-xs sm:text-sm transition-all duration-300 pb-1 ${
                  i === activeVideo
                    ? `font-medium border-b ${
                        isDark
                          ? "text-[#182C41] border-[#182C41]"
                          : "text-white border-white"
                      }`
                    : `border-b border-transparent ${
                        isDark
                          ? "text-[#182C41]/50 hover:text-[#182C41]/80"
                          : "text-white/50 hover:text-white/80"
                      }`
                }`}
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Bottom stats ---- */}
        <div
          className="px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-center gap-3 sm:gap-6 text-white/60 text-[11px] sm:text-xs flex-wrap"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <span>5,000+ 泰语词汇</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span>18 本词书</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span>3 种测验模式</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span>AI 对话练习</span>
        </div>
      </div>
    </section>
  );
}
