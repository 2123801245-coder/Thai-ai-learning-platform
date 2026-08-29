import express from "express";

import db from "../database.js";
import { authenticate } from "./auth.js";

const router = express.Router();

/* ============================================================
   GET /api/vocabulary
   获取词库（内置词库已由 database.js 启动时从
   src/data/vocabulary.js 同步进数据库）

   可选查询参数：
   category   分类（问候 / 数字 / 颜色 / …）
   difficulty 难度（beginner / intermediate / advanced）
   book       词书名称
============================================================ */

router.get("/", (req, res) => {
  const { category, difficulty, book } = req.query;

  const conditions = [];
  const params = [];

  if (category && category !== "all") {
    conditions.push("category = ?");
    params.push(category);
  }

  if (book && book !== "all") {
    conditions.push("(book = ? OR (book IS NULL AND category = ?))");
    params.push(book, book);
  }

  if (difficulty && difficulty !== "all") {
    conditions.push("difficulty = ?");
    params.push(difficulty);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  db.all(
    `
      SELECT
        id,
        thai_word,
        pronunciation,
        chinese_meaning,
        part_of_speech,
        example_thai,
        example_chinese,
        category,
        difficulty,
        book
      FROM vocabulary
      ${where}
      ORDER BY category, id
    `,
    params,
    (err, rows) => {
      if (err) {
        console.error("获取词库失败:", err);
        return res.status(500).json({
          message: "获取词库失败",
        });
      }

      res.json({
        data: rows || [],
        total: rows ? rows.length : 0,
      });
    }
  );
});

/* ============================================================
   GET /api/vocabulary/progress
   获取当前用户的词汇学习进度
   （认识 / 不认识 / 收藏 / 已掌握）
============================================================ */

router.get("/progress", authenticate, (req, res) => {
  db.all(
    `
      SELECT
        word_id,
        status,
        favorite,
        mastered,
        updated_at
      FROM vocabulary_progress
      WHERE user_id = ?
    `,
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("获取词汇进度失败:", err);
        return res.status(500).json({
          message: "获取词汇进度失败",
        });
      }

      const progress = {};

      for (const row of rows || []) {
        progress[row.word_id] = {
          status: row.status,
          favorite: Boolean(row.favorite),
          mastered: Boolean(row.mastered),
          updatedAt: row.updated_at,
        };
      }

      res.json({
        data: progress,
      });
    }
  );
});

/* ============================================================
   POST /api/vocabulary/progress
   保存单个单词的学习状态

   body: {
     wordId:   "greet-01",
     status:   "known" | "unknown" | null,   // 认识 / 不认识
     favorite: true | false | null,          // 收藏
     mastered: true | false | null,          // 已掌握
   }

   只更新传入的字段，返回该用户的最新完整进度。
============================================================ */

router.post("/progress", authenticate, (req, res) => {
  const { wordId, status, favorite, mastered } =
    req.body || {};

  if (!wordId) {
    return res.status(400).json({
      message: "缺少 wordId",
    });
  }

  // 先读当前值，做局部更新（不覆盖未传字段）
  db.get(
    `
      SELECT status, favorite, mastered
      FROM vocabulary_progress
      WHERE user_id = ? AND word_id = ?
    `,
    [req.userId, wordId],
    (err, row) => {
      if (err) {
        console.error("读取词汇进度失败:", err);
        return res.status(500).json({
          message: "保存词汇进度失败",
        });
      }

      const current = row || {};

      const newStatus =
        status === undefined
          ? current.status ?? null
          : status;

      const newFavorite =
        favorite === undefined
          ? current.favorite ?? 0
          : favorite
            ? 1
            : 0;

      const newMastered =
        mastered === undefined
          ? current.mastered ?? 0
          : mastered
            ? 1
            : 0;

      db.run(
        `
          INSERT INTO vocabulary_progress (
            user_id, word_id, status, favorite, mastered, updated_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, word_id) DO UPDATE SET
            status = excluded.status,
            favorite = excluded.favorite,
            mastered = excluded.mastered,
            updated_at = CURRENT_TIMESTAMP
        `,
        [req.userId, wordId, newStatus, newFavorite, newMastered],
        (err) => {
          if (err) {
            console.error("保存词汇进度失败:", err);
            return res.status(500).json({
              message: "保存词汇进度失败",
            });
          }

          // 返回该用户最新完整进度
          db.all(
            `
              SELECT
                word_id,
                status,
                favorite,
                mastered,
                updated_at
              FROM vocabulary_progress
              WHERE user_id = ?
            `,
            [req.userId],
            (err2, rows) => {
              if (err2) {
                return res.status(500).json({
                  message: "保存词汇进度失败",
                });
              }

              const progress = {};

              for (const r of rows || []) {
                progress[r.word_id] = {
                  status: r.status,
                  favorite: Boolean(r.favorite),
                  mastered: Boolean(r.mastered),
                  updatedAt: r.updated_at,
                };
              }

              res.json({
                message: "已保存",
                data: progress,
              });
            }
          );
        }
      );
    }
  );
});

/* ============================================================
   GET /api/conversations/scenes
   获取 AI 对话场景脚本
   （由 database.js 启动时从 src/data/conversations.js 同步）
============================================================ */

router.get("/scenes", (req, res) => {
  db.all(
    `
      SELECT id, title, description, icon, data
      FROM conversation_scenes
      ORDER BY id
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("获取对话场景失败:", err);
        return res.status(500).json({
          message: "获取对话场景失败",
        });
      }

      const scenes = (rows || []).map((row) => {
        try {
          return JSON.parse(row.data);
        } catch {
          // 数据损坏时至少返回基本信息
          return {
            id: row.id,
            title: row.title,
            description: row.description,
            icon: row.icon,
            dialogues: [],
            fallback: null,
          };
        }
      });

      res.json({
        data: scenes,
        total: scenes.length,
      });
    }
  );
});

/* ============================================================
   词汇测验学习记录

   POST /api/vocab/quiz/record   记录一次词汇测验（错题本 / 生词本 / 词书）
   GET  /api/vocab/quiz/stats    汇总统计（测验次数 / 正确率 / 最高分 / 最近记录）

   数据存 vocab_quiz_records 表，按泰国时区日期归档。
============================================================ */

// 泰国时区 (UTC+7) 的当天日期字符串 YYYY-MM-DD
function thaiToday() {
  const now = new Date();
  const iso = new Date(now.getTime() + 7 * 3600 * 1000).toISOString();
  return iso.slice(0, 10);
}

const QUIZ_TYPE_LABELS = {
  "thai-to-chinese": "泰译中",
  "chinese-to-thai": "中译泰",
  spelling: "拼写练习",
};
const DIFFICULTY_LABELS = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  all: "全部",
};
const SOURCE_LABELS = {
  book: "词书测验",
  wrong: "错题本复习",
};

router.post("/quiz/record", authenticate, (req, res) => {
  const {
    quizType,
    difficulty,
    source,
    correct,
    total,
  } = req.body || {};

  const c = Math.max(0, Math.round(Number(correct) || 0));
  const t = Math.max(0, Math.round(Number(total) || 0));

  if (!t) {
    return res.status(400).json({ message: "缺少测验数据" });
  }

  db.run(
    `INSERT INTO vocab_quiz_records (
       user_id, date, quiz_type, difficulty, source,
       correct, total, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      req.userId,
      thaiToday(),
      String(quizType || "").slice(0, 40),
      String(difficulty || "all").slice(0, 20),
      source === "wrong" ? "wrong" : "book",
      c,
      t,
    ],
    (err) => {
      if (err) {
        console.error("保存词汇测验记录失败:", err);
        return res.status(500).json({ message: "保存测验记录失败" });
      }
      res.json({ ok: true });
    }
  );
});

router.get("/quiz/stats", authenticate, (req, res) => {
  db.all(
    `SELECT id, date, quiz_type, difficulty, source, correct, total, created_at
     FROM vocab_quiz_records
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("读取词汇测验统计失败:", err);
        return res.status(500).json({ message: "获取统计失败" });
      }

      const list = rows || [];
      const today = thaiToday();

      let correctSum = 0;
      let totalSum = 0;
      let bestRate = 0;
      let bestScore = { correct: 0, total: 0 };
      let todaySessions = 0;
      const byType = {};
      const bySource = { book: 0, wrong: 0 };
      const dailyMap = new Map(); // date -> { sessions }

      for (const r of list) {
        correctSum += r.correct || 0;
        totalSum += r.total || 0;
        if (r.date === today) todaySessions++;
        bySource[r.source === "wrong" ? "wrong" : "book"] =
          (bySource[r.source === "wrong" ? "wrong" : "book"] || 0) + 1;

        const rate = r.total > 0 ? (r.correct || 0) / r.total : 0;
        if (rate > bestRate || (rate === bestRate && (r.correct || 0) > bestScore.correct)) {
          bestRate = rate;
          bestScore = { correct: r.correct || 0, total: r.total || 0 };
        }

        const key = r.quiz_type || "other";
        byType[key] = (byType[key] || 0) + 1;

        if (!dailyMap.has(r.date)) dailyMap.set(r.date, { sessions: 0 });
        dailyMap.get(r.date).sessions++;
      }

      const daily = [...dailyMap.entries()]
        .map(([date, v]) => ({ date, sessions: v.sessions }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14);

      res.json({
        totalSessions: list.length,
        todaySessions,
        accuracy: totalSum > 0 ? Math.round((correctSum / totalSum) * 100) : 0,
        totalQuestions: totalSum,
        correctQuestions: correctSum,
        bestScore,
        bestAccuracy: bestScore.total > 0 ? Math.round((bestScore.correct / bestScore.total) * 100) : 0,
        byType: Object.entries(byType).map(([type, count]) => ({
          type,
          label: QUIZ_TYPE_LABELS[type] || type,
          count,
        })),
        wrongSessions: bySource.wrong || 0,
        daily,
        recent: list.slice(0, 8).map((r) => ({
          id: r.id,
          date: r.date,
          quizType: r.quiz_type,
          quizTypeLabel: QUIZ_TYPE_LABELS[r.quiz_type] || r.quiz_type || "测验",
          difficultyLabel: DIFFICULTY_LABELS[r.difficulty] || r.difficulty || "全部",
          source: r.source === "wrong" ? "wrong" : "book",
          sourceLabel: SOURCE_LABELS[r.source === "wrong" ? "wrong" : "book"] || "词书测验",
          correct: r.correct || 0,
          total: r.total || 0,
          createdAt: r.created_at,
        })),
      });
    }
  );
});

export default router;
