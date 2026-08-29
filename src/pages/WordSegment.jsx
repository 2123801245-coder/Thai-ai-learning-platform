import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";
import WordBookPicker from "@/components/practice/WordBookPicker";
import { mergeBooks, generateSegmentQuestions, getSavedBookId, saveBookId, fetchWrongBook, formatWrongDate } from "@/lib/wordBooks";

/* ── 分词题库 ── */
const segmentSets = [
  [
    {
      sentence: "สวัสดีครับผมชื่อจอห์น",
      words: ["สวัสดี", "ครับ", "ผม", "ชื่อ", "จอห์น"],
      roman: "sà-wàt-dee kháp phǒm chêu john",
      translation: "你好，我叫约翰",
      hint: "สวัสดี = 你好, ครับ = 男用礼貌词, ผม = 我, ชื่อ = 名字, จอห์น = John",
    },
    {
      sentence: "วันนี้อากาศดีมาก",
      words: ["วันนี้", "อากาศ", "ดี", "มาก"],
      roman: "wan-níi aa-gàat dìi mâak",
      translation: "今天天气很好",
      hint: "วันนี้ = 今天, อากาศ = 天气, ดี = 好, มาก = 很",
    },
    {
      sentence: "ผมชอบกินอาหารไทย",
      words: ["ผม", "ชอบ", "กิน", "อาหาร", "ไทย"],
      roman: "phǒm chɔ̌ɔp gin aa-hǎan thai",
      translation: "我喜欢吃泰国食物",
      hint: "ผม = 我, ชอบ = 喜欢, กิน = 吃, อาหาร = 食物, ไทย = 泰国",
    },
    {
      sentence: "คุณมาจากประเทศอะไร",
      words: ["คุณ", "มาจาก", "ประเทศ", "อะไร"],
      roman: "khǎn maa jàak bprà-têet à-rai",
      translation: "你来自哪个国家",
      hint: "คุณ = 你, มาจาก = 来自, ประเทศ = 国家, อะไร = 什么",
    },
    {
      sentence: "ฉันอยากไปประเทศไทย",
      words: ["ฉัน", "อยาก", "ไป", "ประเทศไทย"],
      roman: "chǎn yàak bpai bprà-têet thai",
      translation: "我想去泰国",
      hint: "ฉัน = 我, อยาก = 想, ไป = 去, ประเทศไทย = 泰国",
    },
  ],
  [
    {
      sentence: "ร้านอาหารนี้อร่อยมาก",
      words: ["ร้านอาหาร", "นี้", "อร่อย", "มาก"],
      roman: "ráan aa-hǎan-níi à-ròi mâak",
      translation: "这家餐厅很好吃",
      hint: "ร้านอาหาร = 餐厅, นี้ = 这, อร่อย = 好吃, มาก = 很",
    },
    {
      sentence: "เขาพูดภาษาไทยเก่งมาก",
      words: ["เขา", "พูด", "ภาษาไทย", "เก่ง", "มาก"],
      roman: "khǎo phûut phaa-sǎa thai gèŋ mâak",
      translation: "他说泰语说得很好",
      hint: "เขา = 他/她, พูด = 说, ภาษาไทย = 泰语, เก่ง = 厉害, มาก = 很",
    },
    {
      sentence: "พรุ่งนี้จะไปเที่ยวทะเล",
      words: ["พรุ่งนี้", "จะ", "ไป", "เที่ยว", "ทะเล"],
      roman: "phrûng-níi jà bpai thîao tá-lee",
      translation: "明天要去海边玩",
      hint: "พรุ่งนี้ = 明天, จะ = 将要, ไป = 去, เที่ยว = 玩, ทะเล = 海",
    },
    {
      sentence: "ฝนตกหนักมากวันนี้",
      words: ["ฝน", "ตก", "หนัก", "มาก", "วันนี้"],
      roman: "fǒn dtòk nfs̀k mâak wan-níi",
      translation: "今天雨下得很大",
      hint: "ฝน = 雨, ตก = 下, หนัก = 重/大, มาก = 很, วันนี้ = 今天",
    },
    {
      sentence: "ขอบคุณสำหรับอาหารมื้อนี้",
      words: ["ขอบคุณ", "สำหรับ", "อาหาร", "มื้อนี้"],
      roman: "khàwp-khun sǎm-ràp aa-hǎan mùa-níi",
      translation: "谢谢这顿饭",
      hint: "ขอบคุณ = 谢谢, สำหรับ = 为了, อาหาร = 食物, มื้อนี้ = 这餐",
    },
  ],
];

/* ── 内置词书名称 ── */
const builtinBooks = [
  { name: "入门句子", emoji: "🌱", words: segmentSets[0] },
  { name: "进阶句子", emoji: "🌿", words: segmentSets[1] },
];

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "th-TH";
  u.rate = 0.7;
  window.speechSynthesis.speak(u);
}

export default function WordSegment() {
  const [wrongBook, setWrongBook] = useState(null);

  const refreshWrongBook = useCallback(() => {
    fetchWrongBook().then((b) => setWrongBook(b));
  }, []);

  useEffect(() => {
    refreshWrongBook();
  }, [refreshWrongBook]);

  const allBooks = useMemo(
    () => mergeBooks(builtinBooks, wrongBook ? [wrongBook] : []),
    [wrongBook]
  );
  const [bookId, setBookId] = useState(() => {
    const saved = getSavedBookId();
    return allBooks.some((b) => b.id === saved) ? saved : allBooks[0]?.id;
  });
  const currentBook = allBooks.find((b) => b.id === bookId) || allBooks[0];

  // 上次选的是错题本、且错题本异步加载完成后 → 恢复选中
  useEffect(() => {
    if (
      wrongBook &&
      getSavedBookId() === wrongBook.id &&
      bookId !== wrongBook.id
    ) {
      setBookId(wrongBook.id);
    }
  }, [wrongBook, bookId]);

  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  // User's segmentation: array of strings (the words the user placed)
  const [userSegments, setUserSegments] = useState([]);
  const [currentChunk, setCurrentChunk] = useState("");
  const [showResult, setShowResult] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const initSet = useCallback((book) => {
    const qs =
      book?.kind === "builtin"
        ? book.words
        : generateSegmentQuestions(book);
    setQuestions(qs || []);
    setCurrentQ(0);
    setUserSegments([]);
    setCurrentChunk("");
    setShowResult(null);
    setScore(0);
    setCompleted(false);
  }, []);

  useEffect(() => {
    if (currentBook) initSet(currentBook);
  }, [bookId, currentBook, initSet]);

  const selectBook = (id) => {
    setBookId(id);
    saveBookId(id);
  };

  const nextSet = () => {
    const idx = allBooks.findIndex((b) => b.id === bookId);
    const next = allBooks[(idx + 1) % allBooks.length];
    setBookId(next?.id);
    if (next) saveBookId(next.id);
  };

  if (questions.length === 0) return null;
  const q = questions[currentQ];

  // Handle character input: user types Thai characters to form words
  const handleCharInput = (char) => {
    setCurrentChunk((c) => c + char);
  };

  const handleBackspace = () => {
    setCurrentChunk((c) => c.slice(0, -1));
  };

  const handleConfirmWord = () => {
    if (!currentChunk.trim()) return;
    setUserSegments((prev) => [...prev, currentChunk.trim()]);
    setCurrentChunk("");
  };

  const handleRemoveLastWord = () => {
    setUserSegments((prev) => prev.slice(0, -1));
  };

  const handleCheck = () => {
    const correct = q.words;
    const user = userSegments;
    const isCorrect =
      user.length === correct.length &&
      user.every((w, i) => w === correct[i]);

    setShowResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) setScore((s) => s + 15);
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      setUserSegments([]);
      setCurrentChunk("");
      setShowResult(null);
    } else {
      setCompleted(true);
    }
  };

  // Common Thai character quick-select (simplified keyboard)
  const quickChars = [
    "กขคงจชซญฎฏดตบปมยรลวศษสหอ",
    "ะๅัีืุูเแโใไ่้๊๋ํ",
  ];

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">分词练习</h1>
          <p className="text-white/40 text-sm">将泰语句子拆分为正确的词汇单位</p>
        </div>
        <div className="flex items-center gap-3">
          <WordBookPicker books={allBooks} currentId={bookId} onSelect={selectBook} onWrongManaged={refreshWrongBook} />
          <span className="text-white/60 text-sm">{score} 分</span>
          <button
            onClick={() => initSet(currentBook)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 进度 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
            animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-white/30 text-xs shrink-0">题目 {currentQ + 1}/{questions.length}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-5"
          >
            {/* 原始句子 */}
            <div className="text-center">
              <div className="text-white/40 text-xs mb-2">原句：</div>
              <div className="text-2xl sm:text-3xl text-white font-medium cursor-pointer" onClick={() => speak(q.sentence)}>
                {q.sentence}
                <button className="inline-flex ml-2 text-white/30 hover:text-white/60 align-middle">
                  <Volume2 size={16} />
                </button>
              </div>
              <div className="text-white/30 text-sm mt-1">{q.roman}</div>
              <div className="text-white/40 text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>💡 {q.hint}</span>
                {q.wrongCount > 0 && (
                  <span className="text-red-300/70 text-xs">
                    📕 错题 {q.wrongCount} 次{q.lastWrongDate ? ` · 最近 ${formatWrongDate(q.lastWrongDate)}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* 用户分词结果显示 */}
            <div className="space-y-2">
              <div className="text-white/40 text-xs">你的分词：</div>
              <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {userSegments.map((seg, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                      showResult === "correct"
                        ? "bg-green-500/15 border-green-400/30 text-green-300"
                        : showResult === "wrong"
                          ? "bg-red-500/15 border-red-400/30 text-red-300"
                          : "bg-purple-500/15 border-purple-400/30 text-purple-300"
                    }`}
                  >
                    {seg}
                  </motion.span>
                ))}
                {currentChunk && (
                  <span className="px-3 py-1.5 rounded-lg border border-dashed border-white/20 text-white/60 text-sm">
                    {currentChunk}_
                  </span>
                )}
                {!userSegments.length && !currentChunk && (
                  <span className="text-white/20 text-sm">输入词汇后点击「确认」</span>
                )}
              </div>
            </div>

            {/* 泰语输入区 */}
            {!showResult && (
              <div className="space-y-2">
                {quickChars.map((row, ri) => (
                  <div key={ri} className="flex flex-wrap gap-1 justify-center">
                    {row.split("").map((char) => (
                      <button
                        key={char}
                        onClick={() => handleCharInput(char)}
                        className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/70 text-sm hover:bg-white/[0.08] active:scale-90 transition-all"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}

                {/* 操作按钮 */}
                <div className="flex gap-2 justify-center pt-1">
                  <button
                    onClick={handleBackspace}
                    className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/80 transition"
                  >
                    ⌫ 退格
                  </button>
                  <button
                    onClick={handleConfirmWord}
                    disabled={!currentChunk.trim()}
                    className="px-4 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-medium hover:bg-purple-500/30 disabled:opacity-30 transition"
                  >
                    确认词 ✓
                  </button>
                  <button
                    onClick={handleRemoveLastWord}
                    disabled={!userSegments.length}
                    className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/80 disabled:opacity-30 transition"
                  >
                    撤销
                  </button>
                </div>
              </div>
            )}

            {/* 参考答案（错误时显示） */}
            {showResult === "wrong" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="text-white/40 text-xs mb-2">参考答案：</div>
                <div className="flex flex-wrap gap-2">
                  {q.words.map((w, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-400/30 text-green-300 text-sm font-medium">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="text-white/30 text-xs mt-2">{q.translation}</div>
              </motion.div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-center gap-3">
              {!showResult ? (
                <button
                  onClick={handleCheck}
                  disabled={userSegments.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-medium hover:bg-green-500/30 disabled:opacity-30 transition"
                >
                  检查分词
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition flex items-center gap-1"
                >
                  {currentQ < questions.length - 1 ? "下一句" : "查看结果"}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部分页 */}
      <div className="flex justify-center gap-1.5">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < currentQ ? "bg-green-400" : i === currentQ ? "bg-purple-400" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* 完成面板 */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-[#0E1A17] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
              <div className="text-4xl">🎯</div>
              <h2 className="text-xl font-bold text-white">分词练习完成</h2>
              <div className="text-white/60 text-sm">
                得分 <span className="text-yellow-400 font-bold">{score}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => initSet(currentBook)}
                  className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition"
                >
                  再练一次
                </button>
                <button
                  onClick={nextSet}
                  className="flex-1 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition flex items-center justify-center gap-1"
                >
                  下一组 <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
