// src/pages/PlacementTest.jsx
//
// =========================================================
// AI 入学测试（Placement Test）
// =========================================================
//
// 路由：/placement-test（注册后自动进入）
//
// 六部分：
//   ① 泰语水平测试（**自适应 12~20 题**，7 个板块含听力）→ CEFR 等级 A0~C1
//      出题由 src/lib/placement.js 的 createAdaptiveState / nextPlacementQuestion 驱动：
//      答对升一带、答错降一带，方向反转则步长减半，收敛即收卷。
//      听力题用浏览器泰语语音朗读（无泰语语音时自动跳过整个听力板块）。
//   ② CEFR 自评（Can-Do，多选）—— 参与等级校准
//   ③ 学习目标（单选 7 选 1）
//   ④ 专业方向（多选 5）
//   ⑤ 兴趣媒体（多选 9）
//   ⑥ 学习方式（多选 4）
//   → 生成学习画像（存 user_profiles）+ 个性化学习路线 → 自动进入首页
//
// 数据流：
//   scorePlacement()（src/lib/placement.js）算等级与板块正确率
//   → saveProfile()（src/lib/userProfile.js）写后端 + 本地缓存
//   → buildLearningPath() 生成路线卡，首页「我的学习画像」读同一份数据
// =========================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Compass,
  GraduationCap,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";

import {
  CAN_DO_STATEMENTS,
  LEARNING_GOALS,
  LEARNING_STYLES,
  MEDIA_INTERESTS,
  PLACEMENT_ADAPTIVE,
  PLACEMENT_SECTIONS,
  PROFESSIONAL_DIRECTIONS,
} from "@/data/placementTest";
import {
  adaptiveProgress,
  advanceAdaptiveState,
  availablePlacementQuestions,
  buildLearningPath,
  createAdaptiveState,
  deriveTargetScenario,
  directionTitles,
  getLevelMeta,
  goalTitle,
  mediaTitles,
  nextPlacementQuestion,
  scorePlacement,
  styleTitles,
} from "@/lib/placement";
import { hasThaiVoice, speakThai, stopThaiAudio } from "@/lib/thaiSpeech";
import {
  saveProfile,
  useUserProfile,
} from "@/lib/userProfile";
import { applyProfileDefaults } from "@/lib/profileDriven";

const OPTION_LABELS = ["A", "B", "C", "D"];

/* 自适应题量：最少 / 最多（实际题数由引擎按收敛情况决定） */
const MIN_QUESTIONS = PLACEMENT_ADAPTIVE.min;
const MAX_QUESTIONS = PLACEMENT_ADAPTIVE.max;

const STEP_ORDER = [
  "intro",
  "quiz",
  "cando",
  "goal",
  "direction",
  "media",
  "style",
  "result",
];

const PART_LABELS = {
  quiz: "水平测试",
  cando: "能力自评",
  goal: "学习目标",
  direction: "专业方向",
  media: "兴趣媒体",
  style: "学习方式",
};

/* =========================================================
   页面
========================================================= */

export default function PlacementTest() {
  const navigate = useNavigate();
  const { profile: existingProfile } = useUserProfile();

  const [step, setStep] = useState("intro");
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);

  /* 自适应会话：题库 / 已出题顺序 / 自适应状态 / 自评 */
  const [askedIds, setAskedIds] = useState([]);
  const [adaptive, setAdaptive] = useState(() => createAdaptiveState());
  const [canDo, setCanDo] = useState([]);

  /* 浏览器有没有泰语语音：没有就整场跳过听力板块（否则那些题没法答） */
  const [withListening] = useState(() => {
    try {
      return hasThaiVoice();
    } catch {
      return false;
    }
  });

  const [learningGoal, setLearningGoal] = useState("");
  const [directions, setDirections] = useState([]);
  const [media, setMedia] = useState([]);
  const [styles, setStyles] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [autoJump, setAutoJump] = useState(true);
  /* 本画像应用后的默认词书（用于结果页标注） */
  const [appliedBook, setAppliedBook] = useState(null);

  /* 本次测验可用的题库（听力题依赖泰语语音） */
  const pool = useMemo(
    () => availablePlacementQuestions({ withListening }),
    [withListening]
  );

  /* 已出过的题目对象（按顺序） */
  const askedQuestions = useMemo(
    () => askedIds.map((id) => pool.find((item) => item.id === id)).filter(Boolean),
    [askedIds, pool]
  );

  const question = askedQuestions[current] || null;
  const answeredCount = Object.keys(answers).length;

  const result = useMemo(
    () => scorePlacement(answers, { canDo, withListening }),
    [answers, canDo, withListening]
  );

  /* ---------------- 画像与路线（结果页渲染用） ---------------- */

  const draftProfile = useMemo(() => {
    const targetScenario = deriveTargetScenario(learningGoal, directions);

    return {
      thaiLevel: result.level,
      learningGoal,
      professionalDirection: directions,
      mediaInterest: media,
      learningStyle: styles,
      targetScenario,
      testScore: result.percent,
      testDetail: {
        score: result.score,
        maxScore: result.maxScore,
        percent: result.percent,
        correct: result.correct,
        total: result.total,
        rawLevel: result.rawLevel,
        capped: result.capped,
        capReason: result.capReason,
        capReasons: result.capReasons,
        scriptCorrect: result.scriptCorrect,
        scriptTotal: result.scriptTotal,
        bandScores: result.bandScores,
        sectionScores: result.sectionScores,
        /* 本次升级新增：听力表现、CEFR 自评、判级把握度、题量 */
        listening: result.listening,
        canDo: result.canDo,
        confidence: result.confidence,
        questionCount: result.total,
        withListening: result.withListening,
      },
    };
  }, [result, learningGoal, directions, media, styles]);

  const path = useMemo(
    () => buildLearningPath(draftProfile),
    [draftProfile]
  );

  /* ---------------- 结果页：落库 + 自动进入首页 ---------------- */

  const persist = useCallback(async () => {
    setSaving(true);
    setSaveError("");

    /* 画像 → 产品默认值：按等级设置默认词书（force：刚测完一定应用） */
    try {
      const applied = applyProfileDefaults(draftProfile, { force: true });
      if (applied) setAppliedBook(applied);
    } catch (error) {
      console.error("应用画像默认词书失败:", error);
    }

    try {
      await saveProfile(draftProfile);
    } catch (error) {
      console.error("保存学习画像失败:", error);
      setSaveError(
        error?.response?.data?.message ||
          "网络异常，画像已存在本机；恢复网络后再次完成测试即可补写云端。"
      );
    } finally {
      setSaving(false);
    }
  }, [draftProfile]);

  /* 离开水平测试就停掉正在朗读的听力音频 */
  useEffect(() => {
    if (step === "quiz") return undefined;
    stopThaiAudio();
    return undefined;
  }, [step]);

  useEffect(() => {
    if (step !== "result") return;

    persist();

    if (!autoJump) return;

    const timer = setTimeout(() => navigate("/"), 8000);

    return () => clearTimeout(timer);
  }, [step, autoJump, persist, navigate]);

  /* ---------------- 交互 ---------------- */

  const pickFirstQuestion = useCallback(
    (answered = {}, asked = [], state = createAdaptiveState()) => {
      return nextPlacementQuestion({
        answers: answered,
        askedIds: asked,
        adaptive: state,
        pool,
      });
    },
    [pool]
  );

  const goNext = useCallback(() => {
    const index = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];

    if (next === "result") setAutoJump(true);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const goBack = useCallback(() => {
    const index = STEP_ORDER.indexOf(step);
    setStep(STEP_ORDER[Math.max(index - 1, 0)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* 开始（或重新开始）水平测试：清空作答、重置自适应、抽出第一题 */
  const startQuiz = useCallback(() => {
    stopThaiAudio();
    const state = createAdaptiveState();
    const first = pickFirstQuestion({}, [], state);

    setAnswers({});
    setAdaptive(state);
    setAskedIds(first ? [first.id] : []);
    setCurrent(0);
    setStep("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pickFirstQuestion]);

  /* =========================================================
     自适应答题流
     ---------------------------------------------------------
     一处状态，两条规则：
       • 每题作答后**立刻**记进 answers（测试结果需要完整作答记录）；
         逐题反馈只依赖"当前题有没有作答"，所以改答案时解析随之更新。
       • askedIds 是**追加**的：已经出过的题不再重新抽，
         往前翻看历史题时不会被"重算"成另一道题。
     ========================================================= */

  /* 当前题的作答（未答返回 undefined） */
  const selectedOption = question ? answers[question.id] : undefined;

  const handleChoose = useCallback(
    (optionIndex) => {
      if (!question) return;
      setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }));
    },
    [question]
  );

  /* 进入下一题：先按本题对错推进自适应状态，再抽下一题 */
  const handleNextQuestion = useCallback(() => {
    if (!question) return;

    const isCorrect = answers[question.id] === question.answer;
    const nextState = advanceAdaptiveState(adaptive, isCorrect);

    const nextQuestion = nextPlacementQuestion({
      answers,
      askedIds,
      adaptive: nextState,
      pool,
    });

    setAdaptive(nextState);

    if (!nextQuestion) {
      /* 收敛：进入画像部分 */
      goNext();
      return;
    }

    setAskedIds((prev) => [...prev, nextQuestion.id]);
    setCurrent((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [question, answers, adaptive, askedIds, pool, goNext]);

  /* 从当前题往前一题：只移动游标，不改任何作答记录 */
  const handlePrevQuestion = useCallback(() => {
    setCurrent((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleIn = (list, setList, id) => {
    setList(
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
    );
  };

  const restart = () => {
    setAnswers({});
    setCurrent(0);
    setLearningGoal("");
    setDirections([]);
    setMedia([]);
    setStyles([]);
    setSaveError("");
    setStep("intro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* =========================================================
     渲染
  ========================================================= */

  return (
    <div className="relative mx-auto w-full max-w-4xl space-y-6 px-0 pb-16">
      {/* 顶部进度（结果页不显示） */}
      {step !== "intro" && step !== "result" && (
        <StepProgress step={step} />
      )}

      {/* 整屏步骤切换不用 AnimatePresence(mode="wait")：
          退出动画一旦被打断（快速连点 / 掉帧），新步骤会挂不上导致白屏，
          这里用普通条件渲染 + 入场动画，稳定优先。 */}
      <React.Fragment>
        {step === "intro" && (
          <IntroStep
            key="intro"
            existingProfile={existingProfile}
            onStart={startQuiz}
            onSkip={() => navigate("/")}
          />
        )}

        {step === "quiz" && question && (
          <QuizStep
            key={`quiz-${question.id}`}
            question={question}
            index={current}
            minQuestions={MIN_QUESTIONS}
            selected={selectedOption}
            answeredCount={answeredCount}
            onChoose={handleChoose}
            onPrev={handlePrevQuestion}
            onNext={handleNextQuestion}
          />
        )}

        {/* 水平测试结束但一题都没出（题库异常）时的兜底出口 */}
        {step === "quiz" && !question && (
          <div className="premium-glass rounded-[26px] p-8 text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-yellow-300/70" />
            <p className="mt-3 text-sm text-white/60">
              水平测试暂时无法出题，可以直接继续填写学习画像。
            </p>
            <button
              onClick={goNext}
              className="mt-5 rounded-xl bg-emerald-400/15 px-5 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/25"
            >
              继续
            </button>
          </div>
        )}

        {step === "cando" && (
          <CanDoStep
            key="cando"
            selected={canDo}
            onToggle={(id) =>
              setCanDo((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === "goal" && (
          <ChoiceStep
            key="goal"
            multi={false}
            icon={<Target className="h-5 w-5 text-emerald-300" />}
            part="第 2 部分"
            title="你学泰语，主要想做什么？"
            subtitle="单选。这决定你的学习路线主线和推荐场景。"
            options={LEARNING_GOALS}
            selected={learningGoal ? [learningGoal] : []}
            onSelect={(id) => setLearningGoal(id)}
            onBack={goBack}
            onNext={goNext}
            nextDisabled={!learningGoal}
            nextLabel="下一步"
          />
        )}

        {step === "direction" && (
          <ChoiceStep
            key="direction"
            multi
            icon={<GraduationCap className="h-5 w-5 text-emerald-300" />}
            part="第 3 部分"
            title="想专精哪个方向？"
            subtitle="可多选，也可以先跳过；之后随时能重测调整。"
            options={PROFESSIONAL_DIRECTIONS}
            selected={directions}
            onSelect={(id) => toggleIn(directions, setDirections, id)}
            onBack={goBack}
            onNext={goNext}
            nextLabel="下一步"
          />
        )}

        {step === "media" && (
          <ChoiceStep
            key="media"
            multi
            icon={<Sparkles className="h-5 w-5 text-emerald-300" />}
            part="第 4 部分"
            title="平时喜欢看/听哪些泰国内容？"
            subtitle="可多选。选得越准，推荐的听力与阅读材料越对味。"
            options={MEDIA_INTERESTS}
            selected={media}
            onSelect={(id) => toggleIn(media, setMedia, id)}
            onBack={goBack}
            onNext={goNext}
            nextLabel="下一步"
          />
        )}

        {step === "style" && (
          <ChoiceStep
            key="style"
            multi
            icon={<BookOpen className="h-5 w-5 text-emerald-300" />}
            part="第 5 部分"
            title="你更习惯哪种学习方式？"
            subtitle="可多选。我们会据此安排每日任务的练习类型。"
            options={LEARNING_STYLES}
            selected={styles}
            onSelect={(id) => toggleIn(styles, setStyles, id)}
            onBack={goBack}
            onNext={goNext}
            nextLabel="生成我的学习档案"
          />
        )}

        {step === "result" && (
          <ResultStep
            key="result"
            result={result}
            profile={draftProfile}
            path={path}
            appliedBook={appliedBook}
            saving={saving}
            saveError={saveError}
            autoJump={autoJump}
            onCancelAutoJump={() => setAutoJump(false)}
            onRetrySave={persist}
            onEnter={() => navigate("/")}
            onRestart={restart}
          />
        )}
      </React.Fragment>
    </div>
  );
}

/* =========================================================
   顶部步骤条
========================================================= */

function StepProgress({ step }) {
  /* 与 STEP_ORDER 保持一致（除 intro / result 这两个不进度的步骤）。
     新增「能力自评」这一步时忘了同步这里，进度条就会少显示一段。 */
  const parts = ["quiz", "cando", "goal", "direction", "media", "style"];
  const activeIndex = parts.indexOf(step);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="flex items-center justify-between gap-1">
        {parts.map((part, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;

          return (
            <div key={part} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  done
                    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                    : active
                      ? "border-yellow-300/40 bg-yellow-300/15 text-yellow-100"
                      : "border-white/10 bg-white/[0.03] text-white/25"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </div>

              <span
                className={`hidden truncate text-[11px] sm:block ${
                  active ? "text-white/80" : "text-white/30"
                }`}
              >
                {PART_LABELS[part]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   介绍页
========================================================= */

function IntroStep({ existingProfile, onStart, onSkip }) {
  const levelMeta = existingProfile
    ? getLevelMeta(existingProfile.thaiLevel)
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-glass relative overflow-hidden rounded-[26px] p-6 sm:p-9"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/[0.08] blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-emerald-300/70">
          <Compass className="h-4 w-4" />
          AI PLACEMENT TEST · 入学测试
        </div>

        <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">
          先摸清你的起点，
          <br className="hidden sm:block" />
          再决定怎么学。
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
          约 5 分钟：水平测试会**根据你的作答实时调整难度**（12~20 题，含听音辨词），
          再问你的目标、方向、兴趣与学习方式。
          完成后生成你的专属学习档案与学习路线，直接进入学习主页。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <IntroTile
            icon={<Clock className="h-4 w-4" />}
            title="约 5 分钟"
            desc={`自适应 ${MIN_QUESTIONS}~${MAX_QUESTIONS} 题 + 5 组选择`}
          />
          <IntroTile
            icon={<Trophy className="h-4 w-4" />}
            title="A0 ~ C1 定级"
            desc="对标 CEFR，答案越准难度越贴合"
          />
          <IntroTile
            icon={<Sparkles className="h-4 w-4" />}
            title="生成学习档案"
            desc="画像 + 路线 + 每日任务建议"
          />
        </div>

        {levelMeta && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.05] p-4">
            <AlertCircle className="h-4 w-4 shrink-0 text-yellow-200/70" />
            <p className="text-xs leading-5 text-white/50">
              你已有学习档案：当前等级{" "}
              <span className="font-bold text-yellow-200/90">
                {levelMeta.id} · {levelMeta.title}
              </span>
              。重新测试会覆盖原有画像与路线。
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            onClick={onStart}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4" />
            {levelMeta ? "重新测试" : "开始入学测试"}
          </button>

          <button
            onClick={onSkip}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm text-white/55 transition hover:text-white"
          >
            稍后再说，先去学习
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function IntroTile({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-emerald-300/70">{icon}</div>
      <div className="mt-2 text-sm font-bold text-white/85">{title}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/35">{desc}</div>
    </div>
  );
}

/* =========================================================
   水平测试（逐题 · 自适应）
   ---------------------------------------------------------
   与旧版的三个差别：
     ① 题号不再写死：题量是浮动的，进度按"最少题数"推进，
        超过最少题数后显示"正在确认难度"；
     ② 听力题有「播放」按钮（浏览器泰语语音），可重听；
     ③ 选完立刻给对错与解析 —— 把测试同时变成一次学习，
        也让用户理解自己为什么被定在这个等级（旧版是纯黑箱）。
========================================================= */

function QuizStep({
  question,
  index,
  minQuestions,
  selected,
  answeredCount,
  onChoose,
  onPrev,
  onNext,
}) {
  const section = PLACEMENT_SECTIONS.find((item) => item.id === question.section);
  const isListening = question.modality === "listening";
  const answered = selected !== undefined;
  const isCorrect = answered && selected === question.answer;

  const progress = adaptiveProgress(answeredCount);
  const settled = answeredCount >= minQuestions;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
        <div className="flex items-center justify-between text-[11px] text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-emerald-300/80">{section?.emoji}</span>
            {section?.label}
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35">
              难度 {question.band}
            </span>
          </span>
          <span>
            第 {index + 1} 题
            {settled ? "（正在确认难度）" : ` · 最少 ${minQuestions} 题`}
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
          />
        </div>
      </div>

      <div className="premium-glass rounded-[26px] p-5 sm:p-7">
        <h2 className="text-base font-semibold leading-relaxed text-white/90 sm:text-lg">
          {question.q}
        </h2>

        {/* 听力题：只听不看，所以题干区只有播放控件 */}
        {isListening ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-4">
            <button
              type="button"
              onClick={() => speakThai(question.audio, { rate: 0.8 })}
              className="flex min-h-11 min-w-[112px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-5 text-sm font-bold text-[#04110f] transition hover:brightness-110"
            >
              <Volume2 className="h-4 w-4" />
              播放
            </button>
            <button
              type="button"
              onClick={() => speakThai(question.audio, { rate: 0.6 })}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-4 text-[12px] font-semibold text-white/60 transition hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              慢速再听
            </button>
            <span className="text-[11px] leading-5 text-white/40">
              可以反复听，直到听清为止
            </span>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isAnswer = question.answer === optionIndex;

            /* 已经作答后：正确项描绿、选错的那项描红，其余淡化 */
            let tone =
              "border-white/10 bg-white/[0.035] text-white/60 hover:border-emerald-300/25 hover:text-white";

            if (answered) {
              if (isAnswer) {
                tone = "border-emerald-300/50 bg-emerald-400/15 text-emerald-50";
              } else if (isSelected) {
                tone = "border-red-400/40 bg-red-400/10 text-red-100/85";
              } else {
                tone = "border-white/[0.06] bg-white/[0.02] text-white/35";
              }
            } else if (isSelected) {
              tone = "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
            }

            return (
              <button
                key={optionIndex}
                onClick={() => onChoose(optionIndex)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] transition-all ${tone}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 text-[10px] text-white/40">
                  {OPTION_LABELS[optionIndex]}
                </span>
                <span className="flex-1">{option}</span>
                {answered && isAnswer ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 逐题反馈：这是旧版完全缺失的一环 */}
        {answered ? (
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              isCorrect
                ? "border-emerald-300/25 bg-emerald-400/[0.07]"
                : "border-yellow-300/25 bg-yellow-300/[0.06]"
            }`}
          >
            <p
              className={`flex items-center gap-2 text-[13px] font-bold ${
                isCorrect ? "text-emerald-200" : "text-yellow-100/90"
              }`}
            >
              {isCorrect ? (
                <>
                  <Check className="h-4 w-4" /> 答对了
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" /> 正确答案：
                  {question.options[question.answer]}
                </>
              )}
            </p>
            <p className="mt-2 text-[12px] leading-6 text-white/55">
              {question.explain}
            </p>
            {isListening ? (
              <p className="mt-2 text-[11px] leading-5 text-white/35">
                你听到的是：
                <span className="ml-1 font-viaoda text-emerald-200/80">
                  {question.audio}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          上一题
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/25">
            {answered ? "已作答" : "请选择答案"}
          </span>

          <button
            onClick={onNext}
            disabled={!answered}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400/10 px-6 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一题
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

/* =========================================================
   CEFR 自评（Can-Do）：语言测试的标准做法
   ---------------------------------------------------------
   自评不单独定级，但能校准：如果自评明显低于实测，说明本人信心不足，
   下调一档更安全（详见 placement.js 的融合逻辑）。所以这一屏要讲清楚
   "这不是考试，是帮你校准起点"。
========================================================= */

function CanDoStep({ selected, onToggle, onBack, onNext }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="premium-glass rounded-[26px] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-emerald-300/70">
          <Check className="h-4 w-4" />
          第 2 部分 · 能力自评
        </div>

        <h2 className="mt-3 text-lg font-bold text-white/90 sm:text-xl">
          下面这些事，你现在能做到哪些？
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-white/45">
          如实勾选即可（可多选、可全不选）。语言测试里自评不单独决定等级，
          只用来校准——如果你勾得比测试结果保守，我们会把起点调低一点，避免一上来就太难。
        </p>

        <div className="mt-5 space-y-2.5">
          {CAN_DO_STATEMENTS.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                  active
                    ? "border-emerald-300/40 bg-emerald-400/[0.12]"
                    : "border-white/10 bg-white/[0.035] hover:border-emerald-300/25"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    active ? "border-emerald-300 bg-emerald-400 text-[#04110f]" : "border-white/20"
                  }`}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="text-lg" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white/85">
                    {item.text}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-white/30">
                    对应 CEFR {item.level}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          上一题
        </button>

        <button
          onClick={onNext}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400/10 px-6 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
        >
          下一步
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.section>
  );
}

/* =========================================================
   画像选择（目标 / 方向 / 媒体 / 方式 复用同一组件）
========================================================= */

function ChoiceStep({
  multi = false,
  icon,
  part,
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onBack,
  onNext,
  nextLabel = "下一步",
  nextDisabled = false,
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      <div className="premium-glass rounded-[26px] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-emerald-300/70">
          {icon}
          {part}
        </div>

        <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
          {title}
        </h2>

        <p className="mt-2 text-xs leading-5 text-white/40">{subtitle}</p>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {options.map((option) => {
            const active = selected.includes(option.id);

            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.id)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-emerald-300/40 bg-emerald-400/[0.12]"
                    : "border-white/[0.07] bg-white/[0.025] hover:border-emerald-300/25 hover:bg-white/[0.05]"
                }`}
              >
                <span className="text-xl leading-none">{option.emoji}</span>

                <span className="flex-1">
                  <span
                    className={`block text-sm font-bold ${
                      active ? "text-emerald-100" : "text-white/80"
                    }`}
                  >
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/35">
                    {option.desc}
                  </span>
                </span>

                {multi && (
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      active
                        ? "border-emerald-300/50 bg-emerald-400/25 text-emerald-100"
                        : "border-white/15"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          上一步
        </button>

        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.section>
  );
}

/* =========================================================
   结果页：等级 + 画像 + 学习路线
========================================================= */

function ResultStep({
  result,
  profile,
  path,
  /* 画像应用后的默认词书：由 persist() 写入父组件 state，这里只读展示 */
  appliedBook,
  saving,
  saveError,
  autoJump,
  onCancelAutoJump,
  onRetrySave,
  onEnter,
  onRestart,
}) {
  const levelMeta = path.level;
  const capped = result.capped;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* 等级 */}
      <div className="premium-glass relative overflow-hidden rounded-[26px] p-6 text-center sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/[0.08] blur-3xl" />

        <div className="relative">
          <div className="text-[11px] font-semibold tracking-[0.24em] text-emerald-300/70">
            YOUR THAI LEVEL
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/20 to-teal-400/10">
              <span className="text-3xl font-black text-emerald-200">
                {levelMeta.id}
              </span>
            </div>

            <div className="text-left">
              <div className="text-xl font-black text-white">
                {levelMeta.title}
              </div>
              <div className="mt-1 text-xs text-white/40">
                {levelMeta.subtitle}
              </div>
              <div className="mt-2 text-[11px] text-white/30">
                自适应测试 {result.total} 题 · 答对 {result.correct} 题 · 得分率{" "}
                {result.percent}%
              </div>

              {/* 判级把握度：题量越多、难度带越集中越可信。
                  让用户知道"这个等级有多少把握"，而不是给一个绝对答案。 */}
              {typeof result.confidence === "number" ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] text-white/35">
                    判级把握度 {result.confidence}%
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-white/45">
            {levelMeta.desc}
          </p>

          {capped && (
            <p className="mx-auto mt-3 max-w-xl rounded-xl border border-yellow-300/15 bg-yellow-300/[0.05] px-3 py-2 text-[11px] leading-5 text-yellow-100/70">
              {result.capReason}
            </p>
          )}

          {saving && (
            <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/35">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在保存学习档案…
            </p>
          )}

          {!saving && !saveError && (
            <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-emerald-300/70">
              <Check className="h-3.5 w-3.5" />
              学习档案已保存到你的账号
            </p>
          )}

          {saveError && (
            <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-xl border border-red-300/15 bg-red-400/[0.06] px-3 py-2">
              <p className="text-[11px] leading-5 text-red-100/70">
                {saveError}
              </p>
              <button
                onClick={onRetrySave}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] text-white/70 transition hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                重试保存
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 六项能力 */}
      <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
        <h2 className="text-sm font-bold text-white/85">能力分布</h2>

        <div className="mt-4 space-y-2.5">
          {PLACEMENT_SECTIONS.map((section) => {
            const stat = result.sectionScores[section.id] || {
              correct: 0,
              total: 1,
            };
            const rate = Math.round((stat.correct / stat.total) * 100);

            return (
              <div key={section.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] text-white/45">
                  {section.label}
                </span>

                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${rate}%` }}
                    transition={{ duration: 0.6 }}
                    className={`h-full rounded-full ${
                      rate >= 67
                        ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                        : rate >= 34
                          ? "bg-gradient-to-r from-yellow-300 to-amber-300"
                          : "bg-gradient-to-r from-red-400/70 to-orange-300/70"
                    }`}
                  />
                </div>

                <span className="w-10 shrink-0 text-right text-[11px] text-white/35">
                  {stat.correct}/{stat.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 画像标签 */}
      <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
        <h2 className="text-sm font-bold text-white/85">我的学习画像</h2>

        <div className="mt-4 space-y-3">
          <ProfileRow
            label="学习目标"
            value={`${path.goalEmoji} ${goalTitle(profile.learningGoal) || "未选择"}`}
          />
          <ProfileRow
            label="专业方向"
            value={
              directionTitles(profile.professionalDirection).join(" · ") ||
              "暂未指定"
            }
          />
          <ProfileRow
            label="兴趣媒体"
            value={mediaTitles(profile.mediaInterest).join(" · ") || "暂未指定"}
          />
          <ProfileRow
            label="学习方式"
            value={styleTitles(profile.learningStyle).join(" · ") || "暂未指定"}
          />
          <ProfileRow
            label="目标场景"
            value={profile.targetScenario || "日常交流"}
          />
        </div>

        {/* 听力单独说：泰语是声调语言，听力是最能区分真实水平的维度 */}
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-white/70">
              🎧 听辨理解
            </span>
            {result.listening?.tested ? (
              <span className="text-[11px] tabular-nums text-white/40">
                {result.listening.correct}/{result.listening.total} 题正确
              </span>
            ) : (
              <span className="text-[11px] text-white/30">本次未测</span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] leading-6 text-white/40">
            {result.listening?.tested
              ? result.listening.rate >= 0.7
                ? "听辨表现不错：能靠声音区分词汇与句意，接下来可以进入更自然的语速。"
                : result.listening.rate >= 0.4
                  ? "听辨还有提升空间：建议每天做 5 分钟逐句精听，先练「听清」再练「听懂」。"
                  : "听辨偏弱：泰语靠声调区分词义，建议先用「听音选词」把声调听出来，再扩展句子。"
              : result.withListening === false
                ? "当前浏览器没有可用的泰语语音，所以本次跳过了听力题。换一台设备或安装泰语语音包后重测，可以拿到听力维度。"
                : "本次没有抽到听力题。"}
          </p>
        </div>

        {/* 自评校准：把"为什么被调档"讲明白 */}
        {result.canDo?.picked?.length ? (
          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <span className="text-[12px] font-bold text-white/70">
              📝 自评校准
            </span>
            <p className="mt-2 text-[11.5px] leading-6 text-white/40">
              你的自评上限是 {result.canDo.selfLevel}，
              {result.canDo.adjusted
                ? "比测试结果保守，因此我们把起点下调到你能确认掌握的难度。"
                : result.canDo.conflict
                  ? "比测试结果高不少。建议先按当前等级学两周，再重测一次确认。"
                  : "与测试结果基本一致。"}
            </p>
          </div>
        ) : null}
      </div>

      {/* 学习路线 */}
      <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-white/85">个性化学习路线</h2>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-0.5 text-[10px] text-emerald-200/70">
            {levelMeta.weeks}
          </span>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-white/35">
          每天约 {path.daily.minutes} 分钟 · {path.daily.words} 个新词 · 重点：
          {path.daily.focus}
        </p>

        <div className="mt-4 space-y-2.5">
          {path.stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/[0.08] text-[11px] font-bold text-emerald-200">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white/85">
                    {stage.title}
                  </span>
                  <span className="text-[10px] text-white/25">{stage.days}</span>
                </div>

                <p className="mt-1 text-[11px] leading-5 text-white/40">
                  {stage.desc}
                </p>

                <a
                  href={stage.to}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-200/80 transition hover:text-emerald-100"
                >
                  {stage.cta}
                  <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {path.books.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] text-white/35">
              推荐词书
              {appliedBook && (
                <span className="ml-2 text-emerald-200/70">
                  已按 {profile?.thaiLevel} 等级设为默认
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* 已应用的默认词书若不在推荐前三，也一并列出（否则看不到「默认」标记） */}
              {[
                ...path.books,
                ...(appliedBook &&
                !path.books.some((b) => b.id === appliedBook.id)
                  ? [appliedBook]
                  : []),
              ].map((book) => (
                <span
                  key={book.id}
                  className={`rounded-full border px-3 py-1.5 text-[11px] ${
                    appliedBook?.id === book.id
                      ? "border-emerald-300/30 bg-emerald-400/[0.10] text-emerald-100"
                      : "border-white/[0.08] bg-white/[0.03] text-white/55"
                  }`}
                >
                  {book.emoji} {book.name} · {book.count} 词
                  {appliedBook?.id === book.id ? " · 默认" : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {(path.weaknesses.length > 0 || path.skills.length > 0) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[11px] font-semibold text-yellow-200/70">
                优先补强
              </div>
              <ul className="mt-2 space-y-1.5">
                {path.weaknesses.length ? (
                  path.weaknesses.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-white/45"
                    >
                      <span>
                        {item.label}（{item.correct}/{item.total}）
                      </span>
                      <a
                        href={item.to}
                        className="shrink-0 text-emerald-200/70 hover:text-emerald-100"
                      >
                        {item.cta}
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="text-[11px] text-white/45">
                    各板块都拿到了，直接进主课巩固即可。
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[11px] font-semibold text-emerald-200/70">
                重点技能
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {path.skills.map((skill) => (
                  <a
                    key={skill.label}
                    href={skill.to}
                    className="rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[11px] text-emerald-100/70 transition hover:bg-emerald-400/15"
                  >
                    {skill.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onEnter}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5"
        >
          进入学习主页
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={onRestart}
          className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm text-white/55 transition hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          重新测试
        </button>
      </div>

      {autoJump && (
        <p className="text-center text-[11px] text-white/25">
          8 秒后自动进入学习主页 ·{" "}
          <button
            onClick={onCancelAutoJump}
            className="text-emerald-200/70 underline hover:text-emerald-100"
          >
            留在本页
          </button>
        </p>
      )}
    </motion.section>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex flex-wrap items-start gap-2 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="w-20 shrink-0 text-[11px] text-white/30">{label}</span>
      <span className="flex-1 text-[12px] leading-5 text-white/70">
        {value}
      </span>
    </div>
  );
}
