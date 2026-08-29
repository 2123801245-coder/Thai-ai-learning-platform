import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Languages,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  GraduationCap,
  ListChecks,
  Keyboard,
  Headphones,
  ArrowLeftRight,
  Play,
  Pause,
  Square,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { lessons } from "@/data/courseTexts";
import { localVocabulary } from "@/data/vocabulary";
import { wordNotes } from "@/data/wordNotes";
import Dictation from "@/components/lessons/Dictation";
import ListenChoose from "@/components/lessons/ListenChoose";
import Translate from "@/components/lessons/Translate";
import { speakThai, getLocalTtsUrl, registerActiveAudio } from "@/lib/thaiSpeech";
import { useAuth } from "@/lib/AuthContext";
import VipPanel from "@/components/common/VipPanel";

/* =========================================================
   朗读（统一泰语发音：选 voice + Google TTS 回退）
   - 若课文朗读器正在播放，先停止它（点击词/段落/例句时
     由朗读器页面注册 stopReader 到这里，保证互不叠音）
========================================================= */

let lessonReaderStop = null;

export function registerLessonReaderStop(fn) {
  lessonReaderStop = fn;
}

function speak(text) {
  if (!text) return;
  lessonReaderStop?.();
  speakThai(text, { rate: 0.78 });
}

/* =========================================================
   本课词表：id → 泰语词
========================================================= */

function buildLessonWords(wordIds) {
  const set = new Set();
  for (const wid of wordIds) {
    const w = localVocabulary.find((item) => item.id === wid);
    if (w && w.thai_word) {
      set.add(w.thai_word);
    }
  }
  return set;
}

/* =========================================================
   课文高亮文本（只高亮本课生词）
   - 按词长降序匹配，避免 หนาว 先吃掉 หนาวเย็น
   - 点击生词 → 发音；悬停 → 显示中文释义
========================================================= */

function HighlightText({ text, wordIds, activeChar = null }) {
  const words = useMemo(
    () => buildLessonWords(wordIds || []),
    [wordIds]
  );

  const vocabMap = useMemo(() => {
    const map = new Map();
    for (const w of localVocabulary) {
      if (w.thai_word && words.has(w.thai_word)) {
        map.set(w.thai_word, {
          meaning: w.chinese_meaning,
          id: w.id,
        });
      }
    }
    return map;
  }, [words]);

  const regex = useMemo(() => {
    const list = [...vocabMap.keys()].sort(
      (a, b) => [...b].length - [...a].length
    );
    if (list.length === 0) return null;
    const escaped = list
      .map((w) =>
        w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      )
      .join("|");
    return new RegExp(`(${escaped})`, "g");
  }, [vocabMap]);

  const parts = useMemo(() => {
    if (!regex) {
      return [{ type: "plain", value: text, start: 0 }];
    }

    const chunks = [];
    let lastIndex = 0;
    let match = null;
    const re = new RegExp(regex.source, "g");

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        chunks.push({
          type: "plain",
          value: text.slice(lastIndex, match.index),
          start: lastIndex,
        });
      }
      chunks.push({
        type: "word",
        value: match[0],
        info: vocabMap.get(match[0]),
        start: match.index,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      chunks.push({
        type: "plain",
        value: text.slice(lastIndex),
        start: lastIndex,
      });
    }

    return chunks;
  }, [text, regex, vocabMap]);

  // 扁平化渲染项：生词保持整块（可能含空格）；普通文本按空白细分为
  // 「词 / 空白」，使朗读进度能逐词点亮任意当前词（含非生词）。
  const renderItems = useMemo(() => {
    const items = [];
    for (const part of parts) {
      if (part.type === "word") {
        items.push({
          type: "word",
          value: part.value,
          info: part.info,
          start: part.start,
        });
        continue;
      }
      const re = /(\s+)/g;
      let last = part.start;
      let m = null;
      while ((m = re.exec(part.value)) !== null) {
        const seg = part.value.slice(last - part.start, m.index);
        if (seg) {
          items.push({ type: "plain", value: seg, start: last });
        }
        items.push({
          type: "space",
          value: m[0],
          start: part.start + m.index,
        });
        last = part.start + m.index + m[0].length;
      }
      if (last < part.start + part.value.length) {
        items.push({
          type: "plain",
          value: part.value.slice(last - part.start),
          start: last,
        });
      }
    }
    return items;
  }, [parts]);

  // 朗读进度对应的“当前朗读项”：找到第一个「结束位置 > 进度字符」的
  // 非空白项（生词或普通词都会高亮，形成逐词跟读视觉）。
  const activeItem = useMemo(() => {
    if (activeChar === null || activeChar < 0) return -1;
    return renderItems.findIndex(
      (it) =>
        it.type !== "space" &&
        it.start + it.value.length > activeChar
    );
  }, [renderItems, activeChar]);

  return (
    <>
      {renderItems.map((item, index) => {
        const isActive = index === activeItem;
        if (item.type === "word") {
          return (
            <button
              key={`${item.value}-${index}`}
              type="button"
              title={`${item.value} · ${item.info?.meaning || ""}（点击发音）`}
              onClick={(event) => {
                event.stopPropagation();
                speak(item.value);
              }}
              className={`
                mx-0.5
                inline-block
                rounded-md
                border
                bg-emerald-400/10
                px-1
                font-thai
                text-emerald-200
                underline
                decoration-emerald-300/30
                decoration-dotted
                underline-offset-4
                transition-all
                hover:border-emerald-300/50
                hover:bg-emerald-400/20
                hover:text-white
                ${
                  isActive
                    ? "border-yellow-300/70 bg-yellow-300/25 text-yellow-100 shadow-[0_0_10px_rgba(250,204,21,0.35)]"
                    : "border-emerald-300/25"
                }
              `}
            >
              {item.value}
            </button>
          );
        }
        if (item.type === "space") {
          return <span key={`s-${index}`}>{item.value}</span>;
        }
        return (
          <span
            key={`p-${index}`}
            className={
              isActive
                ? "rounded-sm bg-yellow-300/20 px-0.5 text-yellow-50 shadow-[0_2px_0_rgba(250,204,21,0.45)]"
                : ""
            }
          >
            {item.value}
          </span>
        );
      })}
    </>
  );
}

/* =========================================================
   主页面：列表 / 详情
========================================================= */

export default function LessonText() {
  const { lessonId } = useParams();

  if (lessonId) {
    return <LessonDetail lessonId={lessonId} />;
  }

  return <LessonList />;
}

/* =========================================================
   列表
========================================================= */

function LessonList() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 mx-auto max-w-[1500px] px-4 py-6 pb-28 sm:px-6 lg:px-8">
        {/* Hero */}

        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-emerald-300/80">
            <BookOpenText className="h-4 w-4" />
            THAI LESSON TEXTS · 课文教学
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            课文教学
            <span className="ml-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-yellow-300 bg-clip-text text-transparent">
              บทเรียน
            </span>
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/40 sm:text-base">
            按《基础泰语》教学体系编排的原创课文 —— 每课包含
            课文、译文、生词表、句型讲解与练习，课文中的生词均可点击发音。
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/35">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {lessons.length} 课
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              覆盖基础泰语1 全部 410 个生词
            </span>
            <span className="rounded-full border border-yellow-300/15 bg-yellow-300/[0.06] px-3 py-1.5 text-yellow-200/60">
              原创内容 · 无侵权风险
            </span>
          </div>
        </motion.div>

        {/* 课程卡片 */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson, index) => (
            <motion.button
              key={lesson.id}
              onClick={() => navigate(`/lessons/${lesson.id}`)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="
                group
                relative
                overflow-hidden
                rounded-2xl
                border
                border-white/[0.08]
                bg-white/[0.035]
                p-5
                text-left
                shadow-lg
                backdrop-blur-xl
                transition-all
                hover:border-emerald-300/[0.2]
                hover:bg-white/[0.055]
                hover:shadow-emerald-950/30
              "
            >
              {/* 顶部光晕 */}

              <div
                className="
                  pointer-events-none
                  absolute
                  -right-16
                  -top-16
                  h-36
                  w-36
                  rounded-full
                  bg-emerald-400/[0.07]
                  blur-3xl
                  transition-all
                  duration-500
                  group-hover:bg-emerald-400/[0.12]
                "
              />

              <div className="relative">
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="
                      rounded-full
                      border
                      border-emerald-300/15
                      bg-emerald-400/10
                      px-3
                      py-1
                      text-[11px]
                      font-semibold
                      text-emerald-300
                    "
                  >
                    {lesson.number}
                  </span>

                  <GraduationCap className="h-4 w-4 text-yellow-300/40" />
                </div>

                <h3 className="text-lg font-bold text-white">
                  {lesson.title}
                </h3>

                <p className="mt-1.5 text-xs text-white/35">
                  {lesson.theme}
                </p>

                {/* 课文预览 */}

                <p className="mt-4 line-clamp-3 font-thai text-sm leading-relaxed text-emerald-100/50">
                  {lesson.text[0]}
                </p>

                {/* 统计 */}

                <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-white/35">
                  <span className="rounded-lg bg-white/[0.045] px-2 py-1">
                    {lesson.words.length} 生词
                  </span>
                  <span className="rounded-lg bg-white/[0.045] px-2 py-1">
                    {lesson.grammar.length} 句型
                  </span>
                  <span className="rounded-lg bg-white/[0.045] px-2 py-1">
                    {lesson.exercises.length} 练习
                  </span>
                </div>

                {/* 底部 */}

                <div className="mt-5 flex items-center justify-end gap-1 text-[11px] text-white/25 transition-all group-hover:text-emerald-300/60">
                  <span>开始学习</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* 学习提示 */}

        <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-emerald-400/10 p-2">
              <Sparkles className="h-4 w-4 text-emerald-300" />
            </div>

            <div className="text-sm leading-relaxed text-white/40">
              <p className="font-semibold text-white/70">
                学习建议（北外教学法）
              </p>
              <p className="mt-1.5">
                ① 先跟读课文，点击高亮的生词听发音 →
                ② 对照译文理解全文 →
                ③ 背诵生词表 →
                ④ 掌握句型后完成练习。
              </p>
              <p className="mt-1.5 text-white/25">
                每课的生词都来自「基础泰语1」词库，可在词汇页统一复习。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   详情
========================================================= */

function LessonDetail({ lessonId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVip = !!user?.isVip;
  const [vipOpen, setVipOpen] = useState(false);

  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[index];

  const [showTranslation, setShowTranslation] = useState(false);
  const [expandedWord, setExpandedWord] = useState(null);

  /* ==================== 逐段朗读器 ====================
     整篇课文逐段合成播放：支持暂停/继续、当前段高亮、
     段内当前词高亮（按播放进度估算字符位置）。 */
  const [readerActive, setReaderActive] = useState(false);
  const [readerPaused, setReaderPaused] = useState(false);
  const [readerPara, setReaderPara] = useState(-1);
  const [readerProgress, setReaderProgress] = useState(0);
  // 朗读语速 / 音调（数字：rate 0.55 慢 / 1.0 常 / 1.2 快；pitch 0.85 低 / 1 中 / 1.15 高）。
  // 三档在两条合成路线上都真实可辨（后端路由策略）：
  //   · 慢速（rate<0.9）→ Edge prosody -45%（比 say 常速慢约 12%、且保声调——
  //     macOS say 在 <155wpm 会平读抹掉五声调，物理上做不出保声调的慢速）
  //   · 常速/快速 → macOS say（155~175wpm 字节级相同，1.0 即自然速；1.2 → 210wpm 真变快）
  //   · 非默认音调 → Edge prosody（say 不支持音调参数）
  const [readerRate, setReaderRate] = useState(1);
  const [readerPitch, setReaderPitch] = useState(1);
  const audioRef = useRef(null);
  const paraElsRef = useRef([]);
  // 本地课文音频缺失时的在线 TTS 回退地址（只回退一次）
  const fallbackSrcRef = useRef(null);
  // ref 镜像：切档时同步更新，确保重播立即用新参数（state 更新是异步的）
  const readerRateRef = useRef(readerRate);
  readerRateRef.current = readerRate;
  const readerPitchRef = useRef(readerPitch);
  readerPitchRef.current = readerPitch;

  const readerTexts = lesson.text;

  const playPara = useCallback(
    (index) => {
      const text = readerTexts[index];
      if (!text) return;
      const audio = audioRef.current;
      if (!audio) return;
      const rate = readerRateRef.current;
      const pitch = readerPitchRef.current;
      // 默认语速/音调下，优先播放预生成的本地课文音频
      // （public/lessons/audio/<lessonId>/<n>.wav，由 scripts/generate-lesson-audio.js 生成）；
      // 文件缺失时 audio.onerror 会自动回退到在线 TTS。
      // 切换了语速/音调则直接走在线 TTS（本地文件是固定常速常调）。
      const localSrc = `${import.meta.env.BASE_URL}lessons/audio/${lesson.id}/${String(index + 1).padStart(2, "0")}.wav`;
      if (rate === 1 && pitch === 1) {
        fallbackSrcRef.current = getLocalTtsUrl(text, rate, pitch);
        audio.src = localSrc;
      } else {
        fallbackSrcRef.current = null;
        audio.src = getLocalTtsUrl(text, rate, pitch);
      }
      audio.play().catch(() => {
        stopReaderRef.current?.();
      });
      setReaderActive(true);
      setReaderPaused(false);
      setReaderPara(index);
      setReaderProgress(0);
    },
    [readerTexts, lesson.id] // 语速/音调经 ref 读取，不参与依赖
  );

  const stopReader = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute("src");
      } catch (e) {
        // ignore
      }
    }
    setReaderActive(false);
    setReaderPaused(false);
    setReaderPara(-1);
    setReaderProgress(0);
  }, []);

  // 供事件监听器引用的最新函数（audio 只创建一次，闭包会变旧）
  const stopReaderRef = useRef(stopReader);
  stopReaderRef.current = stopReader;
  const playParaRef = useRef(playPara);
  playParaRef.current = playPara;

  // 首次进入：创建隐藏 audio 并绑定事件
  useEffect(() => {
    const audio = new Audio();
    audio.style.display = "none";
    try {
      document.body.appendChild(audio);
    } catch (e) {
      // ignore
    }
    audioRef.current = audio;
    registerActiveAudio(audio);

    audio.ontimeupdate = () => {
      if (audio.duration > 0 && audio.currentTime <= audio.duration) {
        setReaderProgress(
          Math.min(1, audio.currentTime / audio.duration)
        );
      }
    };

    audio.onended = () => {
      const next = readerParaRef.current + 1;
      if (next < readerTexts.length) {
        playParaRef.current(next);
      } else {
        stopReaderRef.current();
      }
    };

    audio.onemptied = () => {
      // src 被外部清空（点击生词等触发 speakThai → stopActiveAudio）→ 停止朗读器
      if (!audio.currentSrc) {
        stopReaderRef.current();
      }
    };

    audio.onerror = () => {
      // 本地课文音频缺失/加载失败时，回退到在线 TTS（仅回退一次）
      if (fallbackSrcRef.current) {
        const fallback = fallbackSrcRef.current;
        fallbackSrcRef.current = null;
        audio.src = fallback;
        audio.play().catch(() => stopReaderRef.current());
      } else {
        stopReaderRef.current();
      }
    };

    return () => {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.remove?.();
      } catch (e) {
        // ignore
      }
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [readerTexts]);

  const readerParaRef = useRef(readerPara);
  readerParaRef.current = readerPara;

  // 切段时把当前段平滑滚动到视野中央
  useEffect(() => {
    if (readerPara >= 0 && paraElsRef.current[readerPara]) {
      paraElsRef.current[readerPara].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [readerPara]);

  // 朗读中跟随滚动：当前段较长（超出视口）时，随词进度节流地
  // 把当前朗读位置平滑保持在视野内；短段（整段可见）不打扰用户。
  useEffect(() => {
    if (!readerActive || readerPara < 0) return;
    const el = paraElsRef.current[readerPara];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    // 段比视口还高（长段落），或整段已滚出视口上下边界 → 平滑拉回
    if (
      rect.height > vh * 0.75 ||
      rect.bottom < 0 ||
      rect.top > vh ||
      rect.top < -rect.height * 0.3 ||
      rect.bottom > vh + rect.height * 0.3
    ) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [
    readerPara,
    readerActive,
    // 按进度 1/8 节流：约每 0.5~0.8s 检查一次，避免逐字频繁滚动
    Math.floor(readerProgress * 8),
  ]);

  const startReader = useCallback(() => {
    if (!readerTexts.length) return;
    // 不要重复 registerActiveAudio：audio 在挂载时已注册为 activeAudio，
    // 再注册会触发 stopActiveAudio → removeAttribute("src") → 自身 onemptied
    // → stopReader → pause()，把刚启动的 play() 以 AbortError 中断（自毁）。
    // 挂载时的注册已保证其它 speakThai 启动时会先停掉朗读器（防叠音）。
    playPara(0);
  }, [playPara, readerTexts]);

  // 切换语速/音调：同步更新 ref（让重播立即用新参数，不等下一次渲染），
  // 朗读中则以新参数重播当前段（用户立即听到效果）
  const changeReaderRate = useCallback(
    (rate) => {
      readerRateRef.current = rate;
      setReaderRate(rate);
      if (readerActive && readerPara >= 0) {
        playParaRef.current(readerPara);
      }
    },
    [readerActive, readerPara]
  );

  const changeReaderPitch = useCallback(
    (pitch) => {
      readerPitchRef.current = pitch;
      setReaderPitch(pitch);
      if (readerActive && readerPara >= 0) {
        playParaRef.current(readerPara);
      }
    },
    [readerActive, readerPara]
  );

  const toggleReaderPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !readerActive) return;
    if (readerPaused) {
      audio.play().catch(() => {});
      setReaderPaused(false);
    } else {
      audio.pause();
      setReaderPaused(true);
    }
  }, [readerActive, readerPaused]);

  // 供页面级 speak() 在播放词/段落/例句前先停止朗读器
  useEffect(() => {
    registerLessonReaderStop(stopReaderRef.current);
    return () => registerLessonReaderStop(null);
  }, []);

  // 退出页面时停止朗读
  useEffect(() => {
    return () => stopReaderRef.current();
  }, []);

  const vocabRows = useMemo(() => {
    const rows = [];
    for (const wid of lesson.words) {
      const w = localVocabulary.find((item) => item.id === wid);
      if (w) {
        rows.push(w);
      }
    }
    return rows;
  }, [lesson]);

  if (!lesson) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-white">
        <p className="text-white/40">未找到该课文</p>
        <button
          onClick={() => navigate("/lessons")}
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/60"
        >
          返回课文列表
        </button>
      </div>
    );
  }

  const prev = lessons[index - 1] || null;
  const next = lessons[index + 1] || null;

  /* ==========================================================
     非 VIP 用户：显示锁定卡 + VipPanel
  ========================================================== */
  if (!isVip) {
    return (
      <div className="relative min-h-screen text-white">
        <main className="relative z-10 mx-auto max-w-[1100px] px-4 py-6 pb-28 sm:px-6 lg:px-8">
          {/* 返回 */}
          <div className="mb-6">
            <Link
              to="/lessons"
              className="flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              返回课文列表
            </Link>
          </div>

          {/* 标题（半透明） */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/80">
              <BookOpenText className="h-4 w-4" />
              {lesson.number.toUpperCase()}
            </div>
            <h1 className="text-3xl font-black tracking-tight opacity-40 sm:text-4xl">
              {lesson.title}
            </h1>
            <p className="mt-2 text-sm text-white/30">{lesson.theme}</p>
          </motion.div>

          {/* VIP 锁定卡 */}
          <LessonVipLock onOpen={() => setVipOpen(true)} />
        </main>

        <VipPanel
          open={vipOpen}
          onClose={() => setVipOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 mx-auto max-w-[1100px] px-4 py-6 pb-28 sm:px-6 lg:px-8">
        {/* 返回 + 导航 */}

        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/lessons"
            className="flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            返回课文列表
          </Link>

          <div className="flex items-center gap-2">
            {prev && (
              <button
                onClick={() => navigate(`/lessons/${prev.id}`)}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {prev.number}
              </button>
            )}

            {next && (
              <button
                onClick={() => navigate(`/lessons/${next.id}`)}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-white"
              >
                {next.number}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 标题 */}

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/80">
            <BookOpenText className="h-4 w-4" />
            {lesson.number.toUpperCase()}
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {lesson.title}
            <span className="ml-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-yellow-300 bg-clip-text text-transparent">
              บทเรียน
            </span>
          </h1>

          <p className="mt-2 text-sm text-white/40">
            {lesson.theme}
          </p>
        </motion.div>

        {/* ==================== 课文 ==================== */}

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">课文 · บทเรียน</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 语速 / 音调控制（朗读器专属，TTS 请求带对应参数） */}

              <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/35">语速</span>
                  <div className="flex overflow-hidden rounded-md border border-white/10">
                    {[
                      { label: "慢", rate: 0.55 },
                      { label: "常", rate: 1 },
                      { label: "快", rate: 1.2 },
                    ].map((o) => (
                      <button
                        key={o.label}
                        onClick={() => changeReaderRate(o.rate)}
                        title={`语速：${o.label}`}
                        className={`px-2 py-0.5 text-[11px] transition-all ${
                          readerRate === o.rate
                            ? "bg-emerald-400/25 text-emerald-200"
                            : "bg-transparent text-white/40 hover:text-white"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-4 w-px bg-white/10" />

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/35">音调</span>
                  <div className="flex overflow-hidden rounded-md border border-white/10">
                    {[
                      { label: "低", pitch: 0.85 },
                      { label: "中", pitch: 1 },
                      { label: "高", pitch: 1.15 },
                    ].map((o) => (
                      <button
                        key={o.label}
                        onClick={() => changeReaderPitch(o.pitch)}
                        title={`音调：${o.label}`}
                        className={`px-2 py-0.5 text-[11px] transition-all ${
                          readerPitch === o.pitch
                            ? "bg-yellow-300/20 text-yellow-200"
                            : "bg-transparent text-white/40 hover:text-white"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {readerActive ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.08] px-3 py-1.5">
                  <button
                    onClick={toggleReaderPause}
                    title={readerPaused ? "继续" : "暂停"}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-400 text-emerald-950 transition hover:scale-105"
                  >
                    {readerPaused ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-emerald-200/80">
                        第 {readerPara + 1}/{readerTexts.length} 段
                      </span>
                      <span className="text-[10px] text-white/30">
                        {Math.round(readerProgress * 100)}%
                      </span>
                    </div>
                    <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10 sm:w-40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-yellow-300 transition-[width] duration-150"
                        style={{ width: `${readerProgress * 100}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={stopReader}
                    title="停止朗读"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white"
                  >
                    <Square className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startReader}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:text-emerald-300"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  朗读全文
                </button>
              )}

              <button
                onClick={() =>
                  setShowTranslation((v) => !v)
                }
                className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  showTranslation
                    ? "border-yellow-300/30 bg-yellow-300/15 text-yellow-200"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                }`}
              >
                {showTranslation ? "隐藏译文" : "显示译文"}
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {lesson.text.map((paragraph, pIndex) => {
              const isActive = readerPara === pIndex && readerActive;
              return (
                <div
                  key={pIndex}
                  ref={(el) => {
                    paraElsRef.current[pIndex] = el;
                  }}
                  className={`relative rounded-xl transition-all duration-300 ${
                    isActive
                      ? "border border-emerald-300/25 bg-emerald-400/[0.06] shadow-[0_0_24px_rgba(52,211,153,0.12)]"
                      : "border border-transparent"
                  }`}
                >
                  <p
                    className={`px-3 py-2 font-thai text-[17px] leading-loose ${
                      isActive ? "text-emerald-50" : "text-emerald-50/90"
                    }`}
                    onClick={() => speak(paragraph)}
                    title="点击朗读本段"
                  >
                    <HighlightText
                      text={paragraph}
                      wordIds={lesson.words}
                      activeChar={
                        isActive
                          ? Math.floor(
                              readerProgress * paragraph.length
                            )
                          : null
                      }
                    />
                  </p>

                  <AnimatePresence>
                    {showTranslation &&
                      lesson.translation[pIndex] && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mx-3 mb-2 mt-1 border-l-2 border-yellow-300/25 pl-3 text-sm leading-relaxed text-white/40"
                        >
                          {lesson.translation[pIndex]}
                        </motion.p>
                      )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-white/25">
            提示：点击课文中的高亮生词可听发音；点击段落可朗读整段。
          </div>
        </section>

        {/* ==================== 生词表 ==================== */}

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                生词表 · คำศัพท์
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/35">
              本课 {vocabRows.length} 个生词
            </span>
          </div>

          <div className="grid grid-cols-1 gap-px bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
            {vocabRows.map((w, wIndex) => {
              const note = wordNotes[w.id];
              const expanded = expandedWord === w.id;
              return (
                <div
                  key={w.id}
                  className={`bg-[#0a1a16] transition-colors ${
                    expanded ? "bg-emerald-400/[0.06]" : "hover:bg-emerald-400/[0.08]"
                  }`}
                >
                  <button
                    onClick={() => speak(w.thai_word)}
                    title="点击发音"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-6 flex-shrink-0 text-[10px] text-white/20">
                        {wIndex + 1}
                      </span>

                      <div className="min-w-0">
                        <span className="block truncate font-thai text-[15px] font-semibold text-emerald-100">
                          {w.thai_word}
                        </span>

                        {(w.part_of_speech || note?.pos) && (
                          <span className="mt-0.5 block text-[10px] text-yellow-200/40">
                            {w.part_of_speech || note.pos}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-right text-xs text-white/45">
                        {w.chinese_meaning}
                      </span>

                      <Volume2 className="h-3.5 w-3.5 text-emerald-300/60" />
                    </div>
                  </button>

                  <button
                    onClick={() => setExpandedWord(expanded ? null : w.id)}
                    className="flex w-full items-center gap-2 px-4 pb-3 pl-[52px] text-left text-[11px] text-emerald-300/50 transition hover:text-emerald-300"
                  >
                    <BookOpenText className="h-3 w-3" />
                    {expanded ? "收起讲解" : "词语讲解 · 用法"}
                  </button>

                  <AnimatePresence>
                    {expanded && note && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2.5 border-t border-emerald-300/10 px-5 pb-4 pt-3 text-xs leading-relaxed">
                          <p className="text-white/70">
                            <span className="font-semibold text-yellow-200/80">
                              讲解：
                            </span>
                            {note.note}
                          </p>
                          <p className="text-white/55">
                            <span className="font-semibold text-emerald-300/80">
                              用法：
                            </span>
                            {note.usage}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* ==================== 句型讲解 ==================== */}

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <GraduationCap className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold">
              句型讲解 · ไวยากรณ์
            </h2>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {lesson.grammar.map((g, gIndex) => (
              <div key={gIndex} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-yellow-300/20 bg-yellow-300/[0.08] px-2.5 py-1 font-thai text-[13px] font-semibold text-yellow-200">
                    {g.pattern}
                  </span>

                  <span className="text-[13px] font-semibold text-white/70">
                    {g.title}
                  </span>

                  <button
                    onClick={() => speak(g.example)}
                    className="ml-auto flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/35 transition hover:text-emerald-300"
                  >
                    <Volume2 className="h-3 w-3" />
                    听例句
                  </button>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-white/35">
                  {g.note}
                </p>

                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/[0.15] px-4 py-3">
                  <p className="font-thai text-[15px] leading-relaxed text-emerald-100/85">
                    {g.example}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    {g.exampleZh}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== 练习 ==================== */}

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                课后练习 · แบบฝึกหัด
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/35">
              {lesson.exercises.length} 题
            </span>
          </div>

          <ExerciseList exercises={lesson.exercises} />
        </section>

        {/* ==================== 互译练习 ==================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                互译练习 · แปล
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/35">
              泰翻中 / 中翻泰 · 每轮 10 词
            </span>
          </div>

          <Translate words={vocabRows} />
        </section>

        {/* ==================== 听音选词 ==================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                听音选词 · ฟังแล้วเลือก
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/35">
              每轮随机抽 10 词 · 听音四选一
            </span>
          </div>

          <ListenChoose words={vocabRows} />
        </section>

        {/* ==================== 生词听写 ==================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                生词听写 · การเขียนตามคำบอก
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/35">
              每轮随机抽 10 词 · 听音拼写
            </span>
          </div>

          <Dictation words={vocabRows} />
        </section>

        {/* 底部导航 */}

        <div className="mt-8 flex items-center justify-between">
          {prev ? (
            <button
              onClick={() => navigate(`/lessons/${prev.id}`)}
              className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/50 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="text-left">
                <span className="block text-[10px] text-white/25">
                  上一课
                </span>
                {prev.title}
              </span>
            </button>
          ) : (
            <span />
          )}

          {next ? (
            <button
              onClick={() => navigate(`/lessons/${next.id}`)}
              className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right text-sm text-white/50 transition hover:text-white"
            >
              <span>
                <span className="block text-[10px] text-white/25">
                  下一课
                </span>
                {next.title}
              </span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   练习（选择题 + 即时反馈）
========================================================= */

function ExerciseList({ exercises }) {
  const [answers, setAnswers] = useState({});
  const [resetKey, setResetKey] = useState(0);

  const choose = (qIndex, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [qIndex]: optionIndex,
    }));
  };

  const reset = () => {
    setAnswers({});
    setResetKey((k) => k + 1);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div key={resetKey} className="divide-y divide-white/[0.05]">
      {exercises.map((exercise, qIndex) => {
        const selected = answers[qIndex];
        const answered = selected !== undefined;
        const correct = answered && selected === exercise.answer;

        return (
          <div key={qIndex} className="px-5 py-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-bold text-emerald-300">
                {qIndex + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed text-white/80">
                  {exercise.q}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {exercise.options.map((option, oIndex) => {
                    const isSelected = selected === oIndex;
                    const isAnswer = oIndex === exercise.answer;

                    let style =
                      "border-white/10 bg-white/[0.035] text-white/55 hover:border-emerald-300/25 hover:text-white";

                    if (answered) {
                      if (isAnswer) {
                        style =
                          "border-emerald-300/40 bg-emerald-400/15 text-emerald-200";
                      } else if (isSelected) {
                        style =
                          "border-red-300/30 bg-red-400/10 text-red-200";
                      } else {
                        style =
                          "border-white/[0.06] bg-white/[0.02] text-white/25";
                      }
                    }

                    return (
                      <button
                        key={oIndex}
                        onClick={() => choose(qIndex, oIndex)}
                        disabled={answered}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-[13px] transition-all ${style} ${
                          answered ? "cursor-default" : ""
                        }`}
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-white/10 text-[10px] text-white/30">
                          {["A", "B", "C", "D"][oIndex]}
                        </span>

                        <span className="flex-1">{option}</span>

                        {answered && isAnswer && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-300" />
                        )}

                        {answered && isSelected && !isAnswer && (
                          <XCircle className="h-4 w-4 flex-shrink-0 text-red-300" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {answered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`mt-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                          correct
                            ? "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-200/80"
                            : "border-yellow-300/20 bg-yellow-300/[0.06] text-yellow-200/80"
                        }`}
                      >
                        {correct ? "回答正确！" : "再想想哦。"}
                        {"  "}
                        {exercise.explain}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );
      })}

      {answeredCount > 0 && (
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-xs text-white/35">
            已完成 {answeredCount} / {exercises.length} 题
          </span>

          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50 transition hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新练习
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   VIP 锁定卡（课文教学为 VIP 专属）
========================================================= */

function LessonVipLock({ onOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="
        relative
        overflow-hidden
        rounded-3xl
        border
        border-yellow-300/15
        bg-gradient-to-br
        from-[#1a1508]/80
        via-[#12100a]/90
        to-[#0a0f0d]/90
        px-8
        py-12
        text-center
        shadow-2xl
        backdrop-blur-xl
      "
    >
      {/* 金色背景光晕 */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-yellow-400/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-emerald-400/[0.04] blur-3xl" />

      <div className="relative">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-300/[0.08]">
          <Crown className="h-10 w-10 text-yellow-300" />
        </div>

        <h3 className="mb-2 text-xl font-black">
          课文教学为
          <span className="ml-2 bg-gradient-to-r from-yellow-200 via-yellow-100 to-emerald-200 bg-clip-text text-transparent">
            VIP 专属
          </span>
          内容
        </h3>

        <p className="mx-auto mb-1 max-w-md text-sm text-white/40">
          开通 VIP 会员即可解锁全部课文：课文朗读、译文、生词表、句型讲解与练习。
        </p>
        <p className="mx-auto mb-8 max-w-md text-xs text-white/25">
          课文列表可预览，详情内容需 VIP 解锁。
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/35">
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2">
            <BookOpenText className="h-3.5 w-3.5 text-emerald-300/70" />
            课文朗读 + 译文
          </span>
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2">
            <ListChecks className="h-3.5 w-3.5 text-emerald-300/70" />
            生词表 + 句型讲解
          </span>
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/70" />
            课后练习 + 互译
          </span>
        </div>

        <button
          onClick={onOpen}
          className="
            mt-8
            inline-flex
            items-center
            gap-2
            rounded-2xl
            border
            border-yellow-300/30
            bg-gradient-to-r
            from-yellow-400/20
            to-emerald-400/15
            px-7
            py-3
            text-sm
            font-semibold
            text-yellow-100
            shadow-lg
            shadow-yellow-500/10
            transition-all
            hover:border-yellow-300/50
            hover:from-yellow-400/30
            hover:to-emerald-400/20
            hover:text-white
          "
        >
          <Crown className="h-4 w-4" />
          立即开通 VIP
        </button>
      </div>
    </motion.div>
  );
}
