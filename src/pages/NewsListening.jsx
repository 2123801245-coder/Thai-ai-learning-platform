import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Headphones,
  Type,
  Mic,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Gauge,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Newspaper,
  ArrowLeft,
  Sparkles,
  Crown,
  Lock,
} from "lucide-react";

import SpeakingRecorder from "@/components/speaking/SpeakingRecorder";
import VipPanel from "@/components/common/VipPanel";
import { speakThaiWithLocal, stopThaiAudio } from "@/lib/thaiSpeech";
import { API_BASE_URL } from "@/lib/api";
import { buildNewsExercise } from "@/lib/newsListening";
import {
  recordNewsListening,
  getNewsListeningQuota,
  consumeNewsListeningQuota,
} from "@/api/newsListening";

/* ============================================================
   模式
============================================================ */

const MODES = [
  { key: "listen", label: "逐句听", icon: Headphones, desc: "逐句播放，可变速" },
  { key: "cloze", label: "听音填空", icon: Type, desc: "听句子，选被挖掉的词" },
  { key: "repeat", label: "跟读评分", icon: Mic, desc: "录音，AI 评分" },
];

const SPEEDS = [
  { label: "0.65x", value: 0.65 },
  { label: "0.8x", value: 0.8 },
  { label: "1.0x", value: 1.0 },
  { label: "1.2x", value: 1.2 },
];

/* ============================================================
   页面
============================================================ */

export default function NewsListening() {
  const [searchParams] = useSearchParams();
  const initialNewsId = searchParams.get("news") || "";

  const [newsList, setNewsList] = useState([]);
  const [newsDate, setNewsDate] = useState("");
  const [newsError, setNewsError] = useState("");
  const [selectedId, setSelectedId] = useState(initialNewsId);
  const [mode, setMode] = useState("listen");
  const [speed, setSpeed] = useState(0.8);
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);

  /* 听音填空会员配额：免费每日 N 题，VIP 无限 */
  const [quota, setQuota] = useState(null);
  const [vipOpen, setVipOpen] = useState(false);

  const refreshQuota = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await getNewsListeningQuota();
      setQuota(res.data || null);
    } catch (e) {
      /* 未登录 / 网络失败：静默 */
    }
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  /* 逐句听状态 */
  const [playingUnit, setPlayingUnit] = useState(null);

  /* 填空状态 */
  const [clozeIndex, setClozeIndex] = useState(0);
  const [clozePicked, setClozePicked] = useState(null);
  const [clozeScore, setClozeScore] = useState(0);
  const [clozeDone, setClozeDone] = useState(0);

  const audioRef = useRef(null);

  /* =====================================================
     练习记录：本次会话的填空成绩 + 跟读分数
     （登录用户每次练习后上报，未登录静默跳过）
  ===================================================== */

  const sessionRef = useRef({
    newsId: "",
    newsTitle: "",
    repeatScores: [],
  });

  const flushRecord = useCallback(() => {
    const s = sessionRef.current;
    if (!s.newsId || !s.repeatScores.length) return;
    const repeatScores = s.repeatScores.splice(0);
    recordNewsListening({
      newsId: s.newsId,
      newsTitle: s.newsTitle,
      repeatScores,
    }).catch(() => {
      /* 未登录 / 网络失败：静默忽略 */
    });
  }, []);

  const handleRepeatScore = useCallback((r) => {
    if (r && typeof r.score === "number" && Number.isFinite(r.score)) {
      sessionRef.current.repeatScores.push(Math.round(r.score));
    }
  }, []);

  /* 离开页面时把剩余跟读分数上报 */
  useEffect(() => {
    return () => {
      flushRecord();
    };
  }, [flushRecord]);

  /* =====================================================
     加载新闻列表
  ===================================================== */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/news/daily`);
        if (!res.ok) throw new Error("load fail");
        const data = await res.json();
        if (cancelled) return;
        const list = data.items || [];
        setNewsList(list);
        setNewsDate(data.date || "");
        setNewsError(data.error || "");
        if (!selectedId && list.length) {
          setSelectedId(list[0].id);
        } else if (selectedId && !list.some((n) => n.id === selectedId)) {
          setSelectedId(list[0]?.id || "");
        }
      } catch (e) {
        if (!cancelled) setNewsError("暂时无法加载今日新闻");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =====================================================
     选中新闻变化 → 生成练习数据
  ===================================================== */

  const selectedNews = useMemo(
    () => newsList.find((n) => n.id === selectedId) || null,
    [newsList, selectedId]
  );

  const generatedExercise = useMemo(
    () => (selectedNews ? buildNewsExercise(selectedNews) : null),
    [selectedNews]
  );

  useEffect(() => {
    if (!selectedNews) {
      setExercise(null);
      return;
    }
    /* 切到新新闻：先上报上一篇的跟读分数，再重置会话 */
    flushRecord();
    sessionRef.current = {
      newsId: selectedNews.id,
      newsTitle: selectedNews.title,
      repeatScores: [],
    };
    setExercise(generatedExercise);
    setClozeIndex(0);
    setClozePicked(null);
    setClozeScore(0);
    setClozeDone(0);
    setPlayingUnit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNews]);

  /* =====================================================
     播放工具（变速）
  ===================================================== */

  const playUnit = useCallback(
    (unit) => {
      stopThaiAudio();
      setPlayingUnit(unit.id);
      speakThaiWithLocal(unit.thai, {
        rate: speed,
        onEnd: () => setPlayingUnit((prev) => (prev === unit.id ? null : prev)),
        onError: () => setPlayingUnit((prev) => (prev === unit.id ? null : prev)),
      });
    },
    [speed]
  );

  /* =====================================================
     填空逻辑
  ===================================================== */

  const clozeSet = exercise?.clozeSet || [];
  const currentCloze = clozeSet[clozeIndex]?.cloze || null;

  const playClozeSentence = useCallback(() => {
    const item = clozeSet[clozeIndex];
    if (!item) return;
    stopThaiAudio();
    setPlayingUnit("cloze");
    speakThaiWithLocal(item.unit.thai, {
      rate: speed,
      onEnd: () => setPlayingUnit((prev) => (prev === "cloze" ? null : prev)),
      onError: () => setPlayingUnit((prev) => (prev === "cloze" ? null : prev)),
    });
  }, [clozeSet, clozeIndex, speed]);

  const pickCloze = (opt) => {
    if (clozePicked) return;
    if (!currentCloze) return;
    setClozePicked(opt);
    if (opt === currentCloze.answer) {
      setClozeScore((s) => s + 1);
    }
    setClozeDone((d) => d + 1);

    /* 每答一题扣一题（免费用户）；VIP 后端自动跳过 */
    if (quota && !quota.isVip) {
      consumeNewsListeningQuota({ questions: 1 })
        .then((r) => {
          if (r.data && typeof r.data.remainingToday === "number") {
            setQuota((prev) => ({
              ...(prev || {}),
              usedToday: r.data.usedToday,
              remainingToday: r.data.remainingToday,
              isVip: r.data.isVip,
            }));
          }
        })
        .catch(() => {
          /* 静默忽略 */
        });
    }
  };

  const nextCloze = () => {
    setClozePicked(null);
    setClozeIndex((i) => Math.min(i + 1, clozeSet.length - 1));
  };

  const resetCloze = () => {
    setClozeIndex(0);
    setClozePicked(null);
    setClozeScore(0);
    setClozeDone(0);
  };

  const clozeFinished = clozeDone > 0 && clozeDone === clozeSet.length;

  /* 填空完成 → 上报本次成绩（连同已积累的跟读分数）+ 刷新配额 */
  useEffect(() => {
    if (!clozeFinished) return;
    const s = sessionRef.current;
    if (!s.newsId || !clozeSet.length) return;
    const repeatScores = s.repeatScores.splice(0);
    recordNewsListening({
      newsId: s.newsId,
      newsTitle: s.newsTitle,
      clozeCorrect: clozeScore,
      clozeTotal: clozeSet.length,
      repeatScores,
    }).catch(() => {
      /* 静默忽略 */
    });
    refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clozeFinished]);

  /* =====================================================
     跟读：复用 SpeakingRecorder（words 结构映射）
  ===================================================== */

  const repeatWords = useMemo(() => {
    if (!exercise) return [];
    return exercise.units.map((u) => ({
      id: u.id,
      thai_word: u.thai,
      pronunciation: u.roman || "",
      chinese_meaning: u.zh || "",
      category: exercise.category || "新闻",
    }));
  }, [exercise]);

  /* =====================================================
     渲染
  ===================================================== */

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-white/40">
        加载今日新闻…
      </div>
    );
  }

  if (!newsList.length) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="premium-glass rounded-3xl p-8 text-sm text-white/50">
          {newsError || "暂时无法加载今日新闻"}（离线语料库仍可使用）
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-4 pb-10">
      {/* ================= 顶部 ================= */}
      <section className="premium-glass-strong rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs tracking-[0.18em] text-emerald-300/70">
              <Headphones className="h-4 w-4" /> NEWS LISTENING LAB · 时事听力
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">每日新闻听力</h1>
            <p className="mt-1 text-sm text-white/50">
              ThaiPBS 今日时事 · 逐句听 · 听音填空 · 跟读评分
              {newsDate ? ` · ${formatDateCN(newsDate)}` : ""}
            </p>
          </div>

          {/* 选新闻 */}
          <div className="flex items-center gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="max-w-[280px] rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none transition focus:border-emerald-300/40"
            >
              {newsList.map((n) => (
                <option key={n.id} value={n.id} className="bg-[#0d1a17]">
                  {(n.category || "ข่าว") + " · " + (n.title || "").slice(0, 28)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            /* 免费用户听音填空题数用尽 → 模式按钮显示锁图标 */
            const locked =
              m.key === "cloze" &&
              quota &&
              !quota.isVip &&
              quota.remainingToday <= 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition ${
                  active
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                    : locked
                      ? "border-yellow-300/25 bg-yellow-300/[0.05] text-yellow-100/70 hover:bg-yellow-300/[0.1]"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {m.label}
                {locked && <Lock className="h-3.5 w-3.5 text-yellow-300" />}
              </button>
            );
          })}
        </div>

        {/* 变速控制 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Gauge className="h-4 w-4 text-white/35" />
          <span className="text-xs text-white/40">语速</span>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSpeed(s.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                speed === s.value
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.08]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 听音填空会员配额提示（逐句听 / 听音填空都显示剩余题数） */}
        {mode !== "repeat" && (
          <div
            className={`mt-4 flex items-center justify-between rounded-xl border px-3.5 py-2 ${
              quota && !quota.isVip && quota.remainingToday <= 0
                ? "border-yellow-300/20 bg-yellow-300/[0.07]"
                : "border-white/[0.06] bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300/70" />
              {quota?.isVip ? (
                <span className="text-[11px] text-white/40">
                  VIP 会员 · <b className="text-yellow-200">听音填空无限练习</b>
                </span>
              ) : quota ? (
                <span className="text-[11px] text-white/40">
                  {quota.remainingToday <= 0 ? (
                    "今日免费题数已用完 · 开通 VIP 无限练习"
                  ) : (
                    <>
                      今日免费剩余{" "}
                      <b className="text-emerald-300">
                        {quota.remainingToday}
                      </b>{" "}
                      / {quota.freeQuestionDaily} 题
                    </>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-white/30">
                  登录后可记录今日剩余练习次数
                </span>
              )}
            </div>
            {quota && !quota.isVip && quota.remainingToday <= 0 && (
              <button
                type="button"
                onClick={() => setVipOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-yellow-300 to-amber-400 px-3 py-1.5 text-[11px] font-bold text-[#172018] transition hover:-translate-y-0.5"
              >
                <Crown className="h-3 w-3" />
                开通 VIP
              </button>
            )}
          </div>
        )}
      </section>

      {/* ================= 正文 ================= */}
      {mode === "listen" && (
        <ListenPanel
          exercise={exercise}
          playingUnit={playingUnit}
          onPlay={playUnit}
        />
      )}

      {mode === "cloze" && (
        <ClozePanel
          exercise={exercise}
          clozeSet={clozeSet}
          index={clozeIndex}
          picked={clozePicked}
          score={clozeScore}
          done={clozeDone}
          finished={clozeFinished}
          playing={playingUnit === "cloze"}
          quota={quota}
          onVipRequired={() => setVipOpen(true)}
          onPlay={playClozeSentence}
          onPick={pickCloze}
          onNext={nextCloze}
          onReset={resetCloze}
        />
      )}

      {mode === "repeat" && (
        <div className="premium-glass rounded-3xl p-4 sm:p-6">
          {repeatWords.length ? (
            <SpeakingRecorder
              words={repeatWords}
              mode="sentence"
              onResult={handleRepeatScore}
            />
          ) : (
            <div className="py-10 text-center text-sm text-white/40">暂无可跟读的句子</div>
          )}
        </div>
      )}

      {/* VIP 开通面板 */}
      <VipPanel
        open={vipOpen}
        onClose={() => {
          setVipOpen(false);
          refreshQuota();
        }}
      />
    </div>
  );
}

/* ============================================================
   逐句听面板
============================================================ */

function ListenPanel({ exercise, playingUnit, onPlay }) {
  if (!exercise || !exercise.units.length) {
    return (
      <div className="premium-glass rounded-3xl p-8 text-center text-sm text-white/40">
        暂无朗读内容
      </div>
    );
  }

  return (
    <section className="premium-glass rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs tracking-[0.15em] text-emerald-300/70">
          <Volume2 className="h-3.5 w-3.5" /> 逐句朗读 · {exercise.units.length} 句
        </div>
        <button
          type="button"
          onClick={() => onPlay({ id: "all" })}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55 transition hover:bg-white/[0.1]"
        >
          播放全部
        </button>
      </div>

      <div className="space-y-2">
        {exercise.units.map((unit, i) => {
          const playing = playingUnit === unit.id;
          return (
            <div
              key={unit.id}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 transition ${
                playing
                  ? "border-emerald-300/40 bg-emerald-400/[0.08]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span className="mt-1 w-6 shrink-0 text-center text-xs text-white/30">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onPlay(unit)}
                aria-label={`播放第 ${i + 1} 句`}
                className="shrink-0 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200 transition hover:bg-emerald-400/20 active:scale-95"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                {unit.isTitle && (
                  <span className="mb-1 inline-block rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200/70">
                    标题
                  </span>
                )}
                <p className="font-thai-serif text-base leading-relaxed text-white">
                  {unit.thai}
                </p>
                {unit.roman && (
                  <p className="mt-1 text-[12px] italic text-emerald-200/50">
                    {unit.roman}
                  </p>
                )}
                {unit.zh && (
                  <p className="mt-1 text-[13px] text-white/70">{unit.zh}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================
   听音填空面板
============================================================ */

function ClozePanel({
  exercise,
  clozeSet,
  index,
  picked,
  score,
  done,
  finished,
  playing,
  quota,
  onVipRequired,
  onPlay,
  onPick,
  onNext,
  onReset,
}) {
  const q = clozeSet[index]?.cloze;

  if (!exercise || !clozeSet.length) {
    return (
      <div className="premium-glass rounded-3xl p-8 text-center text-sm text-white/40">
        暂无填空题目
      </div>
    );
  }

  if (finished) {
    return (
      <section className="premium-glass rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-300" />
        </div>
        <h2 className="text-xl font-bold text-white">练习完成</h2>
        <p className="mt-2 text-sm text-white/55">
          共 {clozeSet.length} 题 · 答对 {score} 题 · 正确率{" "}
          {Math.round((score / clozeSet.length) * 100)}%
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.12]"
          >
            <RotateCcw className="h-4 w-4" /> 再来一次
          </button>
        </div>
      </section>
    );
  }

  /* 免费用户今日题数用完 → VIP 锁定 */
  if (quota && !quota.isVip && quota.remainingToday <= 0) {
    return (
      <section className="premium-glass rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-300/25 bg-yellow-300/[0.08]">
          <Crown className="h-8 w-8 text-yellow-300" />
        </div>
        <h2 className="text-xl font-bold text-white">今日免费题数已用完</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/50">
          免费用户每天可练习 {quota.freeQuestionDaily} 道听音填空题，
          开通 VIP 即可无限练习全部新闻听力。
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onVipRequired}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 px-6 py-2.5 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5"
          >
            <Crown className="h-4 w-4" /> 开通 VIP 无限练习
          </button>
        </div>
      </section>
    );
  }

  const correct = picked === q.answer;

  return (
    <section className="premium-glass rounded-3xl p-5 sm:p-6">
      {/* 进度 */}
      <div className="mb-4 flex items-center justify-between px-1 text-xs text-white/45">
        <span>
          第 {index + 1} / {clozeSet.length} 题 · 答对 {score} 题
        </span>
        <span>听音频，选出被挖掉的词</span>
      </div>
      <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400/70 transition-all"
          style={{ width: `${((index + (picked ? 1 : 0)) / clozeSet.length) * 100}%` }}
        />
      </div>

      {/* 播放 */}
      <div className="mb-5 flex items-center justify-center">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-emerald-200 transition hover:bg-emerald-400/25 active:scale-95"
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </button>
      </div>

      {/* 挖空句子 */}
      <div className="mb-2 text-center">
        <p className="font-thai-serif text-xl leading-relaxed text-white">
          {q.clozeText}
        </p>
      </div>
      {q.hintChinese && !picked && (
        <p className="mb-4 text-center text-xs text-white/40">
          提示：{q.hintChinese}
          {q.hintRoman ? ` · ${q.hintRoman}` : ""}
        </p>
      )}

      {/* 选项 */}
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt) => {
          const isAnswer = opt === q.answer;
          const isPicked = picked === opt;
          let cls =
            "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.1]";
          if (picked) {
            if (isAnswer) cls = "border-emerald-300/50 bg-emerald-400/15 text-emerald-100";
            else if (isPicked) cls = "border-red-300/50 bg-red-400/15 text-red-200";
            else cls = "border-white/10 bg-white/[0.02] text-white/35";
          }
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              disabled={!!picked}
              className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 font-thai-serif text-base transition ${cls} disabled:cursor-default`}
            >
              <span>{opt}</span>
              {picked && isAnswer && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {picked && isPicked && !isAnswer && (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* 反馈 + 下一题 */}
      {picked && (
        <div className="mt-5 text-center">
          <p className={`text-sm ${correct ? "text-emerald-200" : "text-red-200"}`}>
            {correct ? "回答正确！" : `正确答案：${q.answer}`}
          </p>
          {index < clozeSet.length - 1 && (
            <button
              type="button"
              onClick={onNext}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-5 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/25"
            >
              下一题 <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {index === clozeSet.length - 1 && (
            <button
              type="button"
              onClick={onNext}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-5 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/25"
            >
              查看结果 <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   工具
============================================================ */

function formatDateCN(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  return `${Number(match[2])}月${Number(match[3])}日`;
}
