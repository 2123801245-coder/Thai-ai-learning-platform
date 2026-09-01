import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, CheckCircle2, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import WordBookPicker from "@/components/practice/WordBookPicker";
import { mergeBooks, generateFillQuestions, getSavedBookId, saveBookId, fetchWrongBook, recordWrongWord, formatWrongDate, getVocabBooks } from "@/lib/wordBooks";

/* 词书来源统一使用 getVocabBooks()（与词汇学习板块一致）
   generateFillQuestions 从词书例句中自动挖空生成题目 */
const sentenceSets = [
  [
    {
      sentence: "สวัสดี ___ ครับ/ค่ะ",
      blank: "ครับ/ค่ะ",
      roman: "sà-wàt-dee ___ kháp/khâ",
      hint: "用于问候结尾的礼貌词",
      options: ["ครับ/ค่ะ", "นะ", "สิ", "หรอ"],
      fullSentence: "สวัสดีครับ/ค่ะ",
      translation: "你好",
    },
    {
      sentence: "ผม ___ ภาษาไทย",
      blank: "เรียน",
      roman: "phǒm ___ phaa-sǎa thai",
      hint: "学习",
      options: ["กิน", "เรียน", "ชอบ", "ไป"],
      fullSentence: "ผมเรียนภาษาไทย",
      translation: "我学习泰语",
    },
    {
      sentence: "วันนี้ ___ ดีมาก",
      blank: "อากาศ",
      roman: "wan-níi ___ aa-gàat dìi mâak",
      hint: "天气",
      options: ["อากาศ", "คน", "เวลา", "อาหาร"],
      fullSentence: "วันนี้อากาศดีมาก",
      translation: "今天天气很好",
    },
    {
      sentence: "ขอบคุณ ___ มาก",
      blank: "คุณ",
      roman: "khàwp-khun ___ mâak",
      hint: "你（礼貌称呼）",
      options: ["คุณ", "เขา", "มัน", "ฉัน"],
      fullSentence: "ขอบคุณคุณมาก",
      translation: "非常感谢你",
    },
    {
      sentence: "ฉัน ___ ไปตลาด",
      blank: "อยาก",
      roman: "chǎn ___ bpai dtà-làat",
      hint: "想要",
      options: ["ต้อง", "อยาก", "ชอบ", "เคย"],
      fullSentence: "ฉันอยากไปตลาด",
      translation: "我想去市场",
    },
  ],
  [
    {
      sentence: "เขา ___ ทุกวัน",
      blank: "ทำงาน",
      roman: "khǎo ___ túk-wan",
      hint: "工作",
      options: ["ทำงาน", "กินข้าว", "นอน", "วิ่ง"],
      fullSentence: "เขาทำงานทุกวัน",
      translation: "他/她每天工作",
    },
    {
      sentence: "ร้านนี้ ___ มาก",
      blank: "อร่อย",
      roman: "ráan-níi ___ mâak",
      hint: "好吃",
      options: ["แพง", "อร่อย", "ไกล", "ร้อน"],
      fullSentence: "ร้านนี้อร่อยมาก",
      translation: "这家店很好吃",
    },
    {
      sentence: "ประเทศไทย ___ สวย",
      blank: "มาก",
      roman: "bprà-têet thai ___ sǔay",
      hint: "很（程度副词）",
      options: ["มาก", "นิด", "หน่อย", "ที่สุด"],
      fullSentence: "ประเทศไทยมากสวย",
      translation: "泰国很美",
    },
    {
      sentence: "กี่ ___ แล้ว",
      blank: "โมง",
      roman: "gìi ___ láew",
      hint: "小时/点（时间单位）",
      options: ["โมง", "นาที", "วินาที", "เดือน"],
      fullSentence: "กี่โมงแล้ว",
      translation: "几点了",
    },
    {
      sentence: "นี่ ___ ของฉัน",
      blank: "คือ",
      roman: "nîi ___ khɔ̌ɔŋ chǎn",
      hint: "是（判断动词）",
      options: ["คือ", "มี", "เป็น", "อยู่"],
      fullSentence: "นี่คือของฉัน",
      translation: "这是我的",
    },
  ],
  [
    {
      sentence: "เขาพูดภาษาไทยได้ ___",
      blank: "เก่ง",
      roman: "khǎo phûut phaa-sǎa thai dâai ___",
      hint: "好/厉害",
      options: ["เก่ง", "มาก", "ดี", "ช้า"],
      fullSentence: "เขาพูดภาษาไทยได้เก่ง",
      translation: "他/她说泰语说得好",
    },
    {
      sentence: "ฉัน ___ มาจากจีน",
      blank: "มาจาก",
      roman: "chǎn ___ maa jàak jiin",
      hint: "来自",
      options: ["มาจาก", "ไปที่", "อยู่ที่", "จะไป"],
      fullSentence: "ฉันมาจากจีน",
      translation: "我来自中国",
    },
    {
      sentence: "พรุ่งนี้จะ ___ ฝน",
      blank: "ตก",
      roman: "phrûng-níi jà ___ fǒn",
      hint: "下雨",
      options: ["ตก", "มี", "เป็น", "ได้"],
      fullSentence: "พรุ่งนี้จะตกฝน",
      translation: "明天会下雨",
    },
    {
      sentence: "คุณ ___ อะไร",
      blank: "ชอบ",
      roman: "khǎn ___ à-rai",
      hint: "喜欢",
      options: ["ชอบ", "เกลียด", "กลัว", "รู้"],
      fullSentence: "คุณชอบอะไร",
      translation: "你喜欢什么",
    },
    {
      sentence: "ที่ ___ มีคนเยอะ",
      blank: "นั่น",
      roman: "thîi ___ mii khon yə́",
      hint: "那（远指）",
      options: ["นั่น", "นี่", "นั่นเอง", "โน่น"],
      fullSentence: "ที่นั่นมีคนเยอะ",
      translation: "那里有很多人",
    },
  ],
];

/* 词书来源统一使用 getVocabBooks()（与词汇学习板块一致）
   generateFillQuestions 从词书例句中自动挖空生成题目 */
const builtinBooks = [];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "th-TH";
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
}

export default function SentenceFill() {
  const [wrongBook, setWrongBook] = useState(null);

  const refreshWrongBook = useCallback(() => {
    fetchWrongBook().then((b) => setWrongBook(b));
  }, []);

  useEffect(() => {
    refreshWrongBook();
  }, [refreshWrongBook]);

  const allBooks = useMemo(
    () => mergeBooks([], wrongBook ? [wrongBook] : []),
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
  const [selectedOption, setSelectedOption] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  const initSet = useCallback((book) => {
    const raw =
      book?.kind === "builtin"
        ? book.words.map((s) => ({ ...s, shuffledOptions: shuffle(s.options) }))
        : generateFillQuestions(book);
    setQuestions(raw);
    setCurrentQ(0);
    setSelectedOption(null);
    setShowResult(null);
    setScore(0);
    setCorrectCount(0);
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

  const handleOptionClick = (option) => {
    if (showResult) return;
    setSelectedOption(option);

    const isCorrect = option === questions[currentQ].blank;
    setShowResult(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
    } else {
      // 答错 → 记入错题本并刷新词书（不阻塞交互）
      const q = questions[currentQ];
      recordWrongWord({
        thai: q.blank,
        chinese: q.hint,
        roman: q.roman,
        sentence: q.fullSentence,
        sentenceCn: q.translation,
      }).then(refreshWrongBook);
    }

    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((q) => q + 1);
        setSelectedOption(null);
        setShowResult(null);
      } else {
        setCompleted(true);
      }
    }, 1200);
  };

  if (questions.length === 0) return null;

  const q = questions[currentQ];

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">句子填空补词</h1>
          <p className="text-white/40 text-sm">根据提示，选择正确的泰语单词填入空白处</p>
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
        <span className="text-white/30 text-xs shrink-0">
          题目 {currentQ + 1}/{questions.length}
        </span>
      </div>

      {/* 题目区域 */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-6"
          >
            {/* 泰语句子 */}
            <div className="text-center">
              <div className="text-3xl sm:text-4xl text-white font-medium leading-relaxed">
                {q.sentence.split("___").map((part, i) => (
                  <span key={i}>
                    {part}
                    {i < q.sentence.split("___").length - 1 && (
                      <span className={`inline-block min-w-[80px] border-b-2 mx-1 text-center transition-colors ${
                        showResult === "correct"
                          ? "border-green-400 text-green-300"
                          : showResult === "wrong"
                            ? "border-red-400 text-red-300"
                            : "border-purple-400 text-purple-300"
                      }`}>
                        {selectedOption || "？"}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <div className="text-white/30 text-sm mt-2">{q.roman}</div>
              <div className="text-white/40 text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>💡 提示: {q.hint}</span>
                {q.wrongCount > 0 && (
                  <span className="text-red-300/70 text-xs">
                    📕 错题 {q.wrongCount} 次{q.lastWrongDate ? ` · 最近 ${formatWrongDate(q.lastWrongDate)}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* 选项 */}
            <div className="flex flex-wrap gap-2 justify-center">
              {q.shuffledOptions.map((option) => (
                <motion.button
                  key={option}
                  whileHover={!showResult ? { scale: 1.05 } : {}}
                  whileTap={!showResult ? { scale: 0.95 } : {}}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!showResult}
                  className={`
                    px-5 py-2.5 rounded-xl border text-base font-medium transition-all
                    ${showResult && option === q.blank
                      ? "bg-green-500/20 border-green-400/40 text-green-300"
                      : showResult && option === selectedOption && option !== q.blank
                        ? "bg-red-500/20 border-red-400/40 text-red-300"
                        : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.06] hover:border-white/[0.15]"
                    }
                  `}
                >
                  {option}
                </motion.button>
              ))}
            </div>

            {/* 结果提示 */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center justify-center gap-2 text-sm ${
                    showResult === "correct" ? "text-green-300" : "text-red-300"
                  }`}
                >
                  {showResult === "correct" ? (
                    <>
                      <CheckCircle2 size={16} />
                      正确！{q.translation && `— ${q.translation}`}
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      正确答案是「{q.blank}」
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 朗读按钮 */}
            <div className="flex justify-center">
              <button
                onClick={() => speak(q.fullSentence)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white/80 transition"
              >
                <Volume2 size={14} /> 朗读完整句子
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部分页指示器 */}
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
              <div className="text-4xl">
                {correctCount === questions.length ? "🏆" : correctCount >= questions.length / 2 ? "👏" : "💪"}
              </div>
              <h2 className="text-xl font-bold text-white">
                {correctCount === questions.length ? "全部正确！" : "练习完成"}
              </h2>
              <div className="text-white/60 text-sm space-y-1">
                <div>正确 <span className="text-green-400 font-bold">{correctCount}</span> / {questions.length}</div>
                <div>得分 <span className="text-yellow-400 font-bold">{score}</span></div>
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
