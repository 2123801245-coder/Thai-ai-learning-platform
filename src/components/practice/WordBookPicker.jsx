import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, Check, X, Trash2 } from "lucide-react";
import { removeWrongWord, clearWrongBook, formatWrongDate } from "@/lib/wordBooks";

/**
 * 词书选择器
 * books: [{ id, name, emoji, kind: 'builtin'|'vocab'|'wrong', count, words }]
 * onWrongManaged: 错题本被移除/清空后回调（页面刷新错题本并重新生成题目）
 */
export default function WordBookPicker({
  books,
  currentId,
  onSelect,
  onWrongManaged,
  label = "选择词书",
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const current = books.find((b) => b.id === currentId) || books[0];
  const wrongBook = books.find((b) => b.kind === "wrong");

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleRemove = async (thai) => {
    if (busy) return;
    setBusy(true);
    await removeWrongWord(thai);
    onWrongManaged?.();
    setBusy(false);
  };

  const handleClear = async () => {
    if (busy) return;
    if (!window.confirm("确定清空错题本吗？所有错词记录将被删除，此操作不可恢复。")) return;
    setBusy(true);
    await clearWrongBook();
    onWrongManaged?.();
    setBusy(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/[0.08] px-3.5 py-2 text-sm text-purple-200 transition hover:bg-purple-500/[0.15]"
        title={label}
      >
        <BookOpen size={14} className="text-purple-300/70" />
        <span className="max-w-[140px] truncate font-medium">
          {current ? `${current.emoji} ${current.name}` : "选择词书"}
        </span>
        <ChevronDown size={14} className={`text-purple-300/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a18]/95 shadow-2xl shadow-black/50 backdrop-blur-2xl"
          >
            {/* ── 错题本管理（错题本存在时显示在顶部）── */}
            {wrongBook && (
              <>
                <div className="border-b border-white/[0.06] px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[10px] font-bold uppercase tracking-widest text-red-300/60">
                      📕 错题本管理 · {wrongBook.count} 词
                    </div>
                    <button
                      onClick={handleClear}
                      disabled={busy || !wrongBook.count}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                      清空错题本
                    </button>
                  </div>
                </div>
                {wrongBook.count > 0 && (
                  <div className="max-h-44 overflow-y-auto border-b border-white/[0.06] p-1.5">
                    {wrongBook.words.slice(0, 30).map((w) => (
                      <div
                        key={w.thai}
                        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs text-white/80">
                            <span className="font-medium text-white/90">{w.thai}</span>{" "}
                            <span className="text-white/40">{w.chinese}</span>
                          </div>
                          <div className="text-[10px] text-red-300/50">
                            {w.wrongCount > 0
                              ? `答错 ${w.wrongCount} 次${w.lastWrongDate ? ` · 最近 ${formatWrongDate(w.lastWrongDate)}` : ""}`
                              : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(w.thai)}
                          disabled={busy}
                          title={`移除 ${w.thai}`}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white/25 transition hover:bg-red-500/15 hover:text-red-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {wrongBook.count > 30 && (
                      <div className="px-2 py-1 text-center text-[10px] text-white/30">
                        … 还有 {wrongBook.count - 30} 个错词
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="border-b border-white/[0.06] px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-purple-300/50">
                选择练习词书
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => {
                    onSelect(book.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    book.id === currentId
                      ? "bg-purple-500/[0.15]"
                      : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-lg">{book.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${book.id === currentId ? "text-purple-200" : "text-white/80"}`}>
                      {book.name}
                    </div>
                    <div className={`text-[10px] ${book.kind === "wrong" ? "text-red-300/60" : "text-white/30"}`}>
                      {book.kind === "vocab"
                        ? "系统词书"
                        : book.kind === "wrong"
                          ? "错题本 · 自动收录"
                          : "内置练习"}{" "}
                      · {book.count} 词
                    </div>
                  </div>
                  {book.id === currentId && (
                    <Check size={14} className="flex-shrink-0 text-purple-300" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
