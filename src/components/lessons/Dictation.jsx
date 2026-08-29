import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Keyboard,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Trophy,
  RefreshCw,
} from "lucide-react";

import { speakThai } from "@/lib/thaiSpeech";

/* =========================================================
   朗读（统一泰语发音：选 voice + Google TTS 回退）
========================================================= */

function speak(text) {
  if (!text) return;
  speakThai(text, { rate: 0.7 });
}

/* =========================================================
   判分归一化：去掉所有空白后比较
========================================================= */

function normalize(value) {
  return (value || "").replace(/\s+/g, "").trim();
}

const ROUND_SIZE = 10;

/* =========================================================
   生词听写
   - 每轮随机抽 ROUND_SIZE 个本课生词
   - 播放发音 → 用户输入泰文 → 自动判分
   - 可显示中文释义提示、重听发音、重开一轮
========================================================= */

export default function Dictation({ words }) {
  /* 排除含省略号/点号的句型词（如 ตั้งแต่…จนถึง…） */

  const pool = useMemo(
    () =>
      (words || []).filter(
        (w) => w.thai_word && !/[.…]/.test(w.thai_word)
      ),
    [words]
  );

  const [round, setRound] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null); // null | correct | wrong
  const [results, setResults] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [finished, setFinished] = useState(false);
  const [played, setPlayed] = useState(false);

  const current = round[index];

  /* 抽题 */

  const startRound = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const size = Math.min(ROUND_SIZE, shuffled.length);

    setRound(shuffled.slice(0, size));
    setIndex(0);
    setInput("");
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
      speak(current.thai_word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, round]);

  if (pool.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-white/35">
        本课生词均为句型短语，暂无可听写的单词。
      </div>
    );
  }

  /* 首次渲染时抽题尚未完成 */

  if (round.length === 0 || !current) {
    return (
      <div className="px-5 py-8 text-center text-sm text-white/35">
        正在抽取本轮听写单词…
      </div>
    );
  }

  /* 判分 */

  const submit = () => {
    if (!input.trim() || status) return;

    const ok = normalize(input) === normalize(current.thai_word);

    setStatus(ok ? "correct" : "wrong");
    setResults((prev) => [...prev, ok]);
  };

  const next = () => {
    if (index + 1 >= round.length) {
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setInput("");
    setStatus(null);
    setPlayed(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (status) {
        next();
      } else {
        submit();
      }
    }
  };

  /* ==================== 拼写板操作 ==================== */

  const appendChar = (ch) => {
    if (status) return;
    setInput((value) => value + ch);
  };

  const backspaceChar = () => {
    if (status) return;
    setInput((value) =>
      Array.from(value).slice(0, -1).join("")
    );
  };

  const clearInput = () => {
    if (status) return;
    setInput("");
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
                const rest = [...pool].sort(
                  () => Math.random() - 0.5
                );
                setRound(rest.slice(0, ROUND_SIZE));
                setIndex(0);
                setInput("");
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
            key={current.id}
            className="rounded-2xl border border-white/[0.07] bg-black/[0.15] px-5 py-6"
          >
            <div className="text-center">
              <p className="text-xs tracking-wider text-white/30">
                听发音，写出你听到的泰语单词
              </p>

              {/* 发音按钮 */}

              <button
                onClick={() => {
                  speak(current.thai_word);
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
                    提示：{current.chinese_meaning}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 输入区 */}

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 flex-shrink-0 text-emerald-300/60" />

                <input
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  disabled={!!status}
                  placeholder="在这里输入泰语…"
                  autoFocus
                  className="
                    w-full
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.04]
                    px-4
                    py-3.5
                    font-thai
                    text-xl
                    text-white
                    outline-none
                    placeholder:text-white/20
                    focus:border-emerald-300/30
                    focus:bg-white/[0.06]
                    disabled:opacity-50
                  "
                />
              </div>

              {/* 拼写板开关 */}

              <button
                onClick={() => setShowBoard((v) => !v)}
                className={`mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  showBoard
                    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                {showBoard ? "收起拼写板" : "泰文拼写板"}
              </button>

              {/* 拼写板 */}

              <AnimatePresence>
                {showBoard && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <ThaiSpellingBoard
                      disabled={!!status}
                      onAppend={appendChar}
                      onBackspace={backspaceChar}
                      onClear={clearInput}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

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
                          写对了！
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-300" />
                          正确答案：
                          <span className="font-thai text-lg text-white">
                            {current.thai_word}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-white/40">
                      {current.chinese_meaning}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ==================== 提交 / 下一题 ==================== */}

          <div className="mt-5 flex justify-end">
            {status ? (
              <button
                onClick={next}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:-translate-y-0.5"
              >
                {index + 1 >= round.length
                  ? "查看成绩"
                  : "下一题"}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:pointer-events-none disabled:opacity-30"
              >
                <Sparkles className="h-4 w-4" />
                提交判分
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   泰文拼写板
   - 辅音按《基础泰语》辅音三分法分类（中 / 高 / 低）
   - 元音与声调符号单独分组
   - 点击字符追加到输入框；退格按 Unicode 码点回删
========================================================= */

const MID_CONSONANTS = ["ก", "จ", "ฎ", "ฏ", "ด", "ต", "บ", "ป", "อ"];
const HIGH_CONSONANTS = ["ข", "ฃ", "ฉ", "ฐ", "ถ", "ผ", "ฝ", "ศ", "ษ", "ส", "ห"];
const LOW_CONSONANTS = [
  "ค", "ฅ", "ฆ", "ง", "ช", "ซ", "ฌ", "ญ", "ฑ", "ฒ", "ณ", "ท",
  "ธ", "น", "พ", "ฟ", "ภ", "ม", "ย", "ร", "ล", "ว", "ฬ", "ฮ",
];
const VOWEL_KEYS = [
  "ะ", "า", "ำ", "ั", "ิ", "ี", "ึ", "ื", "ุ", "ู", "เ", "แ", "โ", "ใ", "ไ", "ฤ", "ฤๅ",
];
const SYMBOL_KEYS = ["่", "้", "๊", "๋", "็", "์", "ๆ", "ฯ"];

function KeyButton({ children, disabled, onClick, className = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        flex
        h-11
        items-center
        justify-center
        rounded-xl
        border
        border-white/[0.08]
        bg-white/[0.04]
        font-thai
        text-lg
        text-white/75
        transition-all
        hover:border-emerald-300/25
        hover:bg-emerald-400/10
        hover:text-white
        active:scale-95
        disabled:pointer-events-none
        disabled:opacity-30
        ${className}
      `}
    >
      {children}
    </button>
  );
}

function ThaiSpellingBoard({ disabled, onAppend, onBackspace, onClear }) {
  const [tab, setTab] = useState("cons");

  const tabs = [
    { id: "cons", label: "辅音" },
    { id: "vowel", label: "元音" },
    { id: "tone", label: "声调·符号" },
  ];

  const consonantGroups = [
    {
      label: "中辅音",
      className:
        "border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-300",
      chars: MID_CONSONANTS,
    },
    {
      label: "高辅音",
      className:
        "border-yellow-300/15 bg-yellow-300/[0.05] text-yellow-200",
      chars: HIGH_CONSONANTS,
    },
    {
      label: "低辅音",
      className:
        "border-sky-300/15 bg-sky-400/[0.06] text-sky-200",
      chars: LOW_CONSONANTS,
    },
  ];

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/[0.18] p-4">
      {/* 标题行 */}

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] tracking-wider text-white/30">
          点击字母拼写单词
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackspace}
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-white disabled:opacity-30"
          >
            ⌫ 退格
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-red-300 disabled:opacity-30"
          >
            清空
          </button>
        </div>
      </div>

      {/* 分组标签 */}

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
              tab === t.id
                ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                : "border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容 */}

      {tab === "cons" && (
        <div className="space-y-3">
          {consonantGroups.map((group) => (
            <div key={group.label}>
              <span
                className={`mb-1.5 inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${group.className}`}
              >
                {group.label} · {group.chars.length}
              </span>

              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {group.chars.map((ch) => (
                  <KeyButton
                    key={ch}
                    disabled={disabled}
                    onClick={() => onAppend(ch)}
                  >
                    {ch}
                  </KeyButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "vowel" && (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {VOWEL_KEYS.map((ch) => (
            <KeyButton
              key={ch}
              disabled={disabled}
              onClick={() => onAppend(ch)}
            >
              {ch}
            </KeyButton>
          ))}
        </div>
      )}

      {tab === "tone" && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {SYMBOL_KEYS.map((ch) => (
            <KeyButton
              key={ch}
              disabled={disabled}
              onClick={() => onAppend(ch)}
              className="text-xl"
            >
              {ch}
            </KeyButton>
          ))}
        </div>
      )}
    </div>
  );
}
