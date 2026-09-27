// src/data/videoLibrary.js
// =========================================================
// ThaiAI 泰语视频学习库
// =========================================================
// 视频来源：
//   - 哔哩哔哩嵌入（bilibiliId + cover）→ 大陆可直连，走 B 站官方播放器
//   - YouTube 嵌入（youtubeId）→ 大陆需科学上网，作为备用源
//   - 本地视频（放入 public/videos/ 目录后在 localSrc 填路径）
//
// 使用方式：
//   import { videoCategories, getAllVideos } from "@/data/videoLibrary";
//
// ── 版权与出处（重要，勿删字段）─────────────────────────
// 带 bilibiliId 的条目是**站外嵌入**：视频始终在 B 站播放，播放量、弹幕、
// 投币都归原作者与原站，本站不下载、不转码、不二次剪辑，也就不存在
// “把别人的片子搬进自己服务器”的风险。下架同样只需删掉数据里的一条。
//
//   bilibiliId   B 站视频号（BV 号）→ 拼出 player.bilibili.com 官方播放器
//                ⚠️ 外链播放器对未登录访客实测只给 360P（480P 以上需 B 站登录，
//                官方参数表里没有清晰度项，站外改不了）—— 所以这类条目**同时**
//                存一份原片的 youtubeId：片子界面能在两个源之间切，
//                需要高清的用户走原片（原频道 1080P），大陆用户走 B 站。
//   youtubeId    原片（原始频道）的视频号，也就是那个 1080P 源
//   cover        B 站封面图（https 必须；B 站 CDN 需 referrerPolicy=no-referrer）
//   sourceName   当前播放源出处：B 站 UP 主
//   sourceNote   该版本的附加说明（比如“中泰双语字幕版（转载）”）
//   originName   原片出处：原始频道 / 作者
//   originUrl    原片链接（能追到版权人的那一层）
//
// 这些条目是 UP 主“转载”来的，原始版权在泰国原频道手里 —— 所以出处必须
// 双层标注（转载方 + 原片），且不要在站内提供下载。若权利人提出异议，
// 删掉对应条目即可，其余功能不受影响。
// =========================================================

export const videoCategories = [
  { id: "all", label: "全部", icon: "🎬" },
  { id: "pronunciation", label: "发音基础", icon: "🗣" },
  { id: "daily", label: "日常会话", icon: "💬" },
  { id: "travel", label: "旅行泰语", icon: "✈️" },
  { id: "culture", label: "泰国文化", icon: "🛕" },
  { id: "grammar", label: "语法进阶", icon: "📖" },
  { id: "listening", label: "听力训练", icon: "🎧" },
  { id: "business", label: "商务泰语", icon: "💼" },
  /* 中泰双语科普短片：真人泰语讲解 + 双语字幕，是“听懂真实语速”的素材 */
  { id: "bilingual", label: "中泰双语", icon: "📺" },
];

// =========================================================
// 视频列表
// =========================================================
// youtubeId → YouTube 嵌入播放
// localSrc  → 本地 public/ 下的视频文件（可选）
// free: true → 免费观看  false → VIP
//
// 免费标记规则（与 @/lib/entitlements 的文案一致）：
//   **每个分类留 1 条最基础的免费精讲**（共 7 条），
//   其余 13 条为 VIP —— 让「VIP 解锁全部视频」是真的有差异，
//   同时免费用户在任何一个分类里都看得到东西。
//   调整免费条数时，记得同步 VipPanel 文案（读 entitlements）。

export const videos = [
  // ─── 发音基础 ────────────────────────────────────────
  {
    id: "v001",
    title: "泰语字母表完整发音教学",
    description: "从头到尾学习泰语 44 个辅音字母的正确发音，每个字母配有例词和声调演示。",
    category: "pronunciation",
    level: "入门",
    duration: "32:15",
    free: true,
    youtubeId: "sPCFhE1Wxhk",
    progress: 0,
  },
  {
    id: "v002",
    title: "泰语五个声调详解",
    description: "深入理解泰语声调系统：中调、低调、降调、高调、升调，配合手势与图示。",
    category: "pronunciation",
    level: "入门",
    duration: "18:40",
    free: false,
    youtubeId: "PmjVR7UMbQU",
    progress: 0,
  },
  {
    id: "v003",
    title: "泰语元音发音全攻略",
    description: "32 个泰语元音的发音位置、长短元音区别与常见错误纠正。",
    category: "pronunciation",
    level: "入门",
    duration: "25:30",
    free: false,
    youtubeId: "XoMExeBjRAY",
    progress: 0,
  },
  {
    id: "v004",
    title: "泰语拼读规则入门",
    description: "掌握辅音+元音+声调的组合拼读方法，从单音节到多音节词汇。",
    category: "pronunciation",
    level: "初级",
    duration: "22:10",
    free: false,
    youtubeId: "yWnVH3aS0yU",
    progress: 0,
  },

  // ─── 日常会话 ────────────────────────────────────────
  {
    id: "v005",
    title: "泰语自我介绍：从零开始",
    description: "学会用泰语介绍自己的名字、国籍、职业和兴趣爱好。",
    category: "daily",
    level: "入门",
    duration: "15:20",
    free: true,
    youtubeId: "f8Wva2CpYtI",
    progress: 0,
  },
  {
    id: "v006",
    title: "餐厅点餐实用泰语",
    description: "在泰国餐厅如何点菜、询问菜品、要求不辣、结账买单的完整对话。",
    category: "daily",
    level: "初级",
    duration: "20:45",
    free: false,
    youtubeId: "bGq7EJaDKGY",
    progress: 0,
  },
  {
    id: "v007",
    title: "购物砍价泰语技巧",
    description: "在泰国市场买东西如何询价、砍价、问颜色尺码、付款找零。",
    category: "daily",
    level: "初级",
    duration: "18:30",
    free: false,
    youtubeId: "l_YvTqE0XgQ",
    progress: 0,
  },
  {
    id: "v008",
    title: "问路与交通泰语",
    description: "打车、坐 BTS/MRT、问路、指路的实用表达与方向词汇。",
    category: "daily",
    level: "初级",
    duration: "22:15",
    free: false,
    youtubeId: "cKXJ6gKFXCE",
    progress: 0,
  },

  // ─── 旅行泰语 ────────────────────────────────────────
  {
    id: "v009",
    title: "泰国机场通关泰语",
    description: "从下飞机到出机场：过海关、取行李、打车去酒店的完整流程用语。",
    category: "travel",
    level: "初级",
    duration: "24:00",
    free: true,
    youtubeId: "cKXJ6gKFXCE",
    progress: 0,
  },
  {
    id: "v010",
    title: "酒店入住退房泰语",
    description: "预订确认、办理入住、询问设施、要求服务、退房结账的全流程。",
    category: "travel",
    level: "初级",
    duration: "19:50",
    free: false,
    youtubeId: "bGq7EJaDKGY",
    progress: 0,
  },
  {
    id: "v011",
    title: "泰国夜市淘宝攻略泰语",
    description: "在曼谷周末市场、火车夜市如何用泰语与摊主交流、挑选商品。",
    category: "travel",
    level: "中级",
    duration: "26:30",
    free: false,
    youtubeId: "l_YvTqE0XgQ",
    progress: 0,
  },

  // ─── 泰国文化 ────────────────────────────────────────
  {
    id: "v012",
    title: "泰国寺庙礼仪与文化",
    description: "参观泰国寺庙的着装要求、合十礼的正确方式、佛像拍照禁忌。",
    category: "culture",
    level: "入门",
    duration: "16:40",
    free: true,
    youtubeId: "sPCFhE1Wxhk",
    progress: 0,
  },
  {
    id: "v013",
    title: "泰国节日文化：宋干节",
    description: "泼水节（宋干节）的起源、传统活动、新年祝福语学习。",
    category: "culture",
    level: "入门",
    duration: "21:20",
    free: false,
    youtubeId: "PmjVR7UMbQU",
    progress: 0,
  },
  {
    id: "v014",
    title: "泰国美食文化入门",
    description: "泰国四大菜系、街头小吃文化、甜辣酸咸的味觉哲学。",
    category: "culture",
    level: "入门",
    duration: "28:15",
    free: false,
    youtubeId: "bGq7EJaDKGY",
    progress: 0,
  },

  // ─── 语法进阶 ────────────────────────────────────────
  {
    id: "v015",
    title: "泰语量词系统详解",
    description: "泰语独特的量词用法：不同物品的量词、数量表达、位置规则。",
    category: "grammar",
    level: "中级",
    duration: "23:40",
    free: true,
    youtubeId: "yWnVH3aS0yU",
    progress: 0,
  },
  {
    id: "v016",
    title: "泰语语气词与敬语",
    description: "ครับ/ค่ะ/นะ/สิ 等语气词的使用场景，以及不同场合的敬语等级。",
    category: "grammar",
    level: "中级",
    duration: "20:55",
    free: false,
    youtubeId: "XoMExeBjRAY",
    progress: 0,
  },
  {
    id: "v017",
    title: "泰语时态与时间表达",
    description: "泰语如何表达过去、现在、将来，以及时间词汇的完整用法。",
    category: "grammar",
    level: "中级",
    duration: "25:10",
    free: false,
    youtubeId: "f8Wva2CpYtI",
    progress: 0,
  },

  // ─── 听力训练 ────────────────────────────────────────
  {
    id: "v018",
    title: "慢速泰语日常对话",
    description: "放慢语速的泰语日常对话，配有中泰双语字幕，适合听力入门。",
    category: "listening",
    level: "初级",
    duration: "14:30",
    free: true,
    youtubeId: "sPCFhE1Wxhk",
    progress: 0,
  },
  {
    id: "v019",
    title: "泰语新闻听力训练",
    description: "泰国 Channel 3 新闻片段，逐句解析真实泰语新闻播报。",
    category: "listening",
    level: "高级",
    duration: "27:45",
    free: false,
    youtubeId: "PmjVR7UMbQU",
    progress: 0,
  },

  // ─── 商务泰语 ────────────────────────────────────────
  {
    id: "v020",
    title: "商务泰语：会议与谈判",
    description: "正式场合的泰语表达、商务会议常用句型、谈判技巧用语。",
    category: "business",
    level: "高级",
    duration: "30:20",
    free: true,
    youtubeId: "yWnVH3aS0yU",
    progress: 0,
  },

  // ─── 中泰双语（B 站站外嵌入 · 真实语速科普短片）──────────
  // 全部来自 B 站 UP 主 thai-study 的「转载」投稿（原片为泰国 YouTube 频道
  // เล่าไปเรื่อย by มนุษย์ก้าง，UP 主加了中泰双语字幕）。每条的出处双层标注，
  // 播放走 B 站官方播放器，站内不提供下载。
  {
    id: "v021",
    title: "「中泰双语」狗为什么成为人类最好的朋友？",
    description: "从远古篝火旁开始的万年关系：真人泰语讲解，配中泰双语字幕，顺带学到门、狼、猎手、主人等词。",
    category: "bilingual",
    level: "中级",
    duration: "08:35",
    free: true,
    bilibiliId: "BV1M5aY6REUR",
    youtubeId: "GNqKasZsdsk",
    cover:
      "https://i0.hdslb.com/bfs/archive/7738c83f5e7c3889903b28e266304143824c22b5.png",
    sourceName: "哔哩哔哩 @thai-study",
    sourceNote: "中泰双语字幕版（转载）",
    originName: "YouTube @เล่าไปเรื่อย by มนุษย์ก้าง",
    originUrl: "https://www.youtube.com/watch?v=GNqKasZsdsk",
    progress: 0,
  },
  {
    id: "v022",
    title: "你记得 3 岁以前的事吗",
    description: "婴儿期遗忘：为什么我们记不得最早那几年，大脑里发生了什么。泰语科普 + 中泰双语字幕。",
    category: "bilingual",
    level: "中级",
    duration: "05:36",
    free: false,
    bilibiliId: "BV1Cfab6MEms",
    youtubeId: "MEIH_h0D3Og",
    cover:
      "https://i2.hdslb.com/bfs/archive/7ab15f19dba82bb997c500253188188e6ed0b2e2.png",
    sourceName: "哔哩哔哩 @thai-study",
    sourceNote: "中泰双语字幕版（转载）",
    originName: "YouTube @เล่าไปเรื่อย by มนุษย์ก้าง",
    originUrl: "https://www.youtube.com/watch?v=MEIH_h0D3Og",
    progress: 0,
  },
  {
    id: "v023",
    title: "为什么蚊子会选择叮咬你？",
    description: "同屋两人一个没被咬、一个满腿包：蚊子靠什么挑人。片中引用了 Cell、NEJM 等研究。",
    category: "bilingual",
    level: "中级",
    duration: "09:38",
    free: false,
    bilibiliId: "BV1gyab6mEbi",
    youtubeId: "9YNfdg_I7Is",
    cover:
      "https://i0.hdslb.com/bfs/archive/25cb1921d7a9a99ff499f8aba38009e92e516fcf.png",
    sourceName: "哔哩哔哩 @thai-study",
    sourceNote: "中泰双语字幕版（转载）",
    originName: "YouTube @เล่าไปเรื่อย by มนุษย์ก้าง",
    originUrl: "https://www.youtube.com/watch?v=9YNfdg_I7Is",
    progress: 0,
  },
  {
    id: "v024",
    title: "ทำไมสิ่งมีชีวิตเมื่อก่อนตัวใหญ่กว่าปัจจุบัน（为什么过去的生物比现在大）",
    description: "泰语标题的科普片：三亿年前的巨型昆虫、长颈恐龙、冰河期巨兽，以及“现在最大”的那一头。",
    category: "bilingual",
    level: "中级",
    duration: "07:10",
    free: false,
    bilibiliId: "BV1R3h96pEMA",
    youtubeId: "watD4Gch6IY",
    cover:
      "https://i1.hdslb.com/bfs/archive/7222d0e5e9b52bf8db0822368c6c3822730f1721.png",
    sourceName: "哔哩哔哩 @thai-study",
    sourceNote: "中泰双语字幕版（转载）",
    originName: "YouTube @เล่าไปเรื่อย by มนุษย์ก้าง",
    originUrl: "https://www.youtube.com/watch?v=watD4Gch6IY",
    progress: 0,
  },
  {
    id: "v025",
    title: "在没有 GPS 之前，船只在海上怎么知道自己的位置",
    description: "航海定位史：从看星星到经纬度、经度难题与天文钟。真人泰语讲解 + 中泰双语字幕。",
    category: "bilingual",
    level: "中级",
    duration: "09:11",
    free: false,
    bilibiliId: "BV1YLaN6JEMb",
    youtubeId: "4coDRhUdHy0",
    cover:
      "https://i1.hdslb.com/bfs/archive/849ac5bd0bd8154f5abf042c13de752b195fd5bb.png",
    sourceName: "哔哩哔哩 @thai-study",
    sourceNote: "中泰双语字幕版（转载）",
    originName: "YouTube @เล่าไปเรื่อย by มนุษย์ก้าง",
    originUrl: "https://www.youtube.com/watch?v=4coDRhUdHy0",
    progress: 0,
  },
];


// =========================================================
// 工具函数
// =========================================================

/**
 * 获取所有视频
 */
export function getAllVideos() {
  return videos;
}

/**
 * 按分类获取视频
 */
export function getVideosByCategory(categoryId) {
  if (categoryId === "all") return videos;
  return videos.filter((v) => v.category === categoryId);
}

/**
 * 获取免费视频
 */
export function getFreeVideos() {
  return videos.filter((v) => v.free);
}

/**
 * 站外嵌入（B 站）的视频 —— 播放器要换成 B 站官方播放器、卡片要标出处
 */
export function isEmbeddedSource(video) {
  return !!video?.bilibiliId;
}

/**
 * 视频在 B 站的原页面地址（出处链接；没有 B 站源时返回空串）
 */
export function bilibiliWatchUrl(video) {
  return video?.bilibiliId
    ? `https://www.bilibili.com/video/${video.bilibiliId}`
    : "";
}

/**
 * 按难度获取视频
 */
export function getVideosByLevel(level) {
  return videos.filter((v) => v.level === level);
}

/**
 * 获取视频总数
 */
export function getVideoCount() {
  return videos.length;
}

/**
 * 获取免费视频数
 */
export function getFreeVideoCount() {
  return videos.filter((v) => v.free).length;
}
