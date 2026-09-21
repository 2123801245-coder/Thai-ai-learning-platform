// src/pages/BasicReaderExam.jsx
//
// =========================================================
// 「基础泰语精读」结业测试
// =========================================================
//
// 路由：/course/:courseId/exam
//   出卷：从 14 篇课文的课后练习池随机抽 20 题（选项乱序），≥80% 通过
//   通过：写入结业证书（SceneCertificate 复用）+ 点亮全部课时（进度 100%）
//   未通过：给出错题解析，可换卷重考
//
// 门控：与课程一致 —— 需登录 + VIP（非 VIP 展示锁定卡与购买面板）
// =========================================================

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ClipboardList,
  Crown,
  Lock,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  BASIC_READER_COURSE_ID,
  EXAM_PASS_PERCENT,
  EXAM_POOL_SIZE,
  EXAM_QUESTION_COUNT,
  EXAM_VOCAB_TOTAL,
  buildExamPaper,
  scoreExam,
} from "@/data/basicReaderExam";
import { getCourseById, getCourseLessons } from "@/data/courses";
import {
  getCourseCertificate,
  markCourseCompleted,
} from "@/lib/courseProgress";
import { useAuth } from "@/lib/AuthContext";

import VipPanel from "@/components/common/VipPanel";
import SceneCertificate from "@/components/ai/SceneCertificate";

const OPTION_LABELS = ["A", "B", "C", "D"];

const formatDate = (iso) =>
  new Date(iso || Date.now()).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/* =========================================================
   页面
========================================================= */

export default function BasicReaderExam() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { user } = useAuth();
  const isVipUser = !!user?.isVip;

  const course = useMemo(() => getCourseById(courseId), [courseId]);
  const lessons = useMemo(
    () => (course ? getCourseLessons(course.id) : []),
    [course]
  );

  const isSupported = course?.id === BASIC_READER_COURSE_ID;

  const [vipOpen, setVipOpen] = useState(false);

  // 每次重考换 seed → 换一整套题与选项顺序
  const [seed, setSeed] = useState(() => Date.now());
  const [phase, setPhase] = useState("intro"); // intro | exam | result
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);
  const [certificate, setCertificate] = useState(() =>
    getCourseCertificate(courseId)
  );

  const paper = useMemo(
    () => (isSupported ? buildExamPaper(seed) : []),
    [isSupported, seed]
  );

  const answeredCount = Object.keys(answers).length;
  const question = paper[current] || null;

  /* ---------------- 交互 ---------------- */

  const chooseOption = (optionIndex) => {
    setAnswers((prev) => ({ ...prev, [current]: optionIndex }));
  };

  const startExam = () => {
    setSeed(Date.now());
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setPhase("exam");
  };

  const submitExam = () => {
    const scored = scoreExam(paper, answers);
    setResult(scored);

    if (scored.passed) {
      const cert = markCourseCompleted(course.id, {
        score: scored.correct,
        total: scored.total,
        percent: scored.percent,
        vocabTotal: EXAM_VOCAB_TOTAL,
        lessonIds: lessons.map((lesson) => lesson.id),
      });
      setCertificate(cert);
    }

    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewCertificate = () => {
    if (!certificate) return;
    setResult({
      correct: certificate.score,
      total: certificate.total,
      percent: certificate.percent,
      passed: true,
    });
    setPhase("result");
  };

  /* ---------------- 门控与兜底 ---------------- */

  if (!course || !isSupported) {
    return (
      <GateCard
        icon={<ClipboardList className="h-7 w-7 text-white/20" />}
        title="该课程暂无结业测试"
        description="结业测试目前仅对「基础泰语精读」开放。"
        actionLabel="返回课程"
        onAction={() => navigate("/course")}
      />
    );
  }

  if (!user) {
    return (
      <GateCard
        icon={<Lock className="h-7 w-7 text-white/25" />}
        title="请先登录后再参加结业测试"
        description="结业测试成绩与证书会保存到你的学习档案。"
        actionLabel="去登录"
        onAction={() => navigate("/login")}
      />
    );
  }

  if (!isVipUser) {
    return (
      <div className="relative space-y-6 pb-10">
        <BackButton onClick={() => navigate(`/course/${course.id}`)} />

        <div className="premium-glass relative overflow-hidden rounded-3xl p-6 text-center sm:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.06]">
            <Lock className="h-7 w-7 text-yellow-200/70" />
          </div>
          <h1 className="mt-5 text-xl font-black text-white sm:text-2xl">
            {course.title} · 结业测试
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
            结业测试与结业证书为 VIP 专属。开通后可参加考核，
            通过即点亮课程完成状态并颁发证书。
          </p>
          <button
            onClick={() => setVipOpen(true)}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl border border-yellow-300/15 bg-yellow-300/[0.06] px-6 py-3 text-sm font-semibold text-yellow-200/80 transition hover:bg-yellow-300/[0.12]"
          >
            <Crown className="h-4 w-4" />
            了解 VIP 权益
          </button>
        </div>

        <VipPanel open={vipOpen} onClose={() => setVipOpen(false)} />
      </div>
    );
  }

  /* ---------------- 分阶段渲染 ---------------- */

  return (
    <div className="relative space-y-6 pb-10">
      <BackButton onClick={() => navigate(`/course/${course.id}`)} />

      {/* 阶段切换（介绍/答题/结果）用普通条件渲染：
          AnimatePresence 的 mode="wait" 在退出动画被打断时会把新阶段卡住。 */}
      <React.Fragment>
        {phase === "intro" && (
          <IntroPanel
            key="intro"
            course={course}
            certificate={certificate}
            onStart={startExam}
            onViewCertificate={viewCertificate}
          />
        )}

        {phase === "exam" && question && (
          <ExamPanel
            key="exam"
            question={question}
            index={current}
            total={paper.length}
            answers={answers}
            answeredCount={answeredCount}
            onChoose={chooseOption}
            onPrev={() => setCurrent((i) => Math.max(0, i - 1))}
            onNext={() => setCurrent((i) => Math.min(paper.length - 1, i + 1))}
            onSubmit={submitExam}
          />
        )}

        {phase === "result" && result && (
          <ResultPanel
            key="result"
            result={result}
            paper={paper}
            answers={answers}
            certificate={certificate}
            user={user}
            onRetry={startExam}
            onBack={() => navigate(`/course/${course.id}`)}
          />
        )}
      </React.Fragment>

      <VipPanel open={vipOpen} onClose={() => setVipOpen(false)} />
    </div>
  );
}

/* =========================================================
   通用小件
========================================================= */

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-10 items-center gap-2 py-2 text-sm text-white/45 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      返回课程
    </button>
  );
}

function GateCard({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
          {icon}
        </div>
        <h1 className="mt-5 text-xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/30">{description}</p>
        <button
          onClick={onAction}
          className="mt-5 rounded-xl bg-emerald-400/10 px-5 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-400/20"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   介绍页
========================================================= */

function IntroPanel({ course, certificate, onStart, onViewCertificate }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="premium-glass relative overflow-hidden rounded-3xl p-6 sm:p-9"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/[0.06] blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-yellow-300/70">
          <Award className="h-4 w-4" />
          FINAL EXAM · 结业测试
        </div>

        <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">
          {course.title} · 结业考核
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
          覆盖 14 篇课文的词汇、句型与课文理解。每次随机抽题、选项顺序打乱，
          考核通过即点亮课程完成状态并颁发结业证书。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatTile label="题量" value={`${EXAM_QUESTION_COUNT} 题`} />
          <StatTile label="通过线" value={`${EXAM_PASS_PERCENT}%`} />
          <StatTile label="题源" value={`${EXAM_POOL_SIZE} 题池`} />
          <StatTile label="覆盖词汇" value={`${EXAM_VOCAB_TOTAL} 词条`} />
        </div>

        {certificate ? (
          <div className="mt-7 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  已通过结业考核
                </div>
                <p className="mt-1 text-xs text-white/35">
                  成绩 {certificate.score}/{certificate.total}（
                  {certificate.percent}%） · 颁发于{" "}
                  {formatDate(certificate.issuedAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onViewCertificate}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                >
                  <Award className="h-4 w-4" />
                  查看结业证书
                </button>
                <button
                  onClick={onStart}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/55 transition hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新挑战
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="mt-7 flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4" />
            开始结业测试
          </button>
        )}
      </div>
    </motion.section>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/25">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black text-white/85">{value}</div>
    </div>
  );
}

/* =========================================================
   答题页（逐题作答，不做即时正误反馈）
========================================================= */

function ExamPanel({
  question,
  index,
  total,
  answers,
  answeredCount,
  onChoose,
  onPrev,
  onNext,
  onSubmit,
}) {
  const selected = answers[index];
  const isLast = index === total - 1;
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-5"
    >
      {/* 进度 */}
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>
            第 {index + 1} / {total} 题
          </span>
          <span>已作答 {answeredCount} / {total}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
          />
        </div>
      </div>

      {/* 题目 */}
      <div className="premium-glass rounded-3xl p-5 sm:p-7">
        <div className="flex items-center gap-2 text-[11px] text-emerald-300/60">
          <ClipboardList className="h-3.5 w-3.5" />
          {question.lessonNumber} · {question.lessonTitle}
        </div>

        <h2 className="mt-3 text-base font-semibold leading-relaxed text-white/90 sm:text-lg">
          {question.q}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;

            return (
              <button
                key={optionIndex}
                onClick={() => onChoose(optionIndex)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] transition-all ${
                  isSelected
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.035] text-white/60 hover:border-emerald-300/25 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-white/10 text-[10px] text-white/40">
                  {OPTION_LABELS[optionIndex]}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 导航 */}
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
          {answeredCount < total && (
            <span className="text-xs text-white/25">
              还有 {total - answeredCount} 题未作答
            </span>
          )}

          {isLast ? (
            <button
              onClick={onSubmit}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
            >
              <Award className="h-4 w-4" />
              提交测试
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400/10 px-6 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              下一题
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/* =========================================================
   结果页：通过 → 证书；未通过 → 错题解析
========================================================= */

function ResultPanel({ result, paper, answers, certificate, user, onRetry, onBack }) {
  const wrongList = paper
    .map((question, index) => ({ question, index, picked: answers[index] }))
    .filter((item) => item.picked !== item.question.answer);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {result.passed ? (
        <>
          <div className="premium-glass rounded-3xl p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-300/20 bg-gradient-to-br from-yellow-300/20 to-emerald-400/10">
              <Award className="h-8 w-8 text-yellow-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-white">
              恭喜通过结业考核
            </h1>
            <p className="mt-2 text-sm text-white/40">
              答对 {result.correct} / {result.total} 题（{result.percent}%）
              · 课程完成状态已点亮
            </p>
          </div>

          <SceneCertificate
            sceneTitle="基础泰语精读"
            sceneSubtitle="结业考核通过 · 14 篇课文全部完成"
            characterName={user?.nickname || user?.email || "ThaiAI 学员"}
            vocabLearned={EXAM_VOCAB_TOTAL}
            stagesComplete={result.correct}
            totalStages={result.total}
            sceneEmoji="🎓"
            date={formatDate(certificate?.issuedAt)}
            badgeText="COURSE COMPLETE"
            vocabLabel="掌握词汇"
            stagesLabel={`通过题数 / ${result.total}`}
            characterLabel="考核成绩"
            shareText={`我在 ThaiAI 通过了「基础泰语精读」结业考核，答对 ${result.correct}/${result.total} 题（${result.percent}%）！🎓`}
          />
        </>
      ) : (
        <div className="premium-glass rounded-3xl p-6 text-center sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-300/15 bg-yellow-300/[0.06]">
            <XCircle className="h-8 w-8 text-yellow-200/70" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">
            还差一点，再来一次
          </h1>
          <p className="mt-2 text-sm text-white/40">
            答对 {result.correct} / {result.total} 题（{result.percent}%），
            通过线 {EXAM_PASS_PERCENT}%
          </p>
        </div>
      )}

      {wrongList.length > 0 && (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
          <h2 className="text-sm font-bold text-white/80">
            错题解析 · {wrongList.length} 题
          </h2>

          <div className="mt-4 divide-y divide-white/[0.05]">
            {wrongList.map(({ question, index, picked }) => (
              <div key={`${question.id}-${index}`} className="py-4">
                <div className="flex items-center gap-2 text-[11px] text-white/25">
                  <span>第 {index + 1} 题</span>
                  <span>·</span>
                  <span>
                    {question.lessonNumber} {question.lessonTitle}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium leading-relaxed text-white/75">
                  {question.q}
                </p>

                <div className="mt-3 space-y-1.5 text-xs">
                  <p className="text-red-200/70">
                    你的答案：
                    {picked === undefined
                      ? "未作答"
                      : question.options[picked]}
                  </p>
                  <p className="text-emerald-200/80">
                    正确答案：{question.options[question.answer]}
                  </p>
                  <p className="leading-relaxed text-white/35">
                    {question.explain}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onRetry}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400/10 px-6 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
        >
          <RefreshCw className="h-4 w-4" />
          {result.passed ? "再练一次" : "换一套题重考"}
        </button>
        <button
          onClick={onBack}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm text-white/55 transition hover:text-white"
        >
          返回课程
        </button>
      </div>
    </motion.section>
  );
}
