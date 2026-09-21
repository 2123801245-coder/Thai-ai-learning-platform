// src/components/world/SkillTree.jsx
//
// =========================================================
// 泰语技能树（取代进度条）
// =========================================================
//
// 为什么用 SVG 而不是 WebGL：技能树的关键信息是「哪条枝在长、长到几分」，
// 需要清晰的分支线条与数字。SVG 在手机上更锐利、更省电，也能直接做
// 无障碍（每个节点是真按钮），而 WebGL 在这里只会让数字变糊。
//
// 生长规则（全部来自 estimateAbilities 的真实分值）：
//   枝干长度 = 能力分（0~100）
//   节点种子 = 1~5 颗（20 分一档），全部点亮=盛开
//   未起步（0 分）的枝画成虚线枯枝，并提示从哪一节开始
//   从根到枝的描边动画用 framer-motion 的 pathLength，进入视口时依次生长
//
// 整体形制：一株泰式「菩提式」对称树 —— 主干在中央，五条枝左右分展，
// 枝端各挂一枚能力果（泰文数字 ๑~๕ 作记号）。
// =========================================================

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Sprout } from "lucide-react";

/* =========================================================
   几何：把五条枝摆成左右舒展的树形
========================================================= */

const VIEW = { w: 640, h: 380 };
const ROOT = { x: 320, y: 344 };

/**
 * 每条枝的贝塞尔控制点（手工调的，保证不重叠且左右平衡）。
 * angle 只是给曲线的方向感，具体点位写死更可控。
 */
const BRANCHES = [
  { id: "pronunciation", dir: -1, dy: 150, bend: -58, tipX: 150 },
  { id: "vocabulary", dir: -1, dy: 96, bend: -34, tipX: 258 },
  { id: "grammar", dir: 1, dy: 176, bend: 6, tipX: 320 },
  { id: "speaking", dir: 1, dy: 96, bend: 34, tipX: 382 },
  { id: "culture", dir: 1, dy: 150, bend: 58, tipX: 490 },
];

const buildPath = (branch, growth) => {
  /* growth 0~1：枝端按完成度向外延伸，未完成的部分留一段虚线接续 */
  const tipX = ROOT.x + (branch.tipX - ROOT.x) * growth;
  const tipY = ROOT.y - branch.dy * growth;
  const c1x = ROOT.x + branch.bend * 0.5;
  const c1y = ROOT.y - branch.dy * 0.42;
  const c2x = ROOT.x + (branch.tipX - ROOT.x) * 0.72 + branch.bend * 0.3;
  const c2y = ROOT.y - branch.dy * 0.88;
  return {
    grown: `M ${ROOT.x} ${ROOT.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tipX} ${tipY}`,
    tip: { x: tipX, y: tipY },
  };
};

/** 种子位置：沿枝端附近排开 */
const seedPositions = (tip, count) =>
  Array.from({ length: count }, (_, i) => {
    const spread = 11;
    const offset = (i - (count - 1) / 2) * spread;
    return { x: tip.x + offset * 0.9, y: tip.y - 13 - Math.abs(offset) * 0.18 };
  });

/* =========================================================
   主体
========================================================= */

export default function SkillTree({ tree = [], summary = null }) {
  const navigate = useNavigate();

  const nodes = useMemo(() => {
    const byId = Object.fromEntries(tree.map((node) => [node.id, node]));
    return BRANCHES.map((branch) => {
      const node = byId[branch.id] || { id: branch.id, score: 0, seeds: 1, cn: branch.id };
      return { branch, node, growth: Math.max(0.18, node.score / 100) };
    });
  }, [tree]);

  if (!tree.length) return null;

  return (
    <section className="relative my-10">
      <div className="mb-3 px-1">
        <p className="text-[10px] uppercase tracking-[0.36em] text-emerald-300/60">
          Thai Skill Tree
        </p>
        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">泰语技能树</h2>
        <p className="mt-1 text-[11px] text-white/40">
          五条能力枝随真实学习生长。词量、正确率、活跃天数一变，枝就跟着长。
          {summary ? ` 当前整体健康度 ${summary.avg}/100。` : ""}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-b from-emerald-950/25 via-black/45 to-black/60 px-2 py-4 sm:px-5">
        {/* 根部光晕 */}
        <div
          className="pointer-events-none absolute bottom-6 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(63,224,160,0.30), transparent 70%)",
          }}
        />

        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="relative mx-auto block h-auto w-full max-w-[720px]"
          role="img"
          aria-label="泰语技能树：五条能力枝的生长状态"
        >
          {/* 土壤 */}
          <ellipse cx={ROOT.x} cy={ROOT.y + 12} rx="180" ry="16" fill="rgba(63,224,160,0.07)" />

          {nodes.map(({ branch, node, growth }, index) => {
            const { grown, tip } = buildPath(branch, growth);
            const seeds = seedPositions(tip, node.seeds);
            const dim = !node.started;
            return (
              <g key={node.id}>
                {/* 枝干 */}
                <motion.path
                  d={grown}
                  fill="none"
                  stroke={node.accent || "#6ee7a8"}
                  strokeWidth={2 + node.seeds * 0.7}
                  strokeLinecap="round"
                  opacity={dim ? 0.35 : 0.95}
                  strokeDasharray={dim ? "5 7" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: dim ? 0.35 : 0.95 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 1.1, delay: index * 0.12, ease: "easeOut" }}
                />

                {/* 未长成的部分：虚线接续，表示「还能长」 */}
                {growth < 1 ? (
                  <path
                    d={buildPath(branch, 1).grown}
                    fill="none"
                    stroke="rgba(255,255,255,0.13)"
                    strokeWidth="1.5"
                    strokeDasharray="3 8"
                    strokeLinecap="round"
                  />
                ) : null}

                {/* 枝端种子 */}
                {seeds.map((seed, i) => (
                  <motion.circle
                    key={i}
                    cx={seed.x}
                    cy={seed.y}
                    r={i === 0 ? 5.2 : 3.6}
                    fill={node.accent || "#6ee7a8"}
                    opacity={dim ? 0.3 : 0.9}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5, delay: 0.5 + index * 0.12 + i * 0.06 }}
                    style={{ transformOrigin: `${seed.x}px ${seed.y}px` }}
                  />
                ))}

                {/* 能力果：泰文数字记号 */}
                <motion.g
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, delay: 0.65 + index * 0.12 }}
                >
                  <circle
                    cx={tip.x}
                    cy={tip.y - 34}
                    r="15"
                    fill="rgba(0,0,0,0.72)"
                    stroke={node.accent || "#6ee7a8"}
                    strokeOpacity={dim ? 0.3 : 0.8}
                    strokeWidth="1.4"
                  />
                  <text
                    x={tip.x}
                    y={tip.y - 29}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="700"
                    fill={node.accent || "#6ee7a8"}
                    opacity={dim ? 0.4 : 1}
                  >
                    {node.glyph}
                  </text>
                </motion.g>
              </g>
            );
          })}

          {/* 主干 */}
          <path
            d={`M ${ROOT.x} ${ROOT.y} L ${ROOT.x} ${ROOT.y - 44}`}
            stroke="rgba(232,200,138,0.75)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx={ROOT.x} cy={ROOT.y} r="7" fill="rgba(232,200,138,0.9)" />
        </svg>

        {/* 五条枝的读数与入口 */}
        <div className="relative mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => navigate(node.to)}
              className="group flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={{
                  color: node.accent,
                  background: "rgba(0,0,0,0.4)",
                  boxShadow: node.started ? `0 0 14px ${node.accent}44` : "none",
                }}
              >
                {node.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[12px] font-bold text-white/90">{node.cn}</span>
                  <span className="text-[10px] text-white/30">{node.en}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-bold" style={{ color: node.accent }}>
                    {node.score}
                    <span className="text-[9px] font-normal text-white/30">/100</span>
                  </span>
                </span>
                {/* 生长刻度：五格，取代长进度条 */}
                <span className="mt-1.5 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="h-1 flex-1 rounded-full transition"
                      style={{
                        background:
                          n <= node.seeds
                            ? node.accent
                            : "rgba(255,255,255,0.09)",
                        opacity: n <= node.seeds ? (node.started ? 0.9 : 0.35) : 1,
                      }}
                    />
                  ))}
                  <span className="ml-1 shrink-0 text-[9px] text-white/35">
                    {node.growthLabel}
                  </span>
                </span>
                {!node.started ? (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-yellow-200/60">
                    <Sprout className="h-3 w-3" />
                    还没开始：{node.tip}
                  </span>
                ) : null}
              </span>
              <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-white/60" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
