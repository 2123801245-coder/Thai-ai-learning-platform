// src/components/world/SharePostcard.jsx
//
// =========================================================
// ThaiAI World · 成就卡（可下载 / 可分享）
// =========================================================
//
// 让「我的泰语世界」成为用户愿意主动晒出去的东西，而不是只有自己看的
// 界面。成图逻辑全在 lib/worldPostcard.js（纯 Canvas2D），这里只负责：
//   ① 取真实数据（身份 + 星系，全部由 Home 传入，与首页同源）
//   ② 尝试抓一帧真实 3D 守护者（lib/worldSnapshot.js），失败就程序化画
//   ③ 把 canvas 转成图片给用户看与下载
//
// 刻意不做「连续 30 天才解锁」的门禁：卡上盖的是**印章**（7 / 30 / 100 天），
// 不是锁。锁住只会让新用户永远看不到这个功能，而他们恰恰最需要
// 「我也有一个世界」这件事。没到 7 天时界面会告诉他还差几天。
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, ImageDown, RefreshCw, Share2, Sparkles } from "lucide-react";

import { captureWorldSnapshot, hasWorldSnapshot } from "@/lib/worldSnapshot";
import {
  drawPostcard,
  milestoneFor,
  nextMilestone,
  POSTCARD_HEIGHT,
  POSTCARD_WIDTH,
} from "@/lib/worldPostcard";

/** 抓一帧 3D 画布并解码成 <img> 可用的位图。任何一步失败都返回 null。 */
function loadSnapshotImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

const dateLabel = () => {
  const now = new Date();
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
};

export default function SharePostcard({ identity, planets = [], theme = null, className = "" }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [source, setSource] = useState("procedural");
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);

  const milestone = useMemo(() => milestoneFor(identity?.streak), [identity?.streak]);
  const upcoming = useMemo(() => nextMilestone(identity?.streak), [identity?.streak]);

  const build = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setGenerating(true);

    /*
     * 快照必须在**同步**的一小段时间内取到（缓冲会被清掉，见 worldSnapshot.js）。
     * 这里先取 dataURL，再异步解码成 Image —— 顺序不能反。
     */
    const snapshotDataUrl = hasWorldSnapshot("guardian") ? captureWorldSnapshot("guardian") : null;
    const image = await loadSnapshotImage(snapshotDataUrl);

    const ok = drawPostcard(canvas, {
      name: identity?.name,
      title: identity?.title,
      level: identity?.xpLevel,
      cefr: identity?.hasTest ? identity?.cefr : "",
      cefrTitle: identity?.hasTest ? identity?.cefrTitle : "",
      goal: identity?.goal ? `${identity?.goalEmoji || ""} ${identity.goal}` : "",
      streak: identity?.streak || 0,
      mastered: identity?.mastered || 0,
      themeName: theme?.name || "基础宇宙",
      accent: theme?.accent || "#e8c88a",
      planets,
      image,
      dateLabel: dateLabel(),
    });

    if (!ok) {
      setNotice("这个浏览器没能生成图片（Canvas2D 不可用），换个浏览器再试。");
      setGenerating(false);
      return;
    }

    setSource(image ? "live" : "procedural");
    try {
      setDataUrl(canvas.toDataURL("image/png"));
      setNotice("");
    } catch {
      setDataUrl(null);
      setNotice("图片导出被浏览器拦下了，换个浏览器再试。");
    }
    setGenerating(false);
  }, [identity, planets, theme]);

  useEffect(() => {
    build();
    /* planets/theme 变化时重画（例如刚学完一课回到首页） */
  }, [build]);

  const fileName = useMemo(() => {
    const safe = String(identity?.name || "thai-ai").replace(/[^\p{L}\p{N}_-]+/gu, "");
    return `thai-ai-world-${safe || "me"}-${new Date().toISOString().slice(0, 10)}.png`;
  }, [identity?.name]);

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const share = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "我的 ThaiAI 泰语世界",
          text: `Lv.${identity?.xpLevel || 1} · ${identity?.title || ""} · 连续学习 ${identity?.streak || 0} 天`,
        });
        return;
      }
      setNotice("这个浏览器不支持直接分享，用「保存图片」也一样。");
    } catch {
      /* 用户取消分享不算错误，不打扰 */
    }
  };

  return (
    <section className={`relative my-10 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-emerald-300/60">
            Share Your World
          </p>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">我的泰语世界 · 成就卡</h2>
          <p className="mt-1 text-[11px] text-white/40">
            用你真实的等级、连续天数与星系进度生成一张图。连续学习会在卡上留下印章。
          </p>
        </div>

        {/* 里程碑进度：没到 7 天时说清楚还差几天，而不是把功能藏起来 */}
        <div className="flex flex-wrap items-center gap-2">
          {milestone ? (
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold"
              style={{
                borderColor: `${milestone.color}55`,
                color: milestone.color,
                background: `${milestone.color}14`,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {milestone.label}
            </span>
          ) : null}
          {upcoming ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55">
              再连续学 {upcoming.remaining} 天 → {upcoming.label}
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55">
              三枚印章已集齐
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-black/40 p-3 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* 卡面预览 */}
          <div className="relative">
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50"
              style={{ aspectRatio: `${POSTCARD_WIDTH} / ${POSTCARD_HEIGHT}` }}
            >
              {dataUrl ? (
                <motion.img
                  key={dataUrl.slice(-24)}
                  src={dataUrl}
                  alt="我的泰语世界成就卡"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/35">
                  {generating ? "正在成图…" : "暂未生成"}
                </div>
              )}
            </div>

            {/* 真的 canvas 留在 DOM 里（尺寸 1×1），成图靠它；显示用上面的 img */}
            <canvas
              ref={canvasRef}
              width={POSTCARD_WIDTH}
              height={POSTCARD_HEIGHT}
              className="pointer-events-none absolute h-px w-px opacity-0"
              aria-hidden="true"
            />
          </div>

          {/* 说明 + 操作 */}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">卡上都有什么</p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-white/65">
              <li>
                <span className="text-white/85">守护者形象</span> —— 优先用你首页那尊真实 3D
                守护者的当前一帧；没有 WebGL 时程序化绘制（视觉语言一致）。
              </li>
              <li>
                <span className="text-white/85">学习星系</span> —— 与首页同一套编码：
                轨道半径 = 掌握度，金环 = 当前星球，琥珀环 = 进度最低的一块。
              </li>
              <li>
                <span className="text-white/85">真实数字</span> —— 等级、泰语等级、连续天数、
                掌握词汇、平均掌握度，全部来自服务端学习记录。
              </li>
              <li>
                <span className="text-white/85">
                  {milestone ? `${milestone.label} 印章` : "里程碑印章"}
                </span>{" "}
                —— 连续学习 7 / 30 / 100 天各盖一枚。
              </li>
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={download}
                disabled={!dataUrl}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.1] px-3.5 py-2 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.18] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                保存图片
              </button>
              <button
                type="button"
                onClick={share}
                disabled={!dataUrl}
                className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.09] disabled:opacity-40"
              >
                <Share2 className="h-3.5 w-3.5" />
                分享
              </button>
              <button
                type="button"
                onClick={build}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.09] disabled:opacity-40"
                title="守护者一直在呼吸与移动，重抓一帧会是一张略有不同的图"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                重抓一帧
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/35">
              <span className="flex items-center gap-1">
                <ImageDown className="h-3 w-3" />
                {POSTCARD_WIDTH}×{POSTCARD_HEIGHT} PNG
              </span>
              <span>
                守护者：{source === "live" ? "实时 3D 快照" : "程序化绘制（当前无 3D 画布）"}
              </span>
              {notice ? <span className="text-amber-200/80">{notice}</span> : null}
            </div>

            <p className="mt-3 text-[10px] leading-5 text-white/25">
              卡上的数字来自你的账号，图在你自己的浏览器里生成，不会上传到服务器。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
