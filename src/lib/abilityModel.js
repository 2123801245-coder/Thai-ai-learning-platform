// =========================================================
// 泰语能力评估模型（based on 学习记录真实计数）
// 六维：词汇 / 口语 / 听力 / 阅读 / 语法 / 声调
// - 词汇：已掌握词汇量 / 目标词库（真实计数）
// - 口语 / 听力 / 阅读 / 语法 / 声调：由
//   真实计数（词汇量、正确率、活跃天数、累计学词曲线）加权估计，
//   数据越充分越准确；无数据时给出低基线并提示从学习开始。
// - 成长曲线：按每日累计学词映射 A1→A2→B1→B2（CEFR 阈值）
// =========================================================

const TOTAL_WORDS_CAP = 500; // 目标词库总量
const CEFR = [
  { min: 1800, code: "B2", label: "中级·流利交流" },
  { min: 800, code: "B1", label: "中级·日常熟练" },
  { min: 300, code: "A2", label: "初级·基础表达" },
  { min: 0, code: "A1", label: "初级·入门" },
];

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function cefrForWords(words) {
  const found = CEFR.find((c) => words >= c.min);
  return found || CEFR[CEFR.length - 1];
}

/* 六维能力估计
 *
 * @param {object}  progress  学习记录（total_vocabulary, accuracy_rate, daily_history）
 * @param {Array}   planets   星系星球进度（buildPlanets() 结果），可选。
 *                             星球掌握度会按维度映射补充到雷达分里，
 *                             让星系进度直接体现在能力雷达上。
 */
export function estimateAbilities(progress, planets = []) {
  if (!progress) progress = {};
  const totalVocabulary = Number(progress.total_vocabulary) || 0;
  const accuracy = Number(progress.accuracy_rate) || 0;
  const history = Array.isArray(progress.daily_history)
    ? progress.daily_history
    : [];
  const activeDays = history.length;
  const activity = clamp((activeDays / 30) * 100);

  /* ── 基础估计（纯学习记录） ── */
  const vocabBase = clamp((totalVocabulary / TOTAL_WORDS_CAP) * 100);
  const grammarBase = clamp(accuracy * 0.6 + vocabBase * 0.4);
  const readingBase = clamp(vocabBase * 0.55 + accuracy * 0.25 + activity * 0.2);
  const listeningBase = clamp(vocabBase * 0.4 + accuracy * 0.3 + activity * 0.3);
  const speakingBase = clamp(vocabBase * 0.5 + accuracy * 0.3 + activity * 0.2);
  const toneBase = clamp(vocabBase * 0.35 + accuracy * 0.45 + activity * 0.2);

  /*
   * ── 星球掌握度 → 雷达维度映射 ──
   *
   * 星系里的每颗星球代表一个学习方向，它的真实进度（stage 完成百分比）
   * 应该反馈到能力雷达上——用户在某个方向花的功夫应该看得见。
   *
   * 映射规则（每颗星球的 progress 按权重贡献到 1~2 个维度）：
   *   基础语言  → 词汇 +30%、声调 +20%
   *   日常交流  → 口语 +35%、听力 +25%
   *   文化探索  → 阅读 +40%、语法 +10%
   *   媒体沉浸  → 听力 +30%、阅读 +15%
   *   专业方向  → 语法 +25%、词汇 +15%
   *
   * 权重之和每维度 ≤1.0（最极端情况也不把某一项直接拉满），
   * 并与基础估计取 max（不让星球数据「覆盖」真实学习记录，只做「补充」）。
   */
  const planetBoost = { vocab: 0, grammar: 0, reading: 0, listening: 0, speaking: 0, tone: 0 };
  const PLANET_MAP = {
    basics:   { vocab: 0.3, tone: 0.2 },
    daily:    { speaking: 0.35, listening: 0.25 },
    culture:  { reading: 0.4, grammar: 0.1 },
    media:    { listening: 0.3, reading: 0.15 },
    pro:      { grammar: 0.25, vocab: 0.15 },
  };
  if (Array.isArray(planets)) {
    planets.forEach((planet) => {
      const mapping = PLANET_MAP[planet.id];
      if (!mapping || typeof planet.progress !== "number") return;
      const p = Math.max(0, Math.min(100, planet.progress));
      Object.entries(mapping).forEach(([dim, weight]) => {
        planetBoost[dim] = Math.max(planetBoost[dim], p * weight);
      });
    });
  }

  /* 取 max：星球补充不会拉低真实学习记录产生的估计 */
  const vocab = clamp(Math.max(vocabBase, vocabBase * 0.7 + planetBoost.vocab * 0.3 + planetBoost.vocab * 0.3));
  const grammar = clamp(Math.max(grammarBase, grammarBase * 0.7 + planetBoost.grammar * 0.3 + planetBoost.grammar * 0.3));
  const reading = clamp(Math.max(readingBase, readingBase * 0.7 + planetBoost.reading * 0.3 + planetBoost.reading * 0.3));
  const listening = clamp(Math.max(listeningBase, listeningBase * 0.7 + planetBoost.listening * 0.3 + planetBoost.listening * 0.3));
  const speaking = clamp(Math.max(speakingBase, speakingBase * 0.7 + planetBoost.speaking * 0.3 + planetBoost.speaking * 0.3));
  const tone = clamp(Math.max(toneBase, toneBase * 0.7 + planetBoost.tone * 0.3 + planetBoost.tone * 0.3));

  const overallScore = Math.round(
    (vocab + speaking + listening + reading + grammar + tone) / 6
  );
  const cefr = cefrForWords(totalVocabulary);

  const starData = [
    { subject: "词汇", score: vocab, full: 100, hasGalaxyBoost: planetBoost.vocab > 0 },
    { subject: "口语", score: speaking, full: 100, hasGalaxyBoost: planetBoost.speaking > 0 },
    { subject: "听力", score: listening, full: 100, hasGalaxyBoost: planetBoost.listening > 0 },
    { subject: "阅读", score: reading, full: 100, hasGalaxyBoost: planetBoost.reading > 0 },
    { subject: "语法", score: grammar, full: 100, hasGalaxyBoost: planetBoost.grammar > 0 },
    { subject: "声调", score: tone, full: 100, hasGalaxyBoost: planetBoost.tone > 0 },
  ];

  return {
    vocab,
    speaking,
    listening,
    reading,
    grammar,
    tone,
    overallScore,
    cefr: cefr.code,
    cefrLabel: cefr.label,
    starData,
    totalVocabulary,
    accuracy,
    activeDays,
  };
}

/* 成长曲线：每日累计学词 → 水平分(0-100) + CEFR 阶段 */
export function buildLevelSeries(daily_history) {
  const history = Array.isArray(daily_history)
    ? daily_history.slice(-30)
    : [];
  let cum = 0;
  const series = history.map((d) => {
    const dayWords = Number(d.words) || 0;
    cum += dayWords;
    const score = clamp((cum / 2000) * 100);
    return {
      date: d.date || "",
      day: shortDate(d.date || ""),
      score,
      cefr: cefrForWords(cum).code,
    };
  });
  return { series, cumulative: cum };
}

/* 估算到下一 CEFR 阶段还需的天数（按近期平均日学词量） */
export function estimateDaysToNextLevel(daily_history, totalVocabulary) {
  const history = Array.isArray(daily_history) ? daily_history : [];
  totalVocabulary = Number(totalVocabulary) || 0;
  const recent = history.slice(-7);
  const perDay =
    recent.length > 0
      ? recent.reduce((s, d) => s + (Number(d.words) || 0), 0) /
        recent.length
      : 0;
  if (perDay <= 0) return null;
  const need = totalVocabulary;
  const next = CEFR.find((c) => c.min > need);
  if (!next) return 0;
  return Math.max(1, Math.ceil((next.min - need) / perDay));
}

function shortDate(iso) {
  if (!iso) return "";
  const d = iso.length > 10 ? iso.slice(0, 10) : iso;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2].slice(0, 2)}`;
  return d;
}