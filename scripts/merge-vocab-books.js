const fs = require('fs');
const path = require('path');
const file = 'src/data/vocabAllBooks.js';
const m = fs.readFileSync(file, 'utf8');
const start = m.indexOf('[');
const end = m.lastIndexOf(']');
const arr = JSON.parse(m.slice(start, end + 1));
const seen = new Map();
for (const e of arr) { if (!seen.has(e.w)) seen.set(e.w, e); }
const newBooks = ['食物泰语', '职业泰语'];
let added = 0, skipped = 0;
for (const book of newBooks) {
  const lines = fs.readFileSync(path.join('scripts/data', book + '.txt'), 'utf8')
    .split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!Array.isArray(e) || e.length < 8) { console.error('BAD:', line); continue; }
    const entry = { w: e[0], p: e[1], m: e[2], s: e[3], b: e[4], d: e[5], t: e[6], c: e[7] };
    if (seen.has(entry.w)) { skipped++; continue; }
    seen.set(entry.w, entry);
    arr.push(entry);
    added++;
  }
}
fs.writeFileSync(file, 'export const vocabAllBooks = ' + JSON.stringify(arr) + ';\n');
console.log('本次新增:', added, '跳过:', skipped, '总词数:', arr.length);
