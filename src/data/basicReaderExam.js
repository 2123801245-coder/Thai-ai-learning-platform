// src/data/basicReaderExam.js
//
// =========================================================
// 「基础泰语精读」结业测试题库
// =========================================================
//
// 题源：courseTexts.js 每篇课文自带的课后练习（14 课 × 3 题 = 42 题池），
// 全部为原创内容，与课文页共用同一数据源。
//
// ⚠️ 原题库每题的正确答案都写在 options[0]（answer: 0）。直接照搬等于
// 「全选 A」，所以出卷时按题目+选项双重洗牌，并把正确项重映射到新下标。
//
// 出卷策略：固定抽 20 题，≥80%（16 题）通过；每次重考换一套题与选项顺序。
// =========================================================

import { lessons as courseTexts } from "./courseTexts";
import { BASIC_READER_COURSE_ID } from "./lessonAudio";

export const EXAM_QUESTION_COUNT = 20;
export const EXAM_PASS_PERCENT = 80;

// 14 课覆盖的去重词条数（证书上的「学习词汇」数字）
export const EXAM_VOCAB_TOTAL = new Set(
  courseTexts.flatMap((lesson) => lesson.words || [])
).size;

// 题池：课文 id → 课后练习
const questionPool = courseTexts.flatMap((lesson) =>
  (lesson.exercises || []).map((exercise, index) => ({
    id: `${lesson.id}-q${index + 1}`,
    lessonId: lesson.id,
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    q: exercise.q,
    options: exercise.options,
    answer: exercise.answer,
    explain: exercise.explain,
  }))
);

export const EXAM_POOL_SIZE = questionPool.length;

/* =========================================================
   随机工具（可复现：同 seed 同卷，便于重考）
========================================================= */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rnd) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* =========================================================
   出卷：抽题 + 选项乱序 + 正确项重映射
========================================================= */

export function buildExamPaper(seed = Date.now()) {
  const rnd = mulberry32(Number(seed) || Date.now());

  return shuffle(questionPool, rnd)
    .slice(0, Math.min(EXAM_QUESTION_COUNT, questionPool.length))
    .map((question) => {
      const order = shuffle(
        question.options.map((_, optionIndex) => optionIndex),
        rnd
      );

      return {
        ...question,
        options: order.map((optionIndex) => question.options[optionIndex]),
        answer: order.indexOf(question.answer),
      };
    });
}

/* =========================================================
   判分
========================================================= */

export function scoreExam(paper, answers) {
  const correct = paper.filter(
    (question, index) => answers[index] === question.answer
  ).length;

  const total = paper.length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    correct,
    total,
    percent,
    passed: percent >= EXAM_PASS_PERCENT,
  };
}

export { BASIC_READER_COURSE_ID };
