// src/components/world/GalaxyScene.jsx
//
// =========================================================
// ThaiAI Learning Galaxy · Premium Cinematic 3D Scene
// =========================================================
//
// 视觉方向：Cinematic Astronomy + Luxury Editorial + Thai Cultural Atmosphere
//
// 改造要点：
//   ① 中央核心：深金色恒星，不再是白色塑料球
//   ② 星球：每颗有独立大气层/纹理感，非卡通球体
//   ③ 轨道：4-5条极细线，倾斜透视，不全部正面平铺
//   ④ 星云：极克制的深色背景星云
//   ⑤ 星空：真实大小不一的星星，大部分暗淡
//   ⑥ 景深：远处元素模糊，近处清晰
//   ⑦ 动画：全部放慢，cinematic pace
//   ⑧ 颜色：深黑/墨绿/深蓝绿 + 泰金/暖白 + 青绿
//
// 数据契约不变：planet.radius = 掌握度收紧后的轨道半径，
//   planet.progress / state / veil / today / satellites 全部保留。
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  cameraPosition,
  clampPitch,
  idleDrift,
  stepOrbit,
} from "./orbitControls";
/* 只借 buildStarField（星点几何：亮度/色温/大小的幂律分布）。
   材质不再用 planetShading 的 createStarFieldMaterial：它是纯加成，
   落在米白纸上等于什么都不画 —— 换成 deepSpace 的世界感知版。 */
import { buildStarField } from "./planetShading";
import {
  constellationLayout,
  createBokehDust,
  createConstellationHalo,
  createConstellationLines,
  createConstellationStars,
  createCoreGlowMaterial,
  createPaletteStarFieldMaterial,
  createTraceArc,
  moodAccent,
  moodBlend,
  resolveGalaxyMood,
  starStateFor,
} from "./deepSpace";

/* ── 调色板 ── */
const DEEP_GOLD    = "#c9a44a";
const WARM_CORE    = "#ffe8c4";
const THAI_GOLD    = "#d4a853";

/* ── 每个学习方向的「星体质感」─ */
/*
 * 星座色相。
 * ---------------------------------------------------------
 * 五个方向必须能**靠颜色**一眼分开 —— 在会动的星空背景上，
 * 只靠"星星挨得近不近"去分组太吃力（用户连续两次反馈"分不开"）。
 * 全部取自允许色板：深祖母绿 / 深青 / 哑光金 / 午夜蓝 / 暖象牙。
 * 不要紫、不要霓虹。
 *
 * 这套是**深空世界**的色板，其余世界各自一套（见 deepSpace 的
 * constellationHue），由 constellationHueFor() 选择。
 */
const CONSTELLATION_HUE = {
  foundation:   "#3fae7a",  // 深祖母绿
  speaking:     "#35a8a0",  // 深青
  culture:      "#d4a44a",  // 哑光金
  media:        "#4a7fc4",  // 午夜蓝
  professional: "#d8c49a",  // 暖象牙
};

/**
 * 某个学习方向在当前世界里的色相。
 *
 * 为什么不能只留一套色板：方向色是按深空黑底挑的（亮度 0.3~0.6）。
 * 同一组色放到米白纸上，亮的过曝成白斑、暗的仍然看不见 ——
 * 纸上的星图必须换成"墨色"（深蓝 / 墨绿 / 古铜金）。
 */
function constellationHueFor(mood, planet) {
  const table = mood?.constellationHue;
  const fallback = CONSTELLATION_HUE[planet.id] || planet.accent || THAI_GOLD;
  const hue = (table && table[planet.id]) || fallback;
  return new THREE.Color(moodAccent(new THREE.Color(hue), mood));
}

/* =========================================================
   中央核心 · 深金恒星
   ── 摄影级恒星：核心 + 内晕 + 极细日冕 + 放射翼 ──
========================================================= */

function StellarCore({ quality, accent, activity = 0, mood = null }) {
  const coreGroupRef = useRef(null);
  const coreRef = useRef(null);
  const innerGlow = useRef(null);
  const outerHalo = useRef(null);
  const coronaRef = useRef(null);
  const beamGroup = useRef(null);

  /*
   * 核心光团的颜色与尺寸。
   * ---------------------------------------------------------
   * `accent` 在这里是**材质色**不是 UI 色：它要参与加成叠加，也会被
   * 白色核心的光晕盖住。世界色（例如纸世界的 #9A7B2E）直接拿来用会
   * 出现"金到发绿"的偏色，也会让核心半径比纸面能承受的大一圈 ——
   * 所以统一交给 mood 处理：深空原样、纸上往墨金上靠并收小。
   */
  const accentColor = useMemo(
    () =>
      mood
        ? moodAccent(new THREE.Color(accent || mood.defaultAccent), mood)
        : new THREE.Color(accent || DEEP_GOLD),
    [accent, mood]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    /* 核心呼吸 */
    if (coreRef.current) {
      const pulse = Math.sin(t * 0.35) * 0.5 + 0.5;
      coreRef.current.scale.setScalar(1 + pulse * 0.025 + activity * 0.035);
      coreRef.current.material.emissiveIntensity =
        1.8 + pulse * 0.4 + activity * 0.8;
    }

    /* 内层光晕 */
    if (innerGlow.current) {
      innerGlow.current.material.opacity =
        0.12 + (Math.sin(t * 0.28) * 0.5 + 0.5) * 0.08 + activity * 0.1;
      innerGlow.current.rotation.z = t * 0.02;
    }

    /* 外层日冕 */
    if (outerHalo.current) {
      outerHalo.current.rotation.z = -t * 0.012;
      outerHalo.current.material.opacity =
        0.04 + (Math.sin(t * 0.18) * 0.5 + 0.5) * 0.03 + activity * 0.04;
    }

    /* 极细日冕环 */
    if (coronaRef.current) {
      coronaRef.current.rotation.z = t * 0.008;
      coronaRef.current.material.opacity =
        0.06 + (Math.sin(t * 0.22) * 0.5 + 0.5) * 0.04;
    }

    /* 放射翼：6条极细光束，缓慢旋转 */
    if (beamGroup.current) {
      beamGroup.current.rotation.z = t * 0.015;
      beamGroup.current.children.forEach((child, i) => {
        const p = Math.sin(t * 0.5 + i * 1.047) * 0.5 + 0.5;
        child.material.opacity = 0.03 + p * 0.05 + activity * 0.02;
      });
    }
  });

  /*
   * 中央核心。
   * ============================================================
   * 改造前：0.38 半径的实心球 + 两片 ringGeometry 平环 + 极细环 + 6 条放射翼，
   * 读起来是"页面中央放了一个 3D Logo"。
   *
   * 现在：**不是一个实体**。三层叠加的暖金光团（billboard，永远面向相机）：
   *   · 极小的实心核 —— 提供"存在感"
   *   · 柔和的中间晕 —— 提供"体量"
   *   · 很大范围的稀薄外晕 —— 提供"引力中心"的感觉
   * 没有球面、没有平环、没有光束。呼吸幅度 6%，周期约 28 秒。
   */
  /*
   * 核心光团的颜色。
   * 深空世界 = 主题强调色（没有则深金），与原来完全一致。
   * 纸上世界把暖白核心也往墨金上靠（placeCore）：纯白核心叠在米白纸上
   * 是一片看不见的白斑，纸上需要的是"一圈晕开的墨金"。
   */
  const beamColor = accentColor;
  const coreColor = useMemo(() => {
    const base = new THREE.Color(WARM_CORE);
    return mood && mood.placeCore > 0 ? base.lerp(accentColor, mood.placeCore) : base;
  }, [accentColor, mood]);

  const glowMaterials = useMemo(
    () => [
      { mat: createCoreGlowMaterial({ color: coreColor, intensity: 1.0 }), scale: mood?.coreScales?.[0] ?? 2.6 },
      { mat: createCoreGlowMaterial({ color: beamColor, intensity: 0.62 }), scale: mood?.coreScales?.[1] ?? 5.8 },
      { mat: createCoreGlowMaterial({ color: beamColor, intensity: 0.36 }), scale: mood?.coreScales?.[2] ?? 11.5 },
    ],
    [beamColor, coreColor, mood]
  );

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    glowMaterials.forEach(({ mat }, i) => {
      mat.uniforms.uTime.value = t;
      /* 越外层的晕越慢，形成"内紧外松"的呼吸节律。
         外层从 0.26 提到 0.36：纯加成合成下这个量级才刚好能
         在视频背景上读出"引力中心"的范围，再高就开始泛白。 */
      mat.uniforms.uIntensity.value =
        (mood?.coreWeights?.[i] ?? [1.0, 0.62, 0.36][i]) *
        (1 + Math.sin(t * 0.22 - i * 0.6) * 0.05 + activity * 0.22);
    });
    /* billboard：让光团始终正对相机 */
    if (coreGroupRef.current) {
      coreGroupRef.current.children.forEach((child) => {
        child.quaternion.copy(camera.quaternion);
      });
    }
  });

  return (
    <group>
      <group ref={coreGroupRef}>
        {glowMaterials.map(({ mat, scale }, i) => (
          <mesh key={i} scale={scale} renderOrder={-2}>
            <planeGeometry args={[1, 1]} />
            <primitive object={mat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* 核心光：照亮附近星域，但不做强光源（避免"打光感"） */}
      <pointLight
        color={WARM_CORE}
        intensity={quality?.tier === "low" ? 1.0 : 1.7}
        distance={14}
      />
    </group>
  );
}

/* =========================================================
   星尘遮蔽（保留原有逻辑，微调颜色）
========================================================= */

function VeilDust({ veil, size, quality, cleared = 0, mood = null }) {
  const points = useRef(null);
  const blownRef = useRef(0);
  const baseOpacityRef = useRef(null);

  const baseCount = veil?.dust || 0;
  const count = useMemo(() => {
    if (!baseCount) return 0;
    const scaled =
      quality?.tier === "low" ? Math.round(baseCount * 0.34) : baseCount;
    return Math.max(scaled, 8);
  }, [baseCount, quality?.tier]);

  const geometry = useMemo(() => {
    if (!count) return null;
    const positions = new Float32Array(count * 3);
    const inner = size * 1.45;
    const outer = size * 3.4;
    for (let i = 0; i < count; i += 1) {
      const r = inner + Math.random() * (outer - inner);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.45;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count, size]);

  const material = useMemo(() => {
    if (!count) return null;
    const heavy = veil?.tier === "heavy";
    return new THREE.PointsMaterial({
      /* 尘埃颜色随世界走：深空是冷灰、林间是苔绿、纸上是墨点色 ——
         同一份冷灰落在米白纸上会变成一片脏污。 */
      color: new THREE.Color(
        heavy
          ? mood?.dustColorHeavy || "#6a7a88"
          : mood?.dustColorLight || "#9ab0c0"
      ),
      size: (heavy ? 0.045 : 0.03) * (mood?.dust?.sizeScale ?? 1),
      transparent: true,
      opacity: (heavy ? 0.5 : 0.3) * (mood?.dust?.opacity ?? 1),
      /* 与 AdditiveBlending 等价的 RGB 混合，但不再向画布 alpha 累积
         （尘埃密集处否则会在星空视频上压出暗斑）。
         ⚠️ 因数必须取 One：PointsMaterial 的输出已经是预乘（rgb 已乘 diffuse color，
         而 diffuse color 自带 opacity 造成的暗化），再用 SrcAlphaFactor 就是 alpha²。
         加成对纸世界同样成立 —— 纸上尘埃是**墨点**，叠加的作用是"越积越深"，
         而 alpha 保持 0 才不会被不透明的画布把纸面盖掉（见 index.css 里的说明）。 */
      ...moodBlend("add"),
      sizeAttenuation: true,
    });
  }, [count, veil?.tier, mood]);

  useFrame(({ clock }) => {
    if (!points.current) return;
    const t = clock.elapsedTime;
    const speed = veil?.tier === "heavy" ? 0.03 : 0.08;

    if (baseOpacityRef.current === null) {
      baseOpacityRef.current = points.current.material.opacity;
    }
    const target = cleared ? 1 : 0;
    blownRef.current += (target - blownRef.current) * 0.03;
    const blown = blownRef.current;

    points.current.rotation.y = t * speed * (1 + blown * 2.0);
    points.current.rotation.x = Math.sin(t * 0.05) * 0.08;
    points.current.scale.setScalar(1 + blown * 0.65);
    points.current.material.opacity =
      baseOpacityRef.current * (1 - blown * 0.7);
  });

  if (!geometry || !material) return null;
  return <points ref={points} geometry={geometry} material={material} />;
}

/* =========================================================
   今日脉冲（保留，微调节奏）
========================================================= */

function TodayPulse({ intensity = 0, size, color, reduced = false, mood = null }) {
  const rings = useRef([]);
  /* 弧环数量随世界走：现代世界只留一环（"数据感"要求少而准），
     纸上世界也留一环（古典星图的今日标记是一条细线圈，不是三重脉冲）。 */
  const ringCount = mood?.pulse?.rings ?? 3;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const speed = 0.2 + intensity * 0.15;
    rings.current.forEach((mesh, index) => {
      if (!mesh) return;
      const progress = reduced ? 0.34 : (t * speed + index * 0.5) % 1;
      mesh.scale.setScalar(1 + progress * (1.8 + intensity * 1.5));
      mesh.material.opacity = (1 - progress) * (0.28 + intensity * 0.45);
    });
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: ringCount }, (_, i) => i).map((index) => (
        <mesh
          key={index}
          ref={(node) => { rings.current[index] = node; }}
          rotation={[0, 0, index * 1.05]}
        >
          <ringGeometry args={[size * 1.1, size * 1.18, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.35}
            {...moodBlend(mood?.constellationBlend)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* =========================================================
   今日能量丝（保留，微调）
========================================================= */

function TodayThread({ hostRef, intensity = 0, color, reduced = false, quality, mood = null }) {
  const thread = useRef(null);
  const bead = useRef(null);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const host = hostRef?.current;
    const line = thread.current;
    if (!host || !line) return;

    const position = host.position;
    dir.set(-position.x, -position.y, -position.z);
    const length = dir.length();
    if (length < 0.001) return;
    dir.normalize();

    line.quaternion.setFromUnitVectors(up, dir);
    line.position.copy(dir).multiplyScalar(length / 2);
    line.scale.set(1, length, 1);

    const t = clock.elapsedTime;
    const flow = reduced ? 0.5 : Math.sin(t * 1.2) * 0.5 + 0.5;
    line.material.opacity = (0.08 + flow * 0.15) * (0.3 + intensity);

    if (bead.current) {
      const frac = reduced ? 0.34 : (t * 0.22) % 1;
      bead.current.position.copy(dir).multiplyScalar(length * (1 - frac));
      bead.current.material.opacity =
        (1 - Math.abs(frac - 0.5) * 1.3) * 0.65;
    }
  });

  return (
    <group>
      <mesh ref={thread}>
        <cylinderGeometry args={[0.005, 0.014, 1, 6, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          {...moodBlend(mood?.constellationBlend)}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {quality?.tier !== "low" ? (
        <mesh ref={bead}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            {...moodBlend(mood?.constellationBlend)}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* =========================================================
   一次性冲击波
========================================================= */

function TodayBurst({ size, color, mood = null }) {
  const ring = useRef(null);
  const startRef = useRef(null);
  const LIFE = 1.8;

  useFrame(({ clock }) => {
    if (!ring.current) return;
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const progress = Math.min(1, (clock.elapsedTime - startRef.current) / LIFE);
    ring.current.scale.setScalar(1 + progress * 2.8);
    ring.current.material.opacity = Math.max(0, 1 - progress) * 0.7;
  });

  return (
    <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[size * 1.08, size * 1.16, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        {...moodBlend(mood?.constellationBlend)}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* =========================================================
   画像卫星（保留，微调）
========================================================= */

function Satellite({ sat, index, total, hostSize, accent, onSelect, mood = null }) {
  const group = useRef(null);
  const [hovered, setHovered] = useState(false);

  const orbit = useMemo(
    () => ({
      radius: hostSize * 2.5 + index * hostSize * 0.72,
      speed: 0.35 + index * 0.1,
      phase: (index / Math.max(total, 1)) * Math.PI * 2,
      tilt: -0.5 + index * 0.28,
      size: Math.max(0.024, hostSize * 0.18),
    }),
    [hostSize, index, total]
  );

  /* 卫星用的是**方向色**（不是主题色）：纸上要把它调到墨色阶，
     否则四五颗高饱和的小球落在米白纸上像贴纸。 */
  const moonColor = useMemo(
    () => moodAccent(new THREE.Color(accent), mood),
    [accent, mood]
  );
  /* 纸上/墨色世界取消外层光晕：加成叠在米白纸上是一圈白斑 */
  const halo = mood?.constellationBlend !== "alpha";

  useFrame(({ clock }) => {
    if (!group.current) return;
    const angle = orbit.phase + clock.elapsedTime * orbit.speed;
    group.current.position.set(
      Math.cos(angle) * orbit.radius,
      Math.sin(angle) * orbit.radius * orbit.tilt,
      Math.sin(angle) * orbit.radius * 0.55
    );
    const target = hovered ? 1.5 : 1;
    group.current.scale.lerp(
      new THREE.Vector3(target, target, target),
      0.12
    );
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(sat);
      }}
    >
      <mesh>
        <sphereGeometry args={[orbit.size, 12, 12]} />
        <meshStandardMaterial
          color={moonColor}
          emissive={moonColor}
          emissiveIntensity={hovered ? 2.0 : 1.0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      {halo ? (
        <mesh scale={2.0}>
          <sphereGeometry args={[orbit.size, 8, 8]} />
          <meshBasicMaterial
            color={moonColor}
            transparent
            opacity={hovered ? 0.25 : 0.12}
            {...moodBlend("add")}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* =========================================================
   单颗星球 · 电影级质感
   ── 深色星体 + 大气层 + 环境光 + 月环 + 完成度环 ──
========================================================= */

function Planet({
  planet,
  index,
  total,
  active,
  onHover,
  onSelect,
  quality,
  themeAccent: _themeAccent,
  burstSeq = null,
  reducedMotion = false,
  mood = null,
}) {
  const group = useRef(null);
  const body = useRef(null);
  const atmosphere = useRef(null);
  const innerGlow = useRef(null);
  const ring = useRef(null);
  const laggardRing = useRef(null);
  const beam = useRef(null);
  const [hovered, setHovered] = useState(false);
  const radiusRef = useRef(null);
  /* 空气透视：星座随公转进入画面深处时变暗变虚（平滑后的距离权重） */
  const depthWeightRef = useRef(1);

  const orbit = useMemo(() => {
    /*
     * 半径。
     * ---------------------------------------------------------
     * 原来直接用 planet.radius（掌握度），但**新用户所有方向进度都是 0**，
     * 于是五个星座半径完全相同、挤在同一个圆环上 —— 这是"分不开"的
     * 结构性原因。现在以掌握度为基础，再叠加一个明显的阶梯，
     * 保证任何数据状态下五个星座都落在不同距离上。
     * 掌握度的排序语义仍然保留（mastery 越小越靠内）。
     */
    const masteryRadius =
      typeof planet.radius === "number" ? planet.radius : 2.4 + index * 0.9;
    const radius = masteryRadius * 0.55 + (2.6 + index * 1.05);
    return {
      radius,
      /*
       * 高度：原来只有 ±0.35，五个星座几乎共面 —— 投影下来就是一条被压扁的环，
       * 前后互相叠在一起（用户反馈"星图分开不明显"的主因之一）。
       * 放大到 ±0.85，让它们落在不同的空间层上。
       */
      height: Math.sin(index * 1.37) * 0.85,
      speed: 0.05 / (1 + index * 0.16),
      phase: (index / total) * Math.PI * 2 + index * 0.4,
      size: 0.16 + Math.min(planet.stageCount, 5) * 0.024,
    };
  }, [index, total, planet.stageCount, planet.radius]);

  const isCurrent = planet.state === "current";
  const veil = planet.veil || { tier: "none", dust: 0 };
  const veiled = veil.tier !== "none";
  const done = planet.state === "done";
  const highlight = hovered || active;
  /* 连线透明度按世界取（取值见 deepSpace 的 constellationLineOpacity） */
  const lo = mood?.constellationLineOpacity || { veiled: 0.14, current: 0.6, base: 0.4 };


  const todayActive = Boolean(planet.today?.active);
  const todayIntensity = planet.today?.intensity || 0;

  /* 自发光强度：完成度决定暗/亮 */
  const baseEmissive = veiled
    ? 0.08 + (todayActive ? 0.2 + todayIntensity * 0.3 : 0)
    : 0.3 + (planet.progress / 100) * 0.7 + (isCurrent ? 0.35 : 0) +
      (todayActive ? 0.18 + todayIntensity * 0.25 : 0);

  const flashStartRef = useRef(null);
  useEffect(() => {
    if (burstSeq) flashStartRef.current = performance.now();
  }, [burstSeq]);

  /* 星球本体材质：低粗糙度 + 金属感 = 电影级质感 */
  /*
   * 本体材质。
   * --------------------------------
   * 改造前是一颗**纯色光滑球**：光照打上去只有一个均匀色块，
   * 没有地貌、没有边缘暗化、没有大气散射 —— 这就是"几何体堆砌"的主要来源。
   * 现在挂上程序化表面细节（fbm 地貌 + 边缘暗化 + 大气 Fresnel + 夜面辉光），
   * 用 onBeforeCompile 注入 GLSL，不引入任何贴图资源。
   * 每颗星球用不同 seed，所以表面各不相同。
   */

  /* 大气层：更柔和、更大范围 */

  /* 内层光晕：更小、更亮，模拟大气散射 */

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;

    if (group.current) {
      const angle = orbit.phase + t * orbit.speed;
      if (radiusRef.current === null) radiusRef.current = orbit.radius;
      radiusRef.current += (orbit.radius - radiusRef.current) * 0.015;
      const r = radiusRef.current;
      group.current.position.set(
        Math.cos(angle) * r,
        orbit.height + Math.sin(t * 0.3 + index) * 0.04,
        /* 0.55 → 0.82：压得太扁会让前后的星座在屏幕上重叠 */
        Math.sin(angle) * r * 0.82
      );

      /*
       * 景深（空气透视）· 按相机距离衰减星座亮度
       * ---------------------------------------------------------
       * 星座在轨道上公转，会轮流走进画面深处：近处的那片清晰明亮，
       * 远处的那片自动变暗、变虚 —— 这就是「前景/中景/背景」的
       * 空间层次，成本只是每帧一次距离计算。近处权重封顶 1.0，
       * 远处最低 0.58（仍可辨认，只是退到背景里）。
       *
       * 曾取 0.45：用户报"看不到星球"时，公转到远侧的那几片几乎消失，
       * 于是抬高地板 —— 景深只该拉开层次，不该把内容藏掉。
       */
      const camDist = camera.position.distanceTo(group.current.position);
      const near = 5.2;
      const far = 11.5;
      const dd = Math.min(1, Math.max(0, (camDist - near) / (far - near)));
      const dz = 1 - dd * 0.42;
      /* 平滑到目标值，避免公转经过近点/远点时亮度跳变 */
      depthWeightRef.current += (dz - depthWeightRef.current) * 0.04;
    }

    /* 极慢的呼吸：周期约 33 秒，幅度 5% —— "宇宙在呼吸"，不是特效 */
    const slowPulse = 1 + Math.sin(t * 0.19 + index) * 0.05;

    /* 星座：整体权重 × 距离景深 + 当前学习那颗的轻微呼吸 */
    const depth = depthWeightRef.current;
    if (stars.material?.uniforms) {
      stars.material.uniforms.uTime.value = t;
      stars.material.uniforms.uWeight.value = constellationWeight * slowPulse * depth;
    }
    if (lines.material?.uniforms) {
      lines.material.uniforms.uWeight.value = constellationWeight * depth;
    }
    if (halo?.uniforms) {
      halo.uniforms.uTime.value = t;
      halo.uniforms.uWeight.value = constellationWeight * slowPulse * depth;
    }

    if (body.current) {
      body.current.rotation.y += 0.002;
      const target = highlight ? 1.25 : 1;
      body.current.scale.lerp(
        new THREE.Vector3(target, target, target),
        0.1
      );

      const startedAt = flashStartRef.current;
      let flash = 0;
      if (startedAt !== null) {
        const age = (performance.now() - startedAt) / 1000;
        flash = age < 1.6 ? Math.max(0, 1 - age / 1.6) : 0;
        if (!flash) flashStartRef.current = null;
      }
      body.current.material.emissiveIntensity =
        baseEmissive * (1 + flash * 1.4);
    }

    if (atmosphere.current) {
      atmosphere.current.rotation.y -= 0.001;
      const target = highlight ? 1.4 : 1.12;
      atmosphere.current.scale.lerp(
        new THREE.Vector3(target, target, target),
        0.08
      );
    }

    if (innerGlow.current) {
      innerGlow.current.rotation.y -= 0.0015;
      const target = highlight ? 1.3 : 1.08;
      innerGlow.current.scale.lerp(
        new THREE.Vector3(target, target, target),
        0.08
      );
    }

    /* 完成度环：缓慢呼吸 */
    if (ring.current) {
      const pulse = Math.sin(t * 0.4 + index) * 0.5 + 0.5;
      ring.current.material.opacity = 0.6 + pulse * 0.2;
    }

    /* 当前星球：金色光柱 */
    if (beam.current) {
      const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
      beam.current.material.opacity = 0.15 + pulse * 0.2;
      beam.current.scale.y = 1 + pulse * 0.08;
    }

    /* 落后星球的琥珀脉冲环 */
    if (laggardRing.current) {
      const pulse = Math.sin(t * 1.2) * 0.5 + 0.5;
      laggardRing.current.material.opacity = 0.2 + pulse * 0.3;
      laggardRing.current.rotation.z = t * 0.3;
    }
  });

  const size = orbit.size * (done ? 1.06 : 1);

  /* =========================================================
     星座（Constellation）
     ---------------------------------------------------------
     一个学习方向 = 一个星座，不再是一颗行星。

     星星来自**真实学习内容**：planet.stages 就是这条路线上真实存在的
     阶段（每个有 title / lessonCount / progress / done），所以
     "星星的亮度"直接等于"这个阶段的完成度" —— 用户不看数字，
     也能从星光读出自己学到哪了。

     形状用带阻尼的随机游走生成：不规则、不对称、有疏密，
     不是圆 / 网格那种几何图形。
     ========================================================= */
  /* 方向派生种子：同一方向每次渲染形状一致，不会"星座乱跳" */
  const regionSeed = ((planet.id?.length || 3) * 7.13 + index * 3.7) % 100;

  const nodeStages = Array.isArray(planet.stages) ? planet.stages : [];
  const currentStageId = planet.currentStage?.id || null;

  /* 本方向的色相（星星 / 连线 / 底盘共用，形成"一整块区域"的观感） */
  const hueColor = useMemo(() => constellationHueFor(mood, planet), [mood, planet]);
  /* "今天"这一层的颜色：纸上把方向色调到墨色阶，否则高饱和环在米白纸上像贴纸 */
  const todayColor = useMemo(
    () => moodAccent(new THREE.Color(planet.accent || THAI_GOLD), mood),
    [planet.accent, mood]
  );

  const nodePoints = useMemo(
    () => constellationLayout(Math.max(1, nodeStages.length), regionSeed, size * 5.2),
    [nodeStages.length, regionSeed, size]
  );

  const stars = useMemo(() => {
    const pts = createConstellationStars(nodePoints.length, {
      pixelRatio: 1,
      mood,
    });
    /* 一次性写入真实进度：位置 + 亮度 + 大小 + 色温 */
    const pos = pts.geometry.getAttribute("position");
    const glow = pts.geometry.getAttribute("aGlow");
    const ssize = pts.geometry.getAttribute("aSize");
    const tint = pts.geometry.getAttribute("aTint");

    nodePoints.forEach((pt, i) => {
      pos.setXYZ(i, pt.x, pt.y, pt.z);

      const stage = nodeStages[i];
      let state = planet.state;
      if (stage) {
        if (stage.done) state = "done";
        else if (stage.id === currentStageId) state = "current";
        else if ((Number(stage.progress) || 0) > 0) state = "active";
        else state = planet.state === "uncharted" ? "uncharted" : "ahead";
      }

      const look = starStateFor(state, stage?.progress ?? planet.progress);
      glow.setX(i, look.glow);
      ssize.setX(i, look.size);
      /* 状态给出明暗与大小，方向色相给出"这是哪一个星座" */
      /* 方向色相占多少：深空 0.75（色相要压住状态色温，五个星座才分得开）；
         纸上/现代降到 0.62 —— 这两套色板本身已经足够区分，再压满会把
         "当前/已完成"的色温差吃掉（进度语义比色相更重要）。 */
      const tintMix = mood?.constellationHue ? 0.62 : 0.75;
      tint.setXYZ(
        i,
        Math.min(1, look.tint[0] * 0.45 + hueColor.r * tintMix),
        Math.min(1, look.tint[1] * 0.45 + hueColor.g * tintMix),
        Math.min(1, look.tint[2] * 0.45 + hueColor.b * tintMix)
      );
      if (state === "current") pts.userData.currentIndex = i;
    });

    pos.needsUpdate = true;
    glow.needsUpdate = true;
    ssize.needsUpdate = true;
    tint.needsUpdate = true;
    return pts;
  }, [nodePoints, nodeStages, currentStageId, planet.state, planet.progress, quality?.tier, hueColor, mood]);

  const lines = useMemo(
    () =>
      createConstellationLines(nodePoints, {
        color: veiled ? moodAccent(hueColor, mood, 0.9) : hueColor,
        /* 线只暗示关系：透明度压得很低，绝不成为视觉主体。
           三个数字按世界取（纸上要更实才印得出来，现代要更细更克制）。 */
        opacity: veiled
          ? lo.veiled
          : isCurrent || highlight
            ? lo.current
            : lo.base,
        mood,
      }),
    [nodePoints, veiled, isCurrent, highlight, hueColor, lo, mood]
  );

  /*
   * 星座整体权重。
   * 0.34 太狠了 —— 新用户所有星点本来就暗，再乘 0.34 就是一片看不见。
   * 提到 0.78：五个星座都清楚存在，当前/选中的那颗再额外拉满，
   * 靠"色相 + 底盘"而不是靠"把其他的压黑"来区分焦点。
   */
  const constellationWeight =
    (veiled ? 0.42 : highlight ? 1 : isCurrent ? 1 : 0.88) *
    (mood?.constellationBlend === "alpha" ? mood.starCount + 0.18 : 1);

  /* 星座底盘：一层极淡的方向色星云，用"区域"帮助分组 */
  const halo = useMemo(
    () =>
      createConstellationHalo({
        color: hueColor,
        seed: regionSeed,
        opacity: veiled ? 0.08 : Math.max(mood?.haloOpacity ?? 0.2, 0.09),
        mood,
      }),
    [hueColor, regionSeed, veiled, mood]
  );



  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(planet.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover?.(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(planet);
      }}
    >
      {/*
        星座本体：一组星点 + 断续连线。
        · 星星 = 真实学习阶段（亮度即完成度）
        · 连线 = 只暗示阶段顺序，透明度很低，不做成主体
        没有球体、没有圆环、没有轨道线。
      */}
      {/*
        底盘尺寸从 size×13 收到 size×8.5。
        实测：×13 时每片直径约 2.7 单位，五片在屏幕上连成一整块，
        连通域统计里始终是"1 个大团"而不是 5 个 —— 底盘太大反而
        把星座重新糊到一起了。
      */}
      <mesh scale={size * 8.5 * (mood?.haloScale ?? 1)} renderOrder={-3}>
        <planeGeometry args={[1, 1]} />
        <primitive object={halo} attach="material" />
      </mesh>
      <primitive object={stars} />
      <primitive object={lines} />

      {/*
        交互命中体：不可见，但保证 hover / click 依然好点中。
        星云是朝向相机的薄片、还会飘动，直接拿它当命中目标会很难点；
        这个球只负责接收指针事件，不参与渲染（opacity 0 + depthWrite false）。
        功能契约（拖拽后忽略点击、hover 高亮、点击选中）完全不变。
      */}
      <mesh>
        <sphereGeometry args={[Math.max(size * 1.8, 0.34), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 星尘遮蔽 */}
      <VeilDust
        veil={veil}
        size={size}
        quality={quality}
        cleared={todayActive ? Math.max(0.5, todayIntensity) : 0}
        mood={mood}
      />

      {/* 完成度改由星点亮度表达，3D 里不再画环 —— 环会被读成轨道 */}

      {/* 今日活动 */}
      {todayActive ? (
        <>
          <TodayThread
            hostRef={group}
            intensity={todayIntensity}
            color={todayColor}
            reduced={reducedMotion}
            quality={quality}
            mood={mood}
          />
          <TodayPulse
            intensity={todayIntensity}
            size={size}
            color={todayColor}
            reduced={reducedMotion}
            mood={mood}
          />
        </>
      ) : null}

      {/* 冲击波 */}
      {burstSeq ? (
        <TodayBurst key={burstSeq} size={size} color={todayColor} mood={mood} />
      ) : null}

      {/* 画像卫星 */}
      {planet.satellites?.map((sat, satIndex) => (
        <Satellite
          key={sat.id}
          sat={sat}
          index={satIndex}
          total={planet.satellites.length}
          hostSize={size}
          accent={planet.accent}
          onSelect={onSelect}
          mood={mood}
        />
      ))}
    </group>
  );
}

/* =========================================================
   轨道线 · 极细 + 透视倾斜
   ── 只保留4-5条主轨道，删除冗余环线 ──
========================================================= */

function OrbitLines({ planets, activeId = null, mood = null }) {
  /*
   * 轨迹。
   * ============================================================
   * 改造前：每个方向一条**完整 torusGeometry 椭圆**（半径 2.15 起、等距 +0.52），
   * 5 条同心完整圆环 —— 这是"太阳系轨道图"观感的直接来源，
   * 也是用户说"大量椭圆轨道形成明显几何结构"的那一项。
   *
   * 现在：每层只保留几段**非连续弧片段**，逐顶点 alpha 淡入淡出。
   * 目标是"感觉到轨道存在"，而不是"一眼看到 5 条椭圆"。
   *
   * 数据契约不变：半径仍然跟随 planet.radius（= 掌握度收紧后的半径），
   * 所以空间语义（越熟越靠内）完全保留，只是不再画成闭合曲线。
   */
  const arcs = useMemo(
    () =>
      planets.map((planet, index) => {
        const base = 2.15 + index * 0.52;
        const radius =
          typeof planet.radius === "number" ? planet.radius : base;
        const isCurrent = planet.state === "current";
        const isActive = activeId === planet.id;
        const veiled = planet.veil?.tier !== "none";

        /* 轨道线的颜色与透明度都按世界取：
           纸上 = 细金线（古典星图的经纬线），现代 = 更细更冷的数据线。 */
        const oo = mood?.orbitOpacity || { veiled: 0.045, active: 0.2, base: 0.075, step: 0.006 };
        const opacity = veiled
          ? oo.veiled
          : isCurrent || isActive
            ? oo.active
            : oo.base - index * oo.step;

        const color =
          isCurrent || isActive
            ? moodAccent(new THREE.Color(THAI_GOLD), mood)
            : veiled
              ? moodAccent(new THREE.Color("#556070"), mood, mood?.ink ? 0.8 : 0)
              : index === 0
                ? moodAccent(new THREE.Color(THAI_GOLD), mood)
                : moodAccent(new THREE.Color("#6a8aaa"), mood, mood?.ink ? 0.8 : 0);

        const arc = createTraceArc(radius, {
          /* 段数与跨度都刻意小：越少越"断"，几何感越弱 */
          segments: isCurrent || isActive
            ? mood?.orbitSegments?.active ?? 9
            : (mood?.orbitSegments?.base ?? 5) + (index % 3),
          arcSpan: isCurrent || isActive ? 0.15 : 0.1,
          /* 朝向：createTraceArc 生成的点**已经在 XZ 水平面**（x=cos, z=sin），
             所以这里只给一点点"轨道倾角"，绝不能再转 π/2 ——
             那是给 XY 平面的 torusGeometry 用的约定。多转 90° 会让所有轨道
             立起来，在屏幕上就是几道斜向的粒子带（实测截图里那条斜带）。 */
          tilt: index * 0.035,
          color,
          opacity,
          seed: index * 7 + 1,
        });
        return { id: planet.id, arc, material: arc.material };
      }),
    [planets, activeId, mood]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    arcs.forEach(({ material }, index) => {
      if (!material) return;
      /* 极慢的明暗流动：让轨迹"若隐若现"，而不是静态几何线 */
      const target = material.userData.baseOpacity ?? material.uniforms.uOpacity.value;
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = target;
      }
      material.uniforms.uOpacity.value =
        target * (0.72 + Math.sin(t * 0.18 + index * 1.1) * 0.28);
    });
  });

  return (
    <group>
      {arcs.map(({ id, arc }) => (
        <primitive key={id} object={arc} />
      ))}
    </group>
  );
}

/* =========================================================
   前景尘埃 · 大型虚焦光点（景深）
   ── 真实深空摄影的近景：几颗大而模糊的光斑缓慢飘过。
      这一层给画面一个「镜头位置」，是电影感的关键。
========================================================= */

function ForegroundDust({ count = 26, quality, mood = null }) {
  const group = useRef(null);

  const points = useMemo(
    () =>
      createBokehDust(mood?.foreground?.count ?? count, {
        color: new THREE.Color(mood?.foreground?.color || "#cfd8e4"),
        opacityScale: mood?.foreground?.opacityScale ?? 1,
        sizeScale: mood?.foreground?.sizeScale ?? 1,
        blend: mood?.ink ? "alpha" : "add",
      }),
    [count, mood]
  );

  useFrame(({ clock, viewport }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    /* 极慢自转 = 视差；不做位移动画，避免"粒子在飞" */
    group.current.rotation.y = t * 0.006;
    if (points.material?.uniforms) {
      points.material.uniforms.uTime.value = t;
      points.material.uniforms.uPixelRatio.value = viewport?.dpr || 1;
    }
  });

  /* 低质量设备上跳过：这是纯氛围层，去掉不影响任何功能 */
  if (quality?.tier === "low") return null;

  return (
    <group ref={group}>
      <primitive object={points} />
    </group>
  );
}

/* =========================================================
   星空 · 真实大小不一 + 暗淡为主
========================================================= */

function Starfield({ count = 900, radius = 20, mood = null, pixelRatio = 1 }) {
  const points = useRef(null);

  /*
   * 改造前的星场有三个问题（都指向"像几何体"）：
   *   ① 只有 160 颗，且用 PointsMaterial 的固定 size —— 每颗一样大；
   *   ② 几何体上那个 `size` 属性**根本没被默认材质使用**，
   *      所以 useFrame 里逐颗改 size 的循环是空转；
   *   ③ 默认点精灵是**方块**，放大就是像素格子。
   *
   * 现在：900+ 颗、幂律亮度分布（绝大多数暗淡、极少数明亮）、
   * 三种色温（冷白/中性/暖黄），并用自定义着色器画**圆形羽化光点**。
   * 分布按种子固定，刷新后星场一致，不会"星星乱跳"。
   */
  const geometry = useMemo(
    () => buildStarField(new THREE.BufferGeometry(), count, {
      spread: radius,
      flatness: 0.55,
      seed: 7,
    }),
    [count, radius]
  );

  /*
   * 星场材质换成世界感知版（deepSpace.createPaletteStarFieldMaterial）。
   * 为什么必须换：原材质是纯加光，落在米白纸上等于什么都不画 ——
   * 纸上需要的是"墨点"，颜色、大小与混合方式三者都得跟着世界走。
   * planetShading 里那份原实现保持不动（其他场景可能还在用）。
   */
  const material = useMemo(
    () => createPaletteStarFieldMaterial(mood || resolveGalaxyMood("midnight"), { pixelRatio }),
    [mood, pixelRatio]
  );

  useFrame(({ clock }) => {
    if (!points.current) return;
    const t = clock.elapsedTime;
    points.current.rotation.y = t * 0.012;

    if (material.uniforms) {
      /* 整体呼吸：极缓慢，避免闪烁感。纸上/现代收敛得更平（节奏感不属于这两个世界） */
      const breathe = mood?.ink ? 0.06 : mood?.id === "modern" ? 0.08 : 0.18;
      material.uniforms.uOpacity.value =
        0.9 - breathe * 0.5 + (Math.sin(t * 0.22) * 0.5 + 0.5) * breathe;
    }
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/* =========================================================
   背景星云 · 极克制的深色星云
   ── 不是紫色霓虹，是深墨绿/深蓝的微妙氛围 ──
========================================================= */

function NebulaBackground({ mood = null }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.003;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.01) * 0.02;
  });

  /*
   * 背景星云粒子。
   * ---------------------------------------------------------
   * 改造前用默认 pointsMaterial（无贴图）—— WebGL 的点精灵默认是**方块**，
   * size 1.8 + sizeAttenuation 在屏幕上渲染成十几像素的灰色方块，
   * 就是截图里散布的"马赛克斑点"。
   * 现在换成自定义着色器：圆形羽化光点 + 逐点随机大小，远处看是柔雾颗粒。
   */
  const { geometry, material } = useMemo(() => {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    /* 星云色随世界走：深空是墨绿/暗金、纸上是极淡的晕染、现代更冷更少 */
    const palette = mood?.nebulaPalette || [
      [0.10, 0.17, 0.14],  /* 深墨绿 */
      [0.07, 0.12, 0.16],  /* 深蓝绿 */
      [0.14, 0.11, 0.07],  /* 暗金 */
      [0.06, 0.09, 0.12],  /* 深灰蓝 */
    ];
    for (let i = 0; i < count; i += 1) {
      const r = 12 + Math.random() * 16;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
      sizes[i] = 0.7 + Math.pow(Math.random(), 2.0) * 2.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    /*
     * 星云浓度。
     * 纸上/现代同样不能用加成（米白纸上加成等于没画），但星云是"雾"不是"星"，
     * 只要压低浓度 + 换成每个世界自己的 palette 就够 —— 不必再分一套着色器。
     */
    const nebulaOpacity = mood?.nebulaOpacity ?? 1;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uNebula: { value: nebulaOpacity },
      },
      vertexShader: `
        attribute float aSize;
        uniform float uPixelRatio;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (34.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uNebula;
        varying vec3 vColor;
        void main() {
          /* 圆形羽化光点：中心亮、边缘透明，不再是方块 */
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float a = pow(max(0.0, 1.0 - d), 2.2) * 0.16 * uNebula;
          /* 纯加光：alpha 写 0，不向画布 alpha 累积（避免黑盘压暗视频）。
             uNebula 是世界浓度：林间留雾、纸上极淡、现代几乎没有。 */
          gl_FragColor = vec4(vColor * a, 0.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      vertexColors: true,
    });
    return { geometry: geo, material: mat };
  /*
   * 依赖只写 mood。
   * 踩过的坑：这里原来写的是 `[mood, nebulaOpacity]`，但 `nebulaOpacity`
   * 是在上面 useMemo 的**回调内部**声明的局部变量 —— 依赖数组在外部作用域，
   * 于是每次渲染都抛 `ReferenceError: nebulaOpacity is not defined`，
   * 整个 3D 场景挂不上（四个世界的画布全空）。
   * eslint 与 npm run build 都**不会**报这个错，只有真实浏览器运行时才暴露。
   * nebulaOpacity 派生自 mood，所以依赖 mood 就是正确且充分的。
   */
  }, [mood]);

  useFrame(({ viewport }) => {
    if (material.uniforms) {
      material.uniforms.uPixelRatio.value = viewport?.dpr || 1;
    }
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

/* =========================================================
   相机
========================================================= */

/* 电影构图偏移：注视点左移 + 略抬，主体落右侧三分线 */
const COMPOSE = new THREE.Vector3(-0.9, 0.12, 0);

function OrbitRig({ controls, reducedMotion, focusPoint = null }) {
  const camera = useThree((state) => state.camera);
  /*
   * 注视点。
   * ---------------------------------------------------------
   * 改造前永远 lookAt(0,0,0) —— 相机被钉在"太阳系中心"，
   * 所以无论用户选哪个方向，画面都不动，缺少"进入星域"的感觉。
   *
   * 现在：注视点向**选中星域**缓慢漂移（阻尼 0.012 ≈ 数秒到位），
   * 用户一拖动就立刻回到自由视角（follow 系数由 lastInputAt 决定）。
   * 这是"镜头缓慢移动到 Culture"，不是瞬移、也不是弹 Modal。
   */
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const follow = useRef(0);

  useFrame(({ clock }, delta) => {
    const state = controls?.current;
    if (!state) return;

    const stepped = stepOrbit(state, Math.min(delta || 0, 0.05));
    state.yaw = stepped.yaw;
    state.pitch = stepped.pitch;
    state.distance = stepped.distance;

    const idleSeconds = performance.now() / 1000 - (state.lastInputAt || 0);
    const drift = idleDrift({ idleSeconds, reducedMotion }, clock.elapsedTime);

    const [x, y, z] = cameraPosition(
      state.yaw + drift.yawOffset,
      clampPitch(state.pitch + drift.pitchOffset),
      state.distance * drift.distanceScale
    );
    camera.position.set(x, y, z);

    /* 用户刚操作过 → 立刻松开焦点，避免"抢镜头" */
    const userActive = idleSeconds < 2.2;
    const want = focusPoint && !userActive ? 1 : 0;
    /* 对焦速度 0.03 → 0.02：镜头缓慢"跟上"，而不是一下跳过去 */
    follow.current += (want - follow.current) * 0.02;

    /*
     * 电影构图（用户要求：禁止对称）。
     * 镜头注视点整体向左偏 → 主体（星域）落在画面右侧三分线，
     * 左侧留出深空负空间。这个偏移是**常量**，所以它不会和用户拖动打架，
     * 也不会让"中心"跑出画面。
     */
    const target = COMPOSE.clone();
    if (focusPoint) {
      /* 只偏移一部分（0.62）：星域移到画面偏右，中心仍可见 */
      target.addScaledVector(focusPoint, 0.62 * follow.current);
    }
    /* 插值降到 0.007 ≈ 1.5~2 秒到位（聚焦拉镜的时长） */
    look.current.lerp(target, 0.007);

    camera.lookAt(look.current);
  });

  return null;
}

/* =========================================================
   出口
========================================================= */

export default function GalaxyScene({
  planets,
  activeId,
  /* 当前被"选中"的方向（用于镜头移动）。与 activeId 分开：
     activeId 还包含 hover，hover 不该带动镜头。 */
  focusId = null,
  onHover,
  onSelect,
  quality,
  reducedMotion,
  theme = null,
  controls = null,
  today = null,
  /** 视觉世界（worlds.js 的 visualMode）。缺失即按基准世界（midnight）渲染 */
  visualMode = "midnight",
}) {
  /*
   * 世界氛围。
   * ---------------------------------------------------------
   * 一个 memo 解析出全部"这个世界的星图长什么样"（颜色 / 混合 / 数量 /
   * 光晕），下面每个组件只消费它，不再各自 if (world === ...)。
   * 依赖只有 visualMode：切世界时整棵 3D 树重建一次材质，平时零成本。
   */
  const mood = useMemo(() => resolveGalaxyMood(visualMode), [visualMode]);

  /*
   * 主题强调色。
   * 纸世界不能直接用 UI 强调色（#9A7B2E 在这个尺寸上会偏绿），
   * 由 moodAccent 统一拉到该世界的星图色阶；没有主题时回落到该世界的默认金。
   */
  const accent = useMemo(
    () =>
      moodAccent(new THREE.Color(theme?.accent || mood.defaultAccent), mood),
    [theme?.accent, mood]
  );
  const accentHex = useMemo(() => `#${accent.getHexString()}`, [accent]);
  const activity = today?.intensity || 0;

  /*
   * 焦点坐标：与 Planet 的轨道公式保持一致（半径 = 掌握度收紧后的半径，
   * 高度与相位沿用同一套参数），所以镜头看向的正是那颗星域所在处。
   * 只取相位、不加入时间项 —— 轨道极慢，静态近似足够，且避免每帧抖动。
   */
  const focusPoint = useMemo(() => {
    if (!focusId) return null;
    const index = planets.findIndex((p) => p.id === focusId);
    if (index < 0) return null;
    const planet = planets[index];
    const base = 2.15 + index * 0.52;
    const r = typeof planet.radius === "number" ? planet.radius : base;
    const phase =
      (index / Math.max(planets.length, 1)) * Math.PI * 2 + index * 0.4;
    const height = Math.sin(index * 1.37) * 0.35;
    return new THREE.Vector3(
      Math.cos(phase) * r,
      height,
      Math.sin(phase) * r * 0.55
    );
  }, [focusId, planets]);

  return (
    <>
      <OrbitRig
        controls={controls}
        reducedMotion={reducedMotion}
        focusPoint={focusPoint}
      />

      {/*
        深空背景球已移除。
        ---------------------------------------------------------
        它原来是一个不透明的 BackSide 球（#040808），把画布铺成纯黑 ——
        也正好挡住了容器下层那张真实星空视频。WorldCanvas 本身就是
        alpha 透明的（WorldStage 里 gl.alpha = true），所以去掉它之后，
        底色直接由视频提供，3D 星域/轨迹/星云以加成方式叠在影像之上。

        如果视频没上（「减弱动效」或加载失败），露出的就是容器自己的
        深色底 + 页面背景，观感依然成立。
      */}

      {/* 背景星云 */}
      <NebulaBackground mood={mood} />

      {/* 灯光：克制、电影级，且**有方向**（右上暖金主光 + 左后冷色补光） */}
      <ambientLight intensity={0.3} color="#7a8a98" />
      <directionalLight position={[4, 5, 3]} intensity={0.65} color="#c8d8e8" />
      {/* 暖金主光：从右上穿过画面，落到星体上就有"方向"与衰减 */}
      <directionalLight position={[5.5, 3.2, -2.4]} intensity={0.55} color="#ffd9a8" />
      <pointLight
        position={[-4, -2, -3]}
        intensity={0.7}
        color={accentHex || "#5a7a8a"}
        distance={16}
      />
      <pointLight position={[0, -3, 1]} intensity={0.3} color="#3a5a6a" distance={10} />

      <StellarCore quality={quality} accent={accentHex} activity={activity} mood={mood} />
      <OrbitLines planets={planets} activeId={activeId} mood={mood} />

      {planets.map((planet, index) => (
        <Planet
          key={planet.id}
          planet={planet}
          index={index}
          total={planets.length}
          active={activeId === planet.id}
          onHover={onHover}
          onSelect={onSelect}
          quality={quality}
          themeAccent={accent}
          burstSeq={
            today?.burst?.planetId === planet.id ? today.burst.seq : null
          }
          reducedMotion={reducedMotion}
          mood={mood}
        />
      ))}

      {/*
        星场。数量随世界走：深空 1100（满天星）、林间 1000（雾里少一些）、
        纸上 780（印在纸上的星点不能太密，否则整张纸变灰）、
        现代 900 但更小更准（数据感来自"稀疏 + 精确"，不是"多"）。
      */}
      {quality?.tier !== "low" ? (
        <Starfield
          count={mood.fieldCount}
          radius={mood.fieldSpread}
          mood={mood}
          /* 恒为 1：gl_PointSize 本身就是物理像素，画布已按 dpr 放大过，
             再乘一次 dpr 会让基准世界的星点整体翻倍（与原实现不一致）。 */
          pixelRatio={1}
        />
      ) : (
        <Starfield
          count={mood.fieldCountLow}
          radius={mood.fieldSpread * 0.5}
          mood={mood}
          pixelRatio={1}
        />
      )}

      {/* 前景：大型虚焦尘埃（景深层），最后绘制。纸上/现代减量 */} 
      <ForegroundDust count={26} quality={quality} mood={mood} />
    </>
  );
}
