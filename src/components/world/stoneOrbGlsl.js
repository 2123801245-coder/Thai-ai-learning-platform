// src/components/world/stoneOrbGlsl.js
//
// =========================================================
// 五尊白色石雕 Orb · 着色器与材质参数
// =========================================================
//
// 本文件不 import three，只是 GLSL 字符串 + 纯数据，所以非懒加载的组件
// 也能安全地读调色板，不会把 three（gzip ~176KB）拖进首页主包。
//
// 材质语言：白色石灰岩 / 象牙 / 白玉。哑光、微透、极弱高光。
//
// 「内部世界」靠两件事表现，而不是靠发光或粒子：
//   ① 刻痕越深 → 越透出该世界的内光（白玉的透光感）
//   ② 内部贴图以略微不同的比例缓慢漂移 → 内部场景自己在缓慢运动
//
// 每帧成本：一次法线贴图采样 + 一次内层采样 + 几次点积。

export const ORB_VERT = /* glsl */ `
uniform float uTime;
uniform float uPhase;   // 弧度，五个球错开 0/72/144/216/288°
uniform float uHover;   // 0..1
uniform float uDeform;  // 形变强度（由主题给，深色世界更活一点）

varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

float orbHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

/* 3D 值噪声：只用来做「有机呼吸」，精度要求很低 */
float orbNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(orbHash(i), orbHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(orbHash(i + vec3(0.0, 1.0, 0.0)), orbHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(orbHash(i + vec3(0.0, 0.0, 1.0)), orbHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(orbHash(i + vec3(0.0, 1.0, 1.0)), orbHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
  return n;
}

void main() {
  vUv = uv;

  vec3 dir = normalize(position);
  float t = uTime * 0.13 + uPhase;

  /*
   * 有机形变：两个八度的低频噪声沿半径呼吸。
   * 幅度刻意极小（uDeform 约 0.6~1.1 → 半径 ±1.5%~2.5%），
   * 目标是「石头像有生命」而不是「球在抖」。
   */
  float n = orbNoise(dir * 1.7 + vec3(t)) * 0.66
          + orbNoise(dir * 3.4 - vec3(t * 0.7)) * 0.34;
  float amp = 0.028 * uDeform * (1.0 + uHover * 0.55);
  vec3 displaced = position * (1.0 + amp * (n - 0.5));

  /* 极缓的自转（每颗球相位不同，所以看上去各自在飘） */
  float spin = uTime * 0.045 + uPhase * 0.5;
  float cs = cos(spin);
  float sn = sin(spin);
  displaced.xz = mat2(cs, -sn, sn, cs) * displaced.xz;

  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const ORB_FRAG = /* glsl */ `
uniform sampler2D uMap;

uniform float uTime;
uniform float uPhase;
uniform float uHover;
uniform float uState;   // 0 未开始 / 1 已完成 / 2 进行中 / 3 锁定
uniform float uInner;   // 内部世界透光强度（主题给）
uniform float uRelief;  // 浮雕深度（主题给）

uniform vec3 uStone;
uniform vec3 uAmbient;
uniform vec3 uRim;
uniform vec3 uGold;
uniform vec3 uTint;     // 该世界的内部光色
uniform vec3 uLight;

varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  vec3 N = normalize(vNormalView);
  vec3 V = normalize(vViewDir);

  /* 切线基：球面 UV 下 T = 经线方向，极点附近退化为任意正交基 */
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 T = cross(up, N);
  float tlen = length(T);
  T = tlen > 0.001 ? T / tlen : normalize(cross(vec3(1.0, 0.0, 0.0), N));
  vec3 B = cross(N, T);

  /* 刻痕：RGB = 切线空间法线，A = 高度 */
  vec4 carved = texture2D(uMap, vUv);

  /*
   * 内层：u 方向不缩放（保持环绕无缝），只做缓慢漂移，
   * 于是「内部的文化场景」在石头里面自己慢慢动。
   */
  vec2 drift = vec2(uTime * 0.008 + uPhase * 0.02,
                    sin(uTime * 0.06 + uPhase) * 0.018);
  vec4 innerTex = texture2D(uMap, vec2(vUv.x + drift.x, vUv.y * 1.09 + drift.y));

  /* 法线扰动：浮雕可读性的来源 */
  vec3 nT = (carved.rgb * 2.0 - 1.0) * vec3(uRelief);
  vec3 N2 = normalize(T * nT.x + B * nT.y + N * max(abs(nT.z), 0.35));

  float depth = 1.0 - carved.a;              // 刻痕深度
  float ao = mix(0.42, 1.0, carved.a);       // 刻痕里的接触遮蔽

  vec3 L = normalize(uLight);
  float diff = max(dot(N2, L), 0.0);
  float wrap = max(dot(N2, -L), 0.0);
  /* 半兰伯特式补光：石雕的背光面不能死黑，否则读不出体积 */
  float ambient = dot(uAmbient, vec3(0.72, 0.9, 1.0)) * (0.62 + 0.38 * wrap);

  vec3 col = uStone * (ambient + diff * 1.05) * ao;

  /* 边缘光：只勾一圈，不做 HUD 式描边 */
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float rimGain = 0.16 + uHover * 0.5 + (uState > 1.5 && uState < 2.5 ? 0.16 : 0.0);
  col += uRim * rim * rimGain;

  /* 内部世界：雕得越深越透光 */
  float innerMask = smoothstep(0.16, 0.86, depth * (0.62 + uInner));
  float innerGain = uInner * (0.5 + uHover * 0.85 + (uState > 1.5 && uState < 2.5 ? 0.28 : 0.0));
  col += uTint * (innerMask * innerGain * 0.42 + (1.0 - innerTex.a) * innerGain * 0.16);

  /* 暖金：悬停与「进行中」时，刻痕深处透出一线金 */
  float goldMask = smoothstep(0.55, 1.0, depth);
  col += uGold * goldMask * (uHover * 0.3 + (uState > 1.5 && uState < 2.5 ? 0.2 : 0.0))
       + uGold * rim * (uState > 0.5 && uState < 1.5 ? 0.12 : 0.0);

  /* 极弱高光：石灰岩是哑光的，这里只是别让平面看起来像塑料 */
  float spec = pow(max(dot(normalize(reflect(-L, N2)), V), 0.0), 24.0);
  col += vec3(1.0, 0.98, 0.94) * spec * 0.055;

  /* 锁定：压暗、去色、几乎没有内光 */
  if (uState > 2.5) {
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(g), col, 0.45) * 0.66;
  }

  /* 纸本世界：石头是暖白，不要让它发冷 */
  gl_FragColor = vec4(col, 1.0);
}
`;

/* =========================================================
   调色板：按**真正画出来的世界**给（visualMode，不是 world）
========================================================= */
const PALETTES = {
  // 深色：夜泰国 —— 深翡翠环境里被暖光扫到的青白石灰岩
  midnight: {
    stone: [0.82, 0.8, 0.75],
    ambient: [0.14, 0.3, 0.24],
    rim: [0.85, 0.72, 0.42],
    gold: [0.8, 0.63, 0.3],
    light: [0.42, 0.62, 0.66],
    inner: 0.85,
    relief: 0.85,
    deform: 1.0,
  },
  // 浅色：纸本 —— 象牙 / 白瓷，暖褐环境光，旧金勾边
  paper: {
    stone: [0.95, 0.93, 0.88],
    ambient: [0.62, 0.56, 0.46],
    rim: [0.6, 0.5, 0.26],
    gold: [0.56, 0.44, 0.18],
    light: [0.5, 0.66, 0.6],
    inner: 0.6,
    relief: 0.72,
    deform: 0.72,
  },
};

export function orbPalette(visualMode) {
  return PALETTES[visualMode] || PALETTES.midnight;
}

/* 每个世界的「内部光」：都收在泰国的自然色域里，没有霓虹、没有紫 */
export const ORB_TINT = {
  foundation: [0.44, 0.74, 0.55], // 翡翠
  speaking: [0.42, 0.7, 0.7],     // 湄南河的水色
  media: [0.78, 0.66, 0.38],      // 古纸与墨
  culture: [0.86, 0.68, 0.34],    // 寺庙金箔
  professional: [0.45, 0.64, 0.7],// 夜空下的城市
};
