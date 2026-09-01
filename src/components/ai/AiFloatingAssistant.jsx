import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Mic,
  BookOpen,
  HelpCircle,
  MessageCircle,
  Target,
  X,
  Sparkles,
  Volume2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getAiTeacherMemory } from "@/api/aiTeacher";

/* =========================================================
   AI Floating Assistant · AiFloatingAssistant
   - 全站（MainLayout 内，已登录页面）右下角悬浮 AI 老师。
   - 呼吸动画 + 轻微光晕；AI 状态提示（idle / thinking / busy）。
   - 展开后快捷动作对接现有路由：口语、复习、解释、对话、今日学习。
   - 视觉高级克制、复用墨绿 glass 风格。
========================================================= */

const QUICK_PANEL_ACTIONS = [
  { id: "speaking", label: "练口语", desc: "开口练发音", icon: Mic, tone: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20", path: "/speaking" },
  { id: "review", label: "帮我复习", desc: "看错题生词", icon: BookOpen, tone: "text-amber-200 bg-amber-300/10 border-amber-300/20", path: "/wrong-notebook" },
  { id: "explain", label: "解释这个词", desc: "输入想弄懂的表达", icon: HelpCircle, tone: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20", path: null },
  { id: "chat", label: "和我聊天", desc: "自由对话", icon: MessageCircle, tone: "text-pink-300 bg-pink-400/10 border-pink-300/20", path: "/conversation" },
  { id: "plan", label: "给我安排学习", desc: "今天学什么", icon: Target, tone: "text-yellow-200 bg-yellow-300/10 border-yellow-300/20", path: "/loop" },
];

export default function AiFloatingAssistant() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | thinking | busy
  const [greeting, setGreeting] = useState("有什么我可以帮你？");
  const [explainMode, setExplainMode] = useState(false);
  const [explainText, setExplainText] = useState("");
  const panelRef = useRef(null);
  const greetModalRef = useRef(null);

  const name = user?.nickname || "";

  /* 打开时动态读画像生成开场白 */
  const openPanel = () => {
    setOpen(true);
    setStatus("thinking");
    setGreeting("阿泰想了一下…");
    setExplainMode(false);
    getAiTeacherMemory()
      .then((r) => {
        const m = r?.data?.memory || null;
        if (m?.mistakes?.length) {
          setGreeting(`我注意到你最近常在「${m.mistakes.slice(0, 2).join("、")}」上出错，要练练吗？`);
        } else if (m?.level) {
          setGreeting(`根据你的 ${m.level} 水平，我准备好了今天的练习，开始吧？`);
        } else if (name) {
          setGreeting(`${name}，今天想学点什么？我在这里。`);
        } else {
          setGreeting("有什么我可以帮你？");
        }
      })
      .catch(() => setGreeting("有什么我可以帮你？"))
      .finally(() => setStatus("idle"));
  };

  const close = () => {
    setOpen(false);
    setExplainMode(false);
    setExplainText("");
    setStatus("idle");
  };

  const runAction = (action) => {
    if (action.path) {
      setStatus("busy");
      setOpen(false);
      navigate(action.path);
      return;
    }
    if (action.id === "explain") {
      setExplainMode(true);
      setExplainText("");
      setStatus("idle");
    }
  };

  const submitExplain = (e) => {
    e.preventDefault();
    const t = explainText.trim();
    if (!t) return;
    setOpen(false);
    setExplainMode(false);
    // 词义解释在对话页由 AI 老师解答（游客会按现有权限跳登录）
    navigate(`/conversation?q=${encodeURIComponent(t)}`);
  };

  /* 点击外部关闭 */
  useEffect(() => {
    const onDocClick = (ev) => {
      if (panelRef.current && !panelRef.current.contains(ev.target)) {
        setOpen(false);
        setExplainMode(false);
        setStatus("idle");
      }
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  /* 未登录点开时提示（MainLayout 已鉴权，兜底） */
  const handleToggle = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (open) close();
    else openPanel();
  };

  const statusLabel =
    status === "busy"
      ? "正在带你过去…"
      : status === "thinking"
      ? "Thinking…"
      : "空闲 · 随时可以问我";

  return (
    <div ref={panelRef} className="fixed bottom-24 right-4 z-[70] flex flex-col items-end gap-3 md:bottom-8 md:right-6">
      {/* 面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-[300px] overflow-hidden rounded-3xl border border-emerald-300/[0.14] bg-[#0b1816]/90 shadow-2xl shadow-black/50 backdrop-blur-2xl"
          >
            {/* 头部：AI 状态 */}
            <div className="border-b border-white/[0.06] bg-emerald-400/[0.05] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10">
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                  <Brain className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">AI 泰语老师 · 阿泰</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/40">
                    {status === "busy" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
                    ) : status === "thinking" ? (
                      <Volume2 className="h-3 w-3 animate-pulse text-emerald-300" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                    {statusLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="关闭"
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 开场白 */}
            <div className="px-4 pt-3">
              <motion.p
                key={greeting}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl rounded-bl-md border border-emerald-300/[0.1] bg-emerald-400/[0.05] px-3.5 py-2.5 text-[13px] leading-5 text-white/80"
              >
                {greeting}
              </motion.p>
            </div>

            {/* 快捷动作 */}
            {!explainMode ? (
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                {QUICK_PANEL_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => runAction(a)}
                      className="group flex flex-col items-start gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.06]"
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${a.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold text-white/90">{a.label}</span>
                      <span className="text-[10px] leading-3 text-white/30">{a.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={submitExplain} className="px-4 py-3">
                <p className="mb-2 text-xs text-white/45">想查哪个词 / 句子？告诉我，老师在对话里为你解释。</p>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={explainText}
                    onChange={(e) => setExplainText(e.target.value)}
                    placeholder="例如：กินข้าว"
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/40"
                  />
                  <button
                    type="submit"
                    aria-label="提问"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-[#061513] transition hover:bg-emerald-300"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 悬浮按钮 */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="AI 老师"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/25 bg-gradient-to-br from-[#0e241f] to-[#0a1615] shadow-xl shadow-emerald-400/10 transition hover:scale-105 active:scale-95"
      >
        {/* 呼吸光晕 */}
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/[0.12] [animation-duration:2.8s]" style={{ pointerEvents: "none" }} />
        <span className="absolute -inset-1.5 -z-10 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/10 blur-md" style={{ pointerEvents: "none" }} />
        <Brain className="h-6 w-6 text-emerald-300 transition group-hover:text-emerald-200" />
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
      </button>
    </div>
  );
}