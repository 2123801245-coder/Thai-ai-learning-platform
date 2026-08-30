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
  X,
  Check,
  Plus,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { speakThaiWithLocal, stopThaiAudio } from "@/lib/thaiSpeech";
import { splitNewsSentences } from "@/lib/newsListening";
import { segmentThaiText } from "@/lib/thaiWordLookup";
import { recordWrongWord } from "@/lib/wordBooks";
import { useToast } from "@/components/ui/use-toast";

const SPEED_OPTIONS = [
  { label: "0.65x", value: 0.65 },
  { label: "0.8x", value: 0.8 },
  { label: "1.0x", value: 1.0 },
  { label: "1.2x", value: 1.2 },
];

// 读取 SSE 流并分派事件。返回是否正常读完（完整读到 complete / 服务端关闭）。
async function readSSE(res, handlers, isAborted) {
  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      if (isAborted()) {
        try { await reader.cancel(); } catch (e) {}
        return false;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = "message";
        const dataLines = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length) {
          try {
            const obj = JSON.parse(dataLines.join("\n"));
            if (handlers[event]) handlers[event](obj);
          } catch (e) {}
        }
      }
    }
    return true; // 流正常读完
  } catch (e) {
    return false; // 读取失败 → 调用方回退标准接口
  }
}

// 把一段文本渲染成可点词：命中词典的泰语词高亮可点，其余原样显示
function ThaiWords({ text, onWordClick }) {
  const spans = useMemo(() => segmentThaiText(text || ""), [text]);
  return (
    <>
      {spans.map((sp, i) =>
        sp.thai && sp.info ? (
          <button
            key={i}
            type="button"
            onClick={(e) => onWordClick && onWordClick(sp.info, e.currentTarget)}
            title={sp.info.chinese}
            className="mx-0.5 inline rounded-sm decoration-emerald-300/30 underline decoration-dotted underline-offset-2 transition hover:text-emerald-100 hover:decoration-emerald-300/80"
            style={{ cursor: "help" }}
          >
            {sp.text}
          </button>
        ) : (
          <span key={i}>{sp.text}</span>
        )
      )}
    </>
  );
}

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
  const articleRef = useRef(null);

  // 点词查释义 + 生词本
  const { toast } = useToast();
  const [activeWord, setActiveWord] = useState(null); // { info, anchorX, anchorY, placement, added }
  const [addedWords, setAddedWords] = useState(() => new Set());

  const openWord = (info, el) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const anchorX = Math.max(160, Math.min(vw - 160, r.left + r.width / 2));
    setActiveWord({
      info,
      anchorX,
      anchorY: r.top,
      placement: r.top > 240 ? "above" : "below",
      added: addedWords.has(info.thai),
    });
  };

  const closeWord = () => setActiveWord(null);

  const addWordToBook = async () => {
    if (!activeWord?.info) return;
    const w = activeWord.info;
    try {
      await recordWrongWord({
        thai: w.thai,
        chinese: w.chinese,
        roman: w.roman,
        sentence: w.sentence,
        sentenceCn: w.sentenceCn,
      });
      setAddedWords((prev) => new Set(prev).add(w.thai));
      setActiveWord((prev) => (prev ? { ...prev, added: true } : prev));
      toast({ title: "已加入生词本", description: `「${w.thai}」已保存到生词本练习` });
    } catch (e) {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  const speakWord = (thai) => speakThaiWithLocal(thai, { rate: speed });

  // 并行：加载 daily 拿标题兜底 + 整篇正文（优先 SSE 流式，失败回退标准接口）
  useEffect(() => {
    if (!newsId) {
      setError("缺少新闻 ID");
      setLoading(false);
      return;
    }
    let aborted = false;

    const setArticleData = (data) => {
      articleRef.current = data;
      setArticle(data);
    };

    // 流式增量：一批译文到达后补进 article.zh / article.roman
    const patchTranslation = (payload) => {
      if (aborted || !payload?.zh?.length) return;
      const base = articleRef.current;
      if (!base?.paragraphs) return;
      const zh = [...(base.zh || [])];
      const roman = [...(base.roman || [])];
      for (let k = 0; k < payload.zh.length; k++) {
        const idx = payload.start + k;
        if (idx < base.paragraphs.length) {
          zh[idx] = payload.zh[k] || "";
          roman[idx] = payload.roman[k] || "";
        }
      }
      setArticleData({ ...base, zh, roman });
    };

    (async () => {
      try {
        // 标题/导语兜底（不影响正文渲染）
        fetch(`${API_BASE_URL}/news/daily`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!aborted && d?.items) {
              const hit = d.items.find((n) => n.id === newsId);
              if (hit) setMeta(hit);
            }
          })
          .catch(() => {});

        // 1) 优先流式接口：先显示泰语正文/可朗读，译文边到边补
        const streamed = await fetch(
          `${API_BASE_URL}/news/article/stream?id=${encodeURIComponent(newsId)}`
        );
        if (aborted) return;
        if (streamed.ok && streamed.body) {
          const finished = await readSSE(
            streamed,
            {
              article: (obj) => {
                if (aborted) return;
                setArticleData(obj);
                setLoading(false);
                setError("");
              },
              progress: patchTranslation,
              complete: (obj) => {
                if (aborted) return;
                setArticleData({ ...(articleRef.current || {}), ...obj });
              },
              error: (obj) => {
                if (!aborted) {
                  setError(obj.message || "加载失败，请稍后重试");
                  setLoading(false);
                }
              },
            },
            () => aborted
          );
          if (finished || aborted) return;
        }

        // 2) 流式不可用 → 回退标准接口（后端同样已并行加速）
        if (aborted) return;
        const fallback = await fetch(
          `${API_BASE_URL}/news/article?id=${encodeURIComponent(newsId)}`
        );
        if (aborted) return;
        if (!fallback.ok) {
          const body = await fallback.json().catch(() => ({}));
          setError(body.error || "加载失败，请稍后重试");
          setLoading(false);
          return;
        }
        const data = await fallback.json();
        if (aborted) return;
        setArticleData(data);
      } catch (e) {
        if (!aborted) {
          setError("网络异常，请稍后重试");
          setLoading(false);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
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
          <p className="font-thai-serif text-[15px] leading-7 text-white/90">
            <ThaiWords text={lede} onWordClick={openWord} />
          </p>
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
                        <ThaiWords text={unit.thai} onWordClick={openWord} />
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

      {activeWord?.info && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeWord} aria-hidden />
          <div
            className="fixed z-50 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-emerald-300/20 bg-[#0c1a15]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
            style={{
              left: activeWord.anchorX,
              top: activeWord.anchorY,
              transform:
                activeWord.placement === "above"
                  ? "translate(-50%, calc(-100% - 16px))"
                  : "translate(-50%, 16px)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-thai-serif text-2xl font-semibold leading-none text-white">
                {activeWord.info.thai}
              </div>
              <button
                type="button"
                onClick={closeWord}
                aria-label="关闭"
                className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeWord.info.roman && (
              <div className="mt-1.5 text-sm italic text-emerald-200/85">
                {activeWord.info.roman}
              </div>
            )}

            {activeWord.info.pos && (
              <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/45">
                {activeWord.info.pos}
              </span>
            )}

            <div className="mt-2.5 text-base font-medium text-white/95">
              {activeWord.info.chinese}
            </div>

            {activeWord.info.sentence && (
              <div className="mt-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <div className="font-thai-serif text-[13px] leading-6 text-white/80">
                  {activeWord.info.sentence}
                </div>
                <div className="mt-0.5 text-[12px] leading-5 text-white/40">
                  {activeWord.info.sentenceCn}
                </div>
              </div>
            )}

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => speakWord(activeWord.info.thai)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
              >
                <Volume2 className="h-3.5 w-3.5" /> 发音
              </button>
              <button
                type="button"
                onClick={addWordToBook}
                disabled={activeWord.added}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/[0.12] disabled:cursor-default disabled:opacity-60"
              >
                {activeWord.added ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" /> 已加入
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> 加入生词本
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
