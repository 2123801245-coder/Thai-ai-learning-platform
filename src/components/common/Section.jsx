// src/components/common/Section.jsx
//
// =========================================================
// 分区与数字块 · Section / StatTile / SectionGrid
// =========================================================
//
// 解决的问题：卡片堆叠
// --------------------
// 重构前，一个页面里「区块」的默认做法是各写一个 premium-glass 大卡：
// 区块标题、区块容器、区块内容全塞进同一张卡；一页里叠七八张，
// 每张都有自己的边框、模糊、阴影和角饰，读的人分不出哪个是重点。
//
// 正确的做法是把**层级交给排版**，把卡片留给**真的是卡片的对象**
// （一门课、一条词、一个展厅）：
//
//   <Section title="今日任务" desc="3 项" action={<Link>全部</Link>}>
//     <Card>…</Card>        ← 真正需要边框的内容才用卡
//   </Section>
//
// v2 默认 `plain`：分区用发丝分割线区分，没有背景、没有大圆角。
// 需要「一整个分区是一张卡」时显式传 variant="panel"（少数情况）。
//
// 三个组件
// --------
//   Section      分区（标题 + 可选描述/操作 + 内容）
//   SectionGrid  分区内的自适应网格（替代各页自己的 grid-cols-* 组合）
//   StatTile     单个数字（XP / 连续天数 / 词量…），统一数字排版

import React from "react";

/* ── 分区 ── */

const sectionVariants = {
  /** 默认：只用发丝线分层，不叠卡 */
  plain: "",
  /** 需要视觉包裹感时用（例如分区本身就是可交互的整体） */
  panel: "rounded-3xl premium-glass p-5 sm:p-6",
};

export function Section({
  title,
  desc,
  emoji,
  action,
  variant = "plain",
  /** 是否在标题上方画一条分割线（首屏第一个分区通常不需要） */
  divider = true,
  className = "",
  id,
  children,
}) {
  const isPlain = variant === "plain";

  return (
    <section
      id={id}
      className={`
        ${divider && isPlain ? "border-t border-white/[0.07] pt-5" : ""}
        ${sectionVariants[variant] || ""}
        ${className}
      `}
    >
      {title ? (
        <header
          className={`flex flex-wrap items-end justify-between gap-3 ${
            isPlain ? "mb-3.5" : "mb-4"
          }`}
        >
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-white/90">
              {emoji ? (
                <span aria-hidden="true" className="text-base leading-none">
                  {emoji}
                </span>
              ) : null}
              {title}
            </h2>
            {desc ? (
              <p className="mt-1 text-[11.5px] leading-5 text-white/40">{desc}</p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      {children}
    </section>
  );
}

/* ── 分区内网格：列数只在断点上决定，不再每页手写 ── */

const gridCols = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  6: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
};

export function SectionGrid({ cols = 3, gap = "gap-2.5", className = "", children }) {
  return (
    <div className={`grid ${gridCols[cols] || gridCols[3]} ${gap} ${className}`}>
      {children}
    </div>
  );
}

/* ── 数字块：把「大数字 + 小标签」的排版统一 ── */

const statTones = {
  emerald: "text-emerald-300",
  gold: "text-[#e8c684]",
  sky: "text-sky-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
  orange: "text-orange-300",
  white: "text-white",
};

export function StatTile({
  icon: Icon,
  value,
  label,
  unit,
  tone = "emerald",
  hint,
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon className={`h-3.5 w-3.5 shrink-0 ${statTones[tone] || statTones.emerald}`} />
        ) : null}
        <span
          className={`text-[19px] font-black leading-none tabular-nums ${
            statTones[tone] || statTones.emerald
          }`}
        >
          {value}
          {unit ? <span className="ml-0.5 text-[11px] font-bold">{unit}</span> : null}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[10.5px] text-white/40">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-white/25">{hint}</p> : null}
    </div>
  );
}

/* ── 列表行：替代「一个链接一张大卡」的堆叠 ── */

export function RowItem({
  as: As = "div",
  icon: Icon,
  title,
  desc,
  meta,
  trailing,
  onClick,
  className = "",
  ...props
}) {
  const interactive = Boolean(onClick || As === "a" || As === "button");

  return (
    <As
      onClick={onClick}
      className={`
        flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]
        px-3.5 py-3 text-left transition
        ${interactive ? "hover:border-emerald-300/25 hover:bg-white/[0.05]" : ""}
        ${className}
      `}
      {...props}
    >
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <Icon className="h-[17px] w-[17px] text-emerald-300" />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-white/90">
          {title}
        </span>
        {desc ? (
          <span className="mt-0.5 block truncate text-[11px] text-white/35">{desc}</span>
        ) : null}
      </span>

      {meta ? (
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">{meta}</span>
      ) : null}

      {trailing}
    </As>
  );
}
