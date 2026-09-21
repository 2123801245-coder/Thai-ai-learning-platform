// src/lib/navigation.js
//
// =========================================================
// ThaiAI 全站导航单一事实来源（single source of truth）
// =========================================================
//
// 重构前的问题：三个导航面各自维护一份菜单，且互相矛盾——
//   Sidebar（桌面，16 项）指向 /speaking、/culture、/practice 不存在
//   MobileTabBar（移动，5 项）指向 /course、/practice
//   Navbar（3 个遗留页，8 项）指向 /speaking-practice、/challenges、/#ai-teacher
// 同一个人在同一站里会有三套「首页」理解，找不到的功能就真的等于没有。
//
// 现在：**只有这一份**。三端渲染同一棵导航树，允许的差异只有
//   `tabs`（底部栏放不下的取舍）与 `hidden`（不在常规菜单出现但路由保留）。
//
// 约定
// ----
//   id        稳定标识，用于埋点 / 教学引导 / 测试，不随文案改
//   path      路由（必须与 App.jsx 的 Route 完全一致）
//   match     判定当前项是否高亮的额外前缀（父子路由、旧路径兼容）
//   group     分组归属，决定渲染顺序与视觉权重
//   badge     "vip" | "partial" | "new"，渲染成小标签
//   flag      功能开关名（src/lib/features.js），关掉时两端一起消失
//   tabs      true = 出现在移动端底部栏
//   more      true = 进「更多」二级页（移动端），桌面端进「更多」分组
//
// 注意：**路由不会因为这里没列出而被删掉**。没列出的旧路径由 App.jsx 的
// 兼容路由接管（例如 /speaking-practice → /speaking），保持不变。

import {
  Home,
  Orbit,
  MessageCircle,
  Target,
  Languages,
  Mic,
  BookOpen,
  Film,
  Globe2,
  Landmark,
  BookOpenText,
  SpellCheck,
  Compass,
  Briefcase,
  Trophy,
  Dumbbell,
  Settings,
  User,
} from "lucide-react";

/* ── 导航分组：顺序即渲染顺序 ── */
export const navGroups = [
  {
    id: "today",
    label: "今天",
    hint: "每天从这里开始",
  },
  {
    id: "content",
    label: "内容",
    hint: "真实语料与课程",
  },
  {
    id: "more",
    label: "更多",
    hint: "工具与设置",
  },
];

/** 移动端底部栏最大 Tab 数（含中间的 AI 主按钮）。超出是设计错误，宁早发现。 */
export const MOBILE_TAB_LIMIT = 5;

/* ── 菜单项 ── */
export const navItems = [
  /* ═══ 今天：日常动作用的东西，一屏能看完 ═══ */
  {
    id: "home",
    name: "首页",
    path: "/",
    icon: Home,
    group: "today",
    tabs: true,
    desc: "今日任务与学习状态",
  },
  {
    id: "loop",
    name: "今日闭环",
    path: "/loop",
    icon: Target,
    group: "today",
    tabs: true,
    desc: "学 · 练 · 测 · 复习",
  },
  {
    id: "conversation",
    name: "AI 对话室",
    path: "/conversation",
    icon: MessageCircle,
    group: "today",
    tabs: true,
    flag: "aiTeacher",
    match: ["/ai-room"],
    desc: "语音对话、场景角色扮演",
  },
  {
    id: "universe",
    name: "学习宇宙",
    path: "/universe",
    icon: Orbit,
    group: "today",
    match: ["/universe"],
    desc: "技能树 · 博物馆 · 成就卡 · 能力评估",
  },

  /* ═══ 内容：课程与真实语料 ═══ */
  {
    id: "course",
    name: "课程学习",
    path: "/course",
    icon: BookOpen,
    group: "content",
    badge: "vip",
    match: ["/course"],
    desc: "系统课程与课文",
  },
  {
    id: "lessons",
    name: "课文教学",
    path: "/lessons",
    icon: BookOpenText,
    group: "content",
    badge: "vip",
    match: ["/lessons"],
  },
  {
    id: "media",
    name: "媒体学习",
    path: "/media",
    icon: Film,
    group: "content",
    match: ["/media"],
    desc: "泰剧 · 歌曲 · 综艺 · 新闻",
  },
  {
    id: "culture-universe",
    name: "文化宇宙",
    path: "/culture-universe",
    icon: Globe2,
    group: "content",
    match: ["/culture-universe"],
    desc: "泰剧世界 · 音乐工作室 · 新闻实验室 · 泰国探索者",
  },
  {
    id: "corpus",
    name: "本地语料库",
    path: "/corpus",
    icon: BookOpenText,
    group: "content",
    match: ["/corpus"],
    desc: "逐句精读本地语料",
  },

  /* ═══ 更多：工具、进阶与设置 ═══ */
  {
    id: "vocabulary",
    name: "词汇星球",
    path: "/vocabulary",
    icon: Languages,
    group: "more",
    tabs: true,
    match: ["/vocab-match", "/sentence-fill", "/word-segment"],
    desc: "词书 · 配对 · 填空 · 分词",
  },
  {
    id: "speaking",
    name: "口语练习",
    path: "/speaking",
    icon: Mic,
    group: "more",
    badge: "partial",
    match: ["/speaking", "/speaking-practice"],
    desc: "四维评分与发音反馈",
  },
  {
    id: "practice",
    name: "练习中心",
    path: "/practice",
    icon: Dumbbell,
    group: "more",
    desc: "全部练习板块的入口",
  },
  {
    id: "plan",
    name: "我的旅程",
    path: "/plan",
    icon: Compass,
    group: "more",
    match: ["/plan"],
    desc: "学习计划与打卡",
  },
  {
    id: "alphabet",
    name: "字母表",
    path: "/alphabet",
    icon: SpellCheck,
    group: "more",
  },
  {
    id: "culture",
    name: "泰国文化",
    path: "/culture",
    icon: Landmark,
    group: "more",
    match: ["/culture"],
  },
  /* 挑战赛 / 错题本：路由保留，但不再各自占一个侧边栏条目——
     它们是「词汇与练习」的两种玩法，权威入口在 /practice。
     这里标记而不是删除：findNavItem 仍能解析出它们的归属，便于面包屑与高亮。 */
  {
    id: "challenges",
    name: "学习挑战赛",
    path: "/challenges",
    icon: Trophy,
    group: "more",
    hidden: true,
  },
  {
    id: "wrong-notebook",
    name: "错题本",
    path: "/wrong-notebook",
    icon: BookOpenText,
    group: "more",
    hidden: true,
  },
  {
    id: "professional",
    name: "专业方向",
    path: "/professional",
    icon: Briefcase,
    group: "more",
    match: ["/professional"],
  },
  {
    id: "ranking",
    name: "学习排行榜",
    path: "/ranking",
    icon: Trophy,
    group: "more",
    match: ["/ranking"],
  },
  {
    /* 「我的」在桌面端由左侧用户卡（个人中心按钮）承担，
       所以 desktopOnly 为假、mobileOnly 为真：底部栏绝不能少这一个——
       移动端没有侧边栏，缺了它用户到不了个人中心。 */
    id: "profile",
    name: "我的",
    path: "/profile",
    icon: User,
    group: "more",
    tabs: true,
    mobileOnly: true,
    match: ["/profile"],
    desc: "资料、统计、VIP",
  },
  {
    id: "settings",
    name: "设置中心",
    path: "/settings",
    icon: Settings,
    group: "more",
    match: ["/settings", "/profile", "/admin"],
  },
];

/* ── 派生视图：三端各取所需 ── */

/** 按功能开关过滤：flag 未开启的项两端一起消失（不是各页自己判一遍） */
export function visibleNavItems(isFlagOn = () => true) {
  return navItems.filter((item) => (item.flag ? isFlagOn(item.flag) : true));
}

/** 桌面侧边栏：全部非 hidden 项，按分组 */
export function desktopNav(isFlagOn) {
  const items = visibleNavItems(isFlagOn).filter(
    (item) => !item.hidden && !item.mobileOnly
  );
  return navGroups
    .map((group) => ({
      ...group,
      items: items.filter((item) => item.group === group.id),
    }))
    .filter((group) => group.items.length);
}

/** 移动端底部栏：显式标 tabs 的项（最多 5 个，含中间的 AI） */
export function mobileTabs(isFlagOn) {
  return visibleNavItems(isFlagOn).filter((item) => item.tabs);
}

/** 移动端「更多」二级页：其余可见项 */
export function mobileMoreItems(isFlagOn) {
  return visibleNavItems(isFlagOn).filter((item) => !item.tabs && !item.hidden);
}

/**
 * 当前路径属于哪一项。
 * 匹配顺序：精确 path → match 前缀（含旧路径）→ 最长前缀。
 * 用途：高亮、面包屑、以及「这个功能在哪」的一致性。
 */
export function findNavItem(pathname, search = "") {
  const clean = pathname.replace(/\/+$/, "") || "/";

  const exact = navItems.find((item) => item.path === clean);
  if (exact) return exact;

  for (const item of navItems) {
    const prefixes = [item.path, ...(item.match || [])];
    if (prefixes.some((p) => p !== "/" && (clean === p || clean.startsWith(`${p}/`)))) {
      return item;
    }
  }

  /* 词汇星球的练习模式用 query 区分（/vocabulary?mode=match） */
  if (clean === "/vocabulary" && search.includes("mode=")) {
    return navItems.find((item) => item.id === "vocabulary") || null;
  }

  return null;
}

/** 旧路径 → 新路径（统一在路由层做 301，别让每页自己判断） */
export const legacyRedirects = {
  "/speaking-practice": "/speaking",
  "/ai-room": "/conversation",
  "/vocab-match": "/vocabulary",
  "/sentence-fill": "/vocabulary",
  "/word-segment": "/vocabulary",
};

/** 练习中心的分组：Practice 页与「更多」页共用同一份，避免两处各写一遍 */
export const practiceGroups = [
  {
    id: "core",
    name: "核心练习",
    desc: "每天 12 分钟，跟着 AI 老师练起来",
    itemIds: ["loop", "speaking", "conversation"],
  },
  {
    id: "vocab",
    name: "词汇与句子",
    desc: "都在词汇星球里，学完直接练",
    itemIds: ["vocabulary-match", "vocabulary-fill", "vocabulary-segment"],
  },
  {
    id: "media",
    name: "媒体与文化",
    desc: "用泰剧、歌曲、新闻这些真实内容学",
    itemIds: ["media", "culture"],
  },
  {
    id: "advanced",
    name: "进阶与巩固",
    desc: "听真实语料，查漏补缺",
    itemIds: ["corpus-listening", "wrong-notebook", "challenges"],
  },
];

/**
 * 练习中心条目：`to` 必须与真实路由一致，`flag` 与 navItems 同一套语义。
 * 这些不是侧边栏条目（词汇三种模式共用一个「词汇星球」入口），
 * 但必须有唯一事实来源，否则 Practice 页与「更多」页又会各写一份。
 */
export const practiceItems = {
  loop: { to: "/loop", label: "今日学习闭环", desc: "学 · 练 · 测 · 复习", emoji: "🎯" },
  speaking: { to: "/speaking", label: "口语练习", desc: "四维评分 + AI 教练", emoji: "🎙️", badge: "vip" },
  conversation: {
    to: "/conversation",
    label: "AI 情景对话",
    desc: "真实场景角色扮演",
    emoji: "💬",
    flag: "aiTeacher",
  },
  "vocabulary-match": {
    to: "/vocabulary?mode=match",
    label: "词汇配对",
    desc: "词汇星球 · 泰 ↔ 中速配",
    emoji: "🔤",
  },
  "vocabulary-fill": {
    to: "/vocabulary?mode=fill",
    label: "句子填空",
    desc: "词汇星球 · 选词填空练句型",
    emoji: "✍️",
  },
  "vocabulary-segment": {
    to: "/vocabulary?mode=segment",
    label: "分词练习",
    desc: "词汇星球 · 句子里拆词",
    emoji: "🧩",
  },
  media: { to: "/media", label: "媒体学习", desc: "泰剧 · 歌曲 · 综艺 · 新闻", emoji: "🎬" },
  culture: { to: "/culture", label: "泰国文化", desc: "节日 · 礼仪 · 民俗背景", emoji: "🛕" },
  "corpus-listening": {
    to: "/corpus/listening",
    label: "新闻听力",
    desc: "ThaiPBS 每日逐句练",
    emoji: "🎧",
    badge: "vip",
  },
  "wrong-notebook": { to: "/wrong-notebook", label: "错题本", desc: "错词错句一键复习", emoji: "📕" },
  challenges: { to: "/challenges", label: "挑战赛", desc: "限时闯关赢称号", emoji: "🏆" },
};

/** 展开练习中心分组：过滤掉被功能开关关掉的条目 */
export function resolvePracticeGroups(isFlagOn = () => true) {
  return practiceGroups
    .map((group) => ({
      ...group,
      items: group.itemIds
        .map((id) => ({ id, ...practiceItems[id] }))
        .filter((item) => (item.flag ? isFlagOn(item.flag) : true)),
    }))
    .filter((group) => group.items.length);
}
