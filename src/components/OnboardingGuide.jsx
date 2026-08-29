import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Mic,
  MessageCircle,
  BarChart3,
  Languages,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Volume2,
  Check,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    emoji: "🇹🇭",
    title: "สวัสดี！欢迎来到 ThaiAI",
    subtitle: "你的专属泰语学习空间",
    description:
      "从发音到对话，从词汇到文化，AI 为你打造沉浸式泰语学习体验。",
    gradient: "from-emerald-400 to-emerald-600",
    accent: "[c8914a]",
  },
  {
    icon: BookOpen,
    emoji: "📚",
    title: "课程学习",
    subtitle: "系统化的泰语课程体系",
    description:
      "从零基础到高级，每节课配有视频教学、泰语原文、语法解析和练习题。",
    gradient: "from-sky-500 to-blue-600",
    accent: "sky",
    route: "/course",
  },
  {
    icon: Languages,
    emoji: "📖",
    title: "词汇词书",
    subtitle: "5000+ 泰语词汇，18 本词书",
    description:
      "浏览、翻转卡片、泰译中、中译泰、拼写练习——多种方式帮你记住每个词。",
    gradient: "from-amber-500 to-orange-600",
    accent: "amber",
    route: "/vocabulary",
  },
  {
    icon: MessageCircle,
    emoji: "🤖",
    title: "AI 对话练习",
    subtitle: "和 AI 老师自由对话",
    description:
      "模拟真实场景对话，AI 实时纠正发音和语法，让你自信开口说泰语。",
    gradient: "from-violet-500 to-purple-600",
    accent: "violet",
    route: "/conversation",
  },
  {
    icon: Mic,
    emoji: "🎤",
    title: "口语练习",
    subtitle: "跟读、听写、情景模拟",
    description:
      "专业语音评估，纠正发音细节，让你的泰语越来越地道。",
    gradient: "from-rose-500 to-pink-600",
    accent: "rose",
    route: "/speaking",
  },
  {
    icon: BarChart3,
    emoji: "📊",
    title: "学习追踪",
    subtitle: "记录每一步进步",
    description:
      "学习进度、错题本、连续学习天数——数据驱动你的泰语成长之路。",
    gradient: "from-emerald-400 to-emerald-600",
    accent: "amber",
  },
];

export default function OnboardingGuide({ onComplete }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const navigate = useNavigate();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete?.();
      return;
    }
    setDirection(1);
    setStep((s) => s + 1);
  }, [isLast, onComplete]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    setDirection(-1);
    setStep((s) => s - 1);
  }, [isFirst]);

  const skip = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const goFeature = useCallback(
    (route) => {
      if (route) {
        onComplete?.();
        navigate(route);
      }
    },
    [navigate, onComplete]
  );

  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#04110f] overflow-hidden"
    >
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-emerald-400/30"
            initial={{
              x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 800),
            }}
            animate={{
              y: [null, Math.random() * -200 - 100],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: Math.random() * 4 + 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-400/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-yellow-400/[0.04] blur-[100px] pointer-events-none" />

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={skip}
        className="absolute top-5 right-5 sm:top-8 sm:right-8 z-10 flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] text-white/50 text-sm hover:text-white/80 hover:bg-white/[0.08] transition-all"
      >
        跳过引导
        <X className="w-3.5 h-3.5" />
      </motion.button>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-8 sm:mb-12"
      >
        <span
          className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 via-white to-emerald-400 bg-clip-text text-transparent font-viaoda"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          ThaiAI
        </span>
      </motion.div>

      {/* Step content */}
      <div className="relative w-full max-w-lg mx-auto px-6 sm:px-8" style={{ minHeight: "380px" }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.25 },
              scale: { duration: 0.25 },
            }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.15 }}
              className={`
                mb-6 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl
                bg-gradient-to-br ${current.gradient}
                flex items-center justify-center
                shadow-2xl shadow-black/30
                relative overflow-hidden
              `}
            >
              <span className="text-4xl sm:text-5xl relative z-10">{current.emoji}</span>
              <div className="absolute inset-0 bg-white/10" />
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {current.title}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm sm:text-base text-emerald-300/80 font-medium mb-4"
            >
              {current.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-sm sm:text-[15px] leading-relaxed text-white/55 max-w-sm"
            >
              {current.description}
            </motion.p>

            {/* Go to feature button */}
            {current.route && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                onClick={() => goFeature(current.route)}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/[0.06] text-white/80 text-sm hover:bg-white/[0.12] hover:text-white transition-all"
              >
                去看看 →
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-2.5 mt-8 sm:mt-10"
      >
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > step ? 1 : -1);
              setStep(i);
            }}
            className={`
              rounded-full transition-all duration-300
              ${
                i === step                   ? "w-8 h-2 bg-emerald-400"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              }
            `}
          />
        ))}
      </motion.div>

      {/* Navigation buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-4 mt-8"
      >
        {!isFirst && (
          <button
            onClick={goPrev}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.04] text-white/60 text-sm hover:bg-white/[0.08] hover:text-white/90 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>
        )}

        <button
          onClick={goNext}
          className={`
            flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all
            ${
              isLast                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-400/20 hover:shadow-emerald-400/35"
                : "bg-white text-black hover:bg-white/90"
            }
          `}
        >
          {isLast ? (
            <>
              <Check className="w-4 h-4" />
              开始学习
            </>
          ) : (
            <>
              下一步
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </motion.div>

      {/* Step counter */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-4 text-[11px] text-white/25"
      >
        {step + 1} / {STEPS.length}
      </motion.p>
    </motion.div>
  );
}
