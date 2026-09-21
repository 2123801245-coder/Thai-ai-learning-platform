// src/lib/worldPostcard.js
//
// =========================================================
// ThaiAI World · 成就卡成图（纯 Canvas2D，不引任何依赖）
// =========================================================
//
// 目标：让「我的泰语世界」变成一张用户愿意主动晒出去的图。
//
// 为什么自己用 Canvas2D 画，而不是 html2canvas / 截图 DOM：
//   ① 站内已经有 Canvas2D 用法（发音波形），不新增依赖
//   ② DOM 截图会把字号、字体回退、滚动位置一起带走，跨设备成图不稳定
//   ③ 这里画的每一笔都对应一个真实数字，成图可以逐项断言
//
// 图上的编码与首页星系**完全一致**（半径 = 掌握度），所以分享图不是
// 「另一个产品的宣传图」，而是这个世界的一张快照。
//
// 守护者形象优先用真实 3D 画布的一帧（lib/worldSnapshot.js），拿不到
// （无 WebGL / 静态模式 / 还没挂载）就程序化画一个——低端设备也有卡。
// =========================================================

export const POSTCARD_WIDTH = 1080;
export const POSTCARD_HEIGHT = 1350;

const FONT_FAMILY =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",sans-serif';

/* =========================================================
   里程碑
   ---------------------------------------------------------
   刻意做成**印章**而不是**门禁**：
   成就卡任何时候都能生成（它记录的是真实的你），连续天数决定卡上盖
   哪一枚章。把卡锁起来只会让新用户永远看不到这个功能，而他们恰恰是
   最需要「我也有个世界」的人。
========================================================= */

export const MILESTONES = [
  { days: 7, label: "7 天启程", color: "#6ee7a8" },
  { days: 30, label: "30 天同行", color: "#e8c88a" },
  { days: 100, label: "百日守护", color: "#c3a6ff" },
];

/** 当前连续天数已经拿到哪一枚章（没有就返回 null） */
export function milestoneFor(streak = 0) {
  const days = Math.max(0, Math.floor(Number(streak) || 0));
  return [...MILESTONES].reverse().find((item) => days >= item.days) || null;
}

/** 下一枚章还差几天（已拿满则返回 null） */
export function nextMilestone(streak = 0) {
  const days = Math.max(0, Math.floor(Number(streak) || 0));
  const next = MILESTONES.find((item) => days < item.days);
  if (!next) return null;
  return { ...next, remaining: next.days - days };
}

/* =========================================================
   小工具
========================================================= */

const setFont = (ctx, weight, size) => {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
};

/** 截断过长文本，避免撑破版面（中文按字符宽度估算即可） */
function clipText(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (!value) return "";
  if (ctx.measureText(value).width <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* =========================================================
   背景：深空 + 主题色辉光 + 金箔斜纹
========================================================= */

function drawBackground(ctx, accent) {
  const gradient = ctx.createLinearGradient(0, 0, 0, POSTCARD_HEIGHT);
  gradient.addColorStop(0, "#05080b");
  gradient.addColorStop(0.55, "#04070a");
  gradient.addColorStop(1, "#020406");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT);

  const glows = [
    { x: 540, y: 380, r: 620, color: accent, alpha: 0.2 },
    { x: 120, y: 1180, r: 520, color: "#e8c88a", alpha: 0.12 },
    { x: 980, y: 1080, r: 460, color: "#c3a6ff", alpha: 0.12 },
  ];
  glows.forEach((glow) => {
    const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    g.addColorStop(0, `${glow.color}${Math.round(glow.alpha * 255).toString(16).padStart(2, "0")}`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT);
  });

  /* 金箔斜纹：呼应英雄区的泰国纹样底纹 */
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#e8c88a";
  ctx.lineWidth = 1;
  for (let i = -POSTCARD_HEIGHT; i < POSTCARD_WIDTH; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + POSTCARD_HEIGHT, POSTCARD_HEIGHT);
    ctx.stroke();
  }
  for (let i = -POSTCARD_HEIGHT; i < POSTCARD_WIDTH; i += 34) {
    ctx.beginPath();
    ctx.moveTo(POSTCARD_WIDTH - i, 0);
    ctx.lineTo(POSTCARD_WIDTH - i - POSTCARD_HEIGHT, POSTCARD_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();
}

/* =========================================================
   守护者
========================================================= */

/** 程序化守护者：与 WorldHero 的 StaticGuardian 同一套视觉语言 */
function drawProceduralGuardian(ctx, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.5);
  glow.addColorStop(0, "rgba(63,224,160,0.35)");
  glow.addColorStop(0.6, "rgba(63,224,160,0.06)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.35,
    r * 0.08,
    cx,
    cy,
    r
  );
  body.addColorStop(0, "#2a3238");
  body.addColorStop(0.45, "#12171b");
  body.addColorStop(1, "#05070a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  /* 祖母绿神经纹：两条弧线，暗示「陶瓷内部的光」 */
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#3fe0a0";
  ctx.lineWidth = 2.5;
  [0.42, 0.62].forEach((factor, index) => {
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      r * factor,
      r * factor * 0.5,
      (index === 0 ? 1 : -1) * 0.7,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  });
  ctx.restore();

  /* 眼睛 */
  ctx.save();
  ctx.shadowColor = "rgba(63,224,160,0.95)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#3fe0a0";
  [-r * 0.17, r * 0.17].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - r * 0.06, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement|null}    image 3D 快照（可空）
 */
function drawGuardian(ctx, image, cx, cy, r, accent) {
  if (image && image.width) {
    /* 圆形裁切 + 香槟金环：让任意一帧画面都能落进版面 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max((r * 2) / image.width, (r * 2) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(232,200,138,0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  drawProceduralGuardian(ctx, cx, cy, r);
}

/* =========================================================
   星系快照（与首页同一套编码：半径 = 掌握度）
========================================================= */

function drawGalaxy(ctx, planets, cx, cy, maxRadius) {
  const list = Array.isArray(planets) ? planets : [];
  if (!list.length) return;

  /* 半径单位 → 像素。基准半径 2.15，收得最紧的也留出可见间距 */
  const unit = maxRadius / 4.23;

  list.forEach((planet, index) => {
    const radius = (typeof planet.radius === "number" ? planet.radius : 2.15 + index * 0.52) * unit;
    const veiled = planet.veil?.tier && planet.veil.tier !== "none";
    ctx.save();
    ctx.strokeStyle = veiled ? "rgba(124,136,148,0.22)" : `${planet.accent}44`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  /* 中央恒星 */
  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
  sun.addColorStop(0, "rgba(255,217,160,0.95)");
  sun.addColorStop(0.5, "rgba(255,217,160,0.28)");
  sun.addColorStop(1, "transparent");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();

  list.forEach((planet, index) => {
    const angle = (index / list.length) * Math.PI * 2 - Math.PI / 2;
    const radius = (typeof planet.radius === "number" ? planet.radius : 2.15 + index * 0.52) * unit;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius * 0.55;
    const size = 9 + (Number(planet.progress) || 0) * 0.13;
    const veiled = planet.veil?.tier && planet.veil.tier !== "none";

    ctx.save();
    ctx.globalAlpha = veiled ? 0.42 : 1;
    if (!veiled) {
      ctx.shadowColor = planet.accent;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = planet.accent;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* 当前星球：金色信标 */
    if (planet.state === "current") {
      ctx.save();
      ctx.strokeStyle = "rgba(232,200,138,0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(px, py, size * 2.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    /* 落后星球：琥珀脉冲环（与 3D 里同一套记号） */
    if (planet.laggard) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,179,125,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, size * 2.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = veiled ? 0.35 : 0.8;
    setFont(ctx, 500, 22);
    ctx.fillStyle = "#e8eef2";
    ctx.textAlign = "center";
    ctx.fillText(planet.cn, px, py + size + 30);
    ctx.restore();
  });
}

/* =========================================================
   主入口
========================================================= */

/**
 * 把成就卡画到 canvas 上。调用方负责最终 toBlob/toDataURL。
 *
 * @param {HTMLCanvasElement} canvas 目标画布（会被重设为 1080×1350）
 * @param {object} data
 *   name        用户名
 *   title       探索者称号（Thai Explorer…）
 *   level       XP 等级
 *   cefr        泰语等级（A0~C1 或「待测」）
 *   cefrTitle   等级说明
 *   goal        学习目标（可空）
 *   streak      连续学习天数
 *   mastered    累计掌握词汇
 *   themeName   世界主题名（追剧宇宙…）
 *   accent      主题色
 *   planets     buildPlanets() 的结果
 *   image       守护者快照（HTMLImageElement，可空）
 *   dateLabel   日期文案
 * @returns {boolean} 是否成功绘制
 */
export function drawPostcard(canvas, data = {}) {
  if (!canvas || typeof canvas.getContext !== "function") return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  canvas.width = POSTCARD_WIDTH;
  canvas.height = POSTCARD_HEIGHT;

  const accent = data.accent || "#e8c88a";
  const name = data.name || "朋友";

  drawBackground(ctx, accent);

  /* ── 页眉 ── */
  ctx.save();
  ctx.textAlign = "left";
  setFont(ctx, 600, 24);
  ctx.fillStyle = "rgba(110,231,168,0.72)";
  /* 手写字母间距：Canvas2D 没有 letterSpacing，只能逐字画 */
  let x = 72;
  for (const ch of "THAIAI WORLD") {
    ctx.fillText(ch, x, 108);
    x += ctx.measureText(ch).width + 7;
  }

  ctx.textAlign = "right";
  setFont(ctx, 700, 26);
  ctx.fillStyle = accent;
  ctx.fillText(clipText(ctx, data.themeName || "基础宇宙", 380), POSTCARD_WIDTH - 72, 108);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(72, 150);
  ctx.lineTo(POSTCARD_WIDTH - 72, 150);
  ctx.stroke();
  ctx.restore();

  /* ── 守护者 ── */
  const guardianCy = 430;
  const guardianR = 186;
  drawGuardian(ctx, data.image || null, POSTCARD_WIDTH / 2, guardianCy, guardianR, accent);

  /* ── 称号 ── */
  ctx.save();
  ctx.textAlign = "center";
  setFont(ctx, 800, 64);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(clipText(ctx, `你好，${name}。`, POSTCARD_WIDTH - 200), POSTCARD_WIDTH / 2, 706);

  setFont(ctx, 600, 30);
  ctx.fillStyle = accent;
  const tierLine = `Lv.${data.level || 1} · ${data.title || "Thai Beginner"}`;
  ctx.fillText(clipText(ctx, tierLine, POSTCARD_WIDTH - 220), POSTCARD_WIDTH / 2, 756);

  setFont(ctx, 500, 26);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  const sub = [
    data.cefr ? `泰语等级 ${data.cefr}${data.cefrTitle ? ` · ${data.cefrTitle}` : ""}` : "还没做入学测试",
    data.goal ? `目标 ${data.goal}` : "",
  ]
    .filter(Boolean)
    .join("   ·   ");
  ctx.fillText(clipText(ctx, sub, POSTCARD_WIDTH - 200), POSTCARD_WIDTH / 2, 802);
  ctx.restore();

  /* ── 星系快照 ── */
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, 850);
  ctx.lineTo(POSTCARD_WIDTH - 150, 850);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  setFont(ctx, 500, 22);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText("我的学习星系 · 轨道半径 = 掌握度", POSTCARD_WIDTH / 2, 892);
  ctx.restore();

  drawGalaxy(ctx, data.planets, POSTCARD_WIDTH / 2, 1055, 178);

  /* ── 统计条 ── */
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 1210);
  ctx.lineTo(POSTCARD_WIDTH - 72, 1210);
  ctx.stroke();
  ctx.restore();

  const stats = [
    { label: "连续学习", value: `${data.streak || 0} 天` },
    { label: "掌握词汇", value: `${data.mastered || 0}` },
    {
      label: "已完成星球",
      value: String((data.planets || []).filter((p) => p.state === "done").length),
    },
    {
      label: "平均掌握度",
      value: `${String(
        (data.planets || []).length
          ? Math.round(
              (data.planets || []).reduce((sum, p) => sum + (Number(p.progress) || 0), 0) /
                (data.planets || []).length
            )
          : 0
      )}%`,
    },
  ];

  const colWidth = (POSTCARD_WIDTH - 144) / stats.length;
  ctx.textAlign = "center";
  stats.forEach((stat, index) => {
    const cx = 72 + colWidth * index + colWidth / 2;
    setFont(ctx, 700, 40);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(stat.value, cx, 1276);
    setFont(ctx, 500, 22);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillText(stat.label, cx, 1310);
  });

  /* ── 里程碑印章 ── */
  const milestone = milestoneFor(data.streak);
  if (milestone) {
    const sx = POSTCARD_WIDTH - 168;
    const sy = 246;
    const sr = 74;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.14);

    /* 印章本体：半透明底 + 同色描边，不做满色（要能看见背后的画面） */
    ctx.fillStyle = "rgba(4,7,10,0.72)";
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = milestone.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, sr - 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    setFont(ctx, 800, 46);
    ctx.fillStyle = milestone.color;
    ctx.fillText(`${milestone.days}`, 0, 12);
    setFont(ctx, 600, 19);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("天", 0, 40);
    ctx.restore();
  }

  /* ── 页脚 ── */
  ctx.save();
  ctx.textAlign = "left";
  setFont(ctx, 500, 20);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText(clipText(ctx, data.dateLabel || "", 420), 72, 1338);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText("ThaiAI · 我的泰语世界", POSTCARD_WIDTH - 72, 1338);
  ctx.restore();

  return true;
}

/** 便捷封装：直接产出一个 dataURL */
export function renderPostcardDataUrl(canvas, data) {
  if (!drawPostcard(canvas, data)) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export default { drawPostcard, renderPostcardDataUrl, milestoneFor, nextMilestone, MILESTONES };
