// src/components/world/planetShading.js
//
// =========================================================
// 星球表面着色（程序化生成，无需贴图文件）
// =========================================================
//
// 为什么需要它
// ------------
// 改造前，每颗星球都是「纯色光滑球 + 水平圆环 + 一圈光晕」——
// 用户的原话是「太像几何体堆砌」。根因是：
//
//   ① 球面没有任何表面起伏，光照打上去只有一个均匀的色块；
//   ② 没有边缘暗化（limb darkening），球体读起来是"平的"；
//   ③ 没有大气边缘散射，星球与背景之间没有空气感；
//   ④ 圆环是纯色 MeshBasicMaterial，不是环系。
//
// PLANET_STOCK 的注释里其实写着「暖金行星 · 纹理」「深紫黑行星 · 金纹」，
// 但那些纹理从来没被实现过——一直是纯色。
//
// 这里用 **程序化噪声写进片元着色器** 来补上：不引入任何贴图资源，
// 不对包体增重，且每颗星球用不同种子 → 每颗表面都不同。
//
// 实现方式：onBeforeCompile 注入 GLSL（Three.js 官方支持的材质扩展点），
// 保留 MeshStandardMaterial 的光照/阴影/雾等全部能力，只在它的
// 漫反射颜色与自发光上叠加细节。这样不会与既有的灯光、色调映射打架。
//
// 性能：全部是廉价哈希噪声（3~4 octave），片段开销很小；
// quality 低档时可以整体关闭（见 attachPlanetDetail 的 quality 参数）。

import * as THREE from "three";

/* ── 公共 GLSL 片段：3D 哈希噪声 + fbm ── */
const GLSL_NOISE = `
float dsh_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float dsh_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dsh_hash(i + vec3(0,0,0)), dsh_hash(i + vec3(1,0,0)), f.x),
        mix(dsh_hash(i + vec3(0,1,0)), dsh_hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(dsh_hash(i + vec3(0,0,1)), dsh_hash(i + vec3(1,0,1)), f.x),
        mix(dsh_hash(i + vec3(0,1,1)), dsh_hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

/* 4 octave 分形噪声：模拟地表的高低起伏与大尺度地貌 */
float dsh_fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * dsh_noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
`;

/** 均匀变量：每颗星球不同，保证表面各异 */
const DEFAULT_UNIFORMS = () => ({
  uDetailScale: { value: 2.6 },
  uTerrainStrength: { value: 0.34 },   /* 名字必须与 GLSL 里的声明一致 */
  uTerrainBias: { value: 0.0 },
  uSeed: { value: 0 },
  uAtmoColor: { value: new THREE.Color("#6ee7a8") },
  uAtmoStrength: { value: 0.55 },
  uNightGlow: { value: 0.22 },
});

/**
 * 把程序化表面细节挂到一颗星球的 MeshStandardMaterial 上。
 *
 * 注入四件事：
 *   ① 地貌：fbm 噪声调制漫反射颜色（大陆 / 海洋感）
 *   ② 夜面辉光：背光侧保留一点自发光，避免球体一半死黑
 *   ③ 边缘暗化：让球体读起来是立体的
 *   ④ 大气边缘散射：把大气色叠在轮廓上（Fresnel）
 *
 * @param {THREE.MeshStandardMaterial} material
 * @param {object} options
 *   seed        星球种子（不同星球表面不同）
 *   scale       地貌尺度
 *   strength    地貌对比强度 0~1
 *   terrainBias 整体明暗偏移（负=更暗，像海洋行星）
 *   atmoColor   大气色（THREE.Color）
 *   atmoStrength 大气边缘强度
 *   nightGlow   夜面自发光量
 *   quality     "high" 时启用完整细节；"low" 只保留边缘暗化与大气
 */
export function attachPlanetDetail(material, options = {}) {
  const {
    seed = 0,
    scale = 2.6,
    strength = 0.34,
    terrainBias = 0,
    atmoColor = new THREE.Color("#6ee7a8"),
    atmoStrength = 0.55,
    nightGlow = 0.22,
    quality = "high",
  } = options;

  if (!material || material.userData.__planetDetail) return material;

  const uniforms = DEFAULT_UNIFORMS();
  uniforms.uSeed.value = seed;
  uniforms.uDetailScale.value = scale;
  uniforms.uTerrainStrength.value = strength;
  uniforms.uTerrainBias.value = terrainBias;
  uniforms.uAtmoColor.value = atmoColor;
  uniforms.uAtmoStrength.value = atmoStrength;
  uniforms.uNightGlow.value = nightGlow;

  const full = quality !== "low";

  /* 让每颗星球的 uniform 可被外部实时调整（例如按完成度加权） */
  material.userData.planetUniforms = uniforms;
  material.userData.__planetDetail = true;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    /* 兜底：锚点不存在（未来 Three 版本改了 include 名）时**原样返回**。
       注入失败如果放任不管，材质会编译不过 —— 表现为星球变黑或不渲染，
       而且 Three 只在控制台留一行警告，很容易被当成"设计如此"。 */
    const ANCHOR = "#include <opaque_fragment>";
    if (!shader.fragmentShader.includes(ANCHOR)) {
      if (!material.userData.__planetDetailWarned) {
        material.userData.__planetDetailWarned = true;
        console.warn(
          "[planetShading] 未找到注入锚点，已跳过程序化表面细节（材质保持原样）"
        );
      }
      return;
    }


    /*
     * 只依赖 Three.js **已经提供**的 varying，不自己新增：
     *   vNormal        —— 来自 <normal_pars_fragment>（视图空间）
     *   vViewPosition  —— 来自 <normal_pars_fragment>（视图空间，指向相机）
     *
     * 早先版本在顶点着色器里注入 `varying vDshViewDir` 并用 `cameraPosition`
     * 计算，有两个风险：`cameraPosition` 在片元着色器里并不保证声明，
     * 而 r171 的 standard 片元着色器源码里也**没有** `varying vec3 vNormal`
     * 字样（它由 <normal_pars_fragment> 动态定义）。一旦这两个假设不成立，
     * 整个材质会编译失败 —— 而那是静默的：星球直接变黑或不渲染。
     * 现在的写法不引入任何未知符号。
     */
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uDetailScale;
         uniform float uTerrainStrength;
         uniform float uTerrainBias;
         uniform float uSeed;
         uniform vec3  uAtmoColor;
         uniform float uAtmoStrength;
         uniform float uNightGlow;
         ${GLSL_NOISE}`
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
         {
           vec3 nrm = normalize(vNormal);
           /* vViewPosition 指向相机，取负得到"从表面看向相机"的方向 */
           vec3 viewDir = normalize(-vViewPosition);

           /* 用基点法还原球面局部坐标（不同 seed → 不同地貌） */
           vec3 lb = normalize(-nrm.y * vec3(1.0, 0.0, 0.0) + nrm.z * vec3(0.0, 1.0, 0.0));
           vec3 lp = cross(nrm, lb);
           float surfaceSeed = dot(lp, vec3(0.0, 0.0, 1.0)) + dot(lb, vec3(1.0, 0.0, 0.0));
           vec3 localDir = vec3(surfaceSeed * 0.5 + 0.5) + uSeed * 0.017;

           ${
             full
               ? `
           /* 双尺度 fbm：大尺度地貌 + 小尺度颗粒 */
           float land = dsh_fbm(localDir * uDetailScale);
           float grain = dsh_noise(localDir * (uDetailScale * 6.5) + uSeed);
           float terrain = land * 0.78 + grain * 0.22;

           /* 明暗起伏：对比度越高越像有地貌，而不是塑料球 */
           float shade = mix(1.0 - uTerrainStrength, 1.0 + uTerrainStrength * 0.6, terrain);
           shade += uTerrainBias;
           gl_FragColor.rgb *= shade;
           `
               : ``
           }

           /* 边缘暗化（limb darkening）：球体立体感的来源。
              用 sqrt 而不是 pow(x, 0.55)：pow 对负数输入会产生 NaN，
              而 facing 万一被浮点误差带到 0 以下就会整颗星球变黑。
              这里用 sqrt（等价于 x^0.5）并把结果夹紧，数值上安全。 */
           float facing = clamp(dot(nrm, viewDir), 0.0, 1.0);
           float softFacing = clamp(sqrt(facing), 0.0, 1.0);
           gl_FragColor.rgb *= mix(0.60, 1.0, softFacing);

           /* 大气边缘散射（Fresnel）：轮廓上的一圈空气。
              rim 用自乘而不是 pow(负数)——1.0 - facing 已保证非负，
              但自乘省掉一次 pow，也更不容易踩边界。 */
           float rim = (1.0 - facing) * (1.0 - facing) * (1.0 - facing);
           gl_FragColor.rgb += uAtmoColor * rim * uAtmoStrength;

           /* 夜面辉光：背光侧补一点自发光，避免球面死黑。
              注意 smoothstep 的边界必须 edge0 < edge1（反序是未定义行为），
              所以这里对 nrm.z 取负后再升序处理。 */
           float backLight = 1.0 - smoothstep(-0.25, 0.35, -nrm.z);
           gl_FragColor.rgb += uAtmoColor * backLight * uNightGlow;
         }`
      );
  };

  /* 换了 onBeforeCompile 必须让 Three 重编译这个材质 */
  material.needsUpdate = true;
  return material;
}

/* =========================================================
   星场：把"均匀圆点"换成有亮度/色温/大小分布的真实星场
   ========================================================= */

/* 只含 main：三个 varying 的声明在调用方的顶点/片元着色器里各写一次。
   早先把声明也写在这里，导致片元着色器出现**重复声明**而编译失败
   （浏览器实测：ERROR: 0:162: 'vStarBrightness' redefinition）。 */
const GLSL_STAR_POINT = `
void main() {
  /* 圆形羽化光点：原来是方块点，放大后能看出锯齿 */
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float halo = pow(core, 2.6);

  vec3 col = vStarColor * (halo * 1.6 + core * 0.4);
  float alpha = core * vStarBrightness;
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * 给星场几何体写入「亮度 / 色温 / 大小」三组属性。
 *
 * 真实星场的关键不是数量，而是**分布**：
 * 绝大多数暗淡且偏冷，少量明亮且偏暖——均匀的白色点云一眼就假。
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {number} count 星点数
 * @param {object} options
 *   spread   分布半径
 *   flatness 压扁系数（<1 更像盘状星系）
 *   seed     随机种子
 */
export function buildStarField(geometry, count = 1400, options = {}) {
  const { spread = 26, flatness = 0.55, seed = 7 } = options;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);

  /* 固定种子的伪随机：保证刷新后星场一致，不会"星星乱跳" */
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  const cool = new THREE.Color("#bcd4ff"); // 冷白
  const neutral = new THREE.Color("#e8eefc");
  const warm = new THREE.Color("#ffd9a8"); // 暖黄
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    /* 球壳分布 + 压扁 → 盘状星系感 */
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = spread * (0.55 + Math.pow(rand(), 0.7) * 0.45);

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * flatness;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

    /* 色温：大部分冷白，少数暖黄（模拟不同恒星类型） */
    const t = rand();
    if (t < 0.68) tmp.copy(cool);
    else if (t < 0.92) tmp.copy(neutral);
    else tmp.copy(warm);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;

    /* 亮度：幂律分布——绝大多数暗淡，极少极亮 */
    brightness[i] = 0.12 + Math.pow(rand(), 3.2) * 0.88;
    /* 大小：亮星更大 */
    sizes[i] = 0.6 + Math.pow(rand(), 2.4) * 2.6;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

  return geometry;
}

/**
 * 星场材质：用自定义着色器画圆形羽化光点（比 PointsMaterial 的方块点真实）。
 */
export function createStarFieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.9 },
      uScale: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aBrightness;
      uniform float uScale;
      varying float vStarBrightness;
      varying float vStarSize;
      varying vec3 vStarColor;

      void main() {
        vStarBrightness = aBrightness;
        vStarSize = aSize;
        vStarColor = aColor;

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        /* 距离衰减，远处的星点自然变小 */
        gl_PointSize = aSize * uScale * (28.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vStarBrightness;
      varying float vStarSize;
      varying vec3 vStarColor;
      ${GLSL_STAR_POINT}
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    /* 星点是纯加光：不向画布 alpha 通道累积，
       否则星点密集处会把底下的星空视频压出暗点 */
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}
