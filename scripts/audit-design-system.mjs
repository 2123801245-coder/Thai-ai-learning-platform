#!/usr/bin/env node
/**
 * ThaiAI 设计系统审计（只读，不修改任何文件）
 *
 * 方法论借自两套公开设计系统的做法：
 *   - IBM Carbon：token 分三层（primitive → semantic → component），语义层必须是
 *     单一事实来源；组件不许自带硬编码色值。
 *   - GOV.UK Design System：pattern 优先——同一类交互（错误、加载、空态、表单校验）
 *     全站应只有一个共享实现，而不是各页各写一遍。
 *
 * 跑法：node scripts/audit-design-system.mjs        （直接输出 markdown）
 *      node scripts/audit-design-system.mjs --json （输出 JSON，便于进 CI 断言）
 *
 * 设计为「可复测」：每次改完主题层跑一遍，数字应单调下降（硬编码色值数、手搓元素数、
 * 模式重复数），这就是设计系统的收敛指标。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 注意：不能用 new URL(import.meta.url).pathname —— 仓库路径含中文时会被
// 百分号编码，导致扫描到 0 个文件（这个坑已经踩过一次）。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const BACKEND = path.join(ROOT, "backend");
const JSON_OUT = process.argv.includes("--json");

/* ---------------------------------------------------------------- 工具 */

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      walk(full, exts, out);
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const read = (p) => fs.readFileSync(p, "utf8");
const rel = (p) => path.relative(ROOT, p);

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const RGB_RE = /\b(?:rgba?|hsla?)\([^)]*\)/g;
const countAll = (text, re) => (text.match(re) || []).length;

/* ---------------------------------------------------------------- 1. Token 层 */

const cssFiles = walk(SRC, [".css"]);
const jsFiles = walk(SRC, [".js", ".jsx"]).filter((p) => !p.includes("__tests__"));
const allCodeFiles = [...cssFiles, ...jsFiles];
const indexCssPath = path.join(SRC, "index.css");

function varsInBlock(css, selectorRe) {
  const m = css.match(selectorRe);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
}

const indexCss = fs.existsSync(indexCssPath) ? read(indexCssPath) : "";
const rootVars = varsInBlock(indexCss, /:root\s*\{([^{}]*)\}/);
const darkVars = varsInBlock(indexCss, /\.dark\s*\{([^{}]*)\}/);
const darkMissing = [...rootVars].filter((v) => !darkVars.has(v));
const darkExtra = [...darkVars].filter((v) => !rootVars.has(v));

const themeFiles = walk(path.join(SRC, "themes"), [".css"]).map((p) => {
  const names = new Set([...read(p).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  const known = new Set([...rootVars, ...darkVars]);
  return {
    file: rel(p),
    defined: names.size,
    overrides: [...names].filter((n) => known.has(n)).length,
    brandNew: [...names].filter((n) => !known.has(n)).length,
  };
});

/* ---------------------------------------------------------------- 2. 硬编码色值普查 */

const colorCensus = allCodeFiles.map((p) => {
  const t = read(p);
  const hex = countAll(t, HEX_RE);
  const rgb = countAll(t, RGB_RE);
  return {
    file: rel(p),
    hex,
    rgb,
    hard: hex + rgb,
    varRefs: countAll(t, /var\(--/g),
    // 「世界/沉浸」层：3D、世界数据、落地页
    worldLayer: /themes\/|components\/world\/|lib\/world|lib\/deepSpace|deepSpace\.js|LandingSections|ThaiLanding/.test(rel(p)),
  };
});

const colorTotals = new Map();
for (const p of allCodeFiles) {
  for (const h of read(p).match(HEX_RE) || []) {
    const key = h.toLowerCase();
    colorTotals.set(key, (colorTotals.get(key) || 0) + 1);
  }
}
const topColors = [...colorTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
const totalHard = colorCensus.reduce((s, c) => s + c.hard, 0);
const totalVar = colorCensus.reduce((s, c) => s + c.varRefs, 0);
const worldHard = colorCensus.filter((c) => c.worldLayer).reduce((s, c) => s + c.hard, 0);
const worldVar = colorCensus.filter((c) => c.worldLayer).reduce((s, c) => s + c.varRefs, 0);

/* ---------------------------------------------------------------- 3. 组件层 */

const uiDir = path.join(SRC, "components/ui");
const uiFiles = fs.existsSync(uiDir) ? walk(uiDir, [".jsx"]) : [];
const uiMatrix = uiFiles.map((p) => {
  const t = read(p);
  return {
    file: path.basename(p),
    focusVisible: t.includes("focus-visible"),
    disabled: t.includes("disabled"),
    aria: countAll(t, /aria-/g),
    cva: t.includes("cva("),
  };
});

const businessFiles = jsFiles.filter((p) => !rel(p).startsWith("src/components/ui/"));
const businessJsx = businessFiles.filter((p) => p.endsWith(".jsx"));
let rawButtons = 0;
let rawInputs = 0;
let importsUi = 0;
let importsUiJsx = 0;
for (const p of businessFiles) {
  const t = read(p);
  rawButtons += countAll(t, /<button\b/g);
  rawInputs += countAll(t, /<input\b/g);
  if (/from\s+["']@\/components\/ui\//.test(t)) {
    importsUi += 1;
    if (p.endsWith(".jsx")) importsUiJsx += 1;
  }
}

const focusRisk = [];
for (const p of [...businessFiles, ...uiFiles]) {
  const t = read(p);
  if (!t.includes("outline-none")) continue;
  const hasAlt = ["focus-visible:", "focus:ring", "focus:border", "focus:outline", "focus-within:"].some((k) =>
    t.includes(k)
  );
  if (!hasAlt) focusRisk.push(rel(p));
}

/* ---------------------------------------------------------------- 4. Pattern 层（GOV.UK 口径） */

const PATTERNS = {
  "加载动画 animate-spin": /animate-spin/g,
  "骨架屏 animate-pulse": /animate-pulse/g,
  "空状态文案": /暂无|还没有|没有任何|空空如也/g,
  "错误提示（red-* 等）": /text-red-|bg-red-|border-red-|text-\[#(?:e0a3a3|f0c9c9|ef4444)\]/g,
  "自建弹层 fixed inset-0": /fixed inset-0/g,
  "toast 调用": /\btoast\(|\bsonner\b/g,
};
const patternStats = Object.entries(PATTERNS).map(([name, re]) => {
  let files = 0;
  let hits = 0;
  for (const p of businessFiles) {
    const n = countAll(read(p), re);
    if (n) {
      files += 1;
      hits += n;
    }
  }
  return { name, files, hits };
});

/* ---------------------------------------------------------------- 5. Voice & Tone 层 */

const backendFiles = walk(BACKEND, [".js"]).filter((p) => !p.includes("node_modules"));
const personaHits = [];
for (const p of backendFiles) {
  const t = read(p);
  const lines = t.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/你是[^"'`]{0,70}/);
    if (m) personaHits.push({ file: rel(p), line: i + 1, text: m[0].slice(0, 70) });
  });
}

/* ---------------------------------------------------------------- 输出 */

const report = {
  tokenLayer: {
    indexCssVars: { root: rootVars.size, dark: darkVars.size },
    darkMissing,
    darkExtra,
    themeFiles,
    varRefs: totalVar,
    hardcoded: totalHard,
    distinctHex: colorTotals.size,
    worldLayer: { hardcoded: worldHard, varRefs: worldVar },
    topColors: topColors.map(([color, n]) => ({ color, n })),
    worstFiles: colorCensus.sort((a, b) => b.hard - a.hard).slice(0, 12),
  },
  componentLayer: {
    uiComponents: uiMatrix.length,
    uiMatrix,
    businessFiles: businessFiles.length,
    businessJsxFiles: businessJsx.length,
    importsUi,
    importsUiJsx,
    adoptionRate: businessJsx.length ? +(importsUiJsx / businessJsx.length).toFixed(3) : 0,
    tokenCoverage: +(totalVar / Math.max(1, totalVar + totalHard)).toFixed(3),
    rawButtons,
    rawInputs,
    focusRisk,
  },
  patternLayer: patternStats,
  voiceLayer: { personaCount: personaHits.length, personaHits },
};

if (JSON_OUT) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const L = [];
  L.push("# ThaiAI 设计系统审计（自动生成）", "");
  L.push(`> 由 \`scripts/audit-design-system.mjs\` 生成，只读扫描 ${allCodeFiles.length} 个源文件。`, "");

  L.push("## 1. Token 层（Carbon 三层模型口径）", "");
  L.push(`- \`src/index.css\`：\`:root\` ${rootVars.size} 个变量 / \`.dark\` ${darkVars.size} 个`);
  L.push(`- 明暗差异：\`.dark\` 缺少 ${darkMissing.length} 个（${darkMissing.join(", ") || "无"}），额外 ${darkExtra.length} 个`);
  L.push(`- 全仓 \`var(--…)\` 引用 **${totalVar}** 处 vs 硬编码颜色 **${totalHard}** 处（其中不同色值 **${colorTotals.size}** 个）`);
  L.push(`- token 覆盖率（var 引用 ÷ 颜色总用法）**${(report.componentLayer.tokenCoverage * 100).toFixed(0)}%**`);
  L.push(`- 「世界/沉浸」层（themes、world、落地页）硬编码 ${worldHard} 处，仅 ${worldVar} 处用 token`);
  L.push("");
  L.push("| 主题文件 | 定义变量 | 覆盖 index.css 同名 | 全新命名 |");
  L.push("|---|---|---|---|");
  for (const t of themeFiles) L.push(`| ${t.file} | ${t.defined} | ${t.overrides} | ${t.brandNew} |`);
  L.push("");
  L.push("**事实上的语义色（硬编码次数最多 → 最该进 semantic token）**", "");
  L.push("| 色值 | 出现次数 |");
  L.push("|---|---|");
  for (const [c, n] of topColors) L.push(`| \`${c}\` | ${n} |`);
  L.push("");
  L.push("**硬编码最多的文件**", "");
  L.push("| 文件 | hex | rgb | var(--) |");
  L.push("|---|---|---|---|");
  for (const f of report.tokenLayer.worstFiles) L.push(`| ${f.file} | ${f.hex} | ${f.rgb} | ${f.varRefs} |`);
  L.push("");

  L.push("## 2. 组件层", "");
  L.push(`- ui/ 组件 **${uiMatrix.length}** 个；渲染 UI 的业务文件引用过 \`@/components/ui/*\` 的仅 **${importsUiJsx}/${businessJsx.length}（${(report.componentLayer.adoptionRate * 100).toFixed(0)}%）**（含纯逻辑 .js 时为 ${importsUi}/${businessFiles.length}）`);
  L.push(`- 业务代码手搓 \`<button>\` **${rawButtons}** 处、\`<input>\` **${rawInputs}** 处`);
  L.push(`- \`outline-none\` 且无任何 focus 替代反馈：${focusRisk.length} 个文件${focusRisk.length ? `（${focusRisk.join(", ")}）` : ""}`);
  L.push("");
  L.push("| ui 组件 | focus-visible | disabled | aria-* | CVA |");
  L.push("|---|---|---|---|---|");
  for (const c of uiMatrix) {
    L.push(`| ${c.file} | ${c.focusVisible ? "✓" : "—"} | ${c.disabled ? "✓" : "—"} | ${c.aria} | ${c.cva ? "✓" : "—"} |`);
  }
  L.push("");

  L.push("## 3. Pattern 层（GOV.UK 口径：同类交互应只有一个共享实现）", "");
  L.push("| 模式 | 出现文件数 | 出现次数 |");
  L.push("|---|---|---|");
  for (const p of patternStats) L.push(`| ${p.name} | ${p.files} | ${p.hits} |`);
  L.push("");

  L.push("## 4. Voice & Tone 层", "");
  L.push(`- 后端「你是…」人格声明 **${personaHits.length}** 处：`, "");
  L.push("| 文件:行 | 人格 |");
  L.push("|---|---|");
  for (const h of personaHits) L.push(`| ${h.file}:${h.line} | ${h.text.replace(/\|/g, "\\|")} |`);
  L.push("");

  process.stdout.write(`${L.join("\n")}\n`);
}
