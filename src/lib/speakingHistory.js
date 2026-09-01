// =========================================================
// 口语练习历史：localStorage 持久化四维评分记录
// =========================================================

const STORAGE_KEY = "thaiAI_speaking_history";
const MAX_RECORDS = 200; // 最多保留 200 条记录

/**
 * 保存一次练习记录
 * @param {Object} record
 * @param {number} record.score - 总分
 * @param {number} record.accuracy - 发音
 * @param {number} record.tone - 声调
 * @param {number} record.fluency - 流利度
 * @param {number} record.completeness - 完整度
 * @param {string} record.mode - word/sentence/paragraph
 * @param {string} record.target - 目标词/句
 * @param {string} record.source - azure/local
 */
export function saveSpeakingRecord(record) {
  try {
    const history = getSpeakingHistory();
    history.push({
      ...record,
      timestamp: Date.now(),
    });
    // 只保留最近 MAX_RECORDS 条
    const trimmed = history.slice(-MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Failed to save speaking history:", e);
  }
}

/**
 * 获取全部历史记录
 * @returns {Array} 按时间正序排列的记录
 */
export function getSpeakingHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    return [];
  }
}

/**
 * 获取最近 N 天的记录
 * @param {number} days - 天数，默认 30
 */
export function getRecentHistory(days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return getSpeakingHistory().filter((r) => r.timestamp >= cutoff);
}

/**
 * 获取每日平均分（按天聚合）
 * @param {number} days
 * @returns {Array<{date: string, accuracy: number, tone: number, fluency: number, completeness: number, overall: number, count: number}>}
 */
export function getDailyAverages(days = 30) {
  const records = getRecentHistory(days);
  if (records.length === 0) return [];

  const byDate = {};
  records.forEach((r) => {
    const d = new Date(r.timestamp).toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
    });
    if (!byDate[d]) byDate[d] = { sum: { accuracy: 0, tone: 0, fluency: 0, completeness: 0, overall: 0 }, count: 0 };
    byDate[d].sum.accuracy += r.accuracy || 0;
    byDate[d].sum.tone += r.tone || 0;
    byDate[d].sum.fluency += r.fluency || 0;
    byDate[d].sum.completeness += r.completeness || 0;
    byDate[d].sum.overall += r.score || 0;
    byDate[d].count += 1;
  });

  return Object.entries(byDate).map(([date, { sum, count }]) => ({
    date,
    accuracy: Math.round(sum.accuracy / count),
    tone: Math.round(sum.tone / count),
    fluency: Math.round(sum.fluency / count),
    completeness: Math.round(sum.completeness / count),
    overall: Math.round(sum.overall / count),
    count,
  }));
}

/**
 * 清空历史
 */
export function clearSpeakingHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
