// 今日一句 / 泰语小知识 个性化选取的验收脚本
// 跑法：npx esbuild .check-daily.mjs --bundle --platform=node --format=esm \
//        --outfile=/tmp/check-daily.mjs --loader:.jsx=jsx --log-level=error && node /tmp/check-daily.mjs

// 模拟浏览器：引擎靠 localStorage 记住「最近看过」，node 里得先补上
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = { dispatchEvent: () => {} };
}

import {
  levelBand,
  profileTopics,
  rememberPick,
  scoreContent,
  selectDaily,
  todayKey,
} from "@/lib/dailyContent";
import { DAILY_SENTENCES, THAI_TIPS } from "@/data/dailyContent";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`);
  }
};

const PROFILES = {
  "A0 · 无画像（新用户）": null,
  "A0 · 零基础 + 旅行": { thaiLevel: "A0", learningGoal: "travel", mediaInterest: ["travel", "food"] },
  "A2 · 泰剧迷": { thaiLevel: "A2", learningGoal: "drama", mediaInterest: ["drama", "song"] },
  "A2 · 商务/管理": { thaiLevel: "A2", learningGoal: "business", professionalDirection: ["business"], mediaInterest: ["news"] },
  "B1 · 泰国留学": { thaiLevel: "B1", learningGoal: "study", professionalDirection: ["academic"], mediaInterest: ["novel"] },
  "B2 · 新闻从业": { thaiLevel: "B2", learningGoal: "culture", professionalDirection: ["news", "newmedia"], mediaInterest: ["news", "tiktok"] },
  "C1 · 精通": { thaiLevel: "C1", learningGoal: "major", professionalDirection: ["academic"], mediaInterest: ["news"] },
};

console.log("\n=== 1. 各画像当天选中的内容 ===");
const picks = {};

for (const [label, profile] of Object.entries(PROFILES)) {
  const r = selectDaily(profile, { date: new Date("2026-09-19T09:00:00"), seed: "u63" });
  picks[label] = r;
  console.log(
    `\n${label}  [等级 ${r.level} · 标签 ${r.topics.join("/") || "无"}]\n` +
      `   一句: ${r.sentence.id} [${r.sentence.level}] ${r.sentence.thai.split("\n")[0].slice(0, 26)}\n` +
      `         → ${r.reason.sentence}\n` +
      `   知识: ${r.tip.id} [${r.tip.level}] ${r.tip.title.slice(0, 30)}\n` +
      `         → ${r.reason.tip}`
  );
}

console.log("\n=== 2. 断言 ===");

// 等级适配
for (const [label, profile] of Object.entries(PROFILES)) {
  const r = picks[label];
  const band = levelBand(r.level);
  ok(
    `${label}：两条都在 ${band.join("/")} 区间内`,
    band.includes(r.sentence.level) && band.includes(r.tip.level),
    `一句 ${r.sentence.level} · 知识 ${r.tip.level}`
  );
}

// 兴趣真的生效：商务画像拿到商务标签，泰剧画像命中泰剧
const biz = picks["A2 · 商务/管理"];
ok(
  "商务画像：命中商务/新闻标签",
  biz.sentence.topics.some((t) => ["商务", "新闻"].includes(t)) ||
    biz.tip.topics.some((t) => ["商务", "新闻"].includes(t)),
  `一句 ${biz.sentence.topics.join("/")} · 知识 ${biz.tip.topics.join("/")}`
);

const drama = picks["A2 · 泰剧迷"];
ok(
  "泰剧画像：命中泰剧/音乐标签",
  drama.sentence.topics.some((t) => ["泰剧", "音乐"].includes(t)) ||
    drama.tip.topics.some((t) => ["泰剧", "音乐"].includes(t)),
  `一句 ${drama.sentence.topics.join("/")} · 知识 ${drama.tip.topics.join("/")}`
);

const travel = picks["A0 · 零基础 + 旅行"];
ok(
  "A0 旅行画像：拿到 A0/A1 的旅行向内容",
  ["A0", "A1"].includes(travel.sentence.level) &&
    travel.sentence.topics.some((t) => ["旅行", "美食"].includes(t)),
  `一句 ${travel.sentence.id} [${travel.sentence.level}] ${travel.sentence.topics.join("/")}`
);

// 人群之间不再「同一条」
const sentenceIds = new Set(Object.values(picks).map((r) => r.sentence.id));
const tipIds = new Set(Object.values(picks).map((r) => r.tip.id));
ok("7 种画像里今日一句不唯一", sentenceIds.size >= 3, `不同句子 ${sentenceIds.size} 条`);
ok("7 种画像里小知识不唯一", tipIds.size >= 3, `不同知识点 ${tipIds.size} 条`);

// 无画像用户看到的是起步向内容
const guest = picks["A0 · 无画像（新用户）"];
ok(
  "无画像：退回到起步难度且文案提示去做测试",
  ["A0", "A1", "A2"].includes(guest.sentence.level) && guest.reason.tip.includes("入学测试"),
  guest.reason.tip
);

// 同一天同一个人稳定
const again = selectDaily(PROFILES["A2 · 泰剧迷"], {
  date: new Date("2026-09-19T23:30:00"),
  seed: "u63",
});
ok(
  "同一天刷新结果不变（含当天深夜）",
  again.sentence.id === drama.sentence.id && again.tip.id === drama.tip.id,
  `${again.sentence.id} / ${again.tip.id}`
);

// 跨天会换 + 连续 10 天不出现「隔天重复」
console.log("\n=== 3. 连续 10 天（A2 泰剧迷，模拟真实 localStorage 记忆）===");
localStorage.clear();
const seen = [];
let consecutiveRepeat = 0;
for (let day = 0; day < 10; day++) {
  const date = new Date(2026, 8, 19 + day, 10, 0, 0);
  const r = selectDaily(PROFILES["A2 · 泰剧迷"], { date, seed: "u63" });
  const prev = seen[seen.length - 1];
  if (prev) {
    if (prev.sentence === r.sentence.id) consecutiveRepeat++;
    if (prev.tip === r.tip.id) consecutiveRepeat++;
  }
  // 模拟浏览器：看了才记住（Hook 里的 useEffect 干的就是这件事）
  rememberPick(r.dateKey, { sentenceId: r.sentence.id, tipId: r.tip.id });
  seen.push({ date: todayKey(date), sentence: r.sentence.id, tip: r.tip.id });
  console.log(`   ${todayKey(date)}  一句 ${r.sentence.id}  知识 ${r.tip.id}`);
}
ok("连续 10 天不出现隔天重复", consecutiveRepeat === 0, `重复次数 ${consecutiveRepeat}`);
ok(
  "连续 10 天内容有变化",
  new Set(seen.map((s) => s.sentence)).size >= 3 &&
    new Set(seen.map((s) => s.tip)).size >= 3,
  `一句 ${new Set(seen.map((s) => s.sentence)).size} 种 / 知识 ${new Set(seen.map((s) => s.tip)).size} 种`
);

// 画像切换后内容跟着变（这是产品要的「按人挑选」）
const before = selectDaily(PROFILES["A2 · 商务/管理"], { date: new Date("2026-09-19"), seed: "u63" });
const after = selectDaily(
  { ...PROFILES["A2 · 商务/管理"], mediaInterest: ["drama"], learningGoal: "drama" },
  { date: new Date("2026-09-19"), seed: "u63" }
);
ok(
  "同一用户改兴趣后内容/理由跟着变",
  before.tip.id !== after.tip.id || before.reason.tip !== after.reason.tip,
  `${before.tip.id}(${before.reason.tip}) → ${after.tip.id}(${after.reason.tip})`
);

/* =========================================================
   4. 兴趣内容池深度：泰剧 / 音乐 / 新闻
   -------------------------------------------------------
   两张卡各自从自己的池子里选（今日一句 ← DAILY_SENTENCES，
   小知识 ← THAI_TIPS），所以「够不够用」必须按池子分别算。
========================================================= */

console.log("\n=== 4. 兴趣内容池深度 ===");

const INTEREST_TOPICS = ["泰剧", "音乐", "新闻"];
const ALL_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"];
const POOLS = { "一句": DAILY_SENTENCES, "知识": THAI_TIPS };

for (const topic of INTEREST_TOPICS) {
  for (const [poolName, pool] of Object.entries(POOLS)) {
    const tagged = pool.filter((x) => (x.topics || []).includes(topic));

    ok(
      `${topic} · ${poolName}池 ≥ 15 条`,
      tagged.length >= 15,
      `${tagged.length} 条（合计 ${new Set(tagged.map((x) => x.id)).size}）`
    );

    // 每个等级带（±1）都要有 ≥4 条：
    // 否则 topPool 可能只剩 1~2 条，当选内容就绕不出这几条
    const widths = ALL_LEVELS.map(
      (level) =>
        tagged.filter((x) => levelBand(level).includes(x.level)).length
    );
    const minWidth = Math.min(...widths);
    ok(
      `${topic} · ${poolName}池每个等级带（±1）≥4 条`,
      minWidth >= 4,
      widths.map((w, i) => `${ALL_LEVELS[i]}:${w}`).join(" ")
    );

    // 等级不能堆在一个级别上，否则高等级用户直接无料可用
    const levels = new Set(tagged.map((x) => x.level));
    ok(
      `${topic} · ${poolName}池覆盖 ≥4 个等级`,
      levels.size >= 4,
      [...levels].sort().join("/")
    );
  }
}

/* =========================================================
   5. 30 天轮换：三个兴趣都不回落到通用内容
========================================================= */

console.log("\n=== 5. 30 天轮换（是否回落到通用内容）===");

const INTEREST_PROFILES = {
  "A2 泰剧迷": {
    topic: "泰剧",
    profile: { thaiLevel: "A2", learningGoal: "drama", mediaInterest: ["drama"] },
  },
  "A1 听歌党": {
    topic: "音乐",
    profile: { thaiLevel: "A1", learningGoal: "music", mediaInterest: ["song"] },
  },
  "B1 新闻向": {
    topic: "新闻",
    // 纯新闻兴趣：学习目标不去叠「文化」标签，
    // 否则结果是「文化 + 新闻」的合理混合，不能用来测「会不会回落」
    profile: {
      thaiLevel: "B1",
      professionalDirection: ["news"],
      mediaInterest: ["news"],
    },
  },
};

for (const [label, { topic, profile }] of Object.entries(INTEREST_PROFILES)) {
  localStorage.clear();
  const days = [];
  for (let day = 0; day < 30; day++) {
    const date = new Date(2026, 8, 1 + day, 10, 0, 0);
    const r = selectDaily(profile, { date, seed: "u63" });
    days.push({
      sentence: r.sentence,
      tip: r.tip,
      sentenceHit: (r.sentence.topics || []).includes(topic),
      tipHit: (r.tip.topics || []).includes(topic),
    });
    // 模拟浏览器：只看过的才记入最近窗口
    rememberPick(r.dateKey, { sentenceId: r.sentence.id, tipId: r.tip.id });
  }

  const sentenceHits = days.filter((d) => d.sentenceHit).length;
  const tipHits = days.filter((d) => d.tipHit).length;
  const distinctSentence = new Set(days.map((d) => d.sentence.id)).size;
  const distinctTip = new Set(days.map((d) => d.tip.id)).size;
  const maxLength = Math.max(
    ...days.map((d) => d.sentence.thai.length)
  );
  const immediate = days.filter(
    (d, i) =>
      i > 0 &&
      (days[i - 1].sentence.id === d.sentence.id ||
        days[i - 1].tip.id === d.tip.id)
  ).length;

  console.log(
    `   ${label}：一句命中 ${topic} ${sentenceHits}/30（${distinctSentence} 种）· ` +
      `知识命中 ${topic} ${tipHits}/30（${distinctTip} 种）· 最长句 ${maxLength} 字`
  );

  ok(
    `${label}：30 天里一句 ≥21 天命中「${topic}」`,
    sentenceHits >= 21,
    `${sentenceHits}/30`
  );
  ok(
    `${label}：30 天里知识 ≥21 天命中「${topic}」`,
    tipHits >= 21,
    `${tipHits}/30`
  );
  ok(
    `${label}：一句 ≥10 种、知识 ≥10 种（说明没在少数几条里打转）`,
    distinctSentence >= 10 && distinctTip >= 10,
    `一句 ${distinctSentence} 种 / 知识 ${distinctTip} 种`
  );
  ok(`${label}：30 天无隔天重复`, immediate === 0, `重复 ${immediate} 次`);
}

// 高等级用户不会被喂入门条目：C1 用户看到的句子长度应在水线以上
const c1 = selectDaily(
  { thaiLevel: "C1", learningGoal: "major", professionalDirection: ["academic"] },
  { date: new Date(2026, 8, 19), seed: "u63" }
);
ok(
  "C1 用户不会拿到 A0 入门条目",
  ["B1", "B2", "C1"].includes(c1.sentence.level) &&
    ["B1", "B2", "C1"].includes(c1.tip.level),
  `一句 ${c1.sentence.level} · 知识 ${c1.tip.level}`
);

// 打分函数本身：兴趣命中优先于「等级刚好同级」
const sameLevelGeneric = { id: "x1", level: "A2", topics: ["基础"] };
const adjacentInterest = { id: "x2", level: "A1", topics: ["泰剧"] };
ok(
  "相邻等级的兴趣条目分数 ≥ 同级的通用条目",
  scoreContent(adjacentInterest, { level: "A2", topics: ["泰剧"] }) >=
    scoreContent(sameLevelGeneric, { level: "A2", topics: ["泰剧"] }),
  `兴趣 A1=${scoreContent(adjacentInterest, { level: "A2", topics: ["泰剧"] })} vs 通用 A2=${scoreContent(sameLevelGeneric, { level: "A2", topics: ["泰剧"] })}`
);

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
