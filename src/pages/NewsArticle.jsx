import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpenText,
  Volume2,
  Headphones,
  Newspaper,
  Play,
  Pause,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { speakThaiWithLocal, stopThaiAudio } from "@/lib/thaiSpeech";
import { splitNewsSentences } from "@/lib/newsListening";

const SPEED_OPTIONS = [
  { label: "0.65x", value: 0.65 },
  { label: "0.8x", value: 0.8 },
  { label: "1.0x", value: 1.0 },
  { label: "1.2x", value: 1.2 },
];

export default function NewsArticle() {
  const [params] = useSearchParams();
  const newsId = params.get("news") || "";
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [meta, setMeta] = useState(null); // 来自 daily 列表的标题/译文兜底
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 听力相关
  const [speed, setSpeed] = useState(0.8);
  const [playingId, setPlayingId] = useState(null); // 当前播放的句子 key
  const [playingAll, setPlayingAll] = useState(false);
  const stopRef = useRef(false);
  const playingIdRef = useRef(null);

  // 并行：加载 daily 拿标题兜底 + 请求整篇正文
  useEffect(() => {
    if (!newsId) {
      setError("缺少新闻 ID");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        fetch(`${API_BASE_URL}/news/daily`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!cancelled && d?.items) {
              const hit = d.items.find((n) => n.id === newsId);
              if (hit) setMeta(hit);
            }
          })
          .catch(() => {});

        const res = await fetch(`${API_BASE_URL}/news/article?id=${encodeURIComponent(newsId)}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "加载失败，请稍后重试");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setArticle(data);
      } catch (e) {
        if (!cancelled) {
          setError("网络异常，请稍后重试");
          setLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      stopThaiAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsId]);

  const title = article?.title || meta?.title || "";
  const zhTitle = article?.zh_title || meta?.zh_title || "";
  const romanTitle = article?.roman_title || meta?.roman_title || "";
  const lede = article?.summary || meta?.lede || "";
  const zhLede = meta?.zh_lede || "";

  // 段落 → 句子单元（每段内用 splitNewsSentences 切成可朗读单元，全局唯一 key）
  const sentenceGroups = useMemo(() => {
    if (!article?.paragraphs?.length) return [];
    const zh = article.zh || [];
    const roman = article.roman || [];
    let seq = 0;
    return article.paragraphs.map((thai, i) => {
      const units = splitNewsSentences({ lede: thai, zh_lede: zh[i] || "", roman_lede: roman[i] || "" });
      const withKeys = units.map((u) => ({ ...u, key: `p${i}-${seq++}` }));
      return {
        thai,
        zh: zh[i] || "",
        roman: roman[i] || "",
        units: withKeys,
      };
    });
  }, [article]);

  const allUnits = useMemo(
    () => sentenceGroups.flatMap((g) => g.units),
    [sentenceGroups]
  );

  const playSentence = (unit) => {
    if (playingAll) {
      stopAllPlay();
      return;
    }
    stopThaiAudio();
    setPlayingId(unit.key);
    speakThaiWithLocal(unit.thai, {
      rate: speed,
      onEnd: () => setPlayingId((prev) => (prev === unit.key ? null : prev)),
      onError: () => setPlayingId((prev) => (prev === unit.key ? null : prev)),
    });
  };

  const stopAllPlay = () => {
    stopRef.current = true;
    stopThaiAudio();
    setPlayingId(null);
    setPlayingAll(false);
  };

  // 播放一组句子（段落或整篇）：逐句串行 + 高亮 + 滚动跟随
  const playSequence = async (units) => {
    if (playingAll) {
      stopAllPlay();
      return;
    }
    if (!units.length) return;
    stopRef.current = false;
    setPlayingAll(true);
    for (const unit of units) {
      if (stopRef.current) break;
      setPlayingId(unit.key);
      document.getElementById(`sent-${unit.key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      await new Promise((resolve) => {
        speakThaiWithLocal(unit.thai, {
          rate: speed,
          onEnd: resolve,
          onError: resolve,
        });
      });
      if (stopRef.current) break;
    }
    stopRef.current = false;
    setPlayingId(null);
    setPlayingAll(false);
  };

  const playParagraph = (group) => playSequence(group.units);

  if (loading) {
    return (
      <div className="page-enter mx-auto max-w-3xl px-4 py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300/60" />
        <p className="mt-4 text-sm text-white/50">正在抓取文章正文并生成译文…</p>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="page-enter mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-yellow-300/70" />
        <p className="mt-4 text-sm text-white/60">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.12]"
        >
          <ArrowLeft className="h-4 w-4" /> 返回语料库
        </button>
      </div>
    );
  }

  const hasZh = sentenceGroups.some((g) => g.zh);

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-5 px-4 pb-12 pt-4 sm:px-0">
      {/* 顶部栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {/* 变速控制 */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSpeed(s.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  speed === s.value
                    ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                    : "text-white/45 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/corpus/listening?news=${encodeURIComponent(newsId)}`)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-2 text-xs text-emerald-200/90 transition hover:bg-emerald-400/20"
          >
            <Headphones className="h-3.5 w-3.5" /> 听力练习
          </button>
          {allUnits.length > 0 && (
            <button
              type="button"
              onClick={() => playSequence(allUnits)}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3.5 py-2 text-xs text-emerald-100 transition hover:bg-emerald-400/25"
            >
              {playingAll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playingAll ? "停止朗读" : "朗读全文"}
            </button>
          )}
        </div>
      </div>

      {/* 标题区 */}
      <section className="premium-glass-strong rounded-3xl p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[0.16em] text-emerald-300/70">
          <Newspaper className="h-3.5 w-3.5" /> THAI PBS · 整篇阅读
          {article?.cached && <span className="text-white/30">· 已缓存</span>}
          {article?.stale && <span className="text-yellow-300/60">· 缓存兜底</span>}
        </div>
        <h1 className="font-thai-serif text-2xl leading-snug text-white sm:text-3xl">{title || "（未获取到标题）"}</h1>
        {romanTitle && <p className="mt-2 text-sm italic text-emerald-200/60">{romanTitle}</p>}
        {zhTitle && <p className="mt-2 text-base leading-7 text-white/85">{zhTitle}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => title && speakThaiWithLocal(title, { rate: speed })}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200/90 transition hover:bg-emerald-400/20"
          >
            <Volume2 className="h-3.5 w-3.5" /> 播放标题
          </button>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/40">
            原文：thaipbs.or.th · 译文由 AI 生成，仅供学习
          </span>
        </div>
      </section>

      {/* 摘要 */}
      {lede && (
        <section className="premium-glass rounded-3xl border-l-2 border-l-emerald-300/40 p-5 sm:p-6">
          <div className="mb-2 text-[10px] tracking-[0.16em] text-white/35">สรุปประเด็นสำคัญ · 摘要</div>
          <p className="font-thai-serif text-[15px] leading-7 text-white/90">{lede}</p>
          {zhLede && <p className="mt-2 text-sm leading-7 text-white/65">{zhLede}</p>}
        </section>
      )}

      {/* 正文：句子级听力单元 */}
      {sentenceGroups.length > 0 ? (
        <section className="space-y-3">
          {!hasZh && (
            <div className="rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.05] px-4 py-3 text-xs text-yellow-200/60">
              正文加载完成，但 AI 译文暂不可用（未配置翻译接口或服务超时）。泰语朗读不受影响。
            </div>
          )}
          {sentenceGroups.map((g, gi) => (
            <div key={gi} className="premium-glass rounded-2xl p-4 sm:p-5">
              {/* 段落头：序号 + 整段播放 */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-mono text-white/40">
                  段落 {gi + 1}
                </span>
                {g.units.length > 1 && (
                  <button
                    type="button"
                    onClick={() => playParagraph(g)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/50 transition hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-emerald-100"
                  >
                    <Play className="h-3 w-3" /> 朗读本段
                  </button>
                )}
              </div>

              {/* 句子列表 */}
              <div className="space-y-1.5">
                {g.units.map((unit) => {
                  const active = playingId === unit.key;
                  return (
                    <div
                      key={unit.key}
                      id={`sent-${unit.key}`}
                      className={`group flex items-start gap-2 rounded-xl border px-3 py-2 transition ${
                        active
                          ? "border-emerald-300/40 bg-emerald-400/[0.12]"
                          : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playSentence(unit)}
                        aria-label={`播放：${unit.thai}`}
                        className={`mt-0.5 shrink-0 rounded-lg border p-1.5 transition active:scale-95 ${
                          active
                            ? "border-emerald-300/40 bg-emerald-400/25 text-emerald-100"
                            : "border-white/10 bg-white/[0.04] text-white/40 group-hover:text-emerald-200"
                        }`}
                      >
                        {active ? (
                          <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <p
                        className={`font-thai-serif text-[15px] leading-7 transition ${
                          active ? "text-white" : "text-white/85"
                        }`}
                      >
                        {unit.thai}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 段级罗马音 + 中文译文 */}
              {g.roman && <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-[13px] italic leading-6 text-emerald-200/55">{g.roman}</p>}
              {g.zh ? (
                <p className="mt-1.5 text-sm leading-7 text-white/70">{g.zh}</p>
              ) : (
                <p className="mt-1.5 text-[11px] italic text-white/25">暂无译文</p>
              )}
            </div>
          ))}
        </section>
      ) : (
        <section className="premium-glass rounded-3xl p-10 text-center text-sm text-white/45">
          这篇文章暂时无法获取正文，请稍后重试或回到语料库。
        </section>
      )}

      {/* 底部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-white/35">
        <div className="flex items-center gap-1.5">
          <BookOpenText className="h-3.5 w-3.5" />
          内容来源：Thai Public Broadcasting Service（ThaiPBS）
        </div>
        {article?.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white/45 underline-offset-4 transition hover:text-emerald-200 hover:underline"
          >
            查看原文 <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
