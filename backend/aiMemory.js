// backend/aiMemory.js
//
// ============================================================
// AI 泰语老师 · 分类长期记忆（AI Teacher Memory）
// ============================================================
//
// 升级前：`ai_teacher_memory` 是一行一个用户的 JSON blob
//   (user_id PK, memory TEXT, updated_at)
// 里面固定七个键（studentName / genderHint / level / interests /
// goals / mistakes / preferences）。问题：
//   - 只能整块覆盖，「重要度」无处可放，AI 无法区分「准备交换」和
//     「爱吃冬阴功」哪个更该记住；
//   - 无法按类型查询/展示/删除单条；
//   - 两条记忆重复时只能靠字符串去重，容易越滚越长。
//
// 升级后：**一条记忆一行**，按类型分类，带重要度：
//
//   ai_teacher_memory(
//     id, user_id, memory_type, content, importance,
//     source, hits, created_at, updated_at
//   )
//
//   memory_type: profile | goal | habit | weakness | error | interest | preference
//   importance:  1~5（5 最重要），决定注入提示词的顺序与取舍
//   source:      ai（对话中自动提取）/ placement（入学测试）/ manual（用户手改）
//   hits:        同一句话说中几次（重复出现 → 重要度与排序自动上浮）
//
// 旧表不会被丢掉：首次启动时改名为 ai_teacher_memory_legacy 备份，
// 并把里面的 JSON blob 解析成分类条目导入一次（见 migrateLegacyTable），
// 导入成功后备份表收尾改名为 ai_teacher_memory_legacy_imported。
// 迁移是幂等且可重试的：中途崩溃（备份表还在）下次启动会接着导完。
//
// 记忆的三个来源（对应产品目标「AI 下次对话自动知道」）：
//   1. 入学测试画像 → syncPlacementMemory()  确定性、无需模型调用
//   2. 对话内容     → applyMemoryExtract()   每 5 轮由 DeepSeek 提取
//   3. 用户手动     → upsertMemoryItem()     个人中心里直接告诉老师
//
// 本模块只依赖数据库，不调用模型，方便单测与复用。
// ============================================================

import db from "./database.js";

/* ============================================================
   记忆类型
============================================================ */

export const MEMORY_TYPES = {
  profile: {
    label: "身份档案",
    emoji: "🪪",
    order: 0,
    defaultImportance: 5,
    promptLabel: "身份",
  },
  goal: {
    label: "学习目标",
    emoji: "🎯",
    order: 1,
    defaultImportance: 4,
    promptLabel: "目标",
  },
  interest: {
    label: "兴趣内容",
    emoji: "🎬",
    order: 2,
    defaultImportance: 3,
    promptLabel: "兴趣",
  },
  weakness: {
    label: "薄弱点",
    emoji: "⚠️",
    order: 3,
    defaultImportance: 4,
    promptLabel: "薄弱点",
  },
  error: {
    label: "错误记录",
    emoji: "❌",
    order: 4,
    defaultImportance: 3,
    promptLabel: "反复出现的错误",
  },
  habit: {
    label: "学习习惯",
    emoji: "🕘",
    order: 5,
    defaultImportance: 3,
    promptLabel: "学习习惯",
  },
  preference: {
    label: "表达偏好",
    emoji: "💬",
    order: 6,
    defaultImportance: 2,
    promptLabel: "偏好",
  },
};

export const MEMORY_TYPE_IDS = Object.keys(MEMORY_TYPES);

/**
 * 用户亲手写下的记忆的默认重要度。
 * 比 AI 自动提取的默认值高一档：学生亲口说的事比模型推测更可信。
 * 路由层新增条目、旧表单保存都取这张表。
 */
export const MANUAL_IMPORTANCE = {
  profile: 5,
  goal: 5,
  weakness: 4,
  error: 4,
  interest: 3,
  habit: 3,
  preference: 3,
};

/** 单类型最多保留多少条（超出按重要度/命中次数淘汰） */
const MAX_ITEMS_PER_TYPE = 15;
/** 注入提示词的最多条数（按重要度排序后截断） */
const MAX_PROMPT_ITEMS = 16;
/** 单条记忆注入时的最大字数 */
const MAX_PROMPT_ITEM_CHARS = 70;

const isType = (type) => MEMORY_TYPE_IDS.includes(type);

export const memoryTypeMeta = (type) =>
  MEMORY_TYPES[type] || {
    label: "记忆",
    emoji: "📌",
    order: 99,
    defaultImportance: 3,
    promptLabel: "记忆",
  };

/* ============================================================
   sqlite 回调 → Promise（与项目其他模块一致的访问风格）
============================================================ */

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

/* ============================================================
   表结构 + 迁移
============================================================ */

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ai_teacher_memory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    memory_type  TEXT NOT NULL,
    content      TEXT NOT NULL,
    importance   INTEGER DEFAULT 3,
    source       TEXT DEFAULT 'ai',
    hits         INTEGER DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

let initPromise = null;
/** init() 执行期间为 true：迁移旧数据会经由 upsertMemoryItem 再调本函数 */
let initInProgress = false;

/** 幂等初始化（服务器启动 / 首次调用时执行一次） */
export function ensureMemorySchema() {
  // ⚠️ 必须放行重入：init() 里的旧数据迁移会调用 upsertMemoryItem →
  // 再调本函数。若此时 await 自己所在的 promise，就成了自等待死锁，
  // 顶层 await 永不 settle（表现为进程静默退出、迁移只做了一半）。
  // 走到这里说明表结构已经建好，直接返回即可。
  if (initInProgress) return Promise.resolve();

  if (!initPromise) {
    initInProgress = true;
    initPromise = init()
      .catch((err) => {
        // 失败后允许下次重试，避免一次异常把记忆功能永久锁死
        initPromise = null;
        console.error("[aiMemory] 初始化失败:", err?.message || err);
      })
      .finally(() => {
        initInProgress = false;
      });
  }
  return initPromise;
}

async function tableExists(name) {
  const row = await get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name]
  );
  return Boolean(row);
}

async function columnNames(table) {
  if (!(await tableExists(table))) return [];
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

async function init() {
  const columns = await columnNames("ai_teacher_memory");
  const isLegacyShape = columns.includes("memory");

  if (isLegacyShape) {
    const backupExists = await tableExists("ai_teacher_memory_legacy");
    if (backupExists) {
      // 备份表已存在（重复启动的极端情况）：把旧表剩余行并进备份再删掉旧表
      await run(`
        INSERT INTO ai_teacher_memory_legacy (user_id, memory, updated_at)
        SELECT user_id, memory, updated_at FROM ai_teacher_memory
        WHERE user_id NOT IN (SELECT user_id FROM ai_teacher_memory_legacy)
      `).catch(() => {});
      await run("DROP TABLE ai_teacher_memory").catch(() => {});
    } else {
      await run("ALTER TABLE ai_teacher_memory RENAME TO ai_teacher_memory_legacy");
    }
  }

  await run(CREATE_TABLE_SQL);
  await run(
    "CREATE INDEX IF NOT EXISTS idx_ai_memory_user_type ON ai_teacher_memory (user_id, memory_type)"
  );
  // 同一用户同一类型的同一句话只存一条（重复出现 → 命中次数 +1）
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_memory_item
    ON ai_teacher_memory (user_id, memory_type, content)
  `);

  // 刚刚改名要迁；上次启动迁到一半就挂了（备份表还在）也要迁。
  // upsert 幂等 + 唯一索引去重，所以重试是安全的。
  if (isLegacyShape || (await tableExists("ai_teacher_memory_legacy"))) {
    await migrateLegacyTable();
  }
}

/** 把旧的 JSON blob 拆成分类条目导入（幂等，可重试） */
async function migrateLegacyTable() {
  if (!(await tableExists("ai_teacher_memory_legacy"))) return;

  const rows = await all(
    "SELECT user_id, memory FROM ai_teacher_memory_legacy"
  );

  let imported = 0;
  for (const row of rows || []) {
    let parsed = null;
    try {
      parsed = JSON.parse(row.memory || "{}");
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object") continue;

    const count = await applyMemoryExtract(row.user_id, parsed, {
      source: "legacy",
      silent: true,
    });
    imported += count;
  }

  // 收尾标记：备份表改名为 *_imported，这样下次启动不会把用户后来删掉的
  // 记忆又灌回来，同时原始 blob 仍然留着可查。改名失败也不影响主流程。
  if (await tableExists("ai_teacher_memory_legacy_imported")) {
    await run("DELETE FROM ai_teacher_memory_legacy").catch(() => {});
  } else {
    await run(
      "ALTER TABLE ai_teacher_memory_legacy RENAME TO ai_teacher_memory_legacy_imported"
    ).catch(() => {});
  }

  console.log(
    `[aiMemory] 旧记忆迁移完成：${rows.length} 位用户 / ${imported} 条分类记忆（旧表备份为 ai_teacher_memory_legacy_imported）`
  );
}

/* ============================================================
   读写
============================================================ */

const normalizeContent = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[-•·，,、。\s]+/, "")
    .trim()
    .slice(0, 200);

const clampImportance = (value, fallback = 3) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n)));
};

const mapRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  type: row.memory_type,
  content: row.content,
  importance: Number(row.importance || 3),
  source: row.source || "ai",
  hits: Number(row.hits || 1),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** 全部记忆条目（按重要度 → 命中次数 → 更新时间排序） */
export async function listMemoryItems(userId) {
  await ensureMemorySchema();
  if (!userId) return [];
  const rows = await all(
    `SELECT * FROM ai_teacher_memory
     WHERE user_id = ?
     ORDER BY importance DESC, hits DESC, datetime(updated_at) DESC, id DESC`,
    [userId]
  );
  return rows.map(mapRow);
}

/** 按类型分组（前端展示用） */
export function groupMemoryItems(items = []) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  }
  return [...groups.entries()]
    .map(([type, list]) => ({ type, meta: memoryTypeMeta(type), items: list }))
    .sort((a, b) => a.meta.order - b.meta.order);
}

/**
 * 写入/更新一条记忆。
 * 已存在同一句 → 命中次数 +1，重要度取两者较大值（重复提到会更重要）。
 *
 * @param {boolean} touch  false = 这条记忆对「命中次数」不敏感（如入学画像
 *   同步：读一次记忆就同步一次，不该算学生「提到过」）。此时已有条目原样
 *   返回，不写库，避免每次读都抬高 hits、把排序信号污染掉。
 */
export async function upsertMemoryItem(
  userId,
  { type, content, importance, source = "ai", silent = false, touch = true } = {}
) {
  await ensureMemorySchema();
  if (!userId || !isType(type)) return null;

  const text = normalizeContent(content);
  if (!text) return null;

  const meta = memoryTypeMeta(type);
  const level = clampImportance(importance, meta.defaultImportance);

  const existing = await get(
    `SELECT * FROM ai_teacher_memory
     WHERE user_id = ? AND memory_type = ? AND content = ?`,
    [userId, type, text]
  );

  if (existing) {
    if (!touch) return mapRow(existing);

    await run(
      `UPDATE ai_teacher_memory
       SET importance = ?, hits = hits + 1, source = ?, updated_at = ?
       WHERE id = ?`,
      [
        Math.max(level, Number(existing.importance || 3)),
        source,
        new Date().toISOString(),
        existing.id,
      ]
    );
    const row = await get("SELECT * FROM ai_teacher_memory WHERE id = ?", [
      existing.id,
    ]);
    return mapRow(row);
  }

  await run(
    `INSERT INTO ai_teacher_memory
       (user_id, memory_type, content, importance, source, hits, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(user_id, memory_type, content) DO UPDATE SET
       importance = MAX(importance, excluded.importance),
       hits = hits + 1,
       updated_at = excluded.updated_at`,
    [
      userId,
      type,
      text,
      level,
      source,
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );

  if (!silent) await pruneMemoryType(userId, type);

  const row = await get(
    `SELECT * FROM ai_teacher_memory
     WHERE user_id = ? AND memory_type = ? AND content = ?`,
    [userId, type, text]
  );
  return row ? mapRow(row) : null;
}

/** 单类型超量时淘汰：保留重要度高、命中多、较新的 */
export async function pruneMemoryType(userId, type) {
  if (!userId || !isType(type)) return;
  await run(
    `DELETE FROM ai_teacher_memory
     WHERE user_id = ? AND memory_type = ? AND id NOT IN (
       SELECT id FROM ai_teacher_memory
       WHERE user_id = ? AND memory_type = ?
       ORDER BY importance DESC, hits DESC, datetime(updated_at) DESC, id DESC
       LIMIT ${MAX_ITEMS_PER_TYPE}
     )`,
    [userId, type, userId, type]
  );
}

export async function deleteMemoryItem(userId, id) {
  await ensureMemorySchema();
  if (!userId || !id) return false;
  const result = await run(
    "DELETE FROM ai_teacher_memory WHERE id = ? AND user_id = ?",
    [Number(id), userId]
  );
  return (result?.changes || 0) > 0;
}

/** 清空某一类（用户手动改画像时用：先清后写，保证与表单一致） */
export async function clearMemoryType(userId, type) {
  await ensureMemorySchema();
  if (!userId || !isType(type)) return;
  await run(
    "DELETE FROM ai_teacher_memory WHERE user_id = ? AND memory_type = ?",
    [userId, type]
  );
}

/** 用一组内容整体替换某一类 */
export async function replaceMemoryType(
  userId,
  type,
  contents = [],
  { importance, source = "manual" } = {}
) {
  await clearMemoryType(userId, type);
  const items = [];
  for (const content of contents) {
    const item = await upsertMemoryItem(userId, {
      type,
      content,
      importance,
      source,
      silent: true,
    });
    if (item) items.push(item);
  }
  await pruneMemoryType(userId, type);
  return items;
}

/* ============================================================
   来源 ①：入学测评画像 → 记忆
============================================================ */

const GOAL_LABELS = {
  major: "泰语专业学习",
  travel: "泰国旅行交流",
  business: "商务工作",
  study: "泰国留学",
  drama: "泰剧影视",
  music: "泰语音乐",
  culture: "泰国文化",
};

const DIRECTION_LABELS = {
  business: "商务泰语",
  academic: "学术泰语",
  tourism: "旅游服务泰语",
  news: "新闻泰语",
  newmedia: "新媒体泰语",
};

const MEDIA_LABELS = {
  drama: "泰剧",
  movie: "电影",
  song: "歌曲",
  variety: "综艺",
  news: "新闻",
  tiktok: "TikTok 短视频",
  novel: "小说",
  food: "美食",
  travel: "旅行",
};

const STYLE_LABELS = {
  visual: "视觉学习（图文/闪卡）",
  listening: "听力学习（音频/精听）",
  speaking: "口语练习（跟读/对话）",
  reading: "阅读学习（课文/精读）",
};

const LEVEL_IMPORTANCE = { A0: 5, A1: 5, A2: 5, B1: 5, B2: 4, C1: 4 };

/**
 * 把 `user_profiles`（入学测试产物）同步成分类记忆。
 *
 * 确定性、不调用模型，且完全幂等：已存在的条目原样跳过（不计命中次数、
 * 不刷更新时间），本次没再出现的旧结论会被清掉，所以它可以在每次读记忆时
 * 安心地跑一遍。
 */
export async function syncPlacementMemory(userId) {
  await ensureMemorySchema();
  if (!userId) return { items: 0 };

  const profile = await get(
    `SELECT thai_level, learning_goal, professional_direction,
            media_interest, learning_style, target_scenario
     FROM user_profiles WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  if (!profile) return { items: 0 };

  const csv = (value) =>
    String(value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  let count = 0;
  /** 本次同步出来的期望条目（用于清掉已经过时的旧结论） */
  const desired = [];
  const push = async (type, content, importance) => {
    if (!content) return;
    desired.push(content);
    const item = await upsertMemoryItem(userId, {
      type,
      content,
      importance,
      source: "placement",
      silent: true,
      touch: false, // 读记忆会顺带同步，不能算作学生「提到过」
    });
    if (item) count++;
  };

  if (profile.thai_level) {
    await push(
      "profile",
      `泰语等级 ${profile.thai_level}（入学测试结果）`,
      LEVEL_IMPORTANCE[profile.thai_level] || 4
    );
  }

  if (profile.learning_goal) {
    const label = GOAL_LABELS[profile.learning_goal] || profile.learning_goal;
    await push("goal", `学习目标：${label}`, 5);
  }

  for (const id of csv(profile.professional_direction)) {
    const label = DIRECTION_LABELS[id] || id;
    await push("goal", `专业方向：${label}`, 4);
  }

  for (const id of csv(profile.media_interest)) {
    const label = MEDIA_LABELS[id] || id;
    await push("interest", `喜欢${label}类内容`, 3);
  }

  for (const id of csv(profile.learning_style)) {
    const label = STYLE_LABELS[id] || id;
    await push("habit", `偏好${label}`, 3);
  }

  if (profile.target_scenario) {
    await push("goal", `目标场景：${profile.target_scenario}`, 4);
  }

  /*
   * 清掉本次没再出现的画像条目：学生重测等级、改了学习目标或兴趣之后，
   * 不该同时留着「泰语等级 A0」和「泰语等级 B1」这种自相矛盾的记忆。
   * 只动 source='placement' 的行——对话自动提取（ai）与用户手写（manual）
   * 的记忆不受影响。
   */
  if (desired.length) {
    const marks = desired.map(() => "?").join(",");
    await run(
      `DELETE FROM ai_teacher_memory
       WHERE user_id = ? AND source = 'placement' AND content NOT IN (${marks})`,
      [userId, ...desired]
    ).catch(() => {});
  }

  return { items: count };
}

/* ============================================================
   来源 ②：对话中由模型提取
============================================================ */

/**
 * 应用模型提取结果。既兼容新的分类字段，也兼容旧的 blob 字段
 * （studentName / interests / goals / mistakes / preferences），
 * 所以旧记忆迁移与新版提取走同一条路。
 *
 * 新字段：{ profile, goals, interests, habits, weaknesses, errors, preferences }
 * 旧字段：{ studentName, genderHint, level, interests, goals, mistakes, preferences }
 */
export async function applyMemoryExtract(
  userId,
  parsed = {},
  { source = "ai", silent = false } = {}
) {
  await ensureMemorySchema();
  if (!userId || !parsed || typeof parsed !== "object") return 0;

  /*
   * 宽容解析：列表里的元素可以是字符串，也可以是
   * { content, importance }（模型想强调某条时会给重要度）。
   */
  const asList = (value) => {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    return raw
      .map((v) => {
        if (v && typeof v === "object") {
          return {
            content: normalizeContent(v.content ?? v.text ?? v.value),
            importance: Number.isFinite(Number(v.importance))
              ? clampImportance(v.importance)
              : undefined,
          };
        }
        return { content: normalizeContent(v), importance: undefined };
      })
      .filter((x) => x.content);
  };

  let count = 0;
  const push = async (type, content, importance) => {
    if (!content) return;
    const item = await upsertMemoryItem(userId, {
      type,
      content,
      importance,
      source,
      silent: true,
    });
    if (item) count++;
  };

  /* 身份类 */
  if (parsed.studentName) {
    await push("profile", `名字：${normalizeContent(parsed.studentName)}`, 5);
  }
  if (parsed.genderHint) {
    await push(
      "profile",
      `性别线索：${normalizeContent(parsed.genderHint)}（影响 ครับ/ค่ะ 的选择）`,
      5
    );
  }
  if (parsed.level) {
    await push("profile", `水平评估：${normalizeContent(parsed.level)}`, 4);
  }

  /* 分类内容 */
  const typed = {
    goal: [...asList(parsed.goals), ...asList(parsed.goal)],
    interest: [...asList(parsed.interests), ...asList(parsed.interest)],
    habit: [...asList(parsed.habits), ...asList(parsed.habit)],
    weakness: [...asList(parsed.weaknesses), ...asList(parsed.weakness)],
    error: [...asList(parsed.errors), ...asList(parsed.mistakes)],
    preference: [...asList(parsed.preferences), ...asList(parsed.preference)],
    profile: asList(parsed.profile),
  };

  for (const [type, list] of Object.entries(typed)) {
    for (const entry of list) {
      await push(type, entry.content, entry.importance);
    }
  }

  if (!silent) {
    for (const type of MEMORY_TYPE_IDS) {
      await pruneMemoryType(userId, type);
    }
  }

  return count;
}

/* ============================================================
   注入提示词
============================================================ */

/**
 * 把分类记忆编译成 system prompt 片段（重要度排序 → 截断）。
 * 空记忆返回 ""，行为与升级前一致。
 */
export function buildMemoryPrompt(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";

  const sorted = [...items].sort(
    (a, b) =>
      b.importance - a.importance ||
      b.hits - a.hits ||
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );

  const byType = new Map();
  let used = 0;
  for (const item of sorted) {
    if (used >= MAX_PROMPT_ITEMS) break;
    const content = String(item.content || "").slice(0, MAX_PROMPT_ITEM_CHARS);
    if (!content) continue;
    if (!byType.has(item.type)) byType.set(item.type, []);
    byType.get(item.type).push(content);
    used++;
  }
  if (byType.size === 0) return "";

  const lines = [...byType.entries()]
    .sort((a, b) => memoryTypeMeta(a[0]).order - memoryTypeMeta(b[0]).order)
    .map(([type, contents]) => {
      const meta = memoryTypeMeta(type);
      return `${meta.emoji} ${meta.promptLabel}：${contents.join("；")}`;
    });

  return [
    "【长期记忆 · 跨会话】以下是你在之前的对话与入学测试中已经了解到的学生情况：",
    ...lines,
    "使用要求：",
    "- 自然地使用这些信息（用学生熟悉的话题举例、避免重复解释已掌握的内容）。",
    "- 针对「薄弱点」和「反复出现的错误」主动设计练习：先肯定做对的部分，再温和指出并给对比例句。",
    "- 不要把记忆当成结论：学生的新说法与记忆冲突时，以新说法为准。",
    "- 不要向学生提及「记忆」「记录」这类词，就像你本来就知道一样。",
  ].join("\n");
}

/* ============================================================
   兼容层：旧的扁平结构（前端个人中心、AITeacher 组件仍在用）
============================================================ */

/** 分类记忆 → 旧版 { studentName, genderHint, level, ... } 结构 */
export function toLegacyMemory(items = []) {
  const pick = (type) => items.filter((i) => i.type === type);
  const strip = (text, prefix) =>
    String(text || "").replace(new RegExp(`^${prefix}[:：]?`), "").trim();

  const profileItems = pick("profile");
  const findProfile = (kw) =>
    profileItems.find((i) => String(i.content).includes(kw));

  const studentName = findProfile("名字");
  const gender = findProfile("性别线索");
  const levelItem = findProfile("水平评估") || findProfile("泰语等级");

  const memory = {};
  if (studentName) memory.studentName = strip(studentName.content, "名字");
  if (gender) memory.genderHint = strip(gender.content, "性别线索");
  if (levelItem) {
    memory.level = strip(strip(levelItem.content, "水平评估"), "泰语等级");
  }

  const interests = pick("interest").map((i) =>
    strip(i.content, "喜欢").replace(/类内容$/, "")
  );
  const goals = pick("goal").map((i) => strip(i.content, "学习目标"));
  const mistakes = pick("error").map((i) => i.content);
  const preferences = pick("preference").map((i) => i.content);

  if (interests.length) memory.interests = interests;
  if (goals.length) memory.goals = goals;
  if (mistakes.length) memory.mistakes = mistakes;
  if (preferences.length) memory.preferences = preferences;

  const weaknesses = pick("weakness");
  const habits = pick("habit");
  if (weaknesses.length) memory.weaknesses = weaknesses.map((i) => i.content);
  if (habits.length) memory.habits = habits.map((i) => i.content);

  return memory;
}

/** 旧版结构 → 分类条目（个人中心手动保存走这条路） */
export function legacyToMemoryItems(memory = {}) {
  const out = [];
  const push = (type, content) => {
    const text = normalizeContent(content);
    if (text) out.push({ type, content: text });
  };

  if (memory.studentName) push("profile", `名字：${memory.studentName}`);
  if (memory.genderHint) {
    push("profile", `性别线索：${memory.genderHint}（影响 ครับ/ค่ะ 的选择）`);
  }
  if (memory.level) push("profile", `水平评估：${memory.level}`);

  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  for (const g of list(memory.goals)) push("goal", g);
  for (const i of list(memory.interests)) push("interest", i);
  for (const w of list(memory.weaknesses)) push("weakness", w);
  for (const m of list(memory.mistakes)) push("error", m);
  for (const h of list(memory.habits)) push("habit", h);
  for (const p of list(memory.preferences)) push("preference", p);

  return out;
}

/** 记忆摘要（一句话，给「老师记得你」小标签用） */
export function memorySummary(items = []) {
  if (!items.length) return "";
  const byType = (type) => items.filter((i) => i.type === type);
  const top = (type) =>
    [...byType(type)]
      .sort((a, b) => b.importance - a.importance || b.hits - a.hits)
      .slice(0, 3)
      .map((i) => i.content);

  const parts = [];
  const name = byType("profile").find((i) => i.content.startsWith("名字"));
  if (name) parts.push(name.content.replace(/^名字[:：]?/, "名字："));
  const goals = top("goal");
  if (goals.length) parts.push(`目标：${goals.slice(0, 2).join("、")}`);
  const interests = top("interest");
  if (interests.length) parts.push(`兴趣：${interests.slice(0, 3).join("、")}`);
  const weaknesses = top("weakness");
  if (weaknesses.length) parts.push(`薄弱点：${weaknesses.slice(0, 2).join("、")}`);

  return parts.join(" · ").slice(0, 200);
}

/* ============================================================
   总入口：聊天接口用这一个函数拿到「记忆 + 提示词」
============================================================ */

/**
 * 读记忆（顺带把入学画像同步进来），返回：
 *   { items, grouped, prompt, legacy, summary, hasMemory }
 * 任何一步出错都降级为「没有记忆」，绝不影响主对话。
 */
export async function loadMemoryForPrompt(userId) {
  try {
    await ensureMemorySchema();
    if (!userId) return emptyMemory();

    // 入学测试的结论先落成记忆（幂等；测试刚做完就立刻生效）
    await syncPlacementMemory(userId).catch(() => {});
    const items = await listMemoryItems(userId);

    return {
      items,
      grouped: groupMemoryItems(items),
      prompt: buildMemoryPrompt(items),
      legacy: toLegacyMemory(items),
      summary: memorySummary(items),
      hasMemory: items.length > 0,
    };
  } catch (err) {
    console.warn("[aiMemory] 读取记忆失败，按无记忆继续:", err?.message || err);
    return emptyMemory();
  }
}

const emptyMemory = () => ({
  items: [],
  grouped: [],
  prompt: "",
  legacy: {},
  summary: "",
  hasMemory: false,
});

export default {
  MEMORY_TYPES,
  MEMORY_TYPE_IDS,
  MANUAL_IMPORTANCE,
  ensureMemorySchema,
  listMemoryItems,
  groupMemoryItems,
  upsertMemoryItem,
  deleteMemoryItem,
  clearMemoryType,
  replaceMemoryType,
  syncPlacementMemory,
  applyMemoryExtract,
  buildMemoryPrompt,
  toLegacyMemory,
  legacyToMemoryItems,
  memorySummary,
  loadMemoryForPrompt,
  memoryTypeMeta,
};
