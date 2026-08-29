import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  Bookmark,
  Shuffle,
  Repeat,
  Sparkles,
  RotateCcw,
  Check,
  X,
  Flame,
  Star,
  Target,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { speakThai } from "@/lib/thaiSpeech";

import {
  useLearningProgress,
} from "@/hooks/useLearningProgress";

export default function VocabularyCard() {
  /*
   * =========================
   * 词汇
   * =========================
   */

  const [cards, setCards] = useState([]);

  const [loading, setLoading] =
    useState(true);

  /*
   * =========================
   * 当前卡片
   * =========================
   */

  const [index, setIndex] =
    useState(0);

  const [direction, setDirection] =
    useState(1);

  /*
   * =========================
   * UI
   * =========================
   */

  const [flipped, setFlipped] =
    useState(false);

  const [bookmarked, setBookmarked] =
    useState(false);

  const [answering, setAnswering] =
    useState(false);

  /*
   * =========================
   * 模式
   *
   * new
   * review
   * =========================
   */

  const [mode, setMode] =
    useState("new");

  /*
   * =========================
   * 学习进度
   * =========================
   */

  const {
    progress,

    recordKnown,
    recordUnknown,

    recordReviewKnown,
    recordReviewUnknown,
  } = useLearningProgress();

  /*
   * =========================
   * 加载词汇
   * =========================
   */

  useEffect(() => {
    let cancelled = false;

    const loadVocab = async () => {
      try {
        setLoading(true);

        const data =
          await base44.entities.Vocabulary.list(
            "-created_date",
            500
          );

        if (!cancelled) {
          setCards(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (error) {
        console.error(
          "加载词汇失败:",
          error
        );

        if (!cancelled) {
          setCards([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadVocab();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * =========================
   * 复习队列
   * =========================
   */

  const reviewCards = useMemo(() => {
    const queue =
      progress?.review_queue || [];

    if (!Array.isArray(queue)) {
      return [];
    }

    return queue.map((item) => ({
      id: item.id,

      thai_word:
        item.thai_word || "",

      pronunciation:
        item.pronunciation || "",

      chinese_meaning:
        item.chinese_meaning || "",

      example_thai:
        item.example_thai || "",

      example_chinese:
        item.example_chinese || "",

      category:
        item.category || "复习",

      isReview: true,
    }));
  }, [progress]);

  /*
   * =========================
   * 今日目标
   * =========================
   */

  const dailyGoal =
    progress?.daily_goal || 20;

  const todayWords =
    progress?.today_words || 0;

  const dailyPercent =
    Math.min(
      Math.round(
        (todayWords / dailyGoal) * 100
      ),
      100
    );

  const dailyComplete =
    todayWords >= dailyGoal;

  /*
   * =========================
   * 当前学习列表
   * =========================
   */

  const learningCards =
    mode === "review"
      ? reviewCards
      : cards;

  /*
   * =========================
   * 防止 index 越界
   * =========================
   */

  useEffect(() => {
    if (!learningCards.length) {
      setIndex(0);
      return;
    }

    if (
      index >=
      learningCards.length
    ) {
      setIndex(
        learningCards.length - 1
      );
    }
  }, [
    learningCards.length,
    index,
  ]);

  /*
   * =========================
   * 当前单词
   * =========================
   */

  const current =
    learningCards[index];

  /*
   * =========================
   * 今日目标完成后
   * 自动进入复习
   *
   * 只有存在复习词时才进入
   * =========================
   */

  useEffect(() => {
    if (
      mode === "new" &&
      dailyComplete &&
      reviewCards.length > 0
    ) {
      setMode("review");
      setIndex(0);
      setFlipped(false);
      setBookmarked(false);
      setDirection(1);
    }
  }, [
    mode,
    dailyComplete,
    reviewCards.length,
  ]);

  /*
   * =========================
   * 复习队列清空
   * 自动回新词
   * =========================
   */

  useEffect(() => {
    if (
      mode === "review" &&
      reviewCards.length === 0
    ) {
      setMode("new");
      setIndex(0);
      setFlipped(false);
      setBookmarked(false);
      setDirection(1);
    }
  }, [
    mode,
    reviewCards.length,
  ]);

  /*
   * =========================
   * 发音
   * =========================
   */

  const speak = (text) => {
    if (!text) return;
    speakThai(text, { rate: 0.75 });
  };

  /*
   * =========================
   * 翻页
   * =========================
   */

  const paginate = (
    newDirection
  ) => {
    if (
      !learningCards.length ||
      answering
    ) {
      return;
    }

    setFlipped(false);
    setBookmarked(false);
    setDirection(
      newDirection
    );

    setIndex((prev) => {
      const next =
        prev + newDirection;

      if (next < 0) {
        return (
          learningCards.length - 1
        );
      }

      if (
        next >=
        learningCards.length
      ) {
        return 0;
      }

      return next;
    });
  };

  /*
   * =========================
   * 回答
   * =========================
   */

  const answerCard = async (
    known
  ) => {
    if (
      answering ||
      !current
    ) {
      return;
    }

    setAnswering(true);

    /*
     * 保存当前 ID
     *
     * 防止异步更新之后
     * current 被重新计算
     */

    const currentId =
      current.id ||
      current._id ||
      current.thai_word;

    const currentMode =
      mode;

    try {
      /*
       * =========================
       * 新词
       * =========================
       */

      if (currentMode === "new") {
        if (known) {
          await recordKnown(
            current
          );
        } else {
          await recordUnknown(
            current
          );
        }
      }

      /*
       * =========================
       * 复习
       * =========================
       */

      else {
        if (known) {
          await recordReviewKnown(
            current
          );
        } else {
          await recordReviewUnknown(
            current
          );
        }
      }

      /*
       * =========================
       * 给动画一点时间
       * =========================
       */

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            180
          )
      );

      setFlipped(false);
      setBookmarked(false);
      setDirection(1);

      /*
       * =========================
       * 复习模式
       *
       * 如果认识：
       * 当前词会从 reviewCards 消失
       *
       * 所以不能简单 index + 1
       *
       * 这里根据当前词在新队列中的位置
       * 重新计算
       * =========================
       */

      if (
        currentMode === "review"
      ) {
        if (known) {
          /*
           * 当前词已经被删除
           *
           * 找删除后第一个位置
           */

          const currentIndex =
            reviewCards.findIndex(
              (item) =>
                item.id ===
                currentId
            );

          if (
            reviewCards.length <= 1
          ) {
            setIndex(0);
          } else if (
            currentIndex >=
            reviewCards.length - 1
          ) {
            setIndex(0);
          } else {
            setIndex(
              currentIndex
            );
          }
        } else {
          /*
           * 不认识：
           * 仍然存在
           *
           * 进入下一张
           */

          setIndex((prev) => {
            if (
              reviewCards.length <=
              1
            ) {
              return 0;
            }

            const next =
              prev + 1;

            return next >=
              reviewCards.length
              ? 0
              : next;
          });
        }
      }

      /*
       * =========================
       * 新词模式
       * =========================
       */

      else {
        setIndex((prev) => {
          if (!cards.length) {
            return 0;
          }

          const next =
            prev + 1;

          return next >=
            cards.length
            ? 0
            : next;
        });
      }
    } catch (error) {
      console.error(
        "记录学习结果失败:",
        error
      );
    } finally {
      setAnswering(false);
    }
  };

  /*
   * =========================
   * 随机
   * =========================
   */

  const shuffle = () => {
    if (
      !learningCards.length ||
      answering
    ) {
      return;
    }

    setFlipped(false);
    setBookmarked(false);
    setDirection(0);

    if (mode === "new") {
      setCards((prev) => {
        const shuffled =
          [...prev];

        for (
          let i =
            shuffled.length - 1;
          i > 0;
          i--
        ) {
          const j =
            Math.floor(
              Math.random() *
                (i + 1)
            );

          [
            shuffled[i],
            shuffled[j],
          ] = [
            shuffled[j],
            shuffled[i],
          ];
        }

        return shuffled;
      });
    }

    setIndex(0);
  };

  /*
   * =========================
   * 切换模式
   * =========================
   */

  const switchMode = (
    nextMode
  ) => {
    if (answering) return;

    if (
      nextMode === "review" &&
      reviewCards.length === 0
    ) {
      return;
    }

    setMode(nextMode);

    setIndex(0);

    setFlipped(false);

    setBookmarked(false);

    setDirection(
      nextMode === "review"
        ? 1
        : -1
    );
  };

  /*
   * =========================
   * Loading
   * =========================
   */

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071817]/70 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-emerald-300" />

            <p className="text-sm text-white/40">
              正在加载词汇……
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * =========================
   * 没有词
   * =========================
   */

  if (
    !current ||
    learningCards.length === 0
  ) {
    return (
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071817]/70 p-8 text-center text-white">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          <Sparkles className="h-6 w-6" />
        </div>

        <p className="mt-4 text-sm text-white/50">
          {mode === "review"
            ? "太棒了！复习队列已经清空"
            : "暂时没有可学习的词汇"}
        </p>

        {mode === "review" &&
          cards.length > 0 && (
            <button
              onClick={() =>
                switchMode("new")
              }
              className="mt-5 rounded-xl bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300"
            >
              继续学习新词
            </button>
          )}
      </div>
    );
  }

  /*
   * =========================
   * 主界面
   * =========================
   */

  return (
    <div
      id="vocab-card"
      className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071817]/70 shadow-2xl shadow-black/20 backdrop-blur-2xl"
    >
      {/* 背景 */}

      <div className="pointer-events-none absolute -right-28 -top-28 h-[300px] w-[300px] rounded-full bg-emerald-400/[0.08] blur-[100px]" />

      <div className="pointer-events-none absolute -bottom-28 -left-28 h-[280px] w-[280px] rounded-full bg-yellow-400/[0.06] blur-[100px]" />

      {/* 寺庙夜景滑动背景（缓慢横移，参考图素材） */}

      <img
        src="/thai-teacher-bg.jpg"
        alt=""
        aria-hidden="true"
        className="vocab-bg-pan pointer-events-none absolute inset-0 h-full w-full object-cover object-[80%_center] opacity-60"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071817]/55 via-[#071817]/15 to-[#071817]/70" />

      {/* =========================
          Header
      ========================= */}

      <div className="relative z-10 border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/10 bg-emerald-400/10">
              {mode === "review" ? (
                <RotateCcw className="h-4 w-4 text-yellow-300" />
              ) : (
                <Sparkles className="h-4 w-4 text-emerald-300" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white">
                  {mode === "review"
                    ? "错词复习"
                    : "今日词汇"}
                </h2>

                <span className="rounded-full border border-yellow-300/10 bg-yellow-300/[0.06] px-2 py-0.5 text-[10px] text-yellow-200/70">
                  {mode === "review"
                    ? `${reviewCards.length} 个待复习`
                    : current?.category ||
                      "学习"}
                </span>
              </div>

              <p className="mt-0.5 text-[11px] text-white/30">
                {mode === "review"
                  ? "把不会的词再练一遍"
                  : "每天掌握一点，泰语越来越顺口"}
              </p>
            </div>
          </div>

          <button
            onClick={shuffle}
            disabled={answering}
            title="随机词汇"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 transition-all hover:border-emerald-300/20 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:opacity-40"
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </div>

        {/* 今日目标 */}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <Target className="h-3.5 w-3.5 text-emerald-300" />

              今日目标
            </div>

            <div className="text-[11px] font-semibold text-emerald-300">
              {todayWords} / {dailyGoal}
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300"
              animate={{
                width: `${dailyPercent}%`,
              }}
              transition={{
                duration: 0.35,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-white/25">
              {dailyComplete
                ? "🎉 今日目标完成"
                : `还差 ${
                    dailyGoal -
                    todayWords
                  } 个`}
            </span>

            <span className="flex items-center gap-1 text-yellow-300/60">
              <Star className="h-3 w-3" />

              {progress?.xp || 0} XP
            </span>
          </div>
        </div>

        {/* 模式切换 */}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() =>
              switchMode("new")
            }
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              mode === "new"
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-white/[0.03] text-white/30 hover:bg-white/[0.06]"
            }`}
          >
            新词
          </button>

          <button
            onClick={() =>
              switchMode("review")
            }
            disabled={
              reviewCards.length === 0
            }
            className={`relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              mode === "review"
                ? "bg-yellow-400/10 text-yellow-300"
                : "bg-white/[0.03] text-white/30 hover:bg-white/[0.06]"
            } disabled:cursor-not-allowed disabled:opacity-30`}
          >
            复习

            {reviewCards.length >
              0 && (
              <span className="ml-1 rounded-full bg-red-400/20 px-1.5 py-0.5 text-[9px] text-red-300">
                {reviewCards.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =========================
          Card Area
      ========================= */}

      <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden px-5 py-5">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:32px_32px]" />

        {/* 左 */}

        <button
          onClick={() =>
            paginate(-1)
          }
          disabled={answering}
          className="absolute left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/40 backdrop-blur-xl transition-all hover:scale-110 hover:border-emerald-300/20 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* 右 */}

        <button
          onClick={() =>
            paginate(1)
          }
          disabled={answering}
          className="absolute right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/40 backdrop-blur-xl transition-all hover:scale-110 hover:border-emerald-300/20 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* =========================
            单词卡
        ========================= */}

        <AnimatePresence
          mode="wait"
          custom={direction}
        >
          <motion.div
            key={`${mode}-${current.id || current.thai_word}-${index}`}
            custom={direction}
            initial={{
              opacity: 0,
              x: direction * 80,
              scale: 0.94,
            }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              x: direction * -80,
              scale: 0.94,
            }}
            transition={{
              duration: 0.28,
              ease: "easeOut",
            }}
            drag="x"
            dragConstraints={{
              left: 0,
              right: 0,
            }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (answering) return;

              if (
                info.offset.x > 80
              ) {
                paginate(-1);
              }

              if (
                info.offset.x < -80
              ) {
                paginate(1);
              }
            }}
            onClick={() => {
              if (!answering) {
                setFlipped(
                  (prev) => !prev
                );
              }
            }}
            className="relative z-10 w-full max-w-sm cursor-pointer select-none"
          >
            <div className="relative flex min-h-[380px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-emerald-300/[0.10] bg-gradient-to-br from-emerald-400/[0.07] via-white/[0.035] to-yellow-300/[0.05] p-6 shadow-[0_20px_60px_rgba(0,0,0,.25)] backdrop-blur-xl">
              <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />

              {/* 序号 */}

              <span className="absolute left-4 top-4 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/30">
                {index + 1} /{" "}
                {learningCards.length}
              </span>

              {/* 复习标签 */}

              {mode === "review" && (
                <span className="absolute left-4 top-12 rounded-full border border-yellow-300/10 bg-yellow-300/[0.06] px-2 py-1 text-[9px] text-yellow-300/70">
                  🔁 待复习
                </span>
              )}

              {/* 收藏 */}

              <button
                onClick={(e) => {
                  e.stopPropagation();

                  if (!answering) {
                    setBookmarked(
                      (prev) =>
                        !prev
                    );
                  }
                }}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition-all hover:bg-white/[0.06] hover:text-yellow-300"
              >
                <Bookmark
                  className={`h-4 w-4 ${
                    bookmarked
                      ? "fill-yellow-300 text-yellow-300"
                      : ""
                  }`}
                />
              </button>

              {/* =========================
                  正面
              ========================= */}

              {!flipped ? (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  className="flex flex-col items-center"
                >
                  <div className="mb-4 rounded-full border border-emerald-300/10 bg-emerald-400/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300/60">
                    THAI WORD
                  </div>

                  <h3 className="font-thai text-5xl font-bold leading-tight text-white sm:text-6xl">
                    {current?.thai_word}
                  </h3>

                  <p className="mt-3 text-base font-medium tracking-wide text-emerald-300">
                    [{current?.pronunciation}]
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      speak(
                        current?.thai_word
                      );
                    }}
                    className="mt-6 flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-400/[0.07] px-4 py-2 text-xs font-medium text-emerald-300 transition-all hover:bg-emerald-400/[0.14]"
                  >
                    <Volume2 className="h-4 w-4" />

                    点击听发音
                  </button>

                  <p className="mt-5 flex items-center gap-1.5 text-[10px] text-white/25">
                    <Repeat className="h-3 w-3" />

                    点击卡片查看释义
                  </p>
                </motion.div>
              ) : (
                /* =========================
                   背面
                ========================= */

                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  className="flex w-full flex-col items-center text-center"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">
                    <Sparkles className="h-3 w-3" />

                    释义
                  </div>

                  <h3 className="text-3xl font-bold text-white sm:text-4xl">
                    {current?.chinese_meaning}
                  </h3>

                  <div className="my-4 h-px w-12 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent" />

                  <p className="font-thai text-base leading-7 text-emerald-200/80">
                    {current?.example_thai}
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    {current?.example_chinese}
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      speak(
                        current?.example_thai
                      );
                    }}
                    className="mt-5 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-xs text-white/60 transition-all hover:bg-white/[0.09] hover:text-white"
                  >
                    <Volume2 className="h-3.5 w-3.5" />

                    听例句
                  </button>

                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/20">
                    <RotateCcw className="h-3 w-3" />

                    点击返回单词
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* =========================
          回答按钮
      ========================= */}

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 15,
            }}
            className="relative z-20 grid grid-cols-2 gap-3 border-t border-white/[0.08] px-5 py-4"
          >
            {/* 不认识 */}

            <button
              disabled={answering}
              onClick={() =>
                answerCard(false)
              }
              className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-red-300/10 bg-red-400/[0.05] text-sm font-semibold text-red-200/70 transition-all hover:border-red-300/20 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />

              不认识
            </button>

            {/* 认识 */}

            <button
              disabled={answering}
              onClick={() =>
                answerCard(true)
              }
              className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/15 to-teal-400/10 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/5 transition-all hover:border-emerald-300/30 hover:bg-emerald-400/20 hover:shadow-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />

              认识
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================
          底部数据
      ========================= */}

      <div className="relative z-10 border-t border-white/[0.08] px-5 py-4">
        <div className="grid grid-cols-3 gap-3">
          {/* XP */}

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-center">
            <Star className="mx-auto h-4 w-4 text-yellow-300/70" />

            <div className="mt-1 text-sm font-black text-white">
              {progress?.xp || 0}
            </div>

            <div className="text-[9px] text-white/25">
              XP
            </div>
          </div>

          {/* 连续 */}

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-center">
            <Flame className="mx-auto h-4 w-4 text-orange-300/70" />

            <div className="mt-1 text-sm font-black text-white">
              {progress?.learning_streak ||
                0}
            </div>

            <div className="text-[9px] text-white/25">
              连续学习
            </div>
          </div>

          {/* 等级 */}

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-center">
            <Sparkles className="mx-auto h-4 w-4 text-emerald-300/70" />

            <div className="mt-1 text-sm font-black text-white">
              Lv.
              {progress?.level ||
                1}
            </div>

            <div className="text-[9px] text-white/25">
              {progress?.level_name ||
                "初学者"}
            </div>
          </div>
        </div>

        {/* =========================
            今日进度
        ========================= */}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">
              今日学习
            </span>

            <span className="text-[10px] text-emerald-300/60">
              {todayWords} /{" "}
              {dailyGoal}
            </span>
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300"
              animate={{
                width: `${dailyPercent}%`,
              }}
              transition={{
                duration: 0.35,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-white/20">
              {dailyComplete
                ? "🎉 今日目标已完成"
                : `还需要学习 ${
                    dailyGoal -
                    todayWords
                  } 个词`}
            </span>

            {reviewCards.length >
              0 && (
              <button
                onClick={() =>
                  switchMode(
                    "review"
                  )
                }
                className="text-[10px] font-semibold text-yellow-300/70 hover:text-yellow-300"
              >
                复习{" "}
                {
                  reviewCards.length
                }{" "}
                个词 →
              </button>
            )}
          </div>
        </div>

        {/* =========================
            小圆点
        ========================= */}

        {mode === "new" && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {cards
              .slice(0, 8)
              .map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (answering)
                      return;

                    setFlipped(
                      false
                    );

                    setDirection(
                      i > index
                        ? 1
                        : -1
                    );

                    setIndex(i);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-6 bg-yellow-300"
                      : "w-1.5 bg-white/15 hover:bg-white/30"
                  }`}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}