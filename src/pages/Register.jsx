import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/api/auth";
import { useAuth } from "@/lib/AuthContext";
import { Mail, Lock, User, Loader2, Menu, X, ArrowRight, UserPlus } from "lucide-react";
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

/* ---- password strength ---- */
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: '弱', color: 'bg-red-400' };
  if (score <= 2) return { score: 2, label: '一般', color: 'bg-orange-400' };
  if (score <= 3) return { score: 3, label: '中等', color: 'bg-yellow-400' };
  if (score <= 4) return { score: 4, label: '强', color: 'bg-emerald-400' };
  return { score: 5, label: '非常强', color: 'bg-emerald-300' };
};


export default function Register() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: "", color: "" });
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
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { nickname, email, password });
      login(res.data);
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "注册失败，请稍后重试");
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
              to="/login"
              className="ml-1 px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              Sign In
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
                  menuOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                className={`absolute inset-0 transition-all duration-300 ${
                  menuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
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
              <button onClick={() => setMenuOpen(false)} className="absolute top-5 right-5 text-white">
                <X className="w-7 h-7" />
              </button>
              <div className="flex flex-col items-center gap-6">
                {NAV_LINKS.map((link, i) => (
                  <motion.a
                    key={link}
                    href={`#${link.toLowerCase()}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    onClick={() => setMenuOpen(false)}
                    className="text-white text-3xl"
                  >
                    {link}
                  </motion.a>
                ))}
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-4 px-8 py-3 bg-white text-black text-lg font-medium rounded-full">
                    Sign In
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Hero content ---- */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8">
          {/* Badge */}
          <div className="liquid-glass rounded-full px-5 py-2 mb-5 sm:mb-6">
            <p className="text-xs sm:text-sm text-white/80" style={{ fontFamily: "system-ui, sans-serif" }}>
              加入 5,000+ 泰语学习者
            </p>
          </div>

          {/* Heading */}
          <h1
            className={`text-center text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.1] max-w-4xl font-normal transition-colors duration-700 ${
              isDark ? "text-[#182C41]" : "text-white"
            }`}
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Start Your{"\n"}
            <span className="italic">Journey</span>
          </h1>

          {/* Subtext */}
          <p
            className={`mt-4 sm:mt-5 max-w-xl text-center text-sm sm:text-base leading-relaxed transition-colors duration-700 ${
              isDark ? "text-[#182C41]/70" : "text-white/70"
            }`}
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            创建账户，解锁全部课程、词汇、测验和AI对话功能。
          </p>

          {/* Register form as liquid-glass card */}
          <form
            onSubmit={handleSubmit}
            className="mt-6 sm:mt-8 liquid-glass rounded-3xl p-6 sm:p-8 w-full max-w-sm space-y-4"
          >
            {/* Nickname */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="w-full bg-white/[0.06] text-white text-sm placeholder:text-white/30 rounded-xl pl-11 pr-4 py-3 outline-none border border-white/[0.08] focus:border-white/20 transition"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/[0.06] text-white text-sm placeholder:text-white/30 rounded-xl pl-11 pr-4 py-3 outline-none border border-white/[0.08] focus:border-white/20 transition"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordStrength(getStrength(e.target.value)); }}
                required
                className="w-full bg-white/[0.06] text-white text-sm placeholder:text-white/30 rounded-xl pl-11 pr-4 py-3 outline-none border border-white/[0.08] focus:border-white/20 transition"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>


            {/* Password strength */}
            {password && (
              <div className="space-y-1.5 -mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= passwordStrength.score ? passwordStrength.color : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`text-[11px] transition-colors duration-300 ${
                    passwordStrength.score <= 1 ? 'text-red-300' :
                    passwordStrength.score <= 2 ? 'text-orange-300' :
                    passwordStrength.score <= 3 ? 'text-yellow-300' :
                    'text-emerald-300'
                  }`}
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  密码强度：{passwordStrength.label}
                </p>
              </div>
            )}

            {/* Confirm Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-white/[0.06] text-white text-sm placeholder:text-white/30 rounded-xl pl-11 pr-4 py-3 outline-none border border-white/[0.08] focus:border-white/20 transition"
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-red-300 text-center"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  创建账户
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div
            className="mt-4 flex items-center gap-3 text-xs text-white/50"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <span>已经有账户？</span>
            <Link to="/login" className="text-white hover:underline transition">
              立即登录
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
                    ? `font-medium border-b ${isDark ? "text-[#182C41] border-[#182C41]" : "text-white border-white"}`
                    : `border-b border-transparent ${isDark ? "text-[#182C41]/50 hover:text-[#182C41]/80" : "text-white/50 hover:text-white/80"}`
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
