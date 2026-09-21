// 临时验收：professional_courses 建表 / seed / 查询 / 画像同步（真 sqlite，非 mock）
import sqlite3 from "sqlite3";

import {
  MAX_SELECTED_TRACKS,
  listTracks,
  normalizeTracks,
  queryProfessionalCourses,
  querySelectedTracks,
  saveSelectedTracks,
  seedProfessionalCourses,
} from "./backend/professionalCourses.js";

const db = new sqlite3.Database(":memory:");

db.serialize(() => {
  db.run(`CREATE TABLE professional_courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT,
    lessons INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    thai_level TEXT,
    learning_goal TEXT,
    professional_direction TEXT,
    media_interest TEXT,
    learning_style TEXT,
    target_scenario TEXT,
    test_score INTEGER DEFAULT 0,
    test_detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log("seed #1 ->", seedProfessionalCourses(db), "modules");
  console.log("seed #2 ->", seedProfessionalCourses(db), "modules (幂等重跑)");
});

setTimeout(async () => {
  try {
    /* 1) 表内容 */
    const all = await queryProfessionalCourses(db, []);
    const count = await new Promise((resolve) =>
      db.get("SELECT COUNT(*) AS c FROM professional_courses", (e, r) =>
        resolve(r?.c)
      )
    );

    console.log("\n[1] 表中行数:", count, "| 查询返回:", all.length);
    console.log("    样例:", all.slice(0, 3).map((r) => `${r.category}/${r.id}(${r.level},${r.lessons}节)`));

    /* 2) 按方向过滤 */
    const biz = await queryProfessionalCourses(db, ["business"]);
    const news = await queryProfessionalCourses(db, ["news"]);
    console.log("[2] business 板块:", biz.map((r) => r.title).join("、"));
    console.log("    news 板块:", news.map((r) => r.title).join("、"));
    console.log("    过滤完整性:", biz.every((r) => r.category === "business"));

    /* 3) 参数规整 */
    console.log(
      "[3] normalizeTracks 去重/限长/非法值过滤:",
      JSON.stringify(normalizeTracks(["business", "business", "bogus", "academic", "news", "tourism"])),
      `(上限 ${MAX_SELECTED_TRACKS})`
    );
    console.log("    空输入:", JSON.stringify(normalizeTracks(undefined)));

    /* 4) 选择 → 画像表往返（用户未做入学测试时也要能存） */
    await saveSelectedTracks(db, 7, ["business", "news"]);
    console.log("[4] 保存后读回:", JSON.stringify(await querySelectedTracks(db, 7)));

    await saveSelectedTracks(db, 7, ["tourism"]);
    const rows = await new Promise((resolve) =>
      db.all("SELECT user_id, professional_direction FROM user_profiles", (e, r) =>
        resolve(r || [])
      )
    );
    console.log("    覆盖写入(应为 1 行/tourism):", JSON.stringify(rows));

    /* 5) 与画像其他字段共存（不能把已有画像清掉） */
    db.run(
      "UPDATE user_profiles SET thai_level = 'A2', learning_goal = 'study' WHERE user_id = 7",
      async () => {
        await saveSelectedTracks(db, 7, ["academic"]);
        db.get(
          "SELECT thai_level, learning_goal, professional_direction FROM user_profiles WHERE user_id = 7",
          (e, row) => {
            console.log("[5] 选方向后画像仍在:", JSON.stringify(row));
            console.log("\n[6] 方向清单:", listTracks().map((t) => `${t.emoji}${t.title}(${t.moduleCount})`).join(" "));
            db.close();
          }
        );
      }
    );
  } catch (error) {
    console.error("CHECK FAILED:", error);
    db.close();
    process.exitCode = 1;
  }
}, 400);
