// src/components/dashboard/AIRecommendationCard.jsx
//
// =========================================================
// 仪表盘右栏 · 老师推荐（设计稿版）
// =========================================================
//
// 设计稿里这张卡是「老师的一句话 + 今天建议学什么 + 一个缩略图 + 开始学习」。
// 三部分全部来自真实数据，没有一句是写死的文案：
//
//   老师的话   ← estimateAbilities(progress)：拿当前最稳/最弱的两维说人话
//                （分数差 < 6 分时不说「最弱」，避免把噪声说成结论）
//   建议课程   ← recommendCourses(profile, courses)：画像命中的第一门可学课程
//   推荐原因   ← 命中的画像标签（目标 / 方向 / 兴趣媒体），与首页推荐同源
//
// 没有画像时退化为「先做入学测试」，不会假装认识用户。
// =========================================================

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { courses, getLessonHref, getCourseLessons } from "@/data/courses";
import { getCourseStats } from "@/lib/courseProgress";
import { useUserProfile } from "@/lib/userProfile";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { estimateAbilities } from "@/lib/abilityModel";
import { goalTitle, hasPlacementProfile } from "@/lib/placement";
import { recommendCourses } from "@/lib/profileDriven";

/* 六维里挑两个说：最强 + 最该补的，附上真实分数 */
const ABILITY_CN = {
  vocab: "词汇",
  speaking: "口语",
  listening: "听力",
  reading: "阅读",
  grammar: "语法",
  tone: "声调",
};

const teacherLine = (abilities) => {
  if (!abilities) return null;
  const entries = Object.keys(ABILITY_CN).map((key) => ({
    key,
    cn: ABILITY_CN[key],
    score: Number(abilities[key]) || 0,
  }));
  if (!entries.length) return null;

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  /* 差距太小就不下「最弱」的结论——那是噪声，不是判断 */
  if (best.score - worst.score < 6 || best.key === worst.key) {
    return `你的六项能力目前比较均衡（${best.cn} ${Math.round(best.score)} 分最高）。今天把最近练的那一项再往前推一点就好。`;
  }

  return `你的「${best.cn}」最稳（${Math.round(best.score)} 分），「${worst.cn}」还有空间（${Math.round(
    worst.score
  )} 分）。今天就补这一项。`;
};

export default function AIRecommendationCard({ transparent = false }) {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { progress } = useLearningProgress();

  const hasTest = hasPlacementProfile(profile);
  const abilities = useMemo(() => estimateAbilities(progress), [progress]);

  /* 画像最匹配的一门可学课程；没有可学课时退化为榜单第一 */
  const pick = useMemo(() => {
    const ranked = recommendCourses(profile, courses, 3);
    if (!ranked.length) return null;
    return ranked.find((item) => item.available) || ranked[0];
  }, [profile]);

  if (!pick) return null;

  const { course, matchReason, available } = pick;
  const goal = hasTest ? goalTitle(profile?.learningGoal) : "";

  const reason = matchReason
    ? available
      ? matchReason
      : `${matchReason}（视频制作中，可先看大纲）`
    : "根据当前学习进度挑选";

  const lessons = getCourseLessons(course.id);
  const stats = getCourseStats(course.id, lessons);
  const firstLesson =
    (stats.lastLessonId && lessons.find((l) => l.id === stats.lastLessonId)) ||
    lessons[0];

  const openCourse = () => {
    if (available && firstLesson && course.status === "learning") {
      navigate(getLessonHref(course.id, firstLesson));
    } else {
      navigate(`/course/${course.id}`);
    }
  };

  const line = hasTest
    ? teacherLine(abilities)
    : "做完 AI 入学测试，我就能按你的等级与目标给建议，而不是给所有人同一门课。";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        "overflow-hidden rounded-[22px] shadow-lg shadow-black/25 backdrop-blur-xl " +
        (transparent
          ? "border border-white/[0.08] bg-black/30"
          : "border border-white/[0.07] bg-white/[0.025]")
      }
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        <Sparkles className="h-3.5 w-3.5 text-[#CB8DFF]" />
        <span className="text-[13px] font-bold text-white/90">
          老师推荐{goal ? ` · 目标「${goal}」` : ""}
        </span>
      </div>

      <div className="px-4 pt-2.5">
        <p className="text-[12px] leading-relaxed text-white/70">{line}</p>

        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/25 p-2.5">
          <img
            src="/images/thai-guardian-hero.jpg"
            alt=""
            aria-hidden="true"
            className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover object-[60%_10%] opacity-90"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">
              今天建议学
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-bold text-white">
                {course.title}
              </span>
              {course.isVip ? (
                <span className="shrink-0 rounded-full border border-yellow-300/20 bg-yellow-300/[0.06] px-1.5 py-[1px] text-[9px] font-semibold text-yellow-200/80">
                  VIP
                </span>
              ) : null}
            </div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-white/40">
              {reason}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={openCourse}
        className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-white/[0.06] bg-emerald-400/[0.07] px-4 py-3 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-400/[0.14]"
      >
        {available ? "开始学习" : "查看大纲"}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </motion.section>
  );
}
