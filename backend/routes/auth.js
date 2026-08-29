import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

import db from "../database.js";
import { extendVipDays } from "../vipService.js";

const router = express.Router();

// JWT 签名密钥：生产环境必须显式配置，否则拒绝启动（避免使用公开默认值）。
// 本地开发可用内置默认值。
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "thai_ai_teacher_2026";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.JWT_SECRET
) {
  console.error(
    "[启动失败] 生产环境必须设置 JWT_SECRET 环境变量（用于签名登录令牌）。"
  );
  process.exit(1);
}

// 判断某行是否管理员（role=admin 或邮箱在 ADMIN_EMAILS 中）
// 注意：ES Module 导入先于 dotenv.config() 执行，
// 所以 ADMIN_EMAILS 必须惰性读取（生产容器直接注入 env，两种方式都兼容）
export function isAdminRow(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user.email || "").toLowerCase();
  return adminEmails.includes(email);
}

// 实时判断 VIP 是否仍有效：
// is_vip=1 且未过期才返回 true；
// 即使定时任务还没来得及清理，过期用户的 isVip 也会立即变为 false
function isVipActive(user) {
  if (!user || !user.is_vip) return false;

  if (!user.vip_expires_at) return false;

  const expiry = new Date(
    String(user.vip_expires_at).replace(" ", "T") + "Z"
  );

  if (Number.isNaN(expiry.getTime())) return false;

  return expiry.getTime() > Date.now();
}

// ============================================================
// 头像目录固定在 backend/uploads/avatars
// （与 app.js 的静态目录一致，与启动目录无关）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const avatarDir = path.join(
  __dirname,
  "..",
  "uploads",
  "avatars"
);

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, {
    recursive: true,
  });
}

export function authenticate(req, res, next) {
  const authHeader =
    req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "未登录",
    });
  }

  const token =
    authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.userId = decoded.id;

    next();
  } catch {
    return res.status(401).json({
      message: "登录已过期，请重新登录",
    });
  }
}

const storage =
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarDir);
    },

    filename: (req, file, cb) => {
      const ext =
        path
          .extname(file.originalname)
          .toLowerCase();

      cb(
        null,
        `avatar-${req.userId}-${Date.now()}${ext}`
      );
    },
  });

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (
      allowedTypes.includes(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "只允许上传 JPG、PNG、WEBP 或 GIF 图片"
        )
      );
    }
  },
});

router.post(
  "/register",
  async (req, res) => {
    const {
      email,
      phone,
      password,
      nickname,
    } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        message:
          "请输入邮箱或手机号",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "请输入密码",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "密码至少需要6位",
      });
    }

    try {
      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      db.run(
        `
        INSERT INTO users
        (
          email,
          phone,
          password,
          nickname,
          avatar
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          email || null,
          phone || null,
          passwordHash,
          nickname || "学生",
          null,
        ],
        function (err) {
          if (err) {
            console.error(
              "Register error:",
              err
            );

            return res.status(400).json({
              message:
                "邮箱或手机号已经注册",
            });
          }

          const user = {
            id: this.lastID,
            email:
              email || null,
            phone:
              phone || null,
            nickname:
              nickname || "学生",
            avatar: null,
            role:
              email &&
              (process.env.ADMIN_EMAILS || "")
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
                .includes(String(email).toLowerCase())
                ? "admin"
                : "user",
            isVip: false,
          };

          // 管理员首次注册时同步到数据库 role
          if (user.role === "admin") {
            db.run(
              "UPDATE users SET role = 'admin' WHERE id = ?",
              [user.id],
              () => {}
            );
          }

          const token =
            jwt.sign(
              {
                id: user.id,
              },
              JWT_SECRET,
              {
                expiresIn: "30d",
              }
            );

          res.status(201).json({
            token,
            user,
          });
        }
      );
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      res.status(500).json({
        message: "注册失败",
      });
    }
  }
);

router.post(
  "/login",
  async (req, res) => {
    const {
      email,
      phone,
      password,
    } = req.body;

    if (
      (!email && !phone) ||
      !password
    ) {
      return res.status(400).json({
        message:
          "请输入账号和密码",
      });
    }

    db.get(
      `
      SELECT *
      FROM users
      WHERE email = ?
         OR phone = ?
      LIMIT 1
      `,
      [
        email || "",
        phone || "",
      ],
      async (err, user) => {
        if (err) {
          console.error(
            "Login database error:",
            err
          );

          return res.status(500).json({
            message:
              "数据库错误",
          });
        }

        if (!user) {
          return res.status(401).json({
            message:
              "账号不存在",
          });
        }

        try {
          const valid =
            await bcrypt.compare(
              password,
              user.password
            );

          if (!valid) {
            return res.status(401).json({
              message:
                "密码错误",
            });
          }

          const token =
            jwt.sign(
              {
                id: user.id,
              },
              JWT_SECRET,
              {
                expiresIn: "30d",
              }
            );

          res.json({
            token,
            user: {
              id: user.id,
              email:
                user.email,
              phone:
                user.phone,
              nickname:
                user.nickname,
              avatar:
                user.avatar || null,
              role:
                isAdminRow(user)
                  ? "admin"
                  : (user.role || "user"),
              isVip: isVipActive(user),
              vipExpiresAt:
                user.vip_expires_at || null,
            },
          });
        } catch (error) {
          console.error(
            "Login error:",
            error
          );

          res.status(500).json({
            message:
              "登录失败",
          });
        }
      }
    );
  }
);

router.get(
  "/me",
  authenticate,
  (req, res) => {
    db.get(
      `
      SELECT
        id,
        email,
        phone,
        nickname,
        avatar,
        role,
        is_vip,
        vip_expires_at,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [req.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({
            message:
              "数据库错误",
          });
        }

        if (!user) {
          return res.status(404).json({
            message:
              "用户不存在",
          });
        }

        res.json({
          user: {
            id: user.id,
            email:
              user.email,
            phone:
              user.phone,
            nickname:
              user.nickname,
            avatar:
              user.avatar || null,
            role:
              isAdminRow(user)
                ? "admin"
                : (user.role || "user"),
            isVip: isVipActive(user),
            vipExpiresAt:
              user.vip_expires_at || null,
            created_at:
              user.created_at,
          },
        });
      }
    );
  }
);

/* ============================================================
   激活 VIP：校验激活码并开通会员
============================================================ */

router.post(
  "/vip/activate",
  authenticate,
  (req, res) => {
    const { code } = req.body || {};

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        message: "请输入激活码",
      });
    }

    const cleanCode = String(code).trim();

    db.get(
      `
      SELECT id, code, duration_days, used_by, used_at
      FROM vip_codes
      WHERE code = ?
      LIMIT 1
      `,
      [cleanCode],
      (err, row) => {
        if (err) {
          console.error(
            "VIP code lookup error:",
            err
          );

          return res.status(500).json({
            message: "数据库错误",
          });
        }

        if (!row) {
          return res.status(400).json({
            message: "激活码无效",
          });
        }

        if (row.used_by) {
          return res.status(400).json({
            message: "激活码已被使用",
          });
        }

        // 复用共享服务：叠加到期时间 + 写库 + 写通知（与在线支付同逻辑）
        extendVipDays(db, req.userId, row.duration_days, "code")
          .then(({ expiresAtStr }) => {
            // 标记激活码已使用
            db.run(
              `
              UPDATE vip_codes
              SET used_by = ?,
                  used_at = ?
              WHERE id = ?
              `,
              [
                req.userId,
                new Date().toISOString().slice(0, 19).replace("T", " "),
                row.id,
              ],
              () => {
                res.json({
                  message: "VIP 开通成功",
                  user: {
                    id: req.userId,
                    isVip: true,
                    vipExpiresAt: expiresAtStr,
                  },
                });
              }
            );
          })
          .catch((err) => {
            console.error("开通 VIP 失败:", err);
            res.status(500).json({ message: "开通 VIP 失败" });
          });
      }
    );
  }
);

router.put(
  "/profile",
  authenticate,
  (req, res) => {
    const {
      nickname,
      avatar,
    } = req.body;

    if (
      nickname === undefined &&
      avatar === undefined
    ) {
      return res.status(400).json({
        message:
          "没有需要修改的信息",
      });
    }

    db.get(
      `
      SELECT nickname, avatar
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [req.userId],
      (err, oldUser) => {
        if (err) {
          return res.status(500).json({
            message:
              "数据库错误",
          });
        }

        if (!oldUser) {
          return res.status(404).json({
            message:
              "用户不存在",
          });
        }

        const finalNickname =
          nickname !== undefined
            ? nickname
            : oldUser.nickname;

        const finalAvatar =
          avatar !== undefined
            ? avatar
            : oldUser.avatar;

        db.run(
          `
          UPDATE users
          SET nickname = ?,
              avatar = ?
          WHERE id = ?
          `,
          [
            finalNickname,
            finalAvatar,
            req.userId,
          ],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({
                message:
                  "修改资料失败",
              });
            }

            res.json({
              message:
                "个人资料修改成功",

              user: {
                id: req.userId,
                nickname:
                  finalNickname,
                avatar:
                  finalAvatar,
              },
            });
          }
        );
      }
    );
  }
);

router.post(
  "/avatar",
  authenticate,
  upload.single("avatar"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message:
          "请选择头像图片",
      });
    }

    const serverUrl =
      `${req.protocol}://${req.get(
        "host"
      )}`;

    const avatarUrl =
      `${serverUrl}/uploads/avatars/${req.file.filename}`;

    db.get(
      `
      SELECT avatar
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [req.userId],
      (selectErr, oldUser) => {
        if (selectErr) {
          fs.unlink(
            req.file.path,
            () => {}
          );

          return res.status(500).json({
            message:
              "数据库错误",
          });
        }

        if (
          oldUser?.avatar &&
          oldUser.avatar.includes(
            "/uploads/avatars/"
          )
        ) {
          try {
            const oldUrl =
              new URL(
                oldUser.avatar
              );

            const oldFilename =
              path.basename(
                oldUrl.pathname
              );

            const oldPath =
              path.join(
                avatarDir,
                oldFilename
              );

            if (
              fs.existsSync(
                oldPath
              )
            ) {
              fs.unlinkSync(
                oldPath
              );
            }
          } catch (error) {
            console.error(
              "删除旧头像失败:",
              error
            );
          }
        }

        db.run(
          `
          UPDATE users
          SET avatar = ?
          WHERE id = ?
          `,
          [
            avatarUrl,
            req.userId,
          ],
          (updateErr) => {
            if (updateErr) {
              fs.unlink(
                req.file.path,
                () => {}
              );

              return res.status(500).json({
                message:
                  "保存头像失败",
              });
            }

            res.json({
              message:
                "头像上传成功",
              avatar:
                avatarUrl,
            });
          }
        );
      }
    );
  }
);

router.post(
  "/logout",
  authenticate,
  (req, res) => {
    res.json({
      message: "退出成功",
    });
  }
);

/* ============================================================
   忘记密码：生成一次性重置令牌
============================================================ */

router.post(
  "/forgot-password",
  async (req, res) => {
    const { email, phone } = req.body;

    // 无论账号是否存在都返回同样的提示，避免泄露注册信息
    if (!email && !phone) {
      return res.status(400).json({
        message: "请输入邮箱或手机号",
      });
    }

    const findUser = () =>
      new Promise((resolve, reject) => {
        db.get(
          `
          SELECT id, email, phone
          FROM users
          WHERE email = ?
             OR phone = ?
          LIMIT 1
          `,
          [email || "", phone || ""],
          (err, user) =>
            err ? reject(err) : resolve(user)
        );
      });

    try {
      const user = await findUser();

      if (!user) {
        return res.json({
          message: "如果该账号存在，重置链接已发送",
        });
      }

      const token = crypto
        .randomBytes(32)
        .toString("hex");

      const expiresAt = new Date(
        Date.now() + 30 * 60 * 1000
      )
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      await new Promise((resolve, reject) => {
        db.run(
          `
          INSERT INTO password_resets
          (user_id, token, expires_at)
          VALUES (?, ?, ?)
          `,
          [user.id, token, expiresAt],
          (err) =>
            err ? reject(err) : resolve()
        );
      });

      /*
       * 本地开发：没有邮件服务时，把重置链接打印到控制台，
       * 并在响应里返回（方便直接点开）。
       * 生产环境（NODE_ENV=production）不返回链接。
       */

      const baseUrl =
        process.env
          .RESET_PASSWORD_BASE_URL ||
        "http://localhost:5173";

      const resetUrl =
        `${baseUrl}/reset-password?token=${token}`;

      console.log("================================");
      console.log("Password reset link:");
      console.log(resetUrl);
      console.log("================================");

      const expose =
        process.env.NODE_ENV !== "production";

      res.json({
        message: "如果该账号存在，重置链接已发送",
        ...(expose
          ? { reset_url: resetUrl }
          : {}),
      });
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      res.status(500).json({
        message: "发送重置链接失败",
      });
    }
  }
);

/* ============================================================
   重置密码：校验令牌并更新密码
============================================================ */

router.post(
  "/reset-password",
  async (req, res) => {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({
        message: "重置链接无效",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "密码至少需要6位",
      });
    }

    try {
      const resetRow = await new Promise(
        (resolve, reject) => {
          db.get(
            `
            SELECT pr.user_id, pr.expires_at
            FROM password_resets pr
            WHERE pr.token = ?
            LIMIT 1
            `,
            [token],
            (err, row) =>
              err ? reject(err) : resolve(row)
          );
        }
      );

      if (!resetRow) {
        return res.status(400).json({
          message: "重置链接无效或已使用",
        });
      }

      const expiresAt = new Date(
        resetRow.expires_at.replace(" ", "T") + "Z"
      );

      if (expiresAt.getTime() < Date.now()) {
        // 过期令牌删除，避免堆积
        await new Promise((resolve) => {
          db.run(
            "DELETE FROM password_resets WHERE token = ?",
            [token],
            () => resolve()
          );
        });

        return res.status(400).json({
          message: "重置链接已过期，请重新申请",
        });
      }

      const passwordHash = await bcrypt.hash(
        password,
        10
      );

      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE users SET password = ? WHERE id = ?",
          [passwordHash, resetRow.user_id],
          (err) =>
            err ? reject(err) : resolve()
        );
      });

      // 一次性使用：无论成败都删除令牌
      await new Promise((resolve) => {
        db.run(
          "DELETE FROM password_resets WHERE token = ?",
          [token],
          () => resolve()
        );
      });

      res.json({
        message: "密码重置成功",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      res.status(500).json({
        message: "重置密码失败",
      });
    }
  }
);

export default router;