// backend/routes/notifications.js
//
// 真实消息中心 API：
//   GET  /api/notifications          用户：通知列表（自动补齐 VIP 到期提醒）
//   POST /api/notifications/:id/read 用户：标记单条已读
//   POST /api/notifications/read-all 用户：全部标记已读
//
// 事件源（真实通知的产生方）：
//   - VIP 到期前 3 天（GET 时幂等补齐，与首页横幅同源）
//   - VIP 激活成功（auth.js 调用 createNotification）
//   - 后续可扩展：课程完成、连续学习里程碑、系统公告等

import { Router } from "express";
import db from "../database.js";
import { authenticate } from "./auth.js";

const router = Router();

/* ============================================================
   写通知（供其它路由调用，幂等：同一 key 不重复插入）
   options: { userId, type, title, content, icon, action, link, key }
   key 用于去重（如 "vip-expiry"），没有 key 则每次都插入
============================================================ */

export function createNotification(options, callback) {
  const {
    userId,
    type = "系统消息",
    title,
    content,
    icon = "📢",
    action = null,
    link = null,
    key = null,
  } = options;

  const insert = () => {
    db.run(
      `INSERT INTO notifications
        (user_id, type, title, content, icon, action, link)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, title, content, icon, action, link],
      (err) => {
        if (callback) callback(err);
      }
    );
  };

  if (key) {
    // 幂等：同 key 存在（未读）则更新内容，不重复堆积
    db.get(
      `SELECT id FROM notifications
       WHERE user_id = ? AND action = ?
       ORDER BY id DESC LIMIT 1`,
      [userId, key],
      (err, row) => {
        if (err) {
          if (callback) callback(err);
          return;
        }

        if (row) {
          db.run(
            `UPDATE notifications
             SET title = ?, content = ?, is_read = 0,
                 created_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, content, row.id],
            (updErr) => {
              if (callback) callback(updErr);
            }
          );
          return;
        }

        insert();
      }
    );
    return;
  }

  insert();
}

/* ============================================================
   幂等补齐 VIP 到期提醒（到期前 3 天）
   与首页横幅同一判定逻辑，保证横幅和消息中心一致
============================================================ */

function syncVipExpiryNotice(userId, callback) {
  db.get(
    "SELECT is_vip, vip_expires_at FROM users WHERE id = ? LIMIT 1",
    [userId],
    (err, user) => {
      if (err || !user || !user.is_vip || !user.vip_expires_at) {
        if (callback) callback(null, null);
        return;
      }

      const expiry = new Date(
        String(user.vip_expires_at).replace(" ", "T") + "Z"
      );

      if (Number.isNaN(expiry.getTime())) {
        if (callback) callback(null, null);
        return;
      }

      const daysLeft = Math.ceil(
        (expiry.getTime() - Date.now()) / 86400000
      );

      if (daysLeft >= 1 && daysLeft <= 3) {
        const dateStr = expiry
          .toISOString()
          .slice(0, 10);

        createNotification(
          {
            userId,
            type: "VIP 提醒",
            title: "VIP 即将到期",
            content: `您的 VIP 会员还剩 ${daysLeft} 天到期（${dateStr}），点击立即续费`,
            icon: "👑",
            action: "vip",
            link: null,
            key: "vip-expiry",
          },
          () => {
            if (callback) callback(null, null);
          }
        );
        return;
      }

      if (callback) callback(null, null);
    }
  );
}

/* ============================================================
   GET /api/notifications —— 通知列表 + 未读数
============================================================ */

router.get("/", authenticate, (req, res) => {
  syncVipExpiryNotice(req.userId, () => {
    db.all(
      `SELECT id, type, title, content, icon, action, link,
              is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [req.userId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            message: "获取通知失败",
          });
        }

        const list = (rows || []).map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          content: row.content,
          icon: row.icon,
          action: row.action,
          link: row.link,
          isRead: !!row.is_read,
          createdAt: row.created_at,
        }));

        res.json({
          list,
          unreadCount: list.filter((n) => !n.isRead).length,
        });
      }
    );
  });
});

/* ============================================================
   POST /api/notifications/:id/read —— 标记单条已读
============================================================ */

router.post("/:id/read", authenticate, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      message: "参数错误",
    });
  }

  db.run(
    `UPDATE notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`,
    [id, req.userId],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: "标记失败",
        });
      }

      res.json({ ok: true });
    }
  );
});

/* ============================================================
   POST /api/notifications/read-all —— 全部标记已读
============================================================ */

router.post("/read-all", authenticate, (req, res) => {
  db.run(
    `UPDATE notifications
     SET is_read = 1
     WHERE user_id = ?`,
    [req.userId],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: "标记失败",
        });
      }

      res.json({ ok: true });
    }
  );
});

export default router;
