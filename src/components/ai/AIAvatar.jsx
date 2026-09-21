// src/components/ai/AIAvatar.jsx
//
// =========================================================
// AI 泰语老师 · 数字守护者头像
// =========================================================
//
// 「未来泰文化 AI 导师」：素可泰风格数字守护者。不是佛像照片（那是首页
// 场景），这里是**头像系统**——一个可复用的组件，用 CSS/SVG 画出：
//
//   - 黑曜石质感的头部剪影（SVG 渐变 + 高光）
//   - 翡翠神经网络纹路（SVG path，呼吸时流光）
//   - 泰式金纹头冠（SVG）
//
// 五种动画状态（全部由 prop 驱动，零外部依赖、零 WebGL）：
//   idle      静息呼吸（头部轻微浮动 + 纹路流光）
//   greeting  问好（头部点头 + 光环扩散，播完自动回 idle）
//   thinking  思考（纹路加速流动 + 顶部光点旋转）
//   speaking  说话（嘴部光带随音量电平脉动）
//   listening 听（外圈声波环随电平扩张）
//
// 性能：纯 CSS 动画（transform/opacity，走 GPU），JS 只在 speaking 时
// 把电平写进 CSS 变量（与首页波形同一套做法，不触发 React 重渲染）。
// prefers-reduced-motion 时只保留静态形象。
// =========================================================

import React, { memo } from "react";

/* 状态 → 视觉参数 */
const STATE_META = {
  idle: { ring: "rgba(52,211,153,0.25)", label: null },
  greeting: { ring: "rgba(232,198,132,0.5)", label: "สวัสดีครับ" },
  thinking: { ring: "rgba(251,191,36,0.4)", label: "思考中" },
  listening: { ring: "rgba(52,211,153,0.55)", label: "在听" },
  speaking: { ring: "rgba(232,198,132,0.55)", label: "在说" },
};

/**
 * @param {string}  props.state     idle | greeting | thinking | listening | speaking
 * @param {number}  props.level     0~1 音量电平（speaking/listening 时驱动脉动）
 * @param {number}  props.size      渲染尺寸 px（默认 120）
 * @param {string}  props.className 附加类名
 */
function AIAvatar({ state = "idle", level = 0, size = 120, className = "" }) {
  const meta = STATE_META[state] || STATE_META.idle;
  const clamped = Math.max(0, Math.min(1, level || 0));

  return (
    <div
      className={`ai-avatar relative select-none ${className}`}
      data-state={state}
      style={{
        width: size,
        height: size,
        "--lvl": clamped.toFixed(3),
      }}
      aria-hidden="true"
    >
      {/* 外圈：状态光环（listening 时随电平扩张） */}
      <span className="ai-avatar-ring" style={{ borderColor: meta.ring }} />

      {/* 头冠金纹 + 黑曜石头部 + 翡翠纹路（一个 SVG 搞定） */}
      <svg
        viewBox="0 0 100 100"
        className="ai-avatar-figure"
        role="img"
        aria-label={`AI 泰语老师，状态：${meta.label || "静息"}`}
      >
        <defs>
          {/* 黑曜石：深灰黑渐变，顶部冷高光 */}
          <radialGradient id="aia-obsidian" cx="38%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#3d4742" />
            <stop offset="45%" stopColor="#151d19" />
            <stop offset="100%" stopColor="#050807" />
          </radialGradient>
          {/* 翡翠流光 */}
          <linearGradient id="aia-emerald" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#0d9e6e" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>
          {/* 暗金 */}
          <linearGradient id="aia-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8c684" />
            <stop offset="100%" stopColor="#8a6a2f" />
          </linearGradient>
        </defs>

        {/* 头冠（素可泰火焰尖） */}
        <path
          className="ai-avatar-crown"
          d="M50 4 L54 14 L50 20 L46 14 Z"
          fill="url(#aia-gold)"
          opacity="0.9"
        />
        <path
          className="ai-avatar-crown"
          d="M42 18 Q50 12 58 18 L56 24 Q50 20 44 24 Z"
          fill="url(#aia-gold)"
          opacity="0.7"
        />

        {/* 头部剪影 */}
        <ellipse cx="50" cy="52" rx="30" ry="34" fill="url(#aia-obsidian)" />
        {/* 顶部颅骨高光 */}
        <ellipse cx="42" cy="34" rx="14" ry="9" fill="#4a564f" opacity="0.35" />

        {/* 面部：闭目（素可泰式下弧线） */}
        <path
          d="M38 50 Q42 53 46 50"
          stroke="#a8b8ae"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M54 50 Q58 53 62 50"
          stroke="#a8b8ae"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* 翡翠神经纹路（脸颊 → 下颌，greeting/thinking 时流光） */}
        <g className="ai-avatar-nerves" stroke="url(#aia-emerald)" fill="none">
          <path d="M36 58 Q40 66 46 70" strokeWidth="1.4" opacity="0.8" />
          <path d="M64 58 Q60 66 54 70" strokeWidth="1.4" opacity="0.8" />
          <path d="M44 72 Q50 76 56 72" strokeWidth="1.2" opacity="0.65" />
          <path d="M50 40 L50 46" strokeWidth="1.2" opacity="0.7" />
        </g>
        {/* 眉心一点翡翠（数字守护者的「核」） */}
        <circle className="ai-avatar-core" cx="50" cy="42" r="2.4" fill="#34d399" />

        {/* 嘴部光带（speaking 时随电平脉动） */}
        <ellipse
          className="ai-avatar-mouth"
          cx="50"
          cy="62"
          rx="6"
          ry="1.8"
          fill="#34d399"
          opacity="0.55"
        />
      </svg>

      {/* 状态小标签（greeting 的泰文 / thinking 等） */}
      {meta.label ? (
        <span
          className={`ai-avatar-label ${
            state === "greeting" ? "font-viaoda text-[#e8c684]" : "text-emerald-200/90"
          }`}
        >
          {meta.label}
        </span>
      ) : null}
    </div>
  );
}

export default memo(AIAvatar);
