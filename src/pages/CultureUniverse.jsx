// src/pages/CultureUniverse.jsx
//
// =========================================================
// ThaiAI Culture Universe · 文化宇宙
// =========================================================
//
// 「Netflix + 数字博物馆 + AI 老师」：不是一个视频列表页，而是四个
// 沉浸空间的编排层：
//
//   01 泰剧世界    逐句字幕（点哪句讲哪句）+ AI 场景讲解 + 角色扮演
//   02 音乐工作室  逐行歌词 + 表达分析（韵脚/叠词）+ AI 解读
//   03 新闻实验室  真实每日新闻泰中双语 + 词汇提取 + 难度适配
//   04 泰国探索者  交互地图四城市 → 文化点 + 旅行语言 + 场景对话
//   05 情景特训    跳 /ai-room 四场景（餐厅/机场/校园/商务，已上线）
//
// 内容全部来自现有数据/接口（mediaLessons / news/daily / thaiCulture /
// conversations / ai-room），这里只负责「编排与呈现」。深链：
//   /culture-universe?space=drama&lesson=drama-01
//   /culture-universe?space=explorer&city=chiangmai
// =========================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Film,
  Globe2,
  Loader2,
  Mic,
  Music2,
  Newspaper,
  Play,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

import {
  adaptNewsToLevel,
  lessonsForSpace,
  universeSpaces,
} from "@/lib/cultureUniverse";
import ThailandExplorer from "@/components/culture/ThailandExplorer";
import { speakThai, stopThaiAudio } from "@/lib/thaiSpeech";
import { askAiTeacher } from "@/api/aiTeacher";
import { segmentThai } from "@/api/thai";
import {
  buildAiTeacherRequest,
  requireAiTeacherResponse,
} from "@/lib/aiTeacherContext";
import { mergePlacementProfile } from "@/lib/userProfile";
import { API_BASE_URL } from "@/lib/api";
import WorldHero, { HeroChip } from "@/components/world/WorldHero";

/* ═══════════════════════════════════════════════════════
   通用小组件
═══════════════════════════════════════════════════════ */

function SpaceHeader({ space, onBack }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={onBack}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-black/40 text-white/60 backdrop-blur-xl transition hover:border-white/30 hover:text-white"
          aria-label="返回空间选择"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: space.hue }}>
            {space.no} · {space.en}
          </p>
          <h1 className="mt-1 text-[26px] font-black leading-tight text-white">
            {space.emoji} {space.name}
          </h1>
          <p className="mt-1 max-w-[520px] text-[12.5px] leading-relaxed text-white/55">
            {space.desc}
          </p>
        </div>
      </div>
    </header>
  );
}

/* 泰语行：可点击朗读 */
function ThaiLine({ line, onClick, active, speakerTone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-white/25 bg-white/[0.1]"
          : "border-white/[0.06] bg-black/30 hover:border-white/[0.16] hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        {line.speaker ? (
          <span className={`shrink-0 text-[10.5px] font-bold ${speakerTone || "text-white/45"}`}>
            {line.speaker}
          </span>
        ) : null}
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-emerald-300" />
      </div>
      <p className="mt-1.5 font-viaoda text-[17px] leading-relaxed text-white/92">{line.thai}</p>
      {line.roman ? (
        <p className="mt-0.5 text-[10.5px] italic leading-relaxed text-white/38">{line.roman}</p>
      ) : null}
      <AnimatePresence>
        {active && line.cn ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-[12px] leading-relaxed text-emerald-100/75"
          >
            <span className="mt-2 block border-t border-white/[0.08] pt-2">{line.cn}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

/* 词汇抽取 chips（点词汇朗读） */
function KeywordChips({ keywords }) {
  if (!keywords?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((k) => (
        <button
          key={k.th}
          type="button"
          onClick={() => speakThai(k.th, { rate: 0.72 })}
          className="group rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-2.5 py-1 transition hover:bg-emerald-400/[0.16]"
          title={k.note || k.cn}
        >
          <span className="font-viaoda text-[13px] text-emerald-100">{k.th}</span>
          <span className="ml-1.5 text-[10.5px] text-white/50">{k.cn}</span>
        </button>
      ))}
    </div>
  );
}

/* AI 解释面板（共用：问老师当前句子/内容） */
function AiExplainPanel({ question, contextTask, spaceLabel }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const ask = useCallback(async () => {
    if (busy) return;
    setOpen(true);
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const result = await askAiTeacher(
        buildAiTeacherRequest({
          message: question,
          task: contextTask || "explain",
          tone: "natural",
          persona: "bangkok",
          profile: mergePlacementProfile(),
        })
      );
      setAnswer(requireAiTeacherResponse(result));
    } catch (e) {
      const status = e?.response?.status;
      setError(
        status === 401
          ? "登录后老师才解释得了"
          : status === 429
            ? "今天的 AI 额度用完了，明天再来"
            : "老师暂时联系不上，稍后再试"
      );
    } finally {
      setBusy(false);
    }
  }, [busy, contextTask, question]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-[#e8c684]/30 bg-[#e8c684]/[0.1] px-3 py-1.5 text-[11.5px] font-bold text-[#e8c684] transition hover:bg-[#e8c684]/[0.2] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {open && answer ? "再问一次" : `问老师：${spaceLabel}`}
      </button>
      <AnimatePresence>
        {open && (answer || error) ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-2 rounded-2xl border border-[#e8c684]/20 bg-[#e8c684]/[0.05] p-3.5 pr-8"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2.5 top-2.5 rounded-md p-0.5 text-white/30 hover:text-white/70"
              aria-label="关闭解释"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {error ? (
              <p className="text-[11.5px] leading-relaxed text-amber-200/85">{error}</p>
            ) : (
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">{answer}</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   01 泰剧世界（含综艺）
═══════════════════════════════════════════════════════ */

function DramaWorld({ space, onBack }) {
  const lessons = useMemo(() => lessonsForSpace("drama"), []);
  const [lessonId, setLessonId] = useState(lessons[0]?.id);
  const [activeLine, setActiveLine] = useState(null);

  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];

  useEffect(() => {
    setActiveLine(null);
  }, [lessonId]);

  if (!lesson) {
    return (
      <div>
        <SpaceHeader space={space} onBack={onBack} />
        <p className="text-[12.5px] text-white/50">内容库为空。</p>
      </div>
    );
  }

  return (
    <div>
      <SpaceHeader space={space} onBack={onBack} />

      {/* 剧集选择：横向胶片条 */}
      <div className="mb-5 flex gap-2.5 overflow-x-auto pb-2" role="tablist" aria-label="选择剧集">
        {lessons.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === lesson.id}
            onClick={() => setLessonId(l.id)}
            className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition ${
              l.id === lesson.id
                ? "border-[#e05a8a]/60 bg-[#e05a8a]/[0.14]"
                : "border-white/[0.07] bg-black/30 hover:border-white/20"
            }`}
          >
            <p className="text-[12.5px] font-bold text-white/85">{l.title}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
              {l.level} · {l.minutes} 分钟
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* 左：逐句字幕 */}
        <section className="rounded-3xl border border-white/[0.07] bg-black/35 p-4 backdrop-blur-xl sm:p-5">
          <p className="mb-3 text-[11px] leading-relaxed text-white/45">
            🎞️ {lesson.scene}
          </p>
          <div className="space-y-2">
            {lesson.lines.map((line, i) => (
              <ThaiLine
                key={i}
                line={line}
                active={activeLine === i}
                onClick={() => {
                  setActiveLine(activeLine === i ? null : i);
                  speakThai(line.thai, { rate: 0.75 });
                }}
                speakerTone="text-[#e05a8a]/80"
              />
            ))}
          </div>

          {activeLine != null && lesson.lines[activeLine] ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                这一幕 · 词汇浮现
              </p>
              <div className="mt-2">
                <KeywordChips keywords={lesson.keywords} />
              </div>
              {lesson.grammar?.length ? (
                <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                  {lesson.grammar.map((g) => (
                    <div key={g.point}>
                      <p className="text-[12px] font-bold text-emerald-200/90">📖 {g.point}</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/60">{g.explain}</p>
                      <p className="mt-1 font-viaoda text-[12.5px] text-white/75">{g.example}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {lesson.culture ? (
                <p className="mt-3 rounded-xl bg-[#e8c684]/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-[#e8c684]/90">
                  🛕 {lesson.culture}
                </p>
              ) : null}
              <AiExplainPanel
                question={`我在看泰剧片段《${lesson.title}》。请用中文讲解这句台词的语气和潜台词：「${lesson.lines[activeLine].thai}」（中文：${lesson.lines[activeLine].cn}）。讲解要像剧评人，先说字面，再说泰国人实际想表达什么。`}
                contextTask="explain"
                spaceLabel="讲解这句台词"
              />
            </motion.div>
          ) : (
            <p className="mt-4 text-center text-[11px] text-white/30">
              点任意一句字幕：朗读 + 中文 + 词汇 + AI 讲解
            </p>
          )}
        </section>

        {/* 右：AI 角色扮演 */}
        <section className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#e05a8a]/[0.08] to-black/40 p-4 backdrop-blur-xl">
          <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.2em] text-white/55">
            <Mic className="h-3.5 w-3.5" />
            AI 角色扮演
          </h3>
          <p className="mt-2 text-[12px] leading-relaxed text-white/60">
            你演「{lesson.ai.studentRole}」，老师演「{lesson.ai.aiRole}」。
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/40">{lesson.ai.sceneTip}</p>
          <RolePlayBox lesson={lesson} />
        </section>
      </div>
    </div>
  );
}

/* 角色扮演：起头后把对话交给 /conversation 页（长对话体验在那边完整） */
function RolePlayBox({ lesson }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setReply("");
    try {
      const res = await askAiTeacher({
        message: `我们开始角色扮演：${lesson.ai.sceneTip}。你演「${lesson.ai.aiRole}」，我演「${lesson.ai.studentRole}」。请用泰语说第一句（附罗马音和中文）。`,
        action: "conversation",
        profile: mergePlacementProfile(),
        scene: {
          id: lesson.id,
          title: lesson.ai.sceneTitle,
          description: lesson.scene,
        },
        stage: {},
      });
      const d = res?.data || {};
      setReply(
        [d.thai, d.roman, d.chinese].filter(Boolean).join("\n") || "（老师没回话，再试一次）"
      );
    } catch {
      setReply("老师暂时联系不上，稍后再试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e05a8a]/40 bg-[#e05a8a]/[0.14] py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#e05a8a]/[0.24] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        开演 · 老师先说第一句
      </button>
      {reply ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 whitespace-pre-wrap rounded-2xl border border-white/[0.08] bg-black/40 p-3 text-[12.5px] leading-relaxed text-white/85"
        >
          {reply}
          <button
            type="button"
            onClick={() => navigate("/conversation")}
            className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#e05a8a] hover:underline"
          >
            继续对话 <ArrowRight className="h-3 w-3" />
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   02 音乐工作室
═══════════════════════════════════════════════════════ */

function MusicStudio({ space, onBack }) {
  const songs = useMemo(() => lessonsForSpace("music"), []);
  const [songId, setSongId] = useState(songs[0]?.id);
  const [activeLine, setActiveLine] = useState(null);
  const [playingLine, setPlayingLine] = useState(null);

  const song = songs.find((l) => l.id === songId) || songs[0];

  useEffect(() => {
    setActiveLine(null);
    setPlayingLine(null);
  }, [songId]);

  /* 「播放全曲」：逐行 TTS，行间停顿模拟节奏（用真实 TTS，不造假音频） */
  const playAll = useCallback(async () => {
    if (!song) return;
    const delays = [];
    for (let i = 0; i < song.lines.length; i++) {
      setPlayingLine(i);
      speakThai(song.lines[i].thai, { rate: 0.68 });
      // 每行按泰文长度给停顿（朗读实际时长不可编程监听，退而求其次给保守间隔）
      await new Promise((r) => {
        delays[i] = setTimeout(r, 1600 + song.lines[i].thai.length * 55);
      });
    }
    setPlayingLine(null);
  }, [song]);

  if (!song) {
    return (
      <div>
        <SpaceHeader space={space} onBack={onBack} />
        <p className="text-[12.5px] text-white/50">内容库为空。</p>
      </div>
    );
  }

  return (
    <div>
      <SpaceHeader space={space} onBack={onBack} />

      <div className="mb-5 flex gap-2.5 overflow-x-auto pb-2">
        {songs.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setSongId(l.id)}
            className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition ${
              l.id === song.id
                ? "border-[#8a6ae0]/60 bg-[#8a6ae0]/[0.14]"
                : "border-white/[0.07] bg-black/30 hover:border-white/20"
            }`}
          >
            <p className="text-[12.5px] font-bold text-white/85">{l.title}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
              {l.level} · {l.source?.replace("原创练习素材 · ", "")}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* 左：同步歌词 */}
        <section className="rounded-3xl border border-white/[0.07] bg-black/35 p-4 backdrop-blur-xl sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] leading-relaxed text-white/45">🎼 {song.scene}</p>
            <button
              type="button"
              onClick={playAll}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#8a6ae0]/40 bg-[#8a6ae0]/[0.12] px-3 py-1.5 text-[11px] font-bold text-[#c9b8ff] transition hover:bg-[#8a6ae0]/[0.22]"
            >
              <Music2 className="h-3.5 w-3.5" />
              播放全曲
            </button>
          </div>

          <div className="space-y-2">
            {song.lines.map((line, i) => (
              <ThaiLine
                key={i}
                line={line}
                active={activeLine === i}
                onClick={() => {
                  setActiveLine(activeLine === i ? null : i);
                  setPlayingLine(i);
                  speakThai(line.thai, { rate: 0.68 });
                }}
                speakerTone="text-[#8a6ae0]/80"
              />
            ))}
          </div>
          <style>{`
            .music-line-active { box-shadow: 0 0 24px rgba(138,106,224,0.25); }
          `}</style>
          {playingLine != null ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#c9b8ff]/80">
              <span className="mentor-live-dot" aria-hidden="true" />
              正在唱第 {playingLine + 1} 行…
            </p>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              全曲词汇
            </p>
            <div className="mt-2">
              <KeywordChips keywords={song.keywords} />
            </div>
          </div>
        </section>

        {/* 右：表达分析 */}
        <section className="space-y-3">
          {song.grammar?.length ? (
            <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#8a6ae0]/[0.08] to-black/40 p-4 backdrop-blur-xl">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/55">
                表达分析 · 韵脚与叠词
              </h3>
              <div className="mt-2.5 space-y-2.5">
                {song.grammar.map((g) => (
                  <div key={g.point}>
                    <p className="text-[12px] font-bold text-[#c9b8ff]">{g.point}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/60">{g.explain}</p>
                    <p className="mt-1 font-viaoda text-[12.5px] text-white/75">{g.example}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {song.culture ? (
            <div className="rounded-3xl border border-[#e8c684]/15 bg-[#e8c684]/[0.05] p-4">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#e8c684]/70">
                文化注脚
              </h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#e8c684]/90">{song.culture}</p>
            </div>
          ) : null}

          <AiExplainPanel
            question={`我在学泰语歌《${song.title}》。请用中文分析这首歌的表达手法：韵脚、叠词、口语缩略，以及泰国人什么时候会引用这类歌词。歌词：${song.thaiText.replace(/\n/g, " / ")}`}
            contextTask="explain"
            spaceLabel="解读这首歌"
          />
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   03 新闻实验室
═══════════════════════════════════════════════════════ */

function NewsLab({ space, onBack }) {
  const [items, setItems] = useState([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showZh, setShowZh] = useState(true);
  const [saved, setSaved] = useState([]);
  const [tokens, setTokens] = useState(null); // 分词结果 [{th, roman, cn, pos, source}]
  const [tokenizing, setTokenizing] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const profile = useMemo(() => mergePlacementProfile(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/news/daily`);
        if (!res.ok) throw new Error("http");
        const data = await res.json();
        if (!alive) return;
        setItems(adaptNewsToLevel(data.items || [], profile?.thai_level || profile?.level));
        setDate(data.date || "");
      } catch {
        if (alive) setError("今日新闻暂时拿不到，稍后再来");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selected = items.find((n) => n.id === selectedId) || null;

  /* ── 选中新闻 → 后端分词提取词汇（Intl.Segmenter 词边界 + 词典/AI 释义） ── */
  useEffect(() => {
    if (!selected?.title) {
      setTokens(null);
      return;
    }
    let alive = true;
    setTokenizing(true);
    setTokenError("");
    segmentThai(`${selected.title} ${selected.lede || ""}`.slice(0, 300), 14)
      .then((res) => {
        if (!alive) return;
        setTokens(Array.isArray(res?.data?.tokens) ? res.data.tokens : []);
      })
      .catch(() => {
        if (alive) setTokenError("词汇提取服务暂时不可用");
      })
      .finally(() => {
        if (alive) setTokenizing(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, selected]);

  const toggleSave = (word) => {
    setSaved((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  return (
    <div>
      <SpaceHeader space={space} onBack={onBack} />

      {loading ? (
        <p className="flex items-center gap-2 text-[12.5px] text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在取今天真实的泰国新闻…
        </p>
      ) : error ? (
        <p className="text-[12.5px] text-amber-200/80">{error}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* 左：今日新闻列表 */}
          <section className="rounded-3xl border border-white/[0.07] bg-black/35 p-3.5 backdrop-blur-xl">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              <Newspaper className="h-3.5 w-3.5" />
              今日 ({date})
            </p>
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    n.id === selectedId
                      ? "border-[#3a9ad0]/60 bg-[#3a9ad0]/[0.12]"
                      : "border-white/[0.06] bg-black/25 hover:border-white/[0.16]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    {n.source} · {n.category || "news"}
                  </p>
                  <p className="mt-1 text-[12.5px] font-bold leading-snug text-white/85">{n.title}</p>
                  {showZh && n.zh_title ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">{n.zh_title}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {/* 右：双语阅读环境 */}
          <section className="rounded-3xl border border-white/[0.07] bg-black/35 p-4 backdrop-blur-xl sm:p-5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#3a9ad0]">
                      {selected.source} · {selected.pub_at || ""}
                    </p>
                    <h2 className="mt-1 font-viaoda text-[20px] leading-snug text-white/92">
                      {selected.title}
                    </h2>
                    <p className="mt-1 text-[11px] italic text-white/40">{selected.roman_title}</p>
                    {showZh && selected.zh_title ? (
                      <p className="mt-1 text-[13px] font-bold text-white/60">{selected.zh_title}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowZh((v) => !v)}
                    className="rounded-full border border-white/[0.12] px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-white/30 hover:text-white"
                  >
                    {showZh ? "隐藏中文（先读泰语）" : "显示中文"}
                  </button>
                </div>

                <p className="mt-4 font-viaoda text-[15px] leading-loose text-white/85">
                  {selected.lede}
                </p>
                <p className="mt-1 text-[11px] italic leading-relaxed text-white/38">
                  {selected.roman_lede}
                </p>
                {showZh && selected.zh_lede ? (
                  <p className="mt-2 border-l-2 border-[#3a9ad0]/40 pl-3 text-[12.5px] leading-relaxed text-white/60">
                    {selected.zh_lede}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => speakThai(selected.title, { rate: 0.75 })}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:border-emerald-300/40 hover:text-emerald-200"
                  >
                    <Volume2 className="h-3.5 w-3.5" /> 读标题
                  </button>
                  <button
                    type="button"
                    onClick={() => speakThai(selected.lede, { rate: 0.75 })}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:border-emerald-300/40 hover:text-emerald-200"
                  >
                    <Volume2 className="h-3.5 w-3.5" /> 读导语
                  </button>
                  {selected.url ? (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:border-white/30"
                    >
                      原文 <ArrowRight className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                {/* 词汇提取：Intl.Segmenter 泰语分词 + 词典/AI 自动配罗马音与释义 */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    词汇提取（点词朗读 · 收进本次学习）
                  </p>
                  {tokenizing ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在分词…
                    </p>
                  ) : tokenError ? (
                    <p className="mt-2 text-[11px] text-amber-200/75">{tokenError}</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {(tokens || []).map((t) => (
                        <div key={t.th} className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              speakThai(t.th, { rate: 0.72 });
                              if (!saved.includes(t.th)) toggleSave(t.th);
                            }}
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 font-viaoda text-[13px] transition ${
                              saved.includes(t.th)
                                ? "border-emerald-300/50 bg-emerald-400/[0.16] text-emerald-100"
                                : "border-white/[0.1] bg-black/30 text-white/80 hover:border-emerald-300/30"
                            }`}
                          >
                            {t.th}
                          </button>
                          <div className="min-w-0">
                            {t.roman ? (
                              <p className="truncate text-[10px] italic text-white/35">{t.roman}</p>
                            ) : null}
                            <p className="truncate text-[11px] text-white/60">
                              {t.cn || "释义待补"}
                              {t.pos ? <span className="ml-1 text-[9.5px] text-white/30">· {t.pos}</span> : null}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {saved.length ? (
                    <p className="mt-1.5 text-[10.5px] text-emerald-300/70">
                      已收 {saved.length} 个词（本次会话内）
                    </p>
                  ) : null}
                </div>

                <AiExplainPanel
                  question={`我在读一篇泰国新闻（${selected.source}）。请用中文做背景解释：这条新闻讲什么事件、涉及哪些泰国本地的机构/地点/人物、为什么对泰国人重要。标题：${selected.title}。导语：${selected.lede}`}
                  contextTask="explain"
                  spaceLabel="讲解新闻背景"
                />

                <p className="mt-3 text-[10.5px] leading-relaxed text-white/30">
                  难度适配：已按你的画像等级（{profile?.thai_level || profile?.level || "未测"}）把更易读的新闻排到前面。
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-white/40">选左边一条新闻开始读。</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   04 泰国探索者
   ---------------------------------------------------------------
   之前是「简笔 SVG 轮廓 + 右侧详情卡」；现在是一张真实泰国地图艺术图 +
   一层真实控件（罗盘 / 标题 / 探索路线栏 / 探索进度卡 / 提示条 / 缩放）。
   九块城市标签与地图**同一个坐标系**，拖动、缩放时与地图上的金色地点针
   咬合；面板里的「听句子 / 进场景对话」会写进 mediaProgress 的探索记录，
   于是首页的能力雷达与今日活动一起联动。实现见
   src/components/culture/ThailandExplorer.jsx。
═══════════════════════════════════════════════════════ */

function Explorer({ onBack, initialCity, onCity }) {
  return <ThailandExplorer onBack={onBack} initialCity={initialCity} onCity={onCity} />;
}

/* ═══════════════════════════════════════════════════════
   05 情景特训（入口卡，跳 /ai-room）
═══════════════════════════════════════════════════════ */

const SCENARIOS = [
  { id: "restaurant", label: "餐厅", emoji: "🍜", desc: "点餐 · 忌口 · 买单" },
  { id: "airport", label: "机场", emoji: "✈️", desc: "值机 · 行李 · 转机" },
  { id: "campus", label: "大学", emoji: "🎓", desc: "选课 · 社团 · 借书" },
  { id: "workplace", label: "商务", emoji: "💼", desc: "寒暄 · 会议 · 谈判" },
];

function ScenarioTraining({ onBack }) {
  const navigate = useNavigate();
  return (
    <div>
      <header className="mb-5 flex items-start gap-3.5">
        <button
          type="button"
          onClick={onBack}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-black/40 text-white/60 backdrop-blur-xl transition hover:border-white/30 hover:text-white"
          aria-label="返回空间选择"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/70">
            05 · AI Scenario Training
          </p>
          <h1 className="mt-1 text-[26px] font-black leading-tight text-white">
            🎧 情景特训
          </h1>
          <p className="mt-1 max-w-[520px] text-[12.5px] leading-relaxed text-white/55">
            AI 扮演地道泰国人。评分维度：发音、语法、自然度、文化得体——说错的地方老师当场纠。
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/conversation?scene=${s.id}`)}
            className="group rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.08] to-black/40 p-5 text-left backdrop-blur-xl transition hover:border-emerald-300/40"
          >
            <p className="text-[30px]">{s.emoji}</p>
            <p className="mt-2 text-[16px] font-black text-white">{s.label}</p>
            <p className="mt-0.5 text-[11.5px] text-white/50">{s.desc}</p>
            <p className="mt-3 flex items-center gap-1 text-[11.5px] font-bold text-emerald-300 opacity-0 transition group-hover:opacity-100">
              进入特训 <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   空间选择（首页）
═══════════════════════════════════════════════════════ */

function SpacePicker({ onPick }) {
  /* 真实内容量：四个空间各自能拿到的课程数（就是下面那些卡片里的东西） */
  const contentCount = useMemo(
    () =>
      universeSpaces.reduce((sum, s) => {
        try {
          return sum + (lessonsForSpace(s.id)?.length || 0);
        } catch {
          return sum;
        }
      }, 0),
    []
  );

  return (
    <div>
      {/*
       * 首屏：与首页同一构图语言（同一张宽幅世界 + 左侧泰中文案 + 真实数字）。
       * 原来那个纯文字 header 撤掉——四个空间已经是「世界」里的场馆，
       * 页头就不该长得像后台的标题栏。
       */}
      <WorldHero
        eyebrow="ThaiAi Culture Universe"
        thai="จักรวาลวัฒนธรรมไทย"
        title="泰语文化宇宙"
        subtitle="不是「看」泰语内容——是住进泰语里。四个空间由真实数据驱动，AI 老师全程同行；点下面的场馆直接进去。"
        focus="64% 46%"
        accent="#e8c684"
        ariaLabel="泰语文化宇宙"
        stats={[
          { Icon: Globe2, value: `${universeSpaces.length} 个空间`, label: "文化宇宙的沉浸空间数", tone: "text-[#e8c684]" },
          { Icon: Film, value: `${contentCount} 条内容`, label: "四个空间合计的课程内容量（真实数据）", tone: "text-emerald-300" },
          { Icon: Mic, value: `${SCENARIOS.length} 个情景`, label: "情景特训的对话场景数", tone: "text-violet-300" },
        ]}
        chips={universeSpaces.map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s.id)}>
            <HeroChip accent={s.hue}>
              {s.emoji} {s.name}
            </HeroChip>
          </button>
        ))}
        actions={
          <button
            type="button"
            onClick={() => onPick("drama")}
            className="group flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/[0.14] px-4 py-2.5 text-[12px] font-bold text-emerald-50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/[0.22]"
          >
            <Sparkles className="h-4 w-4 text-emerald-300 transition group-hover:scale-110" />
            从泰剧世界开始
          </button>
        }
        footer={
          /* 玻璃芯片而不是裸文字：浮在照片上，浅色模式会翻成白卡深字 */
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/45 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur-xl">
            往下：四个空间 + 情景特训 · 每块内容都能点进具体的句子
          </span>
        }
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {universeSpaces.map((space, i) => (
          <motion.button
            key={space.id}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => onPick(space.id)}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.08] p-6 text-left backdrop-blur-xl transition hover:border-white/25"
            style={{
              background: `linear-gradient(145deg, ${space.hue}1f 0%, rgba(5,8,7,0.85) 55%)`,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 text-[110px] font-black opacity-[0.07] transition group-hover:opacity-[0.13]"
            >
              {space.no}
            </span>
            <p className="text-[34px]">{space.emoji}</p>
            <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: space.hue }}>
              {space.no} · {space.en}
            </p>
            <h2 className="mt-1 text-[19px] font-black text-white">{space.name}</h2>
            <p className="mt-0.5 font-viaoda text-[14px] text-white/60">{space.tagline}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">{space.desc}</p>
            <p className="mt-3 flex items-center gap-1 text-[11.5px] font-bold text-white/80 opacity-0 transition group-hover:opacity-100">
              进入 <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </motion.button>
        ))}

        {/* 05 情景特训入口 */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          onClick={() => onPick("scenario")}
          className="group relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/[0.1] to-black/40 p-6 text-left backdrop-blur-xl transition hover:border-emerald-300/45 md:col-span-2"
        >
          <p className="text-[34px]">🎧</p>
          <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300/70">
            05 · AI Scenario Training
          </p>
          <h2 className="mt-1 text-[19px] font-black text-white">情景特训</h2>
          <p className="mt-0.5 text-[12px] text-white/50">
            餐厅 · 机场 · 大学 · 商务——AI 扮演泰国人，从发音到文化得体度当场评分
          </p>
        </motion.button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   主组件：空间路由（?space= 深链）
═══════════════════════════════════════════════════════ */

export default function CultureUniverse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const spaceId = searchParams.get("space") || "";

  const back = useCallback(() => {
    stopThaiAudio();
    setSearchParams({});
  }, [setSearchParams]);

  useEffect(() => () => stopThaiAudio(), []);

  const space = universeSpaces.find((s) => s.id === spaceId);

  return (
    <div
      className="min-h-screen w-full px-4 pb-16 pt-6 sm:px-6"
      style={{
        background:
          "radial-gradient(90% 60% at 50% -10%, rgba(52,211,153,0.07), transparent 60%), #050807",
      }}
    >
      <div className="mx-auto max-w-[1180px]">
        <AnimatePresence mode="wait">
          {!space && !spaceId ? (
            <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SpacePicker
                onPick={(id) => setSearchParams({ space: id })}
              />
            </motion.div>
          ) : spaceId === "scenario" ? (
            <motion.div key="scenario" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ScenarioTraining onBack={back} />
            </motion.div>
          ) : space ? (
            <motion.div
              key={space.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {space.id === "drama" && <DramaWorld space={space} onBack={back} />}
              {space.id === "music" && <MusicStudio space={space} onBack={back} />}
              {space.id === "news" && <NewsLab space={space} onBack={back} />}
              {space.id === "explorer" && (
                <Explorer
                  onBack={back}
                  initialCity={searchParams.get("city") || undefined}
                  onCity={(id) => setSearchParams({ space: "explorer", city: id }, { replace: true })}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
