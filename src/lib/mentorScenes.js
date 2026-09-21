// src/lib/mentorScenes.js
//
// =========================================================
// AI Speaking Room · 沉浸场景
// =========================================================
//
// 四个场景全部映射到 src/data/conversations.js 里**已有的**场景 id
// （restaurant / airport / campus / workplace），对话树、词汇、语法讲解
// 都用现成的真实数据，这里只负责「房间」本身：氛围、视觉、开场白。
//
// 设计原则：
//   - 不复制对话数据。AIRoom 通过 sceneId 去 conversations.js 拿
//     greeting / dialogueTree，唯一数据源不分裂。
//   - ambience 用 CSS 渐变 + emoji 道具描述「房间」，不加载大图，
//     移动端零成本。

import { conversationScenes } from "@/data/conversations";

export const mentorScenes = [
  {
    id: "restaurant",
    name: "泰式餐厅",
    en: "Restaurant",
    emoji: "🍜",
    /* 氛围：暖橙 + 深棕，灯笼光 */
    ambience: {
      bg: "linear-gradient(160deg,#1c0f06 0%,#2b1508 45%,#0d0703 100%)",
      glow: "rgba(232,150,58,0.16)",
      accent: "#e8963a",
    },
    props: "曼谷老城区的小馆，炭火在灶上响，老板娘正回头看你",
    intro:
      "khun! มานั่งได้เลยครับ 今天我们练习点餐——你要敢用泰语开口，我扮演老板娘。",
  },
  {
    id: "airport",
    name: "机场值机",
    en: "Airport",
    emoji: "✈️",
    ambience: {
      bg: "linear-gradient(160deg,#071722 0%,#0a2436 45%,#04090d 100%)",
      glow: "rgba(110,190,235,0.14)",
      accent: "#6ebeeb",
    },
    props: "素万那普机场 T1，广播在喊最后一班飞清迈的旅客",
    intro:
      "值机柜台前排到你了。放心，柜台的地勤脾气很好——但行李超重她可不让步，试试用泰语争一下。",
  },
  {
    id: "campus",
    name: "大学校园",
    en: "University",
    emoji: "🎓",
    ambience: {
      bg: "linear-gradient(160deg,#0a1a10 0%,#0f2a18 45%,#050a06 100%)",
      glow: "rgba(80,220,160,0.14)",
      accent: "#50dca0",
    },
    props: "朱拉隆功大学的林荫道，社团招新的摊位摆了一排",
    intro:
      "开学第一天。前面这位学长在招新——去打个招呼吧，说不定能问到哪个社团最适合练泰语。",
  },
  {
    id: "workplace",
    name: "商务会议",
    en: "Business",
    emoji: "💼",
    ambience: {
      bg: "linear-gradient(160deg,#171208 0%,#241a08 45%,#0a0704 100%)",
      glow: "rgba(212,175,98,0.16)",
      accent: "#d4af62",
    },
    props: "沙吞区的会议层，落地窗外是曼谷天际线，客户刚落座",
    intro:
      "会议开始前五分钟。对方是曼谷来的合作方——先递名片寒暄，记得用ครับ/ค่ะ收尾，商务场合这个错最扎眼。",
  },
];

/** 按 id 找场景配置（找不到回第一个，调用方不需要判空） */
export function getMentorScene(id) {
  return mentorScenes.find((s) => s.id === id) || mentorScenes[0];
}

/**
 * 场景对应的真实对话数据（来自 conversations.js，唯一数据源）。
 * 返回 { scene, greeting }；找不到时返回 null（调用方显示提示，不伪造）。
 */
export function getSceneDialogue(sceneId) {
  const scene = conversationScenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  return { scene, greeting: scene.greeting };
}

/** 场景开场白（老师说的第一句话，泰文来自真实数据） */
export function sceneOpeningLine(sceneId) {
  const d = getSceneDialogue(sceneId);
  if (!d) return null;
  return {
    thai: d.greeting.thai,
    roman: d.greeting.roman,
    chinese: d.greeting.chinese,
    rate: d.greeting.speakRate ?? 0.72,
  };
}

/**
 * 供「老师记忆」面板展示的类型元数据（与后端 MANUAL_IMPORTANCE 对齐）。
 * 只挑学习画像相关的五类，按展示顺序。
 */
export const MEMORY_PANEL_TYPES = [
  { id: "goal", label: "学习目标", emoji: "🎯" },
  { id: "weakness", label: "薄弱点", emoji: "🩹" },
  { id: "error", label: "常见错误", emoji: "⚠️" },
  { id: "interest", label: "兴趣", emoji: "❤️" },
  { id: "habit", label: "学习习惯", emoji: "🕒" },
];
