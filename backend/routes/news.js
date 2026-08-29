// backend/routes/news.js
//
// 真实语料库 · ThaiPBS 时事新闻（每日更新）
//
//   GET /api/news/daily
//     返回当天缓存的最新 ThaiPBS 新闻（标题 + 导语 + 原文链接 + 分类 + 时间）。
//
// 设计要点：
//   - 只抓取「标题 + 导语 + 原文链接」，不抓取全文（版权安全，且可完全自动化）。
//   - 结果缓存到 SQLite news_cache 表，按天（key = 泰国日期）存储。
//   - 优先用缓存；缓存过期或过期未抓过时才去请求 ThaiPBS（避免每次都打源站）。
//   - 请求 ThaiPBS 失败时回退到最近一次成功缓存，保证接口稳定不 500。
//   - 服务运行期间定时（每 4 小时）尝试刷新当天缓存，实现「每日更新」。

import { Router } from "express";
import { pathToFileURL } from "url";
import db from "../database.js";
import { authenticate } from "./auth.js";
import { getQuotaSetting } from "./features.js";
import { createNotification } from "./notifications.js";
import { translateNewsBatch, translateArticleBody, isTranslateEnabled } from "../translate.js";

const router = Router();

const THAIPBS_NEWS_URL = "https://www.thaipbs.or.th/news";

// 泰国时区 (UTC+7) 的当天日期字符串 YYYY-MM-DD
function thaiToday() {
  const now = new Date();
  // 转成泰国本地时间的 UTC ISO 字符串
  const iso = new Date(now.getTime() + 7 * 3600 * 1000).toISOString();
  return iso.slice(0, 10);
}

const hms = (label) => console.log(`[news] ${label}`);

/* ============================================================
   新闻听力练习会员体系（与口语练习配额一致）

   - 听音填空：免费用户每天限 NEWS_LISTENING_FREE_DAILY 题（默认 10），
     VIP 无限。
   - 逐句听 / 离线语料库：免费。
   - 跟读评分（sentence 模式）：复用口语练习的 VIP 规则（Azure 专业评测 VIP 专属）。

   用量存 news_listening_usage 表，按泰国时区日期归档。
============================================================ */

/* 优先级：设置中心管理员配置 > 环境变量 NEWS_LISTENING_FREE_DAILY > 默认 10 */
function getFreeQuestionDaily() {
  return getQuotaSetting(
    "newsListeningFreeDaily",
    Number(process.env.NEWS_LISTENING_FREE_DAILY) || 10
  );
}

function isVipActive(user) {
  if (!user || !user.is_vip) return false;
  if (!user.vip_expires_at) return false;
  const expiry = new Date(
    String(user.vip_expires_at).replace(" ", "T") + "Z"
  );
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}

function getNewsUsage(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT question_count FROM news_listening_usage WHERE user_id = ? AND usage_date = ?",
      [userId, thaiToday()],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.question_count : 0);
      }
    );
  });
}

function incrementNewsUsage(userId, n) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO news_listening_usage (user_id, usage_date, question_count)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, usage_date)
       DO UPDATE SET question_count = question_count + ?`,
      [userId, thaiToday(), n, n],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

async function newsQuotaPayload(userId) {
  const vipUser = await new Promise((resolve, reject) => {
    db.get(
      "SELECT is_vip, vip_expires_at FROM users WHERE id = ?",
      [userId],
      (err, user) => (err ? reject(err) : resolve(user))
    );
  });
  const isVip = isVipActive(vipUser);
  const used = await getNewsUsage(userId);
  const freeQuestionDaily = await getFreeQuestionDaily();
  return {
    freeQuestionDaily,
    usedToday: used,
    remainingToday: Math.max(0, freeQuestionDaily - used),
    isVip,
  };
}

/* ============================================================
   读取 / 写入缓存
============================================================ */

function getCache(key) {
  return new Promise((resolve) => {
    db.get(
      "SELECT value, fetched_at FROM news_cache WHERE key = ?",
      [key],
      (err, row) => {
        if (err || !row) return resolve(null);
        try {
          resolve({ items: JSON.parse(row.value), fetched_at: row.fetched_at });
        } catch (e) {
          resolve(null);
        }
      }
    );
  });
}

function putCache(key, items) {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO news_cache (key, value, fetched_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         fetched_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(items)],
      (err) => resolve(!err)
    );
  });
}

/* ============================================================
   抓取并解析 ThaiPBS 新闻页
   解析基于页面稳定的类名与链接结构：
     content-information-title    → 标题
     content-information-description → 导语
     href="/news/content/{id}"    → 原文链接
============================================================ */

function decodeEntities(s) {
  return (s || "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNewsPage(html) {
  // 同一篇文章可能在页面多处出现（如“最新列表”和“头条轮播”）。
  // 策略：扫全部 <article> 块，按 id 去重；后出现的块如果带导语，
  // 则补全该条目的导语（头部头条块才有导语）。
  const map = new Map();

  const chunks = html.split(/<article\b/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];

    // 原文 id：/news/content/510064
    const idMatch = chunk.match(/\/news\/content\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // 标题
    const titleMatch = chunk.match(/content-information-title[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "")) : "";
    if (!title) continue;

    // 导语（头条块才有，最新列表块为空）
    const descMatch = chunk.match(/content-information-description[^>]*>([\s\S]*?)<\/p>/);
    const desc = descMatch
      ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, ""))
      : "";

    // 发布时间（泰国时区 ISO）
    const timeMatch = chunk.match(/dateTime="([^"]+)"/);
    const pubAt = timeMatch ? timeMatch[1] : null;

    // 分类：页脚分类链接
    const catMatch = chunk.match(/href="\/news\/categories\/[^"]*"[^>]*>\s*([\s\S]*?)<\/a>/);
    const category = catMatch ? decodeEntities(catMatch[1].replace(/<[^>]+>/g, "")) : "ข่าว";

    const existing = map.get(id);
    if (existing) {
      // 已有条目：仅当新块带导语/发布时间时补全
      if (!existing.lede && desc) existing.lede = desc;
      if (!existing.pub_at && pubAt) existing.pub_at = pubAt;
      continue;
    }

    map.set(id, {
      id: `thaipbs-${id}`,
      source: "ThaiPBS",
      title,
      lede: desc,
      url: `https://www.thaipbs.or.th/news/content/${id}`,
      category,
      pub_at: pubAt,
    });
  }

  // 按发布时间倒序（最新在前），无时间排后面
  const items = [...map.values()].sort((a, b) => {
    if (!a.pub_at) return 1;
    if (!b.pub_at) return -1;
    return b.pub_at.localeCompare(a.pub_at);
  });

  return items.slice(0, 20);
}

/* ============================================================
   整篇正文：按需抓取单篇文章（news/content/{id}）
   解析 <article> 内 aside 摘要 + item-description 的 <p> 正文段落
   失败返回 null（调用方按原样返回，不阻塞）
============================================================ */

const ARTICLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 天

async function fetchArticlePage(id) {
  const url = `https://www.thaipbs.or.th/news/content/${id}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    hms(`抓取正文 ${id}...`);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "th-TH,th;q=0.9",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parseArticlePage(html, id, url);
  } catch (err) {
    hms(`抓取正文失败 ${id}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(htmlStr) {
  return (htmlStr || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseArticlePage(html, id, url) {
  // 文章主体在 <article> 标签内
  const artMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const block = artMatch ? artMatch[0] : html;

  // 标题：优先 h1，回退页面 <title>（去掉站点后缀）
  let title = "";
  const h1 = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) title = stripTags(h1[1]);
  if (!title) {
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (t) title = stripTags(t[1]).replace(/\s*\|\s*Thai PBS News.*$/i, "");
  }

  // 摘要（สรุปประเด็นสำคัญ）
  let summary = "";
  const aside = block.match(/<aside[\s\S]*?<\/aside>/i);
  if (aside) {
    const strong = aside[0].match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    if (strong) summary = stripTags(strong[1]);
  }

  // 正文段落：定位 item-description，取其后的 <p> 文本（跳过图片容器）
  let bodyHtml = "";
  const descIdx = block.indexOf('id="item-description"');
  if (descIdx >= 0) {
    bodyHtml = block.slice(descIdx);
  } else {
    bodyHtml = block;
  }
  const paragraphs = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(bodyHtml)) !== null) {
    const text = stripTags(m[1]).replace(/\s+/g, " ");
    if (text) paragraphs.push(text);
    if (paragraphs.length >= 40) break;
  }

  if (!title && !paragraphs.length) return null;
  return { id: String(id), url, title, summary, paragraphs };
}

function getArticleCache(id) {
  return new Promise((resolve) => {
    db.get(
      "SELECT value, fetched_at FROM news_articles WHERE id = ?",
      [String(id)],
      (err, row) => {
        if (err || !row) return resolve(null);
        try {
          resolve({ data: JSON.parse(row.value), fetched_at: row.fetched_at });
        } catch (e) {
          resolve(null);
        }
      }
    );
  });
}

function putArticleCache(id, data) {
  return new Promise((resolve) => {
    db.run(
      "INSERT OR REPLACE INTO news_articles (id, value, fetched_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [String(id), JSON.stringify(data)],
      (err) => resolve(!err)
    );
  });
}

/* ============================================================
   抓取：请求 → 解析；失败返回 null（由调用方决定回退）
============================================================ */

let inFlight = null;

async function fetchLatest() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      hms("抓取 ThaiPBS...");
      const res = await fetch(THAIPBS_NEWS_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "th-TH,th;q=0.9",
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const items = parseNewsPage(html);
      if (!items.length) throw new Error("解析结果为空");
      hms(`抓取成功：${items.length} 条`);
      return items;
    } catch (err) {
      hms(`抓取失败：${err.message}`);
      return null;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}

/* ============================================================
   翻译补全：缓存里的旧数据没有译文时补一次翻译并写回
   已翻译（带 zh_title 或 _translated 标记）直接返回；翻译失败保持原样
============================================================ */

async function ensureTranslated(items) {
  if (!Array.isArray(items) || !items.length) return items;
  if (items[0]._translated || items[0].zh_title) return items;
  const translated = await translateNewsBatch(items);
  if (translated && translated.some((it) => it.zh_title)) {
    return translated.map((it) => ({ ...it, _translated: true }));
  }
  return items;
}

/* ============================================================
   核心：返回当日新闻（缓存优先，必要时刷新）
============================================================ */

async function getDailyNews() {
  const key = thaiToday();

  // 1) 先读当天缓存
  const cached = await getCache(key);

  // 2) 已有当天缓存：有译文直接用；没有则补翻译并写回
  if (cached && cached.items.length) {
    if (cached.items[0].zh_title) {
      return { items: cached.items, cached: true, fetched_at: cached.fetched_at };
    }
    const translated = await ensureTranslated(cached.items);
    if (translated !== cached.items && translated[0].zh_title) {
      await putCache(key, translated);
    }
    return { items: translated, cached: true, fetched_at: cached.fetched_at };
  }

  // 3) 无当天缓存 → 尝试抓取；抓取成功翻译后写回缓存
  const items = await fetchLatest();
  if (items && items.length) {
    const translated = await ensureTranslated(items);
    await putCache(key, translated);
    return { items: translated, cached: false, fetched_at: new Date().toISOString() };
  }

  // 4) 抓取失败 → 回退到最近的任意缓存（含昨天）
  const fallback = await new Promise((resolve) => {
    db.all(
      "SELECT key, value, fetched_at FROM news_cache ORDER BY fetched_at DESC LIMIT 1",
      (err, rows) => {
        if (err || !rows || !rows.length) return resolve(null);
        try {
          resolve({ key: rows[0].key, items: JSON.parse(rows[0].value), fetched_at: rows[0].fetched_at });
        } catch (e) {
          resolve(null);
        }
      }
    );
  });

  if (fallback && fallback.items.length) {
    if (!fallback.items[0].zh_title) {
      const translated = await ensureTranslated(fallback.items);
      if (translated[0] && translated[0].zh_title) {
        return { items: translated, cached: true, stale: true, fetched_at: fallback.fetched_at };
      }
    }
    return { items: fallback.items, cached: true, stale: true, fetched_at: fallback.fetched_at };
  }

  return { items: [], error: "暂时无法获取今日新闻，请稍后再试" };
}

/* ============================================================
   翻译状态：供前端区分「未配置 / 失败 / 部分成功」
============================================================ */

function translationStatus(items) {
  const enabled = isTranslateEnabled();
  const list = Array.isArray(items) ? items : [];
  const translated = list.filter((it) => it.zh_title).length;
  const total = list.length;
  if (!enabled) return { enabled: false, ok: false, translated: 0, total };
  if (!total) return { enabled: true, ok: false, translated: 0, total };
  if (translated === total) return { enabled: true, ok: true, translated, total };
  if (translated > 0) return { enabled: true, ok: false, partial: true, translated, total };
  return { enabled: true, ok: false, translated: 0, total };
}

/* ============================================================
   GET /api/news/daily
============================================================ */

router.get("/news/daily", async (req, res) => {
  try {
    const data = await getDailyNews();
    const items = data.items || [];
    return res.json({
      date: thaiToday(),
      ...data,
      translation: translationStatus(items),
    });
  } catch (err) {
    console.error("获取每日新闻失败:", err);
    return res.status(500).json({ message: "获取每日新闻失败", items: [] });
  }
});

// 顺带提供「手动刷新」：POST /api/news/daily/refresh（可选，暂不接前端）
router.post("/news/daily/refresh", async (req, res) => {
  const key = thaiToday();
  const items = await fetchLatest();
  if (items && items.length) {
    await putCache(key, items);
    return res.json({ date: key, items, cached: false });
  }
  const cached = await getCache(key);
  if (cached && cached.items.length) {
    return res.json({ date: key, items: cached.items, cached: true, stale: true });
  }
  return res.status(502).json({ message: "刷新失败，请稍后再试", items: [] });
});

/* ============================================================
   新闻听力练习记录

   POST /api/news/listening/record   记录一次练习（填空 + 跟读分数）
   GET  /api/news/listening/stats    汇总统计（每日新闻数 / 正确率 / 跟读均分）

   数据存 news_listening_records 表，按泰国时区日期归档。
============================================================ */

router.post("/news/listening/record", authenticate, (req, res) => {
  const { newsId, newsTitle, clozeCorrect, clozeTotal, repeatScores } =
    req.body || {};

  const correct = Math.max(0, Math.round(Number(clozeCorrect) || 0));
  const total = Math.max(0, Math.round(Number(clozeTotal) || 0));
  const scores = Array.isArray(repeatScores)
    ? repeatScores
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const repeatAvg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  if (!newsId || (!total && !scores.length)) {
    return res.status(400).json({ message: "缺少练习数据" });
  }

  db.run(
    `INSERT INTO news_listening_records (
       user_id, date, news_id, news_title,
       cloze_correct, cloze_total, repeat_avg, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      req.userId,
      thaiToday(),
      String(newsId || "").slice(0, 120),
      String(newsTitle || "").slice(0, 200),
      correct,
      total,
      repeatAvg,
    ],
    (err) => {
      if (err) {
        console.error("保存新闻听力记录失败:", err);
        return res.status(500).json({ message: "保存练习记录失败" });
      }
      res.json({ ok: true });
    }
  );
});

router.get("/news/listening/stats", authenticate, (req, res) => {
  db.all(
    `SELECT id, date, news_id, news_title, cloze_correct, cloze_total, repeat_avg, created_at
     FROM news_listening_records
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("读取新闻听力统计失败:", err);
        return res.status(500).json({ message: "获取统计失败" });
      }

      const list = rows || [];
      const today = thaiToday();

      const newsSet = new Set();
      const todayNewsSet = new Set();
      let clozeCorrect = 0;
      let clozeTotal = 0;
      let repeatSum = 0;
      let repeatCount = 0;
      let todaySessions = 0;
      const dailyMap = new Map(); // date -> { sessions, news: Set }

      for (const r of list) {
        if (r.news_id) newsSet.add(r.news_id);
        if (r.date === today && r.news_id) todayNewsSet.add(r.news_id);
        if (r.date === today) todaySessions++;
        clozeCorrect += r.cloze_correct || 0;
        clozeTotal += r.cloze_total || 0;
        if (r.repeat_avg != null) {
          repeatSum += r.repeat_avg;
          repeatCount++;
        }

        if (!dailyMap.has(r.date)) {
          dailyMap.set(r.date, {
            sessions: 0,
            news: new Set(),
            clozeCorrect: 0,
            clozeTotal: 0,
          });
        }
        const d = dailyMap.get(r.date);
        d.sessions++;
        if (r.news_id) d.news.add(r.news_id);
        d.clozeCorrect += r.cloze_correct || 0;
        d.clozeTotal += r.cloze_total || 0;
      }

      const daily = [...dailyMap.entries()]
        .map(([date, v]) => ({
          date,
          sessions: v.sessions,
          newsCount: v.news.size,
          clozeCorrect: v.clozeCorrect,
          clozeTotal: v.clozeTotal,
          clozeAccuracy:
            v.clozeTotal > 0
              ? Math.round((v.clozeCorrect / v.clozeTotal) * 100)
              : 0,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14);

      res.json({
        totalNews: newsSet.size,
        totalSessions: list.length,
        todayNews: todayNewsSet.size,
        todaySessions,
        clozeAccuracy:
          clozeTotal > 0
            ? Math.round((clozeCorrect / clozeTotal) * 100)
            : 0,
        repeatAvg: repeatCount > 0 ? Math.round(repeatSum / repeatCount) : 0,
        daily,
        recent: list.slice(0, 8).map((r) => ({
          id: r.id,
          date: r.date,
          newsId: r.news_id,
          newsTitle: r.news_title || "",
          clozeCorrect: r.cloze_correct || 0,
          clozeTotal: r.cloze_total || 0,
          repeatAvg: r.repeat_avg,
          createdAt: r.created_at,
        })),
      });
    }
  );
});

/* ============================================================
   新闻听力练习配额

   GET /api/news/listening/quota    今日听音填空剩余题数（VIP 无限）
   POST /api/news/listening/consume 扣减 N 题（每答一题扣一题）
============================================================ */

router.get("/news/listening/quota", authenticate, async (req, res) => {
  try {
    res.json(await newsQuotaPayload(req.userId));
  } catch (err) {
    console.error("查询新闻听力配额失败:", err);
    res.status(500).json({ message: "查询配额失败" });
  }
});

router.post("/news/listening/consume", authenticate, async (req, res) => {
  try {
    const n = Math.max(1, Math.round(Number(req.body?.questions) || 1));
    const payload = await newsQuotaPayload(req.userId);

    // VIP 无限：不扣减，直接返回
    if (payload.isVip) {
      return res.json({ ...payload, ok: true, limitExceeded: false });
    }

    // 免费用户：超出每日上限时拒绝本次扣减
    if (payload.remainingToday < n) {
      /* 每日免费额度用尽提醒（同 key 去重：更新原通知而非堆积） */
      createNotification({
        userId: req.userId,
        type: "额度提醒",
        title: "今日新闻听力免费题数已用完",
        content: `今日免费听音填空 ${payload.freeQuestionDaily} 题已用完，开通 VIP 即可无限练习`,
        icon: "📰",
        action: "news-quota-exhausted",
        key: "news-quota-exhausted",
      });

      return res.status(429).json({
        message: `今日免费练习次数已用完（${payload.freeQuestionDaily} 题），开通 VIP 即可无限练习`,
        ...payload,
        ok: false,
        limitExceeded: true,
      });
    }

    await incrementNewsUsage(req.userId, n);
    const updated = await newsQuotaPayload(req.userId);
    res.json({ ...updated, ok: true, limitExceeded: false });
  } catch (err) {
    console.error("扣减新闻听力配额失败:", err);
    res.status(500).json({ message: "扣减配额失败" });
  }
});

// ============================================================
// 服务运行期间定时刷新当天缓存（每 4 小时），实现「每日更新」
// ============================================================

setInterval(async () => {
  try {
    const key = thaiToday();
    // 只在没有当天缓存时主动抓，已有缓存靠懒刷新
    const cached = await getCache(key);
    if (!cached || !cached.items.length) {
      const items = await fetchLatest();
      if (items && items.length) {
        const translated = await ensureTranslated(items);
        await putCache(key, translated);
        hms("定时刷新完成");
      }
    }
  } catch (e) {
    hms(`定时刷新异常：${e.message}`);
  }
}, 4 * 3600 * 1000);

export default router;

// ============================================================
// CLI 自检模式（部署服务器上验证连通性用）
//
//   node backend/routes/news.js --self-test
//
// 直接跑这一段：真实请求 thaipbs.or.th → 解析 → 打印前 5 条。
// 不依赖 Express 服务启动，也不写数据库，适合部署后第一时间验证。
// ============================================================

export { parseNewsPage, fetchLatest };

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain && process.argv.includes("--self-test")) {
  const runSelfTest = async () => {
    console.log("=== ThaiPBS 抓取自检 ===");
    console.log("目标:", THAIPBS_NEWS_URL);
    console.log("开始时间:", new Date().toISOString());
    const t0 = Date.now();
    const items = await fetchLatest();
    const ms = Date.now() - t0;
    if (items && items.length) {
      console.log(`✅ 抓取成功：${items.length} 条，耗时 ${ms}ms`);
      for (const it of items.slice(0, 5)) {
        console.log(`  - [${it.category}] ${it.title}`);
        if (it.lede) console.log(`      ${it.lede.slice(0, 80)}`);
      }
      process.exit(0);
    } else {
      console.log("❌ 抓取失败：无法从 thaipbs.or.th 获取新闻");
      console.log("   可能原因：服务器网络无法访问该站点 / DNS 解析失败 / HTTPS 证书 / 源站变更");
      process.exit(1);
    }
  };
  runSelfTest();
}


/* ============================================================
   整篇阅读：GET /api/news/article?id={id}
   - 缓存优先（news_articles 表，1 天 TTL）
   - 未缓存 → 按需抓取正文 + DeepSeek 整篇翻译（中文 + 罗马音）后写缓存
   - 缓存有正文但无译文 → 补翻译后写回
   - 抓取/翻译失败 → 返回已有数据或错误信息，不抛 500
============================================================ */

router.get("/news/article", async (req, res) => {
  const rawId = String(req.query.id || "").trim();
  // 兼容 "thaipbs-510066" / "510066" 两种 id
  const id = rawId.replace(/^thaipbs-/i, "").trim();
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "无效的新闻 ID" });
  }

  // 1) 缓存优先
  const cached = await getArticleCache(id);
  const cacheValid =
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < ARTICLE_CACHE_TTL_MS;
  if (cached && cacheValid && cached.data.paragraphs?.length) {
    // 已翻译直接返回
    if (cached.data.zh && cached.data.zh.some((t) => t)) {
      return res.json({ ...cached.data, cached: true, fetched_at: cached.fetched_at });
    }
    // 有正文无译文 → 补翻译
    const translated = await translateArticleBody(cached.data.paragraphs);
    if (translated) {
      cached.data.zh = translated.zh;
      cached.data.roman = translated.roman;
      await putArticleCache(id, cached.data);
    }
    return res.json({ ...cached.data, cached: true, fetched_at: cached.fetched_at });
  }

  // 2) 按需抓取
  const article = await fetchArticlePage(id);
  if (!article) {
    // 抓取失败：若有过期缓存仍可兜底展示
    if (cached && cached.data.paragraphs?.length) {
      return res.json({ ...cached.data, cached: true, fetched_at: cached.fetched_at, stale: true });
    }
    return res.status(502).json({ error: "暂时无法抓取该文章，请稍后重试" });
  }

  // 3) 整篇翻译（失败不影响展示，前端显示暂无译文）
  const translated = await translateArticleBody(article.paragraphs);
  if (translated) {
    article.zh = translated.zh;
    article.roman = translated.roman;
  } else {
    article.zh = [];
    article.roman = [];
  }
  await putArticleCache(id, article);
  return res.json({ ...article, cached: false, fetched_at: new Date().toISOString() });
});
