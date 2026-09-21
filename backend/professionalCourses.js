// backend/professionalCourses.js
//
// ============================================================
// 专业泰语模块 · 专题课入库（professional_courses）
// ============================================================
//
// 「不要设计成固定课程」：这里入库的不是一条条写死的课程表，
// 而是**内容板块**（商务交流 / 会议表达 / 邮件写作…），
// 每个板块自带难度等级（level）与课时数（lessons），
// 用户选择方向后由路线引擎把对应板块织进自己的学习路线。
//
// 单一数据源：直接复用前端内容模块 src/data/professionalTracks.js
// （纯数据、无依赖），避免前后端各维护一份内容清单导致漂移。
//
// 幂等：id 是板块 id（TEXT 主键），每次启动 upsert，不产生脏数据。
// ============================================================

import { PROFESSIONAL_TRACKS } from "../src/data/professionalTracks.js";

export const VALID_CATEGORIES = PROFESSIONAL_TRACKS.map((track) => track.id);

export const MAX_SELECTED_TRACKS = 3;

/* ============================================================
   启动时把内置内容同步进 professional_courses
============================================================ */

export function seedProfessionalCourses(db) {
  const stmt = db.prepare(`
    INSERT INTO professional_courses (id, title, category, level, lessons)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      level = excluded.level,
      lessons = excluded.lessons
  `);

  let count = 0;

  for (const track of PROFESSIONAL_TRACKS) {
    for (const module of track.modules) {
      stmt.run(
        module.id,
        module.title,
        track.id,
        module.level || null,
        Number(module.lessons) || 0
      );
      count += 1;
    }
  }

  stmt.finalize();

  return count;
}

/* ============================================================
   查询
============================================================ */

/** 按方向（可多选）读取专题课；不传 category 返回全部 */
export function queryProfessionalCourses(db, categories = []) {
  const list = (Array.isArray(categories) ? categories : [categories])
    .map((item) => String(item || "").trim())
    .filter((item) => VALID_CATEGORIES.includes(item));

  const sql = list.length
    ? `SELECT id, title, category, level, lessons, created_at
         FROM professional_courses
        WHERE category IN (${list.map(() => "?").join(",")})
        ORDER BY category, rowid`
    : `SELECT id, title, category, level, lessons, created_at
         FROM professional_courses
        ORDER BY category, rowid`;

  return new Promise((resolve, reject) => {
    db.all(sql, list, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/** 某个用户当前选中的方向（存在 user_profiles.professional_direction） */
export function querySelectedTracks(db, userId) {
  return new Promise((resolve) => {
    db.get(
      "SELECT professional_direction FROM user_profiles WHERE user_id = ?",
      [userId],
      (err, row) => {
        if (err || !row) {
          resolve([]);
          return;
        }

        const tracks = String(row.professional_direction || "")
          .split(",")
          .map((item) => item.trim())
          .filter((item) => VALID_CATEGORIES.includes(item));

        resolve([...new Set(tracks)]);
      }
    );
  });
}

/**
 * 保存用户选择：写入 user_profiles.professional_direction。
 * 用 upsert 而不是要求画像必须已存在——用户可能跳过入学测试直接来选方向。
 */
export function saveSelectedTracks(db, userId, tracks) {
  const csv = tracks.join(",");

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO user_profiles (user_id, professional_direction)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         professional_direction = excluded.professional_direction,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, csv],
      function onDone(err) {
        if (err) reject(err);
        else resolve({ userId, tracks });
      }
    );
  });
}

/** 把任意输入规整成合法方向列表（去重、限长、限个数） */
export function normalizeTracks(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || "")
        .split(",")
        .map((item) => item.trim());

  const tracks = [];

  for (const item of raw) {
    const id = String(item || "").trim();
    if (VALID_CATEGORIES.includes(id) && !tracks.includes(id)) {
      tracks.push(id);
    }
  }

  return tracks.slice(0, MAX_SELECTED_TRACKS);
}

/** 方向 → 展示信息（前端页面与接口共用同一份） */
export function listTracks() {
  return PROFESSIONAL_TRACKS.map((track) => ({
    id: track.id,
    title: track.title,
    emoji: track.emoji,
    tagline: track.tagline,
    moduleCount: track.modules.length,
  }));
}
