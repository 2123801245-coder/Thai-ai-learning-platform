import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Plane, Utensils, GraduationCap, ShoppingBag,
  Landmark, Briefcase, Sparkles, Send, Volume2, ArrowLeft, Bot,
  User, Info, ChevronRight, Star, Check, BookOpen, RotateCcw, Mic,
} from "lucide-react";
import { conversationScenes, CONVERSATION_CONFIG } from "@/data/conversations";
import { getConversationScenes } from "@/api/vocabulary";
import { ThaiRoof } from "@/components/common/ThaiMotifs";
import { ThaiCorner, ParticleField } from "@/components/common/ThaiDecor";
import { speakThai, stopThaiAudio } from "@/lib/thaiSpeech";

/* ── 场景图标 ── */
const sceneIcons = { MessageCircle, Plane, Utensils, GraduationCap, ShoppingBag, Landmark, Briefcase };

/* ── 星尘坐标 ── */
const CHAT_STARS = Array.from({ length: 12 }, (_, i) => ({
  left: `${8 + Math.round(i * 7.5)}%`,
  top: `${12 + (i % 3) * 10}%`,
  size: i % 3 === 0 ? 3 : 2,
  delay: `${(i * 0.7).toFixed(1)}s`,
}));

/* ── 打字机效果 hook ── */
function useTypewriter(text, speed = 22, enabled = true) {
  const [display, setDisplay] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled || !text) { setDisplay(text || ""); setDone(true); return; }
    setDisplay(""); setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplay(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, enabled]);

  return { display, done };
}

/* ════════════════════════════════════════
   Conversation 主组件
   ════════════════════════════════════════ */
export default function Conversation() {
  const [activeScene, setActiveScene] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [score, setScore] = useState({ vocabLearned: 0, stagesComplete: 0 });
  const [completed, setCompleted] = useState(false);

  const [scenes, setScenes] = useState(conversationScenes);
  const bottomRef = useRef(null);

  // 优先使用本地内置数据（v2 多轮对话树），后端作为备用
  // useEffect(() => {
  //   let cancelled = false;
  //   getConversationScenes()
  //     .then((res) => {
  //       const list = res.data?.data;
  //       if (!cancelled && list?.length > 0) setScenes(list);
  //     })
  //     .catch(() => {});
  //   return () => { cancelled = true; };
  // }, []);

  /* ── 打开场景 ── */
  const openScene = useCallback((scene) => {
    setActiveScene(scene);
    setMessages([{
      id: `greet-${Date.now()}`,
      role: "ai",
      text: scene.greeting.thai,
      roman: scene.greeting.roman,
      chinese: scene.greeting.chinese,
      speakRate: scene.greeting.speakRate,
      isGreeting: true,
    }]);
    setCurrentStage(1);
    setCurrentDialogueIndex(0);
    setScore({ vocabLearned: 0, stagesComplete: 0 });
    setCompleted(false);
  }, []);

  const closeScene = useCallback(() => {
    setActiveScene(null);
    setMessages([]);
    setInput("");
    setTyping(false);
    setCurrentStage(0);
    setCurrentDialogueIndex(0);
    setCompleted(false);
    stopThaiAudio();
  }, []);

  const speak = useCallback((text) => {
    if (!text) return;
    speakThai(text, { rate: 0.72 });
  }, []);

  /* ── 获取当前阶段数据 ── */
  const getCurrentDialogue = useCallback(() => {
    if (!activeScene?.dialogueTree) return null;
    return activeScene.dialogueTree.find(d => d.stage === currentStage);
  }, [activeScene, currentStage]);

  /* ── 关键词匹配 ── */
  const matchResponse = useCallback((dialogue, text) => {
    if (!dialogue) return activeScene?.fallback;
    const norm = text.toLowerCase().replace(/[\s.,!?;:]/g, "");
    if (!norm) return null;

    for (const resp of dialogue.responses) {
      const matched = resp.keywords.some(k => {
        const key = k.toLowerCase().replace(/[\s.,!?;:]/g, "");
        return key && (norm.includes(key) || (key.includes(norm) && norm.length > 1));
      });
      if (matched) return resp;
    }
    return null;
  }, [activeScene]);

  /* ── 发送消息 ── */
  const sendMessage = useCallback((raw) => {
    const text = (raw ?? input).trim();
    if (!text || !activeScene || typing || completed) return;

    const dialogue = getCurrentDialogue();
    const response = matchResponse(dialogue, text);

    // 用户消息
    const userMsg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    const { min, max } = CONVERSATION_CONFIG.typingDelay;
    const delay = min + Math.random() * (max - min);

    setTimeout(() => {
      if (response) {
        // 匹配成功 → AI 回复
        const aiMsg = {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: response.thai,
          roman: response.roman,
          chinese: response.chinese,
          vocab: response.vocab,
          grammar: response.grammar,
          culturalNote: response.culturalNote,
          isNewStage: true,
        };
        setMessages(prev => [...prev, aiMsg]);
        setScore(prev => ({
          vocabLearned: prev.vocabLearned + (response.vocab?.length || 0),
          stagesComplete: prev.stagesComplete + 1,
        }));

        // 推进到下一阶段
        if (dialogue?.nextStage) {
          setTimeout(() => {
            setCurrentStage(dialogue.nextStage);
            setCurrentDialogueIndex(prev => prev + 1);
            setTyping(false);
          }, 500);
        } else {
          // 对话结束
          setTyping(false);
          setTimeout(() => setCompleted(true), 1200);
        }
      } else {
        // 未匹配 → fallback
        const fb = activeScene.fallback;
        setMessages(prev => [...prev, {
          id: `fb-${Date.now()}`,
          role: "ai",
          text: fb.thai,
          roman: fb.roman,
          chinese: fb.chinese,
          vocab: fb.vocab,
          grammar: fb.grammar,
        }]);
        setTyping(false);
      }
    }, delay);
  }, [input, activeScene, typing, completed, getCurrentDialogue, matchResponse]);

  /* ── 滚动到底部 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, completed]);

  useEffect(() => () => stopThaiAudio(), []);

  /* ════════════════════════════════════════
     场景选择页
     ════════════════════════════════════════ */
  if (!activeScene) {
    return (
      <div className="relative space-y-6">
        <ParticleField color="#f5d67b" opacity={0.28} />

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <ThaiCorner corners={["tr"]} size={22} className="hidden sm:block" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
                <Sparkles className="h-4 w-4" />
                AI THAI CONVERSATION
              </div>
              <h1 className="mt-3 text-3xl font-black text-white">对话练习</h1>
              <p className="mt-2 text-sm text-white/40">
                选择场景，和 AI 泰语老师进行多轮真实对话
              </p>
            </div>
            <AiStatusBadge />
          </div>
        </motion.div>

        <div className="flex items-start gap-3 rounded-2xl border border-yellow-300/[0.08] bg-gradient-to-r from-yellow-300/[0.05] via-white/[0.02] to-emerald-400/[0.04] p-4">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-300/70" />
          <p className="text-xs leading-relaxed text-white/40">
            <span className="font-semibold text-white/70">Demo 模式</span>
            {" · "}
            当前回复来自内置多轮对话脚本，每个场景包含 4 轮渐进式对话。未来接入真实 AI 后自动替换。
          </p>
        </div>

        {/* 场景卡片 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene, index) => {
            const Icon = sceneIcons[scene.icon] || MessageCircle;
            return (
              <motion.button
                key={scene.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                onClick={() => openScene(scene)}
                className="premium-glass card-lift card-glow-emerald group relative overflow-hidden rounded-3xl p-5 text-left transition-all"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="relative">
                  {/* 场景图标 + emoji */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.08]">
                      <Icon className="h-5 w-5 text-emerald-300" />
                    </div>
                    {scene.sceneEmoji && (
                      <span className="text-2xl">{scene.sceneEmoji}</span>
                    )}
                  </div>

                  <h2 className="mt-4 text-base font-bold text-white">{scene.title}</h2>
                  {scene.subtitle && (
                    <p className="mt-0.5 text-xs text-emerald-300/50">{scene.subtitle}</p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-white/35">{scene.description}</p>

                  {/* 场景提示 */}
                  {scene.sceneTip && (
                    <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] leading-relaxed text-white/25">💡 {scene.sceneTip}</p>
                    </div>
                  )}

                  {/* 阶段数指示 */}
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: scene.dialogueTree?.length || 4 }, (_, i) => (
                        <div key={i} className="h-1 w-6 rounded-full bg-emerald-400/20" />
                      ))}
                    </div>
                    <span className="text-[10px] text-white/30">
                      {scene.dialogueTree?.length || 4} 轮对话
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-300/60">
                    开始对话
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════
     聊天界面
     ════════════════════════════════════════ */
  const Icon = sceneIcons[activeScene.icon] || MessageCircle;
  const dialogue = getCurrentDialogue();
  const suggestions = dialogue?.suggestions || activeScene.dialogueTree?.[0]?.suggestions || [];
  const totalStages = activeScene.dialogueTree?.length || 4;
  const progress = (currentStage / totalStages) * 100;

  return (
    <div className="space-y-5">
      {/* 顶部导航栏 */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={closeScene} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.08]">
            <Icon className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{activeScene.title}</h1>
            <p className="text-xs text-white/35">AI 泰语老师 · {activeScene.subtitle}</p>
          </div>
        </div>
        <AiStatusBadge compact />
      </motion.div>

      {/* 对话进度条 */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/50">
            对话进度
          </span>
          <span className="text-[10px] text-white/30">
            第 {Math.min(currentStage, totalStages)} / {totalStages} 轮
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/[0.06]">
          <motion.div
            className="h-1 rounded-full bg-gradient-to-r from-emerald-400/60 to-emerald-300/40"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        {dialogue?.prompt && !completed && (
          <p className="mt-2 text-[10px] text-white/20">💡 {dialogue.prompt}</p>
        )}
      </div>

      {/* 场景提示 */}
      {activeScene.sceneTip && messages.length <= 2 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-start gap-3 rounded-2xl border border-emerald-300/[0.08] bg-emerald-400/[0.03] p-4"
        >
          <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300/50" />
          <p className="text-xs leading-relaxed text-white/30">{activeScene.sceneTip}</p>
        </motion.div>
      )}

      {/* 消息区 */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] premium-glass shadow-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#071512]/55 via-transparent to-[#071512]/40" />
          {CHAT_STARS.map((star, i) => (
            <span key={i} className="thai-dust absolute rounded-full bg-white"
              style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay }} />
          ))}
          <ThaiRoof className="absolute -bottom-7 left-1/2 h-24 w-72 -translate-x-1/2" color="#F5D67B" opacity={0.05} />
          <div className="absolute -top-24 left-1/4 h-52 w-52 rounded-full bg-emerald-400/[0.06] blur-[80px]" />
          <div className="absolute -bottom-16 right-1/4 h-52 w-52 rounded-full bg-yellow-300/[0.05] blur-[80px]" />
        </div>

        <div className="relative z-10 max-h-[58vh] space-y-5 overflow-y-auto p-5 sm:p-6">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} text={msg.text} />
            ) : (
              <AiBubble key={msg.id} {...msg} onSpeak={speak} />
            )
          )}
          {typing && <TypingBubble />}
          <div ref={bottomRef} />
        </div>

        {/* 快捷回复 */}
        {!completed && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-5 py-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={typing}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/50 transition hover:border-emerald-300/20 hover:bg-emerald-400/[0.08] hover:text-emerald-200 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 输入区 */}
        {!completed && (
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex items-center gap-3 border-t border-white/[0.06] p-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入泰语或中文..."
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-emerald-300/30 focus:bg-white/[0.06]"
            />
            <button type="submit" disabled={!input.trim() || typing}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* 对话完成卡片 */}
        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-t border-white/[0.06] p-6 text-center"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10">
                <Check className="h-7 w-7 text-emerald-300" />
              </div>
              <h3 className="text-lg font-bold text-white">对话完成！</h3>
              <p className="mt-1 text-sm text-white/40">你完成了「{activeScene.title}」的全部对话</p>

              <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-300/10 bg-emerald-400/[0.05] p-3">
                  <div className="text-2xl font-bold text-emerald-300">{score.vocabLearned}</div>
                  <div className="mt-1 text-[10px] text-white/30">学习词汇</div>
                </div>
                <div className="rounded-xl border border-yellow-300/10 bg-yellow-300/[0.05] p-3">
                  <div className="text-2xl font-bold text-yellow-300">{score.stagesComplete}</div>
                  <div className="mt-1 text-[10px] text-white/30">完成轮次</div>
                </div>
              </div>

              <div className="mt-5 flex gap-3 justify-center">
                <button
                  onClick={() => openScene(activeScene)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.08]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  再来一次
                </button>
                <button
                  onClick={closeScene}
                  className="flex items-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-300/20 px-4 py-2.5 text-sm text-emerald-300 transition hover:bg-emerald-400/20"
                >
                  选择其他场景
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   用户消息气泡
   ════════════════════════════════════════ */
function UserBubble({ text }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="flex max-w-[85%] items-end gap-2.5">
        <div className="rounded-2xl rounded-br-md border border-emerald-300/20 bg-emerald-400/[0.1] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_20px_rgba(52,211,153,0.07)] backdrop-blur-xl">
          <p className="text-sm leading-relaxed text-emerald-50/90">{text}</p>
        </div>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-400/[0.08]">
          <User className="h-3.5 w-3.5 text-emerald-300/70" />
        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   AI 消息气泡（带打字机效果）
   ════════════════════════════════════════ */
function AiBubble({ text, roman, chinese, vocab, grammar, culturalNote, onSpeak, isGreeting }) {
  const { display: displayText, done: textDone } = useTypewriter(text, 25, !isGreeting);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/[0.12]">
        <Bot className="h-3.5 w-3.5 text-emerald-300" />
      </div>

      <div className="max-w-[85%] space-y-3">
        {/* 主消息 */}
        <div className="rounded-2xl rounded-tl-md border border-teal-300/15 bg-gradient-to-br from-teal-400/[0.09] via-white/[0.035] to-yellow-300/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-1.5">
            <Bot className="h-3 w-3 text-teal-300" />
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-teal-200/60">AI 老师</span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <p className="font-thai text-lg font-semibold leading-relaxed text-white">
              {displayText}
              {!textDone && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-300/60" />}
            </p>
            <button onClick={() => onSpeak(text)}
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 transition hover:border-emerald-300/20 hover:bg-emerald-400/[0.08] hover:text-emerald-300"
              title="播放泰语发音">
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {roman && <p className="mt-1.5 text-xs italic text-emerald-300/60">{roman}</p>}
          {chinese && <p className="mt-1.5 text-sm text-white/60">{chinese}</p>}
        </div>

        {/* 词汇解释 */}
        {vocab?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-300/[0.1] bg-emerald-400/[0.05] px-4 py-3 backdrop-blur-xl">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300/50">📚 词汇解释</div>
            <div className="space-y-2">
              {vocab.map((v) => (
                <div key={v.th} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-thai font-semibold text-emerald-100/80">{v.th}</span>
                    <span className="text-[10px] italic text-white/25">{v.roman}</span>
                    <span className="ml-auto text-right text-white/50">{v.cn}</span>
                  </div>
                  {v.example && (
                    <p className="mt-1 text-[10px] text-white/20">例: {v.example}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 语法解释 */}
        {grammar && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-yellow-300/[0.1] bg-yellow-300/[0.04] px-4 py-3 backdrop-blur-xl">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-yellow-200/40">📝 语法小贴士</div>
            <p className="text-xs leading-relaxed text-yellow-100/50">💡 {grammar}</p>
          </motion.div>
        )}

        {/* 文化笔记 */}
        {culturalNote && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-purple-300/[0.1] bg-purple-400/[0.04] px-4 py-3 backdrop-blur-xl">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-purple-200/40">🌏 文化笔记</div>
            <p className="text-xs leading-relaxed text-purple-100/40">{culturalNote}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ── AI 状态徽章 ── */
function AiStatusBadge({ compact = false }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] backdrop-blur-xl ${compact ? "px-3 py-2" : "px-4 py-2.5"}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </span>
      <div className="leading-tight">
        <div className="text-[10px] font-bold text-emerald-200">AI Teacher Online</div>
        <div className="mt-0.5 text-[9px] text-white/30">AI 泰语老师在线</div>
      </div>
    </div>
  );
}

/* ── 输入中气泡 ── */
function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/[0.12]">
        <Bot className="h-3.5 w-3.5 text-emerald-300" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.045] px-4 py-3.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300/70 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300/70 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300/70 [animation-delay:300ms]" />
      </div>
    </motion.div>
  );
}
