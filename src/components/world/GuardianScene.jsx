// src/components/world/GuardianScene.jsx
//
// =========================================================
// 首页守护者场景（首页第一屏）
// =========================================================
//
// 这一块就是用户打开 ThaiAI 看到的东西：一尊真实的黑曜石佛像站在泰国寺庙
// 的夕阳里，左侧是问候，右侧是学习 HUD，底部是学习宇宙。
//
// 四条硬规矩（都来自设计说明）：
//
//  ① **佛像必须是真实照片。** 页面里没有任何几何体佛像，也没有第二尊：
//     佛像本身就是 AI 泰语老师。原来那尊程序化 3D 守护者已经从首页撤掉。
//  ② **UI 不许压住脸。** 佛像在画面中央偏右，HUD 全部落在它的两侧与上下，
//     并给自己留了右侧安全区（`--face-x/--face-y` 附近不放面板）。
//  ③ **景深是真的分层**：同一张照片，一层模糊铺满、一层清晰用椭圆遮罩浮
//     在上面 —— 不是把整张图调暗糊弄过去，佛像从背景里自然浮出来。
//  ④ **交互只碰光与粒子**：鼠标靠近脸部出现翡翠光晕与能量涟漪，光点随指针
//     轻微漂移，佛像本体不变形（它是一张照片，本来也变形不了）。
//
// 语音链路是真的：点右下角能量核心 → 开麦（波形读真实电平）→ 松手转写
// → 问老师 → 读出来。见 hooks/useGuardianVoice.js。

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AudioLines,
  Ear,
  Flame,
  Loader2,
  Mic,
  Sparkles,
  Sprout,
  Volume2,
  X,
  Zap,
} from "lucide-react";

import useGuardianVoice from "@/hooks/useGuardianVoice";

/* 灯笼光点：固定坐标 + 不同时长，省掉随机数带来的重新布局 */
const LANTERNS = [
  { x: 12, y: 18, s: 3, d: 9, o: 0.5 },
  { x: 26, y: 9, s: 2, d: 11, o: 0.42 },
  { x: 44, y: 15, s: 2.5, d: 10, o: 0.38 },
  { x: 62, y: 7, s: 2, d: 13, o: 0.45 },
  { x: 78, y: 12, s: 3, d: 8.5, o: 0.5 },
  { x: 88, y: 24, s: 2, d: 12, o: 0.36 },
  { x: 8, y: 42, s: 2, d: 14, o: 0.3 },
  { x: 70, y: 34, s: 2.5, d: 11.5, o: 0.4 },
  { x: 94, y: 46, s: 2, d: 10.5, o: 0.32 },
  { x: 34, y: 30, s: 2, d: 15, o: 0.28 },
];

/*
 * 莲座光尘：从莲座缓慢升起的一点点翡翠光点。
 * 只在上浮的下半段可见（CSS 控制透明度曲线），所以看起来是从光晕里
 * 飘起来而不是从画面中间浮出。同样固定坐标，不做随机。
 */
const LOTUS_MOTES = [
  { x: 38, s: 2.5, d: 7.5, delay: 0 },
  { x: 47, s: 2, d: 9, delay: -2.6 },
  { x: 55, s: 3, d: 8.4, delay: -4.8 },
  { x: 63, s: 2, d: 10.5, delay: -6.2 },
];

const PHASE_LABEL = {
  idle: null,
  listening: { text: "正在听你说", Icon: Ear, tone: "text-emerald-200" },
  thinking: { text: "老师在思考", Icon: Loader2, tone: "text-amber-200" },
  speaking: { text: "老师正在说", Icon: Volume2, tone: "text-[#e8c684]" },
};

function StatPill({ Icon, value, label, tone }) {
  return (
    <span
      title={label}
      className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/45 px-2.5 py-1.5 backdrop-blur-xl"
    >
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-[11px] font-bold text-white/85">{value}</span>
    </span>
  );
}

export default function GuardianScene({
  identity,
  dateWidget,
  onStartConversation,
  onPlacement,
  children,
}) {
  const sceneRef = useRef(null);
  const meterRef = useRef(null);
  const faceRef = useRef(false);

  const [nearFace, setNearFace] = useState(false);
  const [showReply, setShowReply] = useState(false);

  const voice = useGuardianVoice({ meterRef });
  const busy = voice.phase !== "idle";

  /* 有回复/错误就自动展开那块玻璃面板（说完了不用再点一次） */
  useEffect(() => {
    if (voice.reply || voice.error || voice.heard) setShowReply(true);
  }, [voice.reply, voice.error, voice.heard]);

  /* =====================================================
     指针：光晕跟随 + 靠近脸部时加能量涟漪
     全部写进 CSS 变量，不触发重渲染
  ===================================================== */
  const handlePointerMove = useCallback((event) => {
    const node = sceneRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    node.style.setProperty("--gx", `${x.toFixed(2)}%`);
    node.style.setProperty("--gy", `${y.toFixed(2)}%`);
    /* 视差：指针偏右，背景整体向左挪一点点（幅度很小，只为「有深度」） */
    node.style.setProperty("--px", `${((x - 50) / 50).toFixed(3)}`);
    node.style.setProperty("--py", `${((y - 50) / 50).toFixed(3)}`);

    /* 宽幅图里脸部落在画面中部偏左（约 47% / 高 26%）。
       桌面与窄屏都留余量，别让「靠近」变成彩蛋。 */
    const near = x > 33 && x < 62 && y > 10 && y < 42;
    if (near !== faceRef.current) {
      faceRef.current = near;
      setNearFace(near);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    faceRef.current = false;
    setNearFace(false);
  }, []);

  const phaseMeta = PHASE_LABEL[voice.phase];

  return (
    <section
      ref={sceneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="world-scene relative isolate overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#050807] shadow-2xl shadow-black/50 min-[1100px]:min-h-[100svh] min-[1100px]:rounded-none min-[1100px]:border-0"
      style={{ "--gx": "50%", "--gy": "38%", "--px": "0", "--py": "0" }}
    >
      {/* ================= 背景：同一张照片的两层（写真景深） ============== */}
      {/*
       * 构图（全身像版）：源图 1024×1536 竖幅全身像。
       *   窄屏：容器比源图更「瘦高」，cover 只裁横向 → 全身自然可见，
       *         object-position 42% 把佛像放在中间偏右。         *   桌面 ≥1100px：换用**专用宽幅合成图**（2000×1120）——竖幅源图在宽屏上
         *         无论怎么放都会两侧露空，所以桌面版是离线合成的：主体按高度等比放大
         *         （头冠到莲座完整，上下各留 7% 余量），整体放在画面中部偏左
         *         （右侧 22% 留给玻璃卡），四周用同一张照片的镜像重模糊景色铺满
         *         （浅景深），边界用双向渐变过渡。
       *         于是桌面端只需一层 cover 图就把整屏铺满，不再依赖运行时双层 + 遮罩。
       */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <picture>
          {/* 桌面：宽幅合成图（webp 优先，jpg 兜底） */}
          <source
            media="(min-width: 1100px)"
            srcSet="/images/thai-guardian-hero-wide.webp"
            type="image/webp"
          />
          <source
            media="(min-width: 1100px)"
            srcSet="/images/thai-guardian-hero-wide.jpg"
            type="image/jpeg"
          />
          {/* 手机 / 平板：竖幅原图 */}
          <source srcSet="/images/thai-guardian-hero.webp" type="image/webp" />
          <img
            src="/images/thai-guardian-hero.jpg"
            alt=""
            className="world-scene-subject absolute inset-0 h-full w-full object-cover object-[42%_8%]"
            fetchPriority="high"
            decoding="async"
            style={{
              transform:
                "translate3d(calc(var(--px) * -3px), calc(var(--py) * -2px), 0)",
            }}
          />
        </picture>

        {/* 外圈那一层：同一张图，模糊 + 只在外围可见（桌面端已烘进宽幅图，故隐藏） */}
        <img
          src="/images/thai-guardian-hero.webp"
          alt=""
          className="world-scene-dof absolute inset-0 h-full w-full object-cover object-[42%_8%] min-[1100px]:hidden"
          loading="lazy"
          decoding="async"
          style={{
            transform:
              "scale(1.05) translate3d(calc(var(--px) * -5px), calc(var(--py) * -3px), 0)",
          }}
        />

        {/*
         * 压暗：只剩文案底下这一条，而且很窄（~30% 就归零）。
         *
         * 原来这里有三层：左→右大渐变、上→下渐变、四角暗角。三层叠起来
         * 等于给佛像蒙了一层黑纱 —— 纵向那两层把头和莲座也一起压了。
         * 佛像必须看得见，这是这一屏的全部意义，所以：
         *   · 纵向压暗层与暗角**整层撤掉**（照片本身就有电影调色，不需要）
         *   · 只留文案底下这一条（佛像在画面 25%~75%，走到 30% 已经归零，
         *     等于它一像素都没被压到）
         * 文字的对比度改由 text-shadow 负责（见 .world-scene-copy）。
         */}
        <div className="world-scene-shade-r absolute inset-0" />
      </div>

      {/* ================= 莲座呼吸光 ============== */}
      {/*
       * 守护者设定：佛像结跏趺坐的莲座周期性地泛起一层翡翠光晕。
       * 位置对准照片里的莲座（桌面 contain + 底部对齐 → 莲座落在场景底缘
       * 居中；窄屏 cover 时莲座略偏右）。纯光晕，不覆盖照片本体，
       * 不改变佛像的形状与材质 —— 只是底部一次很慢的呼吸。
       */}
      <div className="world-lotus-layer pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="world-lotus-glow" />
        <span className="world-lotus-glow world-lotus-glow-inner" />
        <div className="world-lotus-motes">
          {LOTUS_MOTES.map((mote, index) => (
            <span
              key={index}
              className="world-lotus-mote"
              style={{
                left: `${mote.x}%`,
                width: `${mote.s}px`,
                height: `${mote.s}px`,
                animationDuration: `${mote.d}s`,
                animationDelay: `${mote.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ================= 灯笼与光尘 ============== */}
      <div className="world-lanterns pointer-events-none absolute inset-0" aria-hidden="true">
        {LANTERNS.map((dot, index) => (
          <span
            key={index}
            className="world-lantern"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: `${dot.s}px`,
              height: `${dot.s}px`,
              opacity: dot.o,
              animationDuration: `${dot.d}s`,
              animationDelay: `${index * 0.7}s`,
            }}
          />
        ))}
      </div>

      {/* ================= 互动光层：光晕 + 涟漪 + 脸部光环 ============== */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: nearFace ? 1 : 0.42 }}
      >
        <div className="world-pointer-glow absolute inset-0" />
      </div>

      {nearFace ? (
        <>
          <span aria-hidden="true" className="world-face-halo" />
          <span aria-hidden="true" className="world-ripple" />
        </>
      ) : null}

      {/* 佛像 = 老师：点它进对话室（全身像热区：覆盖头到胸口） */}
      <button
        type="button"
        onClick={onStartConversation}
        aria-label="和 AI 泰语老师说话"
        className="world-guardian-hot absolute cursor-pointer rounded-full opacity-0 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300/60"
      />

      {/* ================= 场景内容 ============== */}
      {/* 桌面满屏时内容列也跟着撑满，mt-auto 才有力气把星球行推到画面底缘 */}
      <div className="relative flex flex-col min-[1100px]:min-h-[100svh]">
        {/* 顶部 HUD：日期问候（保留） + 三个真实数字 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 pr-14 sm:p-5 sm:pr-16 lg:p-6 min-[1100px]:pr-6">
          {dateWidget}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatPill
              Icon={Flame}
              value={identity?.streak ?? 0}
              label={`连续学习 ${identity?.streak ?? 0} 天`}
              tone="text-orange-300"
            />
            <StatPill
              Icon={Zap}
              value={(identity?.xp ?? 0).toLocaleString("en-US")}
              label={`学习经验 ${identity?.xp ?? 0} XP`}
              tone="text-[#e8c684]"
            />
            <StatPill
              Icon={Sprout}
              value={identity?.mastered ?? 0}
              label={`掌握词汇 ${identity?.mastered ?? 0} 个`}
              tone="text-emerald-300"
            />
          </div>
        </div>

        {/*
         * 左侧文案。
         * 窄屏：靠底（佛像占据上方，文案压在它身前，与设计稿的手机版一致）；
         * lg 以上：落在佛像脸部之下（脸在 3%~25%），左侧留白干净、不遮脸。
         */}
        <div className="world-scene-copy mt-auto min-h-[280px] max-w-[560px] px-4 pb-5 pt-24 sm:min-h-[320px] sm:px-5 sm:pt-28 lg:mt-0 lg:min-h-0 lg:max-w-[430px] lg:px-6 lg:pb-12 lg:pt-6">
          <p className="font-viaoda text-[26px] leading-tight text-white/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[34px]">
            สวัสดีครับ
          </p>

          {/* 断行是构图的一部分：一行放不下就会伸到佛像脸上 */}
          <h1 className="mt-2 text-[25px] font-black leading-[1.25] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[30px] lg:text-[28px]">
            欢迎回来，
            <br />
            我的学习伙伴
          </h1>

          <p className="mt-3 max-w-[380px] text-[12.5px] leading-relaxed text-white/65 sm:text-[13.5px] lg:max-w-[340px]">
            每天，你的泰语世界都在成长。
            <br />
            让我们继续探索这个美丽的语言吧。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onStartConversation}
              className="group flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/[0.14] px-4 py-2.5 text-[12px] font-bold text-emerald-50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/[0.22]"
            >
              <AudioLines className="h-4 w-4 text-emerald-300 transition group-hover:scale-110" />
              让老师陪你开始今天的学习
            </button>

            {identity && !identity.hasTest ? (
              <button
                type="button"
                onClick={onPlacement}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#e8c684]" />
                做一次 AI 入学测试
              </button>
            ) : null}
          </div>
        </div>

        {/* 底部：学习宇宙（真实图片星球） + 小贴士 */}
        <div className="world-scene-bottom">{children}</div>
      </div>

      {/* ================= 老师状态：在听/思考/在说 ============== */}
      <div
        className={`pointer-events-none absolute right-4 top-[52%] z-20 flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-black/50 px-3 py-2 backdrop-blur-2xl transition-all duration-300 sm:right-6 ${
          phaseMeta ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        {phaseMeta ? (
          <>
            <span
              ref={meterRef}
              className="world-wave flex h-5 items-end gap-[2px]"
              style={{ "--lvl": "0" }}
              aria-hidden="true"
            >
              {[0.5, 1, 0.72, 1.24, 0.62].map((k, i) => (
                <span
                  key={i}
                  className="world-wave-bar"
                  style={{ "--k": k, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </span>
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${phaseMeta.tone}`}>
              <phaseMeta.Icon
                className={`h-3.5 w-3.5 ${voice.phase === "thinking" ? "animate-spin" : ""}`}
              />
              {phaseMeta.text}
            </span>
          </>
        ) : null}
      </div>

      {/* ================= 老师说了什么（玻璃面板，不遮脸） ============== */}
      {showReply && (voice.heard || voice.reply || voice.error) ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-[128px] right-4 z-20 w-[min(340px,calc(100%-2rem))] rounded-2xl border border-white/[0.08] bg-[#050807]/70 p-3.5 backdrop-blur-2xl sm:right-6"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/70">
              <Mic className="h-3 w-3" />
              和老师说的这一句
            </p>
            <button
              type="button"
              onClick={() => {
                setShowReply(false);
                voice.reset();
              }}
              className="rounded-md p-0.5 text-white/30 transition hover:text-white/70"
              aria-label="收起"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {voice.error ? (
            <p className="mt-2 text-[11.5px] leading-relaxed text-amber-200/85">{voice.error}</p>
          ) : (
            <>
              {voice.heard ? (
                <p className="mt-2 font-viaoda text-[13px] leading-relaxed text-white/80">
                  {voice.heard}
                </p>
              ) : null}
              {voice.reply ? (
                <p className="mt-2 text-[11.5px] leading-relaxed text-white/65">{voice.reply}</p>
              ) : null}
            </>
          )}
        </motion.div>
      ) : null}

      {/* ================= 右下角语音入口：绿色能量核心 ============== */}
      <button
        type="button"
        onClick={() => (voice.phase === "listening" ? voice.stop() : voice.start())}
        disabled={voice.phase === "thinking" || voice.phase === "speaking"}
        aria-label={voice.phase === "listening" ? "结束说话" : "和 AI 老师说话"}
        className={`world-core absolute bottom-5 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-xl transition sm:right-6 sm:h-16 sm:w-16 ${
          voice.phase === "listening"
            ? "border-emerald-300/50 bg-emerald-400/25"
            : "border-emerald-300/25 bg-emerald-400/[0.12] hover:border-emerald-300/45 hover:bg-emerald-400/[0.2]"
        } disabled:cursor-wait disabled:opacity-70`}
      >
        {voice.phase === "thinking" || voice.phase === "speaking" ? (
          <Loader2 className="h-5 w-5 animate-spin text-emerald-200" />
        ) : (
          <Mic
            className={`h-5 w-5 transition ${
              voice.phase === "listening" ? "text-emerald-100" : "text-emerald-300"
            }`}
          />
        )}
        <span aria-hidden="true" className="world-core-ring" />
      </button>
    </section>
  );
}
