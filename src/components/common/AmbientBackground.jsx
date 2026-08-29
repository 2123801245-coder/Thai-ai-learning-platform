import React from "react";

import {
  ThaiPatternOverlay,
} from "./ThaiMotifs";
import {
  BangkokSkyline,
  ParticleField,
} from "./ThaiDecor";

/* =========================================================
   AmbientBackground —— ThaiAI 背景系统
   - 全站统一的深色氛围背景：柔和光晕 + 星点 + 泰式纹样
     + 泰式建筑轮廓 + 泰文漂浮 + 金色微尘 + 细微噪点
   - 由 MainLayout 渲染一次，所有主页面共享
   - variant（按页面自动调整氛围）：
       "home"          → 星空 + AI 粒子 + 泰式建筑轮廓（默认）
       "course"        → 泰式建筑轮廓更明显 + 金色微尘
       "lesson"        → 深色沉浸（减少装饰）
       "conversation"  → 曼谷夜景感（蓝调 + 泰文漂浮）
       "profile"       → 金色星尘（偏金色调）
       "violet"        → 偏紫调（播放器/沉浸场景）
   - 支持自定义强度（intensity: 0-100），方便个别页面微调
========================================================= */

const STAR_POSITIONS = [
  { left: "8%", top: "15%" },
  { left: "24%", top: "8%" },
  { left: "48%", top: "18%" },
  { left: "68%", top: "9%" },
  { left: "82%", top: "30%" },
  { left: "15%", top: "58%" },
  { left: "35%", top: "78%" },
  { left: "72%", top: "70%" },
  { left: "90%", top: "62%" },
  { left: "55%", top: "42%" },
  { left: "6%", top: "42%" },
  { left: "88%", top: "80%" },
];

export default function AmbientBackground({
  variant = "home",
  intensity = 100,
  dense = false,
}) {
  const k = intensity / 100;

  const orbStyle = (baseOpacity) => ({
    opacity: Math.min(baseOpacity * k, 0.16),
  });

  const isLesson = variant === "lesson";
  const isConversation = variant === "conversation";
  const isProfile = variant === "profile";
  const isViolet = variant === "violet";
  const showTemple = variant === "home" || variant === "course" || variant === "profile";
  const showSkyline = variant === "home" || variant === "course" || variant === "profile" || variant === "conversation";
  const showParticles = variant === "home" || variant === "conversation" || variant === "lesson";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {/* 主光晕 1：翠绿（缓慢漂移） */}
      <div
        className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-500 blur-[130px] drift-slow"
        style={orbStyle(isViolet ? 0.05 : isLesson ? 0.06 : 0.09)}
      />

      {/* 主光晕 2：金色 */}
      <div
        className="absolute right-[-180px] top-[8%] h-[500px] w-[500px] rounded-full bg-yellow-400 blur-[130px] drift-slow"
        style={{
          ...orbStyle(isViolet ? 0.04 : isProfile ? 0.08 : 0.06),
          animationDelay: "4s",
        }}
      />

      {/* 主光晕 3：青绿 */}
      <div
        className="absolute bottom-[-240px] left-[35%] h-[520px] w-[520px] rounded-full bg-teal-400 blur-[130px] drift-slow"
        style={{
          ...orbStyle(isViolet ? 0.05 : isLesson ? 0.04 : 0.07),
          animationDelay: "8s",
        }}
      />

      {/* 主光晕 4：泰国国旗海军蓝 */}
      <div
        className="absolute left-[12%] top-[38%] h-[440px] w-[440px] rounded-full bg-blue-700 blur-[140px] drift-slow"
        style={{
          ...orbStyle(isConversation ? 0.09 : isViolet ? 0.05 : 0.06),
          animationDelay: "12s",
        }}
      />

      {/* 泰式织物纹样背景层（极淡） */}

      <ThaiPatternOverlay opacity={isLesson ? 0.025 : 0.045} />

      {/* 泰式建筑轮廓（远景，极淡） */}

      {showTemple && (
        <div
          className="absolute inset-x-0 bottom-0 h-[26vh] thai-temple-bg"
          style={{ opacity: isProfile ? 0.8 : 0.65 }}
        />
      )}

      {/* 曼谷夜景剪影（郑王庙 + 天际线，极低透明度 + 渐变遮罩） */}

      {showSkyline && (
        <div
          className="bangkok-mask absolute inset-x-0 bottom-0 h-[30vh]"
          style={{ opacity: isConversation ? 0.6 : isProfile ? 0.55 : 0.45 }}
        >
          <BangkokSkyline className="h-full w-full" opacity={0.5} />
        </div>
      )}

      {/* AI 微粒子 + 星座连接线（克制，仅非学习沉浸页） */}

      {showParticles && (
        <ParticleField
          className="opacity-70"
          opacity={isLesson ? 0.18 : 0.3}
        />
      )}

      {/* AI 扫描线（极淡，缓慢从上到下） */}

      {variant === "home" && (
        <div
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-emerald-300/[0.04] to-transparent"
          style={{ animation: "scanLine 18s linear infinite" }}
        />
      )}

      {/* 湄南河水波纹（底部，极淡） */}

      {showTemple && (
        <div
          className="absolute inset-x-0 bottom-0 h-16 thai-wave"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 40px, rgba(110,231,183,0.04) 40px 42px, transparent 42px 80px)",
            opacity: 0.5 * k,
          }}
        />
      )}


      {/* 光线缓慢扫过（电影感） */}

      {variant === "home" && (
        <div
          className="light-sweep absolute inset-y-0 left-0 w-[40%]"
          style={{
            background:
              "linear-gradient(105deg, transparent, rgba(110,231,183,0.05), transparent)",
          }}
        />
      )}

      {/* 星点 */}

      <div
        className={`absolute inset-0 ${
          dense ? "opacity-40" : isLesson ? "opacity-15" : "opacity-30"
        }`}
      >
        {STAR_POSITIONS.map((star, index) => (
          <span
            key={index}
            className={`absolute h-1 w-1 rounded-full bg-white ${
              index % 3 === 0
                ? "shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                : ""
            }`}
            style={{
              left: star.left,
              top: star.top,
              opacity: Math.min((index % 4 === 0 ? 0.9 : 0.5) * k, 1),
            }}
          />
        ))}
      </div>

      {/* 金色漂浮微尘 */}

      <div className="absolute inset-0">
        {STAR_POSITIONS.slice(0, isLesson ? 3 : 6).map((dot, index) => (
          <span
            key={`dust-${index}`}
            className="absolute h-[3px] w-[3px] rounded-full bg-yellow-300/70 thai-dust"
            style={{
              left: dot.left,
              top: dot.top,
              animationDelay: `${index * 1.4}s`,
              animationDuration: `${6 + index * 1.2}s`,
              opacity: 0.25 * k,
            }}
          />
        ))}
      </div>

      {/* 细微噪点（全站质感） */}

      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}
