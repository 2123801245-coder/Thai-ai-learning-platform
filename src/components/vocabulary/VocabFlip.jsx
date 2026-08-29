import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Volume2,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  MousePointerClick,
} from "lucide-react";

import { RippleButton } from "@/components/ui/premium";
import { ThaiPatternOverlay } from "@/components/common/ThaiMotifs";
import { speakThai } from "@/lib/thaiSpeech";

const MAX_WORDS = 60;

export default function VocabFlip({ words, onExit }) {
  const [sessionSeed, setSessionSeed] = useState(0);
  const [reviewPool, setReviewPool] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => new Set());
  const [speaking, setSpeaking] = useState(false);

  /* 会话词表：洗牌、截断 */
  const sessionWords = useMemo(() => {
    if (!words || words.length === 0) return [];

    return [...words]
      .filter((word) => word.thai_word)
      .sort(() => Math.random() - 0.5)
      .slice(0, MAX_WORDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, sessionSeed]);

  /* 复习模式优先使用错词表 */
  const wordsForSession = reviewPool || sessionWords;

  const current = wordsForSession[index];
  const isFinished = wordsForSession.length > 0 && index >= wordsForSession.length;

  const wordId = (word, i) => word.id ?? `${word.thai_word}-${i}`;

  const speak = (text) => {
    if (!text) return;

    speakThai(text, {
      rate: 0.75,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const goNext = (isKnown) => {
    if (!current) return;

    setKnown((prev) => {
      const next = new Set(prev);
      if (isKnown) {
        next.add(wordId(current, index));
      } else {
        next.delete(wordId(current, index));
      }
      return next;
    });

    setFlipped(false);

    setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, 120);
  };

  const restart = (withUnknown = false) => {
    if (withUnknown) {
      const unknown = wordsForSession.filter(
        (word, i) => !known.has(wordId(word, i))
      );

      if (unknown.length === 0) {
        restart();
        return;
      }

      /* 复习模式：只保留没记住的词，重新洗牌 */
      setReviewPool(
        [...unknown].sort(() => Math.random() - 0.5)
      );
    } else {
      setReviewPool(null);
      setSessionSeed((prev) => prev + 1);
    }

    setIndex(0);
    setFlipped(false);
    setKnown(new Set());
  };

  /* 键盘：空格翻面、←→ 换卡 */
  useEffect(() => {
    if (isFinished) return;

    const onKey = (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === "ArrowRight") {
        setIndex((prev) => Math.min(wordsForSession.length - 1, prev + 1));
        setFlipped(false);
      } else if (event.key === "ArrowLeft") {
        setIndex((prev) => Math.max(0, prev - 1));
        setFlipped(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFinished, wordsForSession.length]);

  /* =========================
     结分屏
  ========================= */

  if (isFinished) {
    const total = wordsForSession.length;
    const knownCount = wordsForSession.filter((word, i) =>
      known.has(wordId(word, i))
    ).length;

    const pct = Math.round((knownCount / total) * 100);

    let text = "继续保持！";
    if (pct >= 90) text = "太棒了！这些词你已经牢牢掌握了。";
    else if (pct >= 70) text = "不错！再复习一遍没记住的词就稳了。";
    else if (pct >= 50) text = "有基础了，把没记住的词过一遍会明显提升。";
    else text = "别着急，把没记住的词重点过一遍。";

    return (
      <div className="relative mx-auto flex min-h-[520px] max-w-2xl items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-yellow-400/10 blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 120 }}
          className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-2xl backdrop-blur-2xl"
        >
          <ThaiPatternOverlay patternId="flip-result" opacity={0.04} />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-yellow-400/[0.06] via-transparent to-emerald-400/[0.05]" />

          <div className="relative">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180 }}
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-300/[0.08] shadow-[0_0_60px_rgba(250,204,21,0.15)]"
            >
              <Sparkles className="h-11 w-11 text-yellow-300" />
            </motion.div>

            <div className="mb-2 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300/60">
              <Sparkles className="h-3.5 w-3.5" />
              Session Complete
            </div>

            <h2 className="text-3xl font-black text-white">
              一轮翻转完成
            </h2>

            <p className="mt-3 text-sm text-white/45">{text}</p>

            <div className="mt-8">
              <div className="text-5xl font-black tracking-tight text-emerald-300">
                {knownCount}
                <span className="mx-1 text-2xl text-white/20">/</span>
                {total}
              </div>
              <div className="mt-2 text-sm text-white/40">记住了 {pct}%</div>
            </div>

            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
              />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => restart(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
              >
                <RotateCcw className="h-4 w-4" />
                复习错词
              </button>

              <button
                onClick={() => restart(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.06] px-4 py-3 text-sm font-medium text-yellow-200 transition hover:-translate-y-0.5 hover:bg-yellow-300/[0.1]"
              >
                <Sparkles className="h-4 w-4" />
                再来一轮
              </button>

              <button
                onClick={onExit}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                返回词汇
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  /* =========================
     空态
  ========================= */

  if (!current) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-300/10 bg-yellow-300/[0.06]">
            <Sparkles className="h-9 w-9 text-yellow-300/50" />
          </div>
          <h2 className="text-xl font-bold text-white">暂时没有可背的单词</h2>
          <p className="mt-2 text-sm text-white/40">调整筛选条件后再试试</p>
          <button
            onClick={onExit}
            className="mt-6 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
          >
            返回词汇
          </button>
        </div>
      </div>
    );
  }

  const total = wordsForSession.length;
  const progress = ((index + 1) / total) * 100;
  const cardId = wordId(current, index);
  const isKnown = known.has(cardId);

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute -left-32 top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-[100px]" />
      <div className="pointer-events-none absolute -right-32 bottom-20 h-64 w-64 rounded-full bg-yellow-400/10 blur-[100px]" />

      {/* 顶部 */}
      <div className="relative mb-5 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          退出背词
        </button>

        <div className="text-right">
          <div className="text-xs text-white/30">当前进度</div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            {index + 1}
            <span className="text-white/25"> / {total}</span>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="relative mb-7 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>

      {/* =========================
          翻转卡片
      ========================= */}

      <div className="relative [perspective:1400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={cardId}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0, rotateY: flipped ? 180 : 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{
              duration: 0.45,
              type: "spring",
              stiffness: 140,
              damping: 20,
            }}
            style={{ transformStyle: "preserve-3d" }}
            onClick={() => setFlipped((value) => !value)}
            className="relative h-[400px] cursor-pointer sm:h-[440px]"
          >
            {/* ======= 正面：泰语 ======= */}
            <div
              style={{ backfaceVisibility: "hidden" }}
              className="premium-glass card-lift absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[30px] p-8"
            >
              <ThaiPatternOverlay patternId={`flip-front-${cardId}`} opacity={0.05} />

              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.09] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-yellow-300/[0.06] blur-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="relative flex flex-col items-center">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  Thai Word
                </div>

                {current.image || current.image_url || current.imageUrl ? (
                  <img src={current.image || current.image_url || current.imageUrl} alt="" loading="lazy" className="mb-4 h-24 w-40 rounded-2xl border border-white/10 object-cover opacity-90" />
                ) : null}
                <h2 className="font-thai text-center text-6xl font-black leading-tight tracking-tight text-white drop-shadow-[0_0_30px_rgba(52,211,153,0.25)] sm:text-7xl">
                  {current.thai_word}
                </h2>

                {current.pronunciation && (
                  <p className="mt-4 text-base font-medium text-emerald-300/70">
                    [{current.pronunciation}]
                  </p>
                )}

                <RippleButton
                  onClick={(event) => {
                    event.stopPropagation();
                    speak(current.thai_word);
                  }}
                  aria-label="播放泰语发音"
                  rippleColor="rgba(52,211,153,0.35)"
                  className={`mt-7 flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
                    speaking
                      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.3)]"
                      : "border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-300 hover:scale-105 hover:bg-emerald-400/[0.15] hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]"
                  }`}
                >
                  <Volume2 className={`h-5 w-5 ${speaking ? "animate-pulse" : ""}`} />
                </RippleButton>

                <div className="mt-8 flex items-center gap-2 text-xs text-white/25">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  点击卡片查看释义
                </div>
              </div>
            </div>

            {/* ======= 背面：释义 ======= */}
            <div
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
              className="premium-glass absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[30px] p-8"
            >
              <ThaiPatternOverlay patternId={`flip-back-${cardId}`} opacity={0.04} />

              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/[0.07] blur-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-300/15 to-transparent" />

              <div className="relative flex w-full flex-col items-center">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  Meaning
                </div>

                <h3 className="text-center text-3xl font-black leading-snug tracking-tight text-white sm:text-4xl">
                  {current.chinese_meaning}
                </h3>

                {current.pronunciation && (
                  <p className="mt-3 text-sm font-medium text-emerald-300/60">
                    [{current.pronunciation}]
                  </p>
                )}

                {current.example_thai && (
                  <div className="mt-6 w-full rounded-2xl border border-white/[0.07] bg-black/[0.16] px-5 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                        Example
                      </span>
                      <RippleButton
                        onClick={(event) => {
                          event.stopPropagation();
                          speak(current.example_thai);
                        }}
                        aria-label="播放例句发音"
                        rippleColor="rgba(255,255,255,0.15)"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/30 transition hover:text-emerald-300"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </RippleButton>
                    </div>
                    <p className="font-thai text-sm leading-relaxed text-emerald-100/70">
                      {current.example_thai}
                    </p>
                    {current.example_chinese && (
                      <p className="mt-1.5 text-xs leading-relaxed text-white/35">
                        {current.example_chinese}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center gap-2 text-xs text-white/25">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  点击卡片回到泰语
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* =========================
          认识 / 不认识
      ========================= */}

      <div className="mt-7 flex items-center justify-center gap-4">
        <motion.button
          type="button"
          disabled={!flipped}
          whileHover={flipped ? { y: -2 } : {}}
          whileTap={flipped ? { scale: 0.96 } : {}}
          onClick={() => goNext(false)}
          className={`flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-semibold transition-all ${
            !flipped
              ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/20"
              : isKnown
                ? "border-white/[0.08] bg-white/[0.04] text-white/40 hover:border-white/15 hover:text-white/70"
                : "border-red-400/20 bg-red-400/[0.07] text-red-200 hover:bg-red-400/[0.12] hover:shadow-[0_0_20px_rgba(248,113,113,0.12)]"
          }`}
        >
          <X className="h-4 w-4" />
          不认识
        </motion.button>

        <motion.button
          type="button"
          disabled={!flipped}
          whileHover={flipped ? { y: -2 } : {}}
          whileTap={flipped ? { scale: 0.96 } : {}}
          onClick={() => goNext(true)}
          className={`flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-semibold transition-all ${
            !flipped
              ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/20"
              : "border-emerald-300/25 bg-gradient-to-r from-emerald-400/15 to-teal-400/10 text-emerald-200 hover:shadow-[0_0_24px_rgba(52,211,153,0.18)]"
          }`}
        >
          <Check className="h-4 w-4" />
          认识
        </motion.button>
      </div>

      {!flipped && (
        <p className="mt-3 text-center text-xs text-white/25">
          先翻面查看释义，再标记是否认识
        </p>
      )}

      {/* 底部状态 */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <div className="rounded-full border border-white/[0.06] bg-white/[0.025] px-4 py-2 text-xs text-white/35 backdrop-blur-xl">
          已记住{" "}
          <span className="font-bold text-emerald-300">{known.size}</span>
          <span className="mx-1 text-white/20">·</span>
          本轮共{" "}
          <span className="font-bold text-white/60">{total}</span> 词
        </div>
        <div className="hidden items-center gap-1.5 text-[10px] text-white/20 sm:flex">
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">空格</span>
          翻面
          <span className="ml-2 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">← →</span>
          换卡
        </div>
      </div>
    </div>
  );
}
