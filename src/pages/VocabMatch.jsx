import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, CheckCircle2, XCircle, Trophy, Volume2 } from "lucide-react";
import WordBookPicker from "@/components/practice/WordBookPicker";
import { mergeBooks, generateMatchPairs, getSavedBookId, saveBookId, fetchWrongBook, recordWrongWord, formatWrongDate, getVocabBooks } from "@/lib/wordBooks";

/* 词书来源统一使用 getVocabBooks()（与词汇学习板块一致） */

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

export default function VocabMatch() {
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

  const [thaiWords, setThaiWords] = useState([]);
  const [chineseWords, setChineseWords] = useState([]);
  const [matches, setMatches] = useState({}); // { thaiIdx: chineseIdx }
  const [selectedThai, setSelectedThai] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [wrongPairs, setWrongPairs] = useState([]);
  const [showResult, setShowResult] = useState(null);
  const [lastWrong, setLastWrong] = useState(null);

  const initSet = useCallback((book) => {
    const words =
      book?.kind === "builtin"
        ? book.words
        : generateMatchPairs(book);
    setThaiWords(shuffle(words));
    setChineseWords(shuffle(words));
    setMatches({});
    setSelectedThai(null);
    setCompleted(false);
    setWrongPairs([]);
    setShowResult(null);
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

  const handleThaiClick = (idx) => {
    if (thaiWords[idx]._matched) return;
    setSelectedThai(idx);
  };

  const handleChineseClick = (chineseIdx) => {
    if (selectedThai === null) return;
    if (chineseWords[chineseIdx]._matched) return;

    const thaiWord = thaiWords[selectedThai];
    const chineseWord = chineseWords[chineseIdx];

    if (thaiWord.thai === chineseWord.thai) {
      // 正确匹配
      const newMatches = { ...matches, [selectedThai]: chineseIdx };
      setMatches(newMatches);

      // 标记已匹配
      setThaiWords((prev) =>
        prev.map((w, i) => (i === selectedThai ? { ...w, _matched: true } : w))
      );
      setChineseWords((prev) =>
        prev.map((w, i) => (i === chineseIdx ? { ...w, _matched: true } : w))
      );

      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => s + 1);
      setSelectedThai(null);
      setShowResult("correct");

      // 检查是否全部完成
      const allMatched = thaiWords.every((w, i) => w._matched || i === selectedThai);
      if (allMatched) {
        setTimeout(() => setCompleted(true), 500);
      }
    } else {
      // 错误匹配
      setStreak(0);
      setWrongPairs((prev) => [...prev, { thai: thaiWord.thai, chinese: chineseWord.chinese }]);
      setShowResult("wrong");
      setLastWrong({
        thai: thaiWord.thai,
        chinese: thaiWord.chinese || chineseWord.chinese,
        wrongCount: (thaiWord.wrongCount || 0) + 1,
        lastWrongDate: new Date().toISOString().slice(0, 10),
      });
      setSelectedThai(null);
      // 记入错题本并刷新词书（不阻塞交互）
      recordWrongWord(thaiWord).then(refreshWrongBook);
    }

    setTimeout(() => setShowResult(null), 800);
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">词汇-释义配对</h1>
          <p className="text-white/40 text-sm">点击泰语词 → 点击对应的中文释义</p>
        </div>
        <div className="flex items-center gap-3">
          <WordBookPicker books={allBooks} currentId={bookId} onSelect={selectBook} onWrongManaged={refreshWrongBook} />
          <div className="flex items-center gap-1.5 text-white/60 text-sm">
            <Trophy size={14} className="text-yellow-400" />
            <span>{score} 分</span>
          </div>
          {streak > 1 && (
            <div className="text-orange-400 text-sm font-medium">
              🔥 连对 {streak}
            </div>
          )}
          <button
            onClick={() => initSet(currentBook)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
          animate={{ width: `${(Object.keys(matches).length / thaiWords.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-white/30 text-xs">
          {currentBook ? `${currentBook.emoji} ${currentBook.name} · ${currentBook.count} 词` : ""}
        </div>
        <div className="text-white/30 text-xs">
          已匹配 {Object.keys(matches).length}/{thaiWords.length}
        </div>
      </div>

      {/* 匹配结果提示 */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
              showResult === "correct"
                ? "bg-green-500/20 text-green-300 border border-green-500/20"
                : "bg-red-500/20 text-red-300 border border-red-500/20"
            }`}
          >
            {showResult === "correct" ? (
              <><CheckCircle2 size={16} /> 正确！</>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5"><XCircle size={16} /> 再试试</span>
                {lastWrong && (
                  <span className="text-xs text-red-300/80">
                    📕 {lastWrong.thai} 已记入错题本 · 答错 {lastWrong.wrongCount} 次 · 最近 {formatWrongDate(lastWrong.lastWrongDate)}
                  </span>
                )}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主匹配区域 */}
      <div className="flex-1 flex gap-8 justify-center items-start pt-4">
        {/* 左侧：泰语词 */}
        <div className="flex flex-col gap-2">
          <div className="text-white/30 text-xs mb-1">泰语词汇</div>
          {thaiWords.map((word, i) => (
            <motion.button
              key={`${word.thai}-${i}`}
              whileHover={!word._matched ? { scale: 1.03 } : {}}
              whileTap={!word._matched ? { scale: 0.97 } : {}}
              onClick={() => handleThaiClick(i)}
              disabled={word._matched}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl border text-left transition-all min-w-[140px]
                ${word._matched
                  ? "bg-green-500/10 border-green-500/20 opacity-50"
                  : selectedThai === i
                    ? "bg-purple-500/20 border-purple-400/40 shadow-lg shadow-purple-500/10"
                    : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                }
              `}
            >
              <span className="text-white text-lg font-medium">{word.thai}</span>
              {/* 注意：外层是 button，这里不能用 button 嵌套 button（会触发
                 validateDOMNesting 警告），改用 role="button" 的 span */}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`播放 ${word.thai} 的发音`}
                onClick={(e) => { e.stopPropagation(); speak(word.thai); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    speak(word.thai);
                  }
                }}
                className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60 ml-auto cursor-pointer"
              >
                <Volume2 size={12} />
              </span>
              {word._matched && (
                <CheckCircle2 size={16} className="text-green-400 ml-auto" />
              )}
            </motion.button>
          ))}
        </div>

        {/* 连接线区域（简化为标签） */}
        <div className="hidden sm:flex flex-col items-center justify-center pt-8">
          <div className="text-white/10 text-3xl">⟷</div>
        </div>

        {/* 右侧：中文释义 */}
        <div className="flex flex-col gap-2">
          <div className="text-white/30 text-xs mb-1">中文释义</div>
          {chineseWords.map((word, i) => (
            <motion.button
              key={`${word.chinese}-${i}`}
              whileHover={!word._matched ? { scale: 1.03 } : {}}
              whileTap={!word._matched ? { scale: 0.97 } : {}}
              onClick={() => handleChineseClick(i)}
              disabled={word._matched}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl border text-left transition-all min-w-[140px]
                ${word._matched
                  ? "bg-green-500/10 border-green-500/20 opacity-50"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
                }
              `}
            >
              <span className="text-white text-base">{word.chinese}</span>
              {word._matched && (
                <CheckCircle2 size={16} className="text-green-400 ml-auto" />
              )}
            </motion.button>
          ))}
        </div>
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
              <div className="text-4xl">🎉</div>
              <h2 className="text-xl font-bold text-white">配对完成！</h2>
              <div className="text-white/60 text-sm">
                得分：<span className="text-yellow-400 font-bold">{score}</span>
              </div>
              {wrongPairs.length > 0 && (
                <div className="text-white/40 text-xs">
                  错误 {wrongPairs.length} 次，可以再练一次巩固
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => initSet(currentBook)}
                  className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition"
                >
                  再练一次
                </button>
                <button
                  onClick={nextSet}
                  className="flex-1 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition"
                >
                  下一组 →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
