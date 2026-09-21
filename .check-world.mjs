// .check-world.mjs —— ThaiAI World 数据映射层断言
//
// 用法（源文件里有 `@/` 别名，所以先用 esbuild 解析别名再跑）：
//   npx esbuild .check-world.mjs --bundle --platform=node --format=cjs \
//     --outfile=/tmp/check-world.cjs --alias:@=./src \
//     --define:import.meta.env='{"MODE":"production","DEV":false,"PROD":true}' \
//     && node /tmp/check-world.cjs
//
// ⚠️ 必须是 cjs + 上面的 define，不能换回 esm：
//   esm —— 这条链现在会走到 axios（worldData → placement → wordBooks →
//           @base44/sdk），它的 CJS 依赖 require('util') 在 ESM 产物里会抛
//           “Dynamic require of \"util\" is not supported”；
//   cjs —— 但 src 里多处读 import.meta.env（lib/api.js、data/lessonAudio.js、
//           api/base44Client.js），不 define 会直接 TypeError。
//   两者缺一不可。（产物里的定时器会让 node 不自动退出，所以本文件末尾必须
//   有 process.exit —— 否则看起来像“卡住/不输出”。）
//
// 用真实 stage id 合成一份 path（形状与 generateLearningPath 一致），
// 验证星球/技能树/博物馆/身份 HUD 的推导是否可信。
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as W from "./src/lib/worldData.js";
import { milestoneFor, nextMilestone, MILESTONES } from "./src/lib/worldPostcard.js";
import { PROFESSIONAL_TRACKS } from "./src/data/professionalTracks.js";
import { mediaCategories } from "./src/data/mediaLessons.js";
import { conversationScenes } from "./src/data/conversations.js";
import * as O from "./src/components/world/orbitControls.js";
import * as T from "./src/lib/todayActivity.js";
import { courses } from "./src/data/courses.js";
import { mediaLessons } from "./src/data/mediaLessons.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`);
  }
};

/* 17 个真实 stage id（STAGE_LIBRARY）全都必须被某颗星球收下 */
const ALL_STAGE_IDS = [
  "script", "core", "campus", "travel", "business", "academic", "tourism",
  "newmedia", "drama", "screen", "song", "news", "tiktok", "food", "reading",
  "culture", "output",
];

const mkStage = (id, progress, extra = {}) => ({
  id,
  title: id,
  to: `/${id}`,
  cta: `进入 ${id}`,
  progress,
  done: progress >= 100,
  hours: 8,
  window: "第 1~5 天",
  why: "",
  source: "auto",
  ...extra,
});

console.log("\n=== 1. 没有入学测试（path = null）===");
const empty = W.buildPlanets(null);
ok("依然返回 5 颗星球（世界不空）", empty.length === 5);
ok("全部为 uncharted 且有兜底入口", empty.every((p) => p.state === "uncharted" && p.to));
ok("currentPlanet 有兜底", !!W.currentPlanet(empty));
ok("buildSkillTree 空数据不炸", W.buildSkillTree({}, empty).length === 5);
ok("全 0 分时每条枝是「播种」", W.buildSkillTree({}, empty).every((n) => n.seeds === 1 && !n.started));
ok("buildIdentity 未测时 cefr = 待测", W.buildIdentity({}).cefr === "待测");

console.log("\n=== 2. A2 + 泰剧/留学画像的真实路线 ===");
const path = {
  current: mkStage("core", 40),
  next: mkStage("campus", 0),
  stages: [
    mkStage("script", 100),
    mkStage("core", 40),
    mkStage("campus", 0),
    mkStage("academic", 0),
    mkStage("drama", 0, { source: "media", why: "兴趣：泰剧" }),
    mkStage("travel", 0),
  ],
};
const planets = W.buildPlanets(path);
const by = Object.fromEntries(planets.map((p) => [p.id, p]));

ok("foundation 进度 = (100+40)/2 = 70", by.foundation.progress === 70, `${by.foundation.progress}`);
ok("foundation 是当前星球（含 current stage core）", by.foundation.state === "current");
ok("campus 归入 speaking（不是 culture）", by.speaking.stages.some((s) => s.id === "campus"));
ok("drama 归入 media 且带画像原因", by.media.stages[0]?.why === "兴趣：泰剧");
ok("academic 归入 professional", by.professional.stages.some((s) => s.id === "academic"));
ok("culture 星球没有阶段 → uncharted", by.culture.state === "uncharted" && by.culture.stageCount === 0);
ok("入口取第一个未完成阶段", by.foundation.to === "/core", by.foundation.to);
ok("currentPlanet 命中 foundation", W.currentPlanet(planets).id === "foundation");
ok("done 星球：script+core 全 100 才算 done", by.foundation.state !== "done");

/* 用「17 个 stage 全在路线里」的极端情况验证没有遗漏归属 */
const fullPath = {
  current: mkStage("script", 10),
  next: null,
  stages: ALL_STAGE_IDS.map((id) => mkStage(id, 0)),
};
const fullPlanets = W.buildPlanets(fullPath);
const unmapped = ALL_STAGE_IDS.filter(
  (id) => !fullPlanets.some((p) => p.stages.some((s) => s.id === id))
);
ok(
  "17 个 stage id 全部有归属（无遗漏映射）",
  unmapped.length === 0,
  unmapped.length ? `未被任何星球收下：${unmapped.join(",")}` : "17/17"
);
ok(
  "每颗星球至少有一条真实路线阶段",
  fullPlanets.every((p) => p.stageCount > 0),
  fullPlanets.map((p) => `${p.id}:${p.stageCount}`).join(" ")
);

console.log("\n=== 3. track 来源强制归 professional ===");
const trackPath = {
  current: mkStage("business", 50, { source: "track" }),
  next: null,
  stages: [mkStage("business", 50, { source: "track" }), mkStage("song", 0)],
};
const trackPlanets = W.buildPlanets(trackPath);
const songPlanet = trackPlanets.find((p) => p.stages.some((s) => s.id === "song"));
const bizPlanet = trackPlanets.find((p) => p.stages.some((s) => s.id === "business"));
ok("Hub 选的商务方向 → professional", bizPlanet.id === "professional");
ok("兴趣歌曲仍留在 media", songPlanet.id === "media");

console.log("\n=== 4. 技能树 ===");
const tree = W.buildSkillTree(
  { tone: 71, vocab: 65, grammar: 73, speaking: 69, listening: 70, reading: 69 },
  planets
);
const tn = Object.fromEntries(tree.map((n) => [n.id, n]));
ok("五条枝齐全", tree.length === 5);
ok("发音 = 声调为主 (71*0.7+65*0.3=69)", tn.pronunciation.score === 69, `${tn.pronunciation.score}`);
ok("口语合并听力 (69*0.7+70*0.3=69)", tn.speaking.score === 69, `${tn.speaking.score}`);
ok("词汇枝 = 词汇量分", tn.vocabulary.score === 65);
ok("culture 枝以阅读为主 (69*0.6=41)", tn.culture.score === Math.round(69 * 0.6), `${tn.culture.score}`);
ok("60+ 分是「抽枝」四颗种子", tn.grammar.seeds === 4 && tn.grammar.growthState === "growing");
ok("全部 started", tree.every((n) => n.started));
const summary = W.skillTreeSummary(tree);
ok("摘要给出最强/最弱枝", summary.strongest?.id === "grammar" && summary.weakest?.id === "culture",
   `${summary.strongest?.id} / ${summary.weakest?.id}`);

console.log("\n=== 5. 数字博物馆 ===");
const roomsEmpty = W.buildMuseumRooms({});
ok("返回 5 个展厅", roomsEmpty.length === 5);
ok("每个展厅都有真实展品", roomsEmpty.every((r) => r.total > 0),
   roomsEmpty.map((r) => `${r.cn}:${r.total}`).join(" "));
ok("没有阅读记录时不编造百分比", roomsEmpty.filter((r) => !r.mediaTotal).every((r) => r.progress === null));
ok("有媒体课的展厅给出 0% 而非 null", roomsEmpty.find((r) => r.id === "media").progress === 0);

const mediaRoom = roomsEmpty.find((r) => r.id === "media");
const firstMediaLesson = mediaRoom.samples.find((s) => s.kind === "media");
const fakeState = { lessons: {} };
// 把该展厅第一节媒体课标成已学完
const realLessonId = firstMediaLesson.id;
fakeState.lessons[realLessonId] = { status: "done", minutes: 6, steps: {} };
const rooms = W.buildMuseumRooms(fakeState);
const mediaRoom2 = rooms.find((r) => r.id === "media");
ok("媒体展厅进度来自真实完成记录", mediaRoom2.mediaDone === 1 && mediaRoom2.progress > 0,
   `done=${mediaRoom2.mediaDone} progress=${mediaRoom2.progress}%`);
ok("状态随进度变化", mediaRoom2.state === "visiting");
ok("展品标题取自真实数据（非占位）", mediaRoom.samples.every((s) => s.title && !/^[a-z-]+$/.test(s.title)),
   mediaRoom.samples.map((s) => s.title).join(" / ").slice(0, 90));

console.log("\n=== 6. 身份 HUD ===");
const id1 = W.buildIdentity({
  user: { nickname: "小明", email: "a@b.com", isVip: true },
  profile: { thaiLevel: "A2", learningGoal: "study", targetScenario: "校园交流" },
  progress: { level: 6, xp: 1650, learning_streak: 20, total_vocabulary: 326 },
  hasTest: true,
});
ok("名字/等级/称号正确", id1.name === "小明" && id1.xpLevel === 6 && id1.title === "Thai Explorer");
ok("CEFR 与目标正确", id1.cefr === "A2" && id1.goal.length > 0, `${id1.cefr} / ${id1.goal}`);
ok("XP 进度条有界 0~100", id1.xpPercent >= 0 && id1.xpPercent <= 100, `${id1.xpPercent}%`);
ok("未测用户不编造等级", W.buildIdentity({ user: {}, hasTest: false }).cefr === "待测");

/* =========================================================
   7. 轨道编码：半径 = 掌握度（世界得能「转一圈就看懂」）
========================================================= */
console.log("\n=== 7. 轨道编码与星尘遮蔽 ===");

/* 不变量的前提：单颗星球能收紧的距离必须小于相邻轨道的间距，
   否则「掌握度高的外圈星球」会穿到内圈星球轨道里，次序就乱了。 */
ok(
  "MAX_ORBIT_PULL < ORBIT_STEP（相邻轨道永不交叉的前提）",
  W.MAX_ORBIT_PULL < W.ORBIT_STEP,
  `${W.MAX_ORBIT_PULL} < ${W.ORBIT_STEP}`
);

const radii = Array.from({ length: 5 }, (_, i) => W.orbitRadius(i, 0));
ok("0% 时半径严格递增", radii.every((r, i) => i === 0 || r > radii[i - 1]), radii.join(" < "));

/* 最关键的一条：外圈满把握度也必须留在内圈 0% 之外 */
let crossing = null;
for (let i = 0; i < 4; i += 1) {
  const outerMost = W.orbitRadius(i + 1, 1);
  const innerFixed = W.orbitRadius(i, 0);
  if (outerMost <= innerFixed) crossing = `${i}: ${outerMost} <= ${innerFixed}`;
}
ok("外圈 100% 仍在内圈 0% 之外（无轨道交叉）", crossing === null, crossing || "已遍历相邻 4 对");

ok("掌握度越高半径越小（单调）", W.orbitRadius(2, 1) < W.orbitRadius(2, 0.5) && W.orbitRadius(2, 0.5) < W.orbitRadius(2, 0));
ok("pull 超 1 被夹住（不会反向穿透）", W.orbitRadius(3, 9) === W.orbitRadius(3, 1));
ok("pull 负数被夹住", W.orbitRadius(3, -5) === W.orbitRadius(3, 0));

/* 真实星球对象上的半径应与公式一致 */
ok(
  "星球 radius = orbitRadius(orbitIndex, pull)",
  planets.every((p) => Math.abs(p.radius - W.orbitRadius(p.orbitIndex, p.pull)) < 1e-9)
);
ok(
  "pull 直接等于掌握度 progress/100",
  planets.every((p) => Math.abs(p.pull - p.progress / 100) < 1e-9)
);
ok("槽位固定为数组下标（进度不能改变排序）", planets.every((p, i) => p.orbitIndex === i));

/* 遮蔽档位 */
ok("ahead → 薄星尘", by.speaking.veil.tier === "light", by.speaking.veil.label);
ok("uncharted → 厚星尘", by.culture.veil.tier === "heavy", by.culture.veil.label);
ok("current/done → 无遮蔽", by.foundation.veil.tier === "none");
ok("每种遮蔽都有可读原因", planets.filter((p) => p.veil.tier !== "none").every((p) => p.veil.reason));
ok("无遮蔽的星球不给原因（不编废话）", planets.filter((p) => p.veil.tier === "none").every((p) => !p.veil.reason));
ok("粒子数随档位递增", W.VEIL_TIERS.none.dust < W.VEIL_TIERS.light.dust && W.VEIL_TIERS.light.dust < W.VEIL_TIERS.heavy.dust);
ok("无 WebGL 静态星图也要能拿到半径", planets.every((p) => typeof p.radius === "number" && p.radius > 0));

/*
 * 锁＝真门禁（2026-09-20）：薄尘 / 厚尘两种遮蔽都点不进课程。
 * 首页星球行（UniverseRow）与学习宇宙的星系（LearningGalaxy）共用
 * locked / unlockHint 两个字段，所以这里把它们钉死：状态与锁一一对应，
 * 且每个锁都给出可执行的人话解锁条件（不能只说「未解锁」）。
 */
const LOCKED_STATES = ["ahead", "uncharted"];
ok(
  "locked 与状态一一对应（只有 ahead/uncharted 锁）",
  planets.every((p) => p.locked === LOCKED_STATES.includes(p.state)),
  planets.map((p) => `${p.id}:${p.state}:${p.locked}`).join(" ")
);
ok("无路线的用户：五颗全锁，但每颗都有兜底落点", empty.every((p) => p.locked && p.to));
ok("无路线的解锁提示指向入学测试", empty.every((p) => p.unlockHint.includes("入学测试")));
ok("ahead 的解锁提示点名当前阶段", by.speaking.locked === true && by.speaking.unlockHint.includes("先完成当前阶段"));
ok("uncharted 的解锁提示指向画像/专业方向", by.culture.locked === true && by.culture.unlockHint.includes("专业方向"));
ok("当前/已完成/有进度的星球不锁", !by.foundation.locked && planets.filter((p) => p.state === "active").every((p) => !p.locked));
ok("每个锁都有非空解锁提示（不出现「默默点不动」）", planets.filter((p) => p.locked).every((p) => typeof p.unlockHint === "string" && p.unlockHint.length > 0));

/* 「卡在哪」只在真有可看差距时才标 */
const flat = W.buildPlanets({ current: mkStage("script", 20), next: null, stages: [mkStage("script", 20), mkStage("drama", 18)] });
ok("两块进度接近时不标「卡住」（少说，不编）", flat.every((p) => !p.laggard));
const lopsided = W.buildPlanets({
  current: mkStage("script", 80),
  next: null,
  stages: [mkStage("script", 80), mkStage("drama", 5)],
});
const lag = lopsided.filter((p) => p.laggard);
ok("差距 ≥15 点时标出最低的一块", lag.length === 1 && lag[0].id === "media", lag.map((p) => `${p.cn}${p.progress}%`).join(","));
ok("标注文案带真实数字", lag[0]?.laggardNote.includes("5%"), lag[0]?.laggardNote.slice(0, 40));
ok("uncharted 星球不会被当成「落后」", !lopsided.find((p) => p.id === "culture")?.laggard);

/* =========================================================
   8. 画像卫星与世界主题（每个用户的世界长得不一样）
========================================================= */
console.log("\n=== 8. 画像 → 世界主题与卫星 ===");

const noProfile = W.buildWorldTheme(null);
ok("没画像时回到中性香槟金", noProfile.accent === "#e8c88a" && noProfile.satellites.length === 0);
ok("没画像时博物馆不定主展厅", noProfile.featuredRoomId === null);

const dramaProfile = { learningGoal: "drama", mediaInterest: ["drama", "song", "tiktok"] };
const dramaTheme = W.buildWorldTheme(dramaProfile);
ok("泰剧画像 → 追剧宇宙配色", dramaTheme.name === "追剧宇宙" && dramaTheme.accent === "#ff9ec7", `${dramaTheme.name} ${dramaTheme.accent}`);
ok("泰剧画像 → 主展厅是影视厅", dramaTheme.featuredRoomId === "media");
ok("卫星挂在 media 星球上", (dramaTheme.satellitesByPlanet.media || []).length >= 2,
   (dramaTheme.satellitesByPlanet.media || []).map((s) => s.cn).join("/"));
ok("同 to 的卫星被去掉（不做两个按钮通向同一页）",
   new Set(dramaTheme.satellites.map((s) => s.to)).size === dramaTheme.satellites.length);

const bizTheme = W.buildWorldTheme({ learningGoal: "business", professionalDirection: ["business", "academic"] });
ok("商务画像 → 商务宇宙", bizTheme.name === "商务宇宙");
ok("目标权重高于方向（business 目标决定命名）", bizTheme.tags[0] === "business");
ok("商务卫星落在 professional 星球", (bizTheme.satellitesByPlanet.professional || []).some((s) => s.id === "businessTrack"));
ok("商务画像的主展厅与泰剧不同（世界确实不一样）", bizTheme.featuredRoomId !== dramaTheme.featuredRoomId,
   `${bizTheme.featuredRoomId} vs ${dramaTheme.featuredRoomId}`);

const travelTheme = W.buildWorldTheme({ learningGoal: "travel" });
ok("旅行画像 → 口语星球有旅行卫星", (travelTheme.satellitesByPlanet.speaking || []).some((s) => s.id === "travel"));
ok("不同画像的世界配色不同", new Set([dramaTheme.accent, bizTheme.accent, travelTheme.accent]).size === 3);

/* 画像真的影响星球对象：亲和度与卫星 */
const planetsNoProfile = W.buildPlanets(path, null);
const planetsDrama = W.buildPlanets(path, dramaProfile);
ok("无画像时没有亲和光环", planetsNoProfile.every((p) => p.affinity === 0));
ok("泰剧画像时 media 星球有亲和度", planetsDrama.find((p) => p.id === "media").affinity > 0);
ok("泰剧画像时 media 星球挂上卫星", planetsDrama.find((p) => p.id === "media").satelliteCount >= 3);
ok("亲和度封顶为 1（不让兴趣多的账号把星球撑爆）",
   W.buildPlanets(path, { learningGoal: "drama", professionalDirection: ["business", "academic", "news"], mediaInterest: ["drama", "song", "variety", "news", "tiktok"] })
     .every((p) => p.affinity <= 1));
ok("传 null profile 不报错（老调用点兼容）", W.buildPlanets(path).length === 5);

/*
 * 卫星的 to 必须指向真实存在的路由。
 * 这条断言防的是「画像卫星把用户送进 404」——那是比没有卫星更糟的结果。
 */
/* 相对 cwd 而不是 import.meta.url：本文件也可能被 esbuild 打包到别处再跑 */
const appSource = readFileSync(join(process.cwd(), "src/App.jsx"), "utf8");
const realRoutes = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const deadLinks = W.SATELLITE_LIBRARY.filter((sat) => {
  const pathname = sat.to.split("?")[0];
  return !realRoutes.includes(pathname);
});
ok("每个卫星都指向 App.jsx 里真实存在的路由", deadLinks.length === 0,
   deadLinks.length ? deadLinks.map((s) => `${s.id}→${s.to}`).join(",") : `${W.SATELLITE_LIBRARY.length} 条全部命中`);

/*
 * 路径存在还不够——查询参数也得是真实存在的取值。
 * 一个 `?track=xyz` 指向不存在的方向不会 404，只会静默回退到默认卡片，
 * 比死链更难发现（我就是先写了这条断言才发现需要逐个核对取值的）。
 */
const queryOf = (to, key) => {
  const q = to.split("?")[1];
  if (!q) return null;
  return new URLSearchParams(q).get(key);
};
const trackIds = new Set(PROFESSIONAL_TRACKS.map((t) => t.id));
const categoryIds = new Set(mediaCategories.map((c) => c.id));
const sceneIds = new Set(conversationScenes.map((s) => s.id));

const badTrack = W.SATELLITE_LIBRARY.filter((s) => {
  const v = queryOf(s.to, "track");
  return v !== null && !trackIds.has(v);
});
ok("卫星的 ?track= 都是真实的专业方向", badTrack.length === 0,
   badTrack.length ? badTrack.map((s) => `${s.id}→${s.to}`).join(",") : `${[...trackIds].filter((id) => W.SATELLITE_LIBRARY.some((s) => queryOf(s.to, "track") === id)).length}/${trackIds.size} 个方向可达`);

const badCategory = W.SATELLITE_LIBRARY.filter((s) => {
  const v = queryOf(s.to, "category");
  return v !== null && !categoryIds.has(v);
});
ok("卫星的 ?category= 都是真实的媒体分类", badCategory.length === 0,
   badCategory.length ? badCategory.map((s) => `${s.id}→${s.to}`).join(",") : `${categoryIds.size} 个分类`);

/* 博物馆展厅的「说一句」也要落在真实对话场景上 */
const badScene = W.MUSEUM_ROOMS.filter((r) => r.scene).filter((r) => {
    const v = queryOf(r.scene.to, "scene");
    return v !== null && !sceneIds.has(v);
  });
ok("展厅「说一句」都指向真实对话场景", badScene.length === 0,
   badScene.length ? badScene.map((r) => `${r.id}→${r.scene.to}`).join(",") : `${W.MUSEUM_ROOMS.filter((r) => r.scene).length} 间展厅`);
ok("卫星不重复指向同一路径+查询",
   new Set(W.SATELLITE_LIBRARY.map((s) => s.to)).size === W.SATELLITE_LIBRARY.length);
ok("每条卫星都有中文名/图标/所属星球",
   W.SATELLITE_LIBRARY.every((s) => s.cn && s.emoji && W.WORLD_PLANETS.some((p) => p.id === s.planet)));

/* 画像里用到的卫星 id 必须都存在于卫星表（防手写错 id） */
const satelliteIds = new Set(W.SATELLITE_LIBRARY.map((s) => s.id));
const referenced = new Set();
[
  { learningGoal: "major" }, { learningGoal: "music" }, { learningGoal: "drama" },
  { learningGoal: "travel" }, { learningGoal: "business" }, { learningGoal: "study" },
  { learningGoal: "culture" },
  { mediaInterest: ["movie", "song", "variety", "news", "tiktok", "novel", "food", "travel", "drama"] },
  { professionalDirection: ["business", "academic", "tourism", "news", "newmedia"] },
].forEach((profile) => {
  W.buildWorldTheme(profile).satellites.forEach((s) => referenced.add(s.id));
});
ok("所有画像分支引用的卫星都存在", [...referenced].every((id) => satelliteIds.has(id)),
   `${referenced.size} 个被引用`);
ok("18 种画像标签全部能建出主题（无死分支）",
   ["major", "music", "culture"].every((id) => W.buildWorldTheme({ learningGoal: id }).satellites.length > 0) &&
   ["business", "academic", "tourism", "news", "newmedia"].every((id) => W.buildWorldTheme({ professionalDirection: [id] }).satellites.length > 0) &&
   ["drama", "movie", "song", "variety", "news", "tiktok", "novel", "food", "travel"].every((id) => W.buildWorldTheme({ mediaInterest: [id] }).satellites.length > 0) &&
   ["travel", "business", "study", "drama"].every((id) => W.buildWorldTheme({ learningGoal: id }).satellites.length > 0));

/* =========================================================
   9. 博物馆主展厅
========================================================= */
console.log("\n=== 9. 博物馆主展厅（画像重排）===");
const roomsPlain = W.buildMuseumRooms({}, null);
ok("无画像时保持原顺序（饮食在前）", roomsPlain[0].id === "food");
ok("无画像时没有主展厅", roomsPlain.every((r) => !r.featured));

const roomsDrama = W.buildMuseumRooms({}, dramaProfile);
ok("泰剧画像时影视厅置顶", roomsDrama[0].id === "media" && roomsDrama[0].featured);
ok("置顶不丢展厅（仍是 5 间、顺序只动一次）", roomsDrama.length === 5 && new Set(roomsDrama.map((r) => r.id)).size === 5);
ok("置顶不改变任何进度数据",
   roomsDrama.reduce((s, r) => s + r.total, 0) === roomsPlain.reduce((s, r) => s + r.total, 0));
ok("主展厅带可读原因（提到世界主题与厅名）",
   roomsDrama[0].featuredReason.includes(dramaTheme.name) && roomsDrama[0].featuredReason.includes(roomsDrama[0].cn),
   roomsDrama[0].featuredReason);

const roomsFood = W.buildMuseumRooms({}, { mediaInterest: ["food"] });
ok("美食画像时饮食厅置顶", roomsFood[0].id === "food", roomsFood[0].id);
const roomsBiz = W.buildMuseumRooms({}, { learningGoal: "business" });
ok("商务画像时生活方式厅置顶", roomsBiz[0].id === "lifestyle", roomsBiz[0].id);

/* =========================================================
   10. 成就卡里程碑
========================================================= */
console.log("\n=== 10. 成就卡里程碑（印章不是门禁）===");
ok("0 天没有印章", milestoneFor(0) === null);
ok("6 天还没有章", milestoneFor(6) === null);
ok("7 天拿到第一枚", milestoneFor(7)?.days === 7);
ok("29 天仍是最低那枚", milestoneFor(29)?.days === 7);
ok("30 天升到 30 天章", milestoneFor(30)?.days === 30, milestoneFor(30)?.label);
ok("100 天封顶", milestoneFor(365)?.days === 100);
ok("里程碑按天数递增（配置没写反）", MILESTONES.every((m, i) => i === 0 || m.days > MILESTONES[i - 1].days));
ok("每枚章都有颜色与文案", MILESTONES.every((m) => m.color && m.label));
ok("下一枚章给出还差几天", nextMilestone(3)?.remaining === 4, `还差 ${nextMilestone(3)?.remaining}`);
ok("已满级时没有下一枚", nextMilestone(120) === null);
ok("负数/NaN 不炸", milestoneFor(-5) === null && nextMilestone(NaN)?.remaining === 7);

/* =========================================================
   11. 星系相机操控（拖动旋转 / 缩放 / 闲时漂移）
========================================================= */
console.log("\n=== 11. 星系相机操控 ===");

const S = () => O.createOrbitState();

/* 接管相机那一刻画面不能跳：默认机位必须等于改造前的固定机位 (0, 3.4, 7.2) */
const p0 = O.cameraPosition(O.ORBIT_DEFAULTS.yaw, O.ORBIT_DEFAULTS.pitch, O.ORBIT_DEFAULTS.distance);
ok("默认机位 = 改造前的 (0, 3.4, 7.2)（接管不跳画面）",
   [0, 3.4, 7.2].every((want, i) => Math.abs(p0[i] - want) < 1e-9),
   `[${p0.map((v) => v.toFixed(6)).join(", ")}]`);
ok("yaw=0 时相机在 +Z、正对恒星", Math.abs(p0[0]) < 1e-9 && p0[2] > 0);

/* 球坐标自洽：距离 = 模长 */
ok("球坐标→笛卡尔保持距离",
   [0.3, 1.1, 5.5, 9.9].every((d) =>
     [0, 1.2, -2.4].every((yaw) =>
       [0.1, 0.6, 1.2].every((pitch) => {
         const c = O.cameraPosition(yaw, pitch, d);
         return Math.abs(Math.hypot(c[0], c[1], c[2]) - d) < 1e-9;
       }))));

/* 夹紧 */
ok("俯仰角两端都被夹住",
   O.clampPitch(-99) === O.ORBIT_LIMITS.minPitch && O.clampPitch(99) === O.ORBIT_LIMITS.maxPitch);
ok("俯仰角下限 > 0（不会钻到轨道平面下方）", O.ORBIT_LIMITS.minPitch > 0, `${O.ORBIT_LIMITS.minPitch}`);
ok("距离两端都被夹住",
   O.clampDistance(0.1) === O.ORBIT_LIMITS.minDistance && O.clampDistance(999) === O.ORBIT_LIMITS.maxDistance);
ok("最近距离在内圈轨道之外（不会钻进星系里）",
   O.ORBIT_LIMITS.minDistance > W.orbitRadius(0, 0), `${O.ORBIT_LIMITS.minDistance} > ${W.orbitRadius(0, 0).toFixed(2)}`);
ok("非法距离/NaN 回落到默认（不炸）",
   O.clampDistance(NaN) === O.ORBIT_DEFAULTS.distance && O.clampDistance(undefined) === O.ORBIT_DEFAULTS.distance);

/* 拖动方向：抓住场景拖，不是转动相机 */
const dragRight = O.applyDrag(S(), 100, 0);
ok("向右拖 → yaw 减小（场景跟着手往右走）", dragRight.targetYaw < 0, `${dragRight.targetYaw.toFixed(3)}`);
const dragUp = O.applyDrag(S(), 0, -100);
ok("向上拖 → pitch 减小（相机降低）", dragUp.targetPitch < O.ORBIT_DEFAULTS.pitch, `${dragUp.targetPitch.toFixed(3)}`);
ok("向下拖 → pitch 增大（相机升高俯视）",
   O.applyDrag(S(), 0, 100).targetPitch > O.ORBIT_DEFAULTS.pitch);

/* 把镜头一直往下拖到极限，pitch 被夹在 maxPitch，不会翻到背面去 */
let dragged = S();
for (let i = 0; i < 400; i += 1) dragged = O.applyDrag(dragged, -60, 40);
ok("往下拖到极限被夹住（不会翻转）",
   Math.abs(dragged.targetPitch - O.ORBIT_LIMITS.maxPitch) < 1e-9, `${dragged.targetPitch.toFixed(3)}`);
ok("yaw 不夹紧（可以无限绕圈）", Math.abs(dragged.targetYaw) > 10, `yaw=${dragged.targetYaw.toFixed(1)}`);
ok("绕一圈之后视角仍然自洽（模长 = 距离）", (() => {
  const c = O.cameraPosition(dragged.targetYaw, dragged.targetPitch, O.ORBIT_DEFAULTS.distance);
  return Math.abs(Math.hypot(c[0], c[1], c[2]) - O.ORBIT_DEFAULTS.distance) < 1e-9;
})());
ok("applyDrag 不改动当前值（只改 target，靠阻尼跟上）",
   Math.abs(dragged.yaw - S().yaw) < 1e-9 && Math.abs(dragged.distance - S().distance) < 1e-9);

/* 缩放 */
ok("factor < 1 是拉近", O.applyZoom(S(), 0.5).targetDistance < O.ORBIT_DEFAULTS.distance);
ok("缩放被夹在上下限内",
   O.applyZoom(S(), 0.001).targetDistance === O.ORBIT_LIMITS.minDistance &&
   O.applyZoom(S(), 1000).targetDistance === O.ORBIT_LIMITS.maxDistance);
const beforeBad = S();
ok("非法缩放因子原样返回（不把距离变成 NaN）",
   O.applyZoom(beforeBad, NaN) === beforeBad && O.applyZoom(beforeBad, 0) === beforeBad &&
   O.applyZoom(beforeBad, -1) === beforeBad);

/* 捏合：手指张开 = 拉近 */
ok("双指张开（spread 变大）→ 拉近",
   O.applyPinch(S(), 100, 200).targetDistance < O.ORBIT_DEFAULTS.distance);
ok("双指合拢 → 拉远",
   O.applyPinch(S(), 200, 100).targetDistance > O.ORBIT_DEFAULTS.distance);
ok("两指距离不变 → 距离不变",
   Math.abs(O.applyPinch(S(), 150, 150).targetDistance - O.ORBIT_DEFAULTS.distance) < 1e-9);
ok("捏合基准为 0 时安全返回", O.applyPinch(S(), 0, 120).targetDistance === O.ORBIT_DEFAULTS.distance);
ok("pointerSpread：3-4-5 三角形 = 5",
   Math.abs(O.pointerSpread([{ x: 0, y: 0 }, { x: 3, y: 4 }]) - 5) < 1e-9);
ok("pointerSpread：不足两点 = 0",
   O.pointerSpread([{ x: 1, y: 1 }]) === 0 && O.pointerSpread([]) === 0);

/* 回位 */
const wayOff = O.applyZoom(O.applyDrag(S(), 900, 300), 0.5);
const back = O.resetOrbit(wayOff);
ok("回位只重置 target，不瞬间跳动",
   Math.abs(back.targetYaw) < 1e-9 && Math.abs(back.targetPitch - O.ORBIT_DEFAULTS.pitch) < 1e-9 &&
   Math.abs(back.distance - wayOff.distance) < 1e-9);

/* 阻尼：帧率无关、不过冲、能收敛 */
ok("damp：dt=0 不动", O.damp(0, 1, 7, 0) === 0);
ok("damp：永不越过目标（不过冲）",
   Array.from({ length: 200 }, (_, i) => i * 0.01).every((dt) => O.damp(0, 1, 7, dt) <= 1.0000001));

const runFor = (seconds, hz) => {
  let st = O.createOrbitState();
  st.targetYaw = -2.4;
  const dt = 1 / hz;
  for (let i = 0; i < Math.round(seconds * hz); i += 1) st = O.stepOrbit(st, dt);
  return st.yaw;
};
const at60 = runFor(1, 60);
const at120 = runFor(1, 120);
ok("阻尼帧率无关（60Hz 与 120Hz 一秒后基本一致）",
   Math.abs(at60 - at120) < Math.abs(-2.4) * 0.02, `60Hz=${at60.toFixed(4)} 120Hz=${at120.toFixed(4)}`);
ok("阻尼持续逼近目标", Math.abs(at60 - -2.4) < Math.abs(-2.4) * 0.01, `误差 ${(Math.abs(at60 + 2.4)).toFixed(5)}`);

/* 长时间推进后所有值仍在合法区间 */
let long = O.createOrbitState();
long = O.applyDrag(long, 5000, 5000);
long = O.applyZoom(long, 0.05);
for (let i = 0; i < 600; i += 1) long = O.stepOrbit(long, 1 / 60);
ok("长时间推进后俯仰/距离仍在合法区间",
   long.pitch >= O.ORBIT_LIMITS.minPitch - 1e-9 && long.pitch <= O.ORBIT_LIMITS.maxPitch + 1e-9 &&
   long.distance >= O.ORBIT_LIMITS.minDistance - 1e-9 && long.distance <= O.ORBIT_LIMITS.maxDistance + 1e-9,
   `pitch=${long.pitch.toFixed(3)} dist=${long.distance.toFixed(3)}`);

/* 闲时漂移 */
ok("停手不足 idleDelaySec 时不漂（用户刚动完不抢镜）",
   O.idleDrift({ idleSeconds: 0 }, 10).yawOffset === 0 &&
   O.idleDrift({ idleSeconds: O.ORBIT_LIMITS.idleDelaySec - 0.01 }, 10).yawOffset === 0);
ok("刚过延迟时漂移从 0 平滑开始（无咯噔）",
   Math.abs(O.idleDrift({ idleSeconds: O.ORBIT_LIMITS.idleDelaySec }, 10).yawOffset) < 1e-9);
ok("漂移振幅有界（很轻，不会把用户的角度带走）",
   Array.from({ length: 200 }, (_, i) => i * 0.5).every((t) => Math.abs(O.idleDrift({ idleSeconds: 60 }, t).yawOffset) <= 0.17));
ok("漂移淡入是单调的（smoothstep 不会回跳）", (() => {
  let prev = -1;
  for (let s = O.ORBIT_LIMITS.idleDelaySec; s <= O.ORBIT_LIMITS.idleDelaySec + 1.6; s += 0.1) {
    const amp = Math.abs(O.idleDrift({ idleSeconds: s }, 1.2).pitchOffset) + 1e-12;
    if (amp < prev - 1e-9) return false;
    prev = amp;
  }
  return true;
})());
ok("减弱动效 → 永不漂移",
   O.idleDrift({ idleSeconds: 999, reducedMotion: true }, 5).yawOffset === 0 &&
   O.idleDrift({ idleSeconds: 999, reducedMotion: true }, 5).distanceScale === 1);
ok("漂移是偏移量，不写进 target（用户一碰就回到自己的角度）",
   (() => { const s = S(); O.idleDrift({ idleSeconds: 60 }, 3); return s.targetYaw === 0 && s.yaw === 0; })());

/* 点击 / 拖动的区分 */
ok("拖动不足阈值不算在转", !O.exceedsDragThreshold(0) && !O.exceedsDragThreshold(4));
ok("拖动到阈值算在转", O.exceedsDragThreshold(O.ORBIT_LIMITS.dragThresholdPx) && O.exceedsDragThreshold(40));
const suppress = S();
suppress.suppressClickUntil = 1000;
ok("刚拖完的短窗口内忽略星球点击（不会被带离页面）",
   !O.clickAllowed(suppress, 900) && O.clickAllowed(suppress, 1000) && O.clickAllowed(suppress, 1500));
ok("没拖过时点击一直有效", O.clickAllowed(S(), 12345));

/* =========================================================
   今日活动：星系要能看见「今天发生了什么」
========================================================= */

console.log("\n=== 9. 今日活动 · 归属表 ===");

ok("11 个课程 category 全部有星球归属（没有课程会静默掉队）",
   courses.every((course) => T.COURSE_CATEGORY_PLANET[course.category]),
   courses.map((c) => c.category).filter((c) => !T.COURSE_CATEGORY_PLANET[c]).join(",") || "全部命中");
ok("6 个媒体分类全部有星球归属",
   mediaCategories.every((category) => T.MEDIA_TYPE_PLANET[category.id]),
   mediaCategories.map((c) => c.id).filter((c) => !T.MEDIA_TYPE_PLANET[c]).join(",") || "全部命中");
ok("文学归文化星球，其余媒体归媒体星球",
   T.MEDIA_TYPE_PLANET.literature === "culture" &&
   ["drama", "song", "variety", "news", "social"].every((t) => T.MEDIA_TYPE_PLANET[t] === "media"));
/* 真实形状的路线的 stage 带 courseId（learnPath 里就是 courseId: template.courseId） */
const coursePath = {
  current: { id: "core" },
  stages: [
    { id: "core", source: "auto", courseId: "thai-basic-reader" },
    { id: "drama", source: "media", courseId: "thai-listening" },
    { id: "business", source: "track", courseId: "thai-business" },
  ],
};
ok("路线里挂了这门课时以路线归属为准（thai-listening 挂在 drama 阶段 → media，而不是 category 的 speaking）",
   T.coursePlanet("thai-listening", coursePath) === "media",
   T.coursePlanet("thai-listening", coursePath));
ok("专业方向选出来的课归专业星球（source: track）",
   T.coursePlanet("thai-business", coursePath) === "professional");
ok("不在路线里时按 category 兜底（thai-business → professional）",
   T.coursePlanet("thai-business", path) === "professional");
ok("路线里多颗星球都挂了同一门课时，优先「当前阶段」那一颗", (() => {
  const ambiguous = {
    current: { id: "drama" },
    stages: [
      { id: "listening", courseId: "thai-listening", source: "auto" },
      { id: "drama", courseId: "thai-listening", source: "media" },
    ],
  };
  return T.coursePlanet("thai-listening", ambiguous) === "media" &&
    T.coursePlanet("thai-listening", { current: { id: "listening" }, stages: ambiguous.stages }) === "speaking";
})());
ok("完全查不到的课返回 null（不硬塞给某颗星球）",
   T.coursePlanet("not-a-course", path) === null);

console.log("\n=== 10. 今日活动 · 只认真实时间戳 ===");

/* 固定「现在」：2026-09-19 20:00 本地 */
const NOW = new Date(2026, 8, 19, 20, 0, 0);
const TODAY = T.todayKey(NOW);
const YESTERDAY = T.todayKey(new Date(2026, 8, 18, 20, 0, 0));

ok("todayKey 用本地日历日（不是 UTC）", TODAY === "2026-09-19", TODAY);

/* —— 词汇操练：daily_history —— */
const vocabToday = T.todayFromVocab(
  { daily_history: [
      { date: TODAY, words: 12, review_correct: 8, xp: 200 },
      { date: YESTERDAY, words: 999, review_correct: 999, xp: 9999 },
    ] },
  TODAY
);
ok("只统计今天那一行，昨天的成绩不会被算进今天",
   vocabToday.foundation.count === 20 && vocabToday.foundation.xp === 200,
   `count=${vocabToday.foundation.count}`);
ok("今天这一行三项全 0 → 不算练过",
   Object.keys(T.todayFromVocab({ daily_history: [{ date: TODAY, words: 0, review_correct: 0, xp: 0 }] }, TODAY)).length === 0);
ok("没有今天这一行 → 不算练过",
   Object.keys(T.todayFromVocab({ daily_history: [{ date: YESTERDAY, words: 5 }] }, TODAY)).length === 0);
ok("词汇能量随次数单调上升且封顶 1",
   T.todayFromVocab({ daily_history: [{ date: TODAY, words: 5, review_correct: 0 }] }, TODAY).foundation.energy <
     T.todayFromVocab({ daily_history: [{ date: TODAY, words: 20, review_correct: 0 }] }, TODAY).foundation.energy &&
   T.todayFromVocab({ daily_history: [{ date: TODAY, words: 9999, review_correct: 9999 }] }, TODAY).foundation.energy === 1);

/* —— 口语：毫秒时间戳 —— */
const speakingToday = T.todayFromSpeaking(
  [
    { timestamp: new Date(2026, 8, 19, 9, 5).getTime(), score: 80, mode: "sentence" },
    { timestamp: new Date(2026, 8, 19, 9, 40).getTime(), score: 90, mode: "sentence" },
    { timestamp: new Date(2026, 8, 18, 23, 50).getTime(), score: 100, mode: "word" },
  ],
  TODAY
);
ok("口语只统计今天的记录（昨天 23:50 那次不算）",
   speakingToday.speaking.count === 2, `count=${speakingToday.speaking.count}`);
ok("口语平均分来自今天的真实分（不会把昨天的 100 分算进去）",
   speakingToday.speaking.score === 85, `avg=${speakingToday.speaking.score}`);

/* —— 媒体：课程 updatedAt 是 UTC，必须换算成本地日 —— */
const mediaLesson = mediaLessons[0];
const earlyMorningLocal = new Date(2026, 8, 19, 7, 0).toISOString();
const naiveUtcDay = earlyMorningLocal.slice(0, 10);
const mediaToday = T.todayFromMedia(
  {
    lessons: { [mediaLesson.id]: { updatedAt: earlyMorningLocal, minutes: 999 } },
    records: [],
  },
  TODAY
);
ok(`本地凌晨的记录算今天（UTC 日 ${naiveUtcDay} ≠ 本地日 ${TODAY}，直接切前 10 字符会漏掉）`,
   Object.values(mediaToday).some((entry) => entry.count === 1),
   JSON.stringify(mediaToday));
ok("媒体课的累计时长不会被当成「今天学了 X 分钟」",
   !JSON.stringify(mediaToday).includes("999"), JSON.stringify(mediaToday).slice(0, 90));
ok("昨天动过的媒体课不算今天",
   Object.keys(T.todayFromMedia({ lessons: { [mediaLesson.id]: { updatedAt: new Date(2026, 8, 18, 22, 0).toISOString() } } }, TODAY)).length === 0);
ok("同一分类下两节课聚合成一个入口（不多按钮通向同一页）", (() => {
  const dramas = mediaLessons.filter((lesson) => lesson.type === "drama").slice(0, 2);
  const lessons = Object.fromEntries(dramas.map((lesson) => [
    lesson.id,
    { updatedAt: new Date(2026, 8, 19, 10, 0).toISOString() },
  ]));
  const built = T.todayFromMedia({ lessons }, TODAY);
  return built.media.count === 2 && built.media.items.length === 1 && built.media.items[0].detail.includes("2 节");
})());

/* —— 课程进度：只有带时间戳的播放记录才算 —— */
const courseProgressFixture = {
  "thai-business": {
    lessonProgress: {
      l1: { progress: 40, updatedAt: new Date(2026, 8, 19, 11, 0).toISOString() },
      l2: { progress: 100, updatedAt: new Date(2026, 8, 18, 11, 0).toISOString() },
    },
    certificate: { percent: 90, issuedAt: new Date(2026, 8, 19, 12, 0).toISOString() },
  },
};
const courseToday = T.todayFromCourses(courseProgressFixture, TODAY, coursePath);
ok("只算今天有播放记录的课时（l2 是昨天的）",
   courseToday.professional.count === 2, `count=${courseToday.professional.count}`);
ok("今天的结业测试也算一件（并且比一节课更有分量）",
   courseToday.professional.energy > T.TODAY_ENERGY.certificate - 0.001,
   `energy=${courseToday.professional.energy.toFixed(3)}`);
ok("没有时间戳的完成状态不算今天（不猜）",
   Object.keys(T.todayFromCourses({ "thai-business": { completed: { l1: true } } }, TODAY, path)).length === 0);
ok("课程归不到星球时如实返回 unmapped", (() => {
  const built = T.todayFromCourses(
    { "ghost-course": { lessonProgress: { l1: { updatedAt: new Date(2026, 8, 19, 13, 0).toISOString() } } } },
    TODAY,
    path
  );
  return Object.keys(built).length === 0 && built.unmapped.length === 1 && built.unmapped[0].courseId === "ghost-course";
})());

console.log("\n=== 11. 今日活动 · 装配到星球 ===");

const frozenPlanets = W.buildPlanets(path);
const before = JSON.stringify(frozenPlanets.map((p) => [p.id, p.progress, p.radius]));
const today = T.buildToday(frozenPlanets, {
  path,
  progress: { daily_history: [{ date: TODAY, words: 30, review_correct: 10, xp: 400 }] },
  courseProgress: courseProgressFixture,
  mediaState: { lessons: { [mediaLesson.id]: { updatedAt: new Date(2026, 8, 19, 10, 0).toISOString() } }, records: [] },
  speakingRecords: [{ timestamp: new Date(2026, 8, 19, 9, 5).getTime(), score: 72, mode: "word" }],
  now: NOW,
});

ok("buildToday 不修改传入的星球（返回新数组）",
   before === JSON.stringify(frozenPlanets.map((p) => [p.id, p.progress, p.radius])));
ok("五颗星球都拿到 today 字段（没有的也显式 active:false）",
   today.planets.length === 5 && today.planets.every((p) => typeof p.today?.active === "boolean"));
ok("四类今天的活动各自落到正确的星球上",
   ["foundation", "speaking", "media", "professional"].every((id) =>
     today.planets.find((p) => p.id === id)?.today.active),
   today.ids.join(","));
ok("今天没去的星球保持 idle（culture 没有被误点亮）",
   today.planets.find((p) => p.id === "culture")?.today.active === false);
ok("强度全部夹在 0~1", today.planets.every((p) => p.today.intensity >= 0 && p.today.intensity <= 1));
ok("今天练过的星球按强度从高到低排（读数面板的顺序有意义）",
   today.list.every((planet, index) => index === 0 || today.list[index - 1].today.intensity >= planet.today.intensity), today.ids.join(" > "));
ok("activeCount / totalSignals 与逐颗星球的数字一致",
   today.activeCount === today.list.length &&
   today.totalSignals === today.list.reduce((sum, planet) => sum + planet.today.count, 0));
ok("总述说的是今天（不是累计进度）",
   today.headline.includes("今天") && !today.headline.includes("%"), today.headline);
ok("每颗今天的星球都能点回真实落点",
   today.list.every((planet) => planet.today.items.every((item) => item.to.startsWith("/"))));
ok("今天的努力会汇进中心恒星（星系总活跃度 = 各星球之和）",
   today.intensity > 0 && today.intensity <= 1);
ok("时间标签是人话（刚刚/分钟/小时）",
   today.list.some((planet) => planet.today.lastLabel) &&
   today.list.filter((planet) => planet.today.lastAt).every((planet) => /刚刚|分钟前|小时前|今天早些时候/.test(planet.today.lastLabel)),
   today.list.map((p) => `${p.cn}:${p.today.lastLabel || "-"}`).join(" "));
ok("今天来过 → 尘埃被吹开（纯视觉标记，且不改累计字段）",
   today.list.every((planet) => planet.today.dustBlown === true) &&
   today.planets.every((planet) => typeof planet.veil?.tier === "string"));

/* 什么都没做的一天：不许编 */
const idle = T.buildToday(frozenPlanets, { path, now: NOW });
ok("今天什么都没做时 activeCount = 0 且 empty = true", idle.activeCount === 0 && idle.empty === true);
ok("什么都没做时也不编总分（intensity = 0）", idle.intensity === 0 && idle.totalSignals === 0);
ok("什么都没做时的文案是诚实的",
   idle.headline.includes("还没有") && !idle.headline.includes("0%"), idle.headline);

/* 昨天的活动不能点亮今天 */
const stale = T.buildToday(frozenPlanets, {
  path,
  progress: { daily_history: [{ date: YESTERDAY, words: 40, review_correct: 20, xp: 900 }] },
  mediaState: { lessons: { [mediaLesson.id]: { updatedAt: new Date(2026, 8, 18, 10, 0).toISOString() } }, records: [] },
  speakingRecords: [{ timestamp: new Date(2026, 8, 18, 10, 0).getTime(), score: 90, mode: "word" }],
  now: NOW,
});
ok("昨天练得再多，今天也是 0（「今天」这东西不能靠累计值顶替）",
   stale.activeCount === 0, `${stale.activeCount} 颗`);

/* 你正看着的时候发生的事 */
const countsBefore = T.todayCounts(idle);
const grown = T.todayCounts(today);
ok("爆发检测：挂载时的第一遍不算爆发",
   T.diffToday(null, { counts: grown }).length === 0);
ok("爆发检测：水合期内的「0 → 有数据」不算爆发（首屏水合不庆祝）",
   T.diffToday({ counts: countsBefore, ready: false }, { counts: grown }).length === 0 &&
   T.diffToday({ counts: countsBefore, ready: true }, { counts: grown }).length === 4,
   "ready=false 时 0 项，ready=true 时 4 项");
/* 从「今天什么都没做」到「练了四颗星球」：四颗都要被标成爆发 */
const burstIds = T.diffToday({ counts: countsBefore }, { counts: grown });
ok("爆发检测：数量变多的星球全部被标出来（不只是第一颗）",
   burstIds.length === 4 && burstIds.every((id) => grown[id] > countsBefore[id]),
   burstIds.join(","));
ok("爆发检测：没有变多就不算爆发（刷新页面不会重复庆祝）",
   !T.diffToday({ counts: grown }, { counts: grown }).length);
ok("爆发只在「变多」时触发，练完再刷新不会重复庆祝",
   T.diffToday({ counts: grown }, { counts: { ...grown, media: 99 } }).join(",") === "media");

ok("所有可能的今日事件都被订阅（媒体/课程/口语/词汇）",
   T.TODAY_SOURCE_EVENTS.length === 4 && new Set(T.TODAY_SOURCE_EVENTS).size === 4,
   T.TODAY_SOURCE_EVENTS.join(","));

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
