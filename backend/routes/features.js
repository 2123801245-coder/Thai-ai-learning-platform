// backend/routes/features.js
//
// 功能开关 API：
//   GET  /api/features          公共：读取全部功能开关（供前端启动时加载）
//   PUT  /api/admin/features    管理员：更新功能开关（设置页可视化操作）

import { Router } from "express";
import db from "../database.js";
import {
  authenticate,
  isAdminRow,
} from "./auth.js";

const router = Router();

/* ============================================================
   功能开关默认值（未在 DB 记录时使用）
============================================================ */

const DEFAULT_FEATURES = {
  aiTeacher: true,
};

/* ============================================================
   管理员鉴权：authenticate 只解析 userId，这里查库判断角色
============================================================ */

const requireAdmin = (req, res, next) => {
  db.get(
    "SELECT * FROM users WHERE id = ?",
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
};

/* ============================================================
   读写 settings 表
============================================================ */

const getSetting = (key) =>
  new Promise((resolve, reject) => {
    db.get(
      "SELECT value FROM settings WHERE key = ?",
      [key],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.value : null);
      }
    );
  });

const setSetting = (key, value) =>
  new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, value],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

/* 读取全部开关（布尔化） */

async function readAllFeatures() {
  const result = { ...DEFAULT_FEATURES };

  for (const key of Object.keys(result)) {
    const value = await getSetting(key);

    if (value !== null) {
      result[key] = value === "true";
    }
  }

  return result;
}

/* ============================================================
   实时同步：SSE 长连接（EventSource）
   任何端修改开关后，所有在线端立即收到推送。
============================================================ */

const featureClients = new Set();

/* 心跳：每 25s 发注释行，防止代理/网络空闲断开 */

setInterval(() => {
  featureClients.forEach((client) => {
    try {
      client.write(": ping\n\n");
    } catch (e) {
      featureClients.delete(client);
    }
  });
}, 25000);

async function broadcastFeatures() {
  let payload = "";

  try {
    const features = await readAllFeatures();
    payload = `data: ${JSON.stringify(features)}\n\n`;
  } catch (e) {
    payload = `data: ${JSON.stringify({
      ...DEFAULT_FEATURES,
    })}\n\n`;
  }

  featureClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      featureClients.delete(client);
    }
  });
}

/* ============================================================
   GET /api/features（公共）
============================================================ */

/* ============================================================
   GET /api/features/stream（SSE 实时推送，EventSource 连接）
============================================================ */

router.get("/features/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();

  /* 连接建立时先推当前快照 */

  try {
    const features = await readAllFeatures();
    res.write(`data: ${JSON.stringify(features)}\n\n`);
  } catch (e) {
    // ignore
  }

  featureClients.add(res);

  req.on("close", () => {
    featureClients.delete(res);
  });
});

router.get("/features", async (req, res) => {
  try {
    const features = await readAllFeatures();
    return res.json(features);
  } catch (error) {
    console.error("读取功能开关失败:", error);
    return res.status(500).json({
      error: "读取功能开关失败",
    });
  }
});

/* ============================================================
   PUT /api/admin/features（管理员）
============================================================ */

router.put(
  "/admin/features",
  authenticate,
  requireAdmin,
  async (req, res) => {
  const { aiTeacher } = req.body || {};

  if (typeof aiTeacher !== "boolean") {
    return res.status(400).json({
      error: "参数 aiTeacher 必须是布尔值",
    });
  }

  try {
    await setSetting("aiTeacher", String(aiTeacher));

    /* 实时推送变更给所有在线端 */

    broadcastFeatures();

    const features = await readAllFeatures();
    return res.json(features);
  } catch (error) {
    console.error("更新功能开关失败:", error);
    return res.status(500).json({
      error: "更新功能开关失败",
    });
  }
});

/* ============================================================
   免费额度设置（口语 / 新闻听力每日免费次数）
   - 存 settings 表（字符串），管理员在设置页可视化调整
   - 未设置或为空时，由消费方回退到环境变量 / 默认值
============================================================ */

const QUOTA_SETTING_KEYS = [
  "speakingFreeDaily",
  "newsListeningFreeDaily",
  "aiTeacherFreeDaily",
];

/* 读取单个额度设置：空值回退到 fallback，非法值回退到 fallback */
export async function getQuotaSetting(key, fallback) {
  let v = null;
  try {
    v = await getSetting(key);
  } catch (e) {
    return fallback;
  }
  if (v === null || v === undefined || String(v).trim() === "") {
    return fallback;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

async function readQuotaSettings() {
  const out = {};
  for (const key of QUOTA_SETTING_KEYS) {
    out[key] = await getSetting(key);
  }
  return out;
}

/* 校验并规范化单个值：非负整数；null / "" 表示清除（回退默认） */
function normalizeQuotaValue(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return null; // 非法
  }
  return String(n);
}

/* ============================================================
   GET /api/admin/settings（管理员）
   读取全部额度设置（未配置返回 null）
============================================================ */

router.get(
  "/admin/settings",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      return res.json(await readQuotaSettings());
    } catch (error) {
      console.error("读取额度设置失败:", error);
      return res.status(500).json({ error: "读取额度设置失败" });
    }
  }
);

/* ============================================================
   PUT /api/admin/settings（管理员）
   更新额度设置，例如 { "speakingFreeDaily": 15 }
   传 null / "" 可清除该设置（回退到环境变量 / 默认值）
============================================================ */

router.put(
  "/admin/settings",
  authenticate,
  requireAdmin,
  async (req, res) => {
    const patch = {};
    for (const key of QUOTA_SETTING_KEYS) {
      if (req.body && req.body[key] !== undefined) {
        const normalized = normalizeQuotaValue(req.body[key]);
        if (normalized === null) {
          return res.status(400).json({
            error: `参数 ${key} 必须是非负整数（或传空清除）`,
          });
        }
        patch[key] = normalized;
      }
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "没有可更新的设置" });
    }

    try {
      for (const [k, v] of Object.entries(patch)) {
        await setSetting(k, v);
      }
      return res.json(await readQuotaSettings());
    } catch (error) {
      console.error("更新额度设置失败:", error);
      return res.status(500).json({ error: "更新额度设置失败" });
    }
  }
);

export default router;
