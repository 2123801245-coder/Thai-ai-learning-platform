// backend/routes/thai.js
//
// ============================================================
// 泰语分词 + 词汇释义（罗马音 / 中文 / 词性）
// ============================================================
//
// 泰语书写没有词间空格，新闻标题的「词汇提取」以前靠正则切
// 泰文片段，粒度是「一段泰文」而不是「词」。
//
// 现在接入真正的分词：
//   - Node 18+ 自带 ICU（full-icu），Intl.Segmenter('th') 用
//     ICU 泰语词典做真实的词边界识别，零外部依赖、离线可用。
//   - 分出的词在 backend/data/thaiDict.json（5234 词条，来自
//     前端三份词库，build-thai-dict.mjs 生成）里查罗马音与释义。
//   - 词典查不到的词 → 交给 AI 老师补释义（jsonMode 结构化输出），
//     结果写进 vocab_definitions 缓存表，下次同词免 AI。
//
// 响应：
//   POST /api/thai/segment  { text, limit? }
//   → { success, tokens: [{ th, roman, cn, pos, source: dict|ai }] }

import { Router } from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import db from "../database.js";
import { chatCompletion } from "../aiProvider.js";

const router = Router();

/* ── 词典加载（模块级一次，进程内复用） ── */

const DICT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "thaiDict.json"
);

let DICT = null;
function loadDict() {
  if (DICT) return DICT;
  try {
    const parsed = JSON.parse(readFileSync(DICT_PATH, "utf8"));
    DICT = new Map(parsed.entries.map((e) => [e.th, e]));
  } catch {
    DICT = new Map();
  }
  return DICT;
}

/* ── 分词器（懒初始化；ICU 不可用时退化为空 → 走 fallback） ── */

let SEGMENTER;
function getSegmenter() {
  if (SEGMENTER !== undefined) return SEGMENTER;
  try {
    SEGMENTER = new Intl.Segmenter("th", { granularity: "word" });
  } catch {
    SEGMENTER = null;
  }
  return SEGMENTER;
}

/** 正则兜底：粗切泰文片段（旧 heuristics，保底不失败） */
const THAI_RUN = /[\u0E00-\u0E7F]+/g;

function segmentThai(text) {
  const seg = getSegmenter();
  if (!seg) {
    return (String(text).match(THAI_RUN) || []).slice(0, 40);
  }
  return [...seg.segment(String(text))]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment.trim())
    .filter(Boolean);
}

/* ── 释义缓存表（懒建表：不动 ensureSchema 的主流程） ── */

let tableReady = false;
function ensureDefinitionsTable() {
  if (tableReady) return;
  db.run(
    `CREATE TABLE IF NOT EXISTS vocab_definitions (
       thai       TEXT PRIMARY KEY,
       roman      TEXT,
       chinese    TEXT NOT NULL,
       pos        TEXT,
       source     TEXT NOT NULL DEFAULT 'ai',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    (err) => {
      if (!err) tableReady = true;
    }
  );
}

function lookupCached(word) {
  return new Promise((resolve) => {
    ensureDefinitionsTable();
    db.get(
      "SELECT thai, roman, chinese, pos, source FROM vocab_definitions WHERE thai = ?",
      [word],
      (err, row) => resolve(err ? null : row || null)
    );
  });
}

function saveCached(word, def) {
  db.run(
    `INSERT INTO vocab_definitions (thai, roman, chinese, pos, source)
     VALUES (?, ?, ?, ?, 'ai')
     ON CONFLICT(thai) DO NOTHING`,
    [word, def.roman || "", def.chinese || "", def.pos || ""],
    () => {}
  );
}

/* ── AI 兜底释义（并发去重 + 失败不阻塞） ── */

const inflight = new Map();

async function aiDefine(word) {
  if (inflight.has(word)) return inflight.get(word);
  const job = (async () => {
    try {
      const response = await chatCompletion(
        [
          {
            role: "system",
            content:
              "你是泰语词典。对给定泰语词条输出 JSON：{\"roman\":\"罗曼拼音（含声调符号）\",\"chinese\":\"简体中文释义（尽量一词，不超过12字）\",\"pos\":\"词性\"}。只输出 JSON。",
          },
          { role: "user", content: word },
        ],
        { temperature: 0.2, maxTokens: 200, jsonMode: true, timeoutMs: 15000 }
      );
      const raw = String(response || "").trim();
      const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      if (json?.chinese) {
        const def = {
          roman: String(json.roman || "").trim(),
          chinese: String(json.chinese).trim(),
          pos: String(json.pos || "").trim(),
        };
        saveCached(word, def);
        return def;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflight.delete(word);
    }
  })();
  inflight.set(word, job);
  return job;
}

/* ── 路由 ── */

router.post("/thai/segment", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const limit = Math.min(Math.max(Number(req.body?.limit) || 12, 1), 30);
  if (!text) {
    return res.json({ success: true, tokens: [] });
  }

  /* ① 分词（ICU 词边界） */
  const raw = segmentThai(text);

  /* ② 过滤：太短的虚词/单字母去掉，但保留词典里的真词（ผม/ฉัน/ครับ） */
  const dict = loadDict();
  const words = [...new Set(raw)]
    .filter((w) => {
      if (dict.has(w)) return true;
      const thaiChars = w.match(/[\u0E00-\u0E7F]/g)?.length || 0;
      return thaiChars >= 2;
    })
    .slice(0, limit);

  /* ③ 释义：词典优先，缺的同时查 AI + 缓存 */
  const tokens = await Promise.all(
    words.map(async (w) => {
      const fromDict = dict.get(w);
      if (fromDict) {
        return { th: w, roman: fromDict.roman, cn: fromDict.cn, pos: fromDict.pos, source: "dict" };
      }
      const cached = await lookupCached(w);
      if (cached) {
        return { th: w, roman: cached.roman, cn: cached.chinese, pos: cached.pos, source: "cache" };
      }
      const ai = await aiDefine(w);
      return {
        th: w,
        roman: ai?.roman || "",
        cn: ai?.chinese || "",
        pos: ai?.pos || "",
        source: ai ? "ai" : "none",
      };
    })
  );

  res.json({ success: true, tokens });
});

export default router;
