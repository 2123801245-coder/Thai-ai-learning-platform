import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ============================================================
// 内置学习内容（单一数据源）
//
// 直接 import 前端数据文件，保证前后端始终使用同一份数据，
// 后端启动时把它们同步进数据库，前端也可以继续用本地 fallback。
// ============================================================

import { localVocabulary } from "../src/data/vocabulary.js";
import { expandedVocabulary } from "../src/data/vocabularyExpansion.js";
import { conversationScenes } from "../src/data/conversations.js";

// ============================================================
// 数据库文件固定放在 backend/users.db
// （无论从哪个目录启动，都使用同一份数据）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径：默认 backend/users.db；
// 生产容器可用 DB_PATH 环境变量指向持久化卷（如 /data/users.db）。
const db = new sqlite3.Database(
  process.env.DB_PATH || path.join(__dirname, "users.db")
);

db.serialize(() => {
  // ================================
  // 创建 users 表
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      email TEXT UNIQUE,

      phone TEXT UNIQUE,

      password TEXT NOT NULL,

      nickname TEXT,

      avatar TEXT,

      role TEXT DEFAULT 'user',

      is_vip INTEGER DEFAULT 0,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 兼容旧数据库
  // 如果旧 users 表没有 avatar
  // 自动添加 avatar 字段
  // ================================

  db.run(
    `
      ALTER TABLE users
      ADD COLUMN avatar TEXT
    `,
    (err) => {
      if (err) {
        // 已经存在 avatar 时，SQLite 会报这个错误
        if (!err.message.includes("duplicate column name")) {
          console.error(
            "添加 avatar 字段失败:",
            err.message
          );
        }
      } else {
        console.log("avatar 字段已添加");
      }
    }
  );

  // ================================
  // 兼容旧数据库
  // 如果旧 users 表没有 is_vip
  // 自动添加 is_vip 字段（VIP 状态）
  // ================================

  db.run(
    `
      ALTER TABLE users
      ADD COLUMN is_vip INTEGER DEFAULT 0
    `,
    (err) => {
      if (err) {
        // 已经存在 is_vip 时，SQLite 会报这个错误
        if (!err.message.includes("duplicate column name")) {
          console.error(
            "添加 is_vip 字段失败:",
            err.message
          );
        }
      } else {
        console.log("is_vip 字段已添加");
      }
    }
  );

  // ================================
  // 兼容旧数据库
  // 如果旧 users 表没有 vip_expires_at
  // 自动添加 vip_expires_at 字段（VIP 到期时间）
  // ================================

  db.run(
    `
      ALTER TABLE users
      ADD COLUMN vip_expires_at TEXT
    `,
    (err) => {
      if (err) {
        if (!err.message.includes("duplicate column name")) {
          console.error(
            "添加 vip_expires_at 字段失败:",
            err.message
          );
        }
      } else {
        console.log("vip_expires_at 字段已添加");
      }
    }
  );

  // ================================
  // VIP 激活码表
  //（code 唯一；used_by 记录使用者；duration_days 为开通天数）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS vip_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 30,
      used_by INTEGER,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 人工收款对账台账
  // 一条记录对应一次人工收款，可关联激活码和实际使用者
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS sales_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_contact TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      plan_days INTEGER NOT NULL DEFAULT 30,
      vip_code_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vip_code_id) REFERENCES vip_codes (id)
    )
  `);

  // ================================
  // 支付订单表（易支付聚合 / Stripe）
  // status: pending / paid / refunded / failed / closed
  // order_no: 我方订单号（out_trade_no，网关回调幂等键）
  // channel: 支付渠道（wechat / alipay / card）
  // trade_no: 网关侧交易号（易支付 trade_no / Stripe payment_intent）
  // provider: epay / stripe
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'cny',
      plan_days INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      order_no TEXT,
      channel TEXT,
      trade_no TEXT,
      provider TEXT,
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      source TEXT DEFAULT 'stripe',
      first_purchase INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at)"
  );

  // 老库迁移：补 order_no / channel / trade_no / provider / qrcode_url 列
  //（sqlite 无 IF NOT EXISTS 的 ADD COLUMN，逐个 try 忽略重复）
  // 必须先于索引创建执行——旧库缺列时，索引会因列不存在而失败
  for (const col of [
    "first_purchase INTEGER DEFAULT 0",
    "order_no TEXT",
    "channel TEXT",
    "trade_no TEXT",
    "provider TEXT",
    "qrcode_url TEXT",
  ]) {
    db.run(`ALTER TABLE payments ADD COLUMN ${col}`, (err) => {
      // 已存在则报 duplicate column，忽略即可
    });
  }

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_no)",
    (err) => {
      if (err) {
        console.warn("创建支付订单索引失败:", err.message);
      }
    }
  );

  // 首充优惠并发保护：同一用户同时只能存在一个有效首充订单。
  // 已关闭/已取消的订单不占用资格，允许用户重新发起首充。
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_first_purchase_active
     ON payments (user_id)
     WHERE first_purchase = 1
       AND status IN ('pending', 'processing', 'paid')`,
    (err) => {
      if (err) {
        console.warn("创建首充订单唯一索引失败:", err.message);
      }
    }
  );

  // ================================
  // 每日新闻缓存表（真实语料库 · ThaiPBS 时事）
  // key 为抓取日期（YYYY-MM-DD），value 为 JSON 数组；
  // 前端 / 后端都从这里读，避免每次请求都去请求 ThaiPBS。
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS news_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 新闻整篇阅读缓存表
  //（按需抓取 ThaiPBS 文章正文，同一篇只抓取一次；
  //  value 存 JSON：{title, summary, paragraphs[], zh[], roman[], url, date}）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 新闻听力练习记录表
  //（每日新闻听力：每天练习的新闻数 / 填空正确率 / 跟读平均分）
  // 每次练习写一行：date 为泰国时区日期（YYYY-MM-DD），
  // cloze_correct / cloze_total 记录填空成绩，repeat_avg 记录当次跟读均分。
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS news_listening_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      news_id TEXT,
      news_title TEXT,
      cloze_correct INTEGER DEFAULT 0,
      cloze_total INTEGER DEFAULT 0,
      repeat_avg REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_news_listening_user_date ON news_listening_records (user_id, date)"
  );

  // ================================
  // 词汇测验记录表
  //（词汇练习：错题本 / 生词本 / 词书测验，每次完成一轮写一行）
  // date 为泰国时区日期（YYYY-MM-DD），quiz_type 为题型，
  // difficulty 为难度，source 标记来源（book 词书 / wrong 错题本），
  // correct / total 记录本轮成绩。
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS vocab_quiz_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      quiz_type TEXT,
      difficulty TEXT,
      source TEXT DEFAULT 'book',
      correct INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_vocab_quiz_user_date ON vocab_quiz_records (user_id, date)"
  );

  // ================================
  // 新闻听力每日练习用量表
  //（听音填空：免费用户每天限 N 题，超出需 VIP；与口语配额一致）
  // 日期格式 YYYY-MM-DD（泰国时区 GMT+7）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS news_listening_usage (
      user_id INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      question_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);

  // ================================
  // 创建 password_resets 表
  // 用于“忘记密码”的重置令牌
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      user_id INTEGER NOT NULL,

      token TEXT NOT NULL,

      expires_at DATETIME NOT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token)"
  );

  // ================================
  // 功能开关表（settings）
  // 管理员在设置页可动态开关（如 AI 老师）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 内置词汇表（数据来自 src/data/vocabulary.js）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY,
      thai_word TEXT NOT NULL,
      pronunciation TEXT,
      chinese_meaning TEXT,
      part_of_speech TEXT,
      example_thai TEXT,
      example_chinese TEXT,
      category TEXT,
      difficulty TEXT,
      book TEXT
    )
  `);

  db.run("ALTER TABLE vocabulary ADD COLUMN book TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) console.warn("添加词书字段失败:", err.message);
  });

  // ================================
  // 对话场景表（数据来自 src/data/conversations.js）
  // 整段脚本（greeting / dialogues / fallback）存为 JSON
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_scenes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      data TEXT NOT NULL
    )
  `);

  // ================================
  // 口语练习每日用量表
  //（单词模式免费额度：每天每用户 N 次，超出需 VIP）
  // 日期格式 YYYY-MM-DD（泰国时区 GMT+7）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS speaking_usage (
      user_id INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);

  // ================================
  // AI 泰语老师对话配额表
  //（免费用户每日限 N 次对话，VIP 无限；按泰国时区日期归档）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_teacher_usage (
      user_id INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);

  // ================================
  // AI 泰语老师长期记忆表
  //（记住学生名字/水平/兴趣/常见错误，跨会话生效）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_teacher_memory (
      user_id INTEGER PRIMARY KEY,
      memory TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 用户消息通知表
  //（真实消息中心：VIP 到期 / 激活、学习事件等）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT DEFAULT '系统消息',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      icon TEXT DEFAULT '📢',
      action TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ================================
  // 用户词汇学习进度表
  //（认识 / 不认识 / 收藏 / 已掌握）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS vocabulary_progress (
      user_id INTEGER NOT NULL,
      word_id TEXT NOT NULL,
      status TEXT,
      favorite INTEGER DEFAULT 0,
      mastered INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, word_id)
    )
  `);

  // ================================
  // 用户课程 / 视频学习进度表
  //（每节视频一行：播放百分比 / 是否完成 / 上次播放位置）
  // ================================

  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id INTEGER NOT NULL,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      last_position REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, course_id, lesson_id)
    )
  `);

  // ================================
  // 启动时把内置内容同步进数据库
  //（幂等：按 id 覆盖更新，重复启动不会产生脏数据）
  // ================================

  let vocabSynced = 0;
  let sceneSynced = 0;

  const vocabStmt = db.prepare(`
    INSERT INTO vocabulary (
      id, thai_word, pronunciation, chinese_meaning,
      part_of_speech, example_thai, example_chinese,
      category, difficulty, book
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      thai_word = excluded.thai_word,
      pronunciation = excluded.pronunciation,
      chinese_meaning = excluded.chinese_meaning,
      part_of_speech = excluded.part_of_speech,
      example_thai = excluded.example_thai,
      example_chinese = excluded.example_chinese,
      category = excluded.category,
      difficulty = excluded.difficulty,
      book = excluded.book
  `);

  const sceneStmt = db.prepare(`
    INSERT INTO conversation_scenes (id, title, description, icon, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      icon = excluded.icon,
      data = excluded.data
  `);

  db.serialize(() => {
    for (const w of [...localVocabulary, ...expandedVocabulary]) {
      vocabStmt.run(
        w.id,
        w.thai_word,
        w.pronunciation ?? null,
        w.chinese_meaning ?? null,
        w.part_of_speech ?? null,
        w.example_thai ?? null,
        w.example_chinese ?? null,
        w.category ?? null,
        w.difficulty ?? null,
        w.book ?? (w.category === "基础泰语1" ? "基础泰语1" : null),
        (err) => {
          if (!err) vocabSynced++;
        }
      );
    }

    for (const s of conversationScenes) {
      sceneStmt.run(
        s.id,
        s.title,
        s.description ?? null,
        s.icon ?? null,
        JSON.stringify(s),
        (err) => {
          if (!err) sceneSynced++;
        }
      );
    }
  });

  vocabStmt.finalize(() => {
    console.log(
      `内置词库已同步：${vocabSynced} 个单词`
    );
  });

  sceneStmt.finalize(() => {
    console.log(
      `对话场景已同步：${sceneSynced} 个场景`
    );
  });

  // ================================
  // 演示激活码
  //
  // 没有真实支付系统时，用激活码开通 VIP：
  //  - 从环境变量 VIP_CODES 读取自定义激活码
  //    （逗号分隔，格式：CODE:天数，如 ABC123:30）
  //  - 未配置时生成 3 个演示码（THAI-VIP-XXXX），
  //    每个 30 天，打印到控制台方便测试
  // 幂等：已存在的码不重复插入
  // ================================

  const demoCodes = [];
  const envCodes =
    (process.env.VIP_CODES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  if (envCodes.length > 0) {
    for (const item of envCodes) {
      const [code, daysStr] = item.split(":");
      const codeClean = (code || "").trim();
      const days = Number(daysStr) || 30;
      if (codeClean) demoCodes.push({ code: codeClean, days });
    }
  } else {
    for (let i = 1; i <= 3; i++) {
      const suffix = String(1000 + Math.floor(Math.random() * 9000));
      demoCodes.push({ code: `THAI-VIP-${suffix}`, days: 30 });
    }
  }

  const vipCodeStmt = db.prepare(`
    INSERT OR IGNORE INTO vip_codes (code, duration_days)
    VALUES (?, ?)
  `);

  for (const c of demoCodes) {
    vipCodeStmt.run(c.code, c.days);
  }

  vipCodeStmt.finalize(() => {
    console.log(
      "演示 VIP 激活码（30 天）：",
      demoCodes.map((c) => c.code).join(", ")
    );
    console.log(
      "在「我的 → VIP 会员」或课程锁定页输入激活码即可开通。"
    );
  });
});

export default db;
