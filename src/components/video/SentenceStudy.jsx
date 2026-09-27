import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Gauge,
  Languages,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";

import { API_BASE_URL, SERVER_BASE_URL } from "@/lib/api";

/* =========================================================
   逐句解析（双语精听）
   ---------------------------------------------------------
   数据来自后端 /api/bilingual/<taskId>：句子级 { start, end, th, zh }，
   由 y2a-auto 流水线下载的原片 + 泰/中字幕清洗切句而来（见
   backend/routes/bilingual.js 里的清洗与断句说明）。

   为什么用本地原片：B 站外链播放器对未登录访客只给 360P（实测），
   而流水线下载的原片本来就是 1920×1080 —— 同一个视频，清晰度差三档，
   而且不依赖外站、不受网络与登录状态影响。

   交互按「精听」来设计，不是按「看视频」：
     · 句子列表跟着播放高亮，点任意一句就从那里播；
     · 单句循环（跟读用）、单句重播、上一句/下一句；
     · 0.75× 慢速；中文可随时隐藏（先听再看）。
   ========================================================= */

const RATES = [0.75, 1];

export default function SentenceStudy({ taskId, onProgress }) {
  const videoRef = useRef(null);
  const listRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(-1);
  const [showZh, setShowZh] = useState(true);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [expandedAll, setExpandedAll] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const lastReported = useRef(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setCurrent(-1);
    fetch(`${API_BASE_URL}/bilingual/${taskId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, [taskId]);

  /* AI 逐句解析：磁盘缓存命中秒回；有缺口就轮询，后端分批补齐、
     前端看到逐句填充。503（未配置 AI）静默跳过 —— 界面退回纯机翻。 */
  useEffect(() => {
    let alive = true;
    setAnalysis(null);
    setAnalysisError("");
    setOpenIds(new Set());
    setExpandedAll(false);
    const run = async () => {
      try {
        for (;;) {
          if (!alive) return;
          const r = await fetch(
            `${API_BASE_URL}/bilingual/${taskId}/analysis?maxMs=25000`
          );
          if (!alive) return;
          if (!r.ok) {
            if (r.status === 503) return; // AI 未配置：不展示解析区
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${r.status}`);
          }
          const d = await r.json();
          if (!alive) return;
          setAnalysis(d);
          if (!d.total || d.done >= d.total) return; // 完成（或没字幕）
          await new Promise((res) => setTimeout(res, 2000));
        }
      } catch (e) {
        if (alive) setAnalysisError(String(e?.message || e));
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [taskId]);

  const sentences = data?.sentences || [];
  const videoSrc = `${SERVER_BASE_URL}${data?.videoUrl || `/videos/y2a/${taskId}.mp4`}`;
  const analysisMap = new Map((analysis?.sentences || []).map((a) => [a.i, a]));
  const aiGenerating =
    Boolean(analysis) && analysis.total > 0 && analysis.done < analysis.total;

  /* 当前句自动展开 AI 解析（只在切句时开一次，不强行打断手动收起） */
  useEffect(() => {
    if (current < 0) return;
    setOpenIds((prev) => {
      if (prev.has(current)) return prev;
      const next = new Set(prev);
      next.add(current);
      return next;
    });
  }, [current]);

  const toggleOpen = (i) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  /* 播放位置 → 当前句；单句循环时到句尾就跳回句首 */
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !sentences.length) return;
    const t = v.currentTime * 1000;
    const i = sentences.findIndex((s) => t >= s.start && t < s.end);
    if (i >= 0 && i !== current) setCurrent(i);
    if (loop && i >= 0 && t > sentences[i].end - 80) v.currentTime = sentences[i].start / 1000;

    /* 进度回传（每 5% 报一次即可，别把 localStorage 写爆） */
    if (v.duration && onProgress) {
      const pct = Math.round((t / 1000 / v.duration) * 100);
      if (pct - lastReported.current >= 5) {
        lastReported.current = pct;
        onProgress(Math.min(100, pct));
      }
    }
  };

  const jump = (i, autoplay = true) => {
    const s = sentences[i];
    const v = videoRef.current;
    if (!s || !v) return;
    v.currentTime = s.start / 1000 + 0.02;
    setCurrent(i);
    if (autoplay) v.play().catch(() => {});
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate, data]);

  /* 当前句滚进视野（用 nearest：不把整个页面一起滚走） */
  useEffect(() => {
    if (current < 0) return;
    const el = listRef.current?.querySelector(`[data-sentence="${current}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  if (error) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center text-xs text-white/45">
        逐句数据读取失败（{error}）。原片子目录可能在 y2a-auto 之外，或还没下完 —— 可用
        <code className="mx-1 text-white/60">Y2A_DOWNLOADS_DIR</code>指定目录。
      </div>
    );
  }

  if (!data) {
    return (
      <div className="aspect-video w-full animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.03]" />
    );
  }

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      {/* 精听控制条 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          onClick={() => jump(Math.max(0, current - 1))}
          className="apple-button flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-white/60 hover:bg-white/[0.08] hover:text-white"
        >
          <SkipBack className="h-3 w-3" /> 上一句
        </button>
        <button
          onClick={() => jump(current < 0 ? 0 : current)}
          className="apple-button flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-white/60 hover:bg-white/[0.08] hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> 重播本句
        </button>
        <button
          onClick={() => jump(Math.min(sentences.length - 1, current + 1))}
          className="apple-button flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-white/60 hover:bg-white/[0.08] hover:text-white"
        >
          下一句 <SkipForward className="h-3 w-3" />
        </button>
        <span className="mx-1 h-3 w-px bg-white/10" />
        <button
          onClick={() => setLoop((v) => !v)}
          aria-pressed={loop}
          className={`apple-button flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            loop
              ? "border-emerald-400/25 bg-emerald-500/20 text-emerald-200"
              : "border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
          }`}
        >
          <Repeat className="h-3 w-3" /> 单句循环
        </button>
        <button
          onClick={() => setShowZh((v) => !v)}
          aria-pressed={showZh}
          className={`apple-button flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            showZh
              ? "border-white/[0.06] bg-white/[0.04] text-white/60"
              : "border-emerald-400/25 bg-emerald-500/20 text-emerald-200"
          }`}
        >
          <Languages className="h-3 w-3" /> {showZh ? "隐藏中文" : "显示中文"}
        </button>
        <button
          onClick={() => setRate((r) => (r === 1 ? 0.75 : 1))}
          aria-pressed={rate !== 1}
          className={`apple-button flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            rate !== 1
              ? "border-emerald-400/25 bg-emerald-500/20 text-emerald-200"
              : "border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
          }`}
        >
          <Gauge className="h-3 w-3" /> {rate}×
        </button>
        {aiGenerating && (
          <span className="ml-auto flex items-center gap-1 text-emerald-300/60">
            <Sparkles className="h-3 w-3 animate-pulse" />
            AI 解析中 {analysis.done}/{analysis.total}
          </span>
        )}
        <span className={`${aiGenerating ? "" : "ml-auto"} text-white/30`}>
          共 {sentences.length} 句 · 本地原片 {data.resolution || "1080P"}
        </span>
      </div>

      {/* 句子列表 */}
      <div
        ref={listRef}
        className="mt-2.5 max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]"
      >
        {sentences.map((s) => {
          const active = s.i === current;
          const ai = analysisMap.get(s.i);
          const hasAi = Boolean(ai && (ai.zh2 || ai.vocab?.length || ai.grammar));
          const open = hasAi && (expandedAll || openIds.has(s.i));
          return (
            <div
              key={s.i}
              data-sentence={s.i}
              role="button"
              tabIndex={0}
              onClick={() => jump(s.i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  jump(s.i);
                }
              }}
              className={`block w-full cursor-pointer px-3.5 py-2.5 text-left transition ${
                active ? "bg-emerald-500/[0.12]" : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex gap-2.5">
                <span
                  className={`mt-0.5 w-6 shrink-0 text-right font-mono text-[10px] ${
                    active ? "text-emerald-300/80" : "text-white/25"
                  }`}
                >
                  {s.i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] leading-relaxed ${
                      active ? "text-white" : "text-white/75"
                    }`}
                  >
                    {s.th}
                  </span>
                  {showZh && (hasAi && ai.zh2 ? ai.zh2 : s.zh) && (
                    <span className="mt-1 block text-[11px] leading-relaxed text-white/40">
                      {hasAi && ai.zh2 ? ai.zh2 : s.zh}
                    </span>
                  )}
                  <span className="mt-1 block font-mono text-[9px] text-white/20">
                    {(s.start / 1000).toFixed(1)}s – {(s.end / 1000).toFixed(1)}s
                  </span>
                </span>
                {hasAi && (
                  <button
                    type="button"
                    aria-label={open ? "收起 AI 解析" : "展开 AI 解析"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOpen(s.i);
                    }}
                    className="apple-button mt-0.5 h-5 shrink-0 rounded-full px-1.5 text-emerald-300/70 transition hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>
              {open && (
                <div
                  className="mt-2 space-y-2 border-l-2 border-emerald-400/25 pl-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ai.vocab?.map((v) => (
                    <div key={v.th} className="text-[11px] leading-relaxed">
                      <span className="text-white/85">{v.th}</span>
                      {v.pron && (
                        <span className="ml-1.5 text-emerald-300/60">/{v.pron}/</span>
                      )}
                      {v.pos && <span className="ml-1.5 text-white/35">{v.pos}</span>}
                      <span className="ml-1.5 text-white/60">{v.zh}</span>
                      {v.example && (
                        <span className="mt-0.5 block text-white/35">{v.example}</span>
                      )}
                    </div>
                  ))}
                  {ai.grammar && (
                    <div className="text-[11px] leading-relaxed">
                      <span className="mr-1 text-emerald-300/60">语法</span>
                      <span className="text-white/55">{ai.grammar}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!sentences.length && (
          <div className="px-4 py-6 text-center text-xs text-white/35">
            这个任务还没有可用的泰语字幕
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
        句子由流水线字幕清洗切分而来（合并了 ASR 的「逐字增长」伪影、用中文标点补泰文缺失的句读）；
        中文翻译与生词/语法解析由 AI 生成并缓存在服务端，结果仅供参考。
        {analysisError && (
          <span className="text-amber-300/50">（AI 解析暂不可用：{analysisError}）</span>
        )}
      </p>
    </div>
  );
}
