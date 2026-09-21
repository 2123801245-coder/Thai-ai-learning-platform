import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Shuffle,
  FileText,
  Puzzle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { preloadThaiAudio } from "@/lib/audioManager";
import { getLocalTtsUrl } from "@/lib/thaiSpeech";
import { getVocabulary } from "@/api/vocabulary";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { StartHereCard } from "@/components/vocabulary/StartHereCard";
import { fetchWrongBook } from "@/lib/wordBooks";
import { getVocabularyGuidance } from "@/lib/vocabularyGuidance";
import AddVocabDialog from "@/components/vocabulary/AddVocabDialog";
import VocabGridItem from "@/components/vocabulary/VocabGridItem";
import VocabQuiz from "@/components/vocabulary/VocabQuiz";
import VocabFlip from "@/components/vocabulary/VocabFlip";
/* 三种练习模式（原独立页面）合并进词汇星球；embedded 渲染去页级容器 */
import VocabMatch from "@/pages/VocabMatch";
import SentenceFill from "@/pages/SentenceFill";
import WordSegment from "@/pages/WordSegment";
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
/* PAPER 世界的词汇页版式层（“专业语言学习手册”）。
   跟本页 chunk 走：只有进词汇页才加载，四世界共用一套 DOM，
   规则全部带 html[data-visual-mode="paper"] 前缀 → 另外三个世界匹配不到。 */
import "@/themes/vocab-paper.css";

const difficulties = [
  { id: "all", label: "全部" },
  { id: "beginner", label: "初级" },
  { id: "intermediate", label: "中级" },
  { id: "advanced", label: "高级" },
];

/* =========================================================
   词汇星球的六种模式
   ---------------------------------------------------------
   前三种是「学」：浏览 / 翻转卡 / 测验（词书内单词）。
   后三种是「练」：词汇配对 / 句子填空 / 分词练习——原本是三个独立
   页面（/vocab-match、/sentence-fill、/word-segment），现在作为
   词汇星球的练习方式收进来：同一颗星球里学完直接练，少三个入口。
   旧路径保留为 301 重定向，深链不丢。
========================================================= */
const modes = [
  {
    id: "browse",
    label: "浏览词汇",
    short: "浏览",
    icon: LayoutGrid,
    kind: "learn",
  },
  {
    id: "flip",
    label: "翻转卡",
    short: "翻转",
    icon: Layers,
    kind: "learn",
  },
  {
    id: "quiz",
    label: "测验",
    short: "测验",
    icon: Brain,
    kind: "learn",
  },
  {
    id: "match",
    label: "词汇配对",
    short: "配对",
    icon: Shuffle,
    kind: "drill",
  },
  {
    id: "fill",
    label: "句子填空",
    short: "填空",
    icon: FileText,
    kind: "drill",
  },
  {
    id: "segment",
    label: "分词练习",
    short: "分词",
    icon: Puzzle,
    kind: "drill",
  },
];

/* 当前模式徽标与切换器共用同一份定义，避免两处各写一套分支 */
const MODE_BY_ID = Object.fromEntries(modes.map((item) => [item.id, item]));

/* 每个模式一句话说明：
   原来只有"浏览/翻转/测验"三个词，用户分不清该用哪个。 */
const MODE_HINTS = {
  browse: "按词书翻看全部词条",
  flip: "一张张过，点「认识」即记住",
  quiz: "四选一自测，答错进错题本",
  match: "泰语 ↔ 中文速配",
  fill: "从例句里选出缺失的词",
  segment: "把整句拆成词，练断句",
};

const modeGroups = [
  { key: "learn", label: "学", items: modes.filter((item) => item.kind === "learn") },
  { key: "drill", label: "练", items: modes.filter((item) => item.kind === "drill") },
];

const MODE_IDS = modes.map((item) => item.id);

const PAGE_SIZE = 18;

/* 练习模式只有一个真源：URL 的 ?mode=。
   旧路径 /vocab-match、/sentence-fill、/word-segment 已在路由层
   重定向到 /vocabulary?mode=xxx，所以组件不再需要 initialMode prop
   （那是一段没有任何调用方的死代码）。 */
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
  const navigate = useNavigate();
  const [wrongQuizWords, setWrongQuizWords] = useState(null);

  /* 学习进度 + 错题本：用来回答「我今天该先干什么」 */
  const { progress } = useLearningProgress();
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchWrongBook()
      .then((book) => {
        if (alive) setWrongCount(book?.words?.length || 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* =========================================================
     今天从这里开始：把六个等权重的模式收敛成一条有序的路
     ---------------------------------------------------------
     推荐顺序（都用真实数据判断，不是固定文案）：
       ① 错题本有词        → 先清错题（遗忘曲线优先）
       ② 今日目标没达标    → 认识新词
       ③ 认识过了但没测过  → 去测验
       ④ 其余情况          → 巩固练习
     ========================================================= */
  const todayWords = progress?.today_words || 0;
  const dailyGoal = progress?.daily_goal || 20;
  const goalDone = todayWords >= dailyGoal;
  const masteredTotal = progress?.total_vocabulary || 0;

  /* 推荐逻辑在 src/lib/vocabularyGuidance.js（纯函数，可单测） */
  const guidance = useMemo(
    () => getVocabularyGuidance({ todayWords, dailyGoal, wrongCount }),
    [todayWords, dailyGoal, wrongCount]
  );

  /* 推荐动作 → 直接切模式（与 chooseMode 同一套 URL 规范） */
  const startRecommended = () => {
    if (guidance.goto) {
      navigate(guidance.goto);
      return;
    }
    chooseMode(guidance.mode);
  };

  useEffect(() => {
    if (location.state?.quizFromWrong && location.state?.wrongWords?.length > 0) {
      setWrongQuizWords(location.state.wrongWords);
      setMode("quiz");
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /* =========================================================
     ?mode= 深链：/vocabulary?mode=match 这种链接（以及三条旧路径的
     重定向）能直接落在对应练习上；切换模式时反向写回 URL，
     刷新/分享都不丢当前模式。
     只在 URL 真的带了合法 mode 时才跟——这样「错题本→测验」那类
     由 state 驱动的切模式不会被 URL 拉回去。
  ========================================================= */
  const urlMode = new URLSearchParams(location.search).get("mode");

  useEffect(() => {
    if (urlMode && MODE_IDS.includes(urlMode) && urlMode !== mode) {
      setMode(urlMode);
      setWrongQuizWords(null);
    }
    // mode 故意不入依赖：只在 URL 变化时跟随 URL
  }, [urlMode, mode]);

  const chooseMode = (id) => {
    setMode(id);
    setWrongQuizWords(null);
    const params = new URLSearchParams(location.search);
    params.set("mode", id);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  /* =========================
     加载词汇

     优先读取后端词库（内置 src/data/vocabulary.js 已同步进数据库）；
     后端不可用 → 本地内置词库；
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

    /* 2. base44 平台词库通道已废弃
       ------------------------------------------------
       本项目已迁到自有 Express 后端，base44 侧没有对应表/权限，
       每次调用都会返回 401 并把错误打进控制台（用户看到"加载失败"的噪音）。
       这里不再发这个请求：后端词库（第 1 步）拿不到时直接落到本地内置词库。 */
    if (!data) {
      console.info("后端词库为空，使用本地内置词库");
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

  /* 预加载当前页可见词汇的音频（限前 12 个，避免一次性请求风暴）：
     用户点击 🔊 前先把本页词条的 TTS 拉入缓存 → 点击即播、无等待 */
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      document.hidden
    ) {
      return;
    }
    if (!pageData.length) return;
    const urls = pageData
      .slice(0, 12)
      .map((item) =>
        item.thai_word
          ? getLocalTtsUrl(item.thai_word, 0.75)
          : null
      )
      .filter(Boolean);
    if (urls.length) preloadThaiAudio(urls);
    // pageData 是每次渲染的新数组，用其内容签名做依赖，避免每次都触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, page]);

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

      <main className="tv-page relative z-10 mx-auto max-w-[1500px] px-0 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-28">

        {/* =========================
            PAPER 页眉（running head）
            --------------------------
            只在 paper 世界显示，另外三个世界由 .tv-runhead 的规则
            匹配不到而保持隐藏。这里必须用 hidden **属性**而不是 `hidden` 类：
            父容器带 space-y-*，那个选择器只认 [hidden] 属性；
            用类的话页眉会在另外三个世界凭空多出一份兄弟间距。
            间距由 .tv-runhead 的 margin-bottom 交出（见 vocab-paper.css）。
        ========================= */}

        <div hidden className="tv-runhead" aria-hidden="true">
          <span>词汇学习 · 词条手册</span>
          <span>THAI VOCABULARY · LEXICON</span>
        </div>

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
          className="tv-hero relative mb-5 px-1 sm:mb-7 sm:px-0"
        >
          {/* 金色粒子场（Thai Gold × Learning 记忆点） */}

          <ParticleField
            color="#f5d67b"
            opacity={0.30}
          />

          <ThaiCorner
            corners={["tl", "br"]}
            size={24}
            className="tv-ornament hidden sm:block"
          />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">

            <div>
              <div className="tv-eyebrow mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-emerald-300/80">
                <Sparkles className="h-4 w-4" />
                THAI VOCABULARY SPACE
              </div>

              <h1 className="tv-title text-2xl font-black tracking-tight sm:text-4xl">
                词汇学习

                <span className="tv-title-en ml-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-yellow-300 bg-clip-text text-transparent">
                  Vocabulary
                </span>
              </h1>

              <p className="tv-lede mt-2 text-sm text-white/40 sm:text-base">
                浏览、背诵并练习你的泰语词汇
              </p>
            </div>

            {/* 次级行动：这不是日常第一件事，所以从"最显眼的主按钮"
                降为描边按钮，把视觉主位让给下方引导卡的「开始认识新词」。 */}
            <button
              onClick={() => setDialogOpen(true)}
              className="tv-add group flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-all hover:border-emerald-300/30 hover:bg-white/[0.07] hover:text-white sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
              添加生词
            </button>

          </div>
        </motion.div>

        {/* PAPER 副题行：纯排版的“版本行”（词条数 / 当前模式 / 词书），
            数字全部取自下面已经算好的既有值，不新增任何数据来源。
            同样用 hidden 属性控制显隐。 */}

        <p hidden className="tv-runner" aria-hidden="true">
          {vocab.length} entries · {filtered.length} shown · {MODE_BY_ID[mode]?.short || "浏览"}
          {book !== "all" ? ` · ${book}` : ""}
        </p>

        {/* =========================
            今天从这里开始（引导）
            --------------------------
            原来首屏是"统计数字 + 六个等权重按钮"，用户不知道先点哪个。
            这里用真实数据给出**唯一的下一步**，并把它放在最显眼的位置。
        ========================= */}

        <div className="tv-start-shell mb-4">
          <StartHereCard
            recommendId={guidance.recommendId}
            reason={guidance.reason}
            ctaLabel={guidance.ctaLabel}
            onStart={startRecommended}
            todayWords={todayWords}
            dailyGoal={dailyGoal}
            wrongCount={wrongCount}
            bookName={book !== "all" ? book : undefined}
          />
        </div>

        {/* =========================
            数据概览
        ========================= */}

        <div className="tv-ledger mb-3 grid grid-cols-2 gap-2.5 px-1 sm:mb-3 sm:gap-3 sm:px-0 sm:grid-cols-4">

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
            value={MODE_BY_ID[mode]?.short || "浏览"}
            icon={MODE_BY_ID[mode]?.icon || LayoutGrid}
          />

          {/* 「Ready」原来是个没有信息量的占位；换成真实累计读数 */}
          <MiniStat
            label="累计掌握"
            value={masteredTotal}
            suffix="词"
            icon={Sparkles}
          />

        </div>



        {/* =========================
            搜索
        ========================= */}

        <div className="tv-search relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-xl backdrop-blur-xl">

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

        <div className="tv-filters mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">

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

        <div className="tv-index mb-5 space-y-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5 shadow-xl backdrop-blur-xl sm:mb-6">

          {/* 两行六模式：学（浏览/翻转卡/测验）与练（配对/填空/分词）。
             配对/填空/分词原本是三个独立页面，现在就是词汇星球的练习方式。
             PAPER 下这一块排成“目录”：每模式一行，行首序号、行尾页码位。 */}
          {modeGroups.map((group) => (

          <div key={group.key} className="tv-index-group flex items-center gap-1">

            <span className="tv-index-label w-5 shrink-0 pl-1 text-[11px] font-semibold tracking-wider text-white/25">
              {group.label}
            </span>

            <div className="tv-index-grid grid flex-1 grid-cols-3 gap-1">

            {group.items.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => chooseMode(item.id)}
                  title={MODE_HINTS[item.id]}
                  className={`tv-index-item relative flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                    active
                      ? "text-white"
                      : "text-white/40 hover:text-white/75"
                  }`}
                >

                  {/* 目录序号：只在 PAPER 显示（hidden 属性 → 不占位、
                      不进任何 space-y 的选择器范围；其他世界无规则匹配） */}
                  <span hidden className="tv-index-no" aria-hidden="true">
                    {group.key === "learn" ? "0" : "1"}
                    {group.items.indexOf(item) + 1}
                  </span>

                  {active && (
                    <motion.div
                      layoutId="activeMode"
                      className="tv-ornament absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/20 to-teal-400/10"
                    />
                  )}

                  <span className="relative flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? "text-emerald-300"
                          : ""
                      }`}
                    />
                    <span className="text-[13px] font-semibold">{item.label}</span>
                    {/* 当前推荐的那一步直接标出来：用户不需要自己判断先做哪个 */}
                    {guidance.recommendId === item.id ? (
                      <span className="rounded-full border border-emerald-300/35 bg-emerald-400/[0.14] px-1.5 py-px text-[9px] font-bold text-emerald-200">
                        建议
                      </span>
                    ) : null}
                  </span>

                  {/* 一句话说明：解决"六个词分不清差别" */}
                  <span className="tv-index-hint relative block truncate text-[10.5px] font-normal text-white/30">
                    {MODE_HINTS[item.id]}
                  </span>


                </button>
              );
            })}

            </div>

          </div>

          ))}

        </div>

        {/* =========================
            浏览模式
        ========================= */}

        {mode === "browse" && (
          <>

            <div className="tv-entrybar mb-4 flex items-center justify-between">

              <div className="flex items-center gap-2 text-sm text-white/40">

                <BookOpen className="h-4 w-4 text-emerald-300/70" />

                <span className="tv-entrybar-count">
                  找到{" "}
                  <span className="font-bold text-emerald-300">
                    {filtered.length}
                  </span>{" "}
                  个词汇
                </span>

              </div>

              {filtered.length > 0 && (
                <div className="tv-entrybar-page text-xs text-white/25">
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
                        /* 词条序号（词典行首编号）：纯排版用，由分页位置算出，
                           没进任何 state，也不改 VocabGridItem 的既有 props 语义 */
                        ordinal={(page - 1) * PAGE_SIZE + index + 1}
                      />
                    </motion.div>
                  ))}

                </div>

                {totalPages > 1 && (
                  <div className="tv-pager mt-8 flex flex-wrap items-center justify-center gap-1.5">

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
                            className={`tv-pager-num h-9 w-9 rounded-lg text-xs font-semibold transition-all ${
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

        {/* =========================
            练习模式（原独立页面，现为词汇星球的练习方式）
        ========================= */}

        {mode === "match" && <VocabMatch embedded />}

        {mode === "fill" && <SentenceFill embedded />}

        {mode === "segment" && <WordSegment embedded />}

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
    <div className="tv-ledger-cell rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.06]">

      <div className="flex items-center justify-between">

        <div className="tv-ledger-icon rounded-xl bg-emerald-400/10 p-2">
          <Icon className="h-4 w-4 text-emerald-300" />
        </div>

        <Sparkles className="tv-ornament h-3.5 w-3.5 text-yellow-300/30" />

      </div>

      <div className="mt-3">

        <div className="tv-ledger-label text-[11px] text-white/35">
          {label}
        </div>

        <div className="mt-1 flex items-baseline gap-1">

          <span className="tv-ledger-value text-xl font-black text-white">
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
      className={`tv-chip rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
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
      className="tv-pager-btn flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/50 transition-all hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-20"
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
      className="tv-empty rounded-[28px] border border-white/10 bg-white/[0.035] px-6 py-20 text-center shadow-xl backdrop-blur-xl"
    >

      <div className="tv-empty-icon mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/10 bg-emerald-400/[0.06]">
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