// src/components/world/AITeacherSpace.jsx
//
// =========================================================
// AI 老师空间（不是聊天窗，是一间教室）
// =========================================================
//
// 首页唯一一处在页面流里的「老师」板块（原来首页还内嵌过一个 <AITeacher />
// 聊天窗，已撤掉 —— 真要开口练习/打字提问去 /conversation，佛像本身也是入口）：
//   这里 = 学生进来「看状态、听老师说、接今天的任务」，是一个空间与氛围
//   对话室 = 真要开口练习/打字提问时用的工具面板
//
// 三件事：
//   ① 声波   —— 真的麦克风波形（AnalyserNode）。点「让老师听你说」才请求
//                权限（不自动弹窗）；拒绝或不可用时退回模拟波形，功能不残废
//   ② 情绪   —— 由真实数据推导（连续天数 / 今日完成度 / 正确率 / 词量），
//                不是随机表情：老师的态度随你的状态变
//   ③ 建议   —— 由外部传入（首页把今日任务与 AI 推荐放进来），保证与
//                /plan 同源、点击可直达，不在这里另造一套数据
//
// 性能：canvas 用 requestAnimationFrame，但离屏 / 标签页隐藏 / 减弱动效时
// 自动停帧（与 WebGL 场景同一套原则）。
// =========================================================

import { useTheme } from "@/lib/ThemeContext";
import { inkForWorld } from "@/themes/worlds";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crown,
  MessageCircle,
  Mic,
  MicOff,
  Sparkles,
  Waves,
} from "lucide-react";

import { getAiTeacherQuota } from "@/api/aiTeacher";
import { useAuth } from "@/lib/AuthContext";
import { useWorldQuality } from "./WorldStage";

/* =========================================================
   情绪推导（纯函数，便于测试）
========================================================= */

export function deriveEmotion({ mastered = 0, streak = 0, todayRatio = 0, accuracy = 0 }) {
  if (mastered <= 0 && streak <= 0) {
    return {
      key: "waiting",
      emoji: "🌱",
      label: "静候",
      color: "#8ab4ff",
      line: "我在这儿等你开口。先学几个词，我们就正式开始。",
    };
  }
  if (todayRatio >= 1) {
    return {
      key: "celebrating",
      emoji: "🎉",
      label: "欣喜",
      color: "#e8c88a",
      line: "今天的计划打满了。要不要再多练一组？你现在状态很好。",
    };
  }
  if (accuracy > 0 && accuracy < 60) {
    return {
      key: "careful",
      emoji: "🧐",
      label: "专注纠错",
      color: "#ffd27d",
      line: "正确率还不太稳。我们慢一点，把错的那几个词拆开再读一遍。",
    };
  }
  if (streak >= 3) {
    return {
      key: "encouraging",
      emoji: "💪",
      label: "鼓励",
      color: "#6ee7a8",
      line: `你已经连续 ${streak} 天了，最难的阶段过去了。保持这个节奏。`,
    };
  }
  return {
    key: "focused",
    emoji: "🎧",
    label: "陪伴练习",
    color: "#c3a6ff",
    line: "按你的画像，今天适合先把词汇与听力过一遍，再开口。",
  };
}

/* =========================================================
   声波画布
========================================================= */

function WaveCanvas({ listening, analyser, active, accent }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      /* 取真实频谱；没有麦克风时用合成波形（安静但活着） */
      let data = null;
      if (listening && analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        data = buffer;
      }

      const bars = 48;
      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
      const mid = height / 2;

      for (let i = 0; i < bars; i += 1) {
        let amplitude;
        if (data) {
          const index = Math.floor((i / bars) * (data.length * 0.62));
          amplitude = data[index] / 255;
        } else {
          phaseRef.current += 0.012;
          const t = phaseRef.current;
          amplitude =
            0.16 +
            Math.abs(Math.sin(i * 0.32 + t * 2.1)) * 0.22 +
            Math.abs(Math.sin(i * 0.11 - t * 1.3)) * 0.12;
        }

        const h = Math.max(2, amplitude * height * 0.86);
        const x = i * (barWidth + gap);
        const y = mid - h / 2;

        ctx.globalAlpha = data ? 0.95 : 0.42;
        ctx.fillStyle = accent;
        const radius = Math.min(barWidth / 2, 2.5);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, h, radius);
        } else {
          ctx.rect(x, y, barWidth, h);
        }
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, listening, analyser, accent]);

  return <canvas ref={canvasRef} className="h-16 w-full" aria-hidden="true" />;
}

/* =========================================================
   主体
========================================================= */

export default function AITeacherSpace({
  identity,
  progress,
  guidance = null,
  className = "",
  /* 免费额度用完时的升级入口（由首页传入，打开 VipPanel） */
  onUpgrade = null,
}) {

  /*
   * 强调色按世界调整后再用。
   * 这些是 inline style（CSS 重映射够不到），原色 #6ee7a8 / #8ab4ff 落在
   * 米白纸上实测对比度约 1.4，纸面主题下基本看不见。
   * 用 visualMode（真正画出来的世界）而不是 world：浅色模式下用户选的
   * 可能是 night 世界，实际渲染的却是纸本，取错就会把浅色字放上白底。
   */
  const { visualMode } = useTheme();
  const accentInk = React.useCallback(
    (c) => inkForWorld(c, visualMode),
    [visualMode]
  );
  const isPaper = visualMode === "paper";
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isVip = !!user?.isVip;

  const quality = useWorldQuality();
  const [listening, setListening] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [micError, setMicError] = useState("");
  const [analyser, setAnalyser] = useState(null);
  const [inView, setInView] = useState(true);

  /*
   * 今日 AI 对话额度。
   * 教室是「今天还能练什么」的地方，额度必须在这里看得见 —— 不然免费用
   * 户只会在对话室里撞到 429，更不知道 VIP 与免费差在哪。
   * 依赖 progress：练完一项就会被上层重建，顺带刷新额度。
   */
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    if (!token) {
      setQuota(null);
      return undefined;
    }

    let alive = true;

    const load = () => {
      getAiTeacherQuota()
        .then((res) => alive && setQuota(res?.data || null))
        .catch(() => {});
    };

    load();

    /* 从对话室回来 / 切回本标签页：额度可能已经变了 */
    const onVisible = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, progress]);

  const sectionRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const emotion = useMemo(
    () =>
      deriveEmotion({
        mastered: Number(progress?.total_vocabulary) || identity?.mastered || 0,
        streak: Number(progress?.learning_streak) || identity?.streak || 0,
        todayRatio: progress?.daily_goal
          ? Math.min(1, (progress?.today_words || 0) / progress.daily_goal)
          : 0,
        accuracy: Number(progress?.accuracy_rate) || 0,
      }),
    [progress, identity]
  );

  /* 离屏停帧：省电（手机滚动时尤其重要） */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stopListening = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
    setAnalyser(null);
    setListening(false);
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const startListening = async () => {
    if (listening) {
      stopListening();
      return;
    }
    if (requesting) return;
    setMicError("");
    setRequesting(true);

    /*
     * 权限弹窗可能永远不被回答（无头/内嵌 webview、系统层面已拒绝但
     * 不返回等），getUserMedia 的 Promise 会一直悬着。这里加超时，
     * 否则按钮会停在「没反应」的状态——比明确报错更让人困惑。
     */
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => {
            const error = new Error("getUserMedia timeout");
            error.name = "TimeoutError";
            reject(error);
          }, ms)
        ),
      ]);

    try {
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({ audio: true }),
        8000
      );
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const node = audioCtx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.75;
      source.connect(node);
      setAnalyser(node);
      setListening(true);
    } catch (error) {
      /* 用户拒绝 / 无麦克风 / 非 HTTPS / 弹窗无人应答：退回模拟波形，
         提示但不阻塞——声波与后续练习功能照常可用 */
      const reason =
        error?.name === "NotAllowedError"
          ? "麦克风权限被拒绝"
          : error?.name === "TimeoutError"
            ? "麦克风没有响应（权限弹窗未选择）"
            : "没能连上麦克风";
      setMicError(`${reason} —— 已切回模拟波形，练习功能照常可用。`);
      setListening(false);
      setAnalyser(null);
    } finally {
      setRequesting(false);
    }
  };

  /*
   * 情绪球的两种形态。
   * 深色世界：带光晕的夜球（暗底 + 彩雾）。
   * 纸面世界：**印章**（浅底 + 彩环）—— 原样的 rgba(6,10,14,0.9) 落在米白
   * 纸上就是一块近黑的墨饼，这是「深色资产在纸面发黑」的又一例。
   * 声波条同用 orbInk：canvas 是画上去的像素，拿不到主题的着色器重映射，
   * 原色 #8ab4ff 在白底上对比度只有 1.9，必须自己换墨色。
   */
  const orbInk = accentInk(emotion.color);

  /* 今日 AI 对话额度（未登录 / 读不到时为 null，不显示假数字） */
  const remaining = quota?.remainingToday ?? 0;
  const dailyLimit = quota?.freeChatDaily ?? 0;
  const orbBackground = isPaper
    ? `radial-gradient(circle at 34% 30%, ${orbInk}2e, rgba(255,252,245,0.95) 70%)`
    : `radial-gradient(circle at 34% 30%, ${emotion.color}55, rgba(6,10,14,0.9) 68%)`;
  const orbBorder = isPaper ? orbInk : `${emotion.color}66`;

  return (
    <section ref={sectionRef} className={`relative my-10 ${className}`}>
      <div className="mb-3 px-1">
        <p className="text-[10px] uppercase tracking-[0.36em] text-emerald-300/60">
          AI Teacher Space
        </p>
        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">AI 泰语教室</h2>
        <p className="mt-1 text-[11px] text-white/40">
          不是聊天窗：这里看老师的状态、听它今天的判断，然后直接开始练。
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-black/45 p-3 sm:p-5">
        {/* 教室氛围光：随老师情绪变色 */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-50 blur-3xl transition-colors duration-700"
          style={{ background: `${emotion.color}33` }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* ── 左：老师状态 ── */}
          <div className="flex flex-col items-center rounded-3xl border border-white/[0.06] bg-white/[0.02] px-4 py-5">
            {/* 情绪球 */}
            <motion.div
              animate={
                quality.reducedMotion
                  ? {}
                  : {
                      scale: [1, 1.045, 1],
                      boxShadow: isPaper
                        ? [
                            `0 0 0 1px ${orbInk}20, 0 6px 16px rgba(60,48,30,0.10)`,
                            `0 0 0 1px ${orbInk}40, 0 9px 22px rgba(60,48,30,0.15)`,
                            `0 0 0 1px ${orbInk}20, 0 6px 16px rgba(60,48,30,0.10)`,
                          ]
                        : [
                            `0 0 30px ${emotion.color}44`,
                            `0 0 46px ${emotion.color}77`,
                            `0 0 30px ${emotion.color}44`,
                          ],
                    }
              }
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl"
              style={{
                background: orbBackground,
                border: `1px solid ${orbBorder}`,
              }}
            >
              {emotion.emoji}
            </motion.div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: emotion.color, boxShadow: `0 0 8px ${emotion.color}` }}
              />
              <span className="text-[11px] font-semibold" style={{ color: accentInk(emotion.color) }}>
                AI 老师 · {emotion.label}
              </span>
            </div>

            <p className="mt-2 text-center text-[12px] leading-6 text-white/65">
              {emotion.line}
            </p>

            {/* 声波 */}
            <div className="mt-4 w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <Waves className="h-3 w-3" />
                  {listening ? "正在听你说" : "待机声波"}
                </span>
                <span className="text-[10px] text-white/30">
                  {listening ? "实时" : "模拟"}
                </span>
              </div>
              <WaveCanvas
                listening={listening}
                analyser={analyser}
                active={inView && !quality.reducedMotion}
                accent={orbInk}
              />
            </div>

            <button
              type="button"
              onClick={startListening}
              disabled={requesting}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-[12px] font-bold transition disabled:opacity-60 ${
                listening
                  ? "border-red-300/30 bg-red-400/[0.12] text-red-100 hover:bg-red-400/[0.2]"
                  : "border-emerald-300/25 bg-emerald-400/[0.1] text-emerald-100 hover:bg-emerald-400/[0.18]"
              }`}
            >
              {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {requesting ? "正在请求麦克风…" : listening ? "停止收音" : "让老师听你说"}
            </button>

            {micError ? (
              <p className="mt-2 text-center text-[10px] leading-5 text-yellow-200/70">
                {micError}
              </p>
            ) : null}

            {/* ── 今日额度 + 下一步 ──
                教室要能回答「今天还能问几次」与「下一步点哪」；
                额度来自 /ai/teacher/quota，与对话室的计数同一份 */}
            <div className="mt-3 w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] text-white/45">
                  {isVip ? (
                    <Crown className="h-3 w-3 text-yellow-300/80" />
                  ) : (
                    <MessageCircle className="h-3 w-3" />
                  )}
                  {isVip ? "VIP · 对话不限次数" : "今日 AI 对话额度"}
                </span>

                {quota && !isVip ? (
                  <span className="text-[10px] font-semibold text-white/70">
                    剩 {remaining} / {dailyLimit} 次
                  </span>
                ) : null}
              </div>

              {quota && !isVip ? (
                <>
                  {/* 额度点阵：已用的压暗、还剩的亮着（超过 12 次就不画点，免得一条长蛇） */}
                  {dailyLimit > 0 && dailyLimit <= 12 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from({ length: dailyLimit }).map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 w-4 rounded-full ${
                            index < remaining ? "bg-emerald-400/85" : "bg-slate-400/25"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-2 text-[10px] leading-5 text-white/45">
                    {remaining > 0
                      ? "练完一项少一次；VIP 不限次数，还能解开全部课时。"
                      : "今天的免费对话用完了，明天重置；开通 VIP 可以无限问。"}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[10px] leading-5 text-white/45">
                  {isVip
                    ? "全部课程与视频已解锁，随时开口。"
                    : "登录后老师会记住你，并显示每日额度。"}
                </p>
              )}

              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/conversation")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/[0.1] px-3 py-2 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.18]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  去对话室
                </button>

                {!isVip && quota && remaining <= 0 && onUpgrade ? (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.1] px-3 py-2 text-[11px] font-bold text-yellow-100 transition hover:bg-yellow-300/[0.18]"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    开通 VIP
                  </button>
                ) : null}
              </div>
            </div>

            {/* 老师手里的事实（不是装饰数字） */}
            <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
              {[
                { label: "掌握词汇", value: identity?.mastered ?? 0 },
                { label: "连续天数", value: identity?.streak ?? 0 },
                { label: "探索等级", value: `Lv.${identity?.xpLevel ?? 1}` },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-[13px] font-black text-white/90">{item.value}</div>
                  <div className="mt-0.5 text-[9px] text-white/35">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 右：今天的引导（首页注入，与 /plan 同源） ── */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300/80" />
              <span className="text-[11px] font-bold text-white/80">老师今天给你的安排</span>
            </div>
            {guidance || (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] text-white/35">
                还没有安排。做一次 AI 入学测试，老师会按你的等级与目标排今天的任务。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
