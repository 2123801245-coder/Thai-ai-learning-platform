import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { ThaiCorner } from "@/components/common/ThaiDecor";

/* =========================================================
   ThaiAI Premium 设计系统 —— 可复用组件
   ---------------------------------------------------------
   全站统一品牌语言：
   - GlassCard        玻璃拟态卡片（soft / strong / gold）
   - PremiumButton    高级按钮（emerald / gold / ghost / outline）
   - PageHeader       统一页面标题（图标 + 标题 + 副标题 + 泰式纹样线）
   - ThaiDecorativeLine 泰式金色装饰线
   - AnimatedProgress 动画进度条
   - AIOrb            AI 核心球体（光晕 + 粒子 + 泰文字母）
   所有组件 GPU 友好（transform/opacity），尊重 prefers-reduced-motion。
========================================================= */

/* ---------- 波纹按钮（点击涟漪反馈） ---------- */

export function RippleButton({
  className = "",
  rippleColor = "rgba(255,255,255,0.35)",
  children,
  onClick,
  ...props
}) {
  const [ripples, setRipples] = useState([]);

  const handleClick = (event) => {
    const rect =
      event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const id = Date.now() + Math.random();

    setRipples((current) => [
      ...current,
      { id, x, y, size },
    ]);

    setTimeout(() => {
      setRipples((current) =>
        current.filter((item) => item.id !== id)
      );
    }, 700);

    onClick?.(event);
  };

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            background: rippleColor,
            animation: "rippleExpand 0.65s ease-out forwards",
          }}
        />
      ))}

      <span className="relative z-10 flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

/* ---------- 泰式金色装饰线 ---------- */

export function ThaiDecorativeLine({ className = "", compact = false }) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-center gap-3 ${className}`}
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-300/25 to-emerald-300/60" />
      <div
        className={`shrink-0 ${compact ? "h-1.5 w-1.5" : "h-2 w-2"} rotate-45 border border-yellow-300/70 bg-yellow-300/10`}
      />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-300/25 to-emerald-300/60" />
    </div>
  );
}

/* ---------- 玻璃拟态卡片 ---------- */

const glassTones = {
  soft: "premium-glass",
  strong: "premium-glass-strong",
  gold: "premium-glass-gold",
};

export function GlassCard({
  tone = "soft",
  hover = false,
  glow = "none",
  decor = false,
  className = "",
  children,
  ...props
}) {
  const toneClass = glassTones[tone] || glassTones.soft;

  return (
    <div
      className={`
        relative
        rounded-3xl
        ${toneClass}
        ${hover ? "card-lift" : ""}
        ${glow === "emerald" ? "card-glow-emerald" : ""}
        ${glow === "gold" ? "card-glow-gold" : ""}
        ${decor ? "glass-reflect overflow-hidden" : ""}
        ${className}
      `}
      {...props}
    >
      {/* 顶部内侧高光 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* 泰式金线角饰（重要卡片四角，极淡不抢内容） */}

      {decor && (
        <ThaiCorner
          className="opacity-60"
          size={20}
          color="rgba(245, 214, 123, 0.35)"
        />
      )}

      {children}
    </div>
  );
}

/* ---------- 高级按钮 ---------- */

const buttonVariants = {
  primary:
    "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-[#04110f] shadow-[0_10px_30px_rgba(16,185,129,0.25)] hover:shadow-[0_14px_40px_rgba(16,185,129,0.35)]",
  gold:
    "gold-gradient text-[#241a05] shadow-[0_10px_30px_rgba(212,175,55,0.28)] hover:shadow-[0_14px_42px_rgba(212,175,55,0.4)]",
  outline:
    "border border-white/12 bg-white/[0.03] text-white/80 hover:border-emerald-300/30 hover:bg-white/[0.06] hover:text-white",
  ghost:
    "text-white/60 hover:bg-white/[0.05] hover:text-white",
};

const buttonSizes = {
  sm: "px-4 py-2 text-xs rounded-xl gap-1.5",
  md: "px-6 py-2.5 text-sm rounded-2xl gap-2",
  lg: "px-8 py-3.5 text-base rounded-2xl gap-2.5",
};

export function PremiumButton({
  variant = "primary",
  size = "md",
  sweep = false,
  className = "",
  children,
  ...props
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`
        inline-flex
        items-center
        justify-center
        font-bold
        transition-all
        duration-300
        disabled:opacity-50
        disabled:pointer-events-none
        ${sweep ? "btn-sweep" : ""}
        ${buttonVariants[variant] || buttonVariants.primary}
        ${buttonSizes[size] || buttonSizes.md}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* ---------- 页面标题（统一品牌语言） ---------- */

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  className = "",
  children,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative mb-8 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="premium-glass-strong flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <Icon className="h-5 w-5 text-emerald-300" />
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {title}
              </h1>

              {badge && (
                <span className="rounded-full border border-yellow-300/25 bg-yellow-300/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-yellow-200/90">
                  {badge}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/45">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {children && (
          <div className="flex items-center gap-3">
            {children}
          </div>
        )}
      </div>

      <ThaiDecorativeLine className="mt-5" />
    </motion.div>
  );
}

/* ---------- 动画进度条 ---------- */

export function AnimatedProgress({
  value = 0,
  className = "",
  barClassName = "",
  color = "emerald",
}) {
  const [width, setWidth] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          requestAnimationFrame(() => setWidth(value));
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const colorClass =
    color === "gold"
      ? "gold-gradient"
      : "bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300";

  return (
    <div
      ref={ref}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}
    >
      <div
        className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out ${barClassName}`}
        style={{
          width: `${Math.min(Math.max(width, 0), 100)}%`,
          boxShadow: color === "gold"
            ? "0 0 12px rgba(212,175,55,0.4)"
            : "0 0 12px rgba(52,211,153,0.4)",
        }}
      />
    </div>
  );
}

/* ---------- AI 核心球体（Hero 主视觉，五状态） ----------
   state：idle（呼吸）/ thinking（粒子转亮·核心脉冲）/
          listening（光晕扩大呼吸）/ speaking（快速脉动）/
          success（金色扩散光环） */

export function AIOrb({
  size = 220,
  className = "",
  thaiTexts = ["สวัสดี", "ภาษาไทย", "เรียนภาษาไทย", "AI ครู"],
  light = true,
  state = "idle",
}) {
  const core = size;
  const ringOuter = core * 0.86;
  const ringInner = core * 0.66;
  const dotCount = 10;

  /* 状态 → 光晕动画（呼吸频率/亮度） */
  const glowAnim = {
    idle: { scale: [1, 1.06, 1], opacity: [0.2, 0.35, 0.2] },
    thinking: { scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] },
    listening: { scale: [1, 1.18, 1], opacity: [0.35, 0.65, 0.35] },
    speaking: { scale: [1, 1.12, 1], opacity: [0.3, 0.7, 0.3] },
    success: { scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] },
  }[state];

  const glowDuration = {
    idle: 4.2,
    thinking: 1.5,
    listening: 2.2,
    speaking: 1,
    success: 1.6,
  }[state];

  /* 状态 → 核心脉冲 */
  const coreAnim = {
    idle: { scale: 1 },
    thinking: { scale: [1, 1.08, 1] },
    listening: { scale: [1, 1.12, 1] },
    speaking: { scale: [1, 1.06, 1] },
    success: { scale: [1, 1.15, 1] },
  }[state];

  const coreDuration = {
    idle: 0.001,
    thinking: 1.2,
    listening: 1.8,
    speaking: 0.9,
    success: 1.4,
  }[state];

  /* 环绕粒子亮度 */
  const particleOpacity = {
    idle: 0.7,
    thinking: 0.95,
    listening: 0.9,
    speaking: 1,
    success: 0.85,
  }[state];

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width: size * 1.15, height: size * 1.15 }}
      aria-hidden="true"
    >
      {/* 外发光（状态驱动呼吸） */}
      <motion.div
        animate={glowAnim}
        transition={{
          duration: glowDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/25 blur-[70px]"
        style={{ width: core * 1.05, height: core * 1.05 }}
      />
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.25, 0.5, 0.25],
        }}
        transition={{
          duration: Math.max(glowDuration * 0.72, 1),
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.6,
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/12 blur-[60px]"
        style={{ width: core * 0.75, height: core * 0.75 }}
      />

      {/* 外光环 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/25 ring-spin"
        style={{ width: ringOuter, height: ringOuter }}
      >
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_14px_rgba(250,204,21,0.9)]" />
      </div>

      {/* 内光环（反向） */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-300/20 ring-spin-reverse"
        style={{ width: ringInner, height: ringInner }}
      >
        <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
      </div>

      {/* 环绕粒子（thinking/speaking 时转亮） */}
      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (i / dotCount) * Math.PI * 2;
        const radius = core * 0.42;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-emerald-200/80"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              left: `calc(50% + ${Math.cos(angle) * radius}px)`,
              top: `calc(50% + ${Math.sin(angle) * radius}px)`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 10px rgba(110,231,183,0.8)",
              opacity: particleOpacity,
              animation: `thaiFloat ${8 + (i % 4) * 2}s ease-in-out ${i * 0.6}s infinite`,
            }}
          />
        );
      })}

      {/* 核心球体（状态脉冲） */}
      <motion.div
        animate={coreAnim}
        transition={{
          duration: coreDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: core * 0.5, height: core * 0.5 }}
      >
        <div className="relative h-full w-full">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-300/30 via-teal-500/20 to-[#04110f]" />
          <div className="absolute inset-0 rounded-full border border-emerald-200/25" />
          <div className="absolute inset-[18%] rounded-full border border-white/10" />
          {/* 中心节点 */}
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-200 shadow-[0_0_18px_rgba(253,224,71,0.95)]" />
          {/* 泰文核心字 */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wide text-white/35">
            ไทย
          </span>
        </div>
      </motion.div>

      {/* success：金色扩散光环（一次性） */}

      <AnimatePresence>
        {state === "success" && (
          <motion.span
            key="success-ring"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300/60"
            style={{ width: core * 0.55, height: core * 0.55 }}
          />
        )}
      </AnimatePresence>

      {/* 漂浮泰文字母 */}
      {light &&
        thaiTexts.map((text, i) => {
          const angle = (i / thaiTexts.length) * Math.PI * 2;
          const radius = core * 0.72;
          return (
            <span
              key={i}
              className="absolute whitespace-nowrap font-bold text-white/25 thai-float"
              style={{
                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                transform: "translate(-50%, -50%)",
                fontSize: i % 2 === 0 ? 12 : 10,
                animationDelay: `${i * 1.8}s`,
              }}
            >
              {text}
            </span>
          );
        })}
    </div>
  );
}

/* ---------- 数字滚动（进入视口时 0 → 目标值） ---------- */

export function AnimatedNumber({
  value = 0,
  duration = 1200,
  className = "",
  suffix = "",
  prefix = "",
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf;

    const animate = () => {
      const start = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(value * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ---------- 滚动入场（Fade Up + Stagger） ---------- */

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export function StaggerGroup({
  className = "",
  children,
  once = true,
  ...props
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  className = "",
  children,
  ...props
}) {
  return (
    <motion.div
      className={className}
      variants={staggerItem}
      {...props}
    >
      {children}
    </motion.div>
  );
}
