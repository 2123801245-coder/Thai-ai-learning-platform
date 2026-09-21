// src/pages/MediaLearning.jsx
//
// =========================================================
// Media Learning · 媒体学习
// =========================================================
//
// 用泰剧 / 歌曲 / 综艺 / 新闻 / 社交媒体 / 文学这六类真实媒介学泰语。
// 每节课都按同一套七步结构走：
//
//   ① 原始内容（场景说明）→ ② 泰文字幕 → ③ 中文翻译 →
//   ④ 重点词汇 → ⑤ 语法解释 → ⑥ 文化背景 → ⑦ AI 练习
//
// 三件事都在这一页完成，不用跳走：
//   - 听：整段/逐句 TTS（speakThai），点句子即朗读并高亮
//   - 存：收藏课程、把重点词汇收进生词本、七步进度自动保存
//   - 练：AI 提问（Explain Like Thai / Make It Natural / Explain the
//         Culture，走后端 action=context）+ 与 AI 演一遍对话
//         （action=conversation，场景由课程内容生成）
//
// 数据来源：src/data/mediaLessons.js（原创练习素材，非真实剧集原文）
// 进度存储：src/lib/mediaProgress.js（localStorage + 事件订阅）
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  GraduationCap,
  Headphones,
  Languages,
  Loader2,
  MessageCircle,
  Play,
  Search,
  Send,
  Sparkles,
  Square,
  Star,
  Target,
  Volume2,
} from "lucide-react";

import {
  getCategory,
  getLessonById,
  getLessonsByType,
  getMediaStats,
  mediaCategories,
} from "@/data/mediaLessons";
import { speakThai } from "@/lib/thaiSpeech";
import { askAiTeacher } from "@/api/aiTeacher";
import {
  buildAiTeacherRequest,
  requireAiTeacherResponse,
} from "@/lib/aiTeacherContext";
import { mergePlacementProfile } from "@/lib/userProfile";
import { useFeatureFlag } from "@/lib/features";
import {
  MEDIA_STEPS,
  addMinutes,
  listSavedWords,
  markStep,
  recordStudy,
  setLessonDone,
  toggleFavorite,
  toggleSavedWord,
  useMediaProgress,
} from "@/lib/mediaProgress";

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"];

/* AI 提问的三种任务（对应后端 Thai Context Intelligence） */
const AI_TASKS = [
  {
    id: "explain",
    label: "Explain Like Thai",
    icon: Languages,
    hint: "用泰国人的语境和思维解释这句话",
  },
  {
    id: "natural",
    label: "Make It Natural",
    icon: Sparkles,
    hint: "判断是否像泰国人自然会说的，并给更自然的版本",
  },
  {
    id: "culture",
    label: "Explain the Culture",
    icon: GraduationCap,
    hint: "解释表达背后的关系、礼貌、情绪与文化语境",
  },
];

const TYPE_TONE = {
  drama: "text-rose-300 bg-rose-400/10 border-rose-300/20",
  song: "text-violet-300 bg-violet-400/10 border-violet-300/20",
  variety: "text-amber-200 bg-amber-300/10 border-amber-300/20",
  news: "text-sky-300 bg-sky-400/10 border-sky-300/20",
  social: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20",
  literature: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20",
};

const levelIndex = (lv) => {
  const i = LEVELS.indexOf(String(lv || "").toUpperCase());
  return i < 0 ? 0 : i;
};

/*
 * 极简富文本：只把 **加粗** 渲染成 <strong>，其余按纯文本显示。
 * 内容库里用 ** 标注重点，而 AI 老师的回复也大量使用 markdown
 * 加粗，统一在这里处理，不引入 markdown 依赖。
 */
function renderBold(text) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-emerald-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/* =========================================================
   顶部统计条
========================================================= */
function SummaryBar({ summary }) {
  const items = [
    { label: "完成课程", value: summary.completed },
    { label: "学过", value: summary.started },
    { label: "收藏", value: summary.favorites },
    { label: "生词", value: summary.words },
  ];
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="apple-surface rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
        >
          <div className="text-[10px] text-white/40">{it.label}</div>
          <div className="mt-0.5 text-lg font-bold text-emerald-200">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   课程卡片（列表）
========================================================= */
function LessonCard({ lesson, favorite, progress, onOpen }) {
  const category = getCategory(lesson.type);
  const doneSteps = progress ? Object.keys(progress.steps || {}).length : 0;
  const percent = Math.round((doneSteps / MEDIA_STEPS.length) * 100);
  const isDone = progress?.status === "done";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className={`group flex h-full flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
        isDone
          ? "border-emerald-300/25 bg-emerald-400/[0.06]"
          : "border-white/[0.08] bg-white/[0.025] hover:border-emerald-300/25 hover:bg-emerald-400/[0.04]"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-base ${
            TYPE_TONE[lesson.type] || "border-white/10 bg-white/[0.04]"
          }`}
        >
          {category?.emoji}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {category?.label}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {favorite && (
            <Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
          )}
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/50">
            {lesson.level}
          </span>
        </span>
      </div>

      <div className="text-sm font-semibold text-white/90">{lesson.title}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/40">
        {lesson.scene}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
        <Clock className="h-3 w-3" />
        {lesson.minutes} 分钟
        <span className="text-white/20">·</span>
        {lesson.keywords.length} 个重点词
        {isDone && (
          <span className="ml-auto flex items-center gap-1 text-emerald-300">
            <Check className="h-3 w-3" />
            已完成
          </span>
        )}
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </motion.button>
  );
}

/* =========================================================
   七步小节外壳
========================================================= */
function StepSection({ stepKey, index, done, onToggleDone, children, extra }) {
  const step = MEDIA_STEPS.find((s) => s.key === stepKey);
  return (
    <section
      id={`step-${stepKey}`}
      className="apple-surface scroll-mt-24 rounded-2xl border border-white/[0.08] bg-black/40 p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400/15 text-[11px] font-bold text-emerald-200">
          {index}
        </span>
        <h2 className="text-sm font-bold text-white/90">{step?.label}</h2>
        <span className="text-[10px] text-white/35">{step?.hint}</span>
        <span className="ml-auto flex items-center gap-2">
          {extra}
          <button
            type="button"
            onClick={onToggleDone}
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
              done
                ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                : "border-white/10 bg-white/[0.04] text-white/45 hover:border-emerald-300/30 hover:text-emerald-200"
            }`}
          >
            {done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {done ? "已完成" : "标记完成"}
          </button>
        </span>
      </div>
      {children}
    </section>
  );
}

/* =========================================================
   主页面
========================================================= */
export default function MediaLearning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const aiTeacher = useFeatureFlag("aiTeacher");

  const activeLessonId = searchParams.get("lesson") || "";
  const lesson = getLessonById(activeLessonId);

  /*
   * 分类支持深链：/media?category=drama
   *
   * 首页星系的「泰剧角」这类画像卫星直接落进对应分类，而不是落在
   * 「全部」列表里让用户再点一次。无法识别的取值静默回退到“全部”，
   * 不报错也不显示空列表。
   */
  const [activeType, setActiveType] = useState(() => {
    const fromUrl = (searchParams.get("category") || "").trim();
    return mediaCategories.some((category) => category.id === fromUrl) ? fromUrl : "all";
  });
  const [levelFilter, setLevelFilter] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState("");

  const media = useMediaProgress();
  const stats = useMemo(() => getMediaStats(), []);

  /* ── 音频状态：正在朗读的句子索引 ── */
  const [speakingKey, setSpeakingKey] = useState(null);
  const cancelRef = useRef(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [savedWordsOpen, setSavedWordsOpen] = useState(false);

  /* ── AI 练习状态 ── */
  const [aiTask, setAiTask] = useState("explain");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [selectedLine, setSelectedLine] = useState(0);

  const stopAudio = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setSpeakingKey(null);
  };

  const speak = (key, text, rate = 0.8) => {
    if (speakingKey === key) {
      stopAudio();
      return;
    }
    stopAudio();
    const clear = () => setSpeakingKey((k) => (k === key ? null : k));
    cancelRef.current = speakThai(text, { rate, onEnd: clear, onError: clear });
    setSpeakingKey(key);
  };

  /* 离开页面 / 切换课程时停掉音频 */
  useEffect(() => stopAudio, []);
  useEffect(() => {
    stopAudio();
    setAiMessages([]);
    setAiNotice("");
    setShowTranslation(false);
    setSelectedLine(0);
  }, [activeLessonId]);

  /* 打开课程 → 记一条学习记录（同一节课一次会话只记一次） */
  const recordedRef = useRef("");
  useEffect(() => {
    if (!lesson) return;
    if (recordedRef.current === lesson.id) return;
    recordedRef.current = lesson.id;
    recordStudy({
      lessonId: lesson.id,
      title: lesson.title,
      type: lesson.type,
      action: "打开课程",
    });
  }, [lesson]);

  const progress = lesson ? media.progressOf(lesson.id) : null;
  const doneSteps = progress?.steps || {};
  const stepDone = (key) => Boolean(doneSteps[key]);
  const toggleStep = (key) => {
    if (!lesson) return;
    const next = !stepDone(key);
    markStep(lesson.id, key, next);
    if (next && key === "ai") addMinutes(lesson.id, lesson.minutes || 0);
  };

  const openLesson = (id) => {
    recordedRef.current = "";
    setSearchParams({ lesson: id });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const closeLesson = () => {
    setSearchParams({});
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  /* =====================================================
     列表筛选
  ===================================================== */
  const list = useMemo(() => {
    let items = getLessonsByType(activeType);
    if (levelFilter !== "all") {
      const center = levelIndex(levelFilter);
      items = items.filter(
        (l) => Math.abs(levelIndex(l.level) - center) <= 1
      );
    }
    if (favOnly) items = items.filter((l) => media.isFavorite(l.id));
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.scene.toLowerCase().includes(q) ||
          l.translation.toLowerCase().includes(q) ||
          l.thaiText.toLowerCase().includes(q) ||
          l.keywords.some(
            (k) => k.th.includes(q) || k.cn.includes(q)
          )
      );
    }
    return items;
  }, [activeType, levelFilter, favOnly, query, media.state]);

  const savedWords = useMemo(() => listSavedWords(media.state), [media.state]);

  /* 同分类下的上一课 / 下一课 */
  const siblings = lesson ? getLessonsByType(lesson.type) : [];
  const siblingIndex = lesson ? siblings.findIndex((l) => l.id === lesson.id) : -1;
  const prevLesson = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
  const nextLesson =
    siblingIndex >= 0 && siblingIndex < siblings.length - 1
      ? siblings[siblingIndex + 1]
      : null;

  /* =====================================================
     AI 练习
  ===================================================== */
  const pushAi = (role, content) =>
    setAiMessages((prev) => [...prev, { id: `${Date.now()}-${role}`, role, content }]);

  const handleAiError = (err) => {
    const status = err?.response?.status;
    if (status === 429) {
      setAiNotice("今日 AI 老师次数已用完，开通 VIP 可无限使用。");
    } else if (status === 503 || status === 502 || err?.code === "ERR_NETWORK") {
      setAiNotice("AI 老师暂时不可用，请稍后再试。");
    } else {
      setAiNotice(err?.response?.data?.error || err?.message || "AI 调用失败，请重试。");
    }
  };

  /** 提问：走 Thai Context Intelligence（Explain Like Thai 等三种任务） */
  const askAi = async (text, task = aiTask) => {
    const message = String(text || "").trim();
    if (!message || aiBusy) return;
    setAiNotice("");
    setAiBusy(true);
    pushAi("user", message);
    try {
      const history = aiMessages.slice(-8).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
      const result = await askAiTeacher(
        buildAiTeacherRequest({
          message,
          task,
          tone: "natural",
          persona: "bangkok",
          profile: mergePlacementProfile(),
          history,
        })
      );
      pushAi("assistant", requireAiTeacherResponse(result));
      if (lesson) markStep(lesson.id, "ai", true);
    } catch (err) {
      handleAiError(err);
    } finally {
      setAiBusy(false);
    }
  };

  /** 和 AI 演一遍：用课程场景开一段对话 */
  const startRoleplay = async () => {
    if (!lesson || aiBusy) return;
    setAiNotice("");
    setAiBusy(true);
    const opening = `我们按这个场景练一下：${lesson.ai.sceneTip}。你是「${lesson.ai.aiRole}」，我是「${lesson.ai.studentRole}」。请用泰语说第一句（附罗马音和中文）。`;
    pushAi("user", `（开始情景对话）${opening}`);
    try {
      const res = await askAiTeacher({
        message: opening,
        action: "conversation",
        profile: mergePlacementProfile(),
        scene: {
          id: lesson.id,
          title: lesson.ai.sceneTitle,
          description: lesson.scene,
          sceneTip: lesson.ai.sceneTip,
          roleplay: { studentRole: lesson.ai.studentRole, aiRole: lesson.ai.aiRole },
        },
        stage: { stage: 1, prompt: lesson.ai.sceneTip },
        history: [],
      });
      const data = res?.data;
      const text = data?.thai
        ? `${data.thai}${data.roman ? `\n${data.roman}` : ""}${
            data.chinese ? `\n${data.chinese}` : ""
          }`
        : "";
      if (text) {
        pushAi("assistant", text);
        markStep(lesson.id, "ai", true);
      } else {
        setAiNotice("AI 老师没有返回内容，请重试。");
      }
    } catch (err) {
      handleAiError(err);
    } finally {
      setAiBusy(false);
    }
  };

  /* =====================================================
     渲染
  ===================================================== */
  const header = (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/60">
        <Headphones className="h-3.5 w-3.5" />
        Media Learning · เรียนจากสื่อจริง
      </div>
      <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
        媒体学习
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/45">
        用泰剧、歌曲、综艺、新闻、社交媒体和文学学泰语。每节课都按同一套流程走：
        看场景 → 听原声 → 猜翻译 → 记词汇 → 懂语法 → 懂文化 → 开口练一遍。
      </p>
    </div>
  );

  /* ---------------- 课程详情 ---------------- */
  if (lesson) {
    const category = getCategory(lesson.type);
    const doneCount = Object.keys(doneSteps).length;
    const percent = Math.round((doneCount / MEDIA_STEPS.length) * 100);
    const isDone = progress?.status === "done";

    return (
      <div className="mx-auto max-w-4xl pb-24">
        {/* 顶部：返回 + 课程信息 */}
        <button
          type="button"
          onClick={closeLesson}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-emerald-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回媒体学习
        </button>

        <div className="apple-surface mb-5 rounded-2xl border border-white/[0.08] bg-black/40 p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl ${
                TYPE_TONE[lesson.type] || "border-white/10 bg-white/[0.04]"
              }`}
            >
              {category?.emoji}
            </span>
            <div className="mr-auto min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {category?.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/50">
                  {lesson.level}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-white/35">
                  <Clock className="h-3 w-3" />
                  {lesson.minutes} 分钟
                </span>
              </div>
              <h1 className="mt-1 text-lg font-bold text-white sm:text-xl">
                {lesson.title}
              </h1>
              <div className="mt-0.5 text-[10px] text-white/30">
                {lesson.source}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleFavorite(lesson.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
                  media.isFavorite(lesson.id)
                    ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-200"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:border-yellow-300/30 hover:text-yellow-200"
                }`}
              >
                {media.isFavorite(lesson.id) ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {media.isFavorite(lesson.id) ? "已收藏" : "收藏"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLessonDone(lesson.id, !isDone);
                  if (!isDone) addMinutes(lesson.id, lesson.minutes || 0);
                  recordStudy({
                    lessonId: lesson.id,
                    title: lesson.title,
                    type: lesson.type,
                    action: isDone ? "取消完成" : "学完一课",
                  });
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
                  isDone
                    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:border-emerald-300/30 hover:text-emerald-200"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                {isDone ? "已学完" : "标记学完"}
              </button>
            </div>
          </div>

          {/* 七步进度 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {MEDIA_STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                title={s.hint}
                onClick={() =>
                  document
                    .getElementById(`step-${s.key}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                  stepDone(s.key)
                    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-white/45 hover:border-emerald-300/25"
                }`}
              >
                <span className="text-white/30">{i + 1}</span>
                {s.label}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2 text-[11px] font-bold text-emerald-200">
              {percent}%
              <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* ① 原始内容 */}
          <StepSection
            stepKey="scene"
            index={1}
            done={stepDone("scene")}
            onToggleDone={() => toggleStep("scene")}
            extra={
              <button
                type="button"
                onClick={() => speak("all", lesson.thaiText, 0.78)}
                className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200"
              >
                {speakingKey === "all" ? (
                  <Square className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {speakingKey === "all" ? "停止" : "听整段"}
              </button>
            }
          >
            <p className="text-sm leading-6 text-white/70">{lesson.scene}</p>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-5 text-white/40">
              {lesson.romanization}
            </div>
          </StepSection>

          {/* ② 泰文字幕 */}
          <StepSection
            stepKey="subtitle"
            index={2}
            done={stepDone("subtitle")}
            onToggleDone={() => toggleStep("subtitle")}
          >
            <div className="space-y-2">
              {lesson.lines.map((line, i) => (
                <div
                  key={`${lesson.id}-line-${i}`}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 transition ${
                    selectedLine === i
                      ? "border-emerald-300/25 bg-emerald-400/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLine(i);
                      speak(`line-${i}`, line.thai, 0.75);
                      if (!stepDone("subtitle")) markStep(lesson.id, "subtitle", true);
                    }}
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                    aria-label="播放这一句"
                  >
                    {speakingKey === `line-${i}` ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLine(i);
                      if (!stepDone("subtitle")) markStep(lesson.id, "subtitle", true);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
                        {line.speaker}
                      </span>
                      <span className="text-sm font-medium leading-6 text-white/90">
                        {line.thai}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/35">{line.roman}</div>
                    {showTranslation && (
                      <div className="mt-0.5 text-[11px] text-emerald-100/70">
                        {line.cn}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </StepSection>

          {/* ③ 中文翻译 */}
          <StepSection
            stepKey="translation"
            index={3}
            done={stepDone("translation")}
            onToggleDone={() => toggleStep("translation")}
            extra={
              <button
                type="button"
                onClick={() => {
                  setShowTranslation((v) => !v);
                  if (!stepDone("translation")) markStep(lesson.id, "translation", true);
                }}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/50 hover:text-emerald-200"
              >
                {showTranslation ? "隐藏中文" : "显示中文"}
              </button>
            }
          >
            {showTranslation ? (
              <p className="whitespace-pre-line text-sm leading-7 text-white/75">
                {lesson.translation}
              </p>
            ) : (
              <p className="text-sm leading-6 text-white/35">
                先自己猜一遍意思，再点右上角「显示中文」核对——记忆效果比直接看翻译好得多。
              </p>
            )}
          </StepSection>

          {/* ④ 重点词汇 */}
          <StepSection
            stepKey="keywords"
            index={4}
            done={stepDone("keywords")}
            onToggleDone={() => toggleStep("keywords")}
            extra={
              <span className="text-[10px] text-white/35">
                已收 {savedWords.length} 词
              </span>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {lesson.keywords.map((k) => {
                const saved = media.isSavedWord(k.th);
                return (
                  <div
                    key={k.th}
                    className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => speak(`word-${k.th}`, k.th, 0.75)}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      aria-label="播放词汇"
                    >
                      {speakingKey === `word-${k.th}` ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-white/90">{k.th}</span>
                        <span className="text-[10px] text-white/35">{k.roman}</span>
                        <span className="text-[11px] text-emerald-100/80">{k.cn}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] leading-5 text-white/35">
                        {k.note}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        toggleSavedWord(k, lesson.id);
                        if (!stepDone("keywords")) markStep(lesson.id, "keywords", true);
                      }}
                      title={saved ? "从生词本移除" : "收进生词本"}
                      className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                        saved
                          ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/[0.04] text-white/40 hover:border-emerald-300/30 hover:text-emerald-200"
                      }`}
                    >
                      {saved ? "已收" : "+ 生词本"}
                    </button>
                  </div>
                );
              })}
            </div>
          </StepSection>

          {/* ⑤ 语法解释 */}
          <StepSection
            stepKey="grammar"
            index={5}
            done={stepDone("grammar")}
            onToggleDone={() => toggleStep("grammar")}
          >
            <div className="space-y-3">
              {lesson.grammar.map((g) => (
                <div
                  key={g.point}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="text-xs font-bold text-emerald-200">{g.point}</div>
                  <p className="mt-1 text-[12px] leading-6 text-white/65">{g.explain}</p>
                  <div className="mt-2 rounded-lg bg-black/30 p-2 text-[11px] text-white/50">
                    例：{g.example}
                  </div>
                </div>
              ))}
            </div>
          </StepSection>

          {/* ⑥ 文化背景 */}
          <StepSection
            stepKey="culture"
            index={6}
            done={stepDone("culture")}
            onToggleDone={() => toggleStep("culture")}
          >
            <p className="text-[13px] leading-7 text-white/70">
              {renderBold(lesson.culture)}
            </p>
          </StepSection>

          {/* ⑦ AI 练习 */}
          <StepSection
            stepKey="ai"
            index={7}
            done={stepDone("ai")}
            onToggleDone={() => toggleStep("ai")}
          >
            {!aiTeacher ? (
              <p className="text-sm text-white/40">
                AI 老师功能已关闭，可在设置中心开启。
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[11px] font-semibold text-white/60">
                    情景练习：{lesson.ai.sceneTitle}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/35">
                    {lesson.ai.sceneTip}（你是「{lesson.ai.studentRole}」，AI 是「
                    {lesson.ai.aiRole}」）
                  </div>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={startRoleplay}
                    className="mt-2 flex items-center gap-1.5 rounded-xl border border-pink-300/25 bg-pink-400/10 px-3 py-2 text-[11px] font-semibold text-pink-200 transition hover:bg-pink-400/20 disabled:opacity-40"
                  >
                    {aiBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    和 AI 演一遍
                  </button>
                </div>

                {/* 三种提问任务 */}
                <div className="flex flex-wrap gap-2">
                  {AI_TASKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.hint}
                      onClick={() => {
                        setAiTask(t.id);
                        const target =
                          lesson.lines[selectedLine]?.thai || lesson.thaiText;
                        askAi(target, t.id);
                      }}
                      disabled={aiBusy}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${
                        aiTask === t.id
                          ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/[0.04] text-white/50 hover:border-emerald-300/30 hover:text-emerald-200"
                      }`}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-white/30">
                  当前讲解的是第 {selectedLine + 1} 句：
                  {lesson.lines[selectedLine]?.thai}
                </div>

                <div className="space-y-2">
                  {aiMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 text-[12px] leading-6 whitespace-pre-line ${
                        m.role === "user"
                          ? "border-white/[0.06] bg-white/[0.03] text-white/60"
                          : "border-emerald-300/20 bg-emerald-400/[0.06] text-white/85"
                      }`}
                    >
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {m.role === "user" ? "你" : "AI 老师"}
                      </div>
                      {renderBold(m.content)}
                    </div>
                  ))}
                  {aiBusy && (
                    <div className="flex items-center gap-2 text-[11px] text-white/40">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      AI 老师正在思考…
                    </div>
                  )}
                </div>

                {aiNotice && (
                  <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-[11px] text-amber-100/90">
                    {aiNotice}
                  </div>
                )}

                {/* 自由提问 */}
                <div className="space-y-2">
                  <div className="text-[11px] text-white/50">
                    试试这个问题：{renderBold(lesson.ai.question)}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          const text = aiInput;
                          setAiInput("");
                          askAi(text);
                        }
                      }}
                      placeholder="就这段素材向 AI 老师提问…"
                      className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/40"
                    />
                    <button
                      type="button"
                      disabled={aiBusy || !aiInput.trim()}
                      onClick={() => {
                        const text = aiInput;
                        setAiInput("");
                        askAi(text);
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2.5 text-[11px] font-semibold text-emerald-200 transition disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      提问
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => askAi(lesson.ai.question)}
                    disabled={aiBusy}
                    className="text-[11px] text-emerald-200/80 underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    让老师回答这个问题 →
                  </button>
                </div>
              </div>
            )}
          </StepSection>
        </div>

        {/* 上一课 / 下一课 */}
        <div className="mt-5 flex items-center gap-3">
          {prevLesson ? (
            <button
              type="button"
              onClick={() => openLesson(prevLesson.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition hover:border-emerald-300/25"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-white/40" />
              <span className="min-w-0">
                <span className="block text-[10px] text-white/35">上一课</span>
                <span className="block truncate text-xs font-semibold text-white/80">
                  {prevLesson.title}
                </span>
              </span>
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {nextLesson ? (
            <button
              type="button"
              onClick={() => openLesson(nextLesson.id)}
              className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-right transition hover:border-emerald-300/25"
            >
              <span className="min-w-0">
                <span className="block text-[10px] text-white/35">下一课</span>
                <span className="block truncate text-xs font-semibold text-white/80">
                  {nextLesson.title}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    );
  }

  /* ---------------- 列表页 ---------------- */
  return (
    <div className="mx-auto max-w-6xl pb-16">
      {header}
      <SummaryBar summary={media.summary} />

      {/* 搜索 + 过滤 */}
      <div className="mb-5 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索：字幕 / ซับ / 新闻 / 叠词…"
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/40"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveType("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              activeType === "all"
                ? "bg-emerald-400 text-[#061513]"
                : "border border-white/[0.1] bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            ✨ 全部 · {stats.total}
          </button>
          {mediaCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveType(c.id)}
              title={c.desc}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeType === c.id
                  ? "bg-emerald-400 text-[#061513]"
                  : "border border-white/[0.1] bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
              }`}
            >
              {c.emoji} {c.label} · {stats.byType[c.id] || 0}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-white/30">难度</span>
          {["all", ...LEVELS].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevelFilter(lv)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                levelFilter === lv
                  ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-emerald-200"
              }`}
            >
              {lv === "all" ? "全部" : lv}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold transition ${
              favOnly
                ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-200"
                : "border-white/10 bg-white/[0.03] text-white/45 hover:text-yellow-200"
            }`}
          >
            <Star className={`h-3 w-3 ${favOnly ? "fill-yellow-300" : ""}`} />
            只看收藏 · {media.summary.favorites}
          </button>
          {savedWords.length > 0 && (
            <button
              type="button"
              onClick={() => setSavedWordsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-200"
            >
              <BookOpen className="h-3 w-3" />
              我的生词本 · {savedWords.length}
            </button>
          )}
        </div>

        {savedWordsOpen && savedWords.length > 0 && (
          <div className="apple-surface rounded-2xl border border-white/[0.08] bg-black/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/60">
              <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
              媒体学习生词本
              <span className="text-white/30">（点词听发音）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedWords.map((w) => (
                <button
                  key={w.th}
                  type="button"
                  onClick={() => speak(`saved-${w.th}`, w.th, 0.75)}
                  className="flex items-baseline gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] transition hover:border-emerald-300/30"
                >
                  <span className="font-semibold text-white/85">{w.th}</span>
                  <span className="text-white/45">{w.cn}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 课程网格 */}
      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <LessonCard
              key={l.id}
              lesson={l}
              favorite={media.isFavorite(l.id)}
              progress={media.progressOf(l.id)}
              onOpen={() => openLesson(l.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/40">
          没有符合条件的课程，换个分类或清掉筛选试试。
        </div>
      )}

      {/* 最近学习 + 学习记录 */}
      {(media.recentIds.length > 0 || media.records.length > 0) && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {media.recentIds.length > 0 && (
            <div className="apple-surface rounded-2xl border border-white/[0.08] bg-black/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/60">
                <Target className="h-3.5 w-3.5 text-emerald-300" />
                继续学
              </div>
              <div className="space-y-2">
                {media.recentIds.map((id) => {
                  const l = getLessonById(id);
                  if (!l) return null;
                  const p = media.progressOf(id);
                  const done = p ? Object.keys(p.steps || {}).length : 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openLesson(id)}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition hover:border-emerald-300/25"
                    >
                      <span className="text-base">{getCategory(l.type)?.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white/85">
                          {l.title}
                        </span>
                        <span className="block text-[10px] text-white/35">
                          七步已完成 {done}/{MEDIA_STEPS.length}
                          {p?.status === "done" ? " · 已学完" : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {media.records.length > 0 && (
            <div className="apple-surface rounded-2xl border border-white/[0.08] bg-black/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/60">
                <Brain className="h-3.5 w-3.5 text-emerald-300" />
                学习记录
              </div>
              <div className="space-y-1.5">
                {media.records.map((r) => (
                  <div
                    key={`${r.at}-${r.lessonId}`}
                    className="flex items-center gap-2 text-[11px] text-white/45"
                  >
                    <span className="shrink-0 text-white/25">
                      {String(r.at).slice(5, 16).replace("T", " ")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/70">
                      {r.action}：{r.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-[10px] leading-5 text-white/25">
        全部泰语素材均为教学原创编写（按泰剧、民谣、综艺、新闻、社交、诗歌的真实语体写成），
        非任何真实剧集、歌曲或新闻稿原文，可放心练习与分享。
      </p>
    </div>
  );
}
