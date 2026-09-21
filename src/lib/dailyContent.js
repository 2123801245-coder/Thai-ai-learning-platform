// src/lib/dailyContent.js
//
// =========================================================
// 今日一句泰语 / 泰语小知识 —— 按人挑选的唯一出口
// =========================================================
//
// 改动前：两块内容都只按「今天几号」取模选一条 —— 所有用户（A0 零基础和
// C1 老手、准备商务谈判的和追泰剧的）看到的是同一条。
//
// 现在：内容池每条都带 level + topics（见 src/data/dailyContent.js），
// 这里负责把「画像」翻译成选择：
//
//   1. 等级收敛：只在「用户等级 ±1」这一段里选。
//      A0 学员不会拿到隐喻诗，B2 学员不会被喂「ครับ / ค่ะ」这类入门条目。
//   2. 兴趣加权：学习目标 / 专业方向 / 兴趣媒体 命中的标签加分，
//      商务、留学、泰剧、新闻这些目标向内容会优先浮上来。
//   3. 当天稳定：同一个人同一天刷新结果不变（hash(userId + 日期)），
//      跨天自动换；最近 3 天看过的不会立刻重复。
//   4. 无画像不惩罚：没做入学测试就退回「最常用短句 + 基础知识点」，
//      并提示可以去做测试定制。
//
// 选中后会带回一句「为什么给你看这条」（reason），与首页其他卡片一致。

import { useCallback, useEffect, useMemo, useState } from "react";

import { DAILY_SENTENCES, THAI_TIPS } from "@/data/dailyContent";

export const DAILY_CONTENT_KEY = "thai_ai_daily_content_v1";
export const DAILY_CONTENT_CHANGE_EVENT = "thai-ai-daily-content-change";

export const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1"];

/* =========================================================
   画像 → 兴趣标签（按选项 id 映射，标题改文案也不受影响）
========================================================= */

const GOAL_TOPICS = {
  major: ["留学", "文化"],
  travel: ["旅行", "美食"],
  business: ["商务"],
  study: ["留学", "文化"],
  drama: ["泰剧"],
  music: ["音乐"],
  culture: ["文化", "旅行"],
};

const DIRECTION_TOPICS = {
  business: ["商务"],
  academic: ["留学"],
  tourism: ["旅行", "美食"],
  news: ["新闻"],
  newmedia: ["泰剧", "新闻"],
};

const MEDIA_TOPICS = {
  drama: ["泰剧"],
  movie: ["泰剧"],
  song: ["音乐"],
  variety: ["泰剧"],
  news: ["新闻"],
  tiktok: ["泰剧", "音乐"],
  novel: ["文化"],
  food: ["美食"],
  travel: ["旅行"],
};

/* =========================================================
   基础工具
========================================================= */

export function normalizeLevel(level) {
  const value = String(level || "").trim().toUpperCase();
  return LEVEL_ORDER.includes(value) ? value : "A1";
}

const levelIndex = (level) => LEVEL_ORDER.indexOf(normalizeLevel(level));

/** 允许出现的等级区间：用户等级 ±spread（默认 ±1，A0 不会碰到 A2 及以上） */
export function levelBand(level, spread = 1) {
  const index = levelIndex(level);
  return LEVEL_ORDER.filter((_, i) => Math.abs(i - index) <= spread);
}

export function hasPlacement(profile) {
  return Boolean(profile && profile.thaiLevel);
}

/** 画像 → 兴趣标签（去重、保序） */
export function profileTopics(profile) {
  if (!profile) return [];

  const topics = [];
  const push = (list) => {
    for (const topic of list || []) {
      if (!topics.includes(topic)) topics.push(topic);
    }
  };

  push(GOAL_TOPICS[profile.learningGoal]);

  for (const id of profile.professionalDirection || []) {
    push(DIRECTION_TOPICS[id]);
  }

  for (const id of profile.mediaInterest || []) {
    push(MEDIA_TOPICS[id]);
  }

  return topics;
}

export function matchedTopics(item, topics = []) {
  return (item?.topics || []).filter((topic) => topics.includes(topic));
}

/* =========================================================
   打分
========================================================= */

const MAX_TOPIC_BONUS = 6;

/**
 * 打分：兴趣优先于「等级刚好卡在同级」——
 * 追泰剧的 A2 学员应该拿到 A1 的追剧短句，而不是一条恰好同级的通用诗。
 *
 *   spread  允许的等级跨度（1 = ±1 级），超出范围的直接剔除
 *   等级    同级 +3 / 相邻 ±1 级 +1
 *   兴趣    每个命中标签 +3，最多 +6
 */
export function scoreContent(item, { level, topics = [], spread = 1 } = {}) {
  const itemLevel = normalizeLevel(item?.level);
  const distance = Math.abs(levelIndex(itemLevel) - levelIndex(level));

  if (distance > spread) return -1;

  let score = distance === 0 ? 3 : distance === 1 ? 1 : 0;

  score += Math.min(matchedTopics(item, topics).length * 3, MAX_TOPIC_BONUS);

  // 完全没有画像标签时，基础向内容优先（最常用的短句与入门知识点）
  if (!topics.length && (item?.topics || []).includes("基础")) score += 1;

  return score;
}

/* =========================================================
   当天稳定 + 不重复
========================================================= */

export function todayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 稳定 hash：同 userId + 日期 + 类别 → 同一个数 */
function hashKey(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * 选内容：
 *  1. 先按分数排序（等级贴合 + 兴趣命中）
 *  2. 取「接近最优」的一段作为候选池（最优分 −1，且至少 3 条）
 *  3. 用 hash(user + 日期) 在池里挑，最近 3 天看过的往后顺延
 */
export function pickForDay(
  items,
  { level, topics = [], dateKey, seed = "", recentIds = [] } = {}
) {
  if (!Array.isArray(items) || !items.length) return null;

  const sortByScore = (a, b) =>
    b.score - a.score || String(a.item.id).localeCompare(String(b.item.id));

  const scoreAt = (spread) =>
    items
      .map((item) => ({ item, score: scoreContent(item, { level, topics, spread }) }))
      .filter((entry) => entry.score >= 0)
      .sort(sortByScore);

  // 等级跨度逐步放宽：±1 → ±2 → ±3。
  // 内容池不可能对每个等级都刚好有料（比如 C1 的条目天然最少），
  // 与其退回「全池随机」把 A0 条目塞给高手，不如先只放宽等级。
  let scored = [];
  let usedSpread = 1;
  for (const spread of [1, 2, 3]) {
    scored = scoreAt(spread);
    usedSpread = spread;
    if (scored.length >= 3) break;
  }

  if (!scored.length) {
    const index = hashKey(`${seed}|${dateKey}`) % items.length;
    return { item: items[index], pool: items, score: 0, spread: usedSpread };
  }

  const best = scored[0].score;

  // 最高分那一档：当天就从这一档里选。
  // 不能因为「这一档只有 1 条」就把低分内容也放进来当候选，
  // 否则精准命中的那条（比如 A0+旅行 的「不要辣」）会被随机顶掉。
  const topPool = scored.filter((entry) => entry.score === best).map((e) => e.item);

  const tier = (margin) =>
    scored.filter((entry) => entry.score >= best - margin).map((e) => e.item);

  // 当天可选的那一档。
  //
  // 以前只看「最优分」那批，直接后果是：内容池即使有 15 条，
  // 某个等级当天能轮到的往往只有 5 条（同等级 + 同兴趣就这么多），
  // 3 天去重窗口一满就开始重复。
  //
  // 现在改成：最优档 ≥ MIN_DAY_POOL 条就用它（精准贴合不动）；
  // 不够时放宽到 tier(2) —— 这一档包含的是
  //   「同级 + 兴趣」(最优) 与「相邻级 + 兴趣」(次优)，
  // 仍然把「同级但没命中兴趣」的通用条目排除在外，
  // 也就是说：加大的是兴趣内容的轮换空间，不是拿通用内容充数。
  const MIN_DAY_POOL = 6;
  let dayPool = topPool.length >= MIN_DAY_POOL ? topPool : tier(2);
  for (const item of topPool) if (!dayPool.includes(item)) dayPool.push(item);

  // 手动「换一条」用的候选池：可以放宽到次优，保证有得换
  let pool = tier(1);
  if (pool.length < 4) pool = tier(2);
  if (pool.length < 4) pool = tier(3);
  if (pool.length < 4) pool = scored.map((entry) => entry.item);
  for (const item of topPool) if (!pool.includes(item)) pool.push(item);
  // 「换一条」要能翻到当天档位里的每一条，否则会出现「换不动」
  for (const item of dayPool) if (!pool.includes(item)) pool.push(item);

  const recent = recentIds.slice(0, 3);

  const pickFrom = (list) => {
    const start = hashKey(`${seed}|${dateKey}|${list.length}`) % list.length;
    for (let step = 0; step < list.length; step++) {
      const candidate = list[(start + step) % list.length];
      if (!recent.includes(candidate.id)) return candidate;
    }
    return list[start];
  };

  // 这一档里最近都看过了 → 退到宽松候选池，保证每天不重复
  const picked = pickFrom(
    dayPool.some((i) => !recent.includes(i.id)) ? dayPool : pool
  );

  return { item: picked, pool, dayPool, topPool, score: best, spread: usedSpread };
}

/* =========================================================
   记忆：最近看过什么（避免连着几天重复）
========================================================= */

function readMemory() {
  try {
    const raw = localStorage.getItem(DAILY_CONTENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMemory(memory) {
  try {
    localStorage.setItem(DAILY_CONTENT_KEY, JSON.stringify(memory));
    window.dispatchEvent(new CustomEvent(DAILY_CONTENT_CHANGE_EVENT));
  } catch {
    /* 忽略无痕模式等写入失败 */
  }
}

const recentIds = (memory, kind) => {
  const ids = memory?.[kind]?.ids;
  return Array.isArray(ids) ? ids.slice(0, 3) : [];
};

function rememberShown(memory, kind, ids, dateKey) {
  const previous = memory?.[kind]?.ids || [];
  const merged = [...new Set([...ids, ...previous])].slice(0, 5);
  return { ...memory, [kind]: { ids: merged, date: dateKey } };
}

/**
 * 记录「今天给这个人看了哪两条」。
 * 由 Hook 在渲染后调用（selectDaily 本身保持无副作用，方便测试与预渲染）。
 */
export function rememberPick(dateKey, { sentenceId, tipId } = {}) {
  const memory = readMemory();
  let next = memory;

  if (sentenceId && memory?.sentence?.date !== dateKey) {
    next = rememberShown(next, "sentence", [sentenceId], dateKey);
  }
  if (tipId && memory?.tip?.date !== dateKey) {
    next = rememberShown(next, "tip", [tipId], dateKey);
  }

  if (next !== memory) writeMemory(next);
  return next;
}

/* =========================================================
   「为什么给你看这条」
========================================================= */

function describePick(kind, { level, topics = [], matched = [], personalized }) {
  if (!personalized) {
    return kind === "sentence"
      ? "A0~A2 起步向短句 · 做完入学测试可定制"
      : "按 A1 起步难度挑选 · 做完入学测试可定制";
  }

  const hit = matched.slice(0, 2);
  return `按你的 ${level} 等级${hit.length ? ` · ${hit.join(" · ")}` : ""}挑选`;
}

/* =========================================================
   组合出首页要用的两块内容
========================================================= */

export function selectDaily(profile, { date = new Date(), seed = "" } = {}) {
  const placementDone = hasPlacement(profile);
  const level = placementDone ? normalizeLevel(profile?.thaiLevel) : "A1";
  const topics = profileTopics(profile);
  const personalized = placementDone && topics.length > 0;
  const dateKey = todayKey(date);
  const memory = readMemory();
  const userSeed = seed || profile?.userId || profile?.id || "guest";

  const sentencePick = pickForDay(DAILY_SENTENCES, {
    level,
    topics,
    dateKey,
    seed: `sentence|${userSeed}`,
    recentIds: recentIds(memory, "sentence"),
  });

  const tipPick = pickForDay(THAI_TIPS, {
    level,
    topics,
    dateKey,
    seed: `tip|${userSeed}`,
    recentIds: recentIds(memory, "tip"),
  });

  return {
    level,
    topics,
    personalized,
    dateKey,
    sentence: sentencePick?.item || null,
    tip: tipPick?.item || null,
    pools: {
      sentence: sentencePick?.pool || DAILY_SENTENCES,
      tip: tipPick?.pool || THAI_TIPS,
    },
    reason: {
      sentence: describePick("sentence", {
        level,
        topics,
        matched: matchedTopics(sentencePick?.item, topics),
        personalized,
      }),
      tip: describePick("tip", {
        level,
        topics,
        matched: matchedTopics(tipPick?.item, topics),
        personalized,
      }),
    },
  };
}

/** 手动换一条：在候选池里往下一格，并把接下来几条记进「最近看过」 */
export function nextInPool(kind, current, { pool, level, topics, dateKey }) {
  const catalog = kind === "sentence" ? DAILY_SENTENCES : THAI_TIPS;
  const list = pool?.length ? pool : catalog;
  const index = list.findIndex((item) => item.id === current?.id);
  const next = list[(index + 1 + list.length) % list.length];

  const upcoming = [];
  for (let i = 0; i < Math.min(3, list.length); i++) {
    upcoming.push(list[(index + 1 + i + list.length) % list.length].id);
  }
  writeMemory(rememberShown(readMemory(), kind, upcoming, dateKey));

  return {
    item: next,
    reason: describePick(kind, {
      level,
      topics,
      matched: matchedTopics(next, topics),
      personalized: topics.length > 0,
    }),
  };
}

/* =========================================================
   React Hook
========================================================= */

export function useDailyContent(profile) {
  const base = useMemo(
    () => selectDaily(profile, { date: new Date() }),
    // 画像变化时重算（跨天刷新页面自然重算）
    [profile]
  );

  const [overrides, setOverrides] = useState({});

  // 画像或日期变了 → 清掉手动切换的覆盖
  useEffect(() => {
    setOverrides({});
  }, [profile, base.dateKey]);

  // 首屏把当天两条记进「最近看过」，明天不会再重复
  useEffect(() => {
    if (!base.sentence || !base.tip) return;

    rememberPick(base.dateKey, {
      sentenceId: base.sentence.id,
      tipId: base.tip.id,
    });
  }, [base.sentence?.id, base.tip?.id, base.dateKey]);

  const reroll = useCallback(
    (kind = "tip") => {
      const current =
        overrides[kind]?.item || (kind === "sentence" ? base.sentence : base.tip);
      const pool =
        kind === "sentence" ? base.pools.sentence : base.pools.tip;

      const picked = nextInPool(kind, current, {
        pool,
        level: base.level,
        topics: base.topics,
        dateKey: base.dateKey,
      });

      setOverrides((prev) => ({ ...prev, [kind]: picked }));
    },
    [base, overrides]
  );

  return {
    ...base,
    sentence: overrides.sentence?.item || base.sentence,
    tip: overrides.tip?.item || base.tip,
    reason: {
      sentence: overrides.sentence?.reason || base.reason.sentence,
      tip: overrides.tip?.reason || base.reason.tip,
    },
    reroll,
  };
}
