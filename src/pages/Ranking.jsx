import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Flame,
  Crown,
  Clock3,
  Sparkles,
  Info,
} from "lucide-react";

import {
  ThaiCorner,
  ThaiSectionDivider,
} from "@/components/common/ThaiDecor";

/* =========================================================
   Demo 排行榜数据
   =========================================================
   说明：
   1. 当前排行榜服务尚未接入（不伪造真实数据）。
   2. 每位用户包含周榜 / 月榜 / 总榜的积分，
      页面按当前标签页选择对应的积分排序。
   3. 未来接入后端后，只需把这里换成 API 返回的数据
      （字段结构保持一致即可），页面代码无需改动。
========================================================= */

const demoUsers = [
  {
    name: "Somchai",
    isMe: false,
    color: "bg-yellow-400/15 text-yellow-300",
    weekly: 1860,
    monthly: 7420,
    total: 28950,
    words: 2890,
    streak: 45,
    hours: 316,
  },
  {
    name: "Nok",
    isMe: false,
    color: "bg-emerald-400/15 text-emerald-300",
    weekly: 1640,
    monthly: 6850,
    total: 24300,
    words: 2430,
    streak: 38,
    hours: 274,
  },
  {
    name: "Pong",
    isMe: false,
    color: "bg-teal-400/15 text-teal-300",
    weekly: 1420,
    monthly: 5980,
    total: 21750,
    words: 2175,
    streak: 31,
    hours: 241,
  },
  {
    name: "Mei",
    isMe: false,
    color: "bg-sky-400/15 text-sky-300",
    weekly: 1280,
    monthly: 5340,
    total: 19200,
    words: 1920,
    streak: 26,
    hours: 208,
  },
  {
    name: "你",
    isMe: true,
    color: "bg-yellow-300/20 text-yellow-200",
    weekly: 980,
    monthly: 4120,
    total: 12600,
    words: 1260,
    streak: 12,
    hours: 96,
  },
  {
    name: "Yuki",
    isMe: false,
    color: "bg-purple-400/15 text-purple-300",
    weekly: 940,
    monthly: 3980,
    total: 11800,
    words: 1180,
    streak: 9,
    hours: 87,
  },
  {
    name: "Chen",
    isMe: false,
    color: "bg-rose-400/15 text-rose-300",
    weekly: 820,
    monthly: 3510,
    total: 10400,
    words: 1040,
    streak: 8,
    hours: 79,
  },
  {
    name: "Aom",
    isMe: false,
    color: "bg-emerald-400/15 text-emerald-300",
    weekly: 760,
    monthly: 3240,
    total: 9600,
    words: 960,
    streak: 6,
    hours: 71,
  },
  {
    name: "Dan",
    isMe: false,
    color: "bg-amber-400/15 text-amber-300",
    weekly: 640,
    monthly: 2780,
    total: 8200,
    words: 820,
    streak: 5,
    hours: 62,
  },
];

/* 榜单标签页 */
const tabs = [
  { key: "weekly", label: "周榜" },
  { key: "monthly", label: "月榜" },
  { key: "total", label: "总榜" },
];

const formatPoints = (n) =>
  n >= 1000
    ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : String(n);

/* =========================================================
   Ranking
========================================================= */

export default function Ranking() {
  const [activeTab, setActiveTab] = useState("weekly");
  const navigate = useNavigate();

  const sorted = [...demoUsers].sort(
    (a, b) => b[activeTab] - a[activeTab]
  );

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] px-4 py-3">
        <span className="text-[11px] text-white/35">排行榜 · 和同学一起保持学习节奏</span>
        <button type="button" onClick={() => navigate("/plan")} className="rounded-lg border border-emerald-300/15 px-3 py-1.5 text-[11px] text-emerald-200/75 transition hover:bg-emerald-300/[0.08]">回到学习计划 →</button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* 荣誉金角饰 */}

        <ThaiCorner
          corners={["tr"]}
          size={22}
          className="hidden sm:block"
        />

        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-yellow-300/70">
          <Trophy className="h-4 w-4" />
          THAI LEARNING RANKING
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          学习排行榜
        </h1>

        <p className="mt-2 text-sm text-white/40">
          和其他学习者一起保持学习动力
        </p>
      </motion.div>

      {/* Demo 说明 */}

      <div className="premium-glass card-lift flex items-start gap-3 rounded-2xl p-4">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-300/70" />

        <p className="text-xs leading-relaxed text-white/40">
          <span className="font-semibold text-white/70">
            Demo 数据
          </span>
          {" · "}
          排行榜服务准备中，当前展示示例数据用于体验。接入后端后将自动显示真实学习数据。
        </p>
      </div>

      {/* 标签页 */}

      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5 backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-emerald-400/20 to-teal-400/15 text-emerald-200 shadow-inner"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 前三名领奖台 */}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid gap-4 md:grid-cols-3"
        >
          {podium.map((user, index) => (
            <motion.div
              key={user.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`premium-glass card-lift relative overflow-hidden rounded-3xl p-6 text-center backdrop-blur-xl ${
                index === 0
                  ? "border-yellow-300/15 bg-gradient-to-br from-yellow-300/[0.10] to-white/[0.02]"
                  : "border-white/[0.08] bg-white/[0.035]"
              }`}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-400/[0.06] blur-2xl" />

              <div className="relative">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 ${user.color}`}
                >
                  {index === 0 ? (
                    <Crown className="h-7 w-7" />
                  ) : (
                    <Trophy className="h-6 w-6 opacity-70" />
                  )}
                </div>

                <p className="mt-4 font-bold text-white">
                  {user.name}
                </p>

                <p className="mt-1 text-xs text-white/30">
                  第 {index + 1} 名
                </p>

                <p className="mt-5 text-2xl font-black text-yellow-200">
                  {formatPoints(user[activeTab])}
                </p>

                <p className="text-xs text-white/30">
                  {tabs.find((t) => t.key === activeTab).label}积分
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* 泰式装饰分隔线 */}

      <ThaiSectionDivider
        className="mx-auto max-w-2xl"
        compact
      />

      {/* 完整榜单 */}

      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <span className="text-xs font-semibold text-white/40">
            完整榜单
          </span>

          <span className="text-[10px] text-white/25">
            按{tabs.find((t) => t.key === activeTab).label}积分排序
          </span>
        </div>

        {rest.map((user, listIndex) => {
          const rank = listIndex + 4;

          return (
            <div
              key={user.name}
              className={`flex items-center gap-4 border-b border-white/[0.05] px-5 py-4 last:border-0 ${
                user.isMe
                  ? "bg-emerald-400/[0.07]"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black ${
                  rank <= 3
                    ? "bg-yellow-300/10 text-yellow-300"
                    : "bg-white/[0.05] text-white/30"
                }`}
              >
                {rank}
              </div>

              {/* 头像（首字母） */}

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-sm font-bold ${user.color}`}
              >
                {user.name.slice(0, 1)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  {user.name}
                  {user.isMe && (
                    <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      我
                    </span>
                  )}
                </p>

                <p className="mt-1 flex items-center gap-3 text-[10px] text-white/25">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-300" />
                    连续 {user.streak} 天
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-emerald-300/60" />
                    {user.hours} 小时
                  </span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold text-white">
                  {formatPoints(user[activeTab])}
                </p>

                <p className="text-[10px] text-white/25">
                  {tabs.find((t) => t.key === activeTab).label}积分
                </p>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-2 border-t border-white/[0.05] px-5 py-4">
          <Sparkles className="h-3.5 w-3.5 text-yellow-300/60" />

          <p className="text-[10px] text-white/25">
            完成更多学习任务，提升你的排名！
          </p>
        </div>
      </div>
    </div>
  );
}
