import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo } from "react";
import { THEMES, STORAGE_KEYS, DEFAULT_CUSTOM_COLORS, FONT_OPTIONS, RADIUS_OPTIONS } from "@/themes/theme";

const ThemeContext = createContext(null);

// 主题是否「非默认」——生效颜色（预设+自定义叠加）与墨绿默认不同时
// 即标记 theme-custom，启用 theme.css 的重映射规则。
// 这样：切到 Bangkok Night 等任何预设、或改任一自定义色，全站都会真正变色；
// 默认 Emerald + 无自定义 = 与默认一致，视觉零变化。
function isCustom(themeId, customColors) {
  const defaults = THEMES.emerald?.colors || DEFAULT_CUSTOM_COLORS;
  const preset = THEMES[themeId];
  const effective = { ...(preset?.colors || {}), ...(customColors || {}) };
  return ["primary", "secondary", "accent", "background", "surface", "text"].some(
    (k) =>
      String(effective[k] || defaults[k]).toLowerCase() !==
      String(defaults[k]).toLowerCase()
  );
}

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function readLSJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = React.useState(() => readLS(STORAGE_KEYS.theme, "emerald"));
  const [mode, setMode] = React.useState(() => readLS(STORAGE_KEYS.mode, "dark")); // dark | light | system
  const [customColors, setCustomColors] = React.useState(() =>
    readLSJSON(STORAGE_KEYS.customColors, {})
  );
  const [fontId, setFontId] = React.useState(() => readLS(STORAGE_KEYS.font, FONT_OPTIONS[0].id));
  const [radiusId, setRadiusId] = React.useState(() => readLS(STORAGE_KEYS.radius, RADIUS_OPTIONS[1].id));
  const [glass, setGlass] = React.useState(() => readLS(STORAGE_KEYS.glass, "on") === "on");
  const [bgEffect, setBgEffect] = React.useState(() => readLS(STORAGE_KEYS.bgEffect, "glow")); // none | soft | glow | star | particle | thai

  // 解析实际生效的配色：自定义优先，否则取预设
  const resolved = useMemo(() => {
    const preset = THEMES[themeId];
    const effective = { ...(preset?.colors || DEFAULT_CUSTOM_COLORS), ...(customColors || {}) };
    return { themeId, preset, effective, mode, fontId, radiusId, glass, bgEffect };
  }, [themeId, customColors, mode, fontId, radiusId, glass, bgEffect]);

  // 应用 CSS 变量到根节点
  useEffect(() => {
    const root = document.documentElement;
    const { effective, preset, mode: m, fontId, radiusId: r, glass: g, bgEffect: be } = resolved;

    // 1) 明暗：mode 决定 .dark class（pearl 等浅色预设在其 base=light 时强制浅色）
    const forceLight = preset?.base === "light";
    let dark = false;
    if (forceLight) dark = false;
    else if (m === "dark") dark = true;
    else if (m === "light") dark = false;
    else dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);

    // 2) 颜色变量
    const colorMap = {
      "--tp-primary": effective.primary,
      "--tp-secondary": effective.secondary,
      "--tp-accent": effective.accent,
      "--tp-bg": effective.background,
      "--tp-card": effective.surface,
      "--tp-text": effective.text,
    };
    Object.entries(colorMap).forEach(([k, v]) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k)));

    // 3) 字体
    const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
    root.style.setProperty("--tp-font-family", font.family);

    // 4) 圆角
    const radius = RADIUS_OPTIONS.find((o) => o.id === r) || RADIUS_OPTIONS[1];
    root.style.setProperty("--tp-radius", radius.value);

    // 5) 玻璃效果
    root.style.setProperty("--tp-glass", g ? "1" : "0");

    // 6) 背景氛围
    root.style.setProperty("--tp-bg-effect", be);

    // 7) 自定义标记（供 theme.css remap）
    const custom = isCustom(themeId, customColors);
    root.classList.toggle("theme-custom", custom);
    root.setAttribute("data-theme", themeId);
    root.setAttribute("data-bgeffect", be);
  }, [resolved, themeId, customColors]);

  // 持久化
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.theme, themeId); } catch {} }, [themeId]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.mode, mode); } catch {} }, [mode]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.customColors, JSON.stringify(customColors)); } catch {} }, [customColors]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.font, fontId); } catch {} }, [fontId]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.radius, radiusId); } catch {} }, [radiusId]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.glass, glass ? "on" : "off"); } catch {} }, [glass]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.bgEffect, bgEffect); } catch {} }, [bgEffect]);

  const setCustomColor = useCallback((key, value) => {
    setCustomColors((prev) => ({ ...(prev || {}), [key]: value }));
  }, []);

  const resetTheme = useCallback(() => {
    setThemeId("emerald");
    setMode("dark");
    setCustomColors({});
    setFontId(FONT_OPTIONS[0].id);
    setRadiusId(RADIUS_OPTIONS[1].id);
    setGlass(true);
    setBgEffect("glow");
  }, []);

  const value = useMemo(() => ({
    ...resolved,
    setTheme: setThemeId,
    setMode,
    customColors: customColors || {},
    setCustomColors,
    setCustomColor,
    font: fontId, setFont: setFontId,
    radius: radiusId, setRadius: setRadiusId,
    glass, setGlass,
    bgEffect, setBgEffect,
    resetTheme,
  }), [resolved, customColors, fontId, radiusId, glass, bgEffect, setCustomColor, resetTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}