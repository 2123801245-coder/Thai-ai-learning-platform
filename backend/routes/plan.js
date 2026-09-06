import express from "express";
import db from "../database.js";
import { authenticate } from "./auth.js";
import { extendVipDays } from "../vipService.js";
import { createNotification } from "./notifications.js";

const router = express.Router();

// 连续完成 N 天每日计划解锁 3 天 VIP（每满一个里程碑发一次）
const REWARD_MILESTONE = 7;
const REWARD_DAYS = 3;

/* 今天日期（服务器本地日期 YYYY-MM-DD） */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 查询用户全部打卡记录（升序） */
function getRecords(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT plan_date, completed_tasks, total_tasks, plan_completed
       FROM daily_plan_records
       WHERE user_id = ?
       ORDER BY plan_date ASC`,
      [userId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

/* 由打卡记录计算当前连续完成天数：
   从今天（或昨天，今天还没完成）往前数连续 plan_completed=1 的天数 */
function computeStreak(records, today) {
  const completed = new Set(
    records.filter((r) => r.plan_completed).map((r) => r.plan_date)
  );
  let count = 0;
  const d = new Date(today + "T00:00:00");
  // 若今天未完成，则从昨天开始算（连续中断尚未被判定）
  if (!completed.has(today)) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < 3650; i++) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (completed.has(date)) {
      count++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/* 查询已发放的奖励里程碑 */
function getRewardedMilestones(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT milestone FROM streak_rewards WHERE user_id = ?`,
      [userId],
      (err, rows) => (err ? reject(err) : resolve(new Set((rows || []).map((r) => r.milestone))))
    );
  });
}

/* ============================================================
   GET /api/plan/overview — 计划概览（连续天数 / 本周 / 奖励进度）
============================================================ */
router.get("/overview", authenticate, async (req, res) => {
  try {
    const records = await getRecords(req.userId);
    const today = todayStr();
    const streak = computeStreak(records, today);
    const rewarded = await getRewardedMilestones(req.userId);

    // 最近 7 天打卡状态
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const rec = records.find((r) => r.plan_date === date);
      week.push({
        date,
        completed: !!rec?.plan_completed,
        completedTasks: rec?.completed_tasks ?? 0,
        totalTasks: rec?.total_tasks ?? 0,
      });
    }

    // 下一里程碑：当前连续天数所在区间的下一个 7 的倍数
    const currentMilestone = Math.floor(streak / REWARD_MILESTONE) * REWARD_MILESTONE;
    const nextMilestone = currentMilestone + REWARD_MILESTONE;
    const daysToNext = Math.max(0, nextMilestone - streak);

    // 累计打卡天数（有记录即算，含未完成）
    const totalDays = records.length;

    res.json({
      streak,
      totalDays,
      week,
      reward: {
        milestone: REWARD_MILESTONE,
        rewardDays: REWARD_DAYS,
        nextMilestone,
        daysToNext,
        lastRewardedMilestone: rewarded.size > 0 ? Math.max(...rewarded) : null,
      },
    });
  } catch (err) {
    console.error("[plan] overview 失败:", err);
    res.status(500).json({ message: "获取学习计划概览失败" });
  }
});

/* ============================================================
   POST /api/plan/checkin — 每日打卡
   body: { date?, completedTasks, totalTasks, planCompleted }
   打卡后重算连续天数；连续满 7 天（每满 7 天）解锁 3 天 VIP
============================================================ */
router.post("/checkin", authenticate, async (req, res) => {
  const { date, completedTasks, totalTasks, planCompleted } = req.body || {};
  const planDate = String(date || todayStr()).slice(0, 10);
  const completed = Number(completedTasks) || 0;
  const total = Number(totalTasks) || 0;
  const done = planCompleted ? 1 : 0;

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO daily_plan_records (user_id, plan_date, completed_tasks, total_tasks, plan_completed, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, plan_date) DO UPDATE SET
           completed_tasks = excluded.completed_tasks,
           total_tasks = excluded.total_tasks,
           plan_completed = excluded.plan_completed,
           updated_at = CURRENT_TIMESTAMP`,
        [req.userId, planDate, completed, total, done],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const records = await getRecords(req.userId);
    const streak = computeStreak(records, todayStr());
    const rewarded = await getRewardedMilestones(req.userId);

    // 每满 7 天发放 3 天 VIP（幂等：同一里程碑只发一次）
    let rewardGranted = false;
    let rewardMessage = "";
    if (done && streak >= REWARD_MILESTONE) {
      const milestones = [];
      for (let m = REWARD_MILESTONE; m <= streak; m += REWARD_MILESTONE) {
        if (!rewarded.has(m)) milestones.push(m);
      }
      if (milestones.length > 0) {
        for (const m of milestones) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR IGNORE INTO streak_rewards (user_id, milestone, reward_days)
               VALUES (?, ?, ?)`,
              [req.userId, m, REWARD_DAYS],
              (err) => (err ? reject(err) : resolve())
            );
          });
          await extendVipDays(db, req.userId, REWARD_DAYS, "streak");
          await new Promise((resolve) => {
            createNotification(
              {
                userId: req.userId,
                type: "学习奖励",
                title: `连续完成 ${m} 天计划，解锁 3 天 VIP！`,
                content: `坚持就是胜利！连续 ${m} 天完成每日计划，已为你解锁 ${REWARD_DAYS} 天 VIP 会员 🎉`,
                icon: "🔥",
                action: "vip",
                key: `streak-${m}`,
              },
              () => resolve()
            );
          });
          rewardGranted = true;
          rewardMessage = `连续完成 ${m} 天计划，已解锁 ${REWARD_DAYS} 天 VIP！`;
        }
      }
    }

    // 刷新奖励集合后返回
    const rewardedAfter = await getRewardedMilestones(req.userId);
    const currentMilestone = Math.floor(streak / REWARD_MILESTONE) * REWARD_MILESTONE;
    const nextMilestone = currentMilestone + REWARD_MILESTONE;

    res.json({
      streak,
      totalDays: records.length,
      rewardGranted,
      rewardMessage,
      reward: {
        milestone: REWARD_MILESTONE,
        rewardDays: REWARD_DAYS,
        nextMilestone,
        daysToNext: Math.max(0, nextMilestone - streak),
        lastRewardedMilestone: rewardedAfter.size > 0 ? Math.max(...rewardedAfter) : null,
      },
    });
  } catch (err) {
    console.error("[plan] checkin 失败:", err);
    res.status(500).json({ message: "打卡失败" });
  }
});

export default router;
