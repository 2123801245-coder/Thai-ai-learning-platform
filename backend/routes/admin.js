import express from "express";
import crypto from "crypto";

import db from "../database.js";
import {
  authenticate,
  isAdminRow,
} from "./auth.js";

const router = express.Router();

// ============================================================
// 管理员中间件
// ============================================================

function requireAdmin(req, res, next) {
  db.get(
    `
    SELECT id, email, role
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [req.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "数据库错误",
        });
      }

      if (!user) {
        return res.status(404).json({
          message: "用户不存在",
        });
      }

      if (!isAdminRow(user)) {
        return res.status(403).json({
          message: "需要管理员权限",
        });
      }

      next();
    }
  );
}

// ============================================================
// 生成激活码
// POST /api/admin/vip-codes
// body: { count, days, prefix }
// ============================================================

router.post(
  "/vip-codes",
  authenticate,
  requireAdmin,
  (req, res) => {
    const count = Math.min(
      Math.max(Number(req.body?.count) || 1, 1),
      500
    );
    const days = Math.min(
      Math.max(Number(req.body?.days) || 30, 1),
      3650
    );
    const prefix = String(req.body?.prefix || "THAI-VIP")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "-")
      .slice(0, 16) || "THAI-VIP";

    const codes = [];

    for (let i = 0; i < count; i++) {
      const rand = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();
      codes.push(`${prefix}-${rand}`);
    }

    const stmt = db.prepare(
      `
      INSERT OR IGNORE INTO vip_codes (code, duration_days)
      VALUES (?, ?)
      `
    );

    let inserted = 0;

    db.serialize(() => {
      for (const code of codes) {
        stmt.run(code, days, (err) => {
          if (!err) inserted++;
        });
      }
    });

    stmt.finalize(() => {
      res.status(201).json({
        message: `成功生成 ${inserted} 个激活码`,
        count: inserted,
        codes: codes.slice(0, inserted),
      });
    });
  }
);

// ============================================================
// 激活码列表
// GET /api/admin/vip-codes?status=unused|used|all
// ============================================================

router.get(
  "/vip-codes",
  authenticate,
  requireAdmin,
  (req, res) => {
    const status = req.query.status || "all";
    const where =
      status === "unused"
        ? "WHERE vc.used_by IS NULL"
        : status === "used"
        ? "WHERE vc.used_by IS NOT NULL"
        : "";

    db.all(
      `
      SELECT
        vc.id,
        vc.code,
        vc.duration_days,
        vc.used_by,
        vc.used_at,
        vc.created_at,
        u.email AS used_by_email,
        u.nickname AS used_by_nickname
      FROM vip_codes vc
      LEFT JOIN users u ON u.id = vc.used_by
      ${where}
      ORDER BY vc.id DESC
      LIMIT 1000
      `,
      [],
      (err, rows) => {
        if (err) {
          console.error("List vip codes error:", err);
          return res.status(500).json({
            message: "数据库错误",
          });
        }

        res.json({
          total: rows.length,
          codes: rows,
        });
      }
    );
  }
);

// ============================================================
// 收款对账台账
// POST /api/admin/ledger
// body: { customerName, customerContact, amount, planDays, vipCodeId, status, note, paidAt }
// ============================================================

router.get("/ledger", authenticate, requireAdmin, (req, res) => {
  const status = String(req.query.status || "all");
  const where = status === "all" ? "" : "WHERE sl.status = ?";
  const params = status === "all" ? [] : [status];

  db.all(
    `
      SELECT sl.*, vc.code AS vip_code, vc.used_by, vc.used_at,
             u.email AS used_by_email, u.nickname AS used_by_nickname
      FROM sales_ledger sl
      LEFT JOIN vip_codes vc ON vc.id = sl.vip_code_id
      LEFT JOIN users u ON u.id = vc.used_by
      ${where}
      ORDER BY sl.id DESC
      LIMIT 1000
    `,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "数据库错误" });
      res.json({ records: rows });
    }
  );
});

router.post("/ledger", authenticate, requireAdmin, (req, res) => {
  const name = String(req.body?.customerName || "").trim().slice(0, 100);
  const contact = String(req.body?.customerContact || "").trim().slice(0, 100);
  const amount = Math.round(Number(req.body?.amount) * 100);
  const planDays = Math.round(Number(req.body?.planDays));
  const codeId = req.body?.vipCodeId ? Number(req.body.vipCodeId) : null;
  const status = ["pending", "paid", "refunded", "cancelled"].includes(req.body?.status)
    ? req.body.status
    : "pending";
  const note = String(req.body?.note || "").trim().slice(0, 500);

  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000 || ![30, 90, 365].includes(planDays)) {
    return res.status(400).json({ message: "金额或套餐天数无效" });
  }

  const insert = () => db.run(
    `INSERT INTO sales_ledger
      (customer_name, customer_contact, amount_cents, plan_days, vip_code_id, status, note, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, contact, amount, planDays, codeId, status, status === "paid" ? new Date().toISOString() : null],
    function (err) {
      if (err) return res.status(500).json({ message: "保存失败" });
      db.get("SELECT * FROM sales_ledger WHERE id = ?", [this.lastID], (getErr, row) => {
        if (getErr) return res.status(500).json({ message: "保存失败" });
        res.status(201).json({ record: row });
      });
    }
  );

  if (!codeId) return insert();
  db.get("SELECT id FROM vip_codes WHERE id = ?", [codeId], (err, code) => {
    if (err) return res.status(500).json({ message: "数据库错误" });
    if (!code) return res.status(400).json({ message: "激活码不存在" });
    insert();
  });
});

router.patch("/ledger/:id", authenticate, requireAdmin, (req, res) => {
  const status = String(req.body?.status || "");
  if (!["pending", "paid", "refunded", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "状态无效" });
  }
  db.run(
    `UPDATE sales_ledger SET status = ?, paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = ?`,
    [status, status, Number(req.params.id)],
    function (err) {
      if (err) return res.status(500).json({ message: "更新失败" });
      if (!this.changes) return res.status(404).json({ message: "记录不存在" });
      res.json({ message: "状态已更新" });
    }
  );
});

router.get("/ledger/export", authenticate, requireAdmin, (req, res) => {
  db.all(
    `SELECT sl.*, vc.code AS vip_code, u.email AS used_by_email
     FROM sales_ledger sl
     LEFT JOIN vip_codes vc ON vc.id = sl.vip_code_id
     LEFT JOIN users u ON u.id = vc.used_by
     ORDER BY sl.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "数据库错误" });
      const header = ["客户", "联系方式", "金额", "套餐(天)", "激活码", "台账状态", "激活码使用者", "付款时间", "备注", "创建时间"];
      const lines = rows.map((r) => [r.customer_name, r.customer_contact, (r.amount_cents / 100).toFixed(2), r.plan_days, r.vip_code || "", r.status, r.used_by_email || "", r.paid_at || "", r.note || "", r.created_at || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="sales-ledger-${Date.now()}.csv"`);
      res.send("\uFEFF" + [header.join(","), ...lines].join("\n"));
    }
  );
});

// ============================================================
// 导出激活码 CSV
// GET /api/admin/vip-codes/export?status=unused|used|all
// ============================================================

router.get(
  "/vip-codes/export",
  authenticate,
  requireAdmin,
  (req, res) => {
    const status = req.query.status || "all";
    const where =
      status === "unused"
        ? "WHERE vc.used_by IS NULL"
        : status === "used"
        ? "WHERE vc.used_by IS NOT NULL"
        : "";

    db.all(
      `
      SELECT
        vc.code,
        vc.duration_days,
        vc.used_by,
        vc.used_at,
        vc.created_at,
        u.email AS used_by_email
      FROM vip_codes vc
      LEFT JOIN users u ON u.id = vc.used_by
      ${where}
      ORDER BY vc.id DESC
      `,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            message: "数据库错误",
          });
        }

        const header = [
          "激活码",
          "有效期(天)",
          "状态",
          "使用者邮箱",
          "使用时间",
          "生成时间",
        ];

        const lines = rows.map((r) =>
          [
            r.code,
            r.duration_days,
            r.used_by ? "已使用" : "未使用",
            r.used_by_email || "",
            r.used_at || "",
            r.created_at || "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );

        const csv = [header.join(","), ...lines].join("\n");

        res.setHeader(
          "Content-Type",
          "text/csv; charset=utf-8"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="vip-codes-${Date.now()}.csv"`
        );

        // 加 BOM 让 Excel 正确识别中文
        res.send("\uFEFF" + csv);
      }
    );
  }
);

export default router;
