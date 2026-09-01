
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import db from "./database.js";
import {
  startVipExpiryCheck,
} from "./vipExpiry.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import speakingRouter from "./routes/speaking.js";
import vocabularyRouter from "./routes/vocabulary.js";
import progressRouter from "./routes/progress.js";
import ttsRouter from "./routes/tts.js";
import featuresRouter from "./routes/features.js";
import notificationsRouter from "./routes/notifications.js";
import paymentsRouter from "./routes/payments.js";
import newsRouter from "./routes/news.js";
import aiTeacherRouter from "./routes/aiTeacher.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// ES Module 当前文件目录
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 上传目录
// ============================================================

const uploadsDir = path.join(
  __dirname,
  "uploads"
);

const avatarsDir = path.join(
  uploadsDir,
  "avatars"
);

// 本地示例视频目录（backend/videos，无墙可播）
const videosDir = path.join(
  __dirname,
  "videos"
);

// 本地字幕目录（backend/subtitles，中泰双语 VTT）
const subtitlesDir = path.join(
  __dirname,
  "subtitles"
);

console.log("================================");
console.log("Thai AI Teacher Backend");
console.log("================================");
console.log("Uploads directory:", uploadsDir);
console.log("Avatars directory:", avatarsDir);

// ============================================================
// 基础中间件
// ============================================================

// CORS：默认只放行本地开发源与同源（空 Origin 的同源请求）；
// 生产部署请用 CORS_ORIGINS 环境变量指定前端域名（逗号分隔）。
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];
const allowedOrigins = (
  process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // 无 Origin（同源/curl/健康检查）一律放行
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  })
);

// Stripe Webhook 需要原始 body 用于签名校验（必须在 express.json 之前）
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" })
);

// 易支付回调用表单 POST（部分网关也支持 GET），在 json 解析之前单独挂载
app.use(
  "/api/payments/notify",
  express.urlencoded({ extended: false })
);

// 微信支付官方回调用原始 body（验签需要原始串），同样在 json 解析之前
app.use(
  "/api/payments/wechat-notify",
  express.raw({ type: "*/*" })
);

app.use(express.json());

// ============================================================
// 安全中间件（helmet + 限流）
// ============================================================

// helmet：基础安全响应头。
// 生产环境前后端同域（nginx 反代），same-origin 即可；
// 但开发模式 TTS 音频跨端口（5174 → 3001）加载，
// 因此跨域资源策略统一放行，避免播放被拦。
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 生产环境位于 nginx 反代之后（nginx 设置 X-Forwarded-For），
// 需开启 trust proxy 让 express-rate-limit 正确识别客户端真实 IP，
// 否则抛 ERR_ERL_UNEXPECTED_X_FORWARDED_FOR 警告（限流退化为按反代 IP）。
app.set("trust proxy", 1);

// 认证/开通类接口的限流（防爆破），每个 IP 每 15 分钟：
// 登录/注册/重置 20 次；激活码开通 30 次。
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "操作过于频繁，请稍后再试" },
});

const vipActivateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "操作过于频繁，请稍后再试" },
});

app.use("/api/auth/login", strictLimiter);
app.use("/api/auth/register", strictLimiter);
app.use("/api/auth/forgot-password", strictLimiter);
app.use("/api/auth/reset-password", strictLimiter);
app.use("/api/auth/vip/activate", vipActivateLimiter);

// 全局限流（宽松）：防单 IP 打爆服务，但不影响正常学习/听力请求
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "请求过于频繁，请稍后再试" },
});
app.use("/api", globalLimiter);

// ============================================================
// 静态文件
// ============================================================

// /uploads/avatars/xxx.jpg
// ↓
// backend/uploads/avatars/xxx.jpg

app.use(
  "/uploads",
  express.static(uploadsDir)
);

// ============================================================
// 视频静态服务
// /videos/xxx.mp4 → backend/videos/xxx.mp4
// ============================================================

app.use(
  "/videos",
  express.static(videosDir)
);

// ============================================================
// 字幕静态服务
// /subtitles/xxx.vtt → backend/subtitles/xxx.vtt
// ============================================================

app.use(
  "/subtitles",
  express.static(subtitlesDir)
);

// ============================================================
// 头像专门测试
// ============================================================

app.get(
  "/api/test/uploads",
  (req, res) => {
    res.json({
      uploadsDir,
      avatarsDir,
      exists: true,
    });
  }
);

// ============================================================
// API 路由
// ============================================================

app.use(
  "/api/auth",
  authRouter
);
app.use(
  "/api/speaking",
  speakingRouter
);
app.use(
  "/api/vocabulary",
  vocabularyRouter
);
app.use(
  "/api/conversations",
  vocabularyRouter
);
app.use(
  "/api/progress",
  progressRouter
);
app.use(
  "/api/lesson-progress",
  progressRouter
);
app.use(
  "/api/admin",
  adminRouter
);
app.use(
  "/api",
  ttsRouter
);
app.use(
  "/api",
  featuresRouter
);
app.use(
  "/api/notifications",
  notificationsRouter
);
app.use(
  "/api/payments",
  paymentsRouter
);
app.use(
  "/api",
  newsRouter
);
app.use(
  "/api/ai",
  aiTeacherRouter
);
// ============================================================
// 首页
// ============================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "Thai AI Teacher API Running",
      port: PORT,
    });
  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    console.log(
      "404:",
      req.method,
      req.originalUrl
    );

    res.status(404).json({
      message:
        "API endpoint not found",
      path:
        req.originalUrl,
    });
  }
);

// ============================================================
// 全局错误
// ============================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Server error:",
      err
    );

    res.status(500).json({
      message:
        "服务器内部错误",
    });
  }
);

// ============================================================
// 启动服务器
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      "================================"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `API: http://localhost:${PORT}/api`
    );

    console.log(
      `Uploads: http://localhost:${PORT}/uploads`
    );

    console.log(
      `Avatar test: http://localhost:${PORT}/api/test/uploads`
    );

    console.log(
      "================================"
    );

    // VIP 过期自动失效：启动时立即检查一次，之后定时检查
    startVipExpiryCheck(db);
  }
);
