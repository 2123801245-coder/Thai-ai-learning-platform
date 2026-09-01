import React, { useMemo, useRef, useState } from "react";
import { Search, Volume2, Sparkles, BookHeart, Loader2 } from "lucide-react";
import { speakThai } from "@/lib/thaiSpeech";
import {
  cultureCategories,
  culturePoints,
  getCultureStats,
} from "@/data/thaiCulture";

/* =========================================================
   泰国文化 · Culture
   - 节日习俗 / 美食文化 / 寺庙文化 / 泰剧音乐 / 网络用语 / 社交礼仪
   - 每个知识点连接到泰语表达：点击即朗读（TTS）
========================================================= */

export default function Culture() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [speakingKey, setSpeakingKey] = useState(null);
  const audioRef = useRef(null);

  const stats = useMemo(() => getCultureStats(), []);
  const total = culturePoints.length;

  const filtered = useMemo(() => {
    let list = culturePoints;
    if (activeCategory !== "all") {
      list = list.filter((p) => p.category === activeCategory);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.thai.toLowerCase().includes(q) ||
          p.chinese.toLowerCase().includes(q) ||
          p.culture.toLowerCase().includes(q) ||
          p.vocab.some((v) => v.cn.includes(q) || v.th.includes(q))
      );
    }
    return list;
  }, [activeCategory, query]);

  const speak = (key, text) => {
    if (speakingKey === key) {
      stop();
      return;
    }
    audioRef.current?.pause();
    const a = speakThai(text, { rate: 0.78 });
    audioRef.current = a;
    setSpeakingKey(key);
    const clear = () => setSpeakingKey((k) => (k === key ? null : k));
    if (a) {
      a.addEventListener?.("ended", clear);
      a.addEventListener?.("error", clear);
    } else {
      // 无 TTS 时 1.2s 后复位图标
      setTimeout(clear, 1200);
    }
  };

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingKey(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* 页头 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/60">
          <Sparkles className="h-3.5 w-3.5" />
          Thailand Culture · วัฒนธรรมไทย
        </div>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
          泰国文化
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/45">
          学语言，更懂泰国。每个文化知识点都连接到地道泰语表达——点击即可听发音。
        </p>

        {/* 统计 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-1 text-xs text-emerald-200/90">
            <BookHeart className="h-3.5 w-3.5" />
            {total} 个知识点 · {cultureCategories.length} 大分类
          </div>
          {stats.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/55"
            >
              <span>{s.emoji}</span>
              {s.label} · {s.count}
            </div>
          ))}
        </div>
      </div>

      {/* 搜索 + 分类 */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索：泼水节 / สงกรานต์ / 冬阴功…"
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/40"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              activeCategory === "all"
                ? "bg-emerald-400 text-[#061513]"
                : "border border-white/[0.1] bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            ✨ 全部
          </button>
          {cultureCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              title={c.desc}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeCategory === c.id
                  ? "bg-emerald-400 text-[#061513]"
                  : "border border-white/[0.1] bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 知识点卡片 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-14 text-center">
          <div className="text-3xl">🌴</div>
          <p className="mt-3 text-sm text-white/50">没有找到相关知识点，换个关键词试试</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const cat = cultureCategories.find((c) => c.id === p.category);
            const isSpeaking = speakingKey === `main-${p.id}`;

            return (
              <article
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 transition hover:border-emerald-300/25 hover:bg-white/[0.06] sm:p-5"
              >
                {/* 顶部分类 + 标题 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] text-lg">
                      {p.emoji}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-px text-[9px] font-bold text-white/45">
                          {cat?.emoji} {cat?.label}
                        </span>
                      </div>
                      <h2 className="mt-1 text-sm font-bold leading-5 text-white/90 sm:text-base">
                        {p.title}
                      </h2>
                    </div>
                  </div>

                  {/* 朗读主表达 */}
                  <button
                    type="button"
                    onClick={() => speak(`main-${p.id}`, p.thai)}
                    aria-label={`朗读 ${p.thai}`}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                      isSpeaking
                        ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-300"
                        : "border-white/[0.1] bg-white/[0.04] text-white/40 hover:border-emerald-300/30 hover:text-emerald-300"
                    }`}
                  >
                    {isSpeaking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* 泰语表达 */}
                <button
                  type="button"
                  onClick={() => speak(`main-${p.id}`, p.thai)}
                  className="mt-4 flex items-center gap-2 text-left"
                >
                  <span className="text-xl font-black tracking-wide text-emerald-200 sm:text-2xl">
                    {p.thai}
                  </span>
                  <Volume2
                    className={`h-4 w-4 shrink-0 ${isSpeaking ? "animate-pulse text-emerald-300" : "text-emerald-300/40 group-hover:text-emerald-300/80"}`}
                  />
                </button>
                <p className="mt-1 text-xs italic text-white/35">
                  {p.roman}
                </p>
                <p className="mt-1 text-sm font-medium text-white/75">
                  {p.chinese}
                </p>

                {/* 为什么这么说 */}
                <div className="mt-3 rounded-xl border border-emerald-300/[0.12] bg-emerald-400/[0.05] px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">
                    为什么这么说
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/65">
                    {p.meaning}
                  </p>
                </div>

                {/* 文化解析 */}
                <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                    🏛️ 文化解析
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/60">
                    {p.culture}
                  </p>
                </div>

                {/* 例句 */}
                <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => speak(`ex-${p.id}`, p.example.thai)}
                    aria-label={`朗读例句 ${p.example.thai}`}
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
                      speakingKey === `ex-${p.id}`
                        ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-300"
                        : "border-white/[0.1] bg-white/[0.04] text-white/40 hover:text-emerald-300"
                    }`}
                  >
                    {speakingKey === `ex-${p.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                      例句
                    </div>
                    <p className="mt-1 text-xs font-semibold text-white/80">
                      {p.example.thai}
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-white/35">
                      {p.example.roman}
                    </p>
                    <p className="mt-0.5 text-xs text-white/60">
                      {p.example.chinese}
                    </p>
                  </div>
                </div>

                {/* 相关词汇 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.vocab.map((v) => (
                    <button
                      key={v.th}
                      type="button"
                      onClick={() => speak(`v-${p.id}-${v.th}`, v.th)}
                      className={`group/chip flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                        speakingKey === `v-${p.id}-${v.th}`
                          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                          : "border-white/[0.1] bg-white/[0.03] text-white/55 hover:border-emerald-300/30 hover:text-emerald-200"
                      }`}
                    >
                      <span className="font-semibold">{v.th}</span>
                      <span className="text-white/30">{v.cn}</span>
                      <Volume2 className="h-3 w-3 opacity-40" />
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
