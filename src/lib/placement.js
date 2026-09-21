// src/lib/placement.js
//
// =========================================================
// AI 入学测试：判分 → 等级 → 画像 → 个性化学习路线
// =========================================================
//
// 一、判分：18 题按难度带加权（A1=1 / A2=2 / B1=3 / B2=4 / C1=5，满分 43）
//     得到 percent 后按阈值映射 CEFR 等级；
//     另外加一道「文字关」：字母 + 元音辅音 + 声调 三块答对太少时，
//     即使百分比够也向下封顶（不懂拼读就不可能真到 B1，避免虚高）。
//
// 二、画像：等级 + 学习目标 + 专业方向 + 兴趣媒体 + 学习方式
//     → 目标场景（target_scenario，由目标与方向推导，用户不必额外答卷）
//
// 三、学习路线：由画像生成 4 阶段路线 + 每日任务 + 推荐词书 + 补强板块，
//     全部落到项目已有路由（/alphabet /course/thai-basic-reader /vocabulary
//     /loop /conversation /corpus/listening /speaking-practice …）。
// =========================================================

import {
  CAN_DO_STATEMENTS,
  LEARNING_GOALS,
  LEARNING_STYLES,
  MEDIA_INTERESTS,
  PLACEMENT_ADAPTIVE,
  PLACEMENT_BANDS,
  PLACEMENT_BAND_WEIGHT,
  PLACEMENT_QUESTIONS,
  PLACEMENT_SECTIONS,
  PROFESSIONAL_DIRECTIONS,
} from "@/data/placementTest";
import { getVocabBooks } from "@/lib/wordBooks";

/* =========================================================
   难度带权重与满分
========================================================= */

const BAND_WEIGHT = PLACEMENT_BAND_WEIGHT;

/* 题库全量满分（自适应只抽其中一部分，实际满分见 scorePlacement().maxScore） */
export const PLACEMENT_MAX_SCORE = PLACEMENT_QUESTIONS.reduce(
  (sum, question) => sum + (BAND_WEIGHT[question.band] || 1),
  0
);

/* 一次自适应测验的题量区间 */
export const PLACEMENT_MIN_QUESTIONS = PLACEMENT_ADAPTIVE.min;
export const PLACEMENT_MAX_QUESTIONS = PLACEMENT_ADAPTIVE.max;

/* =========================================================
   CEFR 等级元信息（A0 → C1）
========================================================= */

export const LEVELS = [
  {
    id: "A0",
    title: "零基础起步",
    subtitle: "还不会读泰文",
    desc: "从字母与声调开始，先把「看得懂、读得准」立起来。",
    weeks: "约 2 周进入 A1",
    wordsPerDay: 8,
    minutesPerDay: 15,
    focus: "字母识别与拼读规则",
  },
  {
    id: "A1",
    title: "入门级",
    subtitle: "能认读常见字母与词",
    desc: "能读简单单词和短句，会打招呼、报数字、说感谢。",
    weeks: "约 4 周进入 A2",
    wordsPerDay: 12,
    minutesPerDay: 20,
    focus: "拼读准确性 + 高频生活词",
  },
  {
    id: "A2",
    title: "基础级",
    subtitle: "能应付日常交流",
    desc: "买菜、点餐、问路、看病等日常场景能听懂并回应。",
    weeks: "约 6 周进入 B1",
    wordsPerDay: 18,
    minutesPerDay: 25,
    focus: "句型组块 + 场景会话",
  },
  {
    id: "B1",
    title: "进阶级",
    subtitle: "能聊完整话题",
    desc: "能描述经历、表达观点，看懂课文与短新闻的主干。",
    weeks: "约 8 周进入 B2",
    wordsPerDay: 25,
    minutesPerDay: 35,
    focus: "长句结构 + 听力耐受力",
  },
  {
    id: "B2",
    title: "高阶级",
    subtitle: "接近真实语速",
    desc: "能跟上正常语速的剧集与播报，能就专业话题讨论。",
    weeks: "约 10 周进入 C1",
    wordsPerDay: 30,
    minutesPerDay: 40,
    focus: "地道表达 + 速读速听",
  },
  {
    id: "C1",
    title: "精通级",
    subtitle: "可自如使用泰语",
    desc: "能处理抽象与专业内容，理解言外之意与文体差异。",
    weeks: "长期精进",
    wordsPerDay: 30,
    minutesPerDay: 45,
    focus: "文体语感 + 输出打磨",
  },
];

export const getLevelMeta = (levelId) =>
  LEVELS.find((level) => level.id === levelId) || LEVELS[0];

/* =========================================================
   等级阈值（百分比下限）
========================================================= */

const LEVEL_THRESHOLDS = [
  { level: "C1", min: 89 },
  { level: "B2", min: 75 },
  { level: "B1", min: 56 },
  { level: "A2", min: 38 },
  { level: "A1", min: 20 },
  { level: "A0", min: 0 },
];

const LEVEL_ORDER = LEVELS.map((level) => level.id);

/* 取两者中更低的等级（封顶用） */
const levelLowerOf = (a, b) =>
  LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;

/* =========================================================
   一、自适应出题引擎
   ---------------------------------------------------------
   旧版是「固定 18 题、按顺序从 A1 做到 C1」。问题有两个：
     ① 已经会泰语的人也要先答 6 道字母题，浪费时间且体验差；
     ② 初学者答不到后面就会一路错，测不出"他到底会到哪"，
        而百分比又被后面没答的题拉低 —— 等级必然虚低。

   现在按**分层的自适应**选题（stratified adaptive）：
     • 从 startBand（A2）开始；
     • 答对 → 难度带 +1；答错 → 难度带 −1；
     • 该难度带没题了（或同板块已出太多），就在相邻带里找替代；
     • 达到最少题数且难度带不再波动，或到上限题数 → 结束。

   题库不足时（例如浏览器没有泰语语音，听力题被禁用）会自然退化为
   固定流程，不会卡住 —— 因为"找不到题"就结束。
========================================================= */

/** 本次测验可用的题（听力题依赖泰语语音，没有语音就整体排除） */
export function availablePlacementQuestions({ withListening = true } = {}) {
  if (withListening) return PLACEMENT_QUESTIONS;
  return PLACEMENT_QUESTIONS.filter((item) => item.modality !== "listening");
}

const bandIndex = (band) => {
  const index = PLACEMENT_BANDS.indexOf(band);
  return index < 0 ? 1 : index;
};

const clampBand = (index) =>
  PLACEMENT_BANDS[Math.max(0, Math.min(PLACEMENT_BANDS.length - 1, index))];

/* 同一板块出题的**软**上限：避免整场测验退化成「只考声调」。
   软 = 只用于相邻带兜底，绝不阻断目标带的出题（见 nextPlacementQuestion）。 */
const SECTION_LIMIT = 3;

/* 听力题至少出这么多道，否则听力维度样本不足、不该参与封顶 */
const LISTENING_QUOTA = 2;

/* 自适应阶梯的初始步长（带）：从 A2 起步，一上来给 A2/B1 的题 */
const INITIAL_STEP = 1;

/**
 * 自适应会话的初始状态。UI 只需把它存进 useState，其余交给下面的两个函数。
 *
 * 为什么需要 state 而不只是"当前带"：
 *   朴素阶梯（对→+1，错→−1）会在真实水平附近**永久振荡**（…B1 A2 B1 A2…），
 *   既不知道该停，也难以判分。所以这里用标准做法：**步长减半**——
 *   每次方向反转就把步长折半，步长降到 0 时估计已收敛，可以收卷。
 */
export function createAdaptiveState() {
  return {
    band: PLACEMENT_ADAPTIVE.startBand,
    step: INITIAL_STEP,
    lastDirection: 0, // +1 上次答对升带 / -1 上次答错降带 / 0 尚未作答
    maxBandReached: PLACEMENT_ADAPTIVE.startBand,
    reversals: 0,
  };
}

/**
 * 一次作答后推进自适应状态。
 *
 * @param {object} state  createAdaptiveState() 的返回值
 * @param {boolean} isCorrect
 */
export function advanceAdaptiveState(state, isCorrect) {
  const current = state || createAdaptiveState();
  const direction = isCorrect ? 1 : -1;

  let step = current.step || INITIAL_STEP;
  let reversals = current.reversals || 0;

  /* 方向反转（在某个难度带上下折返）→ 步长减半、记账一次 */
  if (current.lastDirection && direction !== current.lastDirection) {
    step = Math.max(0, Math.floor(step / 2));
    reversals += 1;
  }

  const nextIndex = clampBand(
    bandIndex(current.band) + direction * Math.max(step, 1)
  );

  return {
    band: nextIndex,
    step,
    lastDirection: direction,
    maxBandReached:
      bandIndex(nextIndex) > bandIndex(current.maxBandReached)
        ? nextIndex
        : current.maxBandReached,
    reversals,
  };
}

/** 估计是否已收敛：步长折半到 0（即已经在同一带折返过）*/
export function isAdaptiveConverged(state) {
  return Boolean(state) && (state.step || 0) <= 0;
}

/**
 * 挑下一题。
 *
 * 结束规则（按顺序）：
 *   ① 到上限题数 → 停
 *   ② 题库出完 / 带内题目都达板块上限 → 停
 *   ③ 达到最少题数，且估计已收敛（步长折半到 0）→ 停
 *
 * @param {object} state
 *   answers     { [questionId]: optionIndex } 已作答
 *   askedIds    string[]                      已出过的题（含当前未作答的那题）
 *   adaptive    createAdaptiveState() 的结果（取其中的 band 作为出题难度）
 *   pool        question[]                    availablePlacementQuestions() 的结果
 * @returns {question|null} null = 结束
 */
export function nextPlacementQuestion({
  answers = {},
  askedIds = [],
  adaptive = null,
  band = null,
  pool = PLACEMENT_QUESTIONS,
} = {}) {
  const answeredCount = Object.keys(answers).length;
  const asked = new Set(askedIds);

  if (answeredCount >= PLACEMENT_ADAPTIVE.max) return null;

  const sectionCount = {};
  pool.forEach((item) => {
    if (!asked.has(item.id)) return;
    sectionCount[item.section] = (sectionCount[item.section] || 0) + 1;
  });

  /* 取某难度带的一道题。respectLimit=false 时忽略板块上限（软限制）。 */
  const pickAt = (index, respectLimit = true) =>
    index < 0 || index >= PLACEMENT_BANDS.length
      ? null
      : pool.find(
          (item) =>
            item.band === PLACEMENT_BANDS[index] &&
            !asked.has(item.id) &&
            (!respectLimit || (sectionCount[item.section] || 0) < SECTION_LIMIT)
        ) || null;

  /* 目标难度带的下标。
     bandIndex 对未知输入返回兜底的 1（A2），而 clampBand 返回的是**带名**——
     两者混用会让下标退化成 0（A1），所有人从 A1 开始答题。这里只走一条路：
     先把带名规范化，再取下标。 */
  const targetBand = clampBand(
    bandIndex(adaptive?.band || band || PLACEMENT_ADAPTIVE.startBand)
  );
  const target = Math.max(0, PLACEMENT_BANDS.indexOf(targetBand));

  /* ③ 收敛即收卷（但至少答满最少题数） */
  if (answeredCount >= PLACEMENT_ADAPTIVE.min && isAdaptiveConverged(adaptive)) {
    return null;
  }

  /* ── 听力配额：听力是判级的独立关卡，必须有足够样本 ──
     题库顺序会让 letters / vowels 这类板块被优先抽到，听力题目可能整场只出 1 题，
     而 scorePlacement 又用听力正确率封顶 —— 样本太少就封顶是不公平的。
     所以：只要听力还没问够 2 题，且目标带还有听力题，就先出听力题。 */
  const listeningAsked = sectionCount.listening || 0;
  const listeningQuotaMet = listeningAsked >= LISTENING_QUOTA;

  if (!listeningQuotaMet) {
    const listeningHit = pool.find(
      (item) =>
        item.section === "listening" &&
        item.band === PLACEMENT_BANDS[target] &&
        !asked.has(item.id)
    );
    if (listeningHit) return listeningHit;
  }

  /* 目标带优先，且**允许突破板块上限**。
     --------------------------------
     板块上限是"软"的，只用来让测验别退化成只考一个板块（保证成绩单上的
     能力分布有意义）。它绝不能挡住出题：早先它是硬上限，又按整场测验计数，
     于是高阶学习者把 letters / tones / listening / vocab 各用满 3 题之后，
     这些板块在高难度带的题一并被锁死 —— 引擎找不到目标带的题，
     只能一路向下取 A2 题，最终把人判成 A2。
     现在：目标带有题就一定出（哪怕某板块已问过 3 次）；只有目标带彻底没题，
     才退到相邻带，并在那里重新遵守软上限。 */
  const exact = pickAt(target, false);
  if (exact) return exact;

  /* 目标带没题了：向两侧交替取最近的可用题（这里恢复软上限） */
  for (let offset = 1; offset < PLACEMENT_BANDS.length; offset += 1) {
    const candidates = [target - offset, target + offset];
    for (const index of candidates) {
      const hit = pickAt(index);
      if (hit) return hit;
    }
  }

  /* ② 全库出完 */
  return null;
}

/**
 * 一步阶梯（保留给简单场景 / 测试用）。
 * 正式流程请用 advanceAdaptiveState —— 它带回步长减半，能收敛。
 */
export function nextBand(currentBand, isCorrect) {
  const delta = isCorrect ? 1 : -1;
  return clampBand(bandIndex(currentBand) + delta);
}

/** 自适应进度：给进度条用（题目数是浮动的，所以按 max 估算） */
export function adaptiveProgress(answeredCount) {
  return Math.min(
    100,
    Math.round((answeredCount / PLACEMENT_ADAPTIVE.max) * 100)
  );
}

/* =========================================================
   二、判分
   ---------------------------------------------------------
   answers: { [questionId]: optionIndex }（只包含本次真正出过的题）

   与旧版的区别：
     • 满分按**本次出过的题**累加（自适应题量浮动，用全库满分算百分比会失真）；
     • 原始等级由「作答难度带曲线」推导，而不是简单的百分比阈值 ——
       自适应下"答对了几道高难度的题"比"总分百分比"更能说明水平；
     • 听力单独成关：听力太弱时封顶（泰语是声调语言，听不懂等于用不了）；
     • 支持 CEFR 自评（Can-Do）校准，并在证据冲突时下调等级、标注理由。
========================================================= */

export function scorePlacement(answers = {}, options = {}) {
  const { canDo = [], withListening = true } = options;

  const bandScores = {};
  const sectionScores = {};

  let score = 0;
  let maxScore = 0;
  let correct = 0;

  /* 只统计本次出过的题：answers 的键就是题号 */
  const askedQuestions = PLACEMENT_QUESTIONS.filter(
    (question) => answers[question.id] !== undefined
  );

  /* 防御：完全没有作答记录时，退化为"全库都没答"（百分比 0） */
  const questions = askedQuestions;

  questions.forEach((question) => {
    const picked = answers[question.id];
    const isCorrect = picked === question.answer;
    const weight = BAND_WEIGHT[question.band] || 1;

    maxScore += weight;

    if (!bandScores[question.band]) {
      bandScores[question.band] = { correct: 0, total: 0, rate: 0 };
    }
    bandScores[question.band].total += 1;

    if (!sectionScores[question.section]) {
      sectionScores[question.section] = { correct: 0, total: 0, rate: 0 };
    }
    sectionScores[question.section].total += 1;

    if (isCorrect) {
      correct += 1;
      score += weight;
      bandScores[question.band].correct += 1;
      sectionScores[question.section].correct += 1;
    }
  });

  Object.values(bandScores).forEach((item) => {
    item.rate = item.total ? item.correct / item.total : 0;
  });
  Object.values(sectionScores).forEach((item) => {
    item.rate = item.total ? item.correct / item.total : 0;
  });

  const total = questions.length;
  const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;

  /* ── 原始等级：以「答对过的最高难度带」为基准 ──
     自适应测验每个带只会出 1~3 题，用「正确率 ≥ 50%」当门槛会抖得很厉害
     （带里只有 1 题时，答错一次就整带不算）。改用更稳的判据：

       基准 = 答对过题的**最高难度带**；
       若该带正确率 < 0.5（答对得很少，可能是蒙的）→ 降一带；
       若该带正确率 = 1 且再高一带有答对 → 升一带（说明天花板还没测到）。 */
  const hitBands = PLACEMENT_BANDS.filter((band) => bandScores[band]?.total > 0);

  let rawLevel = "A0";

  const correctBands = PLACEMENT_BANDS.filter(
    (band) => (bandScores[band]?.correct || 0) > 0
  );

  if (correctBands.length) {
    let index = bandIndex(correctBands[correctBands.length - 1]);
    const stat = bandScores[PLACEMENT_BANDS[index]] || { return: 0, rate: 0 };

    if (stat.rate < 0.5) index = Math.max(0, index - 1);

    const upper = PLACEMENT_BANDS[index + 1];
    const upperStat = bandScores[upper];
    if (stat.rate >= 0.99 && upperStat && upperStat.correct > 0) {
      index = Math.min(PLACEMENT_BANDS.length - 1, index + 1);
    }

    rawLevel = PLACEMENT_BANDS[index];
  }

  /* 兜底：一题都没答对，但总分百分比不低（题目分散在多个带），用阈值法 */
  if (rawLevel === "A0" && percent >= 38) {
    rawLevel = LEVEL_THRESHOLDS.find((item) => percent >= item.min)?.level || "A0";
  }

  /* ── 关卡①：拼读基础（字母 / 元音 / 声调）── */
  const scriptCorrect = ["letters", "vowels", "tones"].reduce(
    (sum, id) => sum + (sectionScores[id]?.correct || 0),
    0
  );
  const scriptTotal = ["letters", "vowels", "tones"].reduce(
    (sum, id) => sum + (sectionScores[id]?.total || 0),
    0
  );

  let capLevel = "C1";
  const capReasons = [];

  /* 按**正确率**封顶，不按累计答对数。
     早先用的是「答对 ≤ 3 题就封到 A1」这种绝对计数，而自适应测验只会出
     2~4 道拼读题 —— 高阶学习者把拼读题答对 2 道也会被误判为"拼读弱"，
     等级被硬生生压到 A1。改成看比例。 */
  if (scriptTotal >= 3) {
    const scriptRate = scriptCorrect / scriptTotal;
    if (scriptRate <= 0.34) {
      capLevel = "A1";
      capReasons.push("拼读板块（字母 / 元音 / 声调）正确率不足三分之一，先建立拼读基础再上难度");
    } else if (scriptRate <= 0.5) {
      capLevel = "A2";
      capReasons.push("拼读板块正确率偏低，建议以 A2 强度巩固字母与声调");
    }
  }

  /* ── 关卡②：听力（泰语是声调语言，听不懂基本用不了）── */
  const listeningStat = sectionScores.listening || { correct: 0, total: 0, rate: 0 };
  const listeningTested = withListening && listeningStat.total > 0;

  if (listeningTested && listeningStat.rate < 0.4 && listeningStat.total >= 3) {
    capLevel = levelLowerOf(capLevel, "A2");
    capReasons.push("听力板块正确率低于 40%，先补听辨再谈进阶");
  }

  const levelAfterCaps = levelLowerOf(rawLevel, capLevel);

  /* ── CEFR 自评（Can-Do）校准 ──
     自评级别 = 用户勾选的最高陈述级别（没勾任何一条 = A0）。
     规则：
       • 自评**低于**测出来的等级一档以上 → 下调一档（可能被高估，且本人信心不足）
       • 自评**高于**测出来两档以上 → 不下调也不上调，只标注"证据冲突"，
         让结果页提示"建议从当前档位开始，两周后再测一次" */
  const selfLevel = (() => {
    const picked = CAN_DO_STATEMENTS.filter((item) => canDo.includes(item.id))
      .map((item) => item.level);
    if (!picked.length) return null;
    return picked.sort((a, b) => bandIndex(a) - bandIndex(b))[picked.length - 1];
  })();

  const selfGap = selfLevel
    ? bandIndex(selfLevel) - bandIndex(levelAfterCaps)
    : 0;

  let level = levelAfterCaps;
  let selfAssessed = false;

  if (selfGap <= -1) {
    /* 测出来比自评高：相信测试，但按自评**下调到自评那一档之上的一档**
       （不是简单减一），并且只作为提示，不再叠加到已经封顶过的结果上。
       例：测出 B1、自评 A2 → 落在 A2/B1 之间，取 B1 并提示；
           测出 C1、自评 A1 → 下调到 A2 并提示。 */
    const lowered = clampBand(bandIndex(selfLevel) + 1);
    if (bandIndex(lowered) < bandIndex(level)) {
      level = lowered;
      selfAssessed = true;
      capReasons.push(
        `自评（${selfLevel}）比测试结果保守，已相应下调，先从你能确认掌握的难度开始`
      );
    }
  }

  /* ── 把握度：题目越多、难度带越稳定，越可信 ── */
  const confidence = (() => {
    if (!total) return 0;
    const coverage = Math.min(1, total / PLACEMENT_ADAPTIVE.min);
    const bandSpread = hitBands.length;
    const focus = bandSpread <= 3 ? 1 : bandSpread === 4 ? 0.8 : 0.6;
    return Math.round(Math.min(1, coverage * focus) * 100);
  })();

  return {
    score,
    maxScore,
    percent,
    correct,
    total,
    level,
    rawLevel,
    capped: level !== rawLevel,
    capReason: capReasons.join("；"),
    capReasons,
    scriptCorrect,
    scriptTotal,
    bandScores,
    sectionScores,
    listening: {
      tested: listeningTested,
      correct: listeningStat.correct || 0,
      total: listeningStat.total || 0,
      rate: listeningStat.rate || 0,
    },
    canDo: {
      picked: canDo,
      selfLevel,
      gap: selfGap,
      conflict: selfGap >= 2,
      adjusted: selfAssessed,
    },
    confidence,
    withListening,
  };
}

/* =========================================================
   二、标签工具（把 id 翻译成中文标题）
========================================================= */

// ⚠️ 四组选项的 id 会重名（例如 drama / travel 既是学习目标又是兴趣媒体），
// 所以解析标签时必须指定分组，不能全局按 id 猜。
const OPTION_GROUPS = {
  goals: LEARNING_GOALS,
  directions: PROFESSIONAL_DIRECTIONS,
  media: MEDIA_INTERESTS,
  styles: LEARNING_STYLES,
};

/** 按分组取选项对象；group ∈ goals | directions | media | styles */
export function optionById(id, group) {
  const list = OPTION_GROUPS[group];
  if (!list) return null;
  return list.find((item) => item.id === id) || null;
}

/** 按分组把 id 列表翻译成中文标题 */
export function optionTitles(ids = [], group) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => optionById(id, group)?.title || id)
    .filter(Boolean);
}

export const directionTitles = (ids) => optionTitles(ids, "directions");
export const mediaTitles = (ids) => optionTitles(ids, "media");
export const styleTitles = (ids) => optionTitles(ids, "styles");

export function goalTitle(id) {
  return optionById(id, "goals")?.title || "";
}

export function goalEmoji(id) {
  return optionById(id, "goals")?.emoji || "🎯";
}

/* =========================================================
   三、目标场景：由学习目标 + 专业方向推导
========================================================= */

const GOAL_SCENARIOS = {
  major: ["语音拼读", "语法体系", "长篇阅读"],
  travel: ["机场值机", "酒店入住", "点餐问路"],
  business: ["商务会议", "邮件往来", "报价谈判"],
  study: ["课堂听讲", "校园办事", "作业写作"],
  drama: ["追剧不看字幕", "台词跟读", "生活口语"],
  music: ["看懂歌词", "跟唱发音", "情感表达"],
  culture: ["节日参与", "日常社交礼仪", "文化话题"],
};

const DIRECTION_SCENARIOS = {
  business: "商务场景表达",
  academic: "学术阅读与写作",
  tourism: "接待导览用语",
  news: "新闻听力与时事词",
  newmedia: "短视频文案与口语",
};

export function deriveTargetScenario(goalId, directionIds = []) {
  const base = GOAL_SCENARIOS[goalId] || ["日常交流"];
  const extra = (Array.isArray(directionIds) ? directionIds : [])
    .map((id) => DIRECTION_SCENARIOS[id])
    .filter(Boolean);

  return [...base, ...extra].slice(0, 4).join(" · ");
}

/* =========================================================
   四、推荐词书：画像关键词 → 词书名称匹配
========================================================= */

const KEYWORDS_BY_GOAL = {
  major: ["问候", "日常", "生活泰语", "学习"],
  travel: ["旅行", "交通泰语", "点餐泰语", "购物泰语", "地点"],
  business: ["商务泰语", "经济泰语", "职业泰语", "科技泰语"],
  study: ["校园泰语", "学习", "科技泰语", "时间"],
  drama: ["日常", "情绪泰语", "生活泰语", "人物"],
  music: ["情绪泰语", "日常", "文化泰语"],
  culture: ["文化泰语", "食物泰语", "动物泰语", "节日"],
};

const KEYWORDS_BY_DIRECTION = {
  business: ["商务泰语", "经济泰语"],
  academic: ["学习", "科技泰语"],
  tourism: ["旅行", "点餐泰语", "交通泰语", "购物泰语"],
  news: ["政治泰语", "经济泰语", "新闻"],
  newmedia: ["日常", "生活泰语"],
};

const KEYWORDS_BY_MEDIA = {
  drama: ["日常", "情绪泰语"],
  movie: ["日常", "文化泰语"],
  song: ["情绪泰语", "文化泰语"],
  variety: ["日常", "人物"],
  news: ["政治泰语", "经济泰语"],
  tiktok: ["日常", "生活泰语"],
  novel: ["文化泰语", "情绪泰语"],
  food: ["食物泰语", "点餐泰语"],
  travel: ["旅行", "交通泰语"],
};

/** 画像 → 词书关键词（供 recommendBooks 与 profileDriven 复用） */
export function profileBookKeywords(profile) {
  return [
    ...(KEYWORDS_BY_GOAL[profile?.learningGoal] || []),
    ...(profile?.professionalDirection || []).flatMap(
      (id) => KEYWORDS_BY_DIRECTION[id] || []
    ),
    ...(profile?.mediaInterest || []).flatMap(
      (id) => KEYWORDS_BY_MEDIA[id] || []
    ),
  ];
}

export function recommendBooks(profile, limit = 3) {
  let books = [];

  try {
    books = getVocabBooks() || [];
  } catch (error) {
    console.error("读取词书失败:", error);
    return [];
  }

  if (!books.length) return [];

  const keywords = profileBookKeywords(profile);

  const scored = books.map((book) => {
    const name = String(book.name || "");
    const hits = keywords.filter((keyword) => name.includes(keyword)).length;
    return { book, hits };
  });

  scored.sort((a, b) => b.hits - a.hits || (b.book.count || 0) - (a.book.count || 0));

  const picked = scored.filter((item) => item.hits > 0).slice(0, limit);

  // 关键词全不命中时，退化为词量最大的前几本（保证永远有推荐）
  const fallback = scored.slice(0, limit);

  return (picked.length ? picked : fallback).map((item) => item.book);
}

/* =========================================================
   五、补强板块：测试中各板块正确率最低的 → 对应已有练习入口
========================================================= */

const SECTION_ROUTES = {
  letters: { to: "/alphabet", cta: "练泰文字母表" },
  vowels: { to: "/alphabet", cta: "复习元音与辅音" },
  tones: { to: "/alphabet", cta: "专项练声调" },
  listening: { to: "/corpus/listening", cta: "练新闻听力" },
  vocab: { to: "/vocabulary", cta: "刷高频词汇" },
  reading: { to: "/lessons", cta: "做课文精读" },
  dialogue: { to: "/conversation", cta: "找 AI 老师对话" },
};

export function weakestSections(sectionScores = {}, limit = 2) {
  return PLACEMENT_SECTIONS.map((section) => {
    const stat = sectionScores[section.id] || { correct: 0, total: 0 };
    const rate = stat.total ? stat.correct / stat.total : 0;
    return { ...section, ...stat, rate };
  })
    /* 只报**真正考过**的板块：自适应测验可能没出到某个板块，
       那种情况下"没考"不等于"不会"，不能写进补强建议 */
    .filter((section) => section.total > 0)
    .filter((section) => section.rate < 1)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, limit)
    .map((section) => ({
      ...section,
      ...(SECTION_ROUTES[section.id] || { to: "/practice", cta: "去练习" }),
    }));
}

/* =========================================================
   六、学习方式 → 重点技能与每日任务倾斜
========================================================= */

const STYLE_SKILLS = {
  visual: { label: "字母与词形", to: "/alphabet" },
  listening: { label: "听力理解", to: "/corpus/listening" },
  speaking: { label: "口语输出", to: "/speaking" },
  reading: { label: "阅读理解", to: "/corpus/read" },
};

export function styleSkills(styleIds = []) {
  const picked = (Array.isArray(styleIds) ? styleIds : [])
    .map((id) => STYLE_SKILLS[id])
    .filter(Boolean);

  return picked.length
    ? picked
    : [STYLE_SKILLS.visual, STYLE_SKILLS.listening];
}

/* =========================================================
   七、个性化学习路线（主页与结果页共用）
========================================================= */

export function buildLearningPath(profile) {
  const level = getLevelMeta(profile?.thaiLevel);
  const detail = profile?.testDetail || {};
  const sectionScores = detail.sectionScores || {};

  const isBeginner = ["A0", "A1"].includes(level.id);
  const isAdvanced = ["B2", "C1"].includes(level.id);

  const stages = [
    {
      id: "script",
      title: isBeginner ? "打地基：字母与拼读" : "快速校准：拼读与声调",
      desc: isBeginner
        ? "中高低辅音、元音位置、五个声调规则，先能读准再谈背词。"
        : "用字母表与声调专项快速过一遍规则，把易错音标清。",
      to: "/alphabet",
      cta: "进入字母表",
      days: isBeginner ? "第 1~3 天" : "第 1 天",
    },
    {
      id: "course",
      title: "主课：基础泰语精读 14 课",
      desc: isAdvanced
        ? "以课文为骨架补齐书面语与长句结构，配合逐段朗读音频精听。"
        : "每课「听音频 → 跟读 → 看中泰对照 → 做课后练习」，学完点亮一节点。",
      to: "/course/thai-basic-reader",
      cta: "开始第 1 课",
      days: isBeginner ? "第 4~20 天" : "第 2~12 天",
    },
    {
      id: "practice",
      title: "词汇与练习固化",
      desc: `每天 ${level.wordsPerDay} 个词 + 配对 / 填空 / 断词三件套，错题自动进错题本。`,
      to: "/loop",
      cta: "开始今日闭环",
      days: isBeginner ? "第 21~28 天" : "第 13~20 天",
    },
    {
      id: "output",
      title: isAdvanced ? "输出打磨：语料与专业场景" : "实战：AI 对话与听力",
      desc: isAdvanced
        ? "本地语料库精听 + 新闻/专业方向材料，配合 AI 老师做观点表达训练。"
        : "用 AI 老师练目标场景（点餐、问路、看病），并把课文句子说出口。",
      to: isAdvanced ? "/corpus" : "/conversation",
      cta: isAdvanced ? "进入语料库" : "找 AI 老师开聊",
      days: isBeginner ? "第 29 天起" : "第 21 天起",
    },
  ];

  const desiredDirection = (profile?.professionalDirection || [])[0];
  const desiredOption = optionById(desiredDirection, "directions");

  const extraStage = desiredDirection
    ? {
        id: "direction",
        title: `专业方向：${desiredOption?.title || ""}`,
        desc: desiredOption?.desc || "按你的专业方向补充材料与词汇。",
        to: desiredDirection === "news" ? "/corpus/listening" : "/vocabulary",
        cta: desiredDirection === "news" ? "练新闻听力" : "按方向刷词",
        days: "持续推进",
      }
    : null;

  return {
    level,
    scenario: profile?.targetScenario || "",
    goal: goalTitle(profile?.learningGoal),
    goalEmoji: goalEmoji(profile?.learningGoal),
    stages: extraStage ? [...stages, extraStage] : stages,
    daily: {
      words: level.wordsPerDay,
      minutes: level.minutesPerDay,
      focus: level.focus,
    },
    books: recommendBooks(profile).map((book) => ({
      id: book.id,
      name: book.name,
      emoji: book.emoji,
      count: book.count,
    })),
    skills: styleSkills(profile?.learningStyle),
    weaknesses: weakestSections(sectionScores),
  };
}

/* =========================================================
   八、画像归一化（前端缓存 / 后端返回统一成同一形状）
========================================================= */

export function normalizeProfile(raw) {
  if (!raw) return null;

  const asArray = (value) =>
    Array.isArray(value)
      ? value.filter(Boolean)
      : String(value || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

  return {
    thaiLevel: raw.thaiLevel || raw.thai_level || "A0",
    learningGoal: raw.learningGoal || raw.learning_goal || "",
    professionalDirection: asArray(
      raw.professionalDirection ?? raw.professional_direction
    ),
    mediaInterest: asArray(raw.mediaInterest ?? raw.media_interest),
    learningStyle: asArray(raw.learningStyle ?? raw.learning_style),
    targetScenario: raw.targetScenario || raw.target_scenario || "",
    testScore: Number(raw.testScore ?? raw.test_score ?? 0),
    testDetail: raw.testDetail ?? raw.test_detail ?? null,
    createdAt: raw.createdAt || raw.created_at || null,
    updatedAt: raw.updatedAt || raw.updated_at || null,
  };
}

export const hasPlacementProfile = (profile) =>
  !!profile && !!profile.thaiLevel && !!profile.learningGoal;
