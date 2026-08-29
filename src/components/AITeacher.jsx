
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Volume2,
  Sparkles,
  ArrowUpRight,
  Mic2,
  Languages,
  Brain,
  CircleDot,
  Send,
  X,
  Loader2,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";

import { speakThai, stopThaiAudio, extractThaiText } from "@/lib/thaiSpeech";
import { askAiTeacher, getAiTeacherQuota, getAiTeacherMemory } from "@/api/aiTeacher";
import VipPanel from "@/components/common/VipPanel";

export default function AITeacher() {
  const [view, setView] = useState("promo");
  const [mode, setMode] = useState("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState(null); // { freeChatDaily, usedToday, remainingToday, isVip }
  const [memory, setMemory] = useState(null); // { hasMemory, summary, memory }
  const [listening, setListening] = useState(false); // 语音输入（Web Speech API）
  const [voiceSupported] = useState(() =>
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
      ? true
      : false
  );
  const recognitionRef = useRef(null);
  const [vipOpen, setVipOpen] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ==========================================
  // 初始欢迎消息
  // ==========================================

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "สวัสดีครับ 👋\n你好，我是你的 AI 泰语老师。\n\n你可以直接问我泰语单词、语法、发音，也可以和我练习日常对话。",
      },
    ]);
  }, []);

  /* ==========================================
     拉取今日免费对话额度（未登录静默跳过）
  ========================================== */

  useEffect(() => {
    let cancelled = false;
    getAiTeacherQuota()
      .then((res) => {
        if (!cancelled) setQuota(res?.data || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vipOpen]);

  /* ==========================================
     拉取学生长期记忆（老师记得你）
  ========================================== */

  useEffect(() => {
    let cancelled = false;
    getAiTeacherMemory()
      .then((res) => {
        if (!cancelled) setMemory(res?.data || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vipOpen]);

  // ==========================================
  // 自动滚动
  // ==========================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // ==========================================
  // 展示卡 → 聊天（参考图卡片按钮）
  // ==========================================

  const startMode = (nextMode) => {
    setView("chat");
    setMode(nextMode);
    setError("");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  // 展示卡气泡发音

  const handleSpeakBubble = () => {
    if (speakingId === "promo") {
      stopThaiAudio();
      setSpeakingId(null);
      return;
    }

    speakThai("สวัสดีค่ะ", {
      rate: 0.8,
      onStart: () => setSpeakingId("promo"),
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });

    setSpeakingId("promo");
  };

  // ==========================================
  // 切换模式
  // ==========================================

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");

    if (nextMode === "chat") {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }

    if (nextMode === "pronunciation") {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }

    if (nextMode === "speaking") {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ==========================================
  // 模式信息
  // ==========================================

  const modeConfig = {
    chat: {
      title: "开始对话",
      placeholder: "输入你想问的泰语问题……",
      action: "chat",
      icon: MessageCircle,
    },

    pronunciation: {
      title: "发音练习",
      placeholder: "输入一个泰语词语或句子……",
      action: "pronunciation",
      icon: Volume2,
    },

    speaking: {
      title: "口语练习",
      placeholder: "输入你想练习的中文或泰语……",
      action: "speaking",
      icon: Mic2,
    },
  };

  const currentMode = modeConfig[mode];

  // ==========================================
  // 发送消息
  // ==========================================

  const handleSend = async () => {
    const text = input.trim();

    if (!text || loading) return;

    setError("");

    // ── 免费额度用尽：前端提前拦截，引导开通 VIP ──
    if (quota && !quota.isVip && quota.remainingToday <= 0) {
      setError(`今日免费对话次数已用完（${quota.freeChatDaily} 次），开通 VIP 即可无限与 AI 老师对话。`);
      setVipOpen(true);
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");
    setLoading(true);

    // 构建学生画像（名字 / 水平 / 学习天数 / 已掌握词汇）
    let profile = {};
    try {
      const user = JSON.parse(
        localStorage.getItem("thaiai_user") || "{}"
      );
      const prog = JSON.parse(
        localStorage.getItem("thai_ai_learning_progress") || "{}"
      );
      profile = {
        name: user.nickname || (user.email || "").split("@")[0] || "",
        level: prog.level_name || "",
        streak: prog.learning_streak || 0,
        mastered: prog.total_vocabulary || 0,
      };
    } catch {
      profile = {};
    }

    // 多轮上下文：最近 12 条对话历史
    const history = messages
      .filter(
        (m) => m.role === "user" || m.role === "assistant"
      )
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const result =
        await askAiTeacher({
          message: text,
          action: currentMode.action,
          profile,
          history,
        });

      const response =
        result?.data?.response || "";

      if (!response) {
        throw new Error(
          "AI 老师没有返回有效内容"
        );
      }

      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: response,
      };

      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);

      // 对话中老师可能记住了新信息，静默刷新记忆摘要
      getAiTeacherMemory()
        .then((res) => setMemory(res?.data || null))
        .catch(() => {});

      // 自动朗读回复中的泰语部分（语音回复）
      const thaiReply = extractThaiText(response);
      if (thaiReply) {
        const replyId = `${Date.now()}-assistant`;
        speakThai(thaiReply, {
          rate: 0.75,
          onStart: () => setSpeakingId(replyId),
          onEnd: () => setSpeakingId(null),
          onError: () => setSpeakingId(null),
        });
        setSpeakingId(replyId);
      }
    } catch (err) {
      console.error(
        "AI Thai Tutor error:",
        err
      );

      // 后端 429：免费额度用尽，弹 VIP 面板引导开通
      if (err?.response?.status === 429) {
        setError(
          err?.response?.data?.message ||
            "今日免费对话次数已用完，开通 VIP 即可无限练习。"
        );
        setQuota((q) =>
          q ? { ...q, remainingToday: 0 } : q
        );
        setVipOpen(true);
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "AI 老师暂时没有回应，请稍后再试。"
        );
      }
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // ==========================================
  // Enter 发送
  // ==========================================

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // ==========================================
  // 播放泰语
  // ==========================================

  const handleSpeak = (text, id) => {
    if (!text) return;

    if (speakingId === id) {
      stopThaiAudio();
      setSpeakingId(null);
      return;
    }

    // 只朗读泰语部分（回复中混合了中文讲解）
    const thaiPart = extractThaiText(text) || text;

    speakThai(thaiPart, {
      rate: 0.78,
      onStart: () => setSpeakingId(id),
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });

    setSpeakingId(id);
  };

  // ==========================================
  // 语音输入（Web Speech API，th-TH）
  // ==========================================

  const toggleVoiceInput = () => {
    if (!voiceSupported) {
      setError("当前浏览器不支持语音输入，请使用 Chrome / Edge 访问。");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "th-TH";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      const current = (final || interim).trim();
      if (current) {
        setInput(current);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("无法使用麦克风，请在浏览器设置中允许访问。");
      } else if (event.error === "no-speech") {
        setError("没有听到声音，请再试一次。");
      }
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("语音识别启动失败，请重试。");
    }
  };

  /* 卸载时停止识别 */
  useEffect(() => () => {
    recognitionRef.current?.stop();
    stopThaiAudio();
  }, []);


  // ==========================================
  // 清空对话
  // ==========================================

  const handleClear = () => {
    stopThaiAudio();
    setSpeakingId(null);
    setError("");

    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "สวัสดีครับ 👋\n你好，我是你的 AI 泰语老师。\n\n我们重新开始吧。你可以问我任何泰语问题。",
      },
    ]);
  };

  return (
    <section
      className="
        relative
        flex
        h-full
        flex-col
        overflow-hidden
        rounded-[28px]
        border
        border-white/[0.08]
        bg-[#061513]/75
        shadow-[0_30px_120px_rgba(0,0,0,.38)]
        backdrop-blur-2xl
      "
    >
      {/* ========================================
          背景氛围
      ======================================== */}

      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.08, 0.14, 0.08],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          pointer-events-none
          absolute
          -right-32
          -top-32
          h-[420px]
          w-[420px]
          rounded-full
          bg-emerald-400
          blur-[120px]
        "
      />

      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.05, 0.10, 0.05],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          pointer-events-none
          absolute
          -bottom-40
          -left-24
          h-[380px]
          w-[380px]
          rounded-full
          bg-yellow-400
          blur-[120px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-40
        "
      >
        <StarDot className="left-[8%] top-[18%]" />
        <StarDot className="left-[24%] top-[76%]" />
        <StarDot className="left-[43%] top-[12%]" />
        <StarDot className="right-[25%] top-[15%]" />
        <StarDot className="right-[10%] top-[40%]" />
        <StarDot className="right-[35%] bottom-[12%]" />
      </div>

      {view === "promo" ? (
        <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">

          {/* 背景：寺庙夜景（参考图素材） */}

          <img
            src="/thai-teacher-bg.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[80%_center] opacity-65"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061513]/70 via-[#061513]/20 to-[#061513]/50" />

          {/* 顶部 */}

          <div className="relative flex items-center justify-between">

            <div className="flex items-center gap-2.5">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10">
                <Sparkles className="h-4 w-4 text-yellow-300" />
              </div>

              <h2 className="text-base font-bold text-white">
                AI 泰语老师
              </h2>

              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-400/[0.06] px-2 py-0.5 text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                在线
              </span>

            </div>

            <span className="text-[10px] uppercase tracking-widest text-white/25">
              Thai Learning Companion
            </span>

          </div>

          {/* 画像 + 气泡 */}

          <div className="relative mt-5 flex flex-1 items-center gap-4 sm:gap-5">

            {/* 画像 */}

            <div className="relative w-24 shrink-0 sm:w-32">

              <div className="absolute -inset-1.5 rounded-[26px] bg-gradient-to-br from-yellow-300/35 via-emerald-300/15 to-yellow-300/35 opacity-70 blur-[6px]" />

              <img
                src="/thai-teacher-portrait.jpg"
                alt="AI 泰语老师"
                className="relative aspect-[3/4] w-full rounded-3xl border border-yellow-300/25 object-cover shadow-xl shadow-black/40"
              />

              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/25 bg-[#061513] text-[10px]">
                ✨
              </span>

            </div>

            {/* 气泡 */}

            <div className="min-w-0 flex-1 space-y-2.5">

              <div className="rounded-2xl rounded-tl-md border border-emerald-300/[0.10] bg-white/[0.045] px-4 py-2.5 backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">
                    สวัสดีค่ะ
                  </span>

                  <button
                    type="button"
                    onClick={handleSpeakBubble}
                    aria-label="播放泰语"
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/20"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-white/45">你好呀!</p>
              </div>

              <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 backdrop-blur-md">
                <p className="text-sm text-white/85">今天想学习什么呢?</p>
                <p className="mt-0.5 text-xs text-white/40">我可以帮你练习口语、发音、词汇～</p>
              </div>

            </div>

          </div>

          {/* 按钮 */}

          <div className="relative mt-5 flex flex-wrap gap-2.5">

            <button
              type="button"
              onClick={() => startMode("chat")}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:-translate-y-0.5 hover:shadow-emerald-400/20"
            >
              <MessageCircle className="h-4 w-4" />
              开始对话
            </button>

            <button
              type="button"
              onClick={() => startMode("pronunciation")}
              className="flex items-center gap-2 rounded-xl border border-yellow-300/20 bg-black/25 px-5 py-2.5 text-sm font-semibold text-yellow-200/90 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-yellow-300/35 hover:bg-black/35"
            >
              <Volume2 className="h-4 w-4" />
              发音练习
            </button>

          </div>

        </div>
      ) : (
        <>

      {/* ========================================
          顶部
      ======================================== */}

      <div
        className="
          relative
          z-20
          flex
          items-center
          justify-between
          border-b
          border-white/[0.07]
          px-5
          py-4
          sm:px-6
        "
      >
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-emerald-300/15
              bg-emerald-400/10
            "
          >
            <Sparkles className="h-5 w-5 text-yellow-300" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white">
                AI 泰语老师
              </h2>

              <span
                className="
                  flex
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-emerald-300/10
                  bg-emerald-400/[0.06]
                  px-2
                  py-0.5
                  text-[10px]
                  text-emerald-300
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    animate-pulse
                    rounded-full
                    bg-emerald-400
                  "
                />
                在线
              </span>
            </div>

            <p className="mt-0.5 text-[11px] text-white/30">
              Your personal Thai learning companion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() => setView("promo")}
            title="返回"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.03]
              text-white/35
              transition
              hover:border-white/15
              hover:bg-white/[0.06]
              hover:text-white
            "
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            title="清空对话"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.03]
              text-white/35
              transition
              hover:border-white/15
              hover:bg-white/[0.06]
              hover:text-white
            "
          >
            <RotateCcw className="h-4 w-4" />
          </button>

        </div>
      </div>

      {/* ========================================
          免费对话配额条（chat 视图顶部）
      ======================================== */}

      {quota && (
        <div className="relative z-20 px-5 pt-3 sm:px-6">
          {quota.isVip ? (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.06] px-3.5 py-2 text-xs text-yellow-100/90">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
              VIP 会员 · 与 AI 老师无限对话
            </div>
          ) : quota.remainingToday > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3.5 py-2 text-xs text-emerald-100/85">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                今日免费剩余
                <b className="text-emerald-100">
                  {quota.remainingToday}
                </b>
                / {quota.freeChatDaily} 次对话
              </span>
              <button
                type="button"
                onClick={() => setVipOpen(true)}
                className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2.5 py-0.5 text-[11px] text-yellow-200 transition hover:bg-yellow-300/20"
              >
                升级 VIP 无限练
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.07] px-3.5 py-2 text-xs text-yellow-100/90">
              <span>今日免费次数已用完 · 开通 VIP 无限对话</span>
              <button
                type="button"
                onClick={() => setVipOpen(true)}
                className="rounded-full border border-yellow-300/40 bg-yellow-300/15 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-100 transition hover:bg-yellow-300/25"
              >
                开通 VIP
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================
          老师记得你（学生长期记忆徽章）
      ======================================== */}

      {memory?.hasMemory && (
        <div className="relative z-20 flex items-center gap-2 px-5 pt-3 sm:px-6">
          <div className="flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-3 py-1.5">
            <Sparkles className="h-3 w-3 text-violet-300" />
            <span className="text-[11px] text-violet-200/80">
              老师记得你 · {memory.summary}
            </span>
          </div>
        </div>
      )}

      {/* ========================================
          模式按钮
      ======================================== */}

      <div
        className="
          relative
          z-20
          flex
          flex-wrap
          gap-2
          px-5
          pt-4
          sm:px-6
        "
      >
        <ModeButton
          active={mode === "chat"}
          icon={MessageCircle}
          text="开始对话"
          onClick={() =>
            handleModeChange("chat")
          }
        />

        <ModeButton
          active={mode === "pronunciation"}
          icon={Volume2}
          text="发音练习"
          onClick={() =>
            handleModeChange(
              "pronunciation"
            )
          }
        />

        <ModeButton
          active={mode === "speaking"}
          icon={Mic2}
          text="口语练习"
          onClick={() =>
            handleModeChange("speaking")
          }
        />
      </div>

      {/* ========================================
          欢迎提示
      ======================================== */}

      <AnimatePresence>
        {messages.length <= 1 && !loading && (
          <motion.div
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="
              relative
              z-10
              mx-5
              mt-4
              rounded-2xl
              border
              border-emerald-300/[0.08]
              bg-black/[0.16]
              p-4
              sm:mx-6
            "
          >
            <div className="flex gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-emerald-400/10
                "
              >
                <Languages className="h-4 w-4 text-emerald-300" />
              </div>

              <div>
                <p className="text-sm font-semibold text-yellow-200">
                  สวัสดีครับ 👋
                </p>

                <p className="mt-1 text-xs leading-5 text-white/45">
                  {mode === "chat"
                    ? "直接问我泰语问题，或者和我聊几句泰语。"
                    : mode ===
                      "pronunciation"
                    ? "输入一个泰语词语，我帮你分析发音。"
                    : "输入一句话，我们一起练习自然的泰语表达。"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================
          消息区域
      ======================================== */}

      <div
        className="
          relative
          z-10
          mt-4
          max-h-[390px]
          min-h-[210px]
          overflow-y-auto
          px-5
          pb-3
          sm:px-6
        "
      >
        <div className="space-y-3">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              speaking={
                speakingId === message.id
              }
              onSpeak={() =>
                handleSpeak(
                  message.content,
                  message.id
                )
              }
            />
          ))}

          {/* AI 思考 */}

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                }}
                className="flex items-center gap-3"
              >
                <div
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-emerald-300/10
                    bg-emerald-400/10
                  "
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                </div>

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-2xl
                    rounded-tl-md
                    border
                    border-white/[0.06]
                    bg-white/[0.035]
                    px-4
                    py-3
                  "
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />

                  <span className="text-xs text-white/40">
                    AI 老师正在思考……
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ========================================
          错误提示
      ======================================== */}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{
              opacity: 0,
              y: 5,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 5,
            }}
            className="
              relative
              z-20
              mx-5
              mb-2
              flex
              items-center
              justify-between
              gap-3
              rounded-xl
              border
              border-red-300/10
              bg-red-400/[0.06]
              px-3
              py-2.5
              text-xs
              text-red-200/70
              sm:mx-6
            "
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-white/30 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================
          输入区域
      ======================================== */}

      <div
        className="
          relative
          z-20
          border-t
          border-white/[0.07]
          bg-black/[0.12]
          p-4
          sm:p-5
        "
      >
        <div
          className="
            flex
            items-end
            gap-2
            rounded-2xl
            border
            border-white/[0.08]
            bg-white/[0.035]
            p-2
            shadow-inner
            shadow-black/20
            transition-all
            focus-within:border-emerald-300/25
            focus-within:bg-white/[0.05]
            focus-within:shadow-[0_0_30px_rgba(16,185,129,.06)]
          "
        >
          <motion.button
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            whileTap={{ scale: 0.92 }}
            title={listening ? "点击停止语音输入" : "语音输入（说泰语）"}
            className={
              listening
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/20 text-red-300 shadow-lg shadow-red-900/20"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 transition hover:border-emerald-300/20 hover:bg-emerald-400/[0.08] hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            }
          >
            {listening ? (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-400" />
              </span>
            ) : (
              <Mic2 className="h-4 w-4" />
            )}
          </motion.button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder={
              currentMode.placeholder
            }
            className="
              min-h-[42px]
              max-h-[120px]
              flex-1
              resize-none
              bg-transparent
              px-3
              py-2.5
              text-sm
              leading-5
              text-white
              outline-none
              placeholder:text-white/25
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          />

          <motion.button
            type="button"
            onClick={handleSend}
            disabled={
              loading ||
              !input.trim()
            }
            whileHover={{
              scale:
                loading ||
                !input.trim()
                  ? 1
                  : 1.04,
            }}
            whileTap={{
              scale:
                loading ||
                !input.trim()
                  ? 1
                  : 0.95,
            }}
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-gradient-to-br
              from-emerald-400
              via-teal-400
              to-emerald-500
              text-white
              shadow-lg
              shadow-emerald-900/30
              transition
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </motion.button>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-[10px] text-white/20">
            Enter 发送 · Shift + Enter 换行
            {listening && " · 🎤 正在听你说泰语..."}
          </span>

          <span className="text-[10px] text-white/20">
            {currentMode.title}
          </span>
        </div>
      </div>

      {/* ========================================
          底部光线
      ======================================== */}

      <div
        className="
          pointer-events-none
          absolute
          bottom-0
          left-[8%]
          right-[8%]
          h-px
          bg-gradient-to-r
          from-transparent
          via-emerald-300/20
          to-transparent
        "
      />

        </>
      )}

      {/* ========================================
          VIP 开通面板（免费额度用尽时）
      ======================================== */}

      <VipPanel
        open={vipOpen}
        onClose={() => setVipOpen(false)}
      />

    </section>
  );
}

// ============================================================
// 消息气泡
// ============================================================

function MessageBubble({
  message,
  speaking,
  onSpeak,
}) {
  const isUser =
    message.role === "user";

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.25,
      }}
      className={`flex ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={`flex max-w-[92%] items-end gap-2 ${
          isUser
            ? "flex-row-reverse"
            : ""
        }`}
      >
        {!isUser && (
          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-full
              border
              border-emerald-300/10
              bg-gradient-to-br
              from-emerald-400/15
              to-yellow-300/[0.05]
            "
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
          </div>
        )}

        <div>
          <div
            className={`
              whitespace-pre-wrap
              rounded-2xl
              px-4
              py-3
              text-sm
              leading-6
              ${
                isUser
                  ? `
                    rounded-br-md
                    bg-gradient-to-br
                    from-emerald-400
                    to-teal-500
                    text-white
                    shadow-lg
                    shadow-emerald-900/20
                  `
                  : `
                    rounded-bl-md
                    border
                    border-white/[0.06]
                    bg-white/[0.035]
                    text-white/75
                  `
              }
            `}
          >
            {message.content}
          </div>

          {!isUser && (
            <div className="mt-1.5 flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={onSpeak}
                className="
                  flex
                  items-center
                  gap-1.5
                  text-[10px]
                  text-white/25
                  transition
                  hover:text-emerald-300
                "
              >
                {speaking ? (
                  <>
                    <span className="flex items-end gap-[2px]">
                      <span className="h-2 w-[2px] animate-pulse rounded-full bg-emerald-300" />
                      <span
                        className="h-3.5 w-[2px] animate-pulse rounded-full bg-emerald-300"
                        style={{
                          animationDelay:
                            "120ms",
                        }}
                      />
                      <span
                        className="h-2.5 w-[2px] animate-pulse rounded-full bg-emerald-300"
                        style={{
                          animationDelay:
                            "240ms",
                        }}
                      />
                    </span>

                    正在播放
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3 w-3" />
                    朗读
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// 模式按钮
// ============================================================

function ModeButton({
  active,
  icon: Icon,
  text,
  onClick,
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{
        scale: 0.97,
      }}
      className={`
        flex
        items-center
        gap-2
        rounded-xl
        border
        px-3.5
        py-2
        text-xs
        font-medium
        transition-all
        ${
          active
            ? `
              border-emerald-300/20
              bg-emerald-400/10
              text-emerald-200
              shadow-[0_0_20px_rgba(16,185,129,.06)]
            `
            : `
              border-white/[0.07]
              bg-white/[0.025]
              text-white/40
              hover:border-white/[0.12]
              hover:bg-white/[0.05]
              hover:text-white/70
            `
        }
      `}
    >
      <Icon
        className={`h-3.5 w-3.5 ${
          active
            ? "text-emerald-300"
            : "text-white/30"
        }`}
      />

      {text}
    </motion.button>
  );
}

// ============================================================
// 星空粒子
// ============================================================

function StarDot({
  className,
}) {
  return (
    <motion.span
      animate={{
        opacity: [0.15, 0.75, 0.15],
        scale: [0.8, 1.15, 0.8],
      }}
      transition={{
        duration:
          3 +
          Math.random() * 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`
        absolute
        h-0.5
        w-0.5
        rounded-full
        bg-white
        shadow-[0_0_10px_rgba(255,255,255,.8)]
        ${className}
      `}
    />
  );
}
