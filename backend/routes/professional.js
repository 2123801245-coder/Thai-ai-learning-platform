// backend/routes/professional.js
//
// ============================================================
// 专业泰语模块 · Thai Professional Hub API
// ============================================================
//
//   GET    /api/professional/tracks   → 五个方向 + 各自内容板块（含难度/课时）
//   GET    /api/professional/courses  → professional_courses 表内容（可按方向过滤）
//   GET    /api/professional/sync     → 当前用户选中的方向 + 已并入路线的专题课
//   POST   /api/professional/sync     → 保存方向选择（写入 user_profiles）
//   DELETE /api/professional/sync     → 清空方向选择（退出专业路线）
//
// 设计要点：
//   1. 方向不是「固定课程」——每个方向是一组可自由组合的内容板块，
//      用户选中后由前端路线引擎（src/lib/learningPath.js）织进个人学习路线。
//   2. 专题课内容以 professional_courses 表为准（启动时幂等 seed），
//      接口返回的 level / lessons 都来自数据库，不是写死在文案里。
//   3. 全部需要登录（authenticate），操作对象恒为 req.userId。
// ============================================================

import express from "express";

import db from "../database.js";
import { authenticate } from "./auth.js";
import { PROFESSIONAL_TRACKS } from "../../src/data/professionalTracks.js";
import {
  MAX_SELECTED_TRACKS,
  VALID_CATEGORIES,
  normalizeTracks,
  queryProfessionalCourses,
  querySelectedTracks,
  saveSelectedTracks,
  seedProfessionalCourses,
} from "../professionalCourses.js";

const router = express.Router();

/* 启动时幂等同步内容板块（表已在 database.js 建好） */
db.serialize(() => {
  try {
    const count = seedProfessionalCourses(db);
    console.log(`Professional courses seeded: ${count} modules`);
  } catch (error) {
    console.error("Seed professional_courses failed:", error.message);
  }
});

/* ============================================================
   工具：方向 → 该方向全部板块（供接口直出，前端不必再拼）
============================================================ */

function modulesOf(category) {
  const track = PROFESSIONAL_TRACKS.find((item) => item.id === category);
  if (!track) return [];
  return track.modules.map((module) => ({
    id: module.id,
    title: module.title,
    level: module.level || null,
    lessons: Number(module.lessons) || 0,
    desc: module.desc,
    entry: module.entry,
    entryLabel: module.entryLabel,
    courseId: module.courseId || null,
  }));
}

/* ============================================================
   GET /api/professional/tracks
   五个专业方向 + 内容板块（页面首屏用，公开给登录用户）
============================================================ */

router.get("/tracks", authenticate, (req, res) => {
  const tracks = PROFESSIONAL_TRACKS.map((track) => ({
    id: track.id,
    emoji: track.emoji,
    title: track.title,
    tagline: track.tagline,
    color: track.color,
    moduleCount: track.modules.length,
    modules: modulesOf(track.id),
  }));

  res.json({ tracks, totalModules: tracks.reduce((sum, t) => sum + t.moduleCount, 0) });
});

/* ============================================================
   GET /api/professional/courses?category=business,news
   专题课（professional_courses 表）
============================================================ */

router.get("/courses", authenticate, async (req, res) => {
  const categories = normalizeTracks(String(req.query.category || ""));

  /* 参数非法时按「全部」处理，避免查询报错 */
  const filter =
    categories.length > 0
      ? categories
      : VALID_CATEGORIES;

  try {
    const courses = await queryProfessionalCourses(db, filter);

    res.json({
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level,
        lessons: course.lessons,
        createdAt: course.created_at,
      })),
      categories: filter,
      total: courses.length,
    });
  } catch (error) {
    console.error("Query professional courses failed:", error.message);
    res.status(500).json({ message: "读取专题课失败" });
  }
});

/* ============================================================
   GET /api/professional/sync
   当前用户选中的方向（user_profiles.professional_direction）
============================================================ */

router.get("/sync", authenticate, async (req, res) => {
  const tracks = await querySelectedTracks(db, req.userId);
  const courses = tracks.length
    ? await queryProfessionalCourses(db, tracks)
    : [];

  res.json({
    tracks,
    maxTracks: MAX_SELECTED_TRACKS,
    courses,
    /* 直接给前端路线引擎用的轻量阶段骨架（用户选择 → 自动并入路线） */
    stages: tracks.map((id) => {
      const track = PROFESSIONAL_TRACKS.find((item) => item.id === id);
      return {
        id,
        title: track?.title || id,
        emoji: track?.emoji || "",
        moduleCount: track?.modules.length || 0,
      };
    }),
  });
});

/* ============================================================
   POST /api/professional/sync   { tracks: ["business", "news"] }
============================================================ */

router.post("/sync", authenticate, async (req, res) => {
  const tracks = normalizeTracks(req.body?.tracks);

  try {
    await saveSelectedTracks(db, req.userId, tracks);
    const courses = tracks.length
      ? await queryProfessionalCourses(db, tracks)
      : [];

    res.json({
      message: tracks.length
        ? `已加入学习路线：${tracks.length} 个专业方向`
        : "已退出专业路线",
      tracks,
      maxTracks: MAX_SELECTED_TRACKS,
      courses,
    });
  } catch (error) {
    console.error("Save professional tracks failed:", error.message);
    res.status(500).json({ message: "保存专业方向失败" });
  }
});

/* ============================================================
   DELETE /api/professional/sync
============================================================ */

router.delete("/sync", authenticate, async (req, res) => {
  try {
    await saveSelectedTracks(db, req.userId, []);
    res.json({ message: "已清空专业方向", tracks: [] });
  } catch (error) {
    console.error("Clear professional tracks failed:", error.message);
    res.status(500).json({ message: "清空专业方向失败" });
  }
});

export default router;
