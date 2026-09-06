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

// 预设主题（深色与浅色各有一套完整配色）
// style：该主题对应的「学习风格」，用于主题选择器展示
// lightColors：浅色模式专用调色板，避免六个预设只是同一套白底换强调色
export const THEMES = {
  emerald: {
    id: "emerald",
    name: "Emerald",
    nameCn: "泰玉",
    tag: "ThaiAI Default",
    style: "经典专注 · 沉浸式阅读",
    base: "dark",
    colors: {
      primary: "#10B981",
      secondary: "#0F766E",
      accent: "#F5C451",
      background: "#0f1a1e",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#087F5B",
      secondary: "#2C9A78",
      accent: "#B7791F",
      background: "#F4FBF7",
      surface: "rgba(255,255,255,0.78)",
      text: "#17352C",
    },
  },
  royal: {
    id: "royal",
    name: "Royal Thai",
    nameCn: "王室金",
    tag: "高级泰国宫廷",
    style: "典雅庄重 · 慢速精读",
    base: "dark",
    colors: {
      primary: "#D4A94E",
      secondary: "#7B3FA0",
      accent: "#F0C75E",
      background: "#17102A",
      surface: "rgba(255,255,255,0.07)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#8A5A14",
      secondary: "#76539B",
      accent: "#B7791F",
      background: "#FCF8F0",
      surface: "rgba(255,255,255,0.82)",
      text: "#33251B",
    },
  },
  bangkok: {
    id: "bangkok",
    name: "Bangkok Night",
    nameCn: "曼谷之夜",
    tag: "城市夜景 · SaaS",
    style: "都市高效 · 快速打卡",
    base: "dark",
    colors: {
      primary: "#2DD4BF",
      secondary: "#0E7490",
      accent: "#38BDF8",
      background: "#0A1122",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#087E8B",
      secondary: "#346B8A",
      accent: "#C47A24",
      background: "#F1F8FA",
      surface: "rgba(255,255,255,0.8)",
      text: "#17313A",
    },
  },
  chiangmai: {
    id: "chiangmai",
    name: "Chiang Mai",
    nameCn: "清迈",
    tag: "温暖自然",
    style: "自然舒缓 · 轻松积累",
    base: "dark",
    colors: {
      primary: "#4C9F70",
      secondary: "#3A6B54",
      accent: "#E8C07D",
      background: "#0E1A14",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#3F7D58",
      secondary: "#628C70",
      accent: "#B77B32",
      background: "#F5F9F1",
      surface: "rgba(255,255,255,0.78)",
      text: "#21352A",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean Thailand",
    nameCn: "泰南海岛",
    tag: "海岛度假",
    style: "清新活力 · 听力跟读",
    base: "dark",
    colors: {
      primary: "#14B8A6",
      secondary: "#0E7C86",
      accent: "#FBBF24",
      background: "#07141F",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#087F8C",
      secondary: "#287D9A",
      accent: "#B7791F",
      background: "#F0FAFC",
      surface: "rgba(255,255,255,0.82)",
      text: "#17343A",
    },
  },
  cyber: {
    id: "cyber",
    name: "Cyber Thai",
    nameCn: "赛博泰语",
    tag: "AI 科技感",
    style: "未来高效 · AI 对话强化",
    base: "dark",
    colors: {
      primary: "#34D399",
      secondary: "#22D3EE",
      accent: "#C084FC",
      background: "#0A0A0A",
      surface: "rgba(255,255,255,0.06)",
      text: "#FFFFFF",
    },
    lightColors: {
      primary: "#5B3F9B",
      secondary: "#347D75",
      accent: "#A66919",
      background: "#F7F4FC",
      surface: "rgba(255,255,255,0.84)",
      text: "#29233A",
    },
  },
};

export const THEME_ORDER = [
  "emerald",
  "royal",
  "bangkok",
  "chiangmai",
  "ocean",
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