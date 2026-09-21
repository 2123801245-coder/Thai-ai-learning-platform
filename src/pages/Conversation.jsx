import React, { useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import SceneCertificate from "@/components/ai/SceneCertificate";
import TeacherMemoryPanel from "@/components/ai/TeacherMemoryPanel";
import AIAvatar from "@/components/ai/AIAvatar";
import useMentorVoice from "@/hooks/useMentorVoice";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Plane, Utensils, GraduationCap, ShoppingBag,
  Landmark, Briefcase, Sparkles, Send, Volume2, ArrowLeft, Bot,
  User, Info, ChevronRight, Star, Check, BookOpen, RotateCcw, Mic,
  Brain, Loader2, BookA,
} from "lucide-react";
import { conversationScenes, CONVERSATION_CONFIG } from "@/data/conversations";
import { askAiTeacher, getAiTeacherQuota } from "@/api/aiTeacher";
import WorldHero, { HeroChip } from "@/components/world/WorldHero";
import { ThaiRoof } from "@/components/common/ThaiMotifs";
import { ParticleField } from "@/components/common/ThaiDecor";
import { speakThai, stopThaiAudio } from "@/lib/thaiSpeech";
import { mergePlacementProfile } from "@/lib/userProfile";
import { createAudioRecorder } from "@/lib/audioRecorder";
import { transcribeSpeech } from "@/api/aiTeacher";

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
  const [searchParams] = useSearchParams();
  const [activeScene, setActiveScene] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showMemory, setShowMemory] = useState(false); // 老师记忆面板（合并自 AI Speaking Room）

  /* 浮动 AI 助手「解释这个词」携带的待翻译问题 → 预填输入框 */
  useEffect(() => {
    const q = (searchParams.get("q") || "").trim();
    if (q) setInput(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [score, setScore] = useState({ vocabLearned: 0, stagesComplete: 0 });
  const [completed, setCompleted] = useState(false);
  const [quota, setQuota] = useState(null);       // { freeChatDaily, usedToday, remainingToday, isVip }
  const [aiNotice, setAiNotice] = useState("");   // AI 模式状态提示（不可用/配额用尽）

  const [scenes, setScenes] = useState(conversationScenes);
  const bottomRef = useRef(null);
  /* 首屏两个 CTA 的落点（直接说话区 / 情景场景列表） */
  const voiceRef = useRef(null);
  const scenesRef = useRef(null);

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
    setAiNotice("");
  }, []);

  /* 首页/每日任务直达场景：/conversation?scene=travel
     （任务卡里的「练 1 个旅行场景 / 商务场景 / 台词跟读」都走这个入口） */
  useEffect(() => {
    const sceneId = (searchParams.get("scene") || "").trim();
    if (!sceneId) return;

    const found = scenes.find((scene) => scene.id === sceneId);
    if (found) openScene(found);
    // 只在首帧应用一次（后续由用户自己切换场景）
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ── AI 自由对话（DeepSeek 结构化回复）──
       成功返回 { thai, roman, chinese, vocab, grammar, culturalNote, nextStage }
       失败（网络 / 未配置 / 配额用尽）返回 null，调用方回退脚本 */
  const tryAiReply = useCallback(async (text, dialogue) => {
    try {
      // 最近 8 条对话作为上下文
      const history = messages.slice(-8).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text || "",
      }));

      const res = await askAiTeacher({
        message: text,
        action: "conversation",
        // 入学画像：老师按 A0~C1 等级控制泰语难度、纠错重点与目标场景倾斜
        profile: mergePlacementProfile(),
        scene: {
          id: activeScene.id,
          title: activeScene.title,
          description: activeScene.description,
          sceneTip: activeScene.sceneTip,
          roleplay: activeScene.roleplay || null,
        },
        stage: dialogue
          ? { stage: dialogue.stage, prompt: dialogue.prompt }
          : { stage: currentStage, prompt: "" },
        history,
      });

      const data = res?.data;
      if (data?.thai) return data;
      return null;
    } catch (err) {
      // 429：免费配额用尽
      if (err?.response?.status === 429) {
        setAiNotice("今日 AI 自由对话次数已用完，正在用内置脚本回复。开通 VIP 即可无限自由对话。");
        setQuota((q) => (q ? { ...q, remainingToday: 0 } : q));
      } else if (err?.response?.status === 503 || err?.response?.status === 502 || err?.code === "ERR_NETWORK") {
        setAiNotice("AI 老师暂时不可用，正在用内置脚本回复。");
      }
      return null;
    }
  }, [activeScene, currentStage, messages]);

  /* ── 应用 AI 回复：渲染 + 评分 + 阶段推进 ── */
  const applyAiReply = useCallback((data, dialogue) => {
    setMessages((prev) => [...prev, {
      id: `ai-${Date.now()}`,
      role: "ai",
      text: data.thai,
      roman: data.roman,
      chinese: data.chinese,
      vocab: data.vocab,
      grammar: data.grammar,
      culturalNote: data.culturalNote,
      isAI: true,
    }]);
    setScore((prev) => ({
      vocabLearned: prev.vocabLearned + (data.vocab?.length || 0),
      stagesComplete: prev.stagesComplete + 1,
    }));

    // AI 判断对话自然进入下一话题 → 推进阶段；否则停留当前话题继续自由对话
    if (data.nextStage && dialogue?.nextStage) {
      setTimeout(() => {
        setCurrentStage(dialogue.nextStage);
        setCurrentDialogueIndex((prev) => prev + 1);
        setTyping(false);
      }, 400);
    } else if (data.nextStage && !dialogue?.nextStage) {
      setTyping(false);
      setTimeout(() => setCompleted(true), 1200);
    } else {
      setTyping(false);
    }
  }, []);

  /* ── 发送消息 ── */
  const sendMessage = useCallback(async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || !activeScene || typing || completed) return;

    const dialogue = getCurrentDialogue();

    // 用户消息
    const userMsg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // 1) 优先 AI 自由对话（AI 可用时）
    const aiReply = await tryAiReply(text, dialogue);
    if (aiReply) {
      applyAiReply(aiReply, dialogue);
      // 回复成功后刷新剩余配额
      getAiTeacherQuota()
        .then((res) => setQuota(res?.data || null))
        .catch(() => {});
      return;
    }

    // 2) 回退内置脚本（AI 不可用 / 配额用尽 / 网络失败）
    const response = matchResponse(dialogue, text);

    const { min, max } = CONVERSATION_CONFIG.typingDelay;
    const delay = min + Math.random() * (max - min);

    setTimeout(() => {
      if (response) {
        // 匹配成功 → 脚本 AI 回复
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
        setMessages((prev) => [...prev, aiMsg]);
        setScore((prev) => ({
          vocabLearned: prev.vocabLearned + (response.vocab?.length || 0),
          stagesComplete: prev.stagesComplete + 1,
        }));

        // 推进到下一阶段
        if (dialogue?.nextStage) {
          setTimeout(() => {
            setCurrentStage(dialogue.nextStage);
            setCurrentDialogueIndex((prev) => prev + 1);
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
        setMessages((prev) => [...prev, {
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
  }, [input, activeScene, typing, completed, getCurrentDialogue, matchResponse, tryAiReply, applyAiReply]);

  /* ── 滚动到底部 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, completed]);

  useEffect(() => () => stopThaiAudio(), []);

  /* ── 拉取 AI 老师对话配额（判断自由对话是否可用）── */
  useEffect(() => {
    let cancelled = false;
    getAiTeacherQuota()
      .then((res) => {
        if (!cancelled) setQuota(res?.data || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ════════════════════════════════════════
     场景选择页
     ════════════════════════════════════════ */
  if (!activeScene) {
    return (
      <div className="relative space-y-6">
        <ParticleField color="#f5d67b" opacity={0.28} />

        {/*
         * 首屏：与首页同一套构图语言（同一张宽幅世界 + 左侧泰中文案 +
         * 右侧真实数字 HUD）。原来那个 emerald 小标题栏撤掉 —— 它和首页
         * 的打开方式不是同一个世界。
         */}
        <WorldHero
          eyebrow="ThaiAi Conversation Room"
          thai="ห้องสนทนากับครู"
          title="AI 对话室"
          subtitle="选个场景开始情景对话，或直接开口和老师说话。老师按你的等级、目标和兴趣调整说法，也记得你的薄弱点。"
          focus="46% 42%"
          accent="#6ee7a8"
          ariaLabel="AI 对话室"
          badge={<AiStatusBadge />}
          stats={[
            { Icon: MessageCircle, value: `${scenes.length} 个场景`, label: "情景对话场景", tone: "text-emerald-300" },
            {
              Icon: Mic,
              value: quota?.isVip ? "无限" : quota ? `${quota.remainingToday ?? 0} 次` : "…",
              label: "今日 AI 自由对话剩余次数",
              tone: "text-[#e8c684]",
            },
            { Icon: Brain, value: "老师记得你", label: "AI 老师长期记忆（目标 / 薄弱点 / 兴趣）", tone: "text-violet-300" },
          ]}
          chips={
            <>
              <HeroChip accent="#6ee7a8">💬 AI 自由对话</HeroChip>
              <HeroChip accent="#e8c684">🎙️ 语音对话 · 发音评分</HeroChip>
              <HeroChip accent="#c4b5fd">🎭 沉浸式情景模拟</HeroChip>
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() =>
                  voiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="group flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/[0.14] px-4 py-2.5 text-[12px] font-bold text-emerald-50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/[0.22]"
              >
                <Mic className="h-4 w-4 text-emerald-300 transition group-hover:scale-110" />
                直接开口和老师说话
              </button>
              <button
                type="button"
                onClick={() =>
                  scenesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-2.5 text-[11px] font-semibold text-white/70 backdrop-blur-xl transition hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#e8c684]" />
                挑一个情景场景
              </button>
            </>
          }
          footer={
            /* 玻璃芯片而不是裸文字：它浮在照片上，浅色模式会把它翻成白卡深字，
               既不掉底也不会在照片上读不出来 */
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/45 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur-xl">
              往下：老师的记忆面板 · 情景对话场景 · 发音评分
            </span>
          }
        />

        {/* ══ 直接和老师说话（合并自 AI Speaking Room）══ */}
        <div ref={voiceRef} className="scroll-mt-6">
          <VoiceLobby onOpenMemory={() => setShowMemory(true)} />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-yellow-300/[0.08] bg-gradient-to-r from-yellow-300/[0.05] via-white/[0.02] to-emerald-400/[0.04] p-4">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-300/70" />
          <p className="text-xs leading-relaxed text-white/40">
            {quota?.isVip || (quota && quota.remainingToday > 0) ? (
              <>
                <span className="font-semibold text-emerald-300/80">AI 自由对话</span>
                {" · "}
                已接入 DeepSeek，AI 老师会根据场景自由接话；AI 不可用时自动回退内置脚本。
              </>
            ) : (
              <>
                <span className="font-semibold text-white/70">内置对话脚本</span>
                {" · "}
                {quota && !quota.isVip && quota.remainingToday <= 0
                  ? "今日 AI 自由对话次数已用完，开通 VIP 后可无限自由对话。"
                  : "当前回复来自内置多轮对话脚本，每个场景包含 4 轮渐进式对话。"}
              </>
            )}
          </p>
        </div>

        {/* 场景卡片 */}
        <div ref={scenesRef} className="grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                  {/* 角色扮演标签 */}
                  {scene.roleplay && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-purple-300/15 bg-purple-400/[0.06] px-2.5 py-1">
                      <span className="text-[10px] font-bold text-purple-300/70">🎭 角色扮演</span>
                      <span className="text-[10px] text-purple-200/40">{scene.roleplay.character}</span>
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

        {/* 老师记忆面板（合并自 AI Speaking Room） */}
        <AnimatePresence>
          {showMemory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setShowMemory(false)}
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px]">
                <TeacherMemoryPanel onClose={() => setShowMemory(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemory((v) => !v)}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/55 transition hover:border-emerald-300/30 hover:text-emerald-200"
            aria-expanded={showMemory}
          >
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">老师的记忆</span>
          </button>
          <AiStatusBadge compact />
        </div>
      </motion.div>

      {/* 老师记忆抽屉 */}
      <AnimatePresence>
        {showMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowMemory(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px]">
              <TeacherMemoryPanel onClose={() => setShowMemory(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 角色扮演 HUD */}
      {activeScene.roleplay && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-purple-300/[0.12] bg-gradient-to-r from-purple-400/[0.06] via-white/[0.02] to-emerald-400/[0.04] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-300/15 bg-purple-400/10">
              <span className="text-lg">🎭</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300/60">ROLEPLAY</span>
                <span className="rounded-md border border-purple-300/15 bg-purple-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-200/60">{activeScene.roleplay.character}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/35">AI 正在以「{activeScene.roleplay.character}」的身份与你对话</p>
            </div>
          </div>
        </motion.div>
      )}

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
        {aiNotice && (
          <p className="mt-2 text-[10px] text-yellow-200/70">⚠️ {aiNotice}</p>
        )}
      </div>

      {/* AI 自由对话状态条 */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300/[0.08] bg-emerald-400/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          {quota?.isVip ? (
            <span className="text-xs text-emerald-200/90">AI 自由对话 · VIP 无限</span>
          ) : quota && quota.remainingToday > 0 ? (
            <span className="text-xs text-emerald-100/70">
              AI 自由对话 · 今日剩余 <b className="text-emerald-200">{quota.remainingToday}</b> / {quota.freeChatDaily} 次
            </span>
          ) : quota ? (
            <span className="text-xs text-yellow-200/70">AI 自由对话次数已用完 · 正在使用内置脚本</span>
          ) : (
            <span className="text-xs text-white/35">连接 AI 老师中...</span>
          )}
        </div>
        <span className="text-[10px] text-white/25">AI 老师会根据场景自由接话</span>
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

        {/* 输入区（含语音输入：转写后自动发送） */}
        {!completed && (
          <VoiceInputBar
            input={input}
            setInput={setInput}
            onSubmit={() => sendMessage()}
            typing={typing}
          />
        )}

        {/* 场景完成证书 */}
        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-t border-white/[0.06] p-6"
            >
              <SceneCertificate
                sceneTitle={activeScene.title}
                sceneSubtitle={activeScene.subtitle}
                characterName={activeScene.roleplay?.character}
                vocabLearned={score.vocabLearned}
                stagesComplete={score.stagesComplete}
                totalStages={activeScene.dialogueTree?.length || 4}
                sceneEmoji={activeScene.sceneEmoji}
              />

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
   语音大厅（合并自 AI Speaking Room）：
   场景选择页顶部的「直接和老师说话」区。
   AIAvatar + 按住说话 + 老师语音回复，不进场景也能聊。
════════════════════════════════════════ */
function VoiceLobby({ onOpenMemory }) {
  const meterRef = useRef(null);
  const [exchanges, setExchanges] = useState([]);

  const onExchange = useCallback((exchange) => {
    setExchanges((prev) => [
      ...prev.slice(-2),
      { heard: exchange.heard, reply: exchange.reply },
    ]);
  }, []);

  const voice = useMentorVoice({ meterRef, sceneId: null, onExchange });
  const phase = voice.phase;
  const busy = phase !== "idle";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-emerald-300/[0.12] bg-gradient-to-br from-emerald-950/60 via-black/50 to-[#050807]/80 p-5 sm:p-6"
      aria-label="直接和老师说话"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/[0.07] blur-3xl" />

      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
        {/* 老师头像 + 状态 */}
        <div className="flex flex-col items-center gap-2">
          <AIAvatar
            state={phase === "idle" ? "idle" : phase}
            level={phase === "listening" || phase === "speaking" ? 0.55 : 0}
            size={120}
            className="drop-shadow-[0_0_28px_rgba(52,211,153,0.2)]"
          />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-emerald-300/70">
            {phase === "idle" ? "老师已就位" : phase === "listening" ? "正在听你说…" : phase === "thinking" ? "思考中…" : "老师正在说"}
          </p>
        </div>

        {/* 交互区 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">直接和老师说话</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
                不用选场景，开口就行。老师会记住你的目标、接住你的话题，还能给你的发音打分。
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMemory}
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-white/55 transition hover:border-emerald-300/40 hover:text-emerald-200"
            >
              <Brain className="h-3 w-3" />
              老师的记忆
            </button>
          </div>

          {/* 最近一轮对话回顾 */}
          <div className="mt-3 space-y-1.5">
            {exchanges.length === 0 && !voice.error ? (
              <p className="text-[11px] text-white/25">
                第一次对话会出现在这里 · 麦克风权限首次使用时申请
              </p>
            ) : null}
            {voice.error ? (
              <p className="text-[11px] text-amber-200/85">{voice.error}</p>
            ) : null}
            {exchanges.map((ex, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
                <p className="text-[11px] text-white/45">你：{ex.heard || "（没听清，请再说一次）"}</p>
                <p className="mt-0.5 font-viaoda text-[14px] text-emerald-50">{ex.reply.thai}</p>
                {ex.reply.chinese ? (
                  <p className="mt-0.5 text-[10.5px] text-white/45">{ex.reply.chinese}</p>
                ) : null}
              </div>
            ))}
          </div>

          {/* 麦克风 + 发音评分 */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              ref={meterRef}
              onClick={() => (phase === "listening" ? voice.stop() : voice.start())}
              disabled={phase === "thinking" || phase === "speaking"}
              style={{ "--lvl": "0" }}
              className={`mentor-mic flex h-12 w-12 items-center justify-center rounded-full border transition ${
                phase === "listening"
                  ? "border-emerald-300/60 bg-emerald-400/25"
                  : "border-emerald-300/25 bg-emerald-400/[0.12] hover:border-emerald-300/45"
              } disabled:cursor-wait disabled:opacity-60`}
              aria-label={phase === "listening" ? "结束说话" : "开始说泰语"}
            >
              {phase === "thinking" || phase === "speaking" ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-200" />
              ) : (
                <Mic className="h-5 w-5 text-emerald-300" />
              )}
            </button>
            <button
              type="button"
              onClick={voice.assessPronunciation}
              disabled={busy || voice.analyzing || !voice.reply}
              title="对老师刚说的那句做发音评分"
              className="flex h-10 items-center gap-1.5 rounded-full border border-[#e8c684]/30 bg-[#e8c684]/[0.12] px-3.5 text-[11.5px] font-bold text-[#e8c684] transition hover:bg-[#e8c684]/[0.22] disabled:opacity-35"
            >
              {voice.analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookA className="h-4 w-4" />}
              发音评分
            </button>
            {voice.pronunciation ? (
              <span className="text-[11.5px] font-bold text-[#e8c684]">
                {voice.pronunciation.score} 分
                {voice.pronunciation.tone ? ` · 声调 ${voice.pronunciation.tone}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ════════════════════════════════════════
   聊天页语音输入条：按住说话 → 转写 → 发送
   （转写失败不阻塞，输入框照常可用）
════════════════════════════════════════ */
function VoiceInputBar({ input, setInput, onSubmit, typing }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const btnRef = useRef(null);

  const paintLevel = useCallback(() => {
    const el = btnRef.current;
    const rec = recorderRef.current;
    if (el && rec) {
      const level = rec.isRecording?.() ? rec.getLevel?.() || 0 : 0;
      el.style.setProperty("--lvl", level.toFixed(3));
    }
    rafRef.current = requestAnimationFrame(paintLevel);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    btnRef.current?.style.setProperty("--lvl", "0");
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopLoop();
    try { recorderRef.current?.stop?.(); } catch { /* 已停 */ }
  }, [stopLoop]);

  const start = async () => {
    if (recording || transcribing || typing) return;
    setError("");
    if (!recorderRef.current) recorderRef.current = createAudioRecorder();
    try {
      await recorderRef.current.start();
    } catch {
      setError("麦克风没连上（权限或设备问题），打字也可以");
      return;
    }
    setRecording(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paintLevel);
    timerRef.current = setTimeout(() => finishRef.current?.(), 15000);
  };

  const finish = async () => {
    const rec = recorderRef.current;
    if (!rec || !recording) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = 0; }
    stopLoop();
    setRecording(false);
    let wav = null;
    try { wav = rec.stop(); } catch { wav = null; }
    if (!wav) { setError("这一段没录到声音，再试一次"); return; }

    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", wav, "chat.wav");
      form.append("language", "th-TH");
      const res = await transcribeSpeech(form);
      const text = String(res?.data?.text || res?.data?.transcript || "").trim();
      if (text) {
        setInput(text);
        // 拿到转写直接发（sendMessage 是异步的，这里只触发）
        setTimeout(() => onSubmit(), 50);
      } else {
        setError("没听清你说的话，再试一次或直接打字");
      }
    } catch (e) {
      setError(
        e?.response?.status === 401
          ? "登录后老师才听得到你说话"
          : "转写服务暂时不可用，直接打字也可以"
      );
    } finally {
      setTranscribing(false);
    }
  };

  const finishRef = useRef(finish);
  finishRef.current = finish;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="flex items-center gap-3 border-t border-white/[0.06] p-4"
    >
      <button
        type="button"
        ref={btnRef}
        onClick={() => (recording ? finish() : start())}
        disabled={transcribing || typing}
        style={{ "--lvl": "0" }}
        className={`mentor-mic flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition ${
          recording
            ? "border-emerald-300/60 bg-emerald-400/25"
            : "border-white/10 bg-white/[0.04] text-white/50 hover:border-emerald-300/30 hover:text-emerald-200"
        } disabled:cursor-wait disabled:opacity-40`}
        aria-label={recording ? "结束录音并发送" : "按住说话（自动转写发送）"}
      >
        {transcribing ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-200" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      <input
        value={recording ? "正在听你说…说完点一下麦克风" : input}
        onChange={(e) => setInput(e.target.value)}
        readOnly={recording}
        placeholder="输入泰语或中文，或点左侧麦克风说话"
        className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-emerald-300/30 focus:bg-white/[0.06]"
      />
      <button type="submit" disabled={!input.trim() || typing || recording}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
        <Send className="h-4 w-4" />
      </button>
      {error ? <p className="sr-only">{error}</p> : null}
      {error ? (
        <p className="absolute -bottom-1 left-4 hidden text-[10px] text-amber-200/80">{error}</p>
      ) : null}
    </form>
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
/*
 * AI 状态牌。底色改深（bg-black/45）：它现在挂在首屏那张世界照片上，
 * 原来那层很淡的翡翠底在亮部寺庙前读不出来。
 */
function AiStatusBadge({ compact = false }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-emerald-300/15 bg-black/45 backdrop-blur-xl ${compact ? "px-3 py-2" : "px-4 py-2.5"}`}>
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
