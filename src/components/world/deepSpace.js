// src/components/world/deepSpace.js
//
// =========================================================
// ThaiAI Learning Universe · 深空渲染层
// =========================================================
//
// 这一层只做一件事：把「3D 太阳系」变成「一片深空」。
//
// 改造前的三个几何感元凶（都在视觉层，与业务无关）：
//   ① 中央一个 0.38 半径的实心球 + 两片 ringGeometry 平环 + 6 条放射翼
//      → 读起来是"页面中央放了一个 3D Logo"
//   ② 5 条完整 torusGeometry 椭圆（半径 2.15 起、等距 +0.52）
//      → 读起来是"太阳系轨道图"
//   ③ 每颗方向是一颗标准 sphereGeometry 行星 + 大气壳
//      → 读起来是"标准行星"
//
// 这一层提供的替代物：
//   createNebulaMaterial   —— 星域：billboard 星云片（fbm 噪声 + 径向衰减）
//   createCoreGlowMaterial —— 核心：极淡的暖金光团（不是一个实体）
//   createTraceMaterial    —— 轨迹：非连续、会淡出的弧片段
//   createBokehMaterial    —— 前景：大型虚焦尘埃（景深）
//
// 设计约束（来自产品要求）：
//   • 文字极少、无 HUD、无科技扫描线、无能量条
//   • 动画极慢（宇宙在呼吸，不是网页在放特效）
//   • 颜色克制：深空黑绿 + 暗金 + 暖象牙，金色只用于"当前"
//   • 所有 GLSL 数值安全：不用 pow(负数)、不用边界反序的 smoothstep

import * as THREE from "three";

/* =========================================================
   正确的加成混合（关键修正）
   ---------------------------------------------------------
   这些材质的片元输出是**预乘 alpha** 的（rgb 已经乘过 alpha），
   而 THREE.AdditiveBlending 的因子是 `SrcAlpha × src + dst` ——
   于是实际贡献变成 alpha²，星云再亮也几乎看不见
   （实测：把 opacity 提高 3 倍，画布亮度统计纹丝不动）。

   正确做法是纯加成：src + dst（因子都取 One）。
   ========================================================= */
const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  /*
   * alpha 通道不写入（保持画布清屏时的 0）。
   * ---------------------------------------------------------
   * WebGL 画布与页面按 premultiplied alpha 合成：
   *     out = canvas.rgb + 底层.rgb × (1 − canvas.a)
   * 只要 canvas.a 保持 0，3D 内容就是「纯加光」，底下的星空视频
   * 完整透出。早先把 alpha 一并累加进画布，结果视频被星域圆形
   * 范围内的累积 alpha 压暗 —— 截图里每片星域外那圈「黑色圆盘」
   * 就是它。因此着色器统一输出 alpha 0，由这里的混合因子保证
   * alpha 通道不被触碰。
   */
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

/**
 * 正常 alpha 合成（片元输出**预乘**：rgb 已经乘过 alpha → 因子取 One / 1-srcAlpha）。
 *
 * 为什么不能直接用 THREE.NormalBlending：它的 src 因子是 SrcAlpha，会把已经乘过
 * alpha 的 rgb 再乘一次 —— 和上面 ADDITIVE 踩的是同一个坑，只是没那么显眼。
 *
 * 用在哪：**纸张世界**。深空的「加光」逻辑在米白纸上等于把纸打亮，星点会彻底消失；
 * 纸上的星点必须**留白**（把纸的颜色盖掉），所以这里要的是"覆盖"而不是"叠加"。
 * 只有这里的 alpha 会真的写进画布（blendDstAlpha = 1）——纸是不透明的，
 * 不需要再让视频从底下透出来。
 */
const ALPHA_BLEND = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

/**
 * 相乘混合（纸上的「墨线」）。
 *
 * 纸世界里星图是**印上去**的：线必须比纸暗，而加成只会越叠越亮 ——
 * 金线叠在米白纸上直接消失。相乘则让线色成为"减光量"：
 * 古铜金 #8a6b28 × 米白 → 深橄榄金，正好是一笔画在纸上的效果。
 */
const MULTIPLY = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.ZeroFactor,
  blendDst: THREE.SrcColorFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

/* =========================================================
   视觉世界 → 星图氛围
   =========================================================
   为什么把颜色集中在这里，而不是在组件里写 if (world === ...)：
     · 星点的"底色"与"进度色温"必须来自**同一个来源**，否则纸世界的金色进度
       会叠在给纸准备的暗金星点上，两种金互相打架（实测同一片星域出现两层色相）；
     · 四个世界的差异是"一整套氛围"，散在组件里必然漏项 —— 例如只改了星点却
       忘了尘埃，深空尘埃落在米白纸上就成了一片脏灰。

   这里只有数据，没有逻辑；着色器读它，组件也读它。
   ========================================================= */

const sRGB = (hex) => new THREE.Color(hex);

/** 四个世界的视觉世界 id 与 worlds.js 的 visualMode 一一对应，拼错就静默回落到基准 */
export const GALAXY_MOOD_IDS = ["midnight", "paper", "forest", "modern"];

const MOOD_BASE = {
  ink: false,
  /** 星点的"留白/墨色"基调：深空透明到看不见，纸上是纸上留白，林间是林间空气 */
  starPalette: [
    sRGB("#89a6c8"),
    sRGB("#93b8a6"),
    sRGB("#d9cba6"),
    sRGB("#8fa2c4"),
    sRGB("#b9ae96"),
  ],
  constellationHue: null,
  defaultAccent: "#c9a44a",
  accentInkMix: 0,
  placeStar: 0,
  placeCore: 0.75,
  haloScale: 1,
  /*
   * 电影化调低（用户要求：减少几何 / 减少粒子 / 减少 Glow，增加空间与景深）
   * ---------------------------------------------------------
   * 上一版是「满」的：星场 1100 点、星座底盘 0.20、核心三层满亮、
   * 轨道 9 段、今日脉冲 3 圈、前景尘埃 26 颗 —— 屏幕上几乎没有暗处。
   * 深空摄影里真正的主角是**黑暗与负空间**，所有发光元素都只是点缀。
   */
  /*
   * 底盘透明度必须**补回来**：新实现按 alpha 与 fbm 形状累加光
   * （中心 falloff×shaped ≈ 0.5），而旧实现直接满色平铺。
   * 0.14 会让星座暗到分组不准（历史上用户报过两次"分开不明显"），
   * 0.26 只留淡淡一层气体 —— 既不像色块，也读得出五组区域。
   */
  haloOpacity: 0.26,
  /* 核心：更大更淡（远处的一颗恒星），而不是网页中央一个亮球 */
  coreScales: [2.2, 5.4, 12.5],
  coreWeights: [0.7, 0.34, 0.16],
  /*
   * 星场必须退成"远景噪声"（用户反馈：被星空挡住了）。
   * 两处一起收：点数 620 → 380，且加成世界的不透明度从 0.9 降到 0.5。
   * 星座星点与星场星点原本挤在同一个亮度区间，星座永远立不出来。
   */
  fieldCount: 380,
  fieldCountLow: 130,
  fieldSpread: 22,
  fieldSizeScale: 1,
  /* 星场不透明度：墨点世界（纸上）要实，加成世界要淡 */
  fieldOpacity: 0.5,
  orbitSegments: { active: 5, base: 3 },
  orbitOpacity: { veiled: 0.03, active: 0.13, base: 0.045, step: 0.004 },
  nebulaOpacity: 0.7,
  nebulaPalette: [
    [0.1, 0.17, 0.14],
    [0.07, 0.12, 0.16],
    [0.14, 0.11, 0.07],
    [0.06, 0.09, 0.12],
  ],
  /* 前景虚焦尘埃：少而大 = 更强的镜头感（数量本身就是噪点） */
  foreground: { color: "#cfd8e4", count: 16, opacityScale: 0.85, sizeScale: 1.2 },
  dust: { color: "heavy:#6a7a88|light:#9ab0c0", opacity: 0.9, sizeScale: 1 },
  /* 今日脉冲：一圈足矣，多圈会变成"特效" */
  pulse: { rings: 1, intensity: 0.7 },
  /** 星点材质：'add' 加成（深空）/ 'alpha' 覆盖（纸）/ 'ink' 墨点（纸，星场专用） */
  starFieldMode: "add",
  constellationBlend: "add",
  lineBlend: "add",
  /** 星座星点的光晕占比与形状：纸上是印上去的点，几乎不发光 */
  constellationBloom: 0.16,
  constellationHaloPow: 1.15,
  /* 墨色/覆盖模式下的"墨量"。加成模式下不用（乘上去会连深空一起变亮） */
  constellationInkGain: 1,
  fieldInkGain: 1,
  constellationLineOpacity: { veiled: 0.14, current: 0.6, base: 0.4 },
  /** 星座底盘（分组色块）的尺寸系数与基准透明度：纸上是"晕染的墨"，要更小更淡 */
  haloScale: 1,
  haloOpacity: 0.2,
  starCount: 0.62,
  /*
   * 星座星点尺寸。星场退成背景后，星座就是唯一的主体，
   * 1.2 让它在深空里读得出"一颗星"而不是"一个像素"（纸上另有 0.8/0.78 的覆盖值）。
   */
  particleScale: 1.2,
};

const MOOD_CONFIG = {
  /* Midnight · 深空（基准）—— 一个字都别改：上面所有默认值就是它的现状 */
  midnight: {},

  /* Paper · 纸上星图：不发光、不带加成；星点与连线都是"印上去的" */
  paper: {
    ink: true,
    starPalette: [
      sRGB("#fffdf6"),
      sRGB("#fffbef"),
      sRGB("#fdf6e6"),
      sRGB("#fbf3e2"),
      sRGB("#fdf8ec"),
    ],
    constellationHue: {
      foundation: "#39332a",
      speaking: "#2f4150",
      culture: "#8a6b28",
      media: "#243244",
      professional: "#4c4634",
    },
    defaultAccent: "#8a6b28",
    accentInkMix: 0.55,
    placeStar: 0.5,
    placeCore: 0.55,
    nebulaOpacity: 0.42,
    nebulaPalette: [
      [0.36, 0.32, 0.24],
      [0.3, 0.29, 0.3],
      [0.4, 0.36, 0.26],
      [0.28, 0.27, 0.28],
    ],
    foreground: { color: "#b9a271", count: 12, opacityScale: 0.45, sizeScale: 0.7 },
    dust: { color: "heavy:#4a4235|light:#6b6151", opacity: 0.85, sizeScale: 0.9 },
    pulse: { rings: 1, intensity: 0.85 },
    starFieldMode: "ink",
    constellationBlend: "alpha",
    lineBlend: "multiply",
    constellationBloom: 0.08,
    constellationHaloPow: 3.6,
    /* 纸上的点必须**是**一个点：tint 落在 0.25~0.35 的线性值上，
       不抬一档就只能得到浅浅的灰印，星图读不出"经纬分明的点"。 */
    constellationInkGain: 1.6,
    fieldInkGain: 1.6,
    constellationLineOpacity: { veiled: 0.16, current: 0.55, base: 0.34 },
    starCount: 0.72,
    particleScale: 0.8,
    haloScale: 1,
    haloOpacity: 0.09,
    coreScales: [2.2, 4.6, 9.0],
    coreWeights: [0.9, 0.5, 0.26],
    fieldCount: 780,
    fieldCountLow: 300,
    fieldSpread: 20,
    fieldSizeScale: 0.8,
    orbitSegments: { active: 7, base: 4 },
    orbitOpacity: { veiled: 0.05, active: 0.22, base: 0.09, step: 0.006 },
  },

  /* Forest · 林间夜色：星点变小变暗、加一层很轻的雾（低对比） */
  forest: {
    starPalette: [
      sRGB("#cfe6c4"),
      sRGB("#bcd6cf"),
      sRGB("#e3d8b4"),
      sRGB("#b9d0c2"),
      sRGB("#d6cfae"),
    ],
    constellationHue: {
      foundation: "#5a9e6a",
      speaking: "#3f9a94",
      culture: "#b3a05e",
      media: "#4a7c6a",
      professional: "#c2bfa2",
    },
    nebulaOpacity: 0.8,
    nebulaPalette: [
      [0.09, 0.16, 0.12],
      [0.07, 0.13, 0.13],
      [0.12, 0.12, 0.08],
      [0.06, 0.1, 0.09],
    ],
    foreground: { color: "#cfe3d4", count: 20, opacityScale: 0.7, sizeScale: 1 },
    dust: { color: "heavy:#6d8474|light:#9db4a4", opacity: 0.9, sizeScale: 1 },
    constellationBloom: 0.24,
    constellationHaloPow: 1.3,
    starCount: 0.58,
    particleScale: 0.92,
    haloScale: 1.05,
    haloOpacity: 0.17,
    fieldCount: 1000,
    fieldSizeScale: 0.92,
    orbitOpacity: { veiled: 0.04, active: 0.16, base: 0.06, step: 0.005 },
  },

  /* Modern · 数据星图：更小更准的星点、更细的线、更少的装饰 */
  modern: {
    starPalette: [
      sRGB("#cfe6dc"),
      sRGB("#dcdfe4"),
      sRGB("#e6dcc2"),
      sRGB("#c9d6e0"),
      sRGB("#d8dae0"),
    ],
    constellationHue: {
      foundation: "#3fae8a",
      speaking: "#35a8b8",
      culture: "#d8b45e",
      media: "#5f8fd8",
      professional: "#b8c2cc",
    },
    accentInkMix: 0.22,
    starCount: 0.5,
    particleScale: 0.78,
    haloScale: 0.6,
    haloOpacity: 0.12,
    coreScales: [2.0, 4.2, 8.0],
    coreWeights: [1, 0.5, 0.2],
    fieldCount: 900,
    fieldCountLow: 320,
    fieldSizeScale: 0.78,
    orbitSegments: { active: 6, base: 3 },
    orbitOpacity: { veiled: 0.05, active: 0.16, base: 0.06, step: 0.004 },
    nebulaOpacity: 0.45,
    foreground: { color: "#dbe6f0", count: 10, opacityScale: 0.5, sizeScale: 0.75 },
    dust: { color: "heavy:#5f6b78|light:#8b98a6", opacity: 0.75, sizeScale: 0.85 },
    constellationBloom: 0.2,
    constellationHaloPow: 4.0,
    constellationLineOpacity: { veiled: 0.12, current: 0.45, base: 0.26 },
  },
};

const MOOD_CACHE = new Map();

/**
 * 解析一个世界 id → 星图氛围对象。
 * 返回的对象是**冻结**的：组件把它当只读配置用，任何一处就地修改都会污染
 * 其他实例（同一份缓存被整棵 3D 树共享）。
 */
export function resolveGalaxyMood(visualMode) {
  const id = MOOD_CONFIG[visualMode] ? visualMode : "midnight";
  const cached = MOOD_CACHE.get(id);
  if (cached) return cached;

  const cfg = MOOD_CONFIG[id];
  const mood = { ...MOOD_BASE, ...cfg };
  mood.id = id;
  mood.dust = { ...MOOD_BASE.dust, ...(cfg.dust || {}) };
  mood.foreground = { ...MOOD_BASE.foreground, ...(cfg.foreground || {}) };
  mood.pulse = { ...MOOD_BASE.pulse, ...(cfg.pulse || {}) };
  mood.orbitSegments = { ...MOOD_BASE.orbitSegments, ...(cfg.orbitSegments || {}) };
  mood.orbitOpacity = { ...MOOD_BASE.orbitOpacity, ...(cfg.orbitOpacity || {}) };
  mood.constellationLineOpacity = {
    ...MOOD_BASE.constellationLineOpacity,
    ...(cfg.constellationLineOpacity || {}),
  };
  /* 尘埃的 heavy/light 两色打包成一行字符串，拆开放在这里 */
  const [heavy, light] = mood.dust.color.split("|");
  mood.dustColorHeavy = heavy.replace("heavy:", "");
  mood.dustColorLight = light.replace("light:", "");

  MOOD_CACHE.set(id, Object.freeze(mood));
  return mood;
}

/* =========================================================
   星场材质（按世界的星点基调重新着色）
   ---------------------------------------------------------
   取代 planetShading 里那份只服务深空的星场材质，解决两个硬问题：
     ① 加成 → 纸上的星点直接消失（白 + 米白 = 米白）；
     ② 每颗星的颜色必须**按世界重新指定**，不能只换一个色调 ——
        夜空的冷白/暖黄映到纸上就是一片惨白，得换成米白与墨点。
   ========================================================= */

/* 墨点片元：纸世界专用。
   · 深色墨：alpha 控制墨量，越大越实 → 印刷/手绘星图的点；
   · 浅色星（米白）：加成模式下压暗的 alpha 会被还原（÷0.72），
     叠加到纸上就是"留白" —— 纸上的星图两种点（墨点 + 留白）都成立。 */
const GLSL_PALETTE_STAR_INK = `
uniform float uOpacity;
uniform float uScale;
uniform vec3  uStarPalette[5];
uniform float uInk;
uniform float uInkGain;
uniform float uHalo;
uniform float uBloom;
varying float vStarBrightness;
varying float vStarSize;
varying float vStarTint;
varying vec3  vStarColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  int idx = int(clamp(floor(vStarTint * 4.999), 0.0, 4.0));
  vec3 palette = uStarPalette[0];
  for (int i = 1; i < 5; i++) {
    if (i <= idx) palette = uStarPalette[i];
  }

  float core = smoothstep(0.5, 0.0, d);
  float halo = pow(core, uHalo);
  float alpha = (core + halo * uBloom) * vStarBrightness * uOpacity;

  /* uInk ≈ 1：不透明的"墨/留白"星点，盖掉底下的纸；
     uInk ≈ 0：加成，回到深空——在整屏网格里改分支不影响性能。 */
  vec3 col = mix(vStarColor, palette, uInk);
  /* 同星座星点：墨量增益只作用于覆盖模式，加成的深空保持原样 */
  col *= 1.0 + (uInkGain - 1.0) * uInk;
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * 星场材质（世界感知版）。
 *
 * @param {object} mood resolveGalaxyMood() 的结果
 * @param {number} pixelRatio 画布像素比（低配设备会给 1）
 */
export function createPaletteStarFieldMaterial(mood, { pixelRatio = 2 } = {}) {
  const ink = mood.starFieldMode === "ink";

  return new THREE.ShaderMaterial({
    uniforms: {
      /*
       * 不透明度按世界取：深空 0.5（星场是背景），纸上 0.9（墨点要印得出来）。
       */
      uOpacity: { value: ink ? 0.9 : mood.fieldOpacity ?? 0.5 },
      /*
       * 像素比封顶 1.5：
       * 原来 uScale 直接乘 pixelRatio，Retina（dpr=2~3）上每颗星被放大 2~3 倍，
       * 星场从"背景"变成"满天大点"，正是"被星空挡住"的直接原因。
       */
      uScale: { value: (mood.fieldSizeScale || 1) * Math.min(pixelRatio, 1.5) },
      uInk: { value: ink ? 1 : 0 },
      uInkGain: { value: mood.fieldInkGain ?? 1 },
      uHalo: { value: ink ? 2.2 : 2.6 },
      uBloom: { value: mood.constellationBloom ?? 0.28 },
      uStarPalette: { value: mood.starPalette.map((c) => c.clone()) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aBrightness;
      uniform float uScale;
      varying float vStarBrightness;
      varying float vStarSize;
      varying float vStarTint;
      varying vec3 vStarColor;

      void main() {
        vStarBrightness = aBrightness;
        vStarSize = aSize;
        vStarColor = aColor;
        /* 色相索引复用 aColor：几何体那边已经按色温调过色，这里只要一个稳定的 0~1 */
        vStarTint = fract((aColor.r * 7.3 + aColor.g * 3.1) * 3.7);

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, aSize * uScale * (28.0 / max(0.001, -mv.z)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: GLSL_PALETTE_STAR_INK,
    ...(ink ? ALPHA_BLEND : ADDITIVE),
  });
}

/** 世界 → 混合配置。颜色/形状之外，**混合方式本身也是氛围的一部分**（见 ALPHA_BLEND 注释） */
export function moodBlend(mode = "add") {
  if (mode === "alpha") return ALPHA_BLEND;
  if (mode === "multiply") return MULTIPLY;
  return ADDITIVE;
}

/**
 * 把星域色往"这个世界的星点基调"上靠。
 *
 * 为什么需要它：方向色是**按深空黑底**挑的（绿 0.47 / 金 0.57 / 紫 0.29）。
 * 同一组色放到米白纸上，亮的那几个直接过曝成白斑、暗的仍然消失 ——
 * 纸世界的星图必须自己给一套"墨色"（见 constellationHue），
 * 这里只负责把主题 accent 这种外部颜色也拉进同一套色阶。
 */
export function moodAccent(color, mood, mix = null) {
  if (!color || !mood) return color;
  const amount = mix === null ? mood.accentInkMix || 0 : mix;
  if (!amount) return color;
  const anchor = new THREE.Color(mood.constellationHue?.culture || mood.defaultAccent);
  return color.clone().lerp(anchor, amount);
}

/* ── 公共 GLSL：哈希 + fbm（与 planetShading 同一套，避免两种噪声风格） ── */
const GLSL_NOISE = `
float ds_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ds_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ds_hash(i + vec3(0,0,0)), ds_hash(i + vec3(1,0,0)), f.x),
        mix(ds_hash(i + vec3(0,1,0)), ds_hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(ds_hash(i + vec3(0,0,1)), ds_hash(i + vec3(1,0,1)), f.x),
        mix(ds_hash(i + vec3(0,1,1)), ds_hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
/* 5 octave：星云需要更细的絮状结构，4 octave 会显得"糊" */
float ds_fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * ds_noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
`;

/* =========================================================
   星域 · billboard 星云
   ---------------------------------------------------------
   一颗"学习方向"不再是一颗球，而是一片**星域**：
   絮状星云 + 一个极淡的核心亮点。远处看是光团，不是几何体。
========================================================= */

export function createNebulaMaterial({
  color = new THREE.Color("#3a8c5e"),
  seed = 0,
  opacity = 0.34,
  /* 星云的疏密：越小越像"稀薄气体"，越大越像"实体" */
  density = 1.15,
  /* 动画速度：必须极慢 */
  driftSpeed = 0.006,
  /*
   * 亮度增益。
   * ---------------------------------------------------------
   * 纯加成混合下，星云最终贡献 = col × alpha，而实测 alpha 只有 ~0.04
   * （fbm 均值 0.48 × 径向衰减 0.25 × opacity 0.62 × 权重 0.58），
   * 贡献落在 (2,5,4)/255 —— 肉眼完全看不见（画布实测只有 1 个亮团）。
   * 所以必须显式放大，不能靠"调 opacity"试参数。
   *
   * ⚠️ 这个默认值只是兜底。真正该用的是 `balancedGain()`：
   * 五个星域的源色亮度差近 2 倍（绿 0.47 / 蓝 0.30），
   * 同一增益下会"绿的刺眼、蓝紫看不见"。
   */
  gain = 8,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uSeed: { value: seed },
      uOpacity: { value: opacity },
      uDensity: { value: density },
      uTime: { value: 0 },
      uDrift: { value: driftSpeed },
      /* 被"吹散"程度：今日练过的星域星尘会被吹开一点 */
      uCleared: { value: 0 },
      uGain: { value: gain },
      /* 视觉权重：当前聚焦的星域 = 1，其余 < 1（产品逻辑：当前学习位置是焦点） */
      uWeight: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uSeed;
      uniform float uOpacity;
      uniform float uDensity;
      uniform float uTime;
      uniform float uDrift;
      uniform float uCleared;
      uniform float uWeight;
      uniform float uGain;
      varying vec2 vUv;

      ${GLSL_NOISE}

      void main() {
        /* 以中心为原点 */
        vec2 p = vUv - vec2(0.5);

        /* 圆形本体：超出半径直接丢弃（星域是有限的一片，不是整张方片） */
        float r = length(p) * 2.0;
        if (r > 1.0) discard;

        /* 径向衰减：中心浓、边缘稀薄 —— 这是"气体"而不是"圆盘"的关键 */
        float falloff = 1.0 - r;
        falloff = falloff * falloff;

        /* fbm 絮状结构：两层不同尺度叠加，避免规则感 */
        vec3 q1 = vec3(p * 3.1 * uDensity, uSeed + uTime * uDrift);
        vec3 q2 = vec3(p * 7.4 * uDensity, uSeed * 1.7 - uTime * uDrift * 0.6);
        float clumps = ds_fbm(q1) * 0.68 + ds_fbm(q2) * 0.32;

        /* 把絮状结构"推"出对比：低于阈值的掏空，星云才有裂缝。
           阈值经实测标定：fbm 的均值约 0.48，用 (0.34, 0.86) 只能给到 0.19，
           再乘不透明度后肉眼几乎不可见（画布实测 99% 全暗）。 */
        float body = smoothstep(0.26, 0.72, clumps);
        float alpha = body * falloff * uOpacity * uWeight;

        /* 被吹散：中间变薄，边缘散开（今日练过的星域） */
        alpha *= mix(1.0, 0.55 + r * 0.5, uCleared);

        /* 冷区/暖区：内侧偏暖（靠近核心），外侧偏冷 */
        float warmth = smoothstep(0.8, 0.0, r);
        vec3 col = mix(uColor * 0.85, uColor * 1.55 + vec3(0.14, 0.10, 0.03), warmth);

        /* 纯加成（blendSrc/Dst 都是 One），alpha 写 0：
           星域是「叠在视频上的光」，不是「挡在视频前的圆盘」。
           alpha 通道由 ADDITIVE 的 blendSrcAlpha=Zero 保证不被写入。 */
        vec3 outCol = col * alpha * uGain;
        gl_FragColor = vec4(outCol, 0.0);
      }
    `,
    ...ADDITIVE,
    side: THREE.DoubleSide,
  });
}

/* =========================================================
   核心 · 极淡的暖金光团
   ---------------------------------------------------------
   中央不再是一个实体球，而是"银河的引力中心"：
   一个几乎看不见的亮点 + 很大范围的柔和光晕。
========================================================= */

export function createCoreGlowMaterial({
  color = new THREE.Color("#e8c88a"),
  intensity = 1,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float r = length(vUv - vec2(0.5)) * 2.0;
        if (r > 1.0) discard;

        /* 三层叠加：
           ① 极小的实心核（几乎看不见，但有"存在感"）
           ② 柔和的中间晕
           ③ 很大范围的稀薄外晕 */
        float core = pow(max(0.0, 1.0 - r / 0.08), 2.0);
        float mid  = pow(max(0.0, 1.0 - r / 0.38), 2.4);
        float halo = pow(max(0.0, 1.0 - r), 3.2);

        /* 呼吸：极慢，幅度极小（"宇宙在呼吸"） */
        float breathe = 1.0 + sin(uTime * 0.22) * 0.06;

        float a = (core * 0.9 + mid * 0.30 + halo * 0.14) * uIntensity * breathe;
        vec3 outCol = uColor * a;
        gl_FragColor = vec4(outCol, 0.0);
      }
    `,
    ...ADDITIVE,
    side: THREE.DoubleSide,
  });
}

/* =========================================================
   轨迹 · 非连续弧片段
   ---------------------------------------------------------
   删除完整椭圆。只保留几段"光线残影"，暗示空间关系即可。
   用 LineSegments + 逐顶点 alpha：每段自带淡入淡出，看上去是断续的。
========================================================= */

/**
 * 生成一圈弧片段（在 XZ 平面上，带轻微倾斜）。
 *
 * @param {number} radius 弧的半径
 * @param {object} options
 *   segments  弧段数（每段是独立的一段，不连成整圈）
 *   arcSpan   每段弧占整圈的比例（0~1），要小，才能"断"
 *   tilt      倾斜角（弧度）
 *   color     颜色
 *   opacity   不透明度
 *   seed      随机种子（决定每段的位置）
 */
export function createTraceArc(radius, {
  segments = 7,
  arcSpan = 0.16,
  tilt = 0,
  color = new THREE.Color("#6a8aaa"),
  opacity = 0.16,
  seed = 1,
} = {}) {
  const positions = [];
  const alphas = [];

  let s = seed * 9973;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  const stepsPerArc = 14;

  for (let a = 0; a < segments; a += 1) {
    /* 每段弧的起始角随机，但整体均匀分布（避免聚成一堆） */
    const base = (a / segments) * Math.PI * 2 + rand() * 0.5;
    const span = arcSpan * (0.6 + rand() * 0.8);

    for (let i = 0; i < stepsPerArc; i += 1) {
      const t0 = i / stepsPerArc;
      const t1 = (i + 1) / stepsPerArc;

      const a0 = base + span * t0 * Math.PI * 2;
      const a1 = base + span * t1 * Math.PI * 2;

      const y0 = Math.sin(a0 * 2.0) * radius * 0.06;
      const y1 = Math.sin(a1 * 2.0) * radius * 0.06;

      positions.push(
        Math.cos(a0) * radius, y0, Math.sin(a0) * radius,
        Math.cos(a1) * radius, y1, Math.sin(a1) * radius
      );

      /* 逐顶点 alpha：段的两端淡出 → 视觉上"这条轨迹若隐若现" */
      const fade0 = Math.sin(t0 * Math.PI);
      const fade1 = Math.sin(t1 * Math.PI);
      alphas.push(fade0, fade0, fade1, fade1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: opacity },
      uWeight: { value: 1 },
      /* 电影雾：远处的轨迹融进黑暗，不再飘在空中 */
      uFogNear: { value: 6.5 },
      uFogFar: { value: 16.0 },
      uFogMin: { value: 0.18 },
    },
    vertexShader: `
      attribute float aAlpha;
      uniform float uFogNear;
      uniform float uFogFar;
      varying float vAlpha;
      varying float vFog;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        /* 0 = 近，1 = 远（融进黑暗） */
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uOpacity;
      uniform float uWeight;
      uniform float uFogMin;
      varying float vAlpha;
      varying float vFog;
      void main() {
        float a = vAlpha * uOpacity * uWeight;
        a *= mix(uFogMin, 1.0, 1.0 - vFog);
        vec3 outCol = uColor * a;
        gl_FragColor = vec4(outCol, 0.0);
      }
    `,
    ...ADDITIVE,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.rotation.x = tilt;
  return lines;
}

/* =========================================================
   前景尘埃 · 大型虚焦光点（景深）
   ---------------------------------------------------------
   真实深空摄影的近景：几颗大而模糊的光斑从画面前方缓慢飘过。
   这一层是"电影感"的关键 —— 它给画面一个**镜头位置**，
   而不是让人站在真空里看模型。
========================================================= */

export function createBokehDust(count = 26, {
  spread = 9,
  near = 2.6,
  seed = 31,
  color = new THREE.Color("#cfd8e4"),
  /* 世界的调节量：林间雾更淡、纸上只剩几点墨、现代几乎不要装饰 */
  opacityScale = 1,
  sizeScale = 1,
  blend = "add",
} = {}) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  for (let i = 0; i < count; i += 1) {
    /* 集中在相机附近，但不至于挡在星球前面 —— 靠得很近、放得很偏 */
    const theta = rand() * Math.PI * 2;
    const r = near + rand() * spread;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = (rand() - 0.5) * spread * 0.8;
    positions[i * 3 + 2] = Math.sin(theta) * r;

    /* 大小差异大：有的只是一个小点，有的是一大团虚焦 */
    sizes[i] = (2.0 + Math.pow(rand(), 1.8) * 9.0) * sizeScale;
    alphas[i] = (0.05 + rand() * 0.11) * opacityScale;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uTime: { value: 0 },
      /* 画布像素比：点精灵尺寸要跟随，否则高 DPI 下会变小 */
      uPixelRatio: { value: 1 },
      uInk: { value: blend === "alpha" ? 1 : 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (42.0 / max(0.001, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uInk;
      varying float vAlpha;
      void main() {
        /* 虚焦光斑：圆形 + 极软边缘（模拟失焦的圆形光阑） */
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float soft = pow(max(0.0, 1.0 - d), 2.6);
        float rim = smoothstep(0.55, 1.0, d) * 0.25;
        float a = (soft + rim) * vAlpha;
        vec3 outCol = uColor * a;
        /* 深空：加光，alpha 写 0（前景尘埃不该压暗底下的视频）。
           纸世界：光斑换成**墨点**，必须是不透明覆盖才看得见 ——
           虚焦的墨在纸上本来也就是几个糊开的小点，观感反而更对。 */
        gl_FragColor = vec4(outCol, mix(0.0, a, uInk));
      }
    `,
    ...moodBlend(blend),
    depthTest: false,
  });

  const points = new THREE.Points(geometry, material);
  /* 前景永远最后画，压在一切之上 */
  points.renderOrder = 1000;
  return points;
}

/* =========================================================
   星域内的星尘环 · 替代"行星的光环"
   ---------------------------------------------------------
   原来每个方向外面套一个 ringGeometry 平环（很"几何"）。
   改成**沿环分布的稀疏星尘**：只有点，没有面。
========================================================= */

export function createDustRing(count = 220, {
  inner = 1.0,
  outer = 1.35,
  flatness = 0.22,
  color = new THREE.Color("#cbd5e1"),
  opacity = 0.5,
  seed = 5,
} = {}) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const r = inner + rand() * (outer - inner);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (rand() - 0.5) * flatness * r;
    positions[i * 3 + 2] = Math.sin(angle) * r;

    sizes[i] = 0.5 + Math.pow(rand(), 2.2) * 2.0;
    alphas[i] = opacity * (0.25 + Math.pow(rand(), 2.4) * 0.75);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uPixelRatio: { value: 1 },
      uWeight: { value: 1 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (30.0 / max(0.001, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uWeight;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float a = pow(max(0.0, 1.0 - d), 1.8) * vAlpha * uWeight;
        vec3 outCol = uColor * a;
        gl_FragColor = vec4(outCol, 0.0);
      }
    `,
    ...ADDITIVE,
  });

  return new THREE.Points(geometry, material);
}

/* =========================================================
   景深近似：按距离衰减不透明度与尺度
   ---------------------------------------------------------
   真实景深需要后处理；这里用"距离权重"近似 ——
   远处的星域更小更暗，当前聚焦的更亮更实。
   成本极低，但对"空间层次"的观感贡献很大。
========================================================= */

export function depthWeight(distance, {
  near = 4,
  far = 14,
  minWeight = 0.28,
} = {}) {
  const t = (distance - near) / Math.max(0.001, far - near);
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - clamped * (1 - minWeight);
}

/* =========================================================
   亮度归一化
   ---------------------------------------------------------
   问题：五个学习星域用的是各自的品牌色，但**颜色的相对亮度差近 2 倍**：
     foundation #3a8c5e 绿   → 0.47
     speaking   #3a9e9e 青   → 0.54
     culture    #b8922e 金   → 0.57
     media      #2a5090 深蓝 → 0.30
     professional #5a4080 紫 → 0.29
   在纯加成混合下（贡献 = col × alpha × gain），这个差距会被原样放大，
   结果就是用户反馈的「浅绿色太亮，其他太淡」。

   这里按颜色亮度反比补偿：暗色给更高增益、亮色给更低增益，
   使五个星域在屏幕上**感知亮度接近**，只由 uWeight 决定焦点强弱。
   ========================================================= */

/** 颜色相对亮度（0~1，Rec.709） */
export function relativeLuminance(color) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * 按颜色亮度归一化的增益。
 *
 * @param {THREE.Color} color     星域的源色
 * @param {number} target         目标感知亮度（对应"满权重"时的效果）
 * @param {object} bounds         { min, max } 限幅，避免暗色被过度放大而失真
 */
export function balancedGain(color, target = 1.2, { min = 6, max = 24 } = {}) {
  /* 兼容旧调用：直接给增益。新代码请用 balancedColor + 单一 gain。 */
  const lum = Math.max(0.01, relativeLuminance(color));
  const raw = target / Math.pow(lum, 0.55);
  return Math.min(max, Math.max(min, raw));
}

/**
 * 把星域颜色归一化到**统一的光能量**，只保留色相与饱和度。
 * =========================================================
 * 为什么不在增益上补偿：
 *   THREE.Color 会把 sRGB 转成线性空间，五个星域的线性亮度实际是
 *     foundation 0.205 / speaking 0.278 / culture 0.309
 *     media 0.082 / professional 0.074
 *   相差 **4 倍**。若用指数补偿增益，需要的倍率高达 30 倍，一放就撞上限幅 ——
 *   实测五个增益里有三个被夹到 max，归一化完全失效
 *   （用户反馈"浅绿色太亮，其他太淡"就是这个失效的表现）。
 *
 * 改为直接缩放颜色本身：每个星域发出相同的光能量，色相不变。
 * 这样五个星域在加成混合下的**贡献量级一致**，强弱只由 uWeight（焦点）决定。
 *
 * @param {THREE.Color} color  线性空间的颜色（THREE.Color 已转好）
 * @param {number} targetLum   目标线性亮度
 * @param {object} hueTweak    { green: number, blue: number }
 *        深色场景里人眼对绿/青更敏感（浦肯野效应），所以绿系再压一点、
 *        蓝紫系再抬一点。**这两个数字是唯一需要按肉眼微调的地方。**
 */
export function balancedColor(color, targetLum = 0.20, hueTweak = { green: 0.86, blue: 1.10 }) {
  const lum = relativeLuminance(color);
  const safe = Math.max(0.01, lum);
  const scale = targetLum / safe;

  const out = color.clone().multiplyScalar(scale);

  /* 按色相微调（线性空间下的色相判断用 >/>= 比较即可，不需要归一化） */
  const isGreenish = out.g >= out.r && out.g >= out.b * 0.9;
  const isBluish = out.b >= out.r && out.b >= out.g;

  if (isGreenish) out.multiplyScalar(hueTweak.green);
  else if (isBluish) out.multiplyScalar(hueTweak.blue);

  /* 防止某个通道爆掉（加成混合下过亮会糊成白） */
  const peak = Math.max(out.r, out.g, out.b);
  if (peak > 0.85) out.multiplyScalar(0.85 / peak);

  return out;
}

/* =========================================================
   星座层 · Constellation
   =========================================================
   这一节把「学习方向 = 一颗行星」改成「学习方向 = 一个星座」。

   设计约束（来自产品要求）：
     · 星星必须来自**真实学习内容**（stage = 学习单元），不是装饰点
     · 形状要自然、不对称、有疏密 —— 不能是规则几何
     · 连接线只暗示关系，不能成为视觉主体
     · 状态 → 星光亮度：完成=稳定暖白，进行中=轻呼吸，当前=最亮，未开始=很暗
   ========================================================= */

/** 稳定伪随机（同一 seed 永远同一形状，重渲染不会让星座跳来跳去） */
function seededRandom(seed) {
  let s = Math.max(1, Math.floor(seed * 1000) % 2147483647);
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * 生成一个星座的局部星位。
 *
 * 用「带阻尼的随机游走」而不是圆/网格：每颗星相对前一颗的方向与步长
 * 都带抖动，所以形状是不规则、不对称的 —— 像真实星座，而不是几何图形。
 *
 * @param {number} count 星星数量（= 该方向的真实 stage 数）
 * @param {number} seed  方向 id 派生的种子
 * @param {number} spread 整体尺度
 * @returns {Array<{x:number,y:number,z:number}>} 相对星座中心的偏移
 */
export function constellationLayout(count, seed = 1, spread = 1) {
  const rand = seededRandom(seed);
  const points = [];

  /* 起始方向随机，避免五个星座长的都一样 */
  let angle = rand() * Math.PI * 2;
  let x = 0;
  let y = 0;
  let z = 0;

  for (let i = 0; i < Math.max(1, count); i += 1) {
    /* 方向抖动 ±55°：既有主走向，又不呆板 */
    angle += (rand() - 0.5) * 1.9;
    /* 步长抖动：产生疏密变化 */
    const step = spread * (0.42 + rand() * 0.72);

    x += Math.cos(angle) * step;
    y += (rand() - 0.5) * step * 0.5;
    z += Math.sin(angle) * step;

    points.push({ x, y, z });
  }

  /* 居中：让星座以方向中心为重心，而不是从中心向外散 */
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;

  return points.map((p) => ({ x: p.x - cx, y: p.y - cy, z: p.z - cz }));
}

/**
 * 星座星点材质。
 *
 * 每颗星有独立的大小与亮度：
 *   aGlow  —— 亮度权重（由学习状态决定：完成/当前/进行中/未开始）
 *   aSize  —— 星点大小（当前学习的那颗最大）
 *   aTint  —— 色温：暖白 / 象牙 / 暗金（不做彩虹）
 */
export function createConstellationStars(count, {
  pixelRatio = 1,
  mood = null,
} = {}) {
  const m = mood || resolveGalaxyMood("midnight");
  const ink = m.constellationBlend === "alpha";
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aGlow", new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aTint", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uTime: { value: 0 },
      /* 呼吸：只有"当前学习"的星会用到 */
      uPulseIndex: { value: -1 },
      uPulseAmount: { value: 0 },
      /* 焦点权重：当前选中的星座整体更亮 */
      uWeight: { value: m.constellationBlend === "alpha" ? 1.25 : 1 },
      /* 光晕占比与形状：深空是一团发光的星，纸上是一个印上去的点 */
      uBloom: { value: m.constellationBloom },
      uHaloPow: { value: m.constellationHaloPow },
      uInk: { value: ink ? 1 : 0 },
      uGain: { value: m.constellationInkGain ?? 1 },
      uScale: { value: m.particleScale || 1 },
    },
    vertexShader: `
      attribute float aGlow;
      attribute float aSize;
      attribute vec3  aTint;
      uniform float uPixelRatio;
      uniform float uPulseIndex;
      uniform float uPulseAmount;
      uniform float uWeight;
      uniform float uScale;
      varying float vGlow;
      varying vec3  vTint;

      void main() {
        /* 用 position 的哈希近似"第几颗"，避免额外属性；
           这里改为直接比较 gl_VertexID 不可用，所以用 aSize 作为索引代理 */
        vGlow = aGlow * uWeight;
        vTint = aTint;

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float size = aSize * uScale * uPixelRatio * (30.0 / max(0.001, -mv.z));
        gl_PointSize = max(1.0, size);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uInk;
      uniform float uBloom;
      uniform float uHaloPow;
      uniform float uGain;
      varying float vGlow;
      varying vec3  vTint;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        /* 中心实、边缘散：一颗星该有的样子（不是圆点）。
           纸世界把光晕压到 8%、并把中心收得更紧 —— 印出来的点不该发光。 */
        float core = pow(max(0.0, 1.0 - d), uHaloPow);
        float halo = pow(max(0.0, 1.0 - d), 1.15) * uBloom;
        float a = (core + halo) * vGlow;
        if (a <= 0.001) discard;
        /* 深空：纯加光，alpha 写 0（星点密集处否则会把星空视频压出黑盘）。
           纸上：正常 alpha 合成，rgb 预乘（×a），颜色就是"墨"本身 ——
           加光叠在米白纸上等于没有，这是纸世界星点必须换混合方式的原因。 */
        float outA = mix(0.0, a, uInk);
        /* uGain 只在覆盖模式抬色：纸上把 vTint 抬一档才够"实"，
           深空不能抬（乘上去整片星域会过曝）。 */
        gl_FragColor = vec4(vTint * a * (1.0 + (uGain - 1.0) * uInk), outA);
      }
    `,
    transparent: true,
    depthWrite: false,
    ...moodBlend(m.constellationBlend),
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/**
 * 星座连线：极细、断续、低透明度。
 *
 * 只在**相邻两颗星之间**画一小段（不是连满），并且两端淡出 ——
 * 看上去是"若隐若现的星路"，而不是几何连线。
 */
export function createConstellationLines(points, {
  color = new THREE.Color("#cbd5e1"),
  opacity = 0.14,
  /** 每段只画中间的比例（<1 才"断"） */
  drawRatio = 0.72,
  gapRatio = 0.5,
  mood = null,
} = {}) {
  const m = mood || resolveGalaxyMood("midnight");
  const positions = [];
  const alphas = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segs = 8;

    for (let s = 0; s < segs; s += 1) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      /* 掐头去尾：段与段之间留空隙 → 断续感 */
      if (t0 < gapRatio * 0.5 || t1 > 1 - gapRatio * 0.5) continue;

      const p0 = {
        x: a.x + (b.x - a.x) * t0,
        y: a.y + (b.y - a.y) * t0,
        z: a.z + (b.z - a.z) * t0,
      };
      const p1 = {
        x: a.x + (b.x - a.x) * t1,
        y: a.y + (b.y - a.y) * t1,
        z: a.z + (b.z - a.z) * t1,
      };

      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      /* 两端淡出：线越靠两端越透明 */
      const f0 = Math.sin(Math.min(1, t0 / drawRatio) * Math.PI);
      const f1 = Math.sin(Math.min(1, t1 / drawRatio) * Math.PI);
      alphas.push(f0, f0, f1, f1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: opacity },
      uWeight: { value: 1 },
      uInk: { value: m.lineBlend === "multiply" ? 1 : 0 },
    },
    vertexShader: `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uOpacity;
      uniform float uWeight;
      uniform float uInk;
      varying float vAlpha;
      void main() {
        float a = vAlpha * uOpacity * uWeight;
        if (a <= 0.001) discard;
        /* 深空：纯加光，alpha 写 0（不向画布 alpha 累积，视频才透得出来）。
           纸上：相乘混合。乘法没有"逐顶点 alpha"可用（因子是常量 blendColor），
           所以把强度折进颜色：s = mix(白, 墨, a) ——
           全白相乘等于没画，于是断续淡出依然成立，而线越强越吸光。 */
        vec3 ink = mix(vec3(1.0), uColor * min(1.0, a * 2.0), uInk);
        gl_FragColor = vec4(ink, mix(0.0, a, uInk));
      }
    `,
    transparent: true,
    depthWrite: false,
    ...moodBlend(m.lineBlend),
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

/**
 * 学习状态 → 星光参数。
 *
 * 这条映射是整张星图的"语义核心"：用户不看数字也能从星光读出进度。
 *   done      完成   → 稳定、清晰、暖象牙
 *   current   当前   → 全图最亮 + 轻呼吸
 *   active    进行中 → 中等偏亮
 *   ahead     未开始 → 很暗
 *   uncharted 未勘测 → 几乎融入背景
 */
export function starStateFor(state, progress = 0) {
  const p = Math.max(0, Math.min(1, (Number(progress) || 0) / 100));

  switch (state) {
    case "done":
      return { glow: 1.0, size: 3.0, tint: [1.0, 0.94, 0.80] };       // 暖象牙
    case "current":
      return { glow: 1.0, size: 4.6, tint: [1.0, 0.89, 0.62] };       // 最亮 · 暖金
    case "active":
      return { glow: 0.62 + p * 0.30, size: 2.8, tint: [0.90, 0.93, 0.96] };
    case "ahead":
      /*
       * 未开始。
       * 原来只有 0.16，再乘非焦点权重 0.34 ≈ 0.054 —— 新用户所有阶段都是
       * "未开始"，等于整张星图看不见（用户反馈"太不明显"的直接原因）。
       * 提到 0.46：仍然明显暗于"完成/当前"，但保证星座形状读得出来。
       */
      return { glow: 0.46, size: 2.3, tint: [0.80, 0.85, 0.90] };
    default:
      /* uncharted：暗，但仍然看得见（不是删除） */
      return { glow: 0.30, size: 2.0, tint: [0.68, 0.74, 0.80] };
  }
}

/**
 * 星座底盘 · 一层极淡的方向色星云。
 * =========================================================
 * 为什么会需要它：
 *   只靠星点的话，五组星星在深色背景上都是"孤立亮点"，
 *   人眼要靠"哪几个点挨得近"去分组 —— 在会动的星空视频上非常吃力
 *   （用户连续两次反馈"分开不明显"）。
 *   给每个星座垫一层**方向色**的柔光底盘，分组立刻从"点的邻近"
 *   变成"一整块有颜色的区域"，这是最有效的分离手段。
 *
 * 透明度压得很低：它是"区域暗示"，不是发光效果。
 */
export function createConstellationHalo({
  color = new THREE.Color("#3fae7a"),
  seed = 0,
  opacity = 0.16,
  mood = null,
} = {}) {
  const m = mood || resolveGalaxyMood("midnight");
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uSeed: { value: seed },
      uOpacity: { value: opacity * m.haloScale },
      uTime: { value: 0 },
      uWeight: { value: 1 },
      uInk: { value: m.constellationBlend === "alpha" ? 1 : 0 },
      /* 电影雾：远处星域融进黑暗（空气透视） */
      uFogNear: { value: 6.5 },
      uFogFar: { value: 17.0 },
      uFogMin: { value: 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vFog;
      uniform float uFogNear;
      uniform float uFogFar;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uWeight;
      uniform float uSeed;
      uniform float uInk;
      uniform float uFogMin;
      varying vec2 vUv;
      varying float vFog;

      ${GLSL_NOISE}

      void main() {
        vec2 p = vUv - vec2(0.5);
        float r = length(p) * 2.0;
        if (r > 1.0) discard;

        /*
         * 摄影感星云（替代早先的扁平色块）
         * ---------------------------------------------------------
         * 旧实现输出 uColor * mix(1.0, a*0.55, uInk) —— 在加成模式（uInk=0）下
         * 它乘的是 1.0，完全忽略 alpha 衰减，于是整片圆盘满色平铺，
         * 读出来就是一坨硬边色块（用户截图里每片星云外那圈"圆盘"）。
         *
         * 现在三层 fbm：云体 + 细絮 + 暗尘带，并且边缘衰减到 0（不再有轮廓），
         * 加成模式下按 alpha 累加光。
         */
        float falloff = pow(max(0.0, 1.0 - r), 2.6);

        float cloud = ds_fbm(vec3(p * 2.2, uSeed + uTime * 0.0035));
        float wisp  = ds_fbm(vec3(p * 6.4, uSeed * 1.7 - uTime * 0.0022));
        float lanes = ds_fbm(vec3(p * 3.6, uSeed * 2.9 + 11.0));

        float body = cloud * 0.62 + wisp * 0.24 + lanes * 0.14;
        /* 暗尘带：把气体抽出裂缝，避免又变成均匀一片 */
        body *= mix(0.42, 1.0, smoothstep(0.30, 0.72, lanes));
        float shaped = smoothstep(0.16, 0.78, body);

        float a = falloff * shaped * uOpacity * uWeight;
        /* 电影雾：越远越融进黑暗 */
        a *= mix(uFogMin, 1.0, 1.0 - vFog);
        if (a <= 0.0015) discard;

        /* 深空：纯加光，alpha 写 0（不压暗底下的星空视频）。
           纸上：底盘是"晕染的墨"——用形状量而不是用极小的 opacity 去上墨，
           否则米白纸上的分组提示会整片消失。 */
        vec3 col = mix(uColor * a, uColor * falloff * shaped * 0.9, uInk);
        gl_FragColor = vec4(col, mix(0.0, a, uInk));
      }
    `,
    transparent: true,
    depthWrite: false,
    ...moodBlend(m.constellationBlend),
    side: THREE.DoubleSide,
  });
}
