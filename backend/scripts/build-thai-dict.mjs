// backend/scripts/build-thai-dict.mjs
//
// ============================================================
// 生成 backend/data/thaiDict.json（泰语 → 罗马音 + 中文释义）
// ============================================================
//
// 数据源是前端已有的三份词库（唯一数据源不复制内容，只是给后端
// /api/thai/segment 一份可查的拷贝）：
//
//   src/data/vocabAllBooks.js            ~6000 条（w/p/m/s 字段）
//   src/data/vocabulary.js                ~460 条（thai_word/pronunciation/...）
//   src/data/verifiedVocabularyBatch.js   ~100 条（同上，人工校对过）
//
// 运行：node backend/scripts/build-thai-dict.mjs
// 重新生成即可同步最新词库；输出文件提交进仓库，后端无需访问 src/。

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "backend", "data", "thaiDict.json");

/* ── 读取三种形状的词库 ── */

function readVocabAllBooks() {
  const src = readFileSync(join(ROOT, "src/data/vocabAllBooks.js"), "utf8");
  const start = src.indexOf("[");
  const end = src.lastIndexOf("]") + 1;
  const arr = JSON.parse(src.slice(start, end));
  // { w, p, m, s } → 泰语词 / 罗马音 / 中文 / 词性
  return arr
    .filter((e) => e?.w && e?.m)
    .map((e) => ({ th: String(e.w).trim(), roman: String(e.p || "").trim(), cn: String(e.m).trim(), pos: String(e.s || "").trim() }));
}

function readNamedExports(file, exportName) {
  const src = readFileSync(join(ROOT, "src/data", file), "utf8");
  const marker = `export const ${exportName}`;
  const start = src.indexOf("[", marker ? src.indexOf(marker) : 0);
  const end = src.lastIndexOf("]") + 1;
  if (start < 0 || end <= start) return [];
  // 数组里是 JS 对象字面量（键没引号），用 Function 求值最省事
  const literal = src.slice(start, end);
  const arr = new Function(`return (${literal});`)();
  return arr
    .filter((e) => e?.thai_word && e?.chinese_meaning)
    .map((e) => ({
      th: String(e.thai_word).trim(),
      roman: String(e.pronunciation || "").trim(),
      cn: String(e.chinese_meaning).trim(),
      pos: String(e.part_of_speech || "").trim(),
    }));
}

/* ── 合并（先到的优先：verified > vocabulary > allBooks） ── */

const dict = new Map();
const put = (entry) => {
  if (!entry.th || !entry.cn) return;
  if (!dict.has(entry.th)) dict.set(entry.th, entry);
};

readNamedExports("verifiedVocabularyBatch.js", "verifiedVocabularyBatch").forEach(put);
readNamedExports("vocabulary.js", "localVocabulary").forEach(put);
readVocabAllBooks().forEach(put);

const payload = {
  generated_at: new Date().toISOString(),
  count: dict.size,
  entries: [...dict.values()],
};

mkdirSync(join(ROOT, "backend", "data"), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));

console.log(`thaiDict.json: ${payload.count} 词条 → ${OUT}`);
