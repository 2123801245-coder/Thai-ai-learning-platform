import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Volume2, Tag, Newspaper, ExternalLink, Headphones } from "lucide-react";
import {
  searchThaiCorpus,
  getThaiCorpusStats,
  THAI_CORPUS_SCENES,
  THAI_CORPUS_LEVELS,
} from "@/data/thaiCorpus";
import { speakThai } from "@/lib/thaiSpeech";
import { API_BASE_URL } from "@/lib/api";

const levelStyles = {
  beginner: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  intermediate: "border-yellow-300/20 bg-yellow-300/10 text-yellow-200",
  advanced: "border-orange-300/20 bg-orange-400/10 text-orange-200",
};

export default function ThaiCorpus() {
  const [query, setQuery] = useState("");
  const [scene, setScene] = useState("all");
  const [level, setLevel] = useState("all");
  const [news, setNews] = useState([]);
  const [newsDate, setNewsDate] = useState("");
  const [newsError, setNewsError] = useState("");
  const [newsTranslation, setNewsTranslation] = useState(null);
  const results = useMemo(() => searchThaiCorpus({ query, scene, level }), [query, scene, level]);
  const stats = useMemo(() => getThaiCorpusStats(), []);

  // 每日 ThaiPBS 时事新闻
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/news/daily`);
        if (!res.ok) throw new Error("load fail");
        const data = await res.json();
        if (cancelled) return;
        setNews(data.items || []);
        setNewsDate(data.date || "");
        setNewsError(data.error || "");
        setNewsTranslation(data.translation || null);
      } catch (e) {
        if (!cancelled) setNewsError("暂时无法加载今日新闻");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-5 pb-8">
      <section className="premium-glass-strong overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs tracking-[0.18em] text-emerald-300/70">
              <BookOpen className="h-4 w-4" /> THAI CORPUS · 本地语料库
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">真实语境泰语</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/55">
              按泰国日常场景整理的离线句子库。每条包含自然表达、拉丁转写、中文译文和难度等级，适合跟读、复习与实际对话。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <Stat value={stats.total} label="句子" />
            <Stat value={stats.scenes.length} label="场景" />
            <Stat value={stats.levels.length} label="等级" />
          </div>
        </div>
      </section>

      {news.length > 0 && (
        <section className="premium-glass rounded-3xl p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-emerald-300/80">
              <Newspaper className="h-4 w-4" /> THAI PBS · 今日时事 {newsDate ? `· ${formatDateCN(newsDate)}` : ""}
            </div>
            <div className="flex items-center gap-2">
              {newsTranslation && !newsTranslation.enabled && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35">
                  未配置翻译
                </span>
              )}
              {newsTranslation && newsTranslation.enabled && newsTranslation.ok && (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200/70">
                  AI 译文 + 注音 · {newsTranslation.translated} 条
                </span>
              )}
              {newsTranslation && newsTranslation.enabled && !newsTranslation.ok && !newsTranslation.partial && (
                <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[10px] text-yellow-200/70">
                  翻译暂不可用
                </span>
              )}
              <span className="text-[11px] text-white/40">每日自动更新 · 点击阅读原文</span>
            </div>
          </div>
          <div className="grid gap-2.5">
            {news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="card-lift group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-emerald-300/30 hover:bg-white/[0.06]"
              >
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); speakThai(item.title); }}
                  aria-label={`播放：${item.title}`}
                  className="mt-0.5 shrink-0 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200 transition hover:bg-emerald-400/20 active:scale-95"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-emerald-200/70">
                      {item.category || "ข่าว"}
                    </span>
                    <ListeningLink item={item} />
                    <ExternalLink className="h-3.5 w-3.5 text-white/30 transition group-hover:text-emerald-200" />
                  </div>
                  <p className="mt-2 font-thai-serif text-lg leading-relaxed text-white">{item.title}</p>
                  {item.roman_title && (
                    <p className="mt-1 text-[13px] italic leading-6 text-emerald-200/60">{item.roman_title}</p>
                  )}
                  {item.zh_title ? (
                    <p className="mt-1 text-sm leading-6 text-white/80">{item.zh_title}</p>
                  ) : (
                    <p className="mt-1 text-xs italic leading-6 text-white/30">
                      {newsTranslation && !newsTranslation.enabled
                        ? "暂无译文 · 未配置翻译接口"
                        : "暂无译文 · 翻译服务暂不可用"}
                    </p>
                  )}
                  {item.lede && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-white/55">{item.lede}</p>
                  )}
                  {item.zh_lede ? (
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-6 text-white/60">{item.zh_lede}</p>
                  ) : (
                    item.lede && newsTranslation && newsTranslation.enabled && (
                      <p className="mt-0.5 text-[11px] italic leading-5 text-white/25">暂无译文</p>
                    )
                  )}
                  {item.roman_lede && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] italic leading-5 text-emerald-200/40">{item.roman_lede}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {news.length === 0 && newsError && (
        <div className="premium-glass rounded-2xl p-5 text-center text-sm text-white/45">
          {newsError}（离线语料库仍可使用）
        </div>
      )}

      <section className="premium-glass rounded-3xl p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索泰文、中文、读音或关键词"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:bg-white/[0.09]"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterButton active={scene === "all"} onClick={() => setScene("all")}>全部场景</FilterButton>
          {THAI_CORPUS_SCENES.map((item) => (
            <FilterButton key={item.id} active={scene === item.id} onClick={() => setScene(item.id)}>{item.label}</FilterButton>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterButton active={level === "all"} onClick={() => setLevel("all")}>全部难度</FilterButton>
          {THAI_CORPUS_LEVELS.map((item) => (
            <FilterButton key={item.id} active={level === item.id} onClick={() => setLevel(item.id)}>{item.label}</FilterButton>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-xs text-white/40">
        <span>找到 {results.length} 条语料</span>
        <span>点击喇叭可播放泰语</span>
      </div>

      <section className="grid gap-3 lg:grid-cols-2">
        {results.map((item) => (
          <article key={item.id} className="premium-glass card-lift rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] text-white/55">
                  {THAI_CORPUS_SCENES.find((entry) => entry.id === item.scene)?.label}
                </span>
                <span className={`rounded-full border px-2 py-1 text-[10px] ${levelStyles[item.level]}`}>
                  {THAI_CORPUS_LEVELS.find((entry) => entry.id === item.level)?.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => speakThai(item.thai)}
                aria-label={`播放：${item.thai}`}
                className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200 transition hover:bg-emerald-400/20 active:scale-95"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 font-thai-serif text-2xl leading-relaxed text-white">{item.thai}</p>
            <p className="mt-2 text-sm italic text-emerald-200/70">{item.romanization}</p>
            <p className="mt-3 text-sm text-white/75">{item.chinese}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Tag className="mt-0.5 h-3.5 w-3.5 text-white/30" />
              {item.keywords.map((keyword) => (
                <span key={keyword} className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-white/40">{keyword}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      {!results.length && (
        <div className="premium-glass rounded-2xl p-10 text-center text-sm text-white/45">没有匹配的语料，换个关键词试试。</div>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"><div className="text-xl font-semibold text-white">{value}</div><div className="mt-1 text-[10px] text-white/40">{label}</div></div>;
}

function ListeningLink({ item }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/corpus/listening?news=${encodeURIComponent(item.id)}`);
      }}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200/90 transition hover:bg-emerald-400/20"
    >
      <Headphones className="h-3 w-3" /> 听力练习
    </button>
  );
}

function FilterButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white"}`}>{children}</button>;
}

function formatDateCN(isoDate) {
  // isoDate 形如 2026-08-29
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  return `${Number(match[2])}月${Number(match[3])}日`;
}
