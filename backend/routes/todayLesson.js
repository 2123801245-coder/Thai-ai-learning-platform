import express from "express";

import db from "../database.js";
import { authenticate } from "./auth.js";

const router = express.Router();

/* ============================================================
   「学 · AI 定制新课」的今日课程（可回访）

   sessionStorage 只在标签页里活一次；这里把课存进 today_lessons 表，
   刷新或换设备后 /loop 和 /conversation 都能拉回来接着练。

   GET   /api/ai/today-lesson            读今天的课（?date=YYYY-MM-DD 可查历史）
   PUT   /api/ai/today-lesson            存/覆盖今天的课（换个主题 → 覆盖）
   PATCH /api/ai/today-lesson/progress   推进例句进度（只增不减）
============================================================ */

// 泰国时区 (UTC+7) 的当天日期字符串 YYYY-MM-DD（与 news.js / vocabulary.js 同口径）
function thaiToday() {
  const now = new Date();
  const iso = new Date(now.getTime() + 7 * 3600 * 1000).toISOString();
  return iso.slice(0, 10);
}

// 课程 JSON 上限：一节课最多 7 词 + 4 句 + 3 题，32KB 足够，防手拍接口塞垃圾
const MAX_LESSON_BYTES = 32 * 1024;

const asText = (v) => String(v ?? "").trim();

/* 与前端 src/lib/customLesson.js 同一份数据形状（多留 exercise 供回访时继续练） */
function sanitizeLesson(input) {
  if (!input || typeof input !== "object") return null;

  const lesson = {
    topic: asText(input.topic),
    goal: asText(input.goal),
    tip: asText(input.tip),
    nextTopic: asText(input.nextTopic),
    vocab: (Array.isArray(input.vocab) ? input.vocab : [])
      .slice(0, 7)
      .map((v) => ({
        th: asText(v?.th || v?.thai),
        roman: asText(v?.roman),
        cn: asText(v?.cn || v?.meaning),
      }))
      .filter((v) => v.th),
    sentences: (Array.isArray(input.sentences) ? input.sentences : [])
      .slice(0, 4)
      .map((s) => ({ th: asText(s?.th), roman: asText(s?.roman), cn: asText(s?.cn) }))
      .filter((s) => s.th),
    exercise: (Array.isArray(input.exercise) ? input.exercise : [])
      .slice(0, 3)
      .map((e) => ({
        question: asText(e?.question),
        answer: asText(e?.answer),
        hint: asText(e?.hint),
      }))
      .filter((e) => e.question),
  };

  if (!lesson.topic) return null;
  return lesson;
}

/* 读今天的课 */
router.get("/today-lesson", authenticate, (req, res) => {
  const raw = String(req.query.date || "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : thaiToday();

  db.get(
    `
      SELECT lesson_json, done_count, source, updated_at
      FROM today_lessons
      WHERE user_id = ? AND lesson_date = ?
    `,
    [req.userId, date],
    (err, row) => {
      if (err) {
        console.error("读取今日课程失败:", err);
        return res.status(500).json({ message: "读取今日课程失败" });
      }
      // 没存过 → null（前端照常本地闭环）；存坏了也当没有（坏 JSON 不值得 500）
      if (!row) return res.json({ data: null });

      let lesson = null;
      try {
        lesson = JSON.parse(row.lesson_json);
      } catch {
        lesson = null;
      }
      if (!lesson || !lesson.topic) return res.json({ data: null });

      res.json({
        data: {
          date,
          lesson,
          doneCount: row.done_count || 0,
          source: row.source || "learn-loop",
          updatedAt: row.updated_at,
        },
      });
    }
  );
});

/* 存（或覆盖）今天的课：换个主题再学一节时直接覆盖，进度清零；
   lesson = null → 清空当天存档（「换个主题」作废旧课，换设备后不能再回访旧课） */
router.put("/today-lesson", authenticate, (req, res) => {
  const raw = req.body?.lesson;
  if (raw === null || raw === undefined) {
    db.run(
      `DELETE FROM today_lessons WHERE user_id = ? AND lesson_date = ?`,
      [req.userId, thaiToday()],
      (err) => {
        if (err) {
          console.error("清除今日课程失败:", err);
          return res.status(500).json({ message: "清除今日课程失败" });
        }
        return res.json({ ok: true, cleared: true });
      }
    );
    return;
  }

  const lesson = sanitizeLesson(raw);
  if (!lesson) {
    return res.status(400).json({ message: "课程内容不完整（缺少主题）" });
  }

  const payload = JSON.stringify(lesson);
  if (Buffer.byteLength(payload, "utf8") > MAX_LESSON_BYTES) {
    return res.status(400).json({ message: "课程内容过大，无法保存" });
  }

  const doneCount = Math.max(0, Math.min(99, Math.round(Number(req.body?.doneCount) || 0)));
  const source = asText(req.body?.source).slice(0, 40) || "learn-loop";

  db.run(
    `
      INSERT INTO today_lessons (user_id, lesson_date, lesson_json, done_count, source, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, lesson_date) DO UPDATE SET
        lesson_json = excluded.lesson_json,
        done_count = excluded.done_count,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `,
    [req.userId, thaiToday(), payload, doneCount, source],
    (err) => {
      if (err) {
        console.error("保存今日课程失败:", err);
        return res.status(500).json({ message: "保存今日课程失败" });
      }
      res.json({ ok: true });
    }
  );
});

/* 只推进进度（不覆盖课）：MAX 保证重复点同一句 / 乱序点不会往回退 */
router.patch("/today-lesson/progress", authenticate, (req, res) => {
  const doneCount = Math.max(0, Math.min(99, Math.round(Number(req.body?.doneCount) || 0)));

  db.run(
    `
      UPDATE today_lessons
      SET done_count = MAX(done_count, ?), updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND lesson_date = ?
    `,
    [doneCount, req.userId, thaiToday()],
    function (err) {
      if (err) {
        console.error("更新今日课程进度失败:", err);
        return res.status(500).json({ message: "更新今日课程进度失败" });
      }
      res.json({ ok: true, updated: this.changes > 0 });
    }
  );
});

export default router;
