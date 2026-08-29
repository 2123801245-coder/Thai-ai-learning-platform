import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Languages,
  RotateCcw,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { recordVocabQuiz } from "@/api/vocabStats";
import { speakThai } from "@/lib/thaiSpeech";

const QUIZ_TYPES = [
  { id: "thai-to-chinese", label: "泰译中", description: "看泰语选中文" },
  { id: "chinese-to-thai", label: "中译泰", description: "看中文选泰语" },
  { id: "spelling", label: "拼写练习", description: "听提示拼泰文" },
];

const DIFFICULTY_OPTIONS = [
  { id: "all", label: "全部", icon: Languages, color: "text-white/60" },
  { id: "beginner", label: "初级", icon: Shield, color: "text-emerald-300" },
  { id: "intermediate", label: "中级", icon: ShieldCheck, color: "text-yellow-200" },
  { id: "advanced", label: "高级", icon: ShieldAlert, color: "text-orange-300" },
];

const DIFFICULTY_BADGES = {
  all: "border-white/15 bg-white/[0.06] text-white/50",
  beginner: "border-emerald-300/15 bg-emerald-400/10 text-emerald-300",
  intermediate: "border-yellow-300/15 bg-yellow-300/10 text-yellow-200",
  advanced: "border-orange-300/15 bg-orange-400/10 text-orange-300",
};

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const normalizeAnswer = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

const getWordKey = (word) =>
  word.id || `${word.thai_word}-${word.chinese_meaning}`;

export default function VocabQuiz({ words, onExit, source = "book" }) {
  const [quizType, setQuizType] = useState("thai-to-chinese");
  const [quizDifficulty, setQuizDifficulty] = useState("all");
  const [quizSeed, setQuizSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [spellingAnswer, setSpellingAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 完成一轮测验后上报学习记录（错题本/生词本/词书统一统计）
  // 模块级去重：StrictMode 双挂载会重建 ref，用签名集合保证同一轮只上报一次
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!showResult || reportedRef.current) return;
    reportedRef.current = true;
    recordVocabQuiz({
      quizType,
      difficulty: quizDifficulty,
      source,
      correct: score,
      total: questions.length,
    }).catch(() => {
      // 未登录 / 网络失败静默跳过，不影响练习
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

  const questions = useMemo(() => {
    const eligible = (words || []).filter(
      (word) => word.thai_word && word.chinese_meaning &&
        (quizDifficulty === "all" || word.difficulty === quizDifficulty)
    );

    if (eligible.length < 1) return [];

    const selectedWords = shuffle(eligible).slice(
      0,
      Math.min(20, eligible.length)
    );

    return selectedWords.map((word) => {
      if (quizType === "spelling") {
        return { word, prompt: word.chinese_meaning };
      }

      const field = quizType === "thai-to-chinese" ? "chinese_meaning" : "thai_word";
      const candidates = shuffle(
        eligible.filter(
          (item) =>
            getWordKey(item) !== getWordKey(word) &&
            item[field] !== word[field]
        )
      ).slice(0, 3);
      const options = shuffle([
        word[field],
        ...candidates.map((item) => item[field]),
      ]);

      return { word, options, correct: word[field] };
    });
  }, [words, quizSeed, quizType, quizDifficulty]);

  const currentQuestion = questions[currentIndex];
  const currentType = QUIZ_TYPES.find((item) => item.id === quizType);

  const speak = (text) => {
    if (text) speakThai(text, { rate: 0.75 });
  };

  const saveWrongWord = async (word) => {
    try {
      const existing = await base44.entities.WrongNotebook.filter({
        vocabulary_id: word.id,
        removed: false,
      });

      if (existing.length > 0) {
        await base44.entities.WrongNotebook.update(existing[0].id, {
          wrong_count: (existing[0].wrong_count || 1) + 1,
          last_wrong_date: new Date().toISOString().split("T")[0],
        });
      } else {
        await base44.entities.WrongNotebook.create({
          vocabulary_id: word.id,
          thai_word: word.thai_word,
          chinese_meaning: word.chinese_meaning,
          pronunciation: word.pronunciation,
          example_thai: word.example_thai,
          wrong_count: 1,
          last_wrong_date: new Date().toISOString().split("T")[0],
          removed: false,
        });
      }
    } catch (error) {
      console.error("保存错题失败:", error);
    }
  };

  const finishAnswer = async (answer) => {
    if (answered || !currentQuestion) return;

    const correct =
      quizType === "spelling"
        ? normalizeAnswer(answer) === normalizeAnswer(currentQuestion.word.thai_word)
        : answer === currentQuestion.correct;

    setSelected(answer);
    setAnswered(true);

    if (correct) {
      setScore((value) => value + 1);
    } else {
      await saveWrongWord(currentQuestion.word);
    }

    window.setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((value) => value + 1);
        setSelected(null);
        setSpellingAnswer("");
        setAnswered(false);
      } else {
        setShowResult(true);
      }
    }, 700);
  };

  const restart = (nextType = quizType, nextDifficulty = quizDifficulty) => {
    reportedRef.current = false;
    setQuizType(nextType);
    setQuizDifficulty(nextDifficulty);
    setCurrentIndex(0);
    setSelected(null);
    setSpellingAnswer("");
    setScore(0);
    setAnswered(false);
    setShowResult(false);
    setQuizSeed((value) => value + 1);
  };

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6">
        <div className="text-center">
          <Trophy className="mx-auto mb-5 h-12 w-12 text-yellow-300/50" />
          <h2 className="text-xl font-bold text-white">暂时无法开始测验</h2>
          <p className="mt-2 text-sm text-white/40">当前筛选结果没有可用词条</p>
          <button
            onClick={onExit}
            className="mt-6 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            返回词汇
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    const resultText =
      percentage >= 90
        ? "太棒了！掌握得非常扎实。"
        : percentage >= 70
          ? "不错！再巩固一下会更稳。"
          : "把错题再复习一遍，再来一次。";

    return (
      <div className="relative mx-auto flex min-h-[560px] max-w-2xl items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-2xl backdrop-blur-2xl sm:p-8"
        >
          <Trophy className="mx-auto mb-5 h-14 w-14 text-yellow-300" />
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-300/60">{currentType.label}</div>
          <div className={`mt-2 inline-block rounded-full border px-3 py-0.5 text-[10px] font-semibold ${DIFFICULTY_BADGES[quizDifficulty]}`}>
            {DIFFICULTY_OPTIONS.find(d => d.id === quizDifficulty)?.label || "全部"}
          </div>
          <h2 className="mt-2 text-3xl font-black text-white">测验完成</h2>
          <p className="mt-3 text-sm text-white/45">{resultText}</p>
          <div className="mt-7 text-5xl font-black text-yellow-300">
            {score}<span className="mx-1 text-2xl text-white/20">/</span>{questions.length}
          </div>
          <div className="mt-2 text-sm text-white/40">正确率 {percentage}%</div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => restart()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-4 w-4" />再来一次
            </button>
            <button
              onClick={() => restart(quizType, "all")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70"
            >
              <RotateCcw className="h-4 w-4" />换难度
            </button>
            <button
              onClick={onExit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />返回词汇
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const spellingCorrect =
    quizType === "spelling" &&
    normalizeAnswer(spellingAnswer) === normalizeAnswer(currentQuestion.word.thai_word);

  return (
    <div className="relative mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <button
          onClick={onExit}
          className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />退出测验
        </button>
        <div className="text-right">
          <div className="text-xs text-white/30">{currentType.label}</div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            {currentIndex + 1}<span className="text-white/25"> / {questions.length}</span>
          </div>
          <div className={`mt-1 inline-block rounded-full border px-2 py-px text-[10px] font-semibold ${DIFFICULTY_BADGES[quizDifficulty]}`}>
            {DIFFICULTY_OPTIONS.find(d => d.id === quizDifficulty)?.label || "全部"}
          </div>
        </div>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
          animate={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
        {QUIZ_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => restart(type.id)}
            className={`rounded-xl px-2 py-2.5 text-center text-xs font-semibold transition ${
              quizType === type.id
                ? "bg-emerald-400/15 text-emerald-200"
                : "text-white/35 hover:bg-white/[0.05] hover:text-white/70"
            }`}
          >
            {type.label}
            <span className="mt-0.5 block text-[9px] font-normal opacity-60">{type.description}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
        {DIFFICULTY_OPTIONS.map((diff) => {
          const Icon = diff.icon;
          const isActive = quizDifficulty === diff.id;
          const eligibleCount = diff.id === "all"
            ? words.filter(w => w.thai_word && w.chinese_meaning).length
            : words.filter(w => w.thai_word && w.chinese_meaning && w.difficulty === diff.id).length;
          return (
            <button
              key={diff.id}
              type="button"
              onClick={() => restart(quizType, diff.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition ${
                isActive
                  ? `${DIFFICULTY_BADGES[diff.id]} border`
                  : "text-white/30 hover:bg-white/[0.05] hover:text-white/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px] font-semibold">{diff.label}</span>
              <span className="text-[9px] opacity-50">{eligibleCount}词</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentIndex}-${quizType}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-2xl"
        >
          <div className="relative p-5 sm:p-9">
            <div className="mb-7 text-center">
              <div className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300/60">
                <Sparkles className="h-3.5 w-3.5" />{currentType.label}
              </div>

              {quizType === "thai-to-chinese" && (
                <>
                  <p className="mb-4 text-sm text-white/35">这个泰语单词是什么意思？</p>
                  <h2 className="font-thai text-5xl font-black text-white sm:text-6xl">{currentQuestion.word.thai_word}</h2>
                  {currentQuestion.word.pronunciation && (
                    <p className="mt-3 text-sm text-emerald-300/70">[{currentQuestion.word.pronunciation}]</p>
                  )}
                  <button
                    onClick={() => speak(currentQuestion.word.thai_word)}
                    aria-label="播放泰语发音"
                    className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/10 bg-emerald-400/[0.08] text-emerald-300"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </>
              )}

              {quizType === "chinese-to-thai" && (
                <>
                  <p className="mb-4 text-sm text-white/35">请选择对应的泰语单词</p>
                  <h2 className="text-3xl font-black text-white sm:text-4xl">{currentQuestion.word.chinese_meaning}</h2>
                  <p className="mt-3 text-xs text-white/30">注意声调和元音长短</p>
                </>
              )}

              {quizType === "spelling" && (
                <>
                  <p className="mb-4 text-sm text-white/35">根据中文释义拼写泰文</p>
                  <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">{currentQuestion.prompt}</h2>
                  <p className="mt-3 text-xs text-white/30">请准确输入泰语字母、元音和声调符号</p>
                </>
              )}
            </div>

            {quizType === "spelling" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  finishAnswer(spellingAnswer);
                }}
                className="space-y-4"
              >
                <input
                  autoFocus
                  value={spellingAnswer}
                  onChange={(event) => setSpellingAnswer(event.target.value)}
                  disabled={answered}
                  placeholder="输入泰文，例如 สวัสดี"
                  lang="th"
                  autoComplete="off"
                  className={`w-full rounded-2xl border-2 bg-white/[0.035] px-4 py-4 text-center text-2xl font-semibold text-white outline-none placeholder:text-sm placeholder:text-white/20 focus:border-emerald-300/40 ${
                    answered
                      ? spellingCorrect
                        ? "border-emerald-400/50"
                        : "border-red-400/50"
                      : "border-white/[0.08]"
                  }`}
                />
                <button
                  type="submit"
                  disabled={answered || !spellingAnswer.trim()}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Languages className="h-4 w-4" />提交答案
                </button>
                {answered && (
                  <div className={`text-center text-sm font-medium ${spellingCorrect ? "text-emerald-300" : "text-red-300"}`}>
                    {spellingCorrect ? "回答正确" : `正确答案：${currentQuestion.word.thai_word}`}
                  </div>
                )}
              </form>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((option, index) => {
                  const isCorrect = option === currentQuestion.correct;
                  const isSelected = option === selected;
                  let style = "border-white/[0.08] bg-white/[0.035] hover:border-emerald-300/20 hover:bg-white/[0.07]";

                  if (answered) {
                    if (isCorrect) style = "border-emerald-400/50 bg-emerald-400/[0.12]";
                    else if (isSelected) style = "border-red-400/50 bg-red-400/[0.10]";
                    else style = "border-white/[0.05] bg-white/[0.02] opacity-40";
                  }

                  return (
                    <motion.button
                      key={`${option}-${index}`}
                      type="button"
                      disabled={answered}
                      onClick={() => finishAnswer(option)}
                      className={`relative min-h-[68px] rounded-2xl border-2 p-4 text-left text-sm font-medium leading-6 text-white/80 transition-all ${style}`}
                    >
                      {option}
                      {answered && isCorrect && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" />}
                      {answered && isSelected && !isCorrect && <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-300" />}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {answered && quizType !== "spelling" && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-5 text-center text-xs font-medium ${selected === currentQuestion.correct ? "text-emerald-300" : "text-red-300"}`}>
                  {selected === currentQuestion.correct ? "回答正确，正在进入下一题…" : "再复习一下这个词，正在进入下一题…"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-center">
        <div className="rounded-full border border-white/[0.06] bg-white/[0.025] px-4 py-2 text-xs text-white/35">
          当前得分 <span className="font-bold text-yellow-300">{score}</span>
        </div>
      </div>
    </div>
  );
}
