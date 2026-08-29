import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Volume2,
  Sparkles,
  ChevronRight,
  Heart,
} from "lucide-react";

import { RippleButton } from "@/components/ui/premium";
import { ThaiPatternOverlay } from "@/components/common/ThaiMotifs";
import { speakThai } from "@/lib/thaiSpeech";
import { useVocabFavorites } from "@/hooks/useVocabFavorites";

const difficultyLabels = {
  beginner: {
    label: "初级",
    className:
      "border-emerald-300/15 bg-emerald-400/10 text-emerald-300",
  },
  intermediate: {
    label: "中级",
    className:
      "border-yellow-300/15 bg-yellow-300/10 text-yellow-200",
  },
  advanced: {
    label: "高级",
    className:
      "border-orange-300/15 bg-orange-400/10 text-orange-300",
  },
};

export default function VocabGridItem({ item, index }) {
  const [speaking, setSpeaking] = useState(false);
  const { toggleFavorite, isFavorite } = useVocabFavorites();

  const wordId = item.id || `${item.thai_word}-${index}`;
  const favorited = isFavorite(wordId);

  const speak = (text) => {
    if (!text) return;

    speakThai(text, {
      rate: 0.75,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const diff =
    difficultyLabels[item.difficulty] ||
    difficultyLabels.beginner;
  const imageUrl = item.image || item.image_url || item.imageUrl;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: index * 0.035,
        duration: 0.35,
      }}
      whileHover={{
        y: -4,
      }}
      className="
        group
        relative
        overflow-hidden
        rounded-3xl
        premium-glass
        card-lift
        card-glow-emerald
        transition-all
      "
    >
      {/* 极淡泰式纹样（卡片背景） */}

      <ThaiPatternOverlay
        patternId={`thai-card-${index}`}
        opacity={0.05}
      />

      {/* 顶部光晕 */}

      <div
        className="
          pointer-events-none
          absolute
          -right-16
          -top-16
          h-36
          w-36
          rounded-full
          bg-emerald-400/[0.08]
          blur-3xl
          transition-all
          duration-500
          group-hover:bg-emerald-400/[0.14]
        "
      />

      {/* 底部微光 */}

      <div
        className="
          pointer-events-none
          absolute
          -bottom-20
          -left-20
          h-40
          w-40
          rounded-full
          bg-yellow-300/[0.05]
          blur-3xl
        "
      />

      {/* 内侧高光 */}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative p-4 sm:p-5">
        {imageUrl && (
          <div className="mb-4 h-28 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={(event) => { event.currentTarget.parentElement.style.display = "none"; }}
            />
          </div>
        )}

        {/* =========================
            标签区域 + 收藏按钮
        ========================= */}

        <div className="mb-4 flex items-start justify-between gap-2 sm:mb-5">

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">

            {item.category && (
              <span
                className="
                  rounded-full
                  border
                  border-white/[0.07]
                  bg-white/[0.045]
                  px-2.5
                  py-1
                  text-[10px]
                  font-medium
                  text-white/40
                "
              >
                {item.category}
              </span>
            )}

            {item.part_of_speech && (
              <span
                className="
                  rounded-full
                  border
                  border-yellow-300/[0.12]
                  bg-yellow-300/[0.05]
                  px-2.5
                  py-1
                  text-[10px]
                  font-medium
                  text-yellow-200/50
                "
              >
                {item.part_of_speech}
              </span>
            )}

            <span
              className={`
                rounded-full
                border
                px-2.5
                py-1
                text-[10px]
                font-medium
                ${diff.className}
              `}
            >
              {diff.label}
            </span>

          </div>

          <div className="flex items-center gap-1.5">
            {/* 收藏按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(wordId);
              }}
              aria-label={favorited ? "取消收藏" : "收藏"}
              className={`
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                border
                transition-all
                ${
                  favorited
                    ? "border-pink-300/40 bg-pink-400/15 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.2)]"
                    : "border-white/[0.1] bg-white/[0.05] text-white/30 hover:border-pink-300/25 hover:bg-pink-400/10 hover:text-pink-300"
                }
              `}
            >
              <Heart
                className={`h-3.5 w-3.5 ${favorited ? "fill-current" : ""}`}
              />
            </button>

            {/* 发音按钮（波纹反馈） */}

            <RippleButton
              onClick={() =>
                speak(item.thai_word)
              }
              aria-label="播放泰语发音"
              rippleColor={
                speaking
                  ? "rgba(52,211,153,0.35)"
                  : "rgba(255,255,255,0.18)"
              }
              className={`
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                border
                transition-all
                ${
                  speaking
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
                    : "border-white/[0.1] bg-white/[0.05] text-white/40 hover:border-emerald-300/25 hover:bg-emerald-400/10 hover:text-emerald-300 hover:shadow-[0_0_16px_rgba(52,211,153,0.15)]"
                }
              `}
            >
              <Volume2
                className={`h-4 w-4 ${
                  speaking
                    ? "animate-pulse"
                    : ""
                }`}
              />
            </RippleButton>
          </div>

        </div>

        {/* =========================
            泰语单词（加大字体）
        ========================= */}

        <div className="mb-4">

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">

            <Sparkles
              className="
                h-3.5
                w-3.5
                text-yellow-300/40
              "
            />

            <span
              className="
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.22em]
                text-white/20
              "
            >
              Thai Word
            </span>

          </div>

          <h3
            className="
              mt-2
              font-thai
              text-[2.4rem]
              font-black
              break-words
              sm:text-[3rem]
              leading-tight
              tracking-tight
              text-white
              transition-colors
              duration-300
              group-hover:text-emerald-100
            "
          >
            {item.thai_word}
          </h3>

          {/* 发音高亮 */}

          {item.pronunciation && (
            <p
              className="
                mt-2
                inline-flex
                items-center
                gap-1.5
                rounded-full
                border
                border-emerald-300/20
                bg-emerald-400/[0.08]
                px-3
                py-1
                text-sm
                font-semibold
                text-emerald-300/90
                shadow-[0_0_12px_rgba(52,211,153,0.08)]
              "
            >
              <Volume2 className="h-3 w-3 text-emerald-400/60" />
              [{item.pronunciation}]
            </p>
          )}

        </div>

        {/* =========================
            中文释义
        ========================= */}

        <div
          className="
            mb-4
            rounded-xl
            border
            border-white/[0.06]
            bg-black/[0.14]
            px-3.5
            py-3
          "
        >

          <div className="text-[9px] tracking-wider text-white/20">
            中文释义
          </div>

          <p
            className="
              mt-1
              text-[16px]
              font-semibold
              leading-relaxed
              text-white/85
            "
          >
            {item.chinese_meaning}
          </p>

        </div>

        {/* =========================
            例句
        ========================= */}

        {item.example_thai && (
          <div
            className="
              mb-2
              rounded-xl
              border
              border-emerald-300/10
              bg-emerald-400/[0.04]
              px-3.5
              py-3
            "
          >

            <div className="mb-2 flex items-center justify-between">

              <span
                className="
                  flex
                  items-center
                  gap-1
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-emerald-300/40
                "
              >
                <Sparkles className="h-3 w-3" />
                例句
              </span>

              <button
                onClick={() =>
                  speak(
                    item.example_thai
                  )
                }
                className="
                  flex
                  items-center
                  gap-1
                  rounded-full
                  border
                  border-white/[0.06]
                  bg-white/[0.03]
                  px-2
                  py-1
                  text-[10px]
                  text-white/30
                  transition-colors
                  hover:border-emerald-300/20
                  hover:text-emerald-300
                "
              >
                <Volume2 className="h-3 w-3" />
                听
              </button>

            </div>

            <p
              className="
                font-thai
                text-[15px]
                leading-relaxed
                text-emerald-100/75
              "
            >
              {item.example_thai}
            </p>

            {item.example_chinese && (
              <p
                className="
                  mt-1.5
                  text-[13px]
                  leading-relaxed
                  text-white/35
                "
              >
                {item.example_chinese}
              </p>
            )}

          </div>
        )}

        {/* =========================
            底部装饰
        ========================= */}

        <div
          className="
            mt-3
            flex
            items-center
            justify-end
            gap-1
            text-[10px]
            text-white/15
            transition-all
            group-hover:text-emerald-300/40
          "
        >
          <span>继续学习</span>

          <ChevronRight
            className="
              h-3
              w-3
              transition-transform
              group-hover:translate-x-0.5
            "
          />
        </div>

      </div>
    </motion.div>
  );
}
