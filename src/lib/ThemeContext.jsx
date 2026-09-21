import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo } from "react";
import { THEMES, STORAGE_KEYS, DEFAULT_CUSTOM_COLORS, FONT_OPTIONS, RADIUS_OPTIONS } from "@/themes/theme";
import { resolveWorld, worldTokens, WORLDS, DEFAULT_WORLD } from "@/themes/worlds";

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
  const [themeId, setThemeId] = React.useState(() => readLS(STORAGE_KEYS.theme, DEFAULT_WORLD));
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
    //    深色和浅色分别使用预设自己的调色板；自定义颜色仍然覆盖预设。
    //    这样浅色模式不再只是「白底 + 一套强调色」，六个主题会保留各自气质。
    const isDarkMode = (() => {
      if (forceLight) return false;
      if (m === "dark") return true;
      if (m === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    })();
    const palette = isDarkMode
      ? effective
      : { ...(preset?.lightColors || effective), ...(customColors || {}) };
    const resolvedBg = palette.background || (isDarkMode ? "#0f1a1e" : "#FFFFFF");
    const resolvedText = palette.text || (isDarkMode ? "#FFFFFF" : "#111111");
    const resolvedCard = palette.surface || (isDarkMode
      ? "rgba(255,255,255,0.07)"
      : "rgba(255,255,255,0.78)");
    const colorMap = {
      "--tp-primary": palette.primary,
      "--tp-secondary": palette.secondary,
      "--tp-accent": palette.accent,
      "--tp-bg": resolvedBg,
      "--tp-card": resolvedCard,
      "--tp-text": resolvedText,
      "--tp-glow": palette.primary,
      "--tp-glow-accent": palette.accent,
    };
    Object.entries(colorMap).forEach(([k, v]) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k)));

    /*
     * 2.5) Visual World 层
     * ---------------------------------------------------------
     * 上面那段是旧的"颜色层"（Color Switcher）。
     * 这里把 themeId 解析成一个**视觉世界**，写出整套形态变量
     * （radius / border / shadow / texture / animation / typography /
     * imageFilter / density），并挂上 data-visual-mode，
     * 让 theme.css 里的 [data-visual-mode="..."] 规则生效。
     *
     * 老 id（emerald / royal / bangkok / chiangmai / ocean / cyber）
     * 由 resolveWorld 映射到最接近的世界，不打断老用户的既有选择。
     */
    const world = resolveWorld(themeId);
    const wt = worldTokens(world);
    Object.entries(wt).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute("data-visual-mode", world.visualMode);

    // 3) 字体
    /* 用户显式选过字体就尊重他的选择；没选过（"auto"）则跟随世界 */
    const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
    if (font?.family) {
      /* 用户显式选过字体 */
      root.style.setProperty("--tp-font-family", font.family);
    } else {
      /* "auto"：交回给视觉世界（worldTokens 已写好 --tp-font-body） */
      root.style.setProperty("--tp-font-family", world.form.fontBody);
    }

    // 4) 圆角
    const radius = RADIUS_OPTIONS.find((o) => o.id === r) || RADIUS_OPTIONS[1];
    root.style.setProperty("--tp-radius", radius.value);

    // 5) 玻璃效果
    root.style.setProperty("--tp-glass", g ? "1" : "0");
    root.setAttribute("data-glass", g ? "on" : "off");

    // 6) 背景氛围
    root.style.setProperty("--tp-bg-effect", be);

    // 7) 自定义标记（供 theme.css remap）
    //    深/浅模式都强制纯黑白 → 一律启用 theme-custom（默认 Emerald 也走纯黑/纯白）
    const custom = true;
    root.classList.toggle("theme-custom", custom);
    root.setAttribute("data-theme", themeId);
    root.setAttribute("data-bgeffect", be);
    /*
     * data-mode 与 data-visual-mode 的关系 —— 反直觉，但**是有意为之**。
     * ============================================================
     * `forceLight` 依赖 `THEMES[themeId].base`，而 paper / forest / modern
     * 是**世界 id**、不在 THEMES 里 → preset 为 undefined → forceLight=false
     * → data-mode 回落到 mode 状态（默认 "dark"）。
     *
     * 于是一个"浅色世界"（PAPER）实际挂着 `data-mode="dark"` + `.dark` 类。
     * 这看起来像 bug，但**改成 light 会更糟**：
     *   theme.css 里有 52 条 `html.theme-custom[data-mode="light"]` 规则，
     *   其中 4 条带 !important 会抢走所有含 white/black 的类名
     *   （`[class*=text-white]`→#161616、`bg-white`→color-mix(--tp-card,--tp-primary)
     *   即偏绿的白）。那会让 world-shim.css 里为纸面手调的暖色全部失效，
     *   PAPER 变成"emerald 浅色主题"而不是"纸本"。
     *
     * 所以这里**保持 dark**：让那 52 条旧浅色规则休眠，PAPER 的颜色
     * 完全交给 world-shim.css + world token 两层。
     *
     * 已经处理掉的副作用：`.dark` 会写一套 shadcn 变量
     * （--background/--card/--foreground…），全站约 30 处 `bg-background` /
     * `text-foreground` / `bg-muted` 等会跟着变深。world-shim.css 末尾已按
     * 世界重写这组 token（`html[data-visual-mode="x"]` 特异性高于 `.dark`），
     * 实测四个世界都取到正确值。
     *
     * 如果将来要"修"这里，请先读 world-shim.css 末尾那段。
     */
    root.setAttribute("data-mode", forceLight || m === "light" ? "light" : m === "dark" ? "dark" : dark ? "dark" : "light");
  }, [resolved, themeId, customColors]);

  /*
   * 主题切换窗口。
   * 加 .theme-switching 420ms，让全站（包括垫片重映射的 ~2800 个
   * 颜色类名）一起平滑过渡，而不是只有壳层平滑、内部硬切。
   * 首次挂载时跳过：那时没有"从旧主题变过来"的过程，
   * 加过渡只会让首屏淡入，观感更慢。
   */
  const firstRunRef = React.useRef(true);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return undefined;
    }

    root.classList.add("theme-switching");
    const timer = setTimeout(() => root.classList.remove("theme-switching"), 420);
    return () => {
      clearTimeout(timer);
      root.classList.remove("theme-switching");
    };
  }, [themeId]);

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
    setThemeId(DEFAULT_WORLD);
    setMode("dark");
    setCustomColors({});
    setFontId(FONT_OPTIONS[0].id);
    setRadiusId(RADIUS_OPTIONS[1].id);
    setGlass(true);
    setBgEffect("glow");
  }, []);

  const value = useMemo(() => ({
    ...resolved,
    // 对外统一使用 theme，内部状态仍保留 themeId，兼容现有选择器 API。
    theme: themeId,
    setTheme: setThemeId,
    /* 视觉世界：Theme Gallery 用它渲染预览、做切换 */
    world: resolveWorld(themeId),
    setWorld: setThemeId,
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