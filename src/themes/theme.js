// ============================================================
// ThaiAI Theme Studio — 主题数据定义
// ============================================================
// 所有值都以「当前墨绿风格」为默认基准，保证默认视觉零变化。

// 可自定义的颜色字段
export const COLOR_FIELDS = [
  { key: "primary",   label: "主色",     en: "Primary",   hint: "#10B981" },
  { key: "secondary", label: "辅助色",   en: "Secondary", hint: "#0F766E" },
  { key: "accent",    label: "强调色",   en: "Accent",    hint: "#F5C451" },
  { key: "background",label: "背景色",   en: "Background",hint: "#0f1a1e" },
  { key: "surface",   label: "卡片色",   en: "Card",      hint: "rgba(255,255,255,0.06)" },
  { key: "text",      label: "文字色",   en: "Text",      hint: "#FFFFFF" },
];

export const DEFAULT_CUSTOM_COLORS = {
  primary: "#10B981",
  secondary: "#0F766E",
  accent: "#F5C451",
  background: "#0f1a1e",
  surface: "rgba(255,255,255,0.06)",
  text: "#FFFFFF",
};

// 预设主题（与当前墨绿一致的 Emerald 为默认）
export const THEMES = {
  emerald: {
    id: "emerald",
    name: "Emerald",
    nameCn: "泰玉",
    tag: "ThaiAI Default",
    base: "dark",
    colors: {
      primary: "#10B981",
      secondary: "#0F766E",
      accent: "#F5C451",
      background: "#0f1a1e",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
  },
  royal: {
    id: "royal",
    name: "Royal Thai",
    nameCn: "王室金",
    tag: "高级泰国宫廷",
    base: "dark",
    colors: {
      primary: "#C9A227",
      secondary: "#6E3B8E",
      accent: "#F5C451",
      background: "#17102A",
      surface: "rgba(255,255,255,0.07)",
      text: "#FFFFFF",
    },
  },
  bangkok: {
    id: "bangkok",
    name: "Bangkok Night",
    nameCn: "曼谷之夜",
    tag: "城市夜景 · SaaS",
    base: "dark",
    colors: {
      primary: "#2DD4BF",
      secondary: "#0E7490",
      accent: "#22D3EE",
      background: "#0A1122",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
  },
  chiangmai: {
    id: "chiangmai",
    name: "Chiang Mai",
    nameCn: "清迈",
    tag: "温暖自然",
    base: "dark",
    colors: {
      primary: "#4C9F70",
      secondary: "#3A6B54",
      accent: "#E8C07D",
      background: "#0E1A14",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean Thailand",
    nameCn: "泰南海岛",
    tag: "海岛度假",
    base: "dark",
    colors: {
      primary: "#14B8A6",
      secondary: "#0E7C86",
      accent: "#A7E8FF",
      background: "#07141F",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
  },
  pearl: {
    id: "pearl",
    name: "Minimal Pearl",
    nameCn: "极简珍珠",
    tag: "Luxury SaaS",
    base: "light",
    colors: {
      primary: "#0F766E",
      secondary: "#C9A227",
      accent: "#B8860B",
      background: "#F7F5F2",
      surface: "#FFFFFF",
      text: "#1F2937",
    },
  },
  cyber: {
    id: "cyber",
    name: "Cyber Thai",
    nameCn: "赛博泰语",
    tag: "AI 科技感",
    base: "dark",
    colors: {
      primary: "#34D399",
      secondary: "#22D3EE",
      accent: "#A855F7",
      background: "#0A0A0A",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
  },
};

export const THEME_ORDER = [
  "emerald",
  "royal",
  "bangkok",
  "chiangmai",
  "ocean",
  "pearl",
  "cyber",
];

// 字体选项
export const FONT_OPTIONS = [
  { id: "ui-sans-serif", label: "Inter / 系统默认", family: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { id: "noto-sans", label: "Noto Sans", family: "'Noto Sans', ui-sans-serif, system-ui, sans-serif" },
  { id: "noto-thai", label: "Noto Sans Thai", family: "'Noto Sans Thai', 'PingFang SC', 'Noto Sans SC', ui-sans-serif, sans-serif" },
  { id: "prompt", label: "Prompt", family: "'Prompt', ui-sans-serif, system-ui, sans-serif" },
];

// 圆角风格
export const RADIUS_OPTIONS = [
  { id: "sharp", label: "Sharp", value: "8px" },
  { id: "modern", label: "Modern", value: "16px" },
  { id: "rounded", label: "Rounded", value: "24px" },
  { id: "soft", label: "Soft", value: "32px" },
];

// LocalStorage key
export const STORAGE_KEYS = {
  theme: "thaiAI_theme",
  mode: "thaiAI_mode",
  customColors: "thaiAI_custom_colors",
  font: "thaiAI_font",
  radius: "thaiAI_radius",
  glass: "thaiAI_glass",
  bgEffect: "thaiAI_bg_effect",
};