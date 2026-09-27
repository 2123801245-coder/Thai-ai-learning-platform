// src/themes/worlds.js
//
// =========================================================
// ThaiAI · Visual Worlds（视觉世界）
// =========================================================
//
// 为什么要单独一层
// ----------------
// 原来的主题系统是 **Color Switcher**：6 个预设、12 个 `--tp-*` 变量，
// 换来换去只是背景色与强调色不同 —— 用户反馈"主题之间区别不明显"。
//
// 这里把 "Theme = Color" 升级成 "Theme = Visual World"：
// 每个世界除了颜色，还带一整套**形态语言**：
//   visualMode / radius / shadow / border / texture /
//   animation / typography / imageFilter / density
//
// 组件只读 Token，不写 `if (theme === 'paper')` —— 世界之间怎么差，
// 全部由这里的数值 + theme.css 里的 `[data-visual-mode="..."]` 决定。
//
// 现在只剩两个世界：midnight（深色）与 paper（浅色）。
// ThemeContext 用 mode 二选一，用户没有别的选择项 —— 曾经的 forest / modern
// 与 6 套颜色预设、字体、圆角、玻璃、背景氛围等自定义维度已下线。

/* =========================================================
   两个世界
========================================================= */

export const WORLDS = {
  midnight: {
    visualMode: "midnight",
    base: "dark",
    colors: {
      primary: "#3FAE7A",
      secondary: "#1F6B52",
      accent: "#D4A44A",
      background: "#050807",
      surface: "rgba(255, 255, 255, 0.05)",
      text: "#F2EFE6",
    },
    /* 形态语言：这些数字是"世界感"的真正来源 */
    form: {
      /* 外壳（侧边栏 / 手机底栏）：比页面更深一档，配祖母绿细边与深投影 */
      shellBg: "rgba(4, 9, 8, 0.93)",
      shellBorder: "rgba(63, 174, 122, 0.14)",
      shellShadow: "20px 0 60px rgba(0, 0, 0, 0.45)",
      shellShadowUp: "0 -12px 32px rgba(0, 0, 0, 0.45)",
      /* 表面：深色玻璃 + 顶部内高光（电影感的关键——没有内高光就是一块死板） */
      surfaceBg: "linear-gradient(145deg, rgba(255,255,255,.070), rgba(255,255,255,.028) 58%, rgba(212,164,74,.022))",
      surfaceBgStrong:
        "linear-gradient(145deg, rgba(255,255,255,.095), rgba(255,255,255,.038) 58%, rgba(212,164,74,.030))",
      surfaceInset: "inset 0 1px 0 rgba(255,255,255,.07)",
      surfaceInsetStrong: "inset 0 1px 0 rgba(255,255,255,.11), inset 0 -1px 0 rgba(255,255,255,.04)",
      hairline: "rgba(255,255,255,.10)",
      selectionBg: "rgba(63,174,122,.30)",
      scrollThumb: "rgba(255,255,255,.14)",
      focusRing: "rgba(63,174,122,.55)",
      radiusSm: "10px",
      radiusMd: "16px",
      radiusLg: "22px",
      borderWidth: "1px",
      borderAlpha: "0.09",
      shadow: "0 18px 48px -22px rgba(0, 0, 0, 0.85)",
      shadowSoft: "0 6px 20px -12px rgba(0, 0, 0, 0.7)",
      shadowDeep: "0 40px 90px -34px rgba(0, 0, 0, 0.95)",
      glow: "rgba(63, 174, 122, 0.22)",
      glowAccent: "rgba(212, 164, 74, 0.20)",
      blur: "18px",
      density: "1",
      anim: "1",
      animEase: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      textureOpacity: "0.5",
      imageFilter: "saturate(0.72) contrast(1.12) brightness(0.86)",
      fontDisplay: '"Inter", ui-sans-serif, system-ui, sans-serif',
      fontBody: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontDisplayWeight: "300",
      fontDisplayTracking: "-0.02em",
    },
  },

  paper: {
    visualMode: "paper",
    base: "light",
    colors: {
      primary: "#3A4A3C",
      secondary: "#5C6B54",
      accent: "#9A7B2E",
      background: "#F6F1E6",
      surface: "rgba(255, 255, 255, 0.72)",
      text: "#241F17",
    },
    form: {
      /* 外壳：书封 / 环衬色 —— 比纸面略深，与书页形成"封套-内页"的关系 */
      shellBg: "linear-gradient(180deg, #F2EBDC 0%, #EDE5D3 100%)",
      shellBorder: "rgba(60, 48, 30, 0.20)",
      shellShadow: "20px 0 46px rgba(60, 48, 30, 0.13)",
      shellShadowUp: "0 -12px 30px rgba(60, 48, 30, 0.13)",
      /* 表面：纸张是"比纸更亮的书页"，配清晰细边与极轻纸影。
         浅色世界如果沿用深色的白色半透明渐变，表面会完全消失 —— 这是
         之前 PAPER 看起来"没有层次"的直接原因。 */
      surfaceBg: "linear-gradient(180deg, #FFFDF8 0%, #FBF6EB 100%)",
      surfaceBgStrong: "linear-gradient(180deg, #FFFFFF 0%, #FDF9F0 100%)",
      surfaceInset: "inset 0 1px 0 rgba(255,255,255,.95)",
      surfaceInsetStrong: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(120,100,64,.06)",
      hairline: "rgba(60,48,30,.18)",
      selectionBg: "rgba(154,123,46,.26)",
      scrollThumb: "rgba(60,48,30,.24)",
      focusRing: "rgba(58,74,60,.55)",
      radiusSm: "3px",
      radiusMd: "5px",
      radiusLg: "8px",
      borderWidth: "1px",
      /* 纸张世界的边框是"清晰的细线"，不是低透明度发光 */
      borderAlpha: "0.26",
      shadow: "0 1px 2px rgba(60, 48, 30, 0.10), 0 8px 22px -18px rgba(60, 48, 30, 0.35)",
      shadowSoft: "0 1px 2px rgba(60, 48, 30, 0.08)",
      shadowDeep: "0 2px 4px rgba(60, 48, 30, 0.10), 0 24px 48px -30px rgba(60, 48, 30, 0.45)",
      glow: "rgba(154, 123, 46, 0.12)",
      glowAccent: "rgba(154, 123, 46, 0.16)",
      blur: "8px",
      /* 留白更多：密度略小 */
      density: "1.12",
      anim: "2.2",
      animEase: "ease-out",
      textureOpacity: "0.35",
      imageFilter: "sepia(0.22) saturate(0.86) contrast(0.96) brightness(1.04)",
      fontDisplay: '"Noto Serif Thai", "Chonburi", Georgia, "Times New Roman", serif',
      fontBody: '"Noto Sans Thai", ui-sans-serif, system-ui, sans-serif',
      fontDisplayWeight: "600",
      fontDisplayTracking: "0.01em",
    },
  },

};

/**
 * 生成某个世界的 CSS 变量表。
 * 组件只消费这些变量，不关心自己在哪个世界。
 */
export function worldTokens(world) {
  const f = world.form;
  const dark = world.base === "dark";
  return {
    "--tp-primary": world.colors.primary,
    "--tp-secondary": world.colors.secondary,
    "--tp-accent": world.colors.accent,
    "--tp-bg": world.colors.background,
    "--tp-card": world.colors.surface,
    "--tp-text": world.colors.text,

    "--tp-radius-sm": f.radiusSm,
    "--tp-radius-md": f.radiusMd,
    "--tp-radius-lg": f.radiusLg,

    "--tp-border-width": f.borderWidth,
    "--tp-border": dark
      ? `rgba(255, 255, 255, ${f.borderAlpha})`
      : `rgba(36, 31, 23, ${f.borderAlpha})`,
    "--tp-border-subtle": dark
      ? `rgba(255, 255, 255, ${Number(f.borderAlpha) * 0.55})`
      : `rgba(36, 31, 23, ${Number(f.borderAlpha) * 0.5})`,

    "--tp-shadow": f.shadow,
    "--tp-shadow-soft": f.shadowSoft,
    "--tp-shadow-deep": f.shadowDeep,
    "--tp-glow": f.glow,
    "--tp-glow-accent": f.glowAccent,

    "--tp-blur": f.blur,
    "--tp-density": f.density,
    "--tp-anim": `${f.anim}s`,
    "--tp-anim-ease": f.animEase,

    "--tp-shell-bg": f.shellBg,
    "--tp-shell-border": f.shellBorder,
    "--tp-shell-shadow": f.shellShadow,
    "--tp-shell-shadow-up": f.shellShadowUp,

    "--tp-surface-bg": f.surfaceBg,
    "--tp-surface-bg-strong": f.surfaceBgStrong,
    "--tp-surface-inset": f.surfaceInset,
    "--tp-surface-inset-strong": f.surfaceInsetStrong,
    "--tp-hairline": f.hairline,
    "--tp-selection": f.selectionBg,
    "--tp-scroll": f.scrollThumb,
    "--tp-focus-ring": f.focusRing,

    "--tp-texture-opacity": f.textureOpacity,
    "--tp-img-filter": f.imageFilter,

    "--tp-font-display": f.fontDisplay,
    "--tp-font-body": f.fontBody,
    "--tp-display-weight": f.fontDisplayWeight,
    "--tp-display-tracking": f.fontDisplayTracking,
    "--tp-font-family": f.fontBody,
  };
}

/* =========================================================
   世界感知的强调色
   =========================================================
   问题：方向色 / 默认强调色（`#6ee7a8`、`#e8c684` …）是以 **inline style**
   写进组件的（`style={{ color: planet.accent }}`），CSS 重映射够不到。
   把它们直接用在米白纸上，对比度实测只有 **1.36**（WCAG AA 要 4.5）——
   个人中心的 "NEWS LISTENING"、"ABILITY" 这类小标签基本看不见。

   而且**一个颜色救不了两边**：要在近黑(#050807)和近白(#F6F1E6)上都达到
   AA，同一亮度是不可能的。所以必须按世界给不同的值。

   用法：
     const { visualMode } = useTheme();
     const tone = inkForWorld(planet.accent, visualMode);

   深色世界原样返回；paper 按比例压深到可读阈值。
   ========================================================= */

/** #rgb / #rrggbb → [r,g,b]；解析失败返回 null */
function parseHex(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * 按视觉世界调整一个强调色，保证它在当前世界的底色上读得出来。
 *
 * @param {string} hex        原始强调色（6 位 hex）
 * @param {string} visualMode 世界 id
 */
export function inkForWorld(hex, visualMode) {
  if (visualMode !== "paper") return hex;
  const rgb = parseHex(hex);
  if (!rgb) return hex;

  /* 相对亮度：已经够深的就直接用，避免把本就暗的颜色压成黑 */
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  if (lum <= 0.18) return hex;

  /* 向"可读亮度"收敛：亮度越高压得越狠，保留色相比例 */
  const scale = Math.min(0.9, Math.sqrt(0.18 / Math.max(lum, 0.001)));
  return (
    "#" +
    rgb
      .map((c) => Math.max(1, Math.min(255, Math.round(c * scale))).toString(16).padStart(2, "0"))
      .join("")
  );
}
