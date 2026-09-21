// 临时验收：/api/professional 端到端（真实 express + 真实 sqlite 副本，端口 0，不碰 3001）
// 运行：DB_PATH=/tmp/prof-check.db node .prof-api-check.mjs
import express from "express";
import jwt from "jsonwebtoken";

import db from "./backend/database.js";
import professionalRouter from "./backend/routes/professional.js";

const SECRET = process.env.JWT_SECRET || "thai_ai_teacher_2026";
const USER_ID = 99999; // 合成用户，避免动到副本里已有画像

const token = jwt.sign({ id: USER_ID }, SECRET, { expiresIn: "1h" });

const app = express();
app.use(express.json());
app.use("/api/professional", professionalRouter);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/api/professional`;

  const call = async (method, path, body, withToken = true) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(withToken ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* 非 JSON */
    }

    return { status: res.status, data };
  };

  try {
    /* 0) 迁移是否应用到真实 DB 副本（表 + 原有数据都还在） */
    const tables = await new Promise((resolve) =>
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (e, r) =>
        resolve((r || []).map((x) => x.name))
      )
    );
    const userCount = await new Promise((resolve) =>
      db.get("SELECT COUNT(*) AS c FROM users", (e, r) => resolve(r?.c))
    );
    const seeded = await new Promise((resolve) =>
      db.get("SELECT COUNT(*) AS c FROM professional_courses", (e, r) =>
        resolve(r?.c)
      )
    );

    console.log("[0] 迁移与 seed");
    console.log("    professional_courses 建表:", tables.includes("professional_courses"));
    console.log("    表总数:", tables.length, "| 原有 users 行数:", userCount);
    console.log("    seed 行数（应为 19）:", seeded);

    /* 1) 鉴权 */
    const anon = await call("GET", "/courses", null, false);
    console.log("\n[1] 未带 token:", anon.status, JSON.stringify(anon.data));

    /* 2) 目录接口 */
    const tracks = await call("GET", "/tracks");
    console.log("\n[2] GET /tracks:", tracks.status);
    console.log(
      "    方向:",
      tracks.data.tracks.map((t) => `${t.emoji}${t.title}(${t.modules.length})`).join(" ")
    );
    console.log("    板块总数:", tracks.data.totalModules);
    console.log(
      "    商务方向板块:",
      tracks.data.tracks
        .find((t) => t.id === "business")
        .modules.map((m) => `${m.title}/${m.level}/${m.lessons}节`)
        .join("、")
    );

    /* 3) 初始选择为空 */
    const initial = await call("GET", "/sync");
    console.log("\n[3] 初始 GET /sync:", JSON.stringify(initial.data.tracks), "| stages:", initial.data.stages.length);

    /* 4) 保存选择（含非法值与超过上限） */
    const saved = await call("POST", "/sync", {
      tracks: ["business", "bogus", "news", "academic", "tourism"],
    });
    console.log("\n[4] POST /sync（含非法值 + 5 个方向）");
    console.log("    status:", saved.status, "| message:", saved.data.message);
    console.log("    规整结果（上限 3）:", JSON.stringify(saved.data.tracks));
    console.log(
      "    返回专题课:",
      saved.data.courses.map((c) => `${c.category}/${c.title}(${c.level},${c.lessons}节)`).join(" ")
    );

    /* 5) 回读 + 库内校验 */
    const after = await call("GET", "/sync");
    const row = await new Promise((resolve) =>
      db.get(
        "SELECT user_id, professional_direction FROM user_profiles WHERE user_id = ?",
        [USER_ID],
        (e, r) => resolve(r)
      )
    );
    console.log("\n[5] 回读 GET /sync:", JSON.stringify(after.data.tracks));
    console.log("    入库行:", JSON.stringify(row));
    console.log("    stages 骨架:", JSON.stringify(after.data.stages));

    /* 6) 按方向过滤专题课 */
    const biz = await call("GET", "/courses?category=business");
    const mixed = await call("GET", "/courses?category=business,news");
    console.log("\n[6] GET /courses?category=business →", biz.data.total, "条");
    console.log("    ?category=business,news →", mixed.data.total, "条，分类:", JSON.stringify([...new Set(mixed.data.courses.map((c) => c.category))]));

    /* 7) 清空 */
    const cleared = await call("DELETE", "/sync");
    const finalTracks = await call("GET", "/sync");
    console.log("\n[7] DELETE /sync:", cleared.status, "| 清空后:", JSON.stringify(finalTracks.data.tracks));
    console.log("    清空后 stages:", finalTracks.data.stages.length);
  } catch (error) {
    console.error("API CHECK FAILED:", error);
    process.exitCode = 1;
  } finally {
    server.close();
    db.close();
  }
});
