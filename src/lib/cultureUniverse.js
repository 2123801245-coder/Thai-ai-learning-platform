// src/lib/cultureUniverse.js
//
// =========================================================
// ThaiAI Culture Universe · 文化宇宙数据层
// =========================================================
//
// 四个沉浸空间的「编排层」——**不生产内容，只组装内容**：
//
//   1. Drama World   → mediaLessons.js 的 drama/variety 课
//   2. Music Studio  → mediaLessons.js 的 song 课
//   3. News Lab      → /api/news/daily 的真实新闻（zh_title/roman_title 已由后端译好）
//   4. Thailand Explorer → thaiCulture.js 的文化点（按城市聚合）+ conversations.js 的场景
//   5. Scenario Training → /conversation?scene= 的四个场景（mentorScenes，已上线）
//
// 城市聚合是**数据驱动**的：每个城市声明自己认领的文化点 id 与对话场景 id，
// 查不到的（数据下线/拼错）在构建时被静默剔除，页面永不渲染死链接。

import { mediaLessons } from "@/data/mediaLessons";
import { culturePoints } from "@/data/thaiCulture";
import { cityProfiles } from "@/data/cityProfiles";

/* ── 空间元数据 ── */
export const universeSpaces = [
  {
    id: "drama",
    no: "01",
    name: "泰剧世界",
    en: "Thai Drama World",
    emoji: "🎬",
    tagline: "在剧情里学会说话",
    desc: "逐句字幕、词汇浮现、语法拆解——AI 老师陪你把每一幕看懂、说出口。",
    hue: "#e05a8a",
    sceneIds: ["drama", "variety"],
  },
  {
    id: "music",
    no: "02",
    name: "音乐工作室",
    en: "Thai Music Studio",
    emoji: "🎵",
    tagline: "歌词是最好背的课文",
    desc: "逐行歌词、韵脚与叠词的表达分析，唱一遍就记住了。",
    hue: "#8a6ae0",
    sceneIds: ["song"],
  },
  {
    id: "news",
    no: "03",
    name: "新闻实验室",
    en: "Thai News Lab",
    emoji: "📰",
    tagline: "今天真实的泰国",
    desc: "每日真实新闻，泰中双语逐段对照，词汇自动提取，难度随你调。",
    hue: "#3a9ad0",
    sceneIds: ["news"],
  },
  {
    id: "explorer",
    no: "04",
    name: "泰国探索者",
    en: "Thailand Explorer",
    emoji: "🗺️",
    tagline: "把地图变成课文",
    desc: "曼谷、清迈、普吉、清莱——每座城市都是文化、场景与旅行对话的入口。",
    hue: "#d09a3a",
    sceneIds: [],
  },
];

/* ── 空间 → 媒体课（drama/variety/song） ── */
export function lessonsForSpace(spaceId) {
  const space = universeSpaces.find((s) => s.id === spaceId);
  if (!space || !space.sceneIds.length) return [];
  return mediaLessons.filter((l) => space.sceneIds.includes(l.type));
}

/* ── 城市数据：地图坐标 + 文化点 + 对话场景 + 旅行语言点 ──
 *
 * 顺序 = 「探索路线」的路线顺序（右下角路线栏逐条往下走），也是虚线航路的串联顺序。
 *   x / y  —— 地图坐标系百分比（对应 public/images/explorer/thailand-map 的 1536×1024）
 *   tags    —— 地图标签第二行的三个关键词
 *   thumb   —— 路线栏前面的圆形实景缩略图（同一张地图里裁出来的真实场景）
 * cultureIds / scenario 都是**真实存在的 id**：查不到的会被 cultureForCity 静默剔除。
 */
export const cityAtlas = [
  {
    id: "chiangmai",
    thai: "เชียงใหม่",
    roman: "siiang-mài",
    name: "清迈",
    en: "Chiang Mai",
    emoji: "⛰️",
    x: 22.8, y: 15.8,
    color: "#50dca0",
    tags: ["兰纳文化", "寺庙", "咖啡"],
    thumb: "/images/explorer/chiangmai.webp",
    tagline: "泰北玫瑰：古城、咖啡与慢生活",
    scenario: { id: "campus", label: "大学校园" },
    extraScenarios: [
      { id: "restaurant", label: "餐厅点餐" },
      { id: "convenience", label: "便利店" },
    ],
    cultureIds: ["songkran", "mangorice", "wai", "monk"],
    language: [
      { th: "นั่งชิล ๆ อยู่เชียงใหม่", roman: "nâang chill-chill yùu siiang-mài", cn: "在清迈悠闲地坐着" },
      { th: "ขอคาปูชิโน่แก้วใหญ่ค่ะ", roman: "khɔ̌ɔ kaapuu-chi-nôo gɛ̂ɛo yài khâ", cn: "要一杯大杯卡布奇诺" },
      { th: "อากาศเย็นกำลังดี", roman: "aa-gàat yen gam-lang dii", cn: "天气凉爽正好" },
    ],
  },
  {
    id: "bangkok",
    thai: "กรุงเทพฯ",
    roman: "grung-têep",
    name: "曼谷",
    en: "Bangkok",
    emoji: "🏙️",
    x: 38.7, y: 42.0,
    color: "#d09a3a",
    tags: ["现代", "文化", "美食"],
    thumb: "/images/explorer/bangkok.webp",
    tagline: "天使之城：金顶寺庙与天际线共存",
    scenario: { id: "taxi", label: "曼谷出租车" },
    extraScenarios: [
      { id: "hotel", label: "酒店入住" },
      { id: "nightmarket", label: "火车夜市" },
    ],
    cultureIds: ["songkran", "loykrathong", "wai", "tomyum", "streetfood"],
    language: [
      { th: "ไปที่นี่ครับ", roman: "pai thîi nîi kráp", cn: "去这里（给司机看地址）" },
      { th: "เปิดแอร์ได้ไหมครับ", roman: "pəət aa dâai mǎi kráp", cn: "可以开空调吗" },
      { th: "จอดตรงนี้ได้ครับ", roman: "jɔ̀ɔt trong níi dâai kráp", cn: "在这儿停就行" },
    ],
  },
  {
    id: "ayutthaya",
    thai: "อยุธยา",
    roman: "à-yút-tha-yaa",
    name: "大城",
    en: "Ayutthaya",
    emoji: "🏛️",
    x: 53.7, y: 34.9,
    color: "#c98a5a",
    tags: ["古都", "历史", "遗迹"],
    thumb: "/images/explorer/ayutthaya.webp",
    tagline: "旧都废墟：红砖佛塔与湄南河落日",
    scenario: { id: "culture", label: "遗迹导览" },
    extraScenarios: [
      { id: "travel", label: "城际出行" },
      { id: "restaurant", label: "河边餐厅" },
    ],
    cultureIds: ["monk", "wai", "krab", "tambun"],
    language: [
      { th: "วัดนี้เก่าแก่มาก", roman: "wát níi kào-kɛ̀ɛ mâak", cn: "这座庙非常古老" },
      { th: "ซื้อตั๋วเข้าชมที่ไหน", roman: "sʉ́ʉ dtǔa khâo chom thîi nǎi", cn: "在哪儿买参观票" },
      { th: "ถ่ายรูปกับโบราณสถานได้ไหม", roman: "thàai rûup gàp boo-raan-ná-sà-thǎan dâai mǎi", cn: "可以和古迹合影吗" },
    ],
  },
  {
    id: "phuket",
    thai: "ภูเก็ต",
    roman: "phuu-gèet",
    name: "普吉",
    en: "Phuket",
    emoji: "🏝️",
    x: 16.3, y: 66.4,
    color: "#3ab0d0",
    tags: ["海岛", "阳光", "海洋"],
    thumb: "/images/explorer/phuket.webp",
    tagline: "安达曼明珠：海、船与日落",
    scenario: { id: "travel", label: "旅行出行" },
    extraScenarios: [{ id: "shopping", label: "市场购物" }],
    cultureIds: ["wai", "tomyum", "somtam", "padthai"],
    language: [
      { th: "ไปเกาะนี้กี่โมง", roman: "pai kɔ̀ níi kìi moong", cn: "几点去这个岛" },
      { th: "ขอเช่ามอเตอร์ไซค์วันหนึ่ง", roman: "khɔ̌ɔ châo mɔɔ-dtəə-sai wan nùeng", cn: "租一天摩托车" },
      { th: "หาดนี้ว่ายน้ำได้ไหม", roman: "hàat níi wâai náam dâai mǎi", cn: "这片海滩能游泳吗" },
    ],
  },
  {
    id: "krabi",
    thai: "กระบี่",
    roman: "grà-bìi",
    name: "甲米",
    en: "Krabi",
    emoji: "⛰️",
    x: 36.8, y: 71.5,
    color: "#46c9b0",
    tags: ["海岸", "石灰岩", "自然"],
    thumb: "/images/explorer/krabi.webp",
    tagline: "石灰岩峭壁从翡翠海里长出来",
    scenario: { id: "travel", label: "出海跳岛" },
    extraScenarios: [
      { id: "hotel", label: "度假村入住" },
      { id: "shopping", label: "夜市购物" },
    ],
    cultureIds: ["somtam", "streetfood", "tomyum", "loykrathong"],
    language: [
      { th: "ไปเกาะไกลไหม", roman: "pai kɔ̀ klai mǎi", cn: "去那座岛远吗" },
      { th: "ขอเช่าเรือไปเกาะ", roman: "khɔ̌ɔ châo rʉʉa pai kɔ̀", cn: "想租船去海岛" },
      { th: "น้ำทะเลใสมาก", roman: "náam thá-lee sǎi mâak", cn: "海水很清" },
    ],
  },
  {
    id: "samui",
    thai: "เกาะสมุย",
    roman: "kɔ̀ sà-mui",
    name: "苏梅岛",
    en: "Koh Samui",
    emoji: "🌴",
    x: 59.4, y: 78.8,
    color: "#6ad0a0",
    tags: ["海岛", "度假", "椰林"],
    thumb: "/images/explorer/samui.webp",
    tagline: "椰林与沙滩：把发音练成海风",
    scenario: { id: "hotel", label: "度假村入住" },
    extraScenarios: [
      { id: "restaurant", label: "海滩餐厅" },
      { id: "shopping", label: "渔村夜市" },
    ],
    cultureIds: ["loykrathong", "somtam", "mangorice", "streetfood"],
    language: [
      { th: "เช็คอินกี่โมง", roman: "chék-in kìi moong", cn: "几点可以入住" },
      { th: "มีห้องติดทะเลไหม", roman: "mii hɔ̂ng dtìt thá-lee mǎi", cn: "有海景房吗" },
      { th: "ปูเสื่อริมหาดได้ไหม", roman: "puu sʉ̀a rim hàat dâai mǎi", cn: "可以在海边铺席子坐吗" },
    ],
  },
  {
    id: "isan",
    thai: "อีสาน",
    roman: "ii-sǎan",
    name: "伊善",
    en: "Isan",
    emoji: "🌾",
    x: 70.1, y: 34.7,
    color: "#e0a15a",
    tags: ["东北", "文化", "生活"],
    thumb: "/images/explorer/isan.webp",
    tagline: "东北部：辣味食物、乡村音乐与另一套泰语",
    scenario: { id: "restaurant", label: "东北菜点餐" },
    extraScenarios: [
      { id: "daily", label: "日常寒暄" },
      { id: "shopping", label: "市集购物" },
    ],
    cultureIds: ["somtam", "tomyum", "luktung", "streetfood"],
    language: [
      { th: "แซบหลาย", roman: "sɛ̂ɛp lǎai", cn: "太好吃了（伊善话）" },
      { th: "ไปไส", roman: "pai sǎi", cn: "去哪儿（伊善话）" },
      { th: "ขอส้มตำกับไก่ย่าง", roman: "khɔ̌ɔ sôm-dtam gàp gài-yâang", cn: "要青木瓜沙拉和烤鸡" },
    ],
  },
  {
    id: "chiangrai",
    thai: "เชียงราย",
    roman: "siiang-raai",
    name: "清莱",
    en: "Chiang Rai",
    emoji: "🛕",
    x: 44.6, y: 6.6,
    color: "#e05a8a",
    tags: ["山城", "白庙", "茶园"],
    thumb: "/images/explorer/chiangrai.webp",
    tagline: "艺术之城：白庙蓝庙与金三角",
    scenario: { id: "culture", label: "文化体验" },
    extraScenarios: [{ id: "daily", label: "日常寒暄" }],
    cultureIds: ["loykrathong", "khaophansa", "emerald", "monk"],
    language: [
      { th: "วัดนี้สวยมากครับ", roman: "wát níi sǔay mâak kráp", cn: "这座庙真美" },
      { th: "ถ่ายรูปได้ไหมคะ", roman: "thâai rûup dâai mǎi khá", cn: "可以拍照吗" },
      { th: "เปิดกี่โมงครับ", roman: "pəət kìi moong kráp", cn: "几点开门" },
    ],
  },
  {
    id: "sukhothai",
    thai: "สุโขทัย",
    roman: "sù-khǒo-thai",
    name: "素可泰",
    en: "Sukhothai",
    emoji: "🗿",
    x: 52.1, y: 21.5,
    color: "#d8b46a",
    tags: ["古城", "历史", "遗迹"],
    thumb: "/images/explorer/sukhothai.webp",
    tagline: "泰文字的发源地：安静的历史公园",
    scenario: { id: "culture", label: "古城骑行导览" },
    extraScenarios: [
      { id: "daily", label: "小城寒暄" },
      { id: "hotel", label: "民宿入住" },
    ],
    cultureIds: ["monk", "tambun", "wai", "krab"],
    language: [
      { th: "เช่าจักรยานเท่าไหร่", roman: "châo jàk-grà-yaan thâo-rài", cn: "租自行车多少钱" },
      { th: "อุทยานประวัติศาสตร์อยู่ไหน", roman: "ùt-thá-yaan bprà-wàt-tì-sàat yùu nǎi", cn: "历史公园在哪儿" },
      { th: "เมืองเก่านี้เงียบดี", roman: "mʉʉang kào níi ngîap dii", cn: "这座古城很安静" },
    ],
  },
];

/* 城市志注入：每座城市挂上 cityProfiles 里的「历史底蕴 / 文化 / 风味」三卷，
 * 组件端只读 city.profile，不需要知道内容存在哪个文件。
 * 用 cityProfiles[id] 直接取值——漏写会被立即发现，而不是静默渲染空面板。 */
for (const city of cityAtlas) {
  city.profile = cityProfiles[city.id];
}

/** 城市认领的文化点（cultureIds 查不到的自动剔除，不渲染死数据） */
export function cultureForCity(cityId) {
  const city = cityAtlas.find((c) => c.id === cityId);
  if (!city) return [];
  const byId = new Map(culturePoints.map((p) => [p.id, p]));
  return city.cultureIds.map((id) => byId.get(id)).filter(Boolean);
}

/* ── 难度适配：新闻课按画像等级排优先级 ── */
const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1"];

/**
 * 新闻列表按学习者等级重排：
 *   - 优先显示与画像等级相同或低一档的（跳一跳够得着）
 *   - 高两档以上的沉底
 * 未知等级（没做过入学测试）保持原序。
 */
export function adaptNewsToLevel(items, thaiLevel) {
  if (!Array.isArray(items) || !items.length) return items || [];
  const idx = LEVEL_ORDER.indexOf(thaiLevel);
  if (idx < 0) return items;
  const weight = (item) => {
    const tags = [item.category, item.source].join(" ").length % 3; // 内容无等级标注时用稳定伪权重打散
    return 0;
  };
  // 新闻本身没有等级字段——用「长度×术语密度」做轻量代理：越短越接近口语等级低
  const difficulty = (item) => {
    const text = `${item.title || ""}${item.lede || ""}`;
    const lengthScore = Math.min(2, Math.floor(text.length / 120));
    const termScore = (text.match(/[ฯ๙฿%]/g) || []).length ? 1 : 0;
    return lengthScore + termScore;
  };
  return [...items].sort((a, b) => {
    const da = Math.abs(difficulty(a) - Math.min(idx / 2, 2));
    const db = Math.abs(difficulty(b) - Math.min(idx / 2, 2));
    return da - db;
  }).map((item) => ({ ...item, _w: weight(item) }));
}

/* ── 地图底图（真实泰国地图艺术图，UI 由组件浮在上面） ── */
export const THAILAND_MAP_IMAGE = "/images/explorer/thailand-map.webp";
export const THAILAND_MAP_RATIO = 1536 / 1024;
