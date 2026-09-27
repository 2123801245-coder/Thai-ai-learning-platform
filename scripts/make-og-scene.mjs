#!/usr/bin/env node
/**
 * 生成「产品场景版」分享卡片：public/brand/og-scene.svg → og-scene.png
 *
 * 为什么用 SVG 而不是截图
 * ----------------------
 * 卡片要能长期维护：改一句文案、换一个语料，应该改一次源文件重新生成，
 * 而不是让某个人再开一次手机截图。所以这里用矢量源 + 系统光栅化：
 *
 *   SVG 源（入库，可 review）
 *     → sips 转 PNG（macOS 自带，无需装任何依赖）
 *       → 自检（见下）
 *
 * 自检
 * ----
 * 这是个没人肉眼复核的构建产物，最怕的是「图生成了，但里面是空的」
 * （例如系统 SVG 渲染器不支持 <image> 内嵌位图、或某段泰文没有可用字体）。
 * 所以生成后会把 PNG 转成 BMP 读回来，按区域统计颜色：
 *   · 全图必须有亮像素（文字画出来了）
 *   · 品牌 logo 区域必须有金色像素（内嵌位图真的渲染了）
 *   · 对话气泡里必须有亮像素（泰文/中文有字体可用）
 * 任一条不满足就报错退出，别把一张空卡片发上线。
 *
 * 语料来源：卡片上的泰语取自仓库里的真实数据
 *   src/data/cityProfiles.js  「ซื้อตั๋วที่ไหน · 在哪里买票」
 *   src/data/conversations.js 「ริมหน้าต่าง · 靠窗」「หมายเลขเที่ยวบิน · 航班号」
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const SVG_OUT = path.join(ROOT, "public/brand/og-scene.svg");
const PNG_OUT = path.join(ROOT, "public/brand/og-scene.png");
const LOGO = path.join(ROOT, "public/brand/thaiai-logo-180.png");

const W = 1200;
const H = 630;

const CJK =
  "'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', Arial, sans-serif";
const THAI = "'Sukhumvit Set', 'Noto Sans Thai', 'Thonburi', sans-serif";

/* ---------- 布局常量（自检脚本按同一组坐标取样，改版时一起改） ---------- */
const LAYOUT = {
  logo: { x: 72, y: 66, size: 84 },
  card: { x: 624, y: 72, w: 504, h: 486, r: 26 },
  bubble1: { x: 648, y: 178, w: 372, h: 92, r: 20 },
};

/* ---------- 小工具 ---------- */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const rect = (x, y, w, h, r, fill, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra} />`;

const text = (x, y, size, fill, content, { family = CJK, weight = 400, anchor = "start", spacing, opacity } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  `${anchor === "start" ? "" : ` text-anchor="${anchor}"`}` +
  `${spacing ? ` letter-spacing="${spacing}"` : ""}${opacity ? ` opacity="${opacity}"` : ""}>${esc(content)}</text>`;

/* ---------- 卡片内的对话（真实语料，逐条来自仓库数据） ---------- */
const OPENING = { th: "ซื้อตั๋วที่ไหน", cn: "在哪里买票" };
const REPLY = { th: "ริมหน้าต่างครับ", cn: "靠窗，谢谢" };
const FOLLOW = { th: "หมายเลขเที่ยวบิน", roman: "mâai-lêe-aai thîao-bin", cn: "航班号" };

function buildSvg(logoBase64) {
  const { logo, card, bubble1 } = LAYOUT;

  /* 气泡从 card 顶部往下堆叠；高度写死但留了余量，
     因为系统的 SVG 文字度量与浏览器不完全一致，这里统一用宽松盒 + 居中留白。 */
  const b2 = { x: card.x + card.w - 24 - 288, y: bubble1.y + bubble1.h + 16, w: 288, h: 88, r: 20 };
  const b3 = { x: bubble1.x, y: b2.y + b2.h + 16, w: 400, h: 104, r: 20 };

  const chips = ["AI 对话陪练", "逐句纠音", "5,000+ 词汇"];
  let chipX = 72;
  const chipSvg = chips
    .map((label) => {
      const w = 34 + label.length * 17;
      const svg =
        rect(chipX, 424, w, 44, 22, "rgba(255,255,255,0.06)", ' stroke="rgba(255,255,255,0.14)"') +
        text(chipX + 17, 452, 17, "#e7f6f0", label);
      chipX += w + 12;
      return svg;
    })
    .join("");

  const domain = (process.env.VITE_SITE_URL || "thai-ai.online")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#04120f" />
      <stop offset="0.55" stop-color="#08201c" />
      <stop offset="1" stop-color="#03100e" />
    </linearGradient>
    <radialGradient id="glowA" cx="0.82" cy="0.12" r="0.6">
      <stop offset="0" stop-color="#0b7a5a" stop-opacity="0.55" />
      <stop offset="1" stop-color="#0b7a5a" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="0.08" cy="0.95" r="0.55">
      <stop offset="0" stop-color="#e8c26a" stop-opacity="0.28" />
      <stop offset="1" stop-color="#e8c26a" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bubbleUser" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f8a64" />
      <stop offset="1" stop-color="#0b6b51" />
    </linearGradient>
    <clipPath id="logoClip">
      <rect x="${logo.x}" y="${logo.y}" width="${logo.size}" height="${logo.size}" rx="20" />
    </clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)" />
  <rect width="${W}" height="${H}" fill="url(#glowA)" />
  <rect width="${W}" height="${H}" fill="url(#glowB)" />

  <!-- ===== 左侧：品牌与主张 ===== -->
  <g clip-path="url(#logoClip)">
    <image x="${logo.x}" y="${logo.y}" width="${logo.size}" height="${logo.size}"
           href="data:image/png;base64,${logoBase64}" />
  </g>
  ${rect(logo.x, logo.y, logo.size, logo.size, 20, "none", ' stroke="rgba(255,255,255,0.18)"')}

  ${text(176, 112, 44, "#ffffff", "ThaiAI", { weight: 700, spacing: -1 })}
  ${text(176, 146, 19, "#8fcdb8", "AI 泰语老师 · 每天 10 分钟开口说泰语")}

  ${text(72, 300, 54, "#ffffff", "把泰语练成", { weight: 600, spacing: -1.5 })}
  ${text(72, 364, 54, "#ffffff", "真的说得出口", { weight: 600, spacing: -1.5 })}
  ${text(72, 404, 20, "#9fc4b9", "对话陪练 · 声调发音 · 真实语料")}

  ${chipSvg}

  ${text(72, 560, 16, "#6f8f86", `${domain} · ThaiAI 泰语学习平台`)}

  <!-- ===== 右侧：真实对话场景 ===== -->
  ${rect(card.x, card.y, card.w, card.h, card.r, "rgba(255,255,255,0.055)", ' stroke="rgba(255,255,255,0.13)"')}

  <g clip-path="url(#logoClip)">
    <image x="${card.x + 24}" y="${card.y + 22}" width="40" height="40"
           href="data:image/png;base64,${logoBase64}" />
  </g>
  ${text(card.x + 76, card.y + 40, 19, "#ffffff", "AI 泰语老师", { weight: 600 })}
  ${text(card.x + 76, card.y + 62, 14, "#86b8a9", "机场值机 · 情景对话")}
  ${rect(card.x + card.w - 132, card.y + 22, 108, 34, 17, "rgba(232,194,106,0.16)", ' stroke="rgba(232,194,106,0.42)"')}
  ${text(card.x + card.w - 78, card.y + 44, 15, "#f0d79a", "发音 92", { anchor: "middle", weight: 600 })}

  <!-- 老师（左） -->
  ${rect(bubble1.x, bubble1.y, bubble1.w, bubble1.h, bubble1.r, "rgba(255,255,255,0.09)", ' stroke="rgba(255,255,255,0.10)"')}
  ${text(bubble1.x + 20, bubble1.y + 40, 26, "#ffffff", OPENING.th, { family: THAI, weight: 500 })}
  ${text(bubble1.x + 20, bubble1.y + 68, 16, "#9fc4b9", OPENING.cn)}

  <!-- 学员（右） -->
  ${rect(b2.x, b2.y, b2.w, b2.h, b2.r, "url(#bubbleUser)")}
  ${text(b2.x + 20, b2.y + 38, 24, "#ffffff", REPLY.th, { family: THAI, weight: 500 })}
  ${text(b2.x + 20, b2.y + 64, 15, "rgba(255,255,255,0.78)", REPLY.cn)}

  <!-- 老师（左，带罗马音注音） -->
  ${rect(b3.x, b3.y, b3.w, b3.h, b3.r, "rgba(255,255,255,0.09)", ' stroke="rgba(255,255,255,0.10)"')}
  ${text(b3.x + 20, b3.y + 38, 25, "#ffffff", FOLLOW.th, { family: THAI, weight: 500 })}
  ${text(b3.x + 20, b3.y + 62, 15, "#7fd7b8", FOLLOW.roman, { family: THAI })}
  ${text(b3.x + 20, b3.y + 86, 16, "#9fc4b9", FOLLOW.cn)}

  <!-- 输入条（示意「轮到你说话」） -->
  ${rect(card.x + 24, card.y + card.h - 68, card.w - 48, 48, 24, "rgba(255,255,255,0.07)", ' stroke="rgba(255,255,255,0.12)"')}
  ${text(card.x + 48, card.y + card.h - 37, 17, "#8fb3a8", "说一句泰语试试…")}
  <circle cx="${card.x + card.w - 48}" cy="${card.y + card.h - 44}" r="17" fill="rgba(11,122,90,0.85)" />
  ${text(card.x + card.w - 48, card.y + card.h - 37, 16, "#ffffff", "→", { anchor: "middle", weight: 700 })}
</svg>
`;
}

/* ============================================================
   自检：PNG → BMP → 按区域统计像素
   （BMP 是未压缩的裸数据，读它不需要任何依赖）
   ============================================================ */
function readBmpViaSips(pngPath) {
  const dir = mkdtempSync(path.join(tmpdir(), "og-scene-"));
  const bmpPath = path.join(dir, "card.bmp");
  try {
    execFileSync("sips", ["-s", "format", "bmp", pngPath, "--out", bmpPath], {
      stdio: "pipe",
    });
    const buf = readFileSync(bmpPath);
    const dataOffset = buf.readUInt32LE(10);
    const width = buf.readInt32LE(18);
    const height = Math.abs(buf.readInt32LE(22));
    const bpp = buf.readUInt16LE(28);
    if (bpp !== 24 && bpp !== 32) throw new Error(`不支持的 BMP 位深：${bpp}`);
    const bytes = bpp / 8;
    const rowSize = Math.ceil((width * bytes) / 4) * 4;
    const bottomUp = buf.readInt32LE(22) > 0;
    return {
      width,
      height,
      pixel(x, y) {
        const row = bottomUp ? height - 1 - y : y;
        const off = dataOffset + row * rowSize + x * bytes;
        return { b: buf[off], g: buf[off + 1], r: buf[off + 2] };
      },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function regionStats(img, { x, y, w, h }) {
  let bright = 0;
  let gold = 0;
  let total = 0;
  for (let py = y; py < y + h; py += 2) {
    for (let px = x; px < x + w; px += 2) {
      const { r, g, b } = img.pixel(px, py);
      total += 1;
      if (0.299 * r + 0.587 * g + 0.114 * b > 180) bright += 1;
      if (r > 120 && r > g + 20 && g > b + 10) gold += 1;
    }
  }
  return {
    brightFrac: bright / total,
    goldFrac: gold / total,
  };
}

function verify(pngPath) {
  const img = readBmpViaSips(pngPath);
  if (img.width !== W || img.height !== H) {
    throw new Error(`卡片尺寸不对：${img.width}×${img.height}，应为 ${W}×${H}`);
  }
  const whole = regionStats(img, { x: 60, y: 60, w: 560, h: 500 });
  const logo = regionStats(img, {
    x: LAYOUT.logo.x,
    y: LAYOUT.logo.y,
    w: LAYOUT.logo.size,
    h: LAYOUT.logo.size,
  });
  const bubble = regionStats(img, LAYOUT.bubble1);

  const checks = [
    ["左侧文字已渲染（有亮像素）", whole.brightFrac > 0.008],
    ["品牌 logo 内嵌位图已渲染（有金色像素）", logo.goldFrac > 0.02],
    ["对话气泡里有文字（有亮像素）", bubble.brightFrac > 0.004],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  }
  console.log(
    `  画面统计：左栏亮像素 ${(whole.brightFrac * 100).toFixed(2)}% · ` +
      `logo 金色 ${(logo.goldFrac * 100).toFixed(2)}% · 气泡亮像素 ${(bubble.brightFrac * 100).toFixed(2)}%`
  );
  if (failed.length) {
    throw new Error(
      `自检未通过：${failed.map(([l]) => l).join("、")} —— 系统 SVG 渲染器可能不支持内嵌位图或缺少泰文字体`
    );
  }
}

function main() {
  if (!existsSync(LOGO)) throw new Error(`找不到品牌 logo：${path.relative(ROOT, LOGO)}`);
  const logoBase64 = readFileSync(LOGO).toString("base64");

  writeFileSync(SVG_OUT, buildSvg(logoBase64));
  console.log(`[og-scene] 写出 SVG 源：${path.relative(ROOT, SVG_OUT)}`);

  execFileSync("sips", ["-s", "format", "png", SVG_OUT, "--out", PNG_OUT], {
    stdio: "pipe",
  });
  const bytes = readFileSync(PNG_OUT).length;
  console.log(
    `[og-scene] 光栅化：${path.relative(ROOT, PNG_OUT)} （${W}×${H}，${(bytes / 1024).toFixed(0)}KB）`
  );

  verify(PNG_OUT);
  console.log("[og-scene] 自检通过");
}

main();
