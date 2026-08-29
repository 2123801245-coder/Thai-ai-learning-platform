import express from "express";

import db from "../database.js";
import { authenticate } from "./auth.js";

const router = express.Router();

/* ============================================================
   把一行 lesson_progress 转成前端 localStorage 形状
============================================================ */

function lessonToFrontend(row) {
  return {
    progress: row.progress || 0,
    lastPosition: row.last_position || 0,
    updatedAt: row.updated_at,
  };
}

/* ============================================================
   GET /api/progress
   获取当前用户的全部课程学习进度

   返回结构与前端 localStorage 形状一致，可直接写入：
   {
     data: {
       [courseId]: {
         completed: { [lessonId]: true },
         lessonProgress: { [lessonId]: { progress, lastPosition, updatedAt } },
         lastLessonId,
         updatedAt,
       }
     }
   }
============================================================ */

router.get("/", authenticate, (req, res) => {
  db.all(
    `
      SELECT rowid, course_id, lesson_id, progress, completed, last_position, updated_at
      FROM lesson_progress
      WHERE user_id = ?
      ORDER BY updated_at ASC, rowid ASC
    `,
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("获取课程进度失败:", err);
        return res.status(500).json({
          message: "获取课程进度失败",
        });
      }

      const data = {};

      for (const row of rows || []) {
        const courseId = row.course_id;

        if (!data[courseId]) {
          data[courseId] = {
            completed: {},
            lessonProgress: {},
            lastLessonId: null,
            updatedAt: null,
          };
        }

        const entry = data[courseId];

        entry.lessonProgress[row.lesson_id] =
          lessonToFrontend(row);

        if (row.completed) {
          entry.completed[row.lesson_id] = true;
        }

        // 课程级 lastLessonId = 该课程最后一次写入的那行
        //（用 rowid 判断先后，避免同一秒内的时间戳并列）
        if (
          !entry.lastRowId ||
          row.rowid > entry.lastRowId
        ) {
          entry.lastRowId = row.rowid;
          entry.updatedAt = row.updated_at;
          entry.lastLessonId = row.lesson_id;
        }
      }

      res.json({ data });
    }
  );
});

/* ============================================================
   POST /api/lesson-progress
   保存单节视频的播放进度（局部更新，只覆盖传入的字段）

   body: {
     courseId:     "thai-pronunciation",
     lessonId:     "pronunciation-01",
     progress:     0-100,     // 可选，播放百分比
     lastPosition: 秒,         // 可选，上次播放位置
     completed:    true,      // 可选，是否完成
   }

   返回该用户的最新完整进度（与 GET /api/progress 相同形状）。
============================================================ */

router.post("/", authenticate, (req, res) => {
  const { courseId, lessonId, progress, lastPosition, completed } =
    req.body || {};

  if (!courseId || !lessonId) {
    return res.status(400).json({
      message: "缺少 courseId 或 lessonId",
    });
  }

  // 先读当前行，做局部更新（不覆盖未传字段）
  db.get(
    `
      SELECT progress, completed, last_position
      FROM lesson_progress
      WHERE user_id = ? AND course_id = ? AND lesson_id = ?
    `,
    [req.userId, courseId, lessonId],
    (err, row) => {
      if (err) {
        console.error("读取课程进度失败:", err);
        return res.status(500).json({
          message: "保存课程进度失败",
        });
      }

      const current = row || {};

      const newProgress =
        progress === undefined
          ? current.progress ?? 0
          : Math.min(
              100,
              Math.max(0, Math.round(Number(progress) || 0))
            );

      const newCompleted =
        completed === undefined
          ? current.completed ?? 0
          : completed
            ? 1
            : 0;

      const newLastPosition =
        lastPosition === undefined
          ? current.last_position ?? 0
          : Math.max(0, Number(lastPosition) || 0);

      // 播放到阈值自动完成（与前端逻辑一致）
      const finalCompleted =
        newCompleted || newProgress >= 90
          ? 1
          : newCompleted;

      db.run(
        `
          INSERT INTO lesson_progress (
            user_id, course_id, lesson_id,
            progress, completed, last_position, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET
            progress = excluded.progress,
            completed = excluded.completed,
            last_position = excluded.last_position,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          req.userId,
          courseId,
          lessonId,
          newProgress,
          finalCompleted,
          newLastPosition,
        ],
        (err) => {
          if (err) {
            console.error("保存课程进度失败:", err);
            return res.status(500).json({
              message: "保存课程进度失败",
            });
          }

          // 返回该用户最新完整进度
          db.all(
            `
              SELECT rowid, course_id, lesson_id, progress, completed, last_position, updated_at
              FROM lesson_progress
              WHERE user_id = ?
              ORDER BY updated_at ASC, rowid ASC
            `,
            [req.userId],
            (err2, rows) => {
              if (err2) {
                return res.status(500).json({
                  message: "保存课程进度失败",
                });
              }

              const data = {};

              for (const r of rows || []) {
                const cid = r.course_id;

                if (!data[cid]) {
                  data[cid] = {
                    completed: {},
                    lessonProgress: {},
                    lastLessonId: null,
                    updatedAt: null,
                  };
                }

                const entry = data[cid];

                entry.lessonProgress[r.lesson_id] =
                  lessonToFrontend(r);

                if (r.completed) {
                  entry.completed[r.lesson_id] = true;
                }

                if (
                  !entry.lastRowId ||
                  r.rowid > entry.lastRowId
                ) {
                  entry.lastRowId = r.rowid;
                  entry.updatedAt = r.updated_at;
                  entry.lastLessonId = r.lesson_id;
                }
              }

              res.json({
                message: "已保存",
                data,
              });
            }
          );
        }
      );
    }
  );
});

export default router;
