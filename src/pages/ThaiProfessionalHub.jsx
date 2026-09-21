// src/pages/ThaiProfessionalHub.jsx
//
// =========================================================
// Thai Professional Hub · 专业泰语模块
// =========================================================
//
// 产品定位：不是「又一门固定课程」，而是专业方向的内容模块货架。
//
//   用户选择方向（可多选，最多 3 个）
//        ↓ 立即写入本地选择 + 同步后端（user_profiles.professional_direction）
//   内容板块展开（专业词汇 / 场景练习 / 课程入口）
//        ↓ 路线引擎即时读取
//   自动并入个人学习路线（首页 My Learning Path 出现对应阶段）
//
// 数据来源：
//   - 方向与板块文案：src/data/professionalTracks.js（前端单一数据源）
//   - 板块的难度 / 课时 / 入库记录：professional_courses 表（GET /api/professional/courses）
//   - 已并入的路线阶段：generateLearningPath(profile) 里 source === "track" 的阶段
//
// 不破坏既有 course 数据：只读取 courses / 路线引擎，不写任何课程表。
// =========================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Database,
  Layers,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";

import api from "@/api/auth";
import {
  PROFESSIONAL_TRACKS,
  TOTAL_MODULE_COUNT,
  getTrackById,
} from "@/data/professionalTracks";
import { generateLearningPath } from "@/lib/learningPath";
import {
  setSelectedTracks,
  syncTracksWithServer,
  useProfessionalTracks,
} from "@/lib/professionalTracks";
import { useUserProfile } from "@/lib/userProfile";

/* =========================================================
   展示用配色（Tailwind 需要字面量类名，所以写成映射表）
========================================================= */

const TRACK_COLORS = {
  sky: {
    card: "border-sky-300/20 hover:border-sky-300/45",
    chip: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    glow: "from-sky-400/25",
  },
  violet: {
    card: "border-violet-300/20 hover:border-violet-300/45",
    chip: "border-violet-300/25 bg-violet-300/10 text-violet-100",
    glow: "from-violet-400/25",
  },
  teal: {
    card: "border-teal-300/20 hover:border-teal-300/45",
    chip: "border-teal-300/25 bg-teal-300/10 text-teal-100",
    glow: "from-teal-400/25",
  },
  amber: {
    card: "border-amber-300/20 hover:border-amber-300/45",
    chip: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    glow: "from-amber-400/25",
  },
  pink: {
    card: "border-pink-300/20 hover:border-pink-300/45",
    chip: "border-pink-300/25 bg-pink-300/10 text-pink-100",
    glow: "from-pink-400/25",
  },
};

const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1"];

/** 方向覆盖的难度区间，如 A2–B1 */
function levelRange(track) {
  const levels = track.modules
    .map((module) => module.level)
    .filter((level) => LEVEL_ORDER.includes(level));

  if (!levels.length) return "全等级";

  const sorted = [...levels].sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b)
  );

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return min === max ? min : `${min}–${max}`;
}

const moduleCountOf = (track) => track.modules.length;

/* =========================================================
   页面
========================================================= */

export default function ThaiProfessionalHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selected = useProfessionalTracks();
  const { profile } = useUserProfile();

  /*
   * 展开哪条路线支持深链：/professional?track=business
   * 首页星系的「商务路线」这类画像卫星直接展开对应那条，而不是让用户
   * 自己再找一遍。优先级：URL 指定的合法路线 > 已选的第一条 > 不展开。
   */
  const [expanded, setExpanded] = useState(() => {
    const fromUrl = (searchParams.get("track") || "").trim();
    if (fromUrl && PROFESSIONAL_TRACKS.some((track) => track.id === fromUrl)) {
      return fromUrl;
    }
    return selected[0] || null;
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [courses, setCourses] = useState([]);
  const [coursesError, setCoursesError] = useState("");

  const hasToken =
    typeof localStorage !== "undefined" && !!localStorage.getItem("token");

  /* 已并入路线的专业阶段（路线引擎实时算，选择一变立刻反映） */
  const path = useMemo(
    () => (profile?.thaiLevel ? generateLearningPath(profile) : null),
    [profile, selected]
  );

  const trackStages = (path?.stages || []).filter(
    (stage) => stage.source === "track"
  );

  /* ---------- 登录后与后端对齐（云端选择优先） ---------- */
  useEffect(() => {
    let alive = true;

    if (!hasToken) return undefined;

    syncTracksWithServer()
      .then((tracks) => {
        if (!alive || !tracks?.length) return;
        setExpanded((current) => current || tracks[0]);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [hasToken]);

  /* ---------- 读取 professional_courses 表（已选方向的专题课） ---------- */
  useEffect(() => {
    let alive = true;

    if (!hasToken || selected.length === 0) {
      setCourses([]);
      setCoursesError("");
      return undefined;
    }

    api
      .get("/professional/courses", {
        params: { category: selected.join(",") },
      })
      .then((res) => {
        if (!alive) return;
        setCourses(res.data?.courses || []);
        setCoursesError("");
      })
      .catch(() => {
        if (!alive) return;
        setCourses([]);
        setCoursesError("暂时读不到云端专题课，下面先显示本地方案");
      });

    return () => {
      alive = false;
    };
  }, [hasToken, selected.join(",")]);

  /* ---------- 选择 / 取消（自动保存 + 自动进路线） ---------- */
  const toggleTrack = (trackId) => {
    const isSelected = selected.includes(trackId);

    const next = isSelected
      ? selected.filter((id) => id !== trackId)
      : [...selected, trackId];

    setSelectedTracks(next);
    setExpanded(isSelected ? next[0] || null : trackId);

    if (!isSelected) {
      const track = getTrackById(trackId);
      setNotice(`${track?.title || trackId} 已加入你的学习路线`);
    } else {
      setNotice(`${getTrackById(trackId)?.title || trackId} 已从路线移除`);
    }

    if (!hasToken) return;

    setSaving(true);
    api
      .post("/professional/sync", { tracks: next })
      .catch(() => setNotice("已保存在本机，登录状态恢复后会自动同步"))
      .finally(() => setSaving(false));
  };

  const clearAll = () => {
    setSelectedTracks([]);
    setExpanded(null);
    setNotice("已退出所有专业方向");

    if (!hasToken) return;

    setSaving(true);
    api
      .delete("/professional/sync")
      .catch(() => setNotice("本机已清空，云端稍后同步"))
      .finally(() => setSaving(false));
  };

  const coursesByCategory = useMemo(() => {
    const map = {};
    for (const course of courses) {
      map[course.category] = map[course.category] || [];
      map[course.category].push(course);
    }
    return map;
  }, [courses]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      {/* ============ 头部 ============ */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="apple-surface relative overflow-hidden rounded-3xl border border-white/10 p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-400/25 to-transparent blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
              <Compass className="h-3.5 w-3.5" />
              Thai Professional Hub
            </div>

            <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
              专业泰语 · 自由组合方向
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
              这里不排固定课程表。选一个（或几个）未来真正用得上的方向，
              系统会把对应的内容板块自动织进你的学习路线——首页「My Learning Path」
              立刻多出这一站。
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/60">
              {PROFESSIONAL_TRACKS.length} 个方向 · {TOTAL_MODULE_COUNT} 个内容板块
            </span>

            <span className="rounded-full border border-[#CB8DFF]/30 bg-[#CB8DFF]/10 px-3 py-1.5 text-[11px] font-bold text-[#E4C8FF]">
              已选 {selected.length} / 3
            </span>
          </div>
        </div>

        {/* 已选摘要 + 操作 */}
        <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
          {selected.length === 0 ? (
            <span className="text-xs text-white/45">
              还没有选方向。选完会自动加入你的学习路线，随时可以改。
            </span>
          ) : (
            selected.map((id) => {
              const track = getTrackById(id);
              if (!track) return null;
              const color = TRACK_COLORS[track.color] || TRACK_COLORS.violet;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTrack(id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:opacity-80 ${color.chip}`}
                  title="点击移除"
                >
                  <span>{track.emoji}</span>
                  {track.title}
                  <Check className="h-3 w-3" />
                </button>
              );
            })
          )}

          <div className="ml-auto flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1 text-[11px] text-white/45">
                <Loader2 className="h-3 w-3 animate-spin" />
                同步中
              </span>
            )}

            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 transition hover:text-white"
              >
                <Trash2 className="h-3 w-3" />
                全部退出
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#CB8DFF] to-emerald-400 px-3.5 py-2 text-[11px] font-bold text-white transition hover:-translate-y-0.5"
            >
              去首页看我的路线
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {notice && (
          <div className="relative mt-3 text-[11px] text-emerald-200/80">
            {notice}
          </div>
        )}
      </motion.header>

      {/* ============ 已并入学习路线 ============ */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#CB8DFF]" />
          <h2 className="text-sm font-bold text-white">已并入我的学习路线</h2>
          <span className="text-[11px] text-white/40">
            选择即刻生效 · 由路线引擎自动装配
          </span>
        </div>

        {trackStages.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {trackStages.map((stage) => (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="apple-surface rounded-2xl border border-white/10 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{stage.trackEmoji || "📘"}</span>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {stage.title}
                      </div>
                      <div className="text-[10px] text-white/45">
                        {stage.modules.length} 个内容板块 · 预计{" "}
                        {Math.round(stage.hours)} 小时
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    已在路线
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stage.modules.slice(0, 4).map((module) => (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() =>
                        module.entry ? navigate(module.entry) : null
                      }
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/70 transition hover:border-white/25 hover:text-white"
                    >
                      {module.title}
                      {module.level ? (
                        <span className="ml-1 text-white/35">
                          {module.level}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate(stage.to)}
                  className="mt-3 text-[11px] font-bold text-[#E4C8FF] transition hover:text-white"
                >
                  {stage.cta} →
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-white/50">
            {selected.length === 0
              ? "选中方向后，这里会显示它在学习路线里的位置。"
              : profile?.thaiLevel
                ? "正在装配路线…"
                : "路线需要先知道你的泰语等级。你的选择已经记下了，做完入学测试就会自动出现这一站。"}
            {selected.length > 0 && !profile?.thaiLevel && (
              <button
                type="button"
                onClick={() => navigate("/placement-test")}
                className="ml-2 font-bold text-[#E4C8FF] hover:text-white"
              >
                去做 AI 入学测试 →
              </button>
            )}
          </div>
        )}
      </section>

      {/* ============ 方向卡片 ============ */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-white">五个专业方向</h2>
          <span className="text-[11px] text-white/40">
            可多选 · 最多 3 个 · 点板块直接开练
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROFESSIONAL_TRACKS.map((track) => {
            const isSelected = selected.includes(track.id);
            const isOpen = expanded === track.id;
            const color = TRACK_COLORS[track.color] || TRACK_COLORS.violet;

            return (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`apple-surface relative overflow-hidden rounded-3xl border p-5 transition ${color.card} ${
                  isSelected ? "ring-1 ring-[#CB8DFF]/40" : ""
                }`}
              >
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${color.glow} to-transparent blur-2xl`}
                />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{track.emoji}</span>
                      <div>
                        <div className="text-base font-black text-white">
                          {track.title}
                        </div>
                        <div className="text-[10px] text-white/45">
                          {track.tagline}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      <Check className="h-3 w-3" />
                      已在路线
                    </span>
                  )}
                </div>

                <div className="relative mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className={`rounded-full border px-2 py-0.5 ${color.chip}`}>
                    难度 {levelRange(track)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-white/60">
                    {moduleCountOf(track)} 个板块
                  </span>
                </div>

                {/* 板块列表 */}
                <div className="relative mt-4 space-y-1.5">
                  {track.modules.map((module) => (
                    <div
                      key={module.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white/90">
                          {module.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-white/35">
                          {module.level} · {module.lessons} 节
                        </span>
                      </div>

                      {isOpen && (
                        <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                          {module.desc}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(module.entry)}
                        className="mt-1 text-[10px] font-bold text-[#E4C8FF]/90 transition hover:text-white"
                      >
                        {module.entryLabel} →
                      </button>
                    </div>
                  ))}
                </div>

                <div className="relative mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
                      isSelected
                        ? "border border-white/15 bg-white/[0.05] text-white/70 hover:text-white"
                        : "bg-gradient-to-r from-[#CB8DFF] to-emerald-400 text-white hover:-translate-y-0.5"
                    }`}
                  >
                    {isSelected ? "从路线移除" : "选择这个方向"}
                    {!isSelected && <ArrowRight className="h-3 w-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : track.id)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 transition hover:text-white"
                  >
                    {isOpen ? "收起" : "展开说明"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============ 专题课（professional_courses 表） ============ */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold text-white">
            专题课 · 来自 professional_courses
          </h2>
          <span className="text-[11px] text-white/40">
            选中方向的板块已入库，按难度与课时排布
          </span>
        </div>

        {coursesError && (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
            {coursesError}
          </div>
        )}

        {selected.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-white/50">
            还没有选择方向——选一个，这里会列出对应的专题课与进度入口。
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(courses.length > 0
              ? selected.map((id) => ({
                  id,
                  title: getTrackById(id)?.title || id,
                  emoji: getTrackById(id)?.emoji || "📘",
                  list: coursesByCategory[id] || [],
                }))
              : selected.map((id) => {
                  const track = getTrackById(id);
                  return {
                    id,
                    title: track?.title || id,
                    emoji: track?.emoji || "📘",
                    /* 离线 / 未登录：用本地板块数据兜底，页面不至于空掉 */
                    list: (track?.modules || []).map((module) => ({
                      id: module.id,
                      title: module.title,
                      level: module.level,
                      lessons: module.lessons,
                      createdAt: null,
                    })),
                  };
                })
            ).map((group) => (
              <div
                key={group.id}
                className="apple-surface rounded-2xl border border-white/10 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{group.emoji}</span>
                  <span className="text-sm font-bold text-white">
                    {group.title}
                  </span>
                  <span className="ml-auto text-[10px] text-white/40">
                    {group.list.length} 个板块
                  </span>
                </div>

                <div className="mt-3 divide-y divide-white/[0.06]">
                  {group.list.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-white/35" />
                        <span className="text-xs text-white/85">
                          {course.title}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-[10px] text-white/40">
                        {course.level && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {course.level}
                          </span>
                        )}
                        <span>{course.lessons} 节</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
