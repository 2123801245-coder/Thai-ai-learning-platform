// src/components/world/stoneOrbArt.js
//
// =========================================================
// 五尊白色石雕 Orb · 程序化浮雕贴图（法线 + 刻痕深度）
// =========================================================
//
// 为什么是「离线算一遍的贴图」而不是在片元着色器里现算浮雕：
//
//   浮雕要真实，就必须有**法线扰动**。若把纹样写成 GLSL 函数、再用法线
//   差分去求梯度，每个像素要算 5 次高度场 × 每次 3~4 次噪声 ≈ 60 次噪声
//   采样 —— 五个球一起跑，在中端手机上会直接吃掉一帧的大半。
//
//   这里改成：开机时在 JS 里把每个世界的浮雕算成一张 256×256 的
//   **法线图（RGB）+ 刻痕深度（A）**，之后每帧只是一次贴图采样。
//   纹样仍然是程序化的（不是画好的图片），雕刻感来自真实的高度场梯度，
//   代价从「每帧每像素」变成「一次、每世界一张 256²」。
//
// 贴图通道约定：
//   RGB = 切线空间法线（0.5 为平面）
//   A   = 高度（1 = 未雕琢的石面，越接近 0 刻得越深）
//
// 五个世界共用同一套石头材质语言（细致石纹 + 兰纳卷草 + 曼陀罗环带），
// 但**中心浮雕各不相同**，所以一眼就能看出是五个不同的世界。

const SIZE = 256;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* 圆 / 圆角矩形的有符号距离：负数在形状内部 */
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const sdBox = (x, y, cx, cy, hw, hh) => {
  const dx = Math.abs(x - cx) - hw;
  const dy = Math.abs(y - cy) - hh;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0);
};

/* 刻线：贴着距离场 0 位置挖一条窄而深的沟 */
const carve = (h, d, w, depth) => h - (1 - smoothstep(0, w, Math.abs(d))) * depth;
/* 内凹：形状内部整体下沉（用于「挖空的窗」「凹陷的台基」） */
const hollow = (h, d, w, depth) => h - (1 - smoothstep(-w, w, d)) * depth;

/* 值噪声（只用来做石面颗粒，不需要高质量） */
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return mix(mix(a, b, u), mix(c, d, u), v);
}
function fbm(x, y, oct) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

/* =========================================================
   共用的石头语言
   ---------------------------------------------------------
   兰纳卷草（沿经线走的一串卷）＋ 曼陀罗环带（沿纬线的细环）
   ＋ 石面颗粒。三者都刻意做得极浅：它们是「材质」，不是「图案」，
   远看应该只觉得石头有质感，凑近才看得见纹样。
========================================================= */
function stoneBase(u, v) {
  let h = 1;

  /* 石面颗粒：细密、无方向性 */
  h -= fbm(u * 220, v * 220, 3) * 0.05;
  /* 极缓的大起伏：让石面不是数学球面 */
  h -= fbm(u * 7 + 11, v * 7 + 3, 2) * 0.1;

  /* 兰纳卷草：两圈，一上一下，避开支点（极点在 v=0 / v=1） */
  for (const band of [0.34, 0.66]) {
    const du = (v - band) * 26;
    const curl = Math.sin(u * Math.PI * 2 * 16 + Math.sin(v * Math.PI * 5) * 1.4);
    h = carve(h, du + curl * 0.55, 0.22, 0.3);
  }

  /* 曼陀罗环带：赤道附近的细密同心环 */
  const ringD = Math.abs(v - 0.5) - 0.055;
  h = carve(h, ringD, 0.012, 0.26);
  for (let i = 1; i <= 3; i++) {
    h = carve(h, ringD - i * 0.02, 0.008, 0.16);
  }

  return h;
}

/* =========================================================
   五个世界的中心浮雕
   ---------------------------------------------------------
   都用同一个 u,v ∈ [0,1] 空间（u = 经度，v = 纬度，v=0 在南极）。
   主浮雕刻意收在 v ∈ [0.3, 0.78]，避开等距柱状投影的极点拉伸。
========================================================= */
const MOTIFS = {
  /* 语言之基 —— 石经板 + 泰文字母柱 */
  foundation(u, v) {
    let h = 0;
    /* 经板：一块被挖出的矩形窗 */
    h = hollow(h, sdBox(u, v, 0.5, 0.54, 0.3, 0.15), 0.02, 0.22);
    /* 板上刻泰文：一列列的「字柱」——竖笔 + 上方的圈（泰文头符的意象） */
    for (let i = 0; i < 7; i++) {
      const cx = 0.25 + i * 0.083;
      h = carve(h, u - cx, 0.0075, 0.5);
      h = carve(h, sdCircle(u, v, cx, 0.635, 0.022), 0.0075, 0.45);
      h = carve(h, v - 0.47, 0.0075, 0.32);
    }
    /* 板下一朵莲花台 */
    for (let i = 0; i < 5; i++) {
      const a = -0.62 + i * 0.31;
      h = carve(h, (u - 0.5) * Math.cos(a) + (v - 0.36) * Math.sin(a), 0.006, 0.3);
    }
    return h;
  },

  /* 听说之桥 —— 声波弧 + 对话点 */
  speaking(u, v) {
    let h = 0;
    /* 声波：从左侧一点向外扩散的同心弧 */
    const cx = 0.16;
    const cy = 0.54;
    const r = Math.hypot((u - cx) * 1.35, v - cy);
    for (let i = 1; i <= 6; i++) {
      h = carve(h, Math.abs(r - i * 0.085), 0.007, 0.42 - i * 0.03);
    }
    /* 对话：三个大小递减的圆点（像两三个人的来回） */
    h = carve(h, sdCircle(u, v, 0.58, 0.62, 0.05), 0.01, 0.4);
    h = carve(h, sdCircle(u, v, 0.7, 0.56, 0.038), 0.01, 0.36);
    h = carve(h, sdCircle(u, v, 0.79, 0.5, 0.028), 0.009, 0.32);
    /* 桥：一条横向微微拱起的线，把两侧连起来 */
    const arch = 0.4 + Math.sin(clamp((u - 0.2) / 0.6, 0, 1) * Math.PI) * 0.05;
    h = carve(h, v - arch, 0.008, 0.34);
    return h;
  },

  /* 读写之窗 —— 古籍书页 + 墨迹 */
  media(u, v) {
    let h = 0;
    /* 书页：两栏竖排的界行（古籍的「行格」） */
    for (let col = 0; col < 2; col++) {
      const left = 0.24 + col * 0.28;
      h = hollow(h, sdBox(u, v, left + 0.12, 0.56, 0.115, 0.2), 0.012, 0.14);
      for (let i = 0; i <= 4; i++) {
        h = carve(h, u - (left + i * 0.06), 0.0055, 0.34);
      }
    }
    /* 墨迹：一处晕开的圆斑（像落了一滴墨） */
    h = hollow(h, sdCircle(u, v, 0.66, 0.42, 0.055), 0.05, 0.2);
    /* 页角一朵莲花 */
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      h = carve(
        h,
        Math.abs(Math.sin(a) * (u - 0.5) - Math.cos(a) * (v - 0.28)) - 0.014,
        0.006,
        0.26
      );
    }
    return h;
  },

  /* 文化之光 —— 佛塔 + 泰式火焰纹 */
  culture(u, v) {
    let h = 0;
    /* 塔：五层递收的台基（佛塔的意象）+ 塔刹 */
    for (let tier = 0; tier < 5; tier++) {
      const hw = 0.19 - tier * 0.028;
      const cy = 0.36 + tier * 0.075;
      h = carve(h, sdBox(u, v, 0.5, cy, hw, 0.026), 0.008, 0.4);
    }
    h = carve(h, sdCircle(u, v, 0.5, 0.79, 0.022), 0.008, 0.42);
    h = carve(h, u - 0.5, 0.007, 0.3);
    /* 火焰纹（泰式卷焰）：塔两侧对称各三束 */
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = 0.5 + s * (0.3 + i * 0.055);
        const y = 0.42 + i * 0.05;
        const flame = Math.abs(u - x) + Math.abs(v - y) * 0.6 - i * 0.012;
        h = carve(h, flame, 0.006, 0.3);
        h = carve(h, sdCircle(u, v, x + s * 0.02, y + 0.04, 0.016), 0.006, 0.26);
      }
    }
    return h;
  },

  /* 应用之路 —— 曼谷 + 清迈的天际线 */
  professional(u, v) {
    let h = 0;
    /* 地平线 */
    h = carve(h, v - 0.4, 0.007, 0.3);
    /* 高楼：宽窄高矮不一的方柱，压在地平线上 */
    const towers = [
      [0.24, 0.1, 0.035],
      [0.33, 0.2, 0.042],
      [0.42, 0.14, 0.03],
      [0.5, 0.27, 0.05],
      [0.6, 0.17, 0.036],
      [0.7, 0.11, 0.028],
      [0.78, 0.22, 0.04],
    ];
    for (const [cx, tall, hw] of towers) {
      h = carve(h, sdBox(u, v, cx, 0.4 + tall / 2, hw, tall / 2), 0.008, 0.38);
      /* 窗：每栋楼两行细小的横线 */
      for (let i = 1; i <= 2; i++) {
        h = carve(h, v - (0.4 + (tall * i) / 3), 0.004, 0.2);
      }
    }
    /* 东盟之环：远处一圈淡淡的合作意象 */
    h = carve(h, sdCircle(u, v, 0.5, 0.63, 0.26), 0.006, 0.18);
    return h;
  },
};

/* =========================================================
   生成一张贴图：高度场 → 法线（Sobel）+ 打包
========================================================= */
const STATIC_NOISE_SEED = [0.13, 3.7, 11.2, 5.5, 23.1];

export function buildOrbTextureData(worldId) {
  const motif = MOTIFS[worldId] || MOTIFS.foundation;
  const seed = STATIC_NOISE_SEED[Math.max(0, Object.keys(MOTIFS).indexOf(worldId))] || 0;

  /* ① 高度场 */
  const H = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const v = (y + 0.5) / SIZE;
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const h = stoneBase(u + seed, v) + motif(u, v);
      H[y * SIZE + x] = clamp(h, 0, 1.6);
    }
  }

  /* ② 高度 → 法线（中心差分，u 方向环绕，v 方向夹紧） */
  const data = new Uint8Array(SIZE * SIZE * 4);
  const strength = 2.35; // 抬升浮雕的可读性
  const at = (x, y) => H[clamp(y, 0, SIZE - 1) * SIZE + (((x % SIZE) + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dhdu = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const dhdv = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      let nx = -dhdu * strength * 42;
      let ny = -dhdv * strength * 42;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * SIZE + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
      data[i + 3] = Math.round(clamp(H[y * SIZE + x], 0, 1) * 255);
    }
  }
  return { data, size: SIZE };
}

/** 贴图只在第一次用到时生成，之后各世界共用 */
const cache = new Map();
export function getOrbTextureData(worldId) {
  if (!cache.has(worldId)) cache.set(worldId, buildOrbTextureData(worldId));
  return cache.get(worldId);
}

export const ORB_TEXTURE_SIZE = SIZE;
