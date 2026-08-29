import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Mic,
  ChevronLeft,
  ChevronRight,
  Square,
  Loader2,
  AlertCircle,
  Sparkles,
  Headphones,
  RotateCcw,
  CheckCircle2,
  Brain,
} from "lucide-react";

import { usePronunciationAnalysis } from "@/hooks/usePronunciationAnalysis";
import { speakThai } from "@/lib/thaiSpeech";

export default function OralPractice({ words, onExit }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    recording,
    analyzing,
    result,
    error,
    startRecording,
    stopRecording,
    reset,
  } = usePronunciationAnalysis();

  const current = words[currentIndex];

  /* =========================
     泰语发音
  ========================= */

  const speak = (text) => {
    if (!text) return;
    speakThai(text, { rate: 0.75 });
  };

  /* =========================
     切换单词
  ========================= */

  const go = (dir) => {
    if (recording) {
      stopRecording();
    }

    setCurrentIndex((index) =>
      Math.max(
        0,
        Math.min(
          index + dir,
          words.length - 1
        )
      )
    );

    reset();
  };

  /* =========================
     自动播放当前单词
  ========================= */

  useEffect(() => {
    if (!current?.thai_word) return;

    const timer = setTimeout(() => {
      speak(current.thai_word);
    }, 400);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  /* =========================
     无单词
  ========================= */

  if (!current) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="
          mx-auto
          max-w-2xl
          rounded-[28px]
          border
          border-white/[0.08]
          bg-white/[0.035]
          px-6
          py-20
          text-center
          backdrop-blur-2xl
        "
      >
        <div
          className="
            mx-auto
            mb-5
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-3xl
            border
            border-emerald-300/10
            bg-emerald-400/[0.06]
          "
        >
          <Mic className="h-9 w-9 text-emerald-300/40" />
        </div>

        <h3 className="text-lg font-semibold text-white/70">
          没有可练习的单词
        </h3>

        <p className="mt-2 text-sm text-white/30">
          请先添加或筛选一些泰语词汇
        </p>

        <button
          onClick={onExit}
          className="
            mt-6
            rounded-xl
            bg-gradient-to-r
            from-emerald-400
            to-teal-500
            px-5
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-lg
            shadow-emerald-900/30
          "
        >
          返回词汇
        </button>
      </motion.div>
    );
  }

  /* =========================
     分数颜色
  ========================= */

  const score = result?.score ?? 0;

  const scoreLevel =
    score >= 80
      ? {
          label: "发音优秀",
          text: "text-emerald-300",
          ring: "border-emerald-300/30",
          bg: "bg-emerald-400/10",
        }
      : score >= 60
      ? {
          label: "继续保持",
          text: "text-yellow-200",
          ring: "border-yellow-300/30",
          bg: "bg-yellow-300/10",
        }
      : {
          label: "再练一次",
          text: "text-red-300",
          ring: "border-red-300/30",
          bg: "bg-red-400/10",
        };

  return (
    <div className="mx-auto max-w-3xl">

      {/* =================================
          顶部状态栏
      ================================= */}

      <div className="mb-5 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-emerald-300/10
              bg-emerald-400/[0.06]
            "
          >
            <Mic className="h-4 w-4 text-emerald-300" />
          </div>

          <div>
            <div className="text-xs font-semibold text-white/70">
              AI 口语练习
            </div>

            <div className="mt-0.5 text-[10px] text-white/25">
              THAI SPEAKING LAB
            </div>
          </div>

        </div>

        <div className="flex items-center gap-3">

          <div
            className="
              rounded-full
              border
              border-white/[0.08]
              bg-white/[0.035]
              px-3
              py-1.5
              text-[11px]
              text-white/40
            "
          >
            {currentIndex + 1} / {words.length}
          </div>

          <button
            onClick={onExit}
            className="
              text-xs
              text-white/30
              transition
              hover:text-white/70
            "
          >
            退出练习
          </button>

        </div>

      </div>

      {/* =================================
          总进度
      ================================= */}

      <div
        className="
          mb-5
          h-1
          overflow-hidden
          rounded-full
          bg-white/[0.06]
        "
      >
        <motion.div
          className="
            h-full
            rounded-full
            bg-gradient-to-r
            from-emerald-400
            via-teal-300
            to-yellow-300
          "
          animate={{
            width: `${
              ((currentIndex + 1) /
                words.length) *
              100
            }%`,
          }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* =================================
          主卡片
      ================================= */}

      <AnimatePresence mode="wait">

        <motion.div
          key={currentIndex}
          initial={{
            opacity: 0,
            y: 18,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: -18,
            scale: 0.98,
          }}
          transition={{
            duration: 0.35,
          }}
          className="
            relative
            overflow-hidden
            rounded-[30px]
            border
            border-white/[0.09]
            bg-[#081a19]/80
            p-6
            shadow-[0_25px_90px_rgba(0,0,0,.3)]
            backdrop-blur-2xl
            sm:p-8
          "
        >

          {/* =================================
              背景光效
          ================================= */}

          <div
            className="
              pointer-events-none
              absolute
              -right-24
              -top-24
              h-72
              w-72
              rounded-full
              bg-emerald-400/[0.08]
              blur-[100px]
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-28
              -left-24
              h-72
              w-72
              rounded-full
              bg-yellow-300/[0.05]
              blur-[100px]
            "
          />

          {/* 星空 */}

          <div className="pointer-events-none absolute inset-0 opacity-30">

            <span className="absolute left-[12%] top-[16%] h-1 w-1 rounded-full bg-white" />

            <span className="absolute left-[30%] top-[8%] h-0.5 w-0.5 rounded-full bg-white" />

            <span className="absolute right-[18%] top-[20%] h-1 w-1 rounded-full bg-white" />

            <span className="absolute right-[10%] bottom-[24%] h-0.5 w-0.5 rounded-full bg-white" />

            <span className="absolute left-[20%] bottom-[15%] h-0.5 w-0.5 rounded-full bg-white" />

          </div>

          <div className="relative z-10">

            {/* =================================
                标题
            ================================= */}

            <div className="mb-8 text-center">

              <div
                className="
                  mb-3
                  flex
                  items-center
                  justify-center
                  gap-2
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.22em]
                  text-yellow-300/60
                "
              >
                <Sparkles className="h-3.5 w-3.5" />

                SPEAK & REPEAT
              </div>

              <p className="text-sm text-white/35">
                请大声朗读下面的泰语单词
              </p>

            </div>

            {/* =================================
                泰语单词
            ================================= */}

            <div className="text-center">

              <h2
                className="
                  font-thai
                  text-[52px]
                  font-bold
                  leading-tight
                  tracking-tight
                  text-white
                  drop-shadow-[0_0_30px_rgba(52,211,153,.12)]
                  sm:text-[68px]
                "
              >
                {current.thai_word}
              </h2>

              <p
                className="
                  mt-3
                  text-base
                  font-medium
                  tracking-wide
                  text-cyan-300/70
                "
              >
                [{current.pronunciation}]
              </p>

              <div className="mt-3 flex items-center justify-center gap-2">

                <span className="text-sm text-white/45">
                  {current.chinese_meaning}
                </span>

                <Sparkles className="h-3 w-3 text-yellow-300/30" />

              </div>

              {/* =================================
                  听发音
              ================================= */}

              <button
                onClick={() =>
                  speak(current.thai_word)
                }
                className="
                  mx-auto
                  mt-5
                  flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/[0.09]
                  bg-white/[0.045]
                  px-4
                  py-2
                  text-xs
                  font-medium
                  text-white/55
                  backdrop-blur-xl
                  transition-all
                  hover:border-emerald-300/20
                  hover:bg-emerald-400/[0.08]
                  hover:text-emerald-300
                "
              >
                <Headphones className="h-3.5 w-3.5" />

                听标准发音
              </button>

            </div>

            {/* =================================
                麦克风区域
            ================================= */}

            <div className="my-9 flex flex-col items-center">

              <div className="relative">

                {/* 外层呼吸光圈 */}

                <motion.div
                  animate={
                    recording
                      ? {
                          scale: [1, 1.2, 1],
                          opacity: [
                            0.2,
                            0.5,
                            0.2,
                          ],
                        }
                      : {
                          scale: 1,
                          opacity: 0.15,
                        }
                  }
                  transition={{
                    duration: 1.4,
                    repeat: recording
                      ? Infinity
                      : 0,
                  }}
                  className="
                    absolute
                    -inset-8
                    rounded-full
                    bg-emerald-400
                    blur-2xl
                  "
                />

                {/* 第二层光圈 */}

                <motion.div
                  animate={
                    recording
                      ? {
                          scale: [1, 1.12, 1],
                        }
                      : {
                          scale: 1,
                        }
                  }
                  transition={{
                    duration: 1,
                    repeat: recording
                      ? Infinity
                      : 0,
                  }}
                  className={`
                    absolute
                    -inset-4
                    rounded-full
                    border
                    ${
                      recording
                        ? "border-red-400/40"
                        : "border-emerald-300/20"
                    }
                  `}
                />

                {/* 麦克风 */}

                <motion.button
                  type="button"
                  onClick={() =>
                    recording
                      ? stopRecording()
                      : startRecording(
                          current.thai_word
                        )
                  }
                  disabled={analyzing}
                  whileHover={{
                    scale: analyzing ? 1 : 1.05,
                  }}
                  whileTap={{
                    scale: 0.94,
                  }}
                  className={`
                    relative
                    z-10
                    flex
                    h-24
                    w-24
                    items-center
                    justify-center
                    rounded-full
                    border-4
                    shadow-2xl
                    transition-all
                    duration-300
                    ${
                      recording
                        ? "border-red-300/30 bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"
                        : "border-emerald-300/15 bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 shadow-emerald-500/25"
                    }
                    ${
                      analyzing
                        ? "cursor-wait opacity-60"
                        : ""
                    }
                  `}
                >

                  {analyzing ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : recording ? (
                    <Square className="h-7 w-7 fill-white text-white" />
                  ) : (
                    <Mic className="h-9 w-9 text-white" />
                  )}

                </motion.button>

              </div>

              <motion.p
                key={
                  analyzing
                    ? "analyzing"
                    : recording
                    ? "recording"
                    : "idle"
                }
                initial={{
                  opacity: 0,
                  y: 5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="
                  mt-5
                  text-xs
                  font-medium
                  text-white/40
                "
              >
                {analyzing
                  ? "AI 正在分析你的发音..."
                  : recording
                  ? "正在录音 · 点击停止"
                  : "点击麦克风开始朗读"}
              </motion.p>

            </div>

            {/* =================================
                错误
            ================================= */}

            {error && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="
                  mb-5
                  flex
                  items-start
                  gap-3
                  rounded-2xl
                  border
                  border-red-300/10
                  bg-red-400/[0.07]
                  p-4
                "
              >

                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />

                <div>

                  <p className="text-xs font-medium text-red-200">
                    发音分析失败
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-200/50">
                    {error}
                  </p>

                </div>

              </motion.div>
            )}

            {/* =================================
                分析结果
            ================================= */}

            {result && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="space-y-3"
              >

                {/* 分数 */}

                <div
                  className="
                    relative
                    overflow-hidden
                    rounded-2xl
                    border
                    border-white/[0.08]
                    bg-white/[0.035]
                    p-5
                  "
                >

                  <div
                    className="
                      pointer-events-none
                      absolute
                      -right-10
                      -top-10
                      h-32
                      w-32
                      rounded-full
                      bg-emerald-400/[0.06]
                      blur-3xl
                    "
                  />

                  <div className="relative flex items-center gap-4">

                    <div
                      className={`
                        flex
                        h-20
                        w-20
                        flex-shrink-0
                        items-center
                        justify-center
                        rounded-full
                        border
                        ${scoreLevel.ring}
                        ${scoreLevel.bg}
                      `}
                    >

                      <div className="text-center">

                        <div
                          className={`
                            text-2xl
                            font-black
                            ${scoreLevel.text}
                          `}
                        >
                          {score}
                        </div>

                        <div className="text-[8px] text-white/25">
                          SCORE
                        </div>

                      </div>

                    </div>

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <CheckCircle2
                          className={`
                            h-4
                            w-4
                            ${scoreLevel.text}
                          `}
                        />

                        <p
                          className={`
                            text-sm
                            font-bold
                            ${scoreLevel.text}
                          `}
                        >
                          {scoreLevel.label}
                        </p>

                      </div>

                      <p className="mt-1 text-xs text-white/30">
                        发音准确度
                      </p>

                      {result.transcription && (
                        <p className="mt-2 truncate text-xs text-white/55">
                          识别：
                          <span className="text-cyan-300/70">
                            {result.transcription}
                          </span>
                        </p>
                      )}

                    </div>

                  </div>

                </div>

                {/* AI 反馈 */}

                <div
                  className="
                    rounded-2xl
                    border
                    border-emerald-300/[0.08]
                    bg-gradient-to-br
                    from-emerald-400/[0.08]
                    to-white/[0.025]
                    p-5
                  "
                >

                  <div className="mb-3 flex items-center gap-2">

                    <div
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-xl
                        bg-emerald-400/10
                      "
                    >
                      <Brain className="h-4 w-4 text-emerald-300" />
                    </div>

                    <div>

                      <p className="text-xs font-semibold text-white/70">
                        AI 发音分析
                      </p>

                      <p className="text-[9px] text-white/25">
                        PERSONALIZED FEEDBACK
                      </p>

                    </div>

                  </div>

                  {result.feedback && (
                    <p className="text-sm leading-6 text-white/65">
                      {result.feedback}
                    </p>
                  )}

                  {result.tips && (
                    <div
                      className="
                        mt-4
                        rounded-xl
                        border
                        border-yellow-300/[0.08]
                        bg-yellow-300/[0.04]
                        p-3
                      "
                    >

                      <div className="flex gap-2">

                        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-300/70" />

                        <p className="text-xs leading-5 text-yellow-100/50">
                          {result.tips}
                        </p>

                      </div>

                    </div>
                  )}

                </div>

                {/* 重新练习 */}

                <div className="flex justify-center">

                  <button
                    onClick={reset}
                    className="
                      flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-white/[0.035]
                      px-4
                      py-2
                      text-xs
                      font-medium
                      text-white/45
                      transition-all
                      hover:bg-white/[0.07]
                      hover:text-white
                    "
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    再练一次
                  </button>

                </div>

              </motion.div>
            )}

            {/* =================================
                例句
            ================================= */}

            {current.example_thai && (
              <div
                className="
                  mt-7
                  rounded-2xl
                  border
                  border-white/[0.06]
                  bg-black/[0.14]
                  p-4
                "
              >

                <div className="mb-2 flex items-center gap-2">

                  <span
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.18em]
                      text-emerald-300/40
                    "
                  >
                    EXAMPLE
                  </span>

                  <div
                    className="
                      h-px
                      flex-1
                      bg-gradient-to-r
                      from-emerald-300/10
                      to-transparent
                    "
                  />

                </div>

                <p
                  className="
                    font-thai
                    text-sm
                    leading-6
                    text-emerald-100/65
                  "
                >
                  {current.example_thai}
                </p>

                {current.example_chinese && (
                  <p className="mt-1 text-xs text-white/30">
                    {current.example_chinese}
                  </p>
                )}

                <button
                  onClick={() =>
                    speak(current.example_thai)
                  }
                  className="
                    mt-3
                    flex
                    items-center
                    gap-2
                    text-xs
                    text-cyan-300/50
                    transition
                    hover:text-cyan-300
                  "
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  听例句
                </button>

              </div>
            )}

            {/* =================================
                底部导航
            ================================= */}

            <div
              className="
                mt-7
                flex
                items-center
                justify-between
                border-t
                border-white/[0.06]
                pt-5
              "
            >

              <button
                onClick={() => go(-1)}
                disabled={currentIndex === 0}
                className="
                  flex
                  items-center
                  gap-1.5
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-white/[0.035]
                  px-3
                  py-2.5
                  text-xs
                  text-white/45
                  transition-all
                  hover:bg-white/[0.07]
                  hover:text-white
                  disabled:pointer-events-none
                  disabled:opacity-20
                "
              >
                <ChevronLeft className="h-4 w-4" />
                上一个
              </button>

              <div className="flex items-center gap-1.5">

                {Array.from({
                  length: Math.min(
                    words.length,
                    5
                  ),
                }).map((_, index) => {

                  const start = Math.max(
                    0,
                    Math.min(
                      currentIndex - 2,
                      words.length - 5
                    )
                  );

                  const actualIndex =
                    start + index;

                  return (
                    <span
                      key={actualIndex}
                      className={`
                        h-1.5
                        rounded-full
                        transition-all
                        ${
                          actualIndex ===
                          currentIndex
                            ? "w-5 bg-emerald-300"
                            : "w-1.5 bg-white/10"
                        }
                      `}
                    />
                  );
                })}

              </div>

              <button
                onClick={() => go(1)}
                disabled={
                  currentIndex ===
                  words.length - 1
                }
                className="
                  flex
                  items-center
                  gap-1.5
                  rounded-xl
                  border
                  border-emerald-300/10
                  bg-emerald-400/[0.06]
                  px-3
                  py-2.5
                  text-xs
                  text-emerald-300/70
                  transition-all
                  hover:bg-emerald-400/10
                  hover:text-emerald-300
                  disabled:pointer-events-none
                  disabled:opacity-20
                "
              >
                下一个
                <ChevronRight className="h-4 w-4" />
              </button>

            </div>

          </div>

        </motion.div>

      </AnimatePresence>
    </div>
  );
}