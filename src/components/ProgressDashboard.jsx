import React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Target,
  TrendingUp,
  Flame,
  Bell,
  Trophy,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import ProgressTrendChart from "@/components/charts/ProgressTrendChart";

import { useLearningProgress } from "@/hooks/useLearningProgress";

const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

/* =========================
   最近 7 天
========================= */

const getLast7Days = (history = []) => {
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const dateStr = date.toISOString().split("T")[0];

    const entry = history.find(
      (item) => item.date === dateStr
    );

    result.push({
      day: dayNames[date.getDay()],
      words: entry?.words || 0,
      accuracy: entry?.accuracy || 0,
    });
  }

  return result;
};

/* =========================
   等级
========================= */

const getLevelInfo = (level) => {
  switch (level) {
    case "advanced":
      return {
        name: "高级学习者",
        english: "ADVANCED LEARNER",
        emoji: "🏆",
        next: null,
        color: "gold",
      };

    case "intermediate":
      return {
        name: "进阶学习者",
        english: "INTERMEDIATE LEARNER",
        emoji: "🥈",
        next: 500,
        color: "emerald",
      };

    default:
      return {
        name: "初级学习者",
        english: "BEGINNER",
        emoji: "🌱",
        next: 100,
        color: "emerald",
      };
  }
};

/* =========================
   Dashboard
========================= */

export default function ProgressDashboard() {
  const {
    progress,
    loading,
  } = useLearningProgress();

  const data = progress || {
    today_words: 0,
    total_vocabulary: 0,
    accuracy_rate: 0,
    learning_streak: 0,
    level: "beginner",
    daily_history: [],
  };

  const levelInfo = getLevelInfo(data.level);

  /* =========================
     等级进度
  ========================= */

  let levelProgress = 0;

  if (data.level === "beginner") {
    levelProgress = Math.min(
      ((data.total_vocabulary || 0) / 100) * 100,
      100
    );
  } else if (data.level === "intermediate") {
    levelProgress = Math.min(
      (((data.total_vocabulary || 0) - 100) / 400) * 100,
      100
    );
  } else {
    levelProgress = 100;
  }

  const chartData = getLast7Days(
    data.daily_history
  );

  /* =========================
     统计数据
  ========================= */

  const stats = [
    {
      label: "今日已学",
      value: loading ? "—" : data.today_words || 0,
      suffix: "词",
      icon: BookOpen,
      hint: "TODAY",
    },
    {
      label: "累计词汇",
      value: loading ? "—" : data.total_vocabulary || 0,
      suffix: "词",
      icon: Target,
      hint: "TOTAL",
    },
    {
      label: "学习正确率",
      value: loading ? "—" : data.accuracy_rate || 0,
      suffix: "%",
      icon: TrendingUp,
      hint: "ACCURACY",
    },
    {
      label: "连续学习",
      value: loading ? "—" : data.learning_streak || 0,
      suffix: "天",
      icon: Flame,
      hint: "STREAK",
    },
  ];

  return (
    <div className="space-y-4">

      {/* =========================
          顶部状态
      ========================= */}

      <div className="flex items-center justify-between px-1">

        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />

            <span className="text-[10px] font-semibold tracking-[0.22em] text-emerald-200/70">
              LEARNING ANALYTICS
            </span>
          </div>

          <p className="mt-1 text-xs text-white/30">
            你的泰语学习轨迹
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

          <span className="text-[9px] font-medium text-emerald-200/60">
            LEARNING
          </span>
        </div>

      </div>

      {/* =========================
          四项数据
      ========================= */}

      <div className="grid grid-cols-2 gap-2.5">

        {stats.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <motion.div
              key={stat.label}
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.06,
              }}
              whileHover={{
                y: -2,
              }}
              className="
                group
                relative
                overflow-hidden
                rounded-2xl
                border
                border-white/[0.08]
                bg-white/[0.035]
                p-3.5
                backdrop-blur-xl
                transition-all
                duration-300
                hover:border-emerald-300/15
                hover:bg-white/[0.055]
              "
            >

              {/* 光晕 */}

              <div className="
                pointer-events-none
                absolute
                -right-8
                -top-8
                h-20
                w-20
                rounded-full
                bg-emerald-400/[0.07]
                blur-2xl
                transition-all
                group-hover:bg-emerald-400/[0.12]
              " />

              <div className="relative">

                <div className="flex items-center justify-between">

                  <div className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/[0.08]
                    bg-white/[0.05]
                  ">
                    <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  </div>

                  <span className="text-[8px] tracking-wider text-white/20">
                    {stat.hint}
                  </span>

                </div>

                <div className="mt-3 flex items-baseline gap-1">

                  <span className="
                    text-xl
                    font-bold
                    tracking-tight
                    text-white
                  ">
                    {stat.value}
                  </span>

                  <span className="text-[10px] text-white/30">
                    {stat.suffix}
                  </span>

                </div>

                <p className="mt-0.5 text-[10px] text-white/35">
                  {stat.label}
                </p>

              </div>
            </motion.div>
          );
        })}

      </div>

      {/* =========================
          当前等级
      ========================= */}

      <motion.div
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.25,
        }}
        className="
          group
          relative
          overflow-hidden
          rounded-2xl
          border
          border-yellow-300/[0.12]
          bg-gradient-to-br
          from-yellow-300/[0.08]
          via-white/[0.025]
          to-emerald-400/[0.06]
          p-4
          backdrop-blur-xl
        "
      >

        <div className="
          pointer-events-none
          absolute
          -right-12
          -top-12
          h-32
          w-32
          rounded-full
          bg-yellow-300/[0.08]
          blur-3xl
        " />

        <div className="
          pointer-events-none
          absolute
          bottom-0
          left-1/3
          h-20
          w-40
          rounded-full
          bg-emerald-400/[0.05]
          blur-3xl
        " />

        <div className="relative">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-yellow-300/10
                bg-yellow-300/[0.06]
                text-lg
                shadow-[0_0_25px_rgba(250,204,21,0.08)]
              ">
                {levelInfo.emoji}
              </div>

              <div>

                <div className="
                  text-[8px]
                  font-semibold
                  tracking-[0.2em]
                  text-yellow-200/40
                ">
                  CURRENT LEVEL
                </div>

                <div className="mt-0.5 text-sm font-bold text-white">
                  {levelInfo.name}
                </div>

              </div>

            </div>

            <Trophy className="h-5 w-5 text-yellow-300/50" />

          </div>

          <div className="mt-4">

            <div className="mb-2 flex items-center justify-between">

              <span className="text-[9px] text-white/30">
                {levelInfo.english}
              </span>

              <span className="text-[9px] font-medium text-yellow-200/60">
                {data.total_vocabulary || 0}
                {levelInfo.next
                  ? ` / ${levelInfo.next}`
                  : " 词"}
              </span>

            </div>

            <div className="
              h-1.5
              overflow-hidden
              rounded-full
              bg-white/[0.06]
            ">
              <motion.div
                initial={{
                  width: 0,
                }}
                animate={{
                  width: `${levelProgress}%`,
                }}
                transition={{
                  duration: 1,
                  ease: "easeOut",
                }}
                className="
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-yellow-300
                  via-amber-300
                  to-emerald-300
                  shadow-[0_0_12px_rgba(250,204,21,0.25)]
                "
              />
            </div>

          </div>

        </div>
      </motion.div>

      {/* =========================
          学习趋势
      ========================= */}

      <motion.div
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.3,
        }}
        className="
          overflow-hidden
          rounded-2xl
          border
          border-white/[0.08]
          bg-white/[0.035]
          p-4
          backdrop-blur-xl
        "
      >

        <div className="mb-3 flex items-start justify-between">

          <div>

            <div className="flex items-center gap-2">

              <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />

              <h3 className="text-sm font-semibold text-white">
                学习趋势
              </h3>

            </div>

            <p className="mt-1 text-[9px] text-white/25">
              最近 7 天的学习表现
            </p>

          </div>

          <div className="
            flex
            items-center
            gap-2.5
            rounded-full
            border
            border-white/[0.06]
            bg-white/[0.025]
            px-2.5
            py-1.5
          ">

            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
              <span className="text-[8px] text-white/30">
                词汇
              </span>
            </span>

            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span className="text-[8px] text-white/30">
                正确率
              </span>
            </span>

          </div>

        </div>

        <div className="h-36">
          <ProgressTrendChart data={chartData} />
        </div>

      </motion.div>

      {/* =========================
          今日学习提醒
      ========================= */}

      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          delay: 0.4,
        }}
        className="
          group
          relative
          overflow-hidden
          rounded-2xl
          border
          border-emerald-300/[0.10]
          bg-gradient-to-br
          from-emerald-500/[0.13]
          via-emerald-400/[0.055]
          to-teal-500/[0.08]
          p-4
        "
      >

        <div className="
          pointer-events-none
          absolute
          -right-10
          -top-10
          h-24
          w-24
          rounded-full
          bg-emerald-300/[0.10]
          blur-2xl
        " />

        <div className="relative">

          <div className="flex items-start justify-between">

            <div className="flex items-center gap-2">

              <div className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-xl
                border
                border-yellow-300/10
                bg-yellow-300/[0.06]
              ">
                <Bell className="h-3.5 w-3.5 text-yellow-300" />
              </div>

              <div>

                <div className="text-xs font-semibold text-white">
                  今日学习
                </div>

                <div className="text-[9px] text-white/30">
                  KEEP GOING
                </div>

              </div>

            </div>

            <ArrowUpRight className="
              h-4
              w-4
              text-white/15
              transition-transform
              group-hover:-translate-y-0.5
              group-hover:translate-x-0.5
            " />

          </div>

          <p className="mt-3 text-sm font-medium text-white">

            今天已经学习了{" "}

            <span className="
              text-lg
              font-black
              text-yellow-300
            ">
              {loading
                ? "—"
                : data.today_words || 0}
            </span>{" "}

            个单词

          </p>

          <p className="mt-1 text-[9px] leading-5 text-white/30">
            每天坚持一点点，泰语会越来越自然。
          </p>

          <button
            onClick={() =>
              document
                .getElementById("vocab-card")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
            }
            className="
              mt-3
              flex
              items-center
              gap-1.5
              rounded-xl
              border
              border-white/[0.08]
              bg-white/[0.05]
              px-3
              py-1.5
              text-[10px]
              font-medium
              text-white/55
              backdrop-blur-sm
              transition-all
              hover:border-emerald-300/15
              hover:bg-white/[0.09]
              hover:text-white
            "
          >
            继续学习
            <ArrowUpRight className="h-3 w-3" />
          </button>

        </div>
      </motion.div>

    </div>
  );
}