// src/lib/wordBooks.js
// 词书管理：把 localVocabulary 按分类组织成可选词书，并提供练习题目生成器

import { localVocabulary } from "@/data/vocabulary";
import { base44 } from "@/api/base44Client";

/* ════════════════════════════════════════
   错题本：练习答错的词自动收录，可生成练习题目
   - 本地 localStorage 为主存储（任何环境都可用）
   - base44 平台登录态存在时尽力同步（失败静默忽略）
   ════════════════════════════════════════ */
const WRONG_BOOK_LOCAL_KEY = "thaiai-wrong-notebook";

function loadLocalWrong() {
  try {
    const raw = localStorage.getItem(WRONG_BOOK_LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveLocalWrong(items) {
  try {
    localStorage.setItem(
      WRONG_BOOK_LOCAL_KEY,
      JSON.stringify(items.slice(0, 300))
    );
  } catch (e) {
    // ignore
  }
}

// 错题条目补齐字段：错题记录里可能缺例句/发音，回退到本地词库补全
function fillWrongFromLocal(w) {
  const loc = localVocabulary.find((v) => v.thai_word === w.thai_word);
  return {
    thai: w.thai_word || w.thai || "",
    roman: w.pronunciation || w.roman || loc?.pronunciation || "",
    chinese: w.chinese_meaning || w.chinese || loc?.chinese_meaning || "",
    sentence: w.example_thai || w.sentence || loc?.example_thai || "",
    sentenceCn:
      w.example_chinese || w.sentenceCn || loc?.example_chinese || "",
    pos: loc?.part_of_speech || "",
    wrongCount: w.wrong_count || w.wrongCount || 1,
    lastWrongDate: w.last_wrong_date || w.lastWrongDate || "",
  };
}

// 读取错题本，整理成可练习的词书（错题本为空时返回 null）
export async function fetchWrongBook() {
  const seen = new Set();
  const words = [];

  // ① 本地错题（主存储）
  for (const w of loadLocalWrong()) {
    if (!w?.thai || seen.has(w.thai)) continue;
    seen.add(w.thai);
    const norm = fillWrongFromLocal(w);
    if (norm.thai && norm.chinese) words.push(norm);
  }

  // ② base44 错题（平台登录态存在时合并，失败静默忽略）
  try {
    const data = await base44.entities.WrongNotebook.filter(
      { removed: false },
      "-last_wrong_date",
      500
    );
    for (const w of data || []) {
      if (!w?.thai_word || seen.has(w.thai_word)) continue;
      seen.add(w.thai_word);
      const norm = fillWrongFromLocal(w);
      if (norm.thai && norm.chinese) words.push(norm);
    }
  } catch (e) {
    // base44 未登录等：跳过，仅用本地错题
  }

  if (!words.length) return null;
  return {
    id: "wrong-book",
    name: "错题本",
    emoji: "📕",
    kind: "wrong",
    count: words.length,
    words,
  };
}

// 答错时把词记入错题本（已存在则累计答错次数）
export async function recordWrongWord(word) {
  const thai = word?.thai || word?.thai_word;
  if (!thai) return;
  const today = new Date().toISOString().split("T")[0];
  const entry = {
    thai,
    chinese: word?.chinese || word?.chinese_meaning || "",
    roman: word?.roman || word?.pronunciation || "",
    sentence: word?.sentence || word?.example_thai || "",
    sentenceCn: word?.sentenceCn || word?.example_chinese || "",
    wrongCount: 1,
    lastWrongDate: today,
  };

  // ① 本地记录（主存储，永远可用）
  const local = loadLocalWrong();
  const idx = local.findIndex((w) => w.thai === thai);
  if (idx >= 0) {
    local[idx].wrongCount = (local[idx].wrongCount || 1) + 1;
    local[idx].lastWrongDate = today;
    // 补全缺失字段
    local[idx].chinese = local[idx].chinese || entry.chinese;
    local[idx].roman = local[idx].roman || entry.roman;
    local[idx].sentence = local[idx].sentence || entry.sentence;
    local[idx].sentenceCn = local[idx].sentenceCn || entry.sentenceCn;
  } else {
    local.unshift(entry);
  }
  saveLocalWrong(local);

  // ② base44 尽力同步（平台登录态存在时生效，失败静默忽略）
  try {
    const existing = await base44.entities.WrongNotebook.filter(
      { thai_word: thai, removed: false },
      null,
      50
    );
    if (existing?.length) {
      await base44.entities.WrongNotebook.update(existing[0].id, {
        wrong_count: (existing[0].wrong_count || 1) + 1,
        last_wrong_date: today,
      });
    } else {
      await base44.entities.WrongNotebook.create({
        thai_word: thai,
        chinese_meaning: entry.chinese,
        pronunciation: entry.roman,
        example_thai: entry.sentence,
        wrong_count: 1,
        last_wrong_date: today,
        removed: false,
      });
    }
  } catch (e) {
    // base44 未登录/无权限：仅本地记录即可
  }
}

// 从错题本移除单个错词（本地 + base44 尽力同步）
export async function removeWrongWord(thai) {
  if (!thai) return;
  const local = loadLocalWrong();
  const next = local.filter((w) => w.thai !== thai);
  if (next.length !== local.length) saveLocalWrong(next);
  try {
    const existing = await base44.entities.WrongNotebook.filter(
      { thai_word: thai, removed: false },
      null,
      50
    );
    for (const w of existing || []) {
      await base44.entities.WrongNotebook.update(w.id, { removed: true });
    }
  } catch (e) {
    // base44 未登录/无权限：仅本地移除即可
  }
}

// 清空错题本（本地 + base44 尽力同步）
export async function clearWrongBook() {
  saveLocalWrong([]);
  try {
    const existing = await base44.entities.WrongNotebook.filter(
      { removed: false },
      null,
      500
    );
    for (const w of existing || []) {
      await base44.entities.WrongNotebook.update(w.id, { removed: true });
    }
  } catch (e) {
    // base44 未登录/无权限：仅本地清空即可
  }
}

/* ════════════════════════════════════════
   词书选择持久化：所有练习板块共享同一份记忆
   （localStorage 键：thaiai-wordbook-id）
   ════════════════════════════════════════ */
const WORD_BOOK_STORAGE_KEY = "thaiai-wordbook-id";

// 读取上次选择的词书 id；无记录 / 格式异常返回 null
// （对 localStorage 的访问用 try/catch 包裹，避免隐私模式等环境抛错）
export function getSavedBookId() {
  try {
    const v = localStorage.getItem(WORD_BOOK_STORAGE_KEY);
    return v && typeof v === "string" && v.length > 0 && v.length <= 64
      ? v
      : null;
  } catch (e) {
    return null;
  }
}

// 保存当前选择的词书 id
export function saveBookId(id) {
  if (!id) return;
  try {
    localStorage.setItem(WORD_BOOK_STORAGE_KEY, id);
  } catch (e) {
    // ignore
  }
}

// 把词书名转为稳定的 id 片段（保留中英文与泰文字符）
function slugify(name) {
  return String(name || "")
    .trim()
    .replace(/[^0-9a-zA-Z\u4e00-\u9fff\u0e00-\u0e7f]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── 分类 emoji ── */
const CATEGORY_EMOJI = {
  问候: "👋",
  数字: "🔢",
  日常: "☀️",
  人物: "👤",
  学习: "📖",
  时间: "⏰",
  地点: "📍",
  旅行: "✈️",
  颜色: "🎨",
  食物: "🍜",
  基础泰语1: "📚",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── 词书列表（来自 localVocabulary 分类）── */
export function getVocabBooks() {
  const byCat = {};
  localVocabulary.forEach((w) => {
    const cat = (w.category || w.book || w.book_name || "基础泰语1").trim();
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(w);
  });

  return Object.entries(byCat)
    .map(([name, words]) => ({
      id: `vocab-${name}`,
      name,
      emoji: CATEGORY_EMOJI[name] || "📖",
      kind: "vocab",
      count: words.length,
      words: words.map(normalizeWord),
    }))
    .sort((a, b) => b.count - a.count);
}

/* ── 标准化词条 ── */
function normalizeWord(w) {
  return {
    thai: w.thai_word || w.thai || "",
    roman: w.pronunciation || w.roman || "",
    chinese: w.chinese_meaning || w.cn || "",
    sentence: w.example_thai || w.example || "",
    sentenceCn: w.example_chinese || w.meaning || "",
    pos: w.part_of_speech || "",
  };
}

/* ── 从词书取一组词（随机 n 个）── */
export function pickWords(book, n = 8) {
  if (!book?.words?.length) return [];
  return shuffle(book.words).slice(0, n);
}

/* ── 错题时间格式化：“2026-08-29” → “8月29日” ── */
export function formatWrongDate(dateStr) {
  if (!dateStr) return "";
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${Number(m[2])}月${Number(m[3])}日`;
  return String(dateStr).slice(0, 10);
}

/* ── 词书词数不足时，从本地词库补充 ──
   错题本刚起步时往往只有几个词，直接练习会
   没有干扰项/配对对象，补充本地词保证体验 */
function topUpFromLibrary(book, count) {
  const existing = new Set((book?.words || []).map((w) => w.thai));
  const pool = shuffle(
    getVocabBooks()
      .flatMap((b) => b.words || [])
      .filter((w) => w.thai && w.chinese && !existing.has(w.thai))
  );
  const need = Math.max(0, count - (book?.words?.length || 0));
  return pool.slice(0, need);
}

/* ════════════════════════════════════════
   词汇配对题目生成（thai ↔ chinese）
   ════════════════════════════════════════ */
export function generateMatchPairs(book, count = 8) {
  const words = shuffle([
    ...(book?.words || []),
    ...topUpFromLibrary(book, count),
  ]).slice(0, count);
  return words.map((w) => ({
    thai: w.thai,
    roman: w.roman,
    chinese: w.chinese,
    // 错题统计（仅错题本词有值，用于练习页展示）
    wrongCount: w.wrongCount || 0,
    lastWrongDate: w.lastWrongDate || "",
  }));
}

/* ════════════════════════════════════════
   句子填空题目生成
   从词书例句中挖掉目标词，生成 4 选 1
   ════════════════════════════════════════ */
export function generateFillQuestions(book, count = 8) {
  // 词书内可出题词（有例句且例句含目标词）；不足时用本地词库补充，
  // 避免错题本词无例句（如从词汇配对记录）时无题可出、页面空白
  const ownUsable = (book?.words || []).filter(
    (w) =>
      w.thai &&
      w.thai.length >= 2 &&
      w.sentence &&
      w.sentence.includes(w.thai) &&
      w.chinese
  );
  const extraUsable = topUpFromLibrary(book, count + 4).filter(
    (w) =>
      w.thai &&
      w.thai.length >= 2 &&
      w.sentence &&
      w.sentence.includes(w.thai) &&
      w.chinese
  );
  const usable = [...ownUsable, ...extraUsable];
  if (!usable.length) return [];

  const picked = shuffle(usable).slice(0, count);
  // 干扰词：先取词书内其它词，不足 3 个时用本地词库补充
  const distractorBase = [
    ...usable,
    ...topUpFromLibrary(book, count + 4),
  ];

  return picked.map((w) => {
    const distractorPool = shuffle(
      distractorBase.filter((x) => x.thai !== w.thai)
    )
      .slice(0, 3)
      .map((x) => x.thai);
    const options = shuffle([w.thai, ...distractorPool]);
    const sentence = w.sentence.replace(w.thai, "___");
    const roman = w.sentence.replace(w.thai, "___");
    return {
      sentence,
      blank: w.thai,
      roman,
      hint: w.chinese,
      options,
      shuffledOptions: options,
      fullSentence: w.sentence,
      translation: w.sentenceCn || w.chinese,
      // 错题统计（仅错题本词有值，用于练习页展示）
      wrongCount: w.wrongCount || 0,
      lastWrongDate: w.lastWrongDate || "",
    };
  });
}

/* ════════════════════════════════════════
   分词练习题目生成
   把例句中出现的词书词汇切分出来
   ════════════════════════════════════════ */
export function generateSegmentQuestions(book, count = 6) {
  // 错题本等小词书：词不够时补充本地词库，保证能生成题目
  const ownUsable = (book?.words || []).filter(
    (w) =>
      w.thai &&
      w.sentence &&
      w.sentence.includes(w.thai) &&
      !/\s/.test(w.thai)
  );
  const extraUsable = topUpFromLibrary(book, count + 6).filter(
    (w) =>
      w.thai &&
      w.sentence &&
      w.sentence.includes(w.thai) &&
      !/\s/.test(w.thai)
  );
  const usable = [...ownUsable, ...extraUsable];
  if (!usable.length) return [];

  // 候选词用全量本地词库：分词更准，也避免句子因缺词被切碎
  const allWords = getVocabBooks()
    .flatMap((b) => b.words || [])
    .map((w) => w.thai)
    .filter((t) => t && t.length >= 2 && !/\s/.test(t));
  const candidates = [...new Set(allWords)].sort((a, b) => b.length - a.length);

  const picked = [];
  const seen = new Set();
  // 先排错题本自身的词（优先练习错词），再补本地词
  for (const group of [ownUsable, extraUsable]) {
    for (const w of shuffle(group)) {
      if (picked.length >= count) break;
      if (seen.has(w.sentence)) continue;
      const segs = segmentSentence(w.sentence, candidates);
      if (segs.length >= 3 && segs.length <= 10) {
        picked.push(w);
        seen.add(w.sentence);
      }
    }
    if (picked.length >= count) break;
  }

  return picked.map((w) => ({
    sentence: w.sentence,
    words: segmentSentence(w.sentence, candidates),
    roman: w.sentence.replace(w.thai, w.roman || w.thai),
    translation: w.sentenceCn || w.chinese,
    hint: `${w.thai} = ${w.chinese}`,
    // 错题统计（仅错题本词有值，用于练习页展示）
    wrongCount: w.wrongCount || 0,
    lastWrongDate: w.lastWrongDate || "",
  }));
}

/* ── 贪心最长匹配分词 ── */
function segmentSentence(sentence, candidates) {
  const segments = [];
  let i = 0;
  while (i < sentence.length) {
    let matched = null;
    for (const w of candidates) {
      if (sentence.startsWith(w, i)) {
        matched = w;
        break;
      }
    }
    if (matched) {
      segments.push(matched);
      i += matched.length;
    } else {
      segments.push(sentence[i]);
      i += 1;
    }
  }
  return segments.filter((s) => s.trim().length > 0);
}

/* ── 综合：把内置词书 + 词汇词书合并，供选择器使用 ── */
export function mergeBooks(builtinBooks, extraBooks = []) {
  const builtins = (builtinBooks || []).map((b, i) => {
    const name = b.name || `内置词书 ${i + 1}`;
    return {
      // 用名称生成稳定 id，保证跨练习页一致（词书记忆可跨页同步）
      id: `builtin-${slugify(name)}`,
      name,
      emoji: b.emoji || "⭐",
      kind: "builtin",
      count: b.words?.length || 0,
      words: b.words || [],
    };
  });
  // 附加词书（如错题本）排在最前，其次是内置练习、系统词书
  return [...extraBooks, ...builtins, ...getVocabBooks()];
}
