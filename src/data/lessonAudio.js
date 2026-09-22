// src/data/lessonAudio.js
//
// =========================================================
// 音频图文课（挂在课程体系下的「课文精读」内容）
// =========================================================
//
// 课程内容来自 src/data/courseTexts.js（原创课文，单一数据源）；
// 朗读音频位于 public/lessons/audio/<lessonId>/（由
// scripts/generate-lesson-audio.js 预生成；文件缺失时
// LessonText 页面会自动回退到在线 TTS，不阻塞播放）。
//
// 渲染页为 LessonText.jsx（/lessons/:lessonId）：
// 中泰对照、生词点读、逐段朗读、语法讲解、课后练习。
// CourseDetail / Home / Plan 通过 courses.js 的
// getCourseLessons("thai-basic-reader") 拿到本列表。
// =========================================================

import { lessons as courseTexts } from "./courseTexts";

export const BASIC_READER_COURSE_ID = "thai-basic-reader";

const AUDIO_BASE = `${import.meta.env.BASE_URL}lessons/audio`;

const pad = (n) => String(n).padStart(2, "0");

// 课时长短估算：每段朗读 + 跟读约 0.8 分钟，最少 6 分钟
const estimateDuration = (segments) =>
  `约 ${Math.max(6, Math.round(segments.length * 0.8))} 分钟`;

export const lessonAudioCourses = courseTexts.map((lesson, index) => ({
  id: lesson.id,
  courseId: BASIC_READER_COURSE_ID,
  chapter: "课文精读 · 按课序学习",
  seq: index + 1,
  title: `${lesson.number} · ${lesson.title}`,
  description: lesson.theme,
  duration: estimateDuration(lesson.text),
  free: index === 0, // 第一课免费试读，其余 VIP（与 LessonText 页门控一致）
  audio: {
    full: `${AUDIO_BASE}/${lesson.id}/full.m4a`,
    paragraphs: lesson.text.map(
      (_, i) => `${AUDIO_BASE}/${lesson.id}/${pad(i + 1)}.m4a`
    ),
  },
}));

export function getLessonAudioById(lessonId) {
  return lessonAudioCourses.find((l) => l.id === lessonId) || null;
}
