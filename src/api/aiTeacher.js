// src/api/aiTeacher.js
//
// AI 泰语老师 API 客户端
// 复用 auth.js 导出的 axios 实例（自带 baseURL + Bearer token 拦截器）

import api from "./auth";

// ============================================================
// 调用 AI 泰语老师
// data: { message, action }   action: chat | pronunciation | speaking
// ============================================================

export const askAiTeacher = (data) =>
  api.post("/ai/teacher", data);

// ============================================================
// 今日 AI 老师免费对话额度
// 返回: { freeChatDaily, usedToday, remainingToday, isVip }
// 未登录会 401 —— 调用方需捕获
// ============================================================

export const getAiTeacherQuota = () =>
  api.get("/ai/teacher/quota");

// ============================================================
// 老师眼里的「今天」（对话室状态牌 / 开场白用）
// 返回: { date, todayLessons, mastered, lastLesson, plan, quota }
// 与注入 AI system prompt 的「今日状态」同源 —— 界面显示的数字
// 就是老师看到的数字，不会各算一套
// ============================================================
export const getAiTeacherToday = () =>
  api.get("/ai/teacher/today");

// 根据学生画像 + 长期记忆生成定制课程推荐（轻量免费）
// data: { message, action: "recommend", profile }
export const getAiTeacherRecommendation = (profile) =>
  api.post("/ai/teacher", {
    message: "请为我生成定制课程",
    action: "recommend",
    profile,
  });

// 根据学生画像 + 长期记忆生成个性化今日学习计划（轻量免费）
// 生成任务表格较耗时，放宽超时避免首图 10s 上限
export const getAiTeacherPlan = (profile) =>
  api.post(
    "/ai/teacher",
    {
      message: "请为我生成今日学习计划",
      action: "plan",
      profile,
    },
    { timeout: 60000 }
  );

// ============================================================
// 「学 · AI 定制新课」的今日课程（可回访）
// sessionStorage 只在标签页里活一次；这三根接口把课存进服务端，
// 刷新或换设备后 /loop 与 /conversation 都能拉回来接着练。
// ============================================================

// 读今天的课（?date=YYYY-MM-DD 可查历史某天）
// 返回 { data: { date, lesson, doneCount, source, updatedAt } | null }
export const getTodayLesson = (date) =>
  api.get("/ai/today-lesson", { params: date ? { date } : undefined });

// 存/覆盖今天的课（换个主题再学一节 → 直接覆盖）
export const saveTodayLesson = (lesson, doneCount = 0) =>
  api.put("/ai/today-lesson", { lesson, doneCount });

// 推进例句进度（服务端只增不减，乱序/重复点不会往回退）
export const patchTodayLessonProgress = (doneCount) =>
  api.patch("/ai/today-lesson/progress", { doneCount });


// 学生长期记忆（「老师记得你」）
// 返回 { memory(旧结构), items, groups, summary, hasMemory }
//   items  分类条目 [{ id, type, content, importance, source, hits, ... }]
//   groups 按类型分组，前端直接渲染
//   memory 旧版扁平结构，兼容仍在用它的老组件
// 读取时会顺带把入学测试画像同步成记忆（幂等）
export const getAiTeacherMemory = () =>
  api.get("/ai/teacher/memory");

// 手动修正 AI 老师记住的学生画像（个人中心旧表单，仍按扁平字段提交）
export const updateAiTeacherMemory = (memory) =>
  api.put("/ai/teacher/memory", { memory });

// 直接告诉老师要记住的一件事（分类记忆条目）
// data: { type, content, importance? }
//   type: profile | goal | habit | weakness | error | interest | preference
export const addAiTeacherMemoryItem = (data) =>
  api.post("/ai/teacher/memory/items", data);

// 删除一条记忆（记错了 / 不想让它记）
export const deleteAiTeacherMemoryItem = (id) =>
  api.delete(`/ai/teacher/memory/items/${id}`);


// ============================================================
// 语音识别（Azure 兜底）：浏览器不支持 Web Speech API 时，
// 把 WAV 上传到后端 /speaking/transcribe 转成文本。
// formData: { audio(file), language }
// ============================================================

export const transcribeSpeech = (formData) =>
  api.post("/speaking/transcribe", formData, { timeout: 30000 });

export default {
  askAiTeacher,
  getAiTeacherQuota,
  getAiTeacherToday,
  getAiTeacherRecommendation,
  getAiTeacherPlan,
  getTodayLesson,
  saveTodayLesson,
  patchTodayLessonProgress,
  getAiTeacherMemory,
  updateAiTeacherMemory,
  addAiTeacherMemoryItem,
  deleteAiTeacherMemoryItem,
  transcribeSpeech,
};

