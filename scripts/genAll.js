#!/usr/bin/env node
/**
 * Vocabulary generator (v2)
 * Reads wordlist/*.txt files
 * Format per line: thai|pronunciation|chinese|POS|exampleThai|exampleChinese
 * Outputs src/data/vocabAllBooks.js
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORDLIST_DIR = join(__dirname, "wordlist");
const OUTPUT = join(__dirname, "..", "src", "data", "vocabAllBooks.js");

function guessPOS(thai, chinese) {
  if (/^(不|没有|没)/.test(chinese)) return "副词";
  if (/^(很|非常|太|真|最|更|比较)/.test(chinese)) return "副词";
  if (/^(和|与|但|但是|而且|或者|因为|所以|如果|虽然)/.test(chinese)) return "连词";
  if (/^(的|了|过|着|地|得|吗|呢|吧|啊|呀|สิ|นะ|ครับ|ค่ะ)/.test(chinese)) return "助词";
  if (/^(一|二|三|四|五|六|七|八|九|十|百|千|万)/.test(chinese)) return "数词";
  if (chinese.endsWith("吗") || chinese.endsWith("呢")) return "疑问词";
  if (/\?$/.test(chinese) || /？$/.test(chinese)) return "疑问词";
  if (/人$/.test(chinese) || /家$/.test(chinese) || /老师$/.test(chinese) ||
      /学生$/.test(chinese) || /医生$/.test(chinese) || /猫$/.test(chinese) ||
      /狗$/.test(chinese) || /水$/.test(chinese) || /饭$/.test(chinese) ||
      /书$/.test(chinese) || /手机$/.test(chinese) || /钱$/.test(chinese) ||
      /店$/.test(chinese) || /车$/.test(chinese) || /房$/.test(chinese) ||
      /菜$/.test(chinese) || /药$/.test(chinese) || /花$/.test(chinese) ||
      /树$/.test(chinese) || /鱼$/.test(chinese) || /肉$/.test(chinese) ||
      /路$/.test(chinese) || /门$/.test(chinese) || /窗$/.test(chinese) ||
      /桌$/.test(chinese) || /椅$/.test(chinese) || /床$/.test(chinese)) return "名词";
  if (/去$/.test(chinese) || /来$/.test(chinese) || /吃$/.test(chinese) ||
      /喝$/.test(chinese) || /看$/.test(chinese) || /听$/.test(chinese) ||
      /说$/.test(chinese) || /买$/.test(chinese) || /卖$/.test(chinese) ||
      /做$/.test(chinese) || /学$/.test(chinese) || /工作$/.test(chinese) ||
      /走$/.test(chinese) || /跑$/.test(chinese) || /坐$/.test(chinese) ||
      /站$/.test(chinese) || /睡$/.test(chinese) || /开$/.test(chinese) ||
      /关$/.test(chinese) || /给$/.test(chinese) || /拿$/.test(chinese) ||
      /写$/.test(chinese) || /打$/.test(chinese) || /玩$/.test(chinese) ||
      /住$/.test(chinese) || /用$/.test(chinese) || /穿$/.test(chinese) ||
      /洗$/.test(chinese) || /切$/.test(chinese) || /炒$/.test(chinese) ||
      /煮$/.test(chinese) || /蒸$/.test(chinese) || /烤$/.test(chinese)) return "动词";
  if (/大$/.test(chinese) || /小$/.test(chinese) || /好$/.test(chinese) ||
      /坏$/.test(chinese) || /多$/.test(chinese) || /少$/.test(chinese) ||
      /快$/.test(chinese) || /慢$/.test(chinese) || /新$/.test(chinese) ||
      /旧$/.test(chinese) || /贵$/.test(chinese) || /便宜$/.test(chinese) ||
      /热$/.test(chinese) || /冷$/.test(chinese) || /远$/.test(chinese) ||
      /近$/.test(chinese) || /高$/.test(chinese) || /低$/.test(chinese) ||
      /长$/.test(chinese) || /短$/.test(chinese) || /重$/.test(chinese) ||
      /轻$/.test(chinese) || /甜$/.test(chinese) || /辣$/.test(chinese) ||
      /酸$/.test(chinese) || /苦$/.test(chinese) || /咸$/.test(chinese) ||
      /香$/.test(chinese) || /美$/.test(chinese) || /丑$/.test(chinese) ||
      /胖$/.test(chinese) || /瘦$/.test(chinese) || /忙$/.test(chinese) ||
      /累$/.test(chinese) || /开心$/.test(chinese) || /难过$/.test(chinese)) return "形容词";
  if (/^在/.test(chinese) || /从/.test(chinese) || /到/.test(chinese) ||
      /上$/.test(chinese) || /下$/.test(chinese) || /里$/.test(chinese) ||
      /外$/.test(chinese) || /前$/.test(chinese) || /后$/.test(chinese) ||
      /左$/.test(chinese) || /右$/.test(chinese) || /旁边$/.test(chinese) ||
      /中间$/.test(chinese)) return "介词";
  return "名词";
}

function main() {
  mkdirSync(dirname(OUTPUT), { recursive: true });

  const files = readdirSync(WORDLIST_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  if (files.length === 0) {
    console.error("No .txt files in", WORDLIST_DIR);
    process.exit(1);
  }

  let allEntries = [];
  const stats = [];

  for (const file of files) {
    const bookName = file.replace(".txt", "");
    const lines = readFileSync(join(WORDLIST_DIR, file), "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.includes("|"));

    const entries = lines.map((line, i) => {
      const parts = line.split("|");
      const t = (parts[0] || "").trim();
      const pron = (parts[1] || "").trim();
      const c = (parts[2] || "").trim();
      const pos = (parts[3] || "").trim();
      const exThai = (parts[4] || "").trim();
      const exChinese = (parts[5] || "").trim();

      if (!t || !c || !/[\u0E00-\u0E7F]/.test(t)) return null;

      return {
        id: `gen-${bookName}-${String(i + 1).padStart(4, "0")}`,
        thai_word: t,
        pronunciation: pron || "",
        chinese_meaning: c,
        part_of_speech: pos || guessPOS(t, c),
        category: bookName,
        book: bookName,
        difficulty: "beginner",
        example_thai: exThai || "",
        example_chinese: exChinese || "",
        review_status: "verified",
      };
    }).filter(Boolean);

    allEntries = allEntries.concat(entries);
    stats.push({ book: bookName, count: entries.length });
  }

  // Deduplicate by thai_word, keep first occurrence
  const seen = new Set();
  const unique = [];
  for (const e of allEntries) {
    if (seen.has(e.thai_word)) continue;
    seen.add(e.thai_word);
    unique.push(e);
  }

  const header = `// Auto-generated by scripts/genAll.js\n// Total: ${unique.length} entries from ${files.length} books\n// Do NOT edit manually\n\nexport const vocabAllBooks = [\n`;
  const body = unique.map((e) => `  ${JSON.stringify(e)}`).join(",\n");
  const footer = "\n];\n";

  writeFileSync(OUTPUT, header + body + footer, "utf-8");
  console.log(`✅ Generated ${OUTPUT}`);
  console.log(`   Books: ${files.length}, Total: ${unique.length}`);
  for (const s of stats) console.log(`   ${s.book}: ${s.count}`);
}

main();
