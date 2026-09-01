// src/data/videoLibrary.js
// =========================================================
// ThaiAI 泰语视频学习库
// =========================================================
// 视频来源：
//   - YouTube 嵌入（免费公开泰语教学视频）
//   - 本地视频（放入 public/videos/ 目录后在 localSrc 填路径）
//
// 使用方式：
//   import { videoCategories, getAllVideos } from "@/data/videoLibrary";
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
];

// =========================================================
// 视频列表
// =========================================================
// youtubeId → YouTube 嵌入播放
// localSrc  → 本地 public/ 下的视频文件（可选）
// free: true → 免费观看  false → VIP

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
    free: true,
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
    free: true,
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
    free: true,
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
    free: true,
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
    free: false,
    youtubeId: "yWnVH3aS0yU",
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
