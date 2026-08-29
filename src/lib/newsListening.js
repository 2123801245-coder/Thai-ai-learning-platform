// src/lib/newsListening.js
//
// 每日 ThaiPBS 新闻 → 听力练习工具
//
//   - splitNewsSentences：把一条新闻（标题 + 导语）切成可朗读的短句单元
//   - buildCloze：为句子生成「听音填空」题（挖掉一个词 + 4 个选项）
//
// 泰语分词（混合策略）：
//   1. 词典最长匹配：用统一词库（localVocabulary + expandedVocabulary +
//      vocabAllBooks，共 5000+ 词）做最长匹配，词典里真实存在的词优先
//      成为完整词块，挖空目标也优先选词典词（带译文/注音提示）。
//   2. 前置元音规则回退：词典匹配不到的位置，用泰语音节规则切块
//      （เ แ โ ใ ไ 是音节首，上下标元音/声调不能开头；前一音节以
//      元音收尾时与前置元音合并，如 ระ+เบิด → ระเบิด），保证不切破音节。
//
// 这样挖出的空：优先是词典里的真实词（更自然、干扰项更有教学意义），
// 词典覆盖不到的名词/数字串则保持完整音节块（不会出现「半词残片」）。

import { localVocabulary } from "@/data/vocabulary";
import { expandedVocabulary } from "@/data/vocabularyExpansion";
import { vocabAllBooks } from "@/data/vocabAllBooks";

/* ============================================================
   工具
============================================================ */

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const THAI_PUNCT = /[。？！!?…\n]/;

/* ============================================================
   句子切分
   返回 [{ id, thai, zh, roman, isTitle }]
   - 标题单独一个单元（带完整译文/注音）
   - 导语按标点 + 空格切成朗读单元；译文/注音只保留整段参考
============================================================ */

export function splitNewsSentences(item) {
  const units = [];
  let seq = 0;

  const push = (thai, zh, roman, isTitle) => {
    const t = String(thai || "").trim();
    if (!t) return;
    units.push({
      id: `s-${seq++}`,
      thai: t,
      zh: zh || "",
      roman: roman || "",
      isTitle: !!isTitle,
    });
  };

  // 标题：整体一个单元（通常较短）
  if (item.title) {
    push(item.title, item.zh_title, item.roman_title, true);
  }

  // 导语：按标点切块，再按空格切分长块
  if (item.lede) {
    const lede = String(item.lede).trim();
    // 1) 先按句末标点切开
    const sentencePieces = lede
      .split(THAI_PUNCT)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const piece of sentencePieces) {
      // 2) 长块（> 40 字符）按空格切成短语单元，短的整块保留
      if (Array.from(piece).length <= 40) {
        push(piece, item.zh_lede, item.roman_lede, false);
        continue;
      }
      const chunks = piece.split(/\s+/).filter(Boolean);
      let buf = "";
      for (const ch of chunks) {
        const next = buf ? `${buf} ${ch}` : ch;
        if (Array.from(next).length > 40 && buf) {
          push(buf, item.zh_lede, item.roman_lede, false);
          buf = ch;
        } else {
          buf = next;
        }
      }
      if (buf) push(buf, item.zh_lede, item.roman_lede, false);
    }
  }

  return units;
}

/* ============================================================
   泰语字符类
============================================================ */

// 泰文音节字符（辅音/元音/声调）
const THAI_CHAR = /[\u0E00-\u0E7F]/;

// 泰语前置元音：เ แ โ ใ ไ 总是出现在音节/词的开头
const THAI_LEAD_VOWEL = /[\u0E40-\u0E44]/;

// 泰语元音（ะ ั า ำ ิ ี ึ ื ุ ู ฺ ็ ํ ฯลฯ）与声调：音节的一部分，不可能是音节首
const THAI_MID_VOWEL = /[\u0E30-\u0E3A\u0E47\u0E4C\u0E4D\u0E4E]/;

// 泰文声调符号（可附着在上标元音后）
const THAI_TONE = /[\u0E48-\u0E4B]/;

/* ============================================================
   统一词典：localVocabulary + expandedVocabulary + vocabAllBooks
   - DICT_BY_CHAR：首字符 → 词条（按长度降序，供最长匹配）
   - DICT_INFO：词 → { chinese, pronunciation, difficulty, category }
   - DICT_WORDS：去重后的全部词（供干扰项）
============================================================ */

function normalizeDictEntry(word, pron, meaning, difficulty, category) {
  const w = String(word || "").trim();
  if (!w || Array.from(w).length < 2 || /\s/.test(w)) return null;
  const chars = Array.from(w);
  if (!THAI_CHAR.test(chars[0])) return null;
  return {
    str: w,
    chars,
    charsLen: chars.length,
    pron,
    meaning,
    difficulty,
    category,
  };
}

const DICT = (() => {
  const byChar = new Map();
  const info = new Map();

  const add = (e) => {
    if (!e) return;
    const first = e.chars[0];
    if (!byChar.has(first)) byChar.set(first, []);
    byChar.get(first).push(e);

    // info 合并：来源顺序 local → expanded → allBooks，优先保留已有字段
    const existing = info.get(e.str);
    if (!existing) {
      info.set(e.str, {
        chinese: e.meaning || "",
        pronunciation: e.pron || "",
        difficulty: e.difficulty || "",
        category: e.category || "",
      });
    } else {
      if (!existing.chinese && e.meaning) existing.chinese = e.meaning;
      if (!existing.pronunciation && e.pron) existing.pronunciation = e.pron;
      if (!existing.difficulty && e.difficulty) existing.difficulty = e.difficulty;
      if (!existing.category && e.category) existing.category = e.category;
    }
  };

  for (const v of localVocabulary) {
    add(normalizeDictEntry(v.thai_word, v.pronunciation, v.chinese_meaning, v.difficulty, v.category));
  }
  for (const v of expandedVocabulary) {
    add(normalizeDictEntry(v.thai_word, v.pronunciation, v.chinese_meaning, v.difficulty, v.category));
  }
  for (const v of vocabAllBooks) {
    add(normalizeDictEntry(v.w, v.p, v.m, v.d, v.b));
  }

  for (const list of byChar.values()) {
    list.sort((a, b) => b.charsLen - a.charsLen);
  }

  return { byChar, info, words: [...info.keys()] };
})();

const DICT_BY_CHAR = DICT.byChar;
const DICT_INFO = DICT.info;
const DICT_WORDS = DICT.words;

/* ============================================================
   从位置 i 开始做词典最长匹配
   返回 { str, charsLen, info } | null
============================================================ */

function longestDictMatch(chars, i) {
  const list = DICT_BY_CHAR.get(chars[i]);
  if (!list) return null;
  for (const entry of list) {
    if (i + entry.charsLen > chars.length) continue;
    let ok = true;
    for (let k = 0; k < entry.charsLen; k++) {
      if (chars[i + k] !== entry.chars[k]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return {
        str: entry.str,
        charsLen: entry.charsLen,
        info: DICT_INFO.get(entry.str) || null,
      };
    }
  }
  return null;
}

/* ============================================================
   混合分词（核心）
   返回 token 数组：{ text, start, end, isDict, info }
   - start / end 为码点索引（与 Array.from 一致），可直接定位替换
============================================================ */

export function segmentThaiDetailed(text) {
  const chars = Array.from(text);
  const tokens = [];
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    // 非泰文字符（空格 / 数字 / 标点）：整体一个 token，不参与挖空
    if (!THAI_CHAR.test(c)) {
      let j = i + 1;
      while (j < chars.length && !THAI_CHAR.test(chars[j])) j++;
      tokens.push({
        text: chars.slice(i, j).join(""),
        start: i,
        end: j,
        isDict: false,
        info: null,
      });
      i = j;
      continue;
    }

    // 1) 词典最长匹配
    const m = longestDictMatch(chars, i);
    if (m) {
      tokens.push({
        text: m.str,
        start: i,
        end: i + m.charsLen,
        isDict: true,
        info: m.info,
      });
      i += m.charsLen;
      continue;
    }

    // 2) 前置元音规则回退：吃一个音节块
    //    遇到前置元音时判断：前一音节以元音/声调收尾 → 属于音节中段，合并；
    //    否则是新的音节起点，在此截断。
    let j = i + 1;
    while (j < chars.length && THAI_CHAR.test(chars[j])) {
      const cj = chars[j];
      if (!THAI_LEAD_VOWEL.test(cj)) {
        j++;
        continue;
      }
      const prev = chars.slice(i, j).join("");
      const prevChars = Array.from(prev);
      const last = prevChars[prevChars.length - 1] || "";
      const secondLast =
        prevChars.length >= 2 ? prevChars[prevChars.length - 2] : "";
      const prevIsVowelEnd =
        THAI_MID_VOWEL.test(last) || THAI_TONE.test(last);
      const prevIsLeadVowel = THAI_LEAD_VOWEL.test(last);
      const isCompound =
        prevIsVowelEnd && secondLast && !THAI_LEAD_VOWEL.test(secondLast);
      if (prevIsLeadVowel || isCompound) {
        // 音节中段 → 合并，继续吃
        j++;
        continue;
      }
      // 真正的音节边界：前置元音开新块，截断
      break;
    }

    tokens.push({
      text: chars.slice(i, j).join(""),
      start: i,
      end: j,
      isDict: false,
      info: null,
    });
    i = j;
  }

  return tokens;
}

/* 兼容旧接口：返回纯泰语词块数组 */
export function segmentThai(text) {
  return segmentThaiDetailed(text)
    .filter((t) => THAI_CHAR.test(t.text))
    .map((t) => t.text);
}

/* 从分好的块里挑一个适合挖空的词块（2~8 字符、优先含元音的完整块）
   旧接口保留（新路径走 pickClozeToken，更偏向词典词） */
export function pickClozeBlock(blocks) {
  const good = blocks.filter(
    (b) => Array.from(b).length >= 2 && Array.from(b).length <= 8
  );
  if (good.length) {
    const middle =
      good.length >= 3
        ? good.slice(1, good.length - 1)
        : good;
    return middle[Math.floor(Math.random() * middle.length)];
  }
  return blocks.length ? blocks[0] : null;
}

/* 在句子中查找「词库中存在的词」（旧接口保留）
   新路径由 segmentThaiDetailed 的词典最长匹配替代 */
export function findKnownWords(sentence) {
  const sorted = [...localVocabulary]
    .filter((v) => v.thai_word && v.thai_word.length >= 2)
    .sort((a, b) => b.thai_word.length - a.thai_word.length);

  const found = [];
  let rest = sentence;
  const occupied = [];

  for (const v of sorted) {
    let searchFrom = 0;
    while (searchFrom < rest.length) {
      const idx = rest.indexOf(v.thai_word, searchFrom);
      if (idx < 0) break;
      const end = idx + v.thai_word.length;
      const overlaps = occupied.some(
        ([s, e]) => idx < e && s < end
      );
      if (!overlaps) {
        found.push({
          word: v.thai_word,
          chinese: v.chinese_meaning || "",
          pronunciation: v.pronunciation || "",
          category: v.category || "",
          difficulty: v.difficulty || "",
          start: idx,
        });
        occupied.push([idx, end]);
        rest = rest.slice(0, idx) + "_".repeat(v.thai_word.length) + rest.slice(end);
        break;
      }
      searchFrom = idx + 1;
    }
    if (found.length >= 4) break;
  }
  return found;
}

/* ============================================================
   挖空目标选择
   评分：词典词 ≫ 回退块；句中位置加分；语气词 / 无辅音残片降权
   最高分区间内随机取一个（避免每句总挖同一处）
============================================================ */

const PARTICLE_PENALTY = new Set([
  "ครับ", "ค่ะ", "คับ", "จ้า", "นะ", "เถอะ", "ล่ะ", "ละ",
  "เนอะ", "จ๊ะ", "จ้ะ", "หน่อย", "ได้เลย",
]);

function pickClozeToken(candidates) {
  if (!candidates.length) return null;

  const scored = candidates.map((t, idx) => {
    const text = t.text;
    const len = Array.from(text).length;
    let score = 0;

    if (t.isDict) score += 100;
    if (t.info?.chinese) score += 10;
    score += Math.min(6, len) * 2; // 稍长更有内容
    if (idx > 0 && idx < candidates.length - 1) score += 8; // 句中
    if (PARTICLE_PENALTY.has(text)) score -= 50;
    if (!/[\u0E01-\u0E2E]/.test(text)) score -= 30; // 不含辅音 → 残片

    return { t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0].score;
  const best = scored.filter((s) => s.score >= top - 5);
  return best[Math.floor(Math.random() * best.length)].t;
}

/* ============================================================
   构造 4 个选项：正确答案 + 3 个干扰项（排除正确答案）
   从统一词典取：优先同难度 + 长度相近；不足时放宽
============================================================ */

export function buildDistractors(correctWord, count = 3) {
  const correct = DICT_INFO.get(correctWord);
  const cLen = Array.from(correctWord).length;

  const all = DICT_WORDS.filter(
    (w) => w !== correctWord && Array.from(w).length >= 2
  );

  // 同难度优先
  const diff = correct?.difficulty || "";
  let candidates = diff
    ? all.filter((w) => DICT_INFO.get(w).difficulty === diff)
    : all;
  if (candidates.length < count) candidates = all;

  // 长度相近优先（±1），随机取 count 个
  const lengthNear = candidates
    .map((w) => ({ w, d: Math.abs(Array.from(w).length - cLen) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 40);

  return shuffle(lengthNear)
    .slice(0, count)
    .map((p) => p.w);
}

/* 替换句子中第一个「独立出现」的目标词（前后不是泰文字符）
   保底用：segmentThaiDetailed 已给出精确区间，通常不会走到这里 */
function replaceFirstStandalone(sentence, target, replacement) {
  const tLen = Array.from(target).length;
  const chars = Array.from(sentence);
  for (let i = 0; i <= chars.length - tLen; i++) {
    const slice = chars.slice(i, i + tLen).join("");
    if (slice !== target) continue;
    const before = i > 0 ? chars[i - 1] : "";
    const after = i + tLen < chars.length ? chars[i + tLen] : "";
    if (!THAI_CHAR.test(before) && !THAI_CHAR.test(after)) {
      return (
        chars.slice(0, i).join("") +
        replacement +
        chars.slice(i + tLen).join("")
      );
    }
  }
  return sentence.replace(target, replacement);
}

/* ============================================================
   生成听音填空：挖掉一个目标词，返回题目对象
   {
     sentence, clozeText, answer, options: [4], hintChinese, hintRoman
   }
   目标选择：词典最长匹配优先（带译文/注音提示），
   词典覆盖不到时回退到音节块（前置元音规则，不切破音节）
============================================================ */

export function buildCloze(sentence, { forceWord } = {}) {
  const tokens = segmentThaiDetailed(sentence);

  // 候选：泰语词块、长度 2~8
  const candidates = tokens.filter((t) => {
    if (!THAI_CHAR.test(t.text)) return false;
    const len = Array.from(t.text).length;
    return len >= 2 && len <= 8;
  });

  let target = null;

  if (forceWord) {
    target = { text: String(forceWord) };
  } else {
    target = pickClozeToken(candidates);
  }

  if (!target) return null; // 句子太短没法挖

  // 精确替换目标区间（优先用分词给出的起止位置）
  let clozeText;
  if (
    typeof target.start === "number" &&
    typeof target.end === "number"
  ) {
    const chars = Array.from(sentence);
    clozeText =
      chars.slice(0, target.start).join("") +
      "____" +
      chars.slice(target.end).join("");
  } else {
    clozeText = replaceFirstStandalone(sentence, target.text, "____");
  }

  const info = DICT_INFO.get(target.text) || null;

  const options = shuffle([
    target.text,
    ...buildDistractors(target.text, 3),
  ]);

  return {
    sentence,
    clozeText,
    answer: target.text,
    options,
    hintChinese: info?.chinese || "",
    hintRoman: info?.pronunciation || "",
  };
}

/* ============================================================
   把新闻整条构造成练习数据
   { id, title, units: [...], clozeSet: [...], date }
============================================================ */

export function buildNewsExercise(item) {
  const units = splitNewsSentences(item);

  const clozeSet = units
    .map((u) => {
      const cloze = buildCloze(u.thai);
      return cloze ? { unit: u, cloze } : null;
    })
    .filter(Boolean);

  return {
    id: item.id,
    title: item.title || "",
    url: item.url || "",
    category: item.category || "",
    date: item.pub_at || "",
    units,
    clozeSet,
  };
}
