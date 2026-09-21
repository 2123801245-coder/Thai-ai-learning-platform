// src/backend/routes/profile.js
//
// ============================================================
// 用户学习画像（AI 入学测试产物）
// ============================================================
//
// 表结构：user_profiles（一个用户一行，user_id UNIQUE）
//
//   GET    /api/profile   → 读取当前用户画像（没有则返回 null）
//   POST   /api/profile   → 写入 / 覆盖画像（测试完成时调用）
//   DELETE /api/profile   → 清除画像（重新测试用）
//
// 存储约定：
//   - 多选题（专业方向 / 兴趣媒体 / 学习方式 / 目标）用逗号分隔字符串存；
//     接口出入参一律是数组，前端不需要关心存储细节。
//   - test_detail 存 JSON 文本（各板块正确率、等级判定依据），
//     供后续个性化推荐使用；接口层面解析成对象返回。
//
// 鉴权：全部需要登录（authenticate），操作对象恒为 req.userId，
// 不接受客户端传 user_id，避免越权读写他人画像。
// ============================================================

import express from "express";

import db from "../database.js";
import { authenticate } from "./auth.js";

const router = express.Router();

// ============================================================
// 合法等级（与前端 src/lib/placement.js 的 LEVELS 保持一致）
// ============================================================

const VALID_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"];

const MAX_LIST_ITEMS = 12;
const MAX_ITEM_LENGTH = 40;
const MAX_TEXT_LENGTH = 80;

/* ============================================================
   工具：入库前把数组压成逗号分隔字符串
============================================================ */

function toCsv(value, max = MAX_LIST_ITEMS) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((s) => s.trim());

  return list
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, MAX_ITEM_LENGTH))
    .join(",");
}

/* ============================================================
   工具：出库时把逗号分隔字符串还原成数组
============================================================ */

function fromCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ============================================================
   工具：安全解析 test_detail（损坏时返回空对象，不影响主流程）
============================================================ */

function parseDetail(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("解析画像测试明细失败:", error);
    return null;
  }
}

/* ============================================================
   工具：数据库行 → 前端画像对象
============================================================ */

function rowToProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,

    thaiLevel: row.thai_level || "A0",
    learningGoal: row.learning_goal || "",

    professionalDirection: fromCsv(row.professional_direction),
    mediaInterest: fromCsv(row.media_interest),
    learningStyle: fromCsv(row.learning_style),

    targetScenario: row.target_scenario || "",

    testScore: row.test_score || 0,
    testDetail: parseDetail(row.test_detail),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ============================================================
   GET /api/profile
   读取当前用户的画像（未测试 → profile: null）
============================================================ */

router.get("/", authenticate, (req, res) => {
  db.get(
    `
      SELECT *
      FROM user_profiles
      WHERE user_id = ?
    `,
    [req.userId],
    (err, row) => {
      if (err) {
        console.error("读取学习画像失败:", err);
        return res.status(500).json({
          message: "读取学习画像失败",
        });
      }

      res.json({ profile: rowToProfile(row) });
    }
  );
});

/* ============================================================
   POST /api/profile
   写入 / 覆盖画像（AI 入学测试完成时调用）

   body: {
     thaiLevel:             "A0" | "A1" | "A2" | "B1" | "B2" | "C1",
     learningGoal:          "travel",
     professionalDirection: ["business", "news"],
     mediaInterest:         ["drama", "song"],
     learningStyle:         ["visual", "listening"],
     targetScenario:        "机场值机与酒店入住",
     testScore:             63,            // 百分比
     testDetail:            { ... }        // 任意 JSON（板块正确率等）
   }
============================================================ */

router.post("/", authenticate, (req, res) => {
  const body = req.body || {};

  const thaiLevel = String(body.thaiLevel || "").trim().toUpperCase();

  if (!VALID_LEVELS.includes(thaiLevel)) {
    return res.status(400).json({
      message: "thaiLevel 无效，应为 A0 / A1 / A2 / B1 / B2 / C1",
    });
  }

  const learningGoal = String(body.learningGoal || "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  const targetScenario = String(body.targetScenario || "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  const professionalDirection = toCsv(body.professionalDirection);
  const mediaInterest = toCsv(body.mediaInterest);
  const learningStyle = toCsv(body.learningStyle);

  // 得分与明细是「可选补充信息」：本次没传就保留库里已有的值（不清空），
  // 新用户插入时给 0 / NULL。用 CASE 参数判断是否传了，避免多一次查询。
  const hasScore =
    body.testScore !== undefined &&
    body.testScore !== null &&
    body.testScore !== "";

  const testScore = hasScore
    ? Math.min(100, Math.max(0, Math.round(Number(body.testScore) || 0)))
    : 0;

  const hasDetail =
    !!body.testDetail && typeof body.testDetail === "object";

  let testDetail = null;

  if (hasDetail) {
    try {
      testDetail = JSON.stringify(body.testDetail).slice(0, 8000);
    } catch (error) {
      console.error("序列化测试明细失败:", error);
      testDetail = null;
    }
  }

  // 一个用户一行：有则更新，无则插入（幂等）
  db.run(
    `
      INSERT INTO user_profiles (
        user_id,
        thai_level,
        learning_goal,
        professional_direction,
        media_interest,
        learning_style,
        target_scenario,
        test_score,
        test_detail,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        thai_level             = excluded.thai_level,
        learning_goal          = excluded.learning_goal,
        professional_direction = excluded.professional_direction,
        media_interest         = excluded.media_interest,
        learning_style         = excluded.learning_style,
        target_scenario        = excluded.target_scenario,
        test_score             = CASE WHEN ? THEN excluded.test_score
                                     ELSE user_profiles.test_score END,
        test_detail            = CASE WHEN ? THEN excluded.test_detail
                                     ELSE user_profiles.test_detail END,
        updated_at             = CURRENT_TIMESTAMP
    `,
    [
      req.userId,
      thaiLevel,
      learningGoal,
      professionalDirection,
      mediaInterest,
      learningStyle,
      targetScenario,
      testScore,
      testDetail,
      hasScore ? 1 : 0,
      hasDetail ? 1 : 0,
    ],
    function (err) {
      if (err) {
        console.error("保存学习画像失败:", err);
        return res.status(500).json({
          message: "保存学习画像失败",
        });
      }

      // 回读一次，保证返回的是库里的最终状态
      db.get(
        `
          SELECT *
          FROM user_profiles
          WHERE user_id = ?
        `,
        [req.userId],
        (readErr, row) => {
          if (readErr) {
            console.error("回读学习画像失败:", readErr);
            return res.status(500).json({
              message: "保存成功，但读取失败，请刷新重试",
            });
          }

          res.json({
            message: "学习画像已保存",
            profile: rowToProfile(row),
          });
        }
      );
    }
  );
});

/* ============================================================
   DELETE /api/profile
   清除画像（用户想重新做入学测试时使用）
============================================================ */

router.delete("/", authenticate, (req, res) => {
  db.run(
    `
      DELETE FROM user_profiles
      WHERE user_id = ?
    `,
    [req.userId],
    function (err) {
      if (err) {
        console.error("清除学习画像失败:", err);
        return res.status(500).json({
          message: "清除学习画像失败",
        });
      }

      res.json({
        message: "学习画像已清除",
        deleted: this.changes || 0,
      });
    }
  );
});

export default router;
