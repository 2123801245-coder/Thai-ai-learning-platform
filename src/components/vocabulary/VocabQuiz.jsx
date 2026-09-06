import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Languages,
  Lightbulb,
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
  { id: "memory", label: "记忆", description: "看词忆义 · 泰中双向" },
  { id: "spell", label: "拼读", description: "听发音拼写泰文" },
  { id: "cloze", label: "单词挖空", description: "例句选词填空" },
];

const DAILY_COUNTS = [
  { id: 10, label: "10 词/天" },
  { id: 20, label: "20 词/天" },
  { id: 50, label: "50 词/天" },
  { id: 0, label: "全部" },
];

const DAILY_KEY = "thaiai_vocab_quiz_daily";

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

/* 稳定的“今日词汇”批次：
   按 当天日期 + 词书名 作种子，从当前词池抽 dailyCount 个词，
   保证同一天内重复进入测验拿到同一批“今日词汇”，
   次日自动换一批 —— 百词斩式每日计划 */
function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(items, seedStr) {
  let seed = hashCode(seedStr) || 1;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTodayWords(pool, dailyCount) {
  if (!pool.length) return [];
  if (!dailyCount || dailyCount <= 0 || dailyCount >= pool.length) {
    return [...pool];
  }
  const book = pool[0]?.book || pool[0]?.book_name || "all";
  const seed = `${new Date().toDateString()}::${book}::${dailyCount}`;
  return seededShuffle(pool, seed).slice(0, dailyCount);
}

export default function VocabQuiz({ words, onExit, source = "book" }) {
  const [quizType, setQuizType] = useState("memory");
  const [quizDifficulty, setQuizDifficulty] = useState("all");
  const [dailyCount, setDailyCount] = useState(() => {
    try {
      const n = Number(localStorage.getItem(DAILY_KEY));
      if (DAILY_COUNTS.some((d) => d.id === n)) return n;
    } catch (e) {}
    return 20;
  });
  const [quizSeed, setQuizSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [spellingAnswer, setSpellingAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // “最多看一次提示”：记录已看过提示的题号；看完提示后答对不计入满分，计入提示后答对
  const [hintedQuestions, setHintedQuestions] = useState(() => new Set());
  const [hintCorrect, setHintCorrect] = useState(0);
  const [wrongWords, setWrongWords] = useState([]);
  // “重练错题”：本轮答错的词单独成一轮（null = 常规/今日词汇轮）
  const [retryWords, setRetryWords] = useState(null);

  // 完成一轮测验后上报学习记录（错题本/生词本/词书统一统计）
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
      hintUsed: Math.min(hintedQuestions.size, questions.length),
      hintCorrect,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

  const questions = useMemo(() => {
    const passFilter = (word) =>
      word.thai_word &&
      word.chinese_meaning &&
      (quizDifficulty === "all" || word.difficulty === quizDifficulty);
    const eligible = (words || []).filter(passFilter);
    if (eligible.length < 1) return [];

    // 今日词汇记忆：错题复习不限制批次；正常词书练习按每日词数取“今日词汇”。
    // “重练错题”轮：本轮答错的词单独成一轮；干扰项从整本词书取（词少也能出 4 选项）
    const retrying = Array.isArray(retryWords) && retryWords.length > 0;
    const todayPool = retrying
      ? retryWords.filter(passFilter)
      : source === "wrong"
        ? [...eligible]
        : pickTodayWords(eligible, dailyCount);
    if (todayPool.length < 1) return [];
    const distractorSource = retrying ? eligible : todayPool;

    if (quizType === "spell") {
      return shuffle(todayPool)
        .slice(0, Math.min(15, todayPool.length))
        .map((word) => ({ word, prompt: word.chinese_meaning }));
    }

    if (quizType === "cloze") {
      // 挖空：需要例句且例句包含目标词；不足 4 个时可出题的例句时退回今日词汇内的例句词
      const usable = todayPool.filter(
        (w) =>
          w.example_thai &&
          w.example_thai.length > 2 &&
          w.example_thai.includes(w.thai_word)
      );
      const picked = shuffle(usable.length >= 4 ? usable : todayPool).slice(
        0,
        Math.min(10, Math.max(4, usable.length), todayPool.length)
      );

      return picked.map((word) => {
        const hasSentence =
          word.example_thai && word.example_thai.includes(word.thai_word);
        if (!hasSentence) {
          // 无例句词 → 退回中译泰四选一（不中断挖空流程）
          const candidates = shuffle(
            distractorSource.filter(
              (item) =>
                getWordKey(item) !== getWordKey(word) &&
                item.thai_word !== word.thai_word
            )
          ).slice(0, 3);
          return {
            word,
            prompt: "中译泰",
            fallback: true,
            question: word.chinese_meaning,
            options: shuffle([word.thai_word, ...candidates.map((c) => c.thai_word)]),
            correct: word.thai_word,
          };
        }
        const blank = "______";
        const sentence = word.example_thai.split(word.thai_word).join(blank);
        const distractors = shuffle(
          distractorSource.filter(
            (item) =>
              getWordKey(item) !== getWordKey(word) &&
              item.thai_word !== word.thai_word
          )
        )
          .slice(0, 3)
          .map((c) => c.thai_word);
        return {
          word,
          prompt: "单词挖空",
          sentence,
          blank,
          translation: word.example_chinese || "",
          options: shuffle([word.thai_word, ...distractors]),
          correct: word.thai_word,
        };
      });
    }

    // memory（记忆）：看泰文忆中文 / 看中文忆泰文，双向混合
    return shuffle(todayPool)
      .slice(0, Math.min(15, todayPool.length))
      .map((word, i) => {
        const toChinese = i % 2 === 0;
        const field = toChinese ? "chinese_meaning" : "thai_word";
        const candidates = shuffle(
          distractorSource.filter(
            (item) =>
              getWordKey(item) !== getWordKey(word) &&
              item[field] !== word[field]
          )
        ).slice(0, 3);
        const options = shuffle([word[field], ...candidates.map((item) => item[field])]);
        return {
          word,
          toChinese,
          prompt: toChinese ? "看泰文选中文意思" : "看中文选对应泰文",
          question: toChinese ? word.thai_word : word.chinese_meaning,
          options,
          correct: word[field],
        };
      });
  }, [words, quizSeed, quizType, quizDifficulty, dailyCount, source, retryWords]);

  const currentQuestion = questions[currentIndex];
  const currentType = QUIZ_TYPES.find((item) => item.id === quizType);
  const isClozeFallback = !!currentQuestion?.fallback;

  const speak = (text) => {
    if (text) speakThai(text, { rate: 0.75 });
  };

  const speakWord = () => {
    const t =
      currentQuestion?.word?.thai_word ||
      (typeof currentQuestion?.sentence === "string"
        ? currentQuestion.sentence.replace(/______/g, "")
        : "");
    speak(t);
  };

  // 提示按钮：每道题最多看一次提示——首次点开即记录；
  // 已看过的题不允许再次展开（只允许收起），避免反复偷看。
  const hintViewed = hintedQuestions.has(currentIndex);
  const toggleHint = () => {
    if (showHint) {
      setShowHint(false);
      return;
    }
    if (hintedQuestions.has(currentIndex)) return;
    setHintedQuestions((prev) => new Set(prev).add(currentIndex));
    setShowHint(true);
  };

  // 当前题的提示文案（分级提示，不直接给整词答案；拼读/挖空给出更接近的信息）
  const hintText = useMemo(() => {
    if (!currentQuestion) return "";
    const w = currentQuestion.word || {};
    const base = [w.part_of_speech || w.pos ? `词性：${w.part_of_speech || w.pos}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (quizType === "memory") {
      const bits = [];
      // 泰→中：可以给泰语例句作为语境提示（例句不会直接给出中文答案）
      if (currentQuestion.toChinese) {
        if (w.example_thai) bits.push(`例句：${w.example_thai}`);
      } else {
        // 中→泰：泰语例句会暴露答案，只给读音与字符数等辅助信息
        bits.push(`共 ${(w.thai_word || "").length} 个泰文字符`);
      }
      if (w.pronunciation) bits.push(`读音：${w.pronunciation}`);
      return bits.join("  ") || base;
    }
    if (quizType === "spell") {
      const thai = w.thai_word || "";
      const bits = [];
      if (w.pronunciation) bits.push(`读音：${w.pronunciation}`);
      bits.push(`共 ${thai.length} 个字符，首字：${thai.charAt(0) || "？"}`);
      return bits.join("  ");
    }
    // 挖空
    const bits = [];
    if (isClozeFallback) {
      // 无例句词退化为中译泰四选一：不给中文（即答案），只给读音/字符数
      if (w.pronunciation) bits.push(`读音：${w.pronunciation}`);
      bits.push(`共 ${(w.thai_word || "").length} 个泰文字符`);
    } else {
      if (currentQuestion.translation) bits.push(`句意：${currentQuestion.translation}`);
      if (w.pronunciation) bits.push(`读音：${w.pronunciation}`);
      bits.push(`填入：${w.chinese_meaning}`);
    }
    return bits.join("  ");
  }, [currentQuestion, quizType, isClozeFallback]);

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
      quizType === "spell"
        ? normalizeAnswer(answer) === normalizeAnswer(currentQuestion.word.thai_word)
        : answer === currentQuestion.correct;

    setSelected(answer);
    setAnswered(true);
    setShowHint(false);

    if (correct) {
      // 看完提示后答对不计入满分（score），单独计入 hintCorrect
      if (hintedQuestions.has(currentIndex)) {
        setHintCorrect((value) => value + 1);
      } else {
        setScore((value) => value + 1);
      }
    } else {
      await saveWrongWord(currentQuestion.word);
      if (!wrongWords.some((w) => getWordKey(w) === getWordKey(currentQuestion.word))) {
        setWrongWords((list) => [...list, currentQuestion.word]);
      }
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
    }, 900);
  };

  // 重新开始一轮：默认清空错词并退出错题重练（回到常规轮）；
  // keepRetryPool=true 保留 retryWords（错题轮内切换题型/重练再错仍留在错题池）
  const restart = (
    nextType = quizType,
    nextDifficulty = quizDifficulty,
    keepRetryPool = false
  ) => {
    reportedRef.current = false;
    setQuizType(nextType);
    setQuizDifficulty(nextDifficulty);
    setCurrentIndex(0);
    setSelected(null);
    setSpellingAnswer("");
    setScore(0);
    setAnswered(false);
    setShowResult(false);
    setShowHint(false);
    setHintedQuestions(new Set());
    setHintCorrect(0);
    setWrongWords([]);
    if (!keepRetryPool) setRetryWords(null);
    setQuizSeed((value) => value + 1);
  };

  // “重练错题”：把本轮答错的词固定为 retryWords 单独开一轮
  // （只在错词内出题；干扰项仍来自全词书，词少也有 4 选项）
  const startWrongReview = () => {
    if (wrongWords.length === 0) return;
    reportedRef.current = false;
    setRetryWords([...wrongWords]);
    setQuizType("memory"); // 错题重练回到记忆巩固
    setQuizDifficulty("all"); // 错题难度不一，重练不按难度过滤
    setCurrentIndex(0);
    setSelected(null);
    setSpellingAnswer("");
    setScore(0);
    setAnswered(false);
    setShowResult(false);
    setShowHint(false);
    setHintedQuestions(new Set());
    setHintCorrect(0);
    setWrongWords([]);
    setQuizSeed((value) => value + 1);
  };


  const changeDaily = (id) => {
    setDailyCount(id);
    try {
      localStorage.setItem(DAILY_KEY, String(id));
    } catch (e) {}
    restart(quizType, quizDifficulty);
  };

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-6">
        <div className="text-center">
          <Trophy className="mx-auto mb-5 h-12 w-12 text-yellow-300/50" />
          <h2 className="text-xl font-bold text-white">暂时无法开始测验</h2>
          <p className="mt-2 text-sm text-white/40">
            {quizType === "cloze"
              ? "当前词书/筛选下没有可用于挖空的例句词条，请换一批词试试"
              : "当前筛选结果没有可用词条"}
          </p>
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
    // 满分正确率：只用没看提示就答对的题（score）；整体掌握率包含提示后答对
    const percentage = Math.round((score / questions.length) * 100);
    const overallRate = Math.round(((score + hintCorrect) / questions.length) * 100);
    const hintRate = Math.round((hintedQuestions.size / questions.length) * 100);
    const resultText =
      overallRate >= 90
        ? "太棒了！掌握得非常扎实。"
        : overallRate >= 70
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
            {DIFFICULTY_OPTIONS.find((d) => d.id === quizDifficulty)?.label || "全部"}
          </div>
          <h2 className="mt-2 text-3xl font-black text-white">测验完成</h2>
          <p className="mt-3 text-sm text-white/45">{resultText}</p>
          <div className="mt-7 text-5xl font-black text-yellow-300">
            {score}
            <span className="mx-1 text-2xl text-white/20">/</span>
            {questions.length}
          </div>
          <div className="mt-2 text-sm text-white/40">满分答对 {percentage}%</div>
          {hintCorrect > 0 && (
            <div className="mt-1 text-xs text-amber-200/70">另有 {hintCorrect} 题提示后答对</div>
          )}
          <div className="mt-1 text-xs text-white/35">💡 提示使用率 {hintRate}%</div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {wrongWords.length > 0 && (
            <button
              type="button"
              onClick={startWrongReview}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-300/25 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-200 transition hover:bg-yellow-400/15"
            >
              <RotateCcw className="h-4 w-4" />
              重练本轮错题（{wrongWords.length} 词）
            </button>
          )}
          <div className="mt-4 flex gap-3">
            {!retryWords ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  onClick={() => restart()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  <RotateCcw className="h-4 w-4" />完整测验再来一组
                </button>
                <button
                  onClick={onExit}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70"
                >
                  <ArrowLeft className="h-4 w-4" />返回词汇
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const spellingCorrect =
    quizType === "spell" &&
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
            {currentIndex + 1}
            <span className="text-white/25"> / {questions.length}</span>
          </div>
          <div className={`mt-1 inline-block rounded-full border px-2 py-px text-[10px] font-semibold ${DIFFICULTY_BADGES[quizDifficulty]}`}>
            {DIFFICULTY_OPTIONS.find((d) => d.id === quizDifficulty)?.label || "全部"}
          </div>
        </div>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
          animate={{ width: `${progress}%` }}
        />
      </div>

      {/* 题型：记忆 / 拼读 / 挖空 */}
      <div className="mb-2 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
        {QUIZ_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => restart(type.id, quizDifficulty, !!retryWords)}
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

      {/* 每日词数（今日词汇批次，仅词书练习；错题复习/错题重练不限制） */}
      {source !== "wrong" && !retryWords && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="mr-1 text-[10px] tracking-wide text-emerald-200/50">今日词汇</span>
          {DAILY_COUNTS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => changeDaily(d.id)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                dailyCount === d.id
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                  : "border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* 难度 */}
      <div className="mb-5 grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
        {DIFFICULTY_OPTIONS.map((diff) => {
          const Icon = diff.icon;
          const isActive = quizDifficulty === diff.id;
          const eligibleCount = diff.id === "all"
            ? words.filter((w) => w.thai_word && w.chinese_meaning).length
            : words.filter((w) => w.thai_word && w.chinese_meaning && w.difficulty === diff.id).length;
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
          key={`${currentIndex}-${quizType}-${quizSeed}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-2xl"
        >
          <div className="relative p-5 sm:p-9">
            <div className="mb-7 text-center">
              <div className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300/60">
                <Sparkles className="h-3.5 w-3.5" />
                {currentType.label}
                {currentQuestion.toChinese === true && (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-px text-[9px] normal-case text-emerald-200/80">
                    泰→中
                  </span>
                )}
                {currentQuestion.toChinese === false && (
                  <span className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-px text-[9px] normal-case text-yellow-200/80">
                    中→泰
                  </span>
                )}
              </div>

              {/* memory：题干（双向） */}
              {quizType === "memory" && (
                <>
                  <p className="mb-4 text-sm text-white/35">
                    {currentQuestion.toChinese
                      ? "这个泰语单词是什么意思？"
                      : "这个中文对应的泰语是？"}
                  </p>
                  <h2 className={`font-thai ${currentQuestion.toChinese ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"} font-black text-white`}>
                    {currentQuestion.question}
                  </h2>
                  {currentQuestion.toChinese && currentQuestion.word.pronunciation && (
                    <p className="mt-3 text-sm text-emerald-300/70">
                      [{currentQuestion.word.pronunciation}]
                    </p>
                  )}
                  <div className="mt-5 flex items-center justify-center gap-3">
                    {/* 仅泰→中时可发音（中→泰若播放泰语会直接暴露答案） */}
                    {currentQuestion.toChinese ? (
                      <button
                        onClick={() => speakWord()}
                        aria-label="播放泰语发音"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/10 bg-emerald-400/[0.08] text-emerald-300"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    ) : null}
                    {!answered && (
                      <button
                        type="button"
                        onClick={toggleHint}
                        className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-xs transition ${
                          hintViewed
                            ? "cursor-not-allowed border-amber-300/25 bg-amber-400/10 text-amber-200/60"
                            : showHint
                              ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                              : "border-white/10 bg-white/[0.05] text-white/50 hover:text-white/80"
                        }`}
                      >
                        <Lightbulb className="h-4 w-4" />
                        {hintViewed ? (showHint ? "收起提示" : "已看提示") : showHint ? "收起提示" : "看提示"}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* spell：听发音拼写 */}
              {quizType === "spell" && (
                <>
                  <p className="mb-4 text-sm text-white/35">根据中文释义与发音拼写泰文</p>
                  <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                    {currentQuestion.prompt}
                  </h2>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      onClick={speakWord}
                      aria-label="播放泰语发音"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/10 bg-emerald-400/[0.08] text-emerald-300"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={toggleHint}
                      className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-xs transition ${
                        hintViewed
                          ? "cursor-not-allowed border-amber-300/25 bg-amber-400/10 text-amber-200/60"
                          : showHint
                            ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                            : "border-white/10 bg-white/[0.05] text-white/50 hover:text-white/80"
                      }`}
                    >
                      <Lightbulb className="h-4 w-4" />
                      {hintViewed ? (showHint ? "收起提示" : "已看提示") : showHint ? "收起提示" : "看提示"}
                    </button>
                  </div>
                </>
              )}

              {/* cloze：挖空 */}
              {quizType === "cloze" && (
                <>
                  <p className="mb-4 text-sm text-white/35">
                    {isClozeFallback ? "请选择对应泰语单词" : "选词填入例句空白处"}
                  </p>
                  {isClozeFallback ? (
                    <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                      {currentQuestion.question}
                    </h2>
                  ) : (
                    <div className="font-thai text-2xl font-semibold leading-relaxed text-white/95 sm:text-3xl">
                      {currentQuestion.sentence.split("______").map((part, i) => (
                        <span key={i}>
                          {part}
                          {i < currentQuestion.sentence.split("______").length - 1 && (
                            <span className="mx-1 inline-block min-w-[76px] rounded-lg border-b-2 border-dashed border-emerald-300/60 px-1 align-middle text-center text-white/30">
                              ？
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {currentQuestion.translation && (
                    <p className="mt-4 text-sm text-white/40">💬 {currentQuestion.translation}</p>
                  )}
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => speak(currentQuestion.sentence?.replace(/______/g, "") || currentQuestion.word.thai_word)}
                      aria-label="播放例句发音"
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-400/[0.08] px-3.5 text-xs text-emerald-200/80"
                    >
                      <Volume2 className="h-3.5 w-3.5" />朗读例句
                    </button>
                    {!answered && (
                      <button
                        type="button"
                        onClick={toggleHint}
                        className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs transition ${
                          hintViewed
                            ? "cursor-not-allowed border-amber-300/25 bg-amber-400/10 text-amber-200/60"
                            : showHint
                              ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                              : "border-white/10 bg-white/[0.05] text-white/50 hover:text-white/80"
                        }`}
                      >
                        <Lightbulb className="h-4 w-4" />
                        {hintViewed ? (showHint ? "收起提示" : "已看提示") : showHint ? "收起提示" : "看提示"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 提示面板 */}
            <AnimatePresence>
              {showHint && !answered && hintText && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mb-5 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-center text-xs leading-5 text-amber-100/80">
                    <span className="mr-1">💡</span>
                    {hintText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {quizType === "spell" ? (
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
                      <span className={quizType === "memory" && currentQuestion.toChinese ? "" : "font-thai"}>{option}</span>
                      {answered && isCorrect && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" />}
                      {answered && isSelected && !isCorrect && <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-300" />}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {answered && quizType !== "spell" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`mt-5 text-center text-xs font-medium ${
                    selected === currentQuestion.correct ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {selected === currentQuestion.correct
                    ? "回答正确，正在进入下一题…"
                    : `正确答案是「${currentQuestion.correct}」，已记入错题本`}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-center">
        <div className="rounded-full border border-white/[0.06] bg-white/[0.025] px-4 py-2 text-xs text-white/35">
          当前得分 <span className="font-bold text-yellow-300">{score}</span>
          {retryWords ? (
            <span className="ml-3 text-yellow-200/60">
              🔁 错题重练 · {retryWords.length} 词
            </span>
          ) : (
            source !== "wrong" &&
            dailyCount > 0 && (
              <span className="ml-3 text-white/25">今日词汇 {dailyCount} 词/天</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
