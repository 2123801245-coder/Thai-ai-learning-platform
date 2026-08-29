import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";

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
   互译练习
   - 泰翻中：显示泰语单词 → 选出正确中文释义
   - 中翻泰：显示中文释义 → 选出正确泰语单词
   - 每轮随机抽 ROUND_SIZE 个本课生词
   - 干扰项排除与目标同义/同形的词，避免歧义
========================================================= */

export default function Translate({ words }) {
  const pool = useMemo(
    () =>
      (words || []).filter(
        (w) =>
          w.thai_word &&
          w.chinese_meaning &&
          !/[.…]/.test(w.thai_word)
      ),
    [words]
  );

  const [mode, setMode] = useState("th2zh"); // th2zh | zh2th
  const [round, setRound] = useState([]); // [{ target, options, answer }]
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null); // idle | correct | wrong
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const [played, setPlayed] = useState(false);

  const current = round[index];

  /* 构建一题：目标 + 3 个无歧义干扰项 */

  const buildQuestion = (targetList) => {
    const target =
      targetList[Math.floor(Math.random() * targetList.length)];

    const candidates = pool.filter(
      (w) =>
        w.id !== target.id &&
        w.chinese_meaning !== target.chinese_meaning
    );

    const distractors = [];
    const seenMeanings = new Set([target.chinese_meaning]);

    for (const w of shuffle(candidates)) {
      if (distractors.length >= 3) break;
      if (seenMeanings.has(w.chinese_meaning)) continue;
      seenMeanings.add(w.chinese_meaning);
      distractors.push(w);
    }

    const options = shuffle([target, ...distractors]);

    return {
      target,
      options,
      answer: options.findIndex((o) => o.id === target.id),
    };
  };

  const startRound = (nextMode) => {
    const m = nextMode || mode;
    const targets = shuffle(pool).slice(0, ROUND_SIZE);
    const questions = targets.map(() => buildQuestion(pool));

    setMode(m);
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

  /* 泰翻中：进题自动播放泰语发音 */

  useEffect(() => {
    if (current && mode === "th2zh") {
      speak(current.target.thai_word);
      setPlayed(true);
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

  const switchMode = (m) => {
    if (m === mode) return;
    startRound(m);
  };

  const correctCount = results.filter(Boolean).length;
  const answered = results.length;

  const isTh2zh = mode === "th2zh";

  return (
    <div className="px-5 py-5">
      {/* ==================== 方向切换 ==================== */}

      <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.07] bg-black/[0.12] p-1.5">
        <button
          onClick={() => switchMode("th2zh")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            isTh2zh
              ? "bg-emerald-400/15 text-emerald-200"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          泰翻中
        </button>

        <button
          onClick={() => switchMode("zh2th")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            !isTh2zh
              ? "bg-emerald-400/15 text-emerald-200"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4 rotate-180" />
          中翻泰
        </button>
      </div>

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
            {isTh2zh ? "泰翻中" : "中翻泰"} · 本轮完成！
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
              onClick={() => startRound()}
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
          {/* ==================== 进度 ==================== */}

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
                onClick={() => startRound()}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重开一轮
              </button>
            </div>
          </div>

          {/* ==================== 当前题 ==================== */}

          <div
            key={`${mode}-${current.target.id}`}
            className="rounded-2xl border border-white/[0.07] bg-black/[0.15] px-5 py-6"
          >
            {/* 题干 */}

            <div className="text-center">
              <p className="text-xs tracking-wider text-white/30">
                {isTh2zh
                  ? "看泰语，选出正确的中文释义"
                  : "看中文，选出正确的泰语单词"}
              </p>

              {isTh2zh ? (
                <>
                  <button
                    onClick={() => {
                      speak(current.target.thai_word);
                      setPlayed(true);
                    }}
                    className={`mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border transition-all ${
                      played
                        ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-300"
                        : "border-white/10 bg-white/[0.05] text-white/50 hover:border-emerald-300/25 hover:text-emerald-300"
                    }`}
                  >
                    <Volume2 className="h-7 w-7" />
                  </button>

                  <p className="mt-2 text-[11px] text-white/25">
                    {played ? "再次点击可重听" : "点击播放发音"}
                  </p>
                </>
              ) : (
                <p className="mx-auto mt-4 max-w-md rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.06] px-5 py-4 text-lg font-bold leading-relaxed text-yellow-100">
                  {current.target.chinese_meaning}
                </p>
              )}
            </div>

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

                const label = isTh2zh
                  ? option.chinese_meaning
                  : option.thai_word;

                return (
                  <button
                    key={oIndex}
                    onClick={() => choose(oIndex)}
                    disabled={!!status}
                    className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-4 transition-all ${style} ${
                      status ? "cursor-default" : ""
                    } ${isTh2zh ? "text-base" : "font-thai text-xl"}`}
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

                    <span>{label}</span>

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
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {status === "correct" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        翻译正确！
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-300" />
                        正确答案：
                        <span
                          className={
                            isTh2zh ? "text-white" : "font-thai text-lg text-white"
                          }
                        >
                          {isTh2zh
                            ? current.target.chinese_meaning
                            : current.target.thai_word}
                        </span>
                        {!isTh2zh && (
                          <button
                            onClick={() =>
                              speak(current.target.thai_word)
                            }
                            className="ml-1 flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/40 transition hover:text-emerald-300"
                          >
                            <Volume2 className="h-3 w-3" />
                            听发音
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {status === "correct" && (
                    <p className="mt-1 text-xs text-white/40">
                      {isTh2zh
                        ? current.target.thai_word
                        : current.target.chinese_meaning}
                    </p>
                  )}
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
