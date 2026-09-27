// src/lib/ThemeContext.jsx
//
// =========================================================
// 主题层：只有「深色」和「浅色」两种
// =========================================================
//
// 曾经这里是一整套 Theme Studio：6 套配色预设 × 4 个视觉世界，外加字体、
// 圆角、玻璃、背景氛围、自定义颜色六个维度。组合爆炸之后，真正在用的只有
// 两个端点，中间那些组合没人维护也没人验证。所以收敛成一句：
//
//   深色 = 午夜世界（midnight）   浅色 = 纸本世界（paper）
//
// 一个 mode 同时决定四件事，它们必须永远一致：
//   ① html.dark                —— Tailwind 的 dark: 变体
//   ② data-mode                —— theme.css 的浅色重映射（白字 → 墨字）
//   ③ data-visual-mode         —— 形态语言层（圆角/边框/阴影/字体/纹理）
//   ④ worldTokens 写出的 CSS 变量
//
// 只算一次 isDark，四处都用它，不可能错位。
// =========================================================

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo } from "react";
import { WORLDS, worldTokens } from "@/themes/worlds";

const ThemeContext = createContext(null);

const MODE_KEY = "thaiAI_mode";
const DARK = "dark";
const LIGHT = "light";

/*
 * 这个按钮退休前留下的键。
 * 不读它们（主题只剩两个端点，旧组合没有对应物），顺手删掉 ——
 * 否则浏览器里留着一份「我明明选过纯白背景」的记忆，下次又要查一遍。
 */
const RETIRED_KEYS = [
  "thaiAI_theme",
  "thaiAI_custom_colors",
  "thaiAI_font",
  "thaiAI_radius",
  "thaiAI_glass",
  "thaiAI_bg_effect",
];

function readMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === DARK || stored === LIGHT) return stored;
    /* 老数据是 "system"（或更早的主题 id）：按系统偏好定一次，之后就是显式选择 */
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
  } catch {
    return DARK;
  }
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = React.useState(readMode);

  const isDark = mode === DARK;
  const world = isDark ? WORLDS.midnight : WORLDS.paper;

  useEffect(() => {
    const root = document.documentElement;

    /* ① Tailwind 的 dark 变体 */
    root.classList.toggle("dark", isDark);

    /* ④ 视觉世界的一整套变量（颜色也由它给出，所以不需要再单独写调色板） */
    Object.entries(worldTokens(world)).forEach(([k, v]) => root.style.setProperty(k, v));

    /*
     * 根元素底色 + 手机地址栏色。
     * index.html 的首屏引导脚本也写这两个值（防闪烁），但它只在加载时跑一次；
     * 切换主题必须由这里接管，否则 <html> 会一直停在「进入时那个颜色」。
     */
    root.style.backgroundColor = world.colors.background;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", world.colors.background);

    /* ②③ 给 CSS 的两个开关 */
    root.setAttribute("data-visual-mode", world.visualMode);
    root.setAttribute("data-mode", isDark ? "dark" : "light");

    /*
     * theme.css 的重映射层（.theme-custom）：它负责浅色下那套「白字 → 墨字」。
     * 以前它标记「用户改过颜色」，现在主题只有两种形态，所以常开。
     */
    root.classList.add("theme-custom");
  }, [isDark, world]);

  /* 持久化 + 清掉退休的键（只在挂载时做一次） */
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
      RETIRED_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // ignore
    }
  }, [mode]);

  /*
   * 切换时加 .theme-switching 420ms：全站（包括垫片里约 2800 个颜色类名）
   * 一起平滑过渡，而不是只有壳层平滑、内部硬切。
   * 首次挂载跳过 —— 那时没有「从另一个形态变过来」的过程。
   */
  const firstRunRef = React.useRef(true);

  /** 由 setModeInstantly 置位：这一次切换不叠全局过渡（转场自己负责）。 */
  const skipTransitionRef = React.useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return undefined;
    }

    if (skipTransitionRef.current) {
      skipTransitionRef.current = false;
      return undefined;
    }

    root.classList.add("theme-switching");
    const timer = setTimeout(() => root.classList.remove("theme-switching"), 420);
    return () => {
      clearTimeout(timer);
      root.classList.remove("theme-switching");
    };
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((current) => (current === DARK ? LIGHT : DARK));
  }, []);

  /*
   * 不要那段全局过渡的切换。
   *
   * 给 View Transition 用（components/motion/theme-toggle.jsx）：转场的「新」快照
   * 是在切换后一帧拍的，如果那时颜色还在 420ms 过渡的起点上，揭开后用户会看到
   * 旧配色再跳一下。转场本身就是那次「平滑」，两者只能留一个。
   */
  const setModeInstantly = useCallback((next) => {
    skipTransitionRef.current = true;
    setMode(next);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, setModeInstantly, toggleMode, isDark, visualMode: world.visualMode }),
    [mode, setModeInstantly, toggleMode, isDark, world]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
