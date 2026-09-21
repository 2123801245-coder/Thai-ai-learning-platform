// src/components/world/DigitalMuseum.jsx
//
// =========================================================
// 泰国数字博物馆（五个可走进去的展厅）
// =========================================================
//
// 这里不新造内容：展厅里的每一件「展品」都来自现有内容库
//   data/thaiCulture.js   → 文化条目（节日/美食/寺庙/礼仪/网络用语）
//   data/mediaLessons.js  → 媒体学习课（泰剧/歌曲/综艺/新闻/社交/文学）
// 展厅只是把同一个内容库按主题重新布展，所以点进去看到的标题是真东西。
//
// 交互：
//   顶部   五个展厅（走廊），点一下换厅（环境光、展品、文案整体切换）
//   中央   环境层 —— 鼠标/触摸移动时三层视差（CSS 3D 透视，不用 WebGL）
//   展品   真实条目，点进去到对应对的内容页
//   底部   两个入口：「走进去」到展厅主页；「说一句」到对应对话场景
//
// 进度只显示真的被记录过的数据（媒体课完成度）；文化条目没有阅读记录，
// 就只显示件数，不编一个 0% 出来。
//
// 主展厅：rooms 已由 worldData.buildMuseumRooms(mediaState, profile) 按画像
// 重排（命中画像的那一厅在最前面），本组件把 rooms[0].featured 当作主展厅：
// 默认展开它、给它一个「主展厅」徽标。所以同一个 URL，追剧的账号进门先
// 看到影视厅，商务的账号先看到生活方式厅。
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Compass, Footprints } from "lucide-react";

import { useWorldQuality } from "./WorldStage";

export default function DigitalMuseum({ rooms = [] }) {
  const navigate = useNavigate();
  const quality = useWorldQuality();
  const [activeId, setActiveId] = useState(() => rooms[0]?.id || null);
  const frameRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const active = useMemo(
    () => rooms.find((room) => room.id === activeId) || rooms[0] || null,
    [rooms, activeId]
  );

  /*
   * 主展厅换了就跟着换。
   *
   * 不做这件事会有一个很难发现、但一定会被用户撞上的 bug：
   * 重测入学测试（画像从「泰剧」改成「商务」）后，走廊顺序重排了、主展厅
   * 徽标也移到了新展厅，但详情面板的 activeId 是初值化的 state，不会自己
   * 变——用户看到的是「新主展厅被标了徽标，打开却是旧的影视厅」，而且
   * 「主展厅 · 为什么给你看这一厅」那句话永远不会出现。
   *
   * 只在主展厅**真的变了**时同步，所以用户自己点着看别的厅不会被抽走。
   */
  const featuredId = useMemo(
    () => rooms.find((room) => room.featured)?.id || null,
    [rooms]
  );
  const lastFeaturedRef = useRef(featuredId);
  useEffect(() => {
    if (featuredId && featuredId !== lastFeaturedRef.current) {
      lastFeaturedRef.current = featuredId;
      setActiveId(featuredId);
    }
  }, [featuredId]);

  if (!rooms.length || !active) return null;

  const interactive = !quality.reducedMotion;

  const handlePointerMove = (event) => {
    if (!interactive || quality.tier === "low") return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -7, y: px * 9 });
  };

  return (
    <section className="relative my-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-emerald-300/60">
            Thailand Digital Museum
          </p>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
            泰国数字博物馆
          </h2>
          <p className="mt-1 text-[11px] text-white/40">
            五个展厅，全部展品来自既有的文化与媒体内容库。挑一个走进去。
          </p>
          {active.featured ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: active.accent }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: active.accent }} />
              主展厅 · {active.featuredReason}
            </p>
          ) : null}
        </div>
        {active.progress !== null ? (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span className="text-[11px] text-white/60">
              本厅媒体课已学完 {active.mediaDone}/{active.mediaTotal}
            </span>
            <span className="text-[11px] font-bold" style={{ color: active.accent }}>
              {active.progress}%
            </span>
          </div>
        ) : (
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span className="text-[11px] text-white/50">
              本厅展出 {active.total} 件 · 文化条目
            </span>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-black/45">
        {/* ── 展厅走廊（五个厅的切换） ── */}
        <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-3 py-3 sm:px-4">
          {rooms.map((room) => {
            const isActive = room.id === active.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveId(room.id)}
                onMouseEnter={() => setActiveId(room.id)}
                className={`group relative flex min-w-[124px] flex-col items-start gap-1 rounded-2xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-white/25 bg-white/[0.07]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                }`}
                aria-pressed={isActive}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{room.emoji}</span>
                  <span className="text-[12px] font-bold text-white/90">{room.cn}</span>
                </span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-white/30">
                  {room.en}
                </span>
                {room.featured ? (
                  <span
                    className="absolute right-2 top-2 rounded-full px-1.5 py-[1px] text-[8px] font-bold"
                    style={{ background: `${room.accent}26`, color: room.accent }}
                  >
                    主展厅
                  </span>
                ) : null}
                <span
                  className="absolute inset-x-3 bottom-0 h-[2px] rounded-full transition"
                  style={{
                    background: isActive ? room.accent : "transparent",
                    boxShadow: isActive ? `0 0 10px ${room.accent}` : "none",
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* ── 环境（CSS 3D 视差） ── */}
        <div
          ref={frameRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
          className="relative"
          style={{ perspective: "1100px" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="relative px-3 py-5 sm:px-6 sm:py-7"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: "transform 220ms ease-out",
              }}
            >
              {/* 远景：环境光 + 巨型字形 */}
              <div
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  transform: "translateZ(-60px)",
                  background: `radial-gradient(70% 60% at 22% 18%, ${active.accent}2e, transparent 62%), radial-gradient(60% 60% at 84% 78%, ${active.accent}1a, transparent 66%), linear-gradient(180deg, rgba(6,10,12,0.2), rgba(4,7,10,0.75))`,
                }}
              />
              <div
                className="pointer-events-none absolute -right-2 top-0 -z-10 select-none text-[120px] font-black leading-none opacity-[0.07] sm:text-[190px]"
                style={{ transform: "translateZ(-30px)", color: active.accent }}
              >
                {active.th}
              </div>

              {/* 中景：展厅简介 + 真实展品 */}
              <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{active.emoji}</span>
                    <div>
                      <h3 className="text-lg font-black text-white">{active.cn}展厅</h3>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                        {active.en} · {active.th}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] leading-6 text-white/60">{active.blurb}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(active.to)}
                      className="group flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.1] px-3.5 py-2 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.18]"
                    >
                      <Footprints className="h-3.5 w-3.5" />
                      走进去
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    {active.scene ? (
                      <button
                        type="button"
                        onClick={() => navigate(active.scene.to)}
                        className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.09]"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        {active.scene.label}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/35">
                    <span>文化条目 {active.cultureCount} 件</span>
                    <span>媒体课 {active.mediaCount} 节</span>
                    <span>共 {active.total} 件</span>
                  </div>

                  {active.featured ? (
                    <p className="mt-2 text-[10px] text-white/30">
                      展厅顺序按你的画像排过——换个账号进来，主展厅就不是这一间。
                    </p>
                  ) : null}
                </div>

                {/* 展品：真实标题，点进去到对应内容 */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {active.samples.map((sample, index) => (
                    <motion.button
                      key={`${sample.kind}-${sample.id}`}
                      type="button"
                      onClick={() => navigate(active.to)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: index * 0.05 }}
                      className="group flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-black/35 px-3 py-2.5 text-left backdrop-blur-sm transition hover:border-white/20 hover:bg-black/50"
                    >
                      <span
                        className="mt-1 h-6 w-[3px] shrink-0 rounded-full"
                        style={{ background: active.accent, opacity: 0.75 }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] leading-5 text-white/85">
                          {sample.title}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-white/30">
                          {sample.kind === "media" ? "媒体课" : "文化条目"}
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 近景：暗角，把所有内容压进「展厅」里 */}
              <div
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  transform: "translateZ(30px)",
                  background:
                    "radial-gradient(120% 100% at 50% 50%, transparent 46%, rgba(0,0,0,0.55) 100%)",
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
