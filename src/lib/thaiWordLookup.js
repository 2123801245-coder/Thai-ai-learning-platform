// src/lib/thaiWordLookup.js
// 泰语点词释义：把正文切分成词粒度 span，并提供泰语词查释义（收入词库命中）。
// 词源：vocabAllBooks（5883 词）+ localVocabulary（离线基础词库）。

import { vocabAllBooks } from "@/data/vocabAllBooks";
import { localVocabulary } from "@/data/vocabulary";

const THAI_RE = /[\u0e00-\u0e7f]/;

function buildLookup() {
  const map = new Map();
  const push = (w) => {
    if (!w || !w.thai || !w.chinese) return;
    const cur = map.get(w.thai);
    // 已有则保留（同形异义取第一个，保证稳定）
    if (cur) return;
    map.set(w.thai, w);
  };
  for (const v of vocabAllBooks || []) {
    push({
      thai: v?.w,
      roman: v?.p || "",
      chinese: v?.m || "",
      pos: v?.s || "",
      sentence: v?.t || "",
      sentenceCn: v?.c || "",
    });
  }
  for (const v of localVocabulary || []) {
    push({
      thai: v?.thai_word,
      roman: v?.pronunciation || "",
      chinese: v?.chinese_meaning || "",
      pos: v?.part_of_speech || "",
      sentence: v?.example_thai || "",
      sentenceCn: v?.example_chinese || "",
    });
  }
  return map;
}

const LOOKUP = buildLookup();

// 按字长降序的词条候选（贪心最长匹配更准），以及候选词首字集合
const CANDIDATES = [...new Set(LOOKUP.keys())].sort(
  (a, b) => b.length - a.length
);
const CAND_STARTS = new Set(CANDIDATES.map((w) => w[0]));

/* 查询单个泰语词，命中返回 {thai, roman, chinese, pos, sentence, sentenceCn}，未命中返回 null */
export function lookupThaiWord(thai) {
  if (!thai || !THAI_RE.test(thai)) return null;
  return LOOKUP.get(thai) || null;
}

/* 把一个混合文本（泰语 + 中英/标点）切分为词粒度 span。
   返回 [{ text, thai:boolean, info:{...}|null }]
   仅词典命中且 info 存在的词可点。 */
export function segmentThaiText(text) {
  if (!text) return [];
  const spans = [];
  const runRe = /[\u0e00-\u0e7f]+|[^\u0e00-\u0e7f]+/g;
  let m;
  while ((m = runRe.exec(text))) {
    const part = m[0];
    if (!THAI_RE.test(part)) {
      spans.push({ text: part, thai: false, info: null });
    } else {
      spans.push(...segmentThaiRun(part));
    }
  }
  return spans;
}

function segmentThaiRun(run) {
  const spans = [];
  let i = 0;
  let unknown = ""; // 缓存无法识别的连续泰文字符（渲染为一整段，不可点）
  const flushUnknown = () => {
    if (unknown) {
      spans.push({ text: unknown, thai: true, info: null });
      unknown = "";
    }
  };

  while (i < run.length) {
    const ch = run[i];
    if (CAND_STARTS.has(ch)) {
      let matched = null;
      for (const w of CANDIDATES) {
        if (run.startsWith(w, i)) {
          matched = w;
          break;
        }
      }
      if (matched) {
        flushUnknown();
        spans.push({ text: matched, thai: true, info: LOOKUP.get(matched) || null });
        i += matched.length;
        continue;
      }
    }
    unknown += ch;
    i += 1;
  }
  flushUnknown();
  return spans;
}

/* 提闲聊的泰语文本中可识别的词（用于统计/调试，非必需） */
export function knownThaiWordsIn(text) {
  return segmentThaiText(text)
    .filter((s) => s.thai && s.info)
    .map((s) => s.info);
}
