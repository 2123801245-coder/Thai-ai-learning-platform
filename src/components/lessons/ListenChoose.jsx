import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Trophy,
  RefreshCw,
} from "lucide-react";

import { localVocabulary } from "@/data/vocabulary";
import { speakThai } from "@/lib/thaiSpeech";

/* =========================================================
   朗读（统一泰语发音：选 voice + Google TTS 回退）
========================================================= */

function speak(text) {
  if (!text) return;
  speakThai(text, { rate: 0.7 });
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const ROUND_SIZE = 10;

/* =========================================================
   听音选词
   - 每轮随机抽 ROUND_SIZE 个本课生词作为目标
   - 播放发音 → 从四个泰文词中选出正确的一个
   - 干扰项优先取自本课生词，不足时补充词库
========================================================= */

export default function ListenChoose({ words }) {
  /* 目标词池：排除含省略号/点号的句型词 */

  const pool = useMemo(
    () =>
      (words || []).filter(
        (w) => w.thai_word && !/[.…]/.test(w.thai_word)
      ),
    [words]
  );

  /* 干扰项补充词池：基础泰语1 词库 */

  const fallbackPool = useMemo(
    () =>
      localVocabulary.filter(
        (w) =>
          w.category === "基础泰语1" &&
          w.thai_word &&
          !/[.…]/.test(w.thai_word)
      ),
    []
  );

  const [round, setRound] = useState([]); // [{ target, options, answer }]
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null); // option index
  const [status, setStatus] = useState(null); // idle | correct | wrong
  const [results, setResults] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [played, setPlayed] = useState(false);

  const current = round[index];

  /* 构建一题：目标 + 3 个干扰项 */

  const buildQuestion = (targetList) => {
    const target =
      targetList[Math.floor(Math.random() * targetList.length)];

    const others = shuffle(
      pool.filter((w) => w.id !== target.id)
    );
    const distractors = others.slice(0, 3);

    /* 本课词不够时从词库补充 */

    if (distractors.length < 3) {
      const used = new Set([
        target.id,
        ...distractors.map((d) => d.id),
      ]);
      for (const w of shuffle(fallbackPool)) {
        if (distractors.length >= 3) break;
        if (!used.has(w.id)) {
          distractors.push(w);
          used.add(w.id);
        }
      }
    }

    const options = shuffle([target, ...distractors]);

    return {
      target,
      options,
      answer: options.findIndex((o) => o.id === target.id),
    };
  };

  const startRound = () => {
    const targets = shuffle(pool).slice(0, ROUND_SIZE);
    const questions = targets.map(() =>
      buildQuestion(pool)
    );

    setRound(questions);
    setIndex(0);
    setSelected(null);
    setStatus(null);
    setResults([]);
    setFinished(false);
    setPlayed(false);
  };

  useEffect(() => {
    if (pool.length > 0) {
      startRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  /* 进入新题自动尝试播放发音。
     若被浏览器 autoplay 策略静默阻止（无用户手势），
     按钮保持「点击播放」脉冲引导——用户点击必定能出声。 */

  useEffect(() => {
    if (current) {
      speak(current.target.thai_word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, round]);

  if (pool.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-white/35">
        本课生词均为句型短语，暂无可练习的单词。
      </div>
    );
  }

  if (round.length === 0 || !current) {
    return (
      <div className="px-5 py-8 text-center text-sm text-white/35">
        正在抽取本轮题目…
      </div>
    );
  }

  const choose = (optionIndex) => {
    if (status) return;

    const ok = optionIndex === current.answer;
    setSelected(optionIndex);
    setStatus(ok ? "correct" : "wrong");
    setResults((prev) => [...prev, ok]);
  };

  const next = () => {
    if (index + 1 >= round.length) {
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setSelected(null);
    setStatus(null);
    setPlayed(false);
  };

  const correctCount = results.filter(Boolean).length;
  const answered = results.length;

  return (
    <div className="px-5 py-5">
      {/* ==================== 结分屏 ==================== */}

      {finished ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-6 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-300/20 bg-gradient-to-br from-yellow-300/15 to-emerald-400/10">
            <Trophy className="h-8 w-8 text-yellow-300" />
          </div>

          <h3 className="text-lg font-bold text-white">
            本轮完成！
          </h3>

          <p className="mt-2 text-sm text-white/40">
            答对{" "}
            <span className="text-xl font-black text-emerald-300">
              {correctCount}
            </span>{" "}
            / {round.length} 题
          </p>

          <div className="mx-auto mt-5 h-2 w-64 max-w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-yellow-300 transition-all duration-500"
              style={{
                width: `${round.length ? (correctCount / round.length) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={startRound}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              再来一轮
            </button>

            <button
              onClick={() => {
                setRound(
                  shuffle(pool)
                    .slice(0, ROUND_SIZE)
                    .map(() => buildQuestion(pool))
                );
                setIndex(0);
                setSelected(null);
                setStatus(null);
                setResults([]);
                setFinished(false);
                setPlayed(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30"
            >
              <RefreshCw className="h-4 w-4" />
              换一批词
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ==================== 进度与操作 ==================== */}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {round.map((_, dotIndex) => (
                <span
                  key={dotIndex}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    dotIndex === index
                      ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]"
                      : dotIndex < answered
                        ? "bg-emerald-400/50"
                        : "bg-white/15"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/35">
                {index + 1} / {round.length}
              </span>

              <button
                onClick={() => setShowHint((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  showHint
                    ? "border-yellow-300/30 bg-yellow-300/15 text-yellow-200"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                }`}
              >
                {showHint ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showHint ? "隐藏提示" : "中文提示"}
              </button>

              <button
                onClick={startRound}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重开一轮
              </button>
            </div>
          </div>

          {/* ==================== 当前题 ==================== */}

          <div
            key={current.target.id}
            className="rounded-2xl border border-white/[0.07] bg-black/[0.15] px-5 py-6"
          >
            <div className="text-center">
              <p className="text-xs tracking-wider text-white/30">
                听发音，选出你听到的泰语单词
              </p>

              <button
                onClick={() => {
                  speak(current.target.thai_word);
                  setPlayed(true);
                }}
                className={`mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border transition-all ${
                  played
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-300"
                    : "breathe border-emerald-300/30 bg-emerald-400/[0.08] text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.2)] hover:border-emerald-300/50 hover:text-emerald-200"
                }`}
              >
                <Volume2 className="h-7 w-7" />
              </button>

              <p className={`mt-2 text-[11px] ${played ? "text-white/25" : "text-emerald-300/80"}`}>
                {played ? "再次点击可重听" : "👆 点击播放发音"}
              </p>
            </div>

            {/* 提示（中文释义） */}

            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-xl border border-yellow-300/15 bg-yellow-300/[0.06] px-4 py-2.5 text-center text-sm text-yellow-200/80">
                    提示：{current.target.chinese_meaning}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 四个选项 */}

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {current.options.map((option, oIndex) => {
                const isAnswer = oIndex === current.answer;
                const isSelected = selected === oIndex;

                let style =
                  "border-white/10 bg-white/[0.035] text-white/75 hover:border-emerald-300/25 hover:text-white";

                if (status) {
                  if (isAnswer) {
                    style =
                      "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
                  } else if (isSelected) {
                    style =
                      "border-red-300/30 bg-red-400/10 text-red-200";
                  } else {
                    style =
                      "border-white/[0.06] bg-white/[0.02] text-white/25";
                  }
                }

                return (
                  <button
                    key={oIndex}
                    onClick={() => choose(oIndex)}
                    disabled={!!status}
                    className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-4 font-thai text-xl transition-all ${style} ${
                      status ? "cursor-default" : ""
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border text-[11px] ${
                        status && isAnswer
                          ? "border-emerald-300/40 text-emerald-300"
                          : status && isSelected
                            ? "border-red-300/40 text-red-300"
                            : "border-white/10 text-white/30"
                      }`}
                    >
                      {["A", "B", "C", "D"][oIndex]}
                    </span>

                    <span>{option.thai_word}</span>

                    {status && isAnswer && (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-300" />
                    )}

                    {status && isSelected && !isAnswer && (
                      <XCircle className="h-5 w-5 flex-shrink-0 text-red-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 反馈 */}

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                    status === "correct"
                      ? "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-200/90"
                      : "border-red-300/25 bg-red-400/[0.07] text-red-200/90"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {status === "correct" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        选对了！
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-300" />
                        正确答案：
                        <span className="font-thai text-lg text-white">
                          {current.target.thai_word}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-white/40">
                    {current.target.chinese_meaning}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ==================== 下一题 ==================== */}

          <div className="mt-5 flex justify-end">
            {status && (
              <button
                onClick={next}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:-translate-y-0.5"
              >
                {index + 1 >= round.length
                  ? "查看成绩"
                  : "下一题"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
