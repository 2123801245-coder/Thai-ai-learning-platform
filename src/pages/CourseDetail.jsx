// src/pages/CourseDetail.jsx

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Lock,
  Play,
  Route,
  Sparkles,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getCourseById } from "@/data/courses";
import { getLessonsByCourseId } from "@/data/lessons";
import {
  useCourseProgress,
  isLessonCompleted,
} from "@/lib/courseProgress";

import { useAuth } from "@/lib/AuthContext";

import VipPanel from "@/components/common/VipPanel";
import { AIOrb } from "@/components/ui/premium";
import {
  ThaiPatternOverlay,
  ThaiRoof,
} from "@/components/common/ThaiMotifs";


// =========================================================
// 页面
// =========================================================

export default function CourseDetail() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { user } = useAuth();
  const isVipUser = !!user?.isVip;
  const [vipOpen, setVipOpen] = useState(false);


  // =======================================================
  // 获取课程
  // =======================================================

  const course = useMemo(
    () => getCourseById(courseId),
    [courseId]
  );


  // =======================================================
  // 课程视频（数据来自 src/data/lessons.js）
  // =======================================================

  const lessons = useMemo(
    () => (course ? getLessonsByCourseId(course.id) : []),
    [course]
  );


  // =======================================================
  // 学习进度（localStorage 持久化，跨页面同步）
  // =======================================================

  const stats = useCourseProgress(
    course ? course.id : null,
    lessons
  );

  const completedCount = stats.completedCount;
  const progress = stats.progressPercent;

  // 当前学习节点：第一个未完成且可看的课时（呼吸金光标识）
  const currentLessonId = useMemo(() => {
    if (!course) return null;

    const first = lessons.find(
      (lesson) =>
        !isLessonCompleted(course.id, lesson.id) &&
        !(course.isVip && !lesson.free && !isVipUser)
    );

    return first ? first.id : null;
  }, [course, lessons, isVipUser]);


  // =======================================================
  // 课程不存在（放在所有 Hooks 之后）
  // =======================================================

  if (!course) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
            <BookOpen className="h-7 w-7 text-white/20" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-white">
            找不到这门课程
          </h1>

          <p className="mt-2 text-sm text-white/30">
            课程可能已经下架或地址不正确。
          </p>

          <button
            onClick={() => navigate("/course")}
            className="mt-5 rounded-xl bg-emerald-400/10 px-5 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-400/20"
          >
            返回课程
          </button>
        </div>
      </div>
    );
  }


  // =======================================================
  // 分组章节
  // =======================================================

  const chapters = lessons.reduce((groups, lesson) => {
    if (!groups[lesson.chapter]) {
      groups[lesson.chapter] = [];
    }

    groups[lesson.chapter].push(lesson);
    return groups;
  }, {});


  // =======================================================
  // 开始 / 继续学习
  // =======================================================

  const handleStartLearning = () => {
    // VIP 用户可直接进入上次学习的课程
    if (isVipUser) {
      if (stats.lastLessonId) {
        navigate(`/course/${course.id}/lesson/${stats.lastLessonId}`);
      } else {
        navigate(`/course/${course.id}/lesson/${lessons[0]?.id}`);
      }
      return;
    }

    // 有上次学习记录 → 继续
    if (stats.lastLessonId) {
      const last = lessons.find(
        (lesson) => lesson.id === stats.lastLessonId
      );

      if (last && (last.free || !course.isVip)) {
        navigate(`/course/${course.id}/lesson/${last.id}`);
        return;
      }
    }

    // 否则从第一节可看的开始
    const firstAvailable = lessons.find(
      (lesson) => lesson.free || !course.isVip
    );

    if (firstAvailable) {
      navigate(`/course/${course.id}/lesson/${firstAvailable.id}`);
    }
  };


  return (
    <div className="relative space-y-6 pb-10">

      {/* =====================================================
          返回
      ===================================================== */}

      <button
        onClick={() => navigate("/course")}
        className="flex min-h-10 items-center gap-2 py-2 text-sm text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回课程
      </button>


      {/* =====================================================
          Hero
      ===================================================== */}

      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-glass relative overflow-hidden rounded-[24px] p-4 sm:rounded-[30px] sm:p-8"
      >

        {/* 泰式元素背景层（纹样 + 屋顶剪影 + 漂浮泰文） */}

        <ThaiPatternOverlay patternId="course-hero" opacity={0.05} />

        <ThaiRoof
          className="pointer-events-none absolute -right-6 -top-8 h-44 w-72"
          color="#F5D67B"
          opacity={0.06}
        />

        <span className="thai-float pointer-events-none absolute left-8 top-5 select-none text-5xl font-black leading-none text-emerald-300/[0.05]">
          สวัสดี
        </span>

        <span
          className="thai-float pointer-events-none absolute bottom-4 left-1/3 select-none text-3xl font-black leading-none text-yellow-300/[0.05]"
          style={{ animationDelay: "2.5s" }}
        >
          ภาษาไทย
        </span>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-300/25 to-transparent" />

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.09] blur-3xl" />

        <div className="relative grid gap-5 lg:grid-cols-[1fr_300px] lg:items-center lg:gap-8">

          {/* 左边 */}

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="rounded-full border border-emerald-300/10 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-medium text-emerald-200/70">
                {course.level}
              </span>

              <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[10px] text-white/35">
                {course.category}
              </span>

              {course.isVip && (
                <span className="flex items-center gap-1 rounded-full border border-yellow-300/10 bg-yellow-300/[0.06] px-3 py-1.5 text-[10px] text-yellow-200/60">
                  <Crown className="h-3 w-3" />
                  VIP 专属
                </span>
              )}

            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:mt-5 sm:text-4xl">
              {course.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
              {course.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/30">

              <span className="flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {lessons.length} 节视频
              </span>

              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                {course.duration}
              </span>

              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                已完成 {completedCount} 节
              </span>

            </div>

            <button
              onClick={handleStartLearning}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-400/20 sm:mt-7 sm:w-auto sm:px-6"
            >
              <Play className="h-4 w-4 fill-current" />
              {progress > 0 ? "继续学习" : "开始学习"}
              <ChevronRight className="h-4 w-4" />
            </button>

            {course.isVip && (
              <button
                onClick={() => setVipOpen(true)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-yellow-300/15 bg-yellow-300/[0.05] px-5 py-3 text-sm font-semibold text-yellow-200/70 transition hover:bg-yellow-300/[0.10] hover:text-yellow-100 sm:w-auto sm:px-6"
              >
                <Crown className="h-4 w-4" />
                {isVipUser ? "查看会员权益" : "了解 VIP 权益"}
              </button>
            )}

          </div>


          {/* =================================================
              进度
          ================================================= */}

          <div className="flex flex-col items-center gap-5">

            {/* AI 核心视觉（泰国文化 × AI） */}

            <div className="hidden sm:block">
              <AIOrb
                size={150}
                thaiTexts={["ภาษาไทย", "เรียนภาษาไทย", "AI ครู"]}
                className="pointer-events-none"
              />
            </div>

            <div className="premium-glass w-full rounded-2xl p-4 sm:rounded-3xl sm:p-5">

            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/25">
                学习进度
              </span>
              <span className="text-lg font-black text-emerald-300">
                {progress}%
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1 }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
              />
            </div>

            <p className="mt-3 text-xs text-white/25">
              已完成 {completedCount} / {lessons.length} 节视频
            </p>

            </div>

          </div>

        </div>

      </motion.div>


      {/* =====================================================
          课程目录
      ===================================================== */}

      <section>

        <div className="mb-5">

          <div className="flex flex-wrap items-center gap-2">
            <Route className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-bold text-white">学习路径</h2>
            <span className="rounded-full border border-yellow-300/15 bg-yellow-300/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-yellow-200/70">
              按顺序学习 · 点亮路径
            </span>
          </div>

          <p className="mt-1 text-xs text-white/30">
            完成节点亮绿光 · 当前节点金光呼吸 · 未解锁呈暗色
          </p>

        </div>

        <div className="space-y-4">

          {Object.entries(chapters).map(
            ([chapterName, chapterLessons], chapterIndex) => (
              <motion.div
                key={chapterName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: chapterIndex * 0.06 }}
                className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]"
              >

                {/* 章节标题 */}

                <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3 sm:px-5 sm:py-4">

                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {chapterName}
                    </h3>
                    <p className="mt-1 text-[10px] text-white/25">
                      {chapterLessons.length} 节视频
                    </p>
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/[0.06]">
                    <Video className="h-4 w-4 text-emerald-300/60" />
                  </div>

                </div>


                {/* 视频列表 */}

                <div>

                  {chapterLessons.map((lesson, lessonIndex) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      course={course}
                      index={lessonIndex}
                      isVipUser={isVipUser}
                      completed={isLessonCompleted(course.id, lesson.id)}
                      isCurrent={lesson.id === currentLessonId}
                      isLast={lessonIndex === chapterLessons.length - 1}
                      onOpen={() =>
                        navigate(`/course/${course.id}/lesson/${lesson.id}`)
                      }
                    />
                  ))}

                </div>

              </motion.div>
            )
          )}

        </div>

      </section>


      {/* =====================================================
          学习提示
      ===================================================== */}

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/[0.08] bg-emerald-400/[0.04] p-4">

        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/60" />

        <div>
          <p className="text-xs font-semibold text-emerald-200/60">
            学习建议
          </p>
          <p className="mt-1 text-xs leading-5 text-white/25">
            建议按照课程顺序学习。
            每看完一个视频，可以结合词汇和口语功能进行练习，
            学习效果会更好。观看进度达到 90% 自动记录完成。
          </p>
        </div>

      </div>

      {/* VIP 权益面板 */}

      <VipPanel
        open={vipOpen}
        onClose={() => setVipOpen(false)}
      />

    </div>
  );
}


// =========================================================
// 视频课程行
// =========================================================

function LessonRow({
  lesson,
  course,
  index,
  isVipUser = false,
  completed,
  isCurrent = false,
  isLast = false,
  onOpen,
}) {

  /*
   * VIP 课程：
   * 免费用户仅允许试看节（lesson.free）；
   * VIP 用户解锁全部课时。
   */

  const locked = course.isVip && !lesson.free && !isVipUser;

  // 时间线节点状态：完成（绿光）→ 当前（金光呼吸）→ 未解锁（暗色）
  const railState = locked
    ? "locked"
    : completed
      ? "done"
      : isCurrent
        ? "current"
        : "future";

  const dotClass = {
    done: "border-emerald-300/40 bg-emerald-400/15 shadow-[0_0_16px_rgba(52,211,153,0.45)]",
    current: "border-yellow-300/40 bg-gradient-to-br from-yellow-300/25 to-amber-400/10 shadow-[0_0_18px_rgba(245,214,123,0.45)]",
    locked: "border-white/[0.06] bg-white/[0.03]",
    future: "border-white/[0.1] bg-white/[0.05]",
  }[railState];

  const lineClass = {
    done: "bg-gradient-to-b from-emerald-400/45 to-emerald-400/10",
    current: "bg-gradient-to-b from-yellow-300/45 to-yellow-300/10",
    locked: "bg-white/[0.06]",
    future: "bg-white/[0.08]",
  }[railState];

  return (
    <motion.button
      whileHover={locked ? {} : { x: 3 }}
      disabled={locked}
      onClick={locked ? undefined : onOpen}
      className={`group relative flex w-full items-stretch text-left transition-all ${
        locked ? "cursor-not-allowed" : "hover:bg-white/[0.03]"
      }`}
    >

      {/* ===== 时间线轨道 ===== */}

      <div className="relative flex w-11 shrink-0 flex-col items-center sm:w-14">

        {/* 节点 */}

        <div
          className={`relative z-10 mt-4 flex h-8 w-8 items-center justify-center rounded-full border ${dotClass} sm:h-9 sm:w-9`}
        >

          {completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : locked ? (
            <Lock className="h-4 w-4 text-white/20" />
          ) : isCurrent ? (
            <>
              <Play className="h-4 w-4 fill-current text-yellow-200" />
              <span className="breathe absolute -inset-1.5 rounded-full border border-yellow-300/35" />
            </>
          ) : (
            <Play className="h-4 w-4 fill-current text-white/25" />
          )}

        </div>

        {/* 连接线（非末节） */}

        {!isLast && <div className={`mt-1 w-px flex-1 ${lineClass}`} />}

      </div>


      {/* ===== 内容 ===== */}

      <div
        className={`flex min-w-0 flex-1 items-center gap-2 py-3 pr-3 sm:gap-3 sm:py-4 sm:pr-4 ${
          isLast ? "" : "border-b border-white/[0.04]"
        }`}
      >

        <div className="min-w-0 flex-1">

          <div className="flex items-center gap-2">

            <h4
              className={`truncate text-sm font-semibold ${
                locked
                  ? "text-white/25"
                  : completed
                    ? "text-emerald-100/80"
                    : "text-white/75"
              }`}
            >
              {index + 1}. {lesson.title}
            </h4>

            {lesson.free && (
              <span className="shrink-0 rounded-full bg-emerald-400/[0.07] px-2 py-0.5 text-[8px] text-emerald-200/50">
                试看
              </span>
            )}

          </div>

          <p className="mt-1 hidden truncate text-[11px] text-white/20 sm:block">
            {lesson.description}
          </p>

        </div>


        {/* 状态徽章 / 箭头 */}

        <div className="flex shrink-0 items-center gap-2">

          {completed && (
            <span className="text-[10px] font-medium text-emerald-300/80">
              已完成
            </span>
          )}

          {!completed && !locked && isCurrent && (
            <span className="flex items-center gap-1 rounded-full border border-yellow-300/25 bg-yellow-300/[0.08] px-2 py-0.5 text-[10px] font-medium text-yellow-200">
              当前学习
            </span>
          )}

          {locked ? (
            <Lock className="h-3.5 w-3.5 text-white/15" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white/15 transition group-hover:text-white/40" />
          )}

        </div>


        {/* 时长 */}

        <span className="hidden shrink-0 items-center gap-1 text-[10px] text-white/20 md:flex">
          <Clock3 className="h-3 w-3" />
          {lesson.duration}
        </span>

      </div>

    </motion.button>
  );
}
