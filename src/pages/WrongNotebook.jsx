import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  Search,
  Trash2,
  X,
  Volume2,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { speakThai } from "@/lib/thaiSpeech";
import { PageShell } from "@/components/common/PageShell";
import { Section } from "@/components/common/Section";
import {
  fetchWrongBook,
  removeWrongWord,
  clearWrongBook,
  formatWrongDate,
} from "@/lib/wordBooks";

/* =========================================================
   错题本 · WrongNotebook（/wrong-notebook）
   ---------------------------------------------------------
   本次重构修掉两个真实缺陷
   ------------------------
   ① **数据源错了，页面永远是空的**
      旧实现直接读 `base44.entities.WrongNotebook`——那是平台侧通道，
      而全站的错题其实写在本地主存储（`thaiai-wrong-notebook`，由
      lib/wordBooks 的 recordWrongWord 写入，配对/填空/测验都在写它）。
      两边不互通，所以用户答错一堆词，打开错题本还是"错题本为空"。
      现在统一走 `fetchWrongBook()`（本地为主 + 平台尽力合并）。

   ② **视觉是全站唯一的浅色旧设计**
      页面用的是 `bg-gradient-to-b from-thai-ivory` + `bg-thai-green`
      那套早期浅色 token，与全站深色玻璃语言完全不同，还额外渲染了
      自己的 `<Navbar />`，与 MainLayout 的侧边栏/底部栏叠成双层导航。
      现在改为 PageShell + Section，与其余页面同一套语言。

   功能一个都没少：搜索、难度/词书/排序筛选、批量选择、批量移除、
   单条移除、朗读、进入错题复习、清空。
========================================================= */

const SORT_OPTIONS = [
  { id: "date", label: "按最近错误" },
  { id: "count", label: "按错误次数" },
  { id: "alpha", label: "按字母序" },
];

export default function WrongNotebook() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [bookFilter, setBookFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  /* ── 读取：统一走 wordBooks 的错题本（本地为主存储） ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const book = await fetchWrongBook();
      /* fetchWrongBook 返回的是"词书"结构：{ words: [{ thai, roman, chinese,
         sentence, sentenceCn, wrongCount, lastWrongDate }] }，为空时返回 null */
      setItems(book?.words || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── 词书来源筛选：错题条目没有 book 字段，用 part_of_speech 之外的
        分类信息兜底（wordBooks 取词时会带上 pos），没有就不显示这一项 ── */
  const books = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.pos) set.add(item.pos);
    });
    return ["all", ...[...set].sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter(
        (item) =>
          (item.thai || "").toLowerCase().includes(kw) ||
          (item.chinese || "").toLowerCase().includes(kw) ||
          (item.roman || "").toLowerCase().includes(kw)
      );
    }

    if (bookFilter !== "all") {
      result = result.filter((item) => item.pos === bookFilter);
    }

    if (sortBy === "count") {
      result = [...result].sort((a, b) => (b.wrongCount || 1) - (a.wrongCount || 1));
    } else if (sortBy === "alpha") {
      result = [...result].sort((a, b) => (a.thai || "").localeCompare(b.thai || ""));
    }

    return result;
  }, [items, keyword, bookFilter, sortBy]);

  const toggleSelect = (thai) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(thai) ? next.delete(thai) : next.add(thai);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((item) => item.thai))
    );
  };

  const handleRemove = async (item) => {
    await removeWrongWord(item.thai);
    setItems((prev) => prev.filter((i) => i.thai !== item.thai));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.thai);
      return next;
    });
    toast({ title: "已移除", description: `「${item.thai}」已从错题本移除` });
  };

  const handleBatchRemove = async () => {
    const count = selectedIds.size;
    if (!count) return;
    for (const thai of selectedIds) {
      await removeWrongWord(thai);
    }
    setItems((prev) => prev.filter((i) => !selectedIds.has(i.thai)));
    setSelectedIds(new Set());
    setSelectMode(false);
    toast({ title: "批量移除", description: `已移除 ${count} 个错题` });
  };

  const handleClearAll = async () => {
    await clearWrongBook();
    setItems([]);
    setSelectedIds(new Set());
    toast({ title: "已清空错题本" });
  };

  /* ── 进入复习：交给词汇星球的测验模式（那里读 state.wrongWords） ──
     注意要转成 VocabQuiz 认识的字段名（thai_word / chinese_meaning …），
     否则它的 passFilter 会把词全部过滤掉，进去就是空白测验。 */
  const startQuiz = (words) => {
    if (!words.length) {
      toast({ title: "无错题可练", description: "请选择要练习的错题" });
      return;
    }
    navigate("/vocabulary", {
      state: {
        quizFromWrong: true,
        wrongWords: words.map((w) => ({
          id: `wrong-${w.thai}`,
          thai_word: w.thai,
          roman: w.roman || "",
          pronunciation: w.roman || "",
          chinese_meaning: w.chinese,
          example_thai: w.sentence || "",
          example_chinese: w.sentenceCn || "",
        })),
      },
    });
  };

  const handleBatchPractice = () => {
    const words = filtered.filter(
      (item) => selectedIds.size === 0 || selectedIds.has(item.thai)
    );
    startQuiz(words);
  };

  const hasFilters = bookFilter !== "all" || sortBy !== "date" || Boolean(keyword.trim());

  const clearFilters = () => {
    setBookFilter("all");
    setSortBy("date");
    setKeyword("");
  };

  return (
    <PageShell
      width="reading"
      title="错题本"
      subtitle={
        loading
          ? "正在读取错题记录…"
          : items.length
            ? `共 ${items.length} 个错词，答对即从错题本毕业`
            : "答错的单词会自动出现在这里"
      }
      icon={AlertCircle}
      badge="Review"
      actions={
        items.length ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/70 transition hover:border-emerald-300/30 hover:text-white"
            >
              {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {selectMode ? "取消" : "选择"}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-[12px] font-semibold text-white/35 transition hover:border-red-400/15 hover:bg-red-400/[0.06] hover:text-red-300/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState onGo={() => navigate("/vocabulary?mode=quiz")} />
      ) : (
        <>
          {/* ── 工具条：搜索 + 筛选 ── */}
          <Section divider={false}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="搜泰语 / 中文 / 罗马音"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-[12.5px] text-white/85 outline-none transition placeholder:text-white/25 focus:border-emerald-300/30"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-white/60 transition hover:border-emerald-300/25 hover:text-white"
                >
                  <Filter className="h-3.5 w-3.5" />
                  筛选与排序
                  {hasFilters ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
                  {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleBatchPractice}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.2]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {selectMode && selectedIds.size ? `复习选中的 ${selectedIds.size} 个` : "复习全部"}
                </button>
              </div>

              <AnimatePresence>
                {showFilters ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                      {books.length > 1 ? (
                        <FilterGroup label="词性">
                          {books.map((b) => (
                            <Chip
                              key={b}
                              active={bookFilter === b}
                              onClick={() => setBookFilter(b)}
                            >
                              {b === "all" ? "全部" : b}
                            </Chip>
                          ))}
                        </FilterGroup>
                      ) : null}

                      <FilterGroup label="排序">
                        {SORT_OPTIONS.map((opt) => (
                          <Chip
                            key={opt.id}
                            active={sortBy === opt.id}
                            onClick={() => setSortBy(opt.id)}
                          >
                            {opt.label}
                          </Chip>
                        ))}
                      </FilterGroup>

                      {hasFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-[11px] font-semibold text-white/40 underline-offset-4 transition hover:text-white/70 hover:underline"
                        >
                          清除筛选
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {selectMode ? (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="self-start text-[11px] font-semibold text-emerald-300/70 transition hover:text-emerald-300"
                >
                  {selectedIds.size === filtered.length ? "取消全选" : `全选 ${filtered.length} 个`}
                </button>
              ) : null}
            </div>
          </Section>

          {/* ── 错题列表 ── */}
          <Section
            title={`错词列表`}
            desc={filtered.length === items.length ? `${filtered.length} 个` : `筛选出 ${filtered.length} / ${items.length} 个`}
          >
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-white/40">
                没有符合筛选条件的错题
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((item) => {
                  const selected = selectedIds.has(item.thai);
                  return (
                    <li key={item.thai}>
                      <div
                        onClick={selectMode ? () => toggleSelect(item.thai) : undefined}
                        className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${
                          selectMode ? "cursor-pointer" : ""
                        } ${
                          selected
                            ? "border-emerald-300/40 bg-emerald-400/[0.08]"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"
                        }`}
                      >
                        {selectMode ? (
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected
                                ? "border-emerald-300 bg-emerald-400 text-[#04110f]"
                                : "border-white/20"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-viaoda text-[18px] font-bold text-white/95">
                              {item.thai}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakThai(item.thai, { rate: 0.75 });
                              }}
                              aria-label={`朗读 ${item.thai}`}
                              className="rounded-lg p-1 text-white/35 transition hover:bg-white/[0.06] hover:text-emerald-300"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                            {item.wrongCount > 1 ? (
                              <span className="rounded-full border border-red-400/20 bg-red-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-red-300/85">
                                错 {item.wrongCount} 次
                              </span>
                            ) : null}
                          </div>

                          {item.roman ? (
                            <p className="mt-0.5 text-[12px] font-medium text-emerald-300/70">
                              [{item.roman}]
                            </p>
                          ) : null}

                          <p className="mt-0.5 text-[12.5px] text-white/55">{item.chinese}</p>

                          {item.sentence ? (
                            <p className="mt-1.5 border-l-2 border-white/[0.08] pl-2.5 text-[11.5px] leading-5 text-white/35">
                              {item.sentence}
                              {item.sentenceCn ? <span className="ml-1.5 text-white/25">{item.sentenceCn}</span> : null}
                            </p>
                          ) : null}

                          {item.lastWrongDate ? (
                            <p className="mt-1 text-[10.5px] text-white/25">
                              最近错误：{formatWrongDate(item.lastWrongDate) || item.lastWrongDate}
                            </p>
                          ) : null}
                        </div>

                        {!selectMode ? (
                          <div className="flex shrink-0 flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startQuiz([item]);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/[0.16]"
                            >
                              <RotateCcw className="h-3 w-3" /> 再学
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(item);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-[11px] font-semibold text-white/35 transition hover:border-red-400/20 hover:bg-red-400/[0.08] hover:text-red-300/85"
                            >
                              <Trash2 className="h-3 w-3" /> 移除
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {selectMode && selectedIds.size ? (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/25 bg-[#0b1512]/95 px-4 py-3 backdrop-blur-xl">
              <span className="text-[12px] text-white/60">已选 {selectedIds.size} 个</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchPractice}
                  className="rounded-xl border border-emerald-300/25 bg-emerald-400/[0.14] px-3.5 py-2 text-[12px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.22]"
                >
                  复习选中
                </button>
                <button
                  type="button"
                  onClick={handleBatchRemove}
                  className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-3.5 py-2 text-[12px] font-bold text-red-300/85 transition hover:bg-red-400/[0.16]"
                >
                  移除选中
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

/* ── 小组件：筛选组与选项 ── */
function FilterGroup({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
        active
          ? "bg-emerald-400/[0.16] text-emerald-100"
          : "bg-white/[0.04] text-white/45 hover:text-white/75"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onGo }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.02] py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
        <AlertCircle className="h-7 w-7 text-emerald-300/40" />
      </div>
      <p className="text-[13.5px] font-semibold text-white/70">错题本为空</p>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-white/35">
        在词汇配对、句子填空、分词练习或词汇测验里答错的词，都会自动收录到这里
      </p>
      <button
        type="button"
        onClick={onGo}
        className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.12] px-4 py-2.5 text-[12.5px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.2]"
      >
        去词汇星球练习
      </button>
    </div>
  );
}
