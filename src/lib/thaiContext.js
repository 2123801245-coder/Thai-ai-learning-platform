import { findThaiContext, THAI_CONTEXT_OF_DAY } from "@/data/thaiContext";

const EMPTY_RELATIONSHIPS = [
  { label: "朋友 / 同辈", status: "待补充", key: "peer" },
  { label: "恋人 / 亲密关系", status: "待补充", key: "intimate" },
  { label: "长辈", status: "待补充", key: "elder" },
  { label: "老师", status: "待补充", key: "teacher" },
  { label: "商务场合", status: "待补充", key: "business" },
  { label: "陌生人", status: "待补充", key: "stranger" },
];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeRelationships(value) {
  if (!value || typeof value !== "object") return EMPTY_RELATIONSHIPS;
  return EMPTY_RELATIONSHIPS.map((item) => ({
    ...item,
    status: text(value[item.key]) || "待补充",
  }));
}

function normalizeExamples(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => ({
      thai: text(item?.thai),
      chinese: text(item?.chinese || item?.translation),
      note: text(item?.note),
    }))
    .filter((item) => item.thai || item.chinese);
}

function fromEntry(entry, word) {
  return {
    ...entry,
    thai: entry.thai || word.thai_word || word.thai || "",
    source: "curated",
    relationships: normalizeRelationships(entry.relationships),
    contexts: array(entry.contexts),
    emotion: array(entry.emotion),
    commonCollocations: array(entry.commonCollocations),
    similarExpressions: Array.isArray(entry.similarExpressions) ? entry.similarExpressions : [],
    avoidedUsage: array(entry.avoidedUsage),
    culturalNotes: array(entry.culturalNotes),
    nativeExamples: normalizeExamples(entry.nativeExamples, []),
  };
}

/**
 * 把新旧词条统一为 Context Card 所需结构。
 * 旧数据没有语境字段时只展示已知释义/例句，不推断虚假的统计或关系结论。
 */
export function normalizeThaiContext(word = {}) {
  const thai = text(word.thai_word || word.thai || word.w);
  const custom = word.contextData || word.context || null;
  const curated = findThaiContext(thai);

  if (curated) return fromEntry(curated, word);

  if (custom && typeof custom === "object") {
    return {
      thai,
      coreMeaning: text(custom.coreMeaning || word.chinese_meaning || word.meaning),
      literalMeaning: text(custom.literalMeaning),
      naturalMeaning: text(custom.naturalMeaning),
      contexts: array(custom.contexts),
      relationships: normalizeRelationships(custom.relationships),
      emotion: array(custom.emotion),
      formality: Number.isFinite(Number(custom.formality)) ? Number(custom.formality) : null,
      politeness: Number.isFinite(Number(custom.politeness)) ? Number(custom.politeness) : null,
      intimacy: Number.isFinite(Number(custom.intimacy)) ? Number(custom.intimacy) : null,
      naturalness: custom.naturalness || { label: "待补充", note: "暂无人工校订说明" },
      commonCollocations: array(custom.commonCollocations),
      similarExpressions: Array.isArray(custom.similarExpressions) ? custom.similarExpressions : [],
      avoidedUsage: array(custom.avoidedUsage),
      whyNotLiteral: text(custom.whyNotLiteral),
      culturalNotes: array(custom.culturalNotes),
      nativeExamples: normalizeExamples(custom.nativeExamples, []),
      source: "entry",
    };
  }

  const thaiExample = text(word.example_thai || word.t);
  const chineseMeaning = text(word.chinese_meaning || word.meaning || word.m);
  const chineseExample = text(word.example_chinese || word.c);
  return {
    thai,
    coreMeaning: chineseMeaning,
    literalMeaning: "暂无字面拆解",
    naturalMeaning: chineseMeaning ? "这是词条中的基础释义；自然语境说明正在补充。" : "暂无结构化语境资料。",
    contexts: array(word.category || word.b ? [word.category || word.b] : []),
    relationships: EMPTY_RELATIONSHIPS,
    emotion: [],
    formality: null,
    politeness: null,
    intimacy: null,
    naturalness: { label: "待补充", note: "暂无人工校订说明，不代表自然度评分。" },
    commonCollocations: [],
    similarExpressions: [],
    avoidedUsage: [],
    whyNotLiteral: "暂无“为什么不能直译”的校订说明。",
    culturalNotes: [],
    nativeExamples: thaiExample ? [{ thai: thaiExample, chinese: chineseExample }] : [],
    source: "legacy",
  };
}

export function contextForDay(date = new Date()) {
  const day = new Date(date);
  const index = Math.abs(day.getFullYear() * 372 + day.getMonth() * 31 + day.getDate()) % THAI_CONTEXT_OF_DAY.length;
  return findThaiContext(THAI_CONTEXT_OF_DAY[index]);
}

export function formatContextLevel(value) {
  if (!Number.isFinite(Number(value))) return "待补充";
  const level = Math.max(0, Math.min(5, Number(value)));
  return `${"━".repeat(level)}${"·".repeat(5 - level)}`;
}
