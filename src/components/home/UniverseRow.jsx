// src/components/home/UniverseRow.jsx
//
// =========================================================
// 「我的学习宇宙」· 五颗真实图片星球（首页第二视觉中心）
// =========================================================
//
// 设计说明里这一块的要求很具体：
//   · 不是传统课程卡片 → 这里没有任何卡片容器，星球直接站在场景里
//   · 每个方向用**真实图片**做星球纹理 → public/planets/*.webp
//     素材全部来自项目里已有的真实照片（泰国海岸 / 迎宾人物 / 寺庙灯会 /
//     夜里水边的佛塔 / 曼谷河畔），没有一张是画的
//   · 透明轨道 + 粒子 + 微弱发光 + 小型卫星
//   · 当前节点翡翠发光、已完成金色、锁定降亮度
//
// 两处与设计稿不同，都是「没有的真实数据就不编」：
//
//  ① 星球下面不写 CEFR。CEFR 是**人**的等级（来自入学测试），不是星球的
//     属性；挂在星球上会让人以为「这颗星球就是 B1 难度」。这里换成真实的
//     「N/M 阶段 · X%」。
//  ② 锁是**真门禁**（2026-09-20 起）：锁定中的星球点不进去，并在标题栏
//     当场说明「先完成哪一阶段」——不是默默没反应，也不是带你进去。
//     判断来自 worldData 的 planet.locked / planet.unlockHint（单一数据源，
//     学习宇宙页的星系用的是同一组字段）。
//
// 手机：横向滑动探索（snap 滚动），不是把桌面压成两列。

import { useTheme } from "@/lib/ThemeContext";
import { inkForWorld } from "@/themes/worlds";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Lock, PlayCircle, Sparkles } from "lucide-react";

/** 星球 → 真实照片（压缩后的 webp，全部来自 public/planets） */
const PLANET_IMAGE = {
  foundation: "/planets/foundation.webp",
  speaking: "/planets/speaking.webp",
  culture: "/planets/culture.webp",
  media: "/planets/media.webp",
  professional: "/planets/professional.webp",
};

/** 照片的取景中心：让每个星球露出最能代表那个方向的那一块 */
const PLANET_FOCUS = {
  foundation: "object-center",
  speaking: "object-[50%_18%]",
  culture: "object-[50%_62%]",
  media: "object-[50%_40%]",
  professional: "object-[50%_70%]",
};

const STATE_SHORT = {
  done: { label: "已完成", Icon: CheckCircle2, tone: "text-[#e8c684]" },
  current: { label: "探索中", Icon: PlayCircle, tone: "text-emerald-200" },
  active: { label: "进行中", Icon: PlayCircle, tone: "text-emerald-200/85" },
  ahead: { label: "锁定中", Icon: Lock, tone: "text-white/45" },
  uncharted: { label: "锁定中", Icon: Lock, tone: "text-white/40" },
};

/* 锁：优先用 worldData 给的 locked；没有就用状态兜底 */
const isLocked = (planet) =>
  planet.locked ?? (planet.state === "ahead" || planet.state === "uncharted");

const lockHintOf = (planet) =>
  planet.unlockHint || "按学习路线的顺序解锁：先完成前面的阶段";

/** 星球外圈的配色：当前=翡翠、完成=暗金、锁定=灰（设计说明的三种状态） */
const ringColor = (planet) =>
  planet.state === "done"
    ? "rgba(232,198,132,0.75)"
    : isLocked(planet)
      ? "rgba(255,255,255,0.14)"
      : `${planet.accent}cc`;

export default function UniverseRow({ planets = [], onSelect, bare = false }) {

  /*
   * 强调色按世界调整后再用。
   * 这些是 inline style（CSS 重映射够不到），原色 #6ee7a8 / #8ab4ff 落在
   * 米白纸上实测对比度约 1.4，纸面主题下基本看不见。
   */
  const { world } = useTheme();
  const accentInk = React.useCallback(
    (c) => inkForWorld(c, world?.visualMode),
    [world?.visualMode]
  );
  /*
   * 点锁定星球时的即时反馈：在标题栏显示一句「先完成哪一阶段」。
   * 用定时器自动收掉（不占地方），不弹 toast（这里不是错误，只是顺序）。
   */
  const [lockHint, setLockHint] = useState(null);
  const hintTimer = useRef(null);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const flashLockHint = (planet) => {
    setLockHint(`${planet.cn} · ${lockHintOf(planet)}`);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setLockHint(null), 4200);
  };

  if (!planets.length) return null;

  return (
    <section
      id="universe"
      className={
        bare
          ? "relative scroll-mt-24 px-4 pb-3 pt-4 sm:px-5 lg:px-6 lg:pt-2"
          : "mt-4 scroll-mt-24 rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-4 shadow-lg shadow-black/20 backdrop-blur-xl sm:p-5"
      }
    >
      {/*
       * 可读性底色：这一行常常正好落在佛像胸前那块亮部上，
       * 小字直接躺在照片上会糊。给它一条极淡的纵向渐变，
       * 比把照片压暗来得干净。
       */}
      {bare ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-8px)] bg-gradient-to-b from-transparent via-[#050807]/28 to-[#050807]/58"
        />
      ) : null}

      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-black text-white sm:text-[19px]">
            我的学习宇宙
          </h2>
          <p className="mt-1 text-[11px] text-white/45">点击星球探索你的泰语旅程</p>
        </div>
        {lockHint ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-200/90">
            <Lock className="h-3 w-3" />
            {lockHint}
          </span>
        ) : (
          <span className="text-[10px] text-white/45">
            <span className="hidden sm:inline">当前阶段在最内圈发光 · </span>
            🔒 锁定中＝尚未解锁，需先完成当前阶段
          </span>
        )}
      </div>

      {/*
       * 手机：横向滑动（snap），一次看一颗，滑得动才有「探索星球」的感觉；
       * sm 以上：三列；lg 以上：一行五颗。
       */}
      <div className="relative -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
        {planets.map((planet, index) => {
          const meta = STATE_SHORT[planet.state] || STATE_SHORT.ahead;
          const locked = isLocked(planet);
          const todayActive = Boolean(planet.today?.active);
          const image = PLANET_IMAGE[planet.id];
          const isCurrent = planet.state === "current";

          return (
            <motion.button
              key={planet.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              /* 锁定 = 真门禁：不跳转，只当场说清楚怎么解锁 */
              onClick={() => {
                if (locked) {
                  flashLockHint(planet);
                  return;
                }
                onSelect?.(planet);
              }}
              aria-disabled={locked || undefined}
              title={
                locked ? `${planet.cn} · 尚未解锁 · ${lockHintOf(planet)}` : `进入 ${planet.cn}`
              }
              className={
                "group flex min-w-[132px] snap-start flex-col items-center gap-2 rounded-2xl p-1.5 transition " +
                (locked ? "cursor-not-allowed" : "hover:bg-white/[0.03]")
              }
            >
              {/* 星球 + 轨道 + 卫星 + 光晕 */}
              <span className="relative flex h-[116px] w-[116px] items-center justify-center sm:h-[124px] sm:w-[124px]">
                {/* 光晕：当前最亮，今天练过次之，锁定几乎不亮 */}
                <span
                  aria-hidden="true"
                  className="absolute inset-[6%] rounded-full blur-2xl transition"
                  style={{
                    background: `radial-gradient(circle, ${
                      planet.state === "done" ? "rgba(232,198,132,0.5)" : planet.glow
                    }, transparent 70%)`,
                    opacity: isCurrent ? 0.95 : todayActive ? 0.7 : locked ? 0.16 : 0.4,
                  }}
                />

                {/* 轨道：两圈极细的椭圆 */}
                <span
                  aria-hidden="true"
                  className="world-orbit absolute inset-[2%] rounded-full"
                  style={{
                    borderColor: ringColor(planet),
                    opacity: locked ? 0.28 : 0.55,
                    transform: "rotate(-18deg)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="world-orbit absolute inset-[16%] rounded-full"
                  style={{
                    borderColor: locked ? "rgba(255,255,255,0.08)" : `${planet.accent}55`,
                    opacity: locked ? 0.3 : 0.6,
                    transform: "rotate(24deg)",
                  }}
                />

                {/* 小型卫星：外圈轨道上的一个点（今天练过会亮） */}
                <span
                  aria-hidden="true"
                  className={`world-satellite absolute h-1.5 w-1.5 rounded-full ${
                    todayActive ? "world-today-dot" : ""
                  }`}
                  style={{
                    left: "6%",
                    top: "34%",
                    background: locked ? "rgba(255,255,255,0.35)" : planet.accent,
                    boxShadow: locked ? "none" : `0 0 8px ${planet.glow}`,
                  }}
                />

                {/* 真实照片星球 */}
                <span
                  className="relative h-[88px] w-[88px] overflow-hidden rounded-full border sm:h-[96px] sm:w-[96px]"
                  style={{
                    borderColor: ringColor(planet),
                    boxShadow: isCurrent
                      ? `0 0 28px ${planet.glow}, inset 0 0 18px rgba(0,0,0,0.55)`
                      : "inset 0 0 16px rgba(0,0,0,0.6)",
                  }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.06] ${
                        PLANET_FOCUS[planet.id] || "object-center"
                      }`}
                      style={{
                        /* 素材本身是夜景，锁定时降到 .5 已经足够「暗」，
                           再低就变成黑圆球，看不出那是哪一颗星球了 */
                        filter: locked
                          ? "brightness(0.5) saturate(0.6)"
                          : isCurrent
                            ? "brightness(1.22) saturate(1.1)"
                            : "brightness(1.02) saturate(0.95)",
                      }}
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center font-viaoda text-[26px]"
                      style={{ color: accentInk(planet.accent) }}
                    >
                      {planet.glyph}
                    </span>
                  )}

                  {/* 球面高光：让照片看起来是个球，不是贴了个圆 */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 38%, transparent 62%), radial-gradient(circle at 70% 78%, rgba(0,0,0,0.5), transparent 60%)",
                    }}
                  />

                  {/* 锁：只是视觉（按钮仍可点） */}
                  {locked ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-black/70">
                        <Lock className="h-3 w-3 text-white/60" />
                      </span>
                    </span>
                  ) : null}
                </span>

                {/* 今天练过 */}
                {todayActive ? (
                  <span
                    className="absolute left-0 top-1 rounded-full border px-1.5 py-[1px] text-[9px] font-bold backdrop-blur-md"
                    style={{
                      borderColor: `${planet.accent}66`,
                      background: "rgba(0,0,0,0.6)",
                      color: accentInk(planet.accent),
                    }}
                  >
                    今日
                  </span>
                ) : null}
              </span>

              <span className="min-w-0 text-center">
                <span className="block truncate text-[12.5px] font-bold text-white/90">
                  {planet.cn}
                </span>
                <span className="mt-1 flex items-center justify-center gap-1 text-[10px]">
                  <meta.Icon className={`h-3 w-3 ${meta.tone}`} />
                  <span className={meta.tone}>{meta.label}</span>
                </span>
                <span className="mt-0.5 block text-[10px] text-white/45">
                  {planet.stageCount > 0
                    ? `${planet.doneCount}/${planet.stageCount} 阶段 · ${planet.progress}%`
                    : "不在当前路线"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect?.({ to: "/plan", cn: "学习路线" })}
        className="relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/55 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:bg-black/70 hover:text-white"
      >
        <Sparkles className="h-3.5 w-3.5 text-emerald-300/70" />
        查看完整学习路线
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
