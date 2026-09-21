// src/lib/worldData.js
//
// =========================================================
// ThaiAI World · 数据映射层
// =========================================================
//
// 这一层只做一件事：把**已有的真实数据**翻译成「世界」里的实体。
// 它不发明任何新的学习数据，也不改变课程结构——星系、技能树、博物馆
// 全部由现有单一数据源推导：
//
//   星球（学习星系）   ← generateLearningPath(profile).stages
//   技能树（5 能力）   ← estimateAbilities(progress) + 星球进度
//   博物馆（5 展厅）   ← data/thaiCulture.js + data/mediaLessons.js
//   身份 HUD          ← useLearningProgress / useUserProfile / useAuth
//
// 纯函数、无副作用、不碰 localStorage（进度读取由调用方的 Hook/现有
// 模块负责），所以可以在任何地方调用与测试。
// =========================================================

import { getLevelInfo } from "@/lib/level";
import { getLevelMeta, goalEmoji, goalTitle } from "@/lib/placement";
import { cultureCategories, culturePoints } from "@/data/thaiCulture";
import { mediaCategories, mediaLessons } from "@/data/mediaLessons";

/* =========================================================
   XP 等级 → 探索者称号（与 AIProfileCard 同一套叙事）
========================================================= */

export function explorerTitle(level = 1) {
  if (level >= 9) return "Thai Master";
  if (level >= 7) return "Thai Voyager";
  if (level >= 5) return "Thai Explorer";
  if (level >= 3) return "Thai Traveler";
  if (level >= 2) return "Thai Seeker";
  return "Thai Beginner";
}

/* =========================================================
   一、学习星系 · 五颗星球
   =========================================================
   五颗星球对应学习路线的五大块。每颗星球上挂着**真实阶段**
   （generateLearningPath 产出的 stage），进度就是这些阶段的平均完成度，
   入口就是第一个未完成阶段的真实落点。

   th/ 泰语名（世界观的在地感）
   en/ 英文名（星球编号）
   cn/ 中文名（学生看得懂的）
========================================================= */

export const WORLD_PLANETS = [
  {
    id: "foundation",
    th: "ฐานราก",
    roman: "thǎan-râak",
    en: "FOUNDATION",
    cn: "基础基石",
    glyph: "◈",
    accent: "#6ee7a8",
    glow: "rgba(110,231,168,0.55)",
    tagline: "字母 · 声调 · 精读地基",
  },
  {
    id: "speaking",
    th: "การพูด",
    roman: "kaan-phûut",
    en: "SPEAKING",
    cn: "口语交流",
    glyph: "◉",
    /* 配色受设计说明约束：深墨绿 + 翡翠 + 暗金 + 少量暖橙。
       原来的科技蓝/粉/紫（#8ab4ff / #ff9ec7 / #c3a6ff）属于被明确排除的
       色系，这里改成同一家族里的薄荷、琥珀与沙金，星球之间仍然分得开。 */
    accent: "#7fd8c4",
    glow: "rgba(127,216,196,0.55)",
    tagline: "校园 · 旅行 · 点餐实战",
  },
  {
    id: "culture",
    th: "วัฒนธรรม",
    roman: "wát-thá-ná-tham",
    en: "CULTURE",
    cn: "文化探索",
    glyph: "❖",
    accent: "#e8c684",
    glow: "rgba(232,198,132,0.55)",
    tagline: "节庆 · 礼仪 · 阅读",
  },
  {
    id: "media",
    th: "สื่อ",
    roman: "sùue",
    en: "MEDIA",
    cn: "媒体沉浸",
    glyph: "▲",
    accent: "#d99a63",
    glow: "rgba(217,154,99,0.55)",
    tagline: "泰剧 · 歌曲 · 新闻听力",
  },
  {
    id: "professional",
    th: "วิชาชีพ",
    roman: "wí-chaa-chîip",
    en: "PROFESSIONAL",
    cn: "专业方向",
    glyph: "✦",
    accent: "#c9b98a",
    glow: "rgba(201,185,138,0.55)",
    tagline: "商务 · 学术 · 新闻 · 新媒体",
  },
];

/* =========================================================
   一·B、轨道编码与星尘遮蔽
   ---------------------------------------------------------
   星系要能被「转一圈就看懂」，编码就必须固定且单一：

     轨道半径 = 掌握度   —— 越熟越向中心靠拢（0% 在最外圈，100% 收到最近）
     星球亮度 = 完成度   —— 暗球 / 发光球（原本就有）
     星尘遮蔽 = 还没轮到（薄尘）/ 不在你的路线里（厚尘）

   ⚠️ 遮蔽现在是**真门禁**（2026-09-20 起）：薄尘 = 路线里还没轮到，
   厚尘 = 不在你的画像路线里，两种都 locked，点不进课程。
   入口只能从「当前阶段」往下走序解锁 —— 用户点锁定星球时会看到
   `unlockHint`（先完成哪一阶段），不是默默无反应。
   所有解除条件都来自真实路线数据，不编造「还需 X 天」。
========================================================= */

/** 最内侧轨道半径 */
export const ORBIT_BASE = 2.15;
/** 相邻轨道的半径差 */
export const ORBIT_STEP = 0.52;
/**
 * 单颗星球最多能向中心收紧多少。
 *
 * **必须 < ORBIT_STEP**，否则「掌握度高的外圈星球」会穿到内圈星球轨道
 * 里面去，星系的次序就乱了——用户看到的是随机分布，不是自己的进度。
 * `.check-world.mjs` 里有这条不变量的断言，改这两个常数会被测试拦住。
 */
export const MAX_ORBIT_PULL = 0.42;

/** 轨道半径 = 固定槽位 − 掌握度带来的收紧 */
export function orbitRadius(index, pull = 0) {
  const p = Math.max(0, Math.min(1, Number(pull) || 0));
  return ORBIT_BASE + index * ORBIT_STEP - p * MAX_ORBIT_PULL;
}

/** 星尘遮蔽档位（dust = 粒子数，渲染层直接用） */
export const VEIL_TIERS = {
  none: { level: 0, label: "清晰可见", dust: 0 },
  light: { level: 1, label: "薄星尘", dust: 30 },
  heavy: { level: 2, label: "厚星尘", dust: 64 },
};

const veilFor = (state) => {
  if (state === "ahead") {
    return { tier: "light", reason: "在你的路线里，还没轮到（未解锁）" };
  }
  if (state === "uncharted") {
    return { tier: "heavy", reason: "不在你当前的画像路线里（未解锁）" };
  }
  return { tier: "none", reason: "" };
};

/* =========================================================
   一·C、画像卫星（为什么每个用户的世界不一样）
   ---------------------------------------------------------
   卫星挂在星球旁，代表「因为你的画像，这里多长出了一个入口」。

   规则：
     - to 必须是 App.jsx 里真实存在的路由（不做假入口）
     - 同一颗星球上的卫星按 `to` 去重，不做四个按钮通向同一页
     - 权重 = 画像标签权重（目标 3 > 专业方向 2 > 兴趣媒体 1.5），
       所以「目标」永远排在自己兴趣的前面
========================================================= */

export const SATELLITE_LIBRARY = [
  /* 媒体星球 —— 兴趣媒体基本都落在这里 */
  /*
   * 注意：没有「电影」单独一条。
   * 媒体内容库只有 drama/song/variety/news/social/literature 六个分类，
   * 电影爱好者的最近内容是影视厅，所以 movie 兴趣直接复用「泰剧角」——
   * 而不是造一个叫「电影角」、点进去其实是泰剧课的假入口。
   * （.check-world.mjs 里有一条断言禁止两条卫星指向同一路径。）
   */
  { id: "drama", planet: "media", cn: "泰剧角", th: "ซีรีส์", emoji: "🎬", to: "/media?category=drama" },
  { id: "song", planet: "media", cn: "歌单", th: "เพลง", emoji: "🎵", to: "/media?category=song" },
  { id: "variety", planet: "media", cn: "综艺台", th: "วาไรตี้", emoji: "🎤", to: "/media?category=variety" },
  { id: "news", planet: "media", cn: "新闻听力", th: "ข่าว", emoji: "📰", to: "/media?category=news" },
  { id: "tiktok", planet: "media", cn: "短视频", th: "คลิปสั้น", emoji: "📱", to: "/media?category=social" },
  { id: "novel", planet: "media", cn: "文学角", th: "วรรณกรรม", emoji: "📚", to: "/media?category=literature" },

  /* 文化星球 */
  { id: "culture", planet: "culture", cn: "文化之旅", th: "วัฒนธรรม", emoji: "🌏", to: "/culture" },
  { id: "food", planet: "culture", cn: "点菜实战", th: "สั่งอาหาร", emoji: "🍜", to: "/conversation?scene=restaurant" },

  /* 口语星球 */
  { id: "travel", planet: "speaking", cn: "旅行实战", th: "ท่องเที่ยว", emoji: "✈️", to: "/conversation?scene=travel" },
  { id: "study", planet: "speaking", cn: "校园交流", th: "ในมหาลัย", emoji: "🏫", to: "/conversation?scene=campus" },

  /* 专业星球 */
  { id: "businessTrack", planet: "professional", cn: "商务路线", th: "ธุรกิจ", emoji: "💼", to: "/professional?track=business" },
  { id: "academicTrack", planet: "professional", cn: "学术路线", th: "วิชาการ", emoji: "🎓", to: "/professional?track=academic" },
  { id: "tourismTrack", planet: "professional", cn: "旅游服务", th: "บริการท่องเที่ยว", emoji: "🧳", to: "/professional?track=tourism" },
  { id: "newmediaTrack", planet: "professional", cn: "新媒体路线", th: "นิวมีเดีย", emoji: "📱", to: "/professional?track=newmedia" },

  /* 基础星球 */
  { id: "major", planet: "foundation", cn: "专业精读", th: "อ่านเชิงลึก", emoji: "📖", to: "/corpus/read" },
];

/**
 * 画像标签 → 卫星 / 展厅 / 世界配色。
 *
 * 注意 goal 的 id 与 media 的 id 会重名（例如 drama、travel、business
 * 三处都有），但它们的语义一致，所以共用同一个条目；只有 goal 独有的
 * `major` / `music` / `culture` 需要单独给。
 */
const TAG_EXPANSION = {
  /* goal 独有 */
  major: { satellites: ["major"], room: "history", accent: "#c3a6ff", name: "学术宇宙" },
  music: { satellites: ["song"], room: "media", accent: "#ffd27d", name: "音乐宇宙" },

  /* 兴趣媒体 / 目标共用 */
  drama: { satellites: ["drama"], room: "media", accent: "#ff9ec7", name: "追剧宇宙" },
  movie: { satellites: ["drama"], room: "media", accent: "#ff9ec7", name: "电影宇宙" },
  song: { satellites: ["song"], room: "media", accent: "#ffd27d", name: "音乐宇宙" },
  variety: { satellites: ["variety"], room: "media", accent: "#ff9ec7", name: "综艺宇宙" },
  news: { satellites: ["news"], room: "media", accent: "#8ab4ff", name: "新闻宇宙" },
  tiktok: { satellites: ["tiktok"], room: "media", accent: "#6ee7a8", name: "短视频宇宙" },
  novel: { satellites: ["novel"], room: "media", accent: "#c3a6ff", name: "文学宇宙" },
  food: { satellites: ["food"], room: "food", accent: "#ffb37d", name: "美食宇宙" },
  travel: { satellites: ["travel"], room: "lifestyle", accent: "#8ab4ff", name: "旅行宇宙" },
  study: { satellites: ["study"], room: "lifestyle", accent: "#6ee7a8", name: "留学宇宙" },
  culture: { satellites: ["culture"], room: "festival", accent: "#ffd27d", name: "文化宇宙" },

  /* 专业方向 */
  business: { satellites: ["businessTrack"], room: "lifestyle", accent: "#c3a6ff", name: "商务宇宙" },
  academic: { satellites: ["academicTrack"], room: "history", accent: "#c3a6ff", name: "学术宇宙" },
  tourism: { satellites: ["tourismTrack"], room: "lifestyle", accent: "#ffd27d", name: "旅游服务宇宙" },
  newmedia: { satellites: ["newmediaTrack"], room: "media", accent: "#ff9ec7", name: "新媒体宇宙" },
};

/** 没有画像时的世界（不编造喜好，回到中性的香槟金） */
export const DEFAULT_WORLD_THEME = {
  accent: "#e8c88a",
  name: "基础宇宙",
  headline: "做完 AI 入学测试，这个世界会按你的目标重新排布。",
  featuredRoomId: null,
  satellites: [],
  satellitesByPlanet: {},
  tags: [],
};

/** 画像 → [{ id, group, weight }]（权重越大越「是你的主线」） */
const themeTags = (profile) => {
  if (!profile) return [];
  return [
    ...(profile.learningGoal ? [{ id: profile.learningGoal, weight: 3 }] : []),
    ...(Array.isArray(profile.professionalDirection)
      ? profile.professionalDirection.map((id) => ({ id, weight: 2 }))
      : []),
    ...(Array.isArray(profile.mediaInterest)
      ? profile.mediaInterest.map((id) => ({ id, weight: 1.5 }))
      : []),
  ].filter((tag) => TAG_EXPANSION[tag.id]);
};

const satelliteById = (id) => SATELLITE_LIBRARY.find((item) => item.id === id) || null;

/**
 * 画像 → 世界主题：配色 / 命名 / 卫星分布 / 博物馆主展厅。
 *
 * 这是「同一个 URL，不同账号看到不同世界」的唯一开关：星系配色、每颗
 * 星球旁的卫星、博物馆的主展厅全部由它决定。
 *
 * @param {object|null} profile 学习画像
 */
export function buildWorldTheme(profile) {
  const tags = themeTags(profile);
  if (!tags.length) return { ...DEFAULT_WORLD_THEME };

  const sorted = [...tags].sort((a, b) => b.weight - a.weight);
  const primary = TAG_EXPANSION[sorted[0].id];

  /* 卫星：按权重顺序展开；同 to 去重（专业方向四条都通向 /professional，
     但它们的 ?track= 不同，所以仍然各自算一条） */
  const satellites = [];
  const seenIds = new Set();
  const seenTo = new Set();
  sorted.forEach((tag) => {
    TAG_EXPANSION[tag.id].satellites.forEach((sid) => {
      const sat = satelliteById(sid);
      if (!sat || seenIds.has(sat.id) || seenTo.has(sat.to)) return;
      seenIds.add(sat.id);
      seenTo.add(sat.to);
      satellites.push({ ...sat, weight: tag.weight, from: tag.id });
    });
  });

  const satellitesByPlanet = satellites.reduce((acc, sat) => {
    acc[sat.planet] = acc[sat.planet] ? [...acc[sat.planet], sat] : [sat];
    return acc;
  }, {});

  return {
    accent: primary.accent,
    name: primary.name,
    headline: `${primary.name} · 按你的画像排布`,
    featuredRoomId: primary.room || null,
    satellites,
    satellitesByPlanet,
    tags: sorted.map((tag) => tag.id),
  };
}

/*
 * 阶段 → 星球。键是 learningPath.js 的 STAGE_LIBRARY id。
 * 注意：专业方向（source === "track"，来自 Thai Professional Hub 的主动
 * 选择）一律归到 PROFESSIONAL，不再按主题分散——用户明确选的路线应该
 * 集中在一颗星球上发光。
 */
const PLANET_STAGE_IDS = {
  foundation: ["script", "core", "output"],
  speaking: ["campus", "travel", "food"],
  culture: ["culture", "reading"],
  media: ["drama", "screen", "song", "news", "tiktok"],
  professional: ["academic", "business", "tourism", "newmedia"],
};

/*
 * 导出：今日活动（lib/todayActivity.js）必须用**同一张归属表**把「今天学过的
 * 课程」归到星球上。如果那边自己再写一套映射，同一个用户会看到「今天在基础
 * 基石练了」但星球却在专业方向亮起来。
 */
export const planetOfStage = (stage) => {
  if (!stage) return null;
  if (stage.source === "track") return "professional";
  const found = Object.entries(PLANET_STAGE_IDS).find(([, ids]) =>
    ids.includes(stage.id)
  );
  return found ? found[0] : null;
};

/**
 * 路线 → 五颗星球的真实状态。
 *
 * @param {object|null} path    generateLearningPath() 的返回值（可能为 null：没做入学测试）
 * @param {object|null} profile 学习画像（决定卫星与亲和度；不传也不会报错）
 * @returns {Array} 每颗星球：
 *   progress    0~100（该星球挂载阶段的平均完成度）
 *   state       current（当前阶段所在）| active（有进度但未完成）|
 *               done（全部完成）| ahead（在你的路线里，还没轮到）|
 *               uncharted（不在当前路线内——画像没推到这里）
 *   locked      boolean，ahead / uncharted 两种状态都是真门禁（点不进课程）
 *   unlockHint  解锁条件（人话：先完成当前阶段「…」）
 *   stages      真实阶段（用于展开详情与时间窗）
 *   to/cta      可立即执行的落点（第一个未完成阶段）
 *   orbitIndex  固定槽位（决定它排第几圈，不随进度变化）
 *   mastery     0~1，掌握度（= progress / 100）
 *   pull        0~1，向中心收紧的比例（掌握度直接驱动，不掺别的）
 *   radius      真实轨道半径（= orbitRadius(orbitIndex, pull)）
 *   veil        { tier: none|light|heavy, label, dust, reason }  星尘遮蔽
 *   affinity    0~1，与用户画像的契合度（决定它额外的光晕）
 *   satellites  画像带来的卫星入口（可能为空数组）
 *   laggard     boolean，是否全星系进度最低的一块
 *   laggardNote 为什么标它（人话，带真实数字）
 */
export function buildPlanets(path, profile = null) {
  const stages = Array.isArray(path?.stages) ? path.stages : [];
  const currentId = path?.current?.id || null;
  const theme = buildWorldTheme(profile);
  const satellitesByPlanet = theme.satellitesByPlanet || {};

  const built = WORLD_PLANETS.map((planet) => {
    const owned = stages.filter((stage) => planetOfStage(stage) === planet.id);

    const progress = owned.length
      ? Math.round(
          owned.reduce((sum, stage) => sum + (Number(stage.progress) || 0), 0) /
            owned.length
        )
      : 0;

    const done = owned.length > 0 && owned.every((stage) => stage.done);
    const isCurrent = owned.some((stage) => stage.id === currentId);
    const next = owned.find((stage) => !stage.done) || null;

    let state = "uncharted";
    if (done) state = "done";
    else if (isCurrent) state = "current";
    else if (owned.length) state = progress > 0 ? "active" : "ahead";

    const veilTier = veilFor(state);
    const satellites = satellitesByPlanet[planet.id] || [];

    /*
     * 亲和度：画像直接点名的星球给高光。
     * 用 min(1, ...) 封顶，因为「点了 3 个以上的兴趣」不应该把星球放大到
     * 挤满轨道——那是视觉噪声，不是「更懂你」。
     */
    const namedTags = (theme.tags || []).filter((tag) =>
      TAG_EXPANSION[tag]?.satellites?.some(
        (sid) => satelliteById(sid)?.planet === planet.id
      )
    );
    const affinity = namedTags.length
      ? Math.min(1, 0.55 + namedTags.length * 0.15)
      : 0;

    const mastery = Math.max(0, Math.min(1, progress / 100));

    return {
      ...planet,
      stages: owned,
      stageCount: owned.length,
      doneCount: owned.filter((stage) => stage.done).length,
      progress,
      state,
      currentStage: isCurrent ? path.current : null,
      nextStage: next,
      /* 星球入口：优先当前/下一阶段真实落点，否则回学习路线页 */
      to: next?.to || owned[0]?.to || "/plan",
      cta: next?.cta || owned[0]?.cta || "查看学习路线",
      hoursLeft: owned.reduce(
        (sum, stage) =>
          sum + Math.max(0, (Number(stage.hours) || 0) * (1 - (Number(stage.progress) || 0) / 100)),
        0
      ),
      window: owned[0]?.window || null,
      /* 为什么这颗星球在你的世界里（画像解释，直说人话） */
      why: owned.find((stage) => stage.why)?.why || "",
      /*
       * 门禁：ahead / uncharted 都点不进课程。
       * 解锁条件只说真话——能指出就指出「先完成哪一阶段」，指不出就说顺序。
       */
      locked: state === "ahead" || state === "uncharted",
      unlockHint:
        state === "uncharted"
          ? path
            ? "不在你当前的画像路线里 · 可在「专业方向」选一条路线，或重做 AI 入学测试"
            : "先做一次 AI 入学测试，生成你的学习路线"
          : path?.current?.title
            ? `先完成当前阶段「${path.current.title}」`
            : "按学习路线的顺序解锁：先完成前面的阶段",
      /* ── 空间编码（星系靠这几个数说话） ── */
      mastery,
      pull: mastery,
      veil: { tier: veilTier.tier, ...VEIL_TIERS[veilTier.tier], reason: veilTier.reason },
      affinity,
      satellites,
      satelliteCount: satellites.length,
      laggard: false,
      laggardNote: "",
    };
  });

  /*
   * 「我到底卡在哪」：只在**真的看得出来差距**时才标。
   *
   * 判据全是真实可比的数字，不做心理揣测：
   *   ① 这颗星球在你的路线里（uncharted 不算——那不是落后，是没安排）
   *   ② 它还没完成（< 60%），而且比全星系最亮的一块落后 ≥ 15 个点
   * 两条不满足就不标任何东西——宁可少说，也不编一个「你卡住了」。
   */
  const inPath = built.filter(
    (planet) => planet.state !== "uncharted" && planet.stageCount > 0
  );
  let laggardId = null;
  if (inPath.length > 1) {
    const lowest = [...inPath].sort((a, b) => a.progress - b.progress)[0];
    const highest = [...inPath].sort((a, b) => b.progress - a.progress)[0];
    if (lowest.id !== highest.id && lowest.progress < 60 && highest.progress - lowest.progress >= 15) {
      laggardId = lowest.id;
    }
  }

  return built.map((planet, index) => {
    const radius = orbitRadius(index, planet.pull);
    const isLaggard = planet.id === laggardId;
    return {
      ...planet,
      /* 槽位固定为数组下标：星球排第几圈只由「它在路线里的位置」决定 */
      orbitIndex: index,
      radius,
      /* 收紧了多少——只给数字，单位在 UI 里说清楚 */
      pullNote: planet.pull > 0.01 ? `${Math.round(planet.pull * MAX_ORBIT_PULL * 100)}` : "",
      laggard: isLaggard,
      laggardNote: isLaggard
        ? `全星系进度最低的一块（${planet.progress}%），比领先的「${
            built.find((item) => item.id !== planet.id && item.state !== "uncharted")?.cn || "其它星球"
          }」落后 ${Math.round(
            (built.filter((item) => item.state !== "uncharted").reduce((max, item) => Math.max(max, item.progress), 0) || 0) -
              planet.progress
          )} 个点`
        : "",
    };
  });
}

/** 当前所在星球（没有则返回第一颗，保证世界永远有焦点） */
export function currentPlanet(planets = []) {
  return (
    planets.find((planet) => planet.state === "current") ||
    planets.find((planet) => planet.state === "active") ||
    planets.find((planet) => planet.state === "ahead") ||
    planets[0] ||
    null
  );
}

/* =========================================================
   二、泰语技能树 · 五条能力枝
   =========================================================
   六维能力模型（词汇/口语/听力/阅读/语法/声调）合并成五条「枝」：
     Pronunciation ← 声调
     Vocabulary    ← 词汇
     Grammar       ← 语法
     Speaking      ← 口语 + 听力
     Culture       ← 阅读 + 文化星球的真实进度
   每枝给「种子数」（1~5）决定视觉生长阶段。
========================================================= */

const SKILL_SEEDS = [
  { min: 80, seeds: 5, state: "bloom", label: "盛开" },
  { min: 60, seeds: 4, state: "growing", label: "抽枝" },
  { min: 40, seeds: 3, state: "growing", label: "生长" },
  { min: 20, seeds: 2, state: "sprout", label: "萌芽" },
  { min: 0, seeds: 1, state: "seed", label: "播种" },
];

const seedsFor = (score) =>
  SKILL_SEEDS.find((tier) => score >= tier.min) || SKILL_SEEDS[SKILL_SEEDS.length - 1];

export const SKILL_NODES = [
  {
    id: "pronunciation",
    cn: "发音与声调",
    en: "Pronunciation",
    th: "การออกเสียง",
    glyph: "๑",
    accent: "#6ee7a8",
    to: "/alphabet",
    tip: "中高低辅音 + 五个声调：先把「读得准」拿到手，背词会快一倍。",
  },
  {
    id: "vocabulary",
    cn: "词汇根系",
    en: "Vocabulary",
    th: "คำศัพท์",
    glyph: "๒",
    accent: "#8ab4ff",
    to: "/vocabulary",
    tip: "词汇量是所有能力的根系，它长得最快，也决定其他四条枝的上限。",
  },
  {
    id: "grammar",
    cn: "语法骨架",
    en: "Grammar",
    th: "ไวยากรณ์",
    glyph: "๓",
    accent: "#ffd27d",
    to: "/lessons",
    tip: "语序、量词、时态标记：结构稳了，句子就不靠单词硬拼。",
  },
  {
    id: "speaking",
    cn: "口语输出",
    en: "Speaking",
    th: "การพูด",
    glyph: "๔",
    accent: "#ff9ec7",
    to: "/speaking",
    tip: "敢开口 > 说得准。先练条件反射式的场景句，再纠细节。",
  },
  {
    id: "culture",
    cn: "文化理解",
    en: "Culture",
    th: "วัฒนธรรม",
    glyph: "๕",
    accent: "#c3a6ff",
    to: "/culture",
    tip: "懂了文化才知道「这句话为什么这么说」，也是追剧听懂潜台词的关键。",
  },
];

/**
 * 能力分 → 五条枝。
 *
 * @param {object} abilities estimateAbilities(progress) 的结果
 * @param {Array}  planets   buildPlanets() 的结果（Culture 枝要用它的真实进度）
 */
export function buildSkillTree(abilities = {}, planets = []) {
  const culturePlanet = planets.find((planet) => planet.id === "culture");
  const cultureProgress = Number(culturePlanet?.progress) || 0;

  const num = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

  /* 词汇量低但正确率高的用户，发音其实往往不错——所以发音不只看声调分 */
  const pronunciation = num((Number(abilities.tone) || 0) * 0.7 + (Number(abilities.vocab) || 0) * 0.3);
  /*
   * 文化枝以「阅读能力」为主、文化模块进度为辅。
   * 反过来（进度为主）会让从没打开过文化模块的用户看到一枝 20 分的枯枝，
   * 哪怕他明明能读长文——那是误导，不是激励。
   */
  const cultureScore = num((Number(abilities.reading) || 0) * 0.6 + cultureProgress * 0.4);

  const scores = {
    pronunciation,
    vocabulary: num(abilities.vocab),
    grammar: num(abilities.grammar),
    speaking: num((Number(abilities.speaking) || 0) * 0.7 + (Number(abilities.listening) || 0) * 0.3),
    culture: cultureScore,
  };

  return SKILL_NODES.map((node, index) => {
    const score = scores[node.id] || 0;
    const tier = seedsFor(score);
    return {
      ...node,
      index,
      score,
      seeds: tier.seeds,
      growthState: tier.state,
      growthLabel: tier.label,
      /* 还没起步 vs 已经在长 —— 视觉上要能一眼分开 */
      started: score > 0,
    };
  });
}

/** 技能树整体健康度（世界 HUD 用） */
export function skillTreeSummary(tree = []) {
  const avg = tree.length
    ? Math.round(tree.reduce((sum, node) => sum + node.score, 0) / tree.length)
    : 0;
  const strongest = [...tree].sort((a, b) => b.score - a.score)[0] || null;
  const weakest = [...tree].sort((a, b) => a.score - b.score)[0] || null;
  return { avg, strongest, weakest };
}

/* =========================================================
   三、泰国数字博物馆 · 五个展厅
   =========================================================
   展厅不新造内容，而是把两个已有内容库按主题重新布展：
     data/thaiCulture.js   culturePoints（真实文化条目）
     data/mediaLessons.js  mediaLessons（媒体学习课程）
========================================================= */

/**
 * 展厅定义。
 *   cultureCategories 该展厅收哪些文化分类（对应 thaiCulture.js）
 *   mediaTypes       该展厅收哪几类媒体课（对应 mediaLessons.js 的 type）
========================================================= */
export const MUSEUM_ROOMS = [
  {
    id: "food",
    cn: "饮食",
    th: "อาหาร",
    en: "FOOD",
    emoji: "🍜",
    accent: "#ffb37d",
    cultureCategories: ["food"],
    mediaTypes: [],
    to: "/culture",
    scene: { label: "去餐厅点菜", to: "/conversation?scene=restaurant" },
    blurb: "从冬阴功到街边摊：菜单上真正会出现的词，和点菜时的礼貌说法。",
  },
  {
    id: "festival",
    cn: "节庆",
    th: "เทศกาล",
    en: "FESTIVAL",
    emoji: "🎉",
    accent: "#ffd27d",
    cultureCategories: ["festival"],
    mediaTypes: [],
    to: "/culture",
    scene: { label: "聊节日场景", to: "/conversation?scene=culture" },
    blurb: "泼水节、水灯节、守夏节：什么时候说祝福、什么时候不能开玩笑。",
  },
  {
    id: "lifestyle",
    cn: "生活方式",
    th: "ชีวิตประจำวัน",
    en: "LIFESTYLE",
    emoji: "🙏",
    accent: "#6ee7a8",
    cultureCategories: ["etiquette", "slang"],
    mediaTypes: ["social"],
    to: "/culture",
    scene: { label: "日常交流场景", to: "/conversation?scene=daily" },
    blurb: "合十礼、礼貌用语、年轻人的网络说法：怎么说话才不冒犯、才不老派。",
  },
  {
    id: "media",
    cn: "影视媒体",
    th: "สื่อ",
    en: "MEDIA",
    emoji: "🎬",
    accent: "#ff9ec7",
    cultureCategories: ["media"],
    mediaTypes: ["drama", "song", "variety", "news"],
    to: "/media",
    scene: { label: "进媒体学习", to: "/media" },
    blurb: "泰剧、歌曲、综艺、新闻：真实语速与真实语体，字幕背后才是真功夫。",
  },
  {
    id: "history",
    cn: "历史与古迹",
    th: "ประวัติศาสตร์",
    en: "HISTORY",
    emoji: "🛕",
    accent: "#c3a6ff",
    cultureCategories: ["temple"],
    mediaTypes: ["literature"],
    to: "/culture",
    scene: { label: "读文化条目", to: "/culture" },
    blurb: "寺庙、王朝与书面语：语言的「庄重版本」是怎么来的。",
  },
];

/**
 * 展厅 → 真实展品与进度。
 *
 * 进度只来自**真的会被记录的数据**：媒体课的完成情况
 * （mediaProgress 的 lessons[].status === "done"）。文化条目目前没有
 * 阅读记录（Culture 页本来就不记），所以那些展厅返回 progress: null，
 * 由 UI 显示「N 件展品」而不是编造一个百分比。
 *
 * 画像命中时，那个展厅会被抬成「主展厅」并置顶——同一批展品，泰剧爱好
 * 者走进去先看到的是影视厅，而不是顺序固定的饮食厅。
 *
 * @param {object}      mediaState readMediaState() 的结果（默认空）
 * @param {object|null} profile    学习画像（决定主展厅；不传则保持原顺序）
 */
export function buildMuseumRooms(mediaState = {}, profile = null) {
  const lessonsState = mediaState?.lessons || {};
  const theme = buildWorldTheme(profile);
  const featuredId = theme.featuredRoomId;

  const built = MUSEUM_ROOMS.map((room) => {
    const cultureItems = culturePoints.filter((point) =>
      room.cultureCategories.includes(point.category)
    );
    const mediaItems = mediaLessons.filter((lesson) =>
      room.mediaTypes.includes(lesson.type)
    );

    const mediaDone = mediaItems.filter(
      (lesson) => lessonsState[lesson.id]?.status === "done"
    ).length;
    const mediaStarted = mediaItems.filter(
      (lesson) => lessonsState[lesson.id]
    ).length;

    const total = cultureItems.length + mediaItems.length;
    /* 只有该展厅确实有媒体课（即有真实进度信号）时才给出百分比 */
    const progress = mediaItems.length
      ? Math.round((mediaDone / mediaItems.length) * 100)
      : null;

    /* 展品预览：取真实条目的标题，不用占位文案 */
    const samples = [
      ...cultureItems.slice(0, 3).map((point) => ({
        id: point.id,
        title: point.title || point.thai || point.id,
        kind: "culture",
        category: room.cultureCategories[0],
      })),
      ...mediaItems.slice(0, 2).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        kind: "media",
        category: lesson.type,
      })),
    ];

    return {
      ...room,
      total,
      progress,
      mediaDone,
      mediaStarted,
      mediaTotal: mediaItems.length,
      cultureCount: cultureItems.length,
      mediaCount: mediaItems.length,
      samples,
      /* 展厅状态：还没进去过 / 正在参观 / 已看完 */
      state:
        progress === null
          ? "exhibit"
          : progress >= 100
            ? "done"
            : progress > 0
              ? "visiting"
              : "unopened",
      featured: room.id === featuredId,
      featuredReason:
        room.id === featuredId
          ? `你的画像偏「${theme.name}」，所以进门先给你看「${room.cn}」这一厅`
          : "",
    };
  });

  /* 主展厅置顶（其余保持原顺序）：只改展示次序，不改内容与进度 */
  if (!featuredId) return built;
  return [
    ...built.filter((room) => room.featured),
    ...built.filter((room) => !room.featured),
  ];
}

/** 展厅分类的可读名（Culture 页的分类就是它） */
export const cultureCategoryLabel = (id) =>
  cultureCategories.find((category) => category.id === id)?.label || id;

/** 媒体分类的可读名 */
export const mediaCategoryLabel = (id) =>
  mediaCategories.find((category) => category.id === id)?.label || id;

/* =========================================================
   四、身份 HUD
   =========================================================
   世界英雄区的抬头信息。全部来自现有数据源，未做入学测试时
   以「待觉醒」状态呈现（而不是编造等级）。
========================================================= */

export function buildIdentity({
  user,
  profile,
  progress,
  hasTest,
  localProgressFallback,
} = {}) {
  const fallback = localProgressFallback || null;
  const level = progress?.level || fallback?.level || 1;
  const xp = progress?.xp || fallback?.xp || 0;
  const streak = progress?.learning_streak || 0;

  const thaiLevel = hasTest && profile?.thaiLevel ? getLevelMeta(profile.thaiLevel) : null;

  /*
   * XP 进度走 getLevelInfo（真实的等级曲线：0/150/400/700/1100/1600/
   * 2200/3000/4000/5000）。
   *
   * 之前这里是「(level + 1) * 100 - xp」——那是另一套每级 +100 的假设，
   * 与 useLearningProgress 的曲线对不上：1650 XP 明明离 Lv.7（2200）还差
   * 550，界面却写「距 Lv.7 还差 0 XP」。数字错得刚好离谱。
   */
  const xpInfo = getLevelInfo(xp);

  return {
    name: user?.nickname || (user?.email || "").split("@")[0] || "朋友",
    isVip: Boolean(user?.isVip),
    xpLevel: level,
    xp,
    /* 下一级所需 XP（null = 已封顶） */
    xpNextAt: xpInfo.next,
    xpToNext: xpInfo.next != null ? Math.max(0, xpInfo.next - xp) : 0,
    xpPercent: xpInfo.percent,
    streak,
    title: explorerTitle(level),
    hasTest: Boolean(hasTest),
    cefr: thaiLevel?.id || "待测",
    cefrTitle: thaiLevel?.title || "未做入学测试",
    goal: hasTest ? goalTitle(profile?.learningGoal) : "",
    goalEmoji: hasTest ? goalEmoji(profile?.learningGoal) : "",
    scenario: profile?.targetScenario || "",
    mastered: Number(progress?.total_vocabulary) || 0,
  };
}

export default {
  WORLD_PLANETS,
  MUSEUM_ROOMS,
  SKILL_NODES,
  SATELLITE_LIBRARY,
  VEIL_TIERS,
  ORBIT_BASE,
  ORBIT_STEP,
  MAX_ORBIT_PULL,
  DEFAULT_WORLD_THEME,
  explorerTitle,
  orbitRadius,
  buildPlanets,
  currentPlanet,
  buildSkillTree,
  skillTreeSummary,
  buildMuseumRooms,
  buildWorldTheme,
  buildIdentity,
  cultureCategoryLabel,
  mediaCategoryLabel,
};
