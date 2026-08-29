import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/api/auth";
import { Mail, Loader2, Menu, X, ArrowRight, CheckCircle } from "lucide-react";
import StarParticles from "@/components/StarParticles";

const VIDEOS = [
  { url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4", label: "Golden Hour" },
  { url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4", label: "Still Water" },
  { url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4", label: "Deep Woods" },
  { url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4", label: "Quiet Dawn" },
];
const OVERLAY_URL = "https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png";
const NAV_LINKS = ["Features", "Pricing", "Community"];

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [activeVideo, setActiveVideo] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const switchVideo = useCallback((idx) => {
    if (idx === activeVideo || isTransitioning) return;
    setActiveVideo(idx);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 1000);
  }, [activeVideo, isTransitioning]);

  useEffect(() => {
    const timer = setInterval(() => switchVideo((activeVideo + 1) % VIDEOS.length), 8000);
    return () => clearInterval(timer);
  }, [activeVideo, switchVideo]);

  const isDark = activeVideo === 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post("/auth/forgot-password", { email }); } catch {} finally { setLoading(false); setSent(true); }
  };

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {VIDEOS.map((v, i) => (
        <video key={i} src={v.url} muted loop playsInline autoPlay className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1000ms] ease-in-out ${i === activeVideo ? "opacity-100" : "opacity-0"}`} />
      ))}
      <StarParticles count={90} opacity={0.6} speed={0.8} />
      <div className="absolute inset-0 z-[1] pointer-events-none animate-train-bob">
        <img src={OVERLAY_URL} alt="" className="w-full h-full object-cover" style={{ transform: "scale(1.03)" }} />
      </div>
      <div className="relative z-[2] flex flex-col h-full">
        {/* Nav */}
        <nav className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
          <Link to="/" className="text-white text-xl sm:text-2xl italic tracking-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>ThaiAI</Link>
          <div className="hidden md:flex items-center gap-1 liquid-glass rounded-full px-2 py-1.5">
            {NAV_LINKS.map((l) => (<a key={l} href={`#${l.toLowerCase()}`} className="px-4 py-1.5 text-sm text-white/90 hover:text-white transition rounded-full" style={{ fontFamily: "system-ui, sans-serif" }}>{l}</a>))}
            <Link to="/login" className="ml-1 px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition" style={{ fontFamily: "system-ui, sans-serif" }}>Sign In</Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white">
            <div className="relative w-5 h-5">
              <Menu className={`absolute inset-0 transition-all duration-300 ${menuOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"}`} />
              <X className={`absolute inset-0 transition-all duration-300 ${menuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`} />
            </div>
          </button>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <button onClick={() => setMenuOpen(false)} className="absolute top-5 right-5 text-white"><X className="w-7 h-7" /></button>
              <div className="flex flex-col items-center gap-6">
                {NAV_LINKS.map((l, i) => (<motion.a key={l} href={`#${l.toLowerCase()}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }} onClick={() => setMenuOpen(false)} className="text-white text-3xl">{l}</motion.a>))}
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-4 px-8 py-3 bg-white text-black text-lg font-medium rounded-full">Sign In</Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8">
          <div className="liquid-glass rounded-full px-5 py-2 mb-5 sm:mb-6">
            <p className="text-xs sm:text-sm text-white/80" style={{ fontFamily: "system-ui, sans-serif" }}>重置密码</p>
          </div>
          <h1 className={`text-center text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.1] max-w-4xl font-normal transition-colors duration-700 ${isDark ? "text-[#182C41]" : "text-white"}`} style={{ fontFamily: "'Instrument Serif', serif" }}>
            Forgot Your{"\n"}<span className="italic">Password</span>?
          </h1>
          <p className={`mt-4 sm:mt-5 max-w-xl text-center text-sm sm:text-base leading-relaxed transition-colors duration-700 ${isDark ? "text-[#182C41]/70" : "text-white/70"}`} style={{ fontFamily: "system-ui, sans-serif" }}>
            输入你的注册邮箱，我们将发送密码重置链接。
          </p>

          {/* Form */}
          <div className="mt-6 sm:mt-8 liquid-glass rounded-3xl p-6 sm:p-8 w-full max-w-sm">
            {sent ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-white text-sm" style={{ fontFamily: "system-ui, sans-serif" }}>如果该邮箱已注册，你将很快收到重置链接。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-white/[0.06] text-white text-sm placeholder:text-white/30 rounded-xl pl-11 pr-4 py-3 outline-none border border-white/[0.08] focus:border-white/20 transition" style={{ fontFamily: "system-ui, sans-serif" }} />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition flex items-center justify-center gap-2 disabled:opacity-50" style={{ fontFamily: "system-ui, sans-serif" }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>发送重置链接 <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs text-white/50" style={{ fontFamily: "system-ui, sans-serif" }}>
            <Link to="/login" className="hover:text-white transition">← 返回登录</Link>
          </div>

          {/* Video switcher */}
          <div className="mt-8 sm:mt-10 flex items-center gap-3 sm:gap-4">
            {VIDEOS.map((v, i) => (
              <button key={i} onClick={() => switchVideo(i)} className={`text-xs sm:text-sm transition-all duration-300 pb-1 ${i === activeVideo ? `font-medium border-b ${isDark ? "text-[#182C41] border-[#182C41]" : "text-white border-white"}` : `border-b border-transparent ${isDark ? "text-[#182C41]/50" : "text-white/50 hover:text-white/80"}`}`} style={{ fontFamily: "system-ui, sans-serif" }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-center gap-3 sm:gap-6 text-white/60 text-[11px] sm:text-xs flex-wrap" style={{ fontFamily: "system-ui, sans-serif" }}>
          <span>5,000+ 泰语词汇</span><span className="hidden sm:inline text-white/20">|</span><span>18 本词书</span><span className="hidden sm:inline text-white/20">|</span><span>3 种测验模式</span><span className="hidden sm:inline text-white/20">|</span><span>AI 对话练习</span>
        </div>
      </div>
    </section>
  );
}
