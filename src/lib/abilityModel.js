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

/* 六维能力估计 */
export function estimateAbilities(progress) {
  if (!progress) progress = {};
  const totalVocabulary = Number(progress.total_vocabulary) || 0;
  const accuracy = Number(progress.accuracy_rate) || 0;
  const history = Array.isArray(progress.daily_history)
    ? progress.daily_history
    : [];
  const activeDays = history.length;
  const activity = clamp((activeDays / 30) * 100);

  const vocab = clamp((totalVocabulary / TOTAL_WORDS_CAP) * 100);
  const grammar = clamp(accuracy * 0.6 + vocab * 0.4);
  const reading = clamp(vocab * 0.55 + accuracy * 0.25 + activity * 0.2);
  const listening = clamp(vocab * 0.4 + accuracy * 0.3 + activity * 0.3);
  const speaking = clamp(vocab * 0.5 + accuracy * 0.3 + activity * 0.2);
  const tone = clamp(vocab * 0.35 + accuracy * 0.45 + activity * 0.2);

  const overallScore = Math.round(
    (vocab + speaking + listening + reading + grammar + tone) / 6
  );
  const cefr = cefrForWords(totalVocabulary);

  const starData = [
    { subject: "词汇", score: vocab, full: 100 },
    { subject: "口语", score: speaking, full: 100 },
    { subject: "听力", score: listening, full: 100 },
    { subject: "阅读", score: reading, full: 100 },
    { subject: "语法", score: grammar, full: 100 },
    { subject: "声调", score: tone, full: 100 },
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