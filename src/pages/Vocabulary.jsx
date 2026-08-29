import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus,
  Search,
  BookOpen,
  LayoutGrid,
  Brain,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { base44 } from "@/api/base44Client";
import { getVocabulary } from "@/api/vocabulary";
import AddVocabDialog from "@/components/vocabulary/AddVocabDialog";
import VocabGridItem from "@/components/vocabulary/VocabGridItem";
import VocabQuiz from "@/components/vocabulary/VocabQuiz";
import VocabFlip from "@/components/vocabulary/VocabFlip";
import { localVocabulary } from "@/data/vocabulary";
import { expandedVocabulary } from "@/data/vocabularyExpansion";
import { verifiedVocabularyBatch } from "@/data/verifiedVocabularyBatch";
import { vocabAllBooks } from "@/data/vocabAllBooks";
import { VOCABULARY_BOOKS, VOCABULARY_BOOK_TARGET } from "@/data/bookCatalog";

import {
  auditVocabulary,
  isVerifiedVocabulary,
  normalizeVocabularyText,
} from "@/lib/vocabularyQuality";
import {
  ThaiCorner,
  ParticleField,
} from "@/components/common/ThaiDecor";

const difficulties = [
  { id: "all", label: "全部" },
  { id: "beginner", label: "初级" },
  { id: "intermediate", label: "中级" },
  { id: "advanced", label: "高级" },
];

const modes = [
  {
    id: "browse",
    label: "浏览词汇",
    icon: LayoutGrid,
  },
  {
    id: "flip",
    label: "翻转卡",
    icon: Layers,
  },
  {
    id: "quiz",
    label: "测验",
    icon: Brain,
  },
];

const PAGE_SIZE = 18;

export default function Vocabulary() {
  const [vocab, setVocab] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [book, setBook] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState("browse");
  const [page, setPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);

  const location = useLocation();
  const [wrongQuizWords, setWrongQuizWords] = useState(null);

  useEffect(() => {
    if (location.state?.quizFromWrong && location.state?.wrongWords?.length > 0) {
      setWrongQuizWords(location.state.wrongWords);
      setMode("quiz");
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /* =========================
     加载词汇

     优先读取后端词库（内置 src/data/vocabulary.js 已同步进数据库）；
     后端不可用 → base44 云端；
     都不可用 / 为空 → 本地内置词库（完全离线可用）。
  ========================= */

  const loadVocab = async () => {
    setLoading(true);

    let data = null;

    // 1. 后端词库
    try {
      const res = await getVocabulary();
      const remote = res.data?.data;

      if (remote && remote.length > 0) {
        data = remote;
      }
    } catch (error) {
      console.error(
        "加载后端词库失败，尝试云端:",
        error
      );
    }

    // 2. base44 云端词库
    if (!data) {
      try {
        const remote = await base44.entities.Vocabulary.list(
          "-created_date",
          500
        );

        if (remote && remote.length > 0) {
          data = remote;
        }
      } catch (error) {
        console.error(
          "加载云端词汇失败，使用本地词库:",
          error
        );
      }
    }

    // 3. 本地内置词库
    if (!data) {
      data = localVocabulary;
    }

    // 扩展词库目前仍是待校审草稿：不进入正式浏览、翻转和测验池。
    // 审核通过后，将词条迁移到 vocabulary.js 或由后端正式词库返回。
    const formalWords = [...(data || []), ...verifiedVocabularyBatch, ...vocabAllBooks].map((item) => ({
      ...item,
      thai_word: item.thai_word || item.word || item.w,
      chinese_meaning: item.chinese_meaning || item.meaning || item.m,
      book: item.book || item.book_name || item.category || item.b || "基础泰语1",
      pronunciation: item.pronunciation || item.p,
      part_of_speech: item.part_of_speech || item.s,
      difficulty: item.difficulty || item.d,
      example_thai: item.example_thai || item.t,
      example_chinese: item.example_chinese || item.c,
      category: item.category || item.b,
      review_status: item.review_status || "verified",
    }));
    const auditIssues = auditVocabulary(formalWords);
    const unique = [];
    const seenThai = new Set();

    formalWords.forEach((word) => {
      const thai = normalizeVocabularyText(word.thai_word);
      if (!isVerifiedVocabulary(word) || seenThai.has(thai)) {
        return;
      }
      seenThai.add(thai);
      unique.push(word);
    });

    setVocab(unique);
    setLoading(false);
  };

  useEffect(() => {
    loadVocab();
  }, []);

  /* =========================
     分类
  ========================= */

  const categories = useMemo(() => {
    const cats = [
      ...new Set(
        vocab
          .map((item) => item.category)
          .filter(Boolean)
      ),
    ];

    return ["all", ...cats];
  }, [vocab]);

  /* =========================
     词书选择
  ========================= */

  const books = useMemo(() => {
    const names = [...new Set([
      ...VOCABULARY_BOOKS,
      ...vocab.map((item) => item.book || item.book_name),
    ].filter(Boolean))];
    return ["all", ...names];
  }, [vocab]);

  const bookStats = useMemo(() => {
    const formalCounts = new Map();
    vocab.forEach((item) => {
      const name = item.book || item.book_name || "基础泰语1";
      formalCounts.set(name, (formalCounts.get(name) || 0) + 1);
    });

    return VOCABULARY_BOOKS.map((name) => {
      const formalCount = formalCounts.get(name) || 0;
      return {
        name,
        count: formalCount,
        target: VOCABULARY_BOOK_TARGET,
        remaining: Math.max(0, VOCABULARY_BOOK_TARGET - formalCount),
      };
    }).sort((a, b) => b.count - a.count);
  }, [vocab]);

  /* =========================
     筛选
  ========================= */

  const filtered = useMemo(() => {
    return vocab.filter((item) => {
      const itemBook = item.book || item.book_name || "基础泰语1";
      if (book !== "all" && itemBook !== book) return false;
      if (
        category !== "all" &&
        item.category !== category
      ) {
        return false;
      }

      if (
        difficulty !== "all" &&
        item.difficulty !== difficulty
      ) {
        return false;
      }

      if (search.trim()) {
        const keyword = search.trim().toLowerCase();

        const thai = item.thai_word
          ?.toLowerCase()
          .includes(keyword);

        const chinese = item.chinese_meaning
          ?.toLowerCase()
          .includes(keyword);

        const pronunciation = item.pronunciation
          ?.toLowerCase()
          .includes(keyword);

        if (!thai && !chinese && !pronunciation) {
          return false;
        }
      }

      return true;
    });
  }, [
    vocab,
    category,
    book,
    difficulty,
    search,
  ]);

  /* =========================
     分页
  ========================= */

  useEffect(() => {
    setPage(1);
  }, [
    search,
    category,
    difficulty,
    mode,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const pageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  /* =========================
     页码
  ========================= */

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    if (page <= 4) {
      return [
        1,
        2,
        3,
        4,
        5,
        "...",
        totalPages,
      ];
    }

    if (page >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      page - 1,
      page,
      page + 1,
      "...",
      totalPages,
    ];
  }, [page, totalPages]);

  /* =========================
     清除筛选
  ========================= */

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setBook("all");
    setDifficulty("all");
  };

  const hasFilters =
    search ||
    book !== "all" ||
    category !== "all" ||
    difficulty !== "all";

  return (
    <div className="relative min-h-screen text-white">

      <main className="relative z-10 mx-auto max-w-[1500px] px-0 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-28">

        {/* =========================
            Hero
        ========================= */}

        <motion.div
          initial={{
            opacity: 0,
            y: -15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="relative mb-5 px-1 sm:mb-7 sm:px-0"
        >
          {/* 金色粒子场（Thai Gold × Learning 记忆点） */}

          <ParticleField
            color="#f5d67b"
            opacity={0.30}
          />

          <ThaiCorner
            corners={["tl", "br"]}
            size={24}
            className="hidden sm:block"
          />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">

            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-emerald-300/80">
                <Sparkles className="h-4 w-4" />
                THAI VOCABULARY SPACE
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
                词汇学习

                <span className="ml-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-yellow-300 bg-clip-text text-transparent">
                  Vocabulary
                </span>
              </h1>

              <p className="mt-2 text-sm text-white/40 sm:text-base">
                浏览、背诵并练习你的泰语词汇
              </p>
            </div>

            <button
              onClick={() => setDialogOpen(true)}
              className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:-translate-y-0.5 hover:shadow-emerald-400/20 sm:w-auto"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              添加生词
            </button>

          </div>
        </motion.div>

        {/* =========================
            数据概览
        ========================= */}

        <div className="mb-3 grid grid-cols-2 gap-2.5 px-1 sm:mb-3 sm:gap-3 sm:px-0 sm:grid-cols-4">

          <MiniStat
            label="词汇总量"
            value={vocab.length}
            suffix="词"
            icon={BookOpen}
          />

          <MiniStat
            label="当前显示"
            value={filtered.length}
            suffix="词"
            icon={LayoutGrid}
          />

          <MiniStat
            label="当前模式"
            value={
              mode === "browse"
                ? "浏览"
                : mode === "flip"
                  ? "翻转"
                  : "测验"
            }
            icon={
              mode === "browse"
                ? LayoutGrid
                : mode === "flip"
                  ? Layers
                  : Brain
            }
          />

          <MiniStat
            label="学习状态"
            value="Ready"
            icon={Sparkles}
          />

        </div>



        {/* =========================
            搜索
        ========================= */}

        <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-xl backdrop-blur-xl">

          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="搜索泰语、中文释义或发音..."
            className="w-full bg-transparent py-4 pl-12 pr-12 text-sm text-white outline-none placeholder:text-white/25"
          />

          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}

        </div>

        {/* =========================
            筛选
        ========================= */}

        <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">

          <button
            onClick={() =>
              setShowFilters((value) => !value)
            }
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >

            <div className="flex items-center gap-2">

              <SlidersHorizontal className="h-4 w-4 text-emerald-300" />

              <span className="text-sm font-medium">
                筛选词汇
              </span>

              {hasFilters && (
                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                  已筛选
                </span>
              )}

            </div>

            <ChevronRight
              className={`h-4 w-4 text-white/30 transition-transform ${
                showFilters ? "rotate-90" : ""
              }`}
            />

          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{
                  height: 0,
                  opacity: 0,
                }}
                animate={{
                  height: "auto",
                  opacity: 1,
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                }}
                className="border-t border-white/[0.06]"
              >

                <div className="space-y-4 p-4">

                  <FilterRow label="词书">
                    {books.map((item) => (
                      <FilterButton key={item} active={book === item} onClick={() => setBook(item)}>
                        {item === "all" ? "全部词书" : item}
                      </FilterButton>
                    ))}
                  </FilterRow>

                  <FilterRow label="类别">

                    {categories.map((cat) => (
                      <FilterButton
                        key={cat}
                        active={category === cat}
                        onClick={() =>
                          setCategory(cat)
                        }
                      >
                        {cat === "all"
                          ? "全部"
                          : cat}
                      </FilterButton>
                    ))}
                  </FilterRow>

                  <FilterRow label="难度">
                    {difficulties.map((item) => (
                      <FilterButton
                        key={item.id}
                        active={
                          difficulty === item.id
                        }
                        gold
                        onClick={() =>
                          setDifficulty(item.id)
                        }
                      >
                        {item.label}
                      </FilterButton>
                    ))}
                  </FilterRow>

                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-red-300/70 transition hover:text-red-300"
                    >
                      清除全部筛选
                    </button>
                  )}

                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* =========================
            学习模式
        ========================= */}

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5 shadow-xl backdrop-blur-xl sm:mb-6">

          <div className="grid grid-cols-3 gap-1">

            {modes.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={`relative flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    active
                      ? "text-white"
                      : "text-white/35 hover:text-white/70"
                  }`}
                >

                  {active && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/20 to-teal-400/10"
                    />
                  )}

                  <span className="relative flex items-center gap-2">

                    <Icon
                      className={`h-4 w-4 ${
                        active
                          ? "text-emerald-300"
                          : ""
                      }`}
                    />

                    {item.label}

                  </span>

                </button>
              );
            })}

          </div>

        </div>

        {/* =========================
            浏览模式
        ========================= */}

        {mode === "browse" && (
          <>

            <div className="mb-4 flex items-center justify-between">

              <div className="flex items-center gap-2 text-sm text-white/40">

                <BookOpen className="h-4 w-4 text-emerald-300/70" />

                <span>
                  找到{" "}
                  <span className="font-bold text-emerald-300">
                    {filtered.length}
                  </span>{" "}
                  个词汇
                </span>

              </div>

              {filtered.length > 0 && (
                <div className="text-xs text-white/25">
                  第 {page} / {totalPages} 页
                </div>
              )}

            </div>

            {loading ? (

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {Array.from({ length: 6 }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="h-44 animate-pulse rounded-2xl border border-white/5 bg-white/[0.035]"
                    />
                  )
                )}

              </div>

            ) : pageData.length === 0 ? (

              <EmptyState
                search={search}
                onClear={clearFilters}
                onAdd={() => setDialogOpen(true)}
              />

            ) : (

              <>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  {pageData.map((item, index) => (
                    <motion.div
                      key={
                        item.id ||
                        `${item.thai_word}-${index}`
                      }
                      initial={{
                        opacity: 0,
                        y: 12,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay: index * 0.035,
                      }}
                    >
                      <VocabGridItem
                        item={item}
                        index={index}
                      />
                    </motion.div>
                  ))}

                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">

                    <PaginationButton
                      disabled={page === 1}
                      onClick={() =>
                        setPage((value) =>
                          Math.max(
                            1,
                            value - 1
                          )
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </PaginationButton>

                    {pageNumbers.map(
                      (number, index) =>
                        number === "..." ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="px-2 text-white/20"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={number}
                            onClick={() =>
                              setPage(Number(number))
                            }
                            className={`h-9 w-9 rounded-lg text-xs font-semibold transition-all ${
                              page === number
                                ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-900/30"
                                : "border border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            {number}
                          </button>
                        )
                    )}

                    <PaginationButton
                      disabled={
                        page === totalPages
                      }
                      onClick={() =>
                        setPage((value) =>
                          Math.min(
                            totalPages,
                            value + 1
                          )
                        )
                      }
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </PaginationButton>

                  </div>
                )}

              </>
            )}

          </>
        )}

        {/* =========================
            背单词
        ========================= */}

        {mode === "flip" && (
          <VocabFlip
            words={wrongQuizWords || filtered}
            onExit={() => {
              setMode("browse");
              setWrongQuizWords(null);
            }}
          />
        )}

        {mode === "quiz" && (
          <VocabQuiz
            words={wrongQuizWords || filtered}
            source={wrongQuizWords ? "wrong" : "book"}
            onExit={() => {
              setMode("browse");
              setWrongQuizWords(null);
            }}
          />
        )}

      </main>

      {/* =========================
          添加按钮
      ========================= */}

      <motion.button
        onClick={() =>
          setDialogOpen(true)
        }
        initial={{
          scale: 0,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        whileHover={{
          scale: 1.08,
        }}
        whileTap={{
          scale: 0.92,
        }}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-emerald-400 via-teal-400 to-yellow-300 shadow-xl shadow-emerald-900/40 sm:bottom-7 sm:right-7"
      >
        <Plus className="h-6 w-6 text-white" />
      </motion.button>

      <AddVocabDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={loadVocab}
      />

    </div>
  );
}

/* =========================
   Mini Stat
========================= */

function MiniStat({
  label,
  value,
  suffix = "",
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.06]">

      <div className="flex items-center justify-between">

        <div className="rounded-xl bg-emerald-400/10 p-2">
          <Icon className="h-4 w-4 text-emerald-300" />
        </div>

        <Sparkles className="h-3.5 w-3.5 text-yellow-300/30" />

      </div>

      <div className="mt-3">

        <div className="text-[11px] text-white/35">
          {label}
        </div>

        <div className="mt-1 flex items-baseline gap-1">

          <span className="text-xl font-black text-white">
            {value}
          </span>

          {suffix && (
            <span className="text-xs text-white/30">
              {suffix}
            </span>
          )}

        </div>

      </div>

    </div>
  );
}

/* =========================
   Filter Row
========================= */

function FilterRow({
  label,
  children,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

      <span className="w-12 flex-shrink-0 text-xs font-medium text-white/30">
        {label}
      </span>

      <div className="flex flex-wrap gap-2">
        {children}
      </div>

    </div>
  );
}

/* =========================
   Filter Button
========================= */

function FilterButton({
  active,
  gold = false,
  children,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? gold
            ? "border-yellow-300/30 bg-yellow-300/15 text-yellow-200"
            : "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
          : "border-white/10 bg-white/[0.035] text-white/35 hover:bg-white/[0.07] hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================
   Pagination
========================= */

function PaginationButton({
  children,
  disabled,
  onClick,
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/50 transition-all hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-20"
    >
      {children}
    </button>
  );
}

/* =========================
   Empty State
========================= */

function EmptyState({
  search,
  onClear,
  onAdd,
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="rounded-[28px] border border-white/10 bg-white/[0.035] px-6 py-20 text-center shadow-xl backdrop-blur-xl"
    >

      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/10 bg-emerald-400/[0.06]">
        <BookOpen className="h-9 w-9 text-emerald-300/40" />
      </div>

      <h3 className="font-semibold text-white/70">
        没有找到匹配的单词
      </h3>

      <p className="mt-2 text-sm text-white/30">
        {search
          ? "换一个关键词试试看"
          : "目前还没有符合筛选条件的词汇"}
      </p>

      <div className="mt-6 flex justify-center gap-3">

        {search && (
          <button
            onClick={onClear}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/50 transition hover:text-white"
          >
            清除筛选
          </button>
        )}

        <button
          onClick={onAdd}
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30"
        >
          添加生词
        </button>

      </div>

    </motion.div>
  );
}