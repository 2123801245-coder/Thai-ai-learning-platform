// src/components/world/StoneOrbCanvas.jsx
//
// =========================================================
// 五尊白色石雕 Orb · WebGL 画布本体（**只能被懒加载**）
// =========================================================
//
// 与 WorldCanvas.jsx 同样的理由：这个文件单独存在，就是为了把
// @react-three/fiber 与 three.js 挡在首页主包之外。上层（UniverseRow）
// 用 React.lazy 引它 —— 没有 WebGL / 减弱动效 / 画布不在视口时，
// three 一个字节都不下载。
//
// 一个 Canvas，五个 Orb Mesh（不是五个 Canvas）：
//   · 动画全部走 useFrame + ref + uniform，**没有每帧 setState**
//   · 悬浮态只在 pointerover/out 时改一次 state，中间用 ref 插值
//   · 浮雕是开机算一遍的 256² 程序化法线贴图，每帧只采样两次
//
// 坐标：上层给的是**归一化画布坐标**（0..1），这里换算成世界坐标。
// 于是 DOM 文字标签（用同样的百分比定位）与 3D 球在任意宽高比下都对齐。

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { getOrbTextureData } from "./stoneOrbArt";
import { ORB_FRAG, ORB_TINT, ORB_VERT } from "./stoneOrbGlsl";

/* 贴图：每个世界只生成一次，五个球共用同一张 */
const textureCache = new Map();
function orbTexture(worldId) {
  if (textureCache.has(worldId)) return textureCache.get(worldId);
  const { data, size } = getOrbTextureData(worldId);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping; // 经度方向环绕
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  textureCache.set(worldId, tex);
  return tex;
}

/* 状态 → 着色器里的 uState */
const stateCode = (planet, locked) =>
  locked ? 3 : planet.state === "done" ? 1 : planet.state === "current" || planet.state === "active" ? 2 : 0;

function Orb({ planet, slot, palette, locked, hovered, expanding, onHover, onSelect }) {
  const mesh = useRef(null);
  const hover = useRef(0);
  const uniformRef = useRef(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);

  const state = stateCode(planet, locked);
  const tint = ORB_TINT[planet.id] || ORB_TINT.foundation;

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 64, 48), []);
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: ORB_VERT,
      fragmentShader: ORB_FRAG,
      uniforms: {
        uMap: { value: orbTexture(planet.id) },
        uTime: { value: 0 },
        uPhase: { value: slot.phase },
        uHover: { value: 0 },
        uState: { value: state },
        uInner: { value: palette.inner },
        uRelief: { value: palette.relief },
        uDeform: { value: palette.deform },
        uStone: { value: new THREE.Vector3(...palette.stone) },
        uAmbient: { value: new THREE.Vector3(...palette.ambient) },
        uRim: { value: new THREE.Vector3(...palette.rim) },
        uGold: { value: new THREE.Vector3(...palette.gold) },
        uTint: { value: new THREE.Vector3(...tint) },
        uLight: { value: new THREE.Vector3(...palette.light).normalize() },
      },
    });
    uniformRef.current = m.uniforms;
    return m;
  }, [planet.id]);

  /* 主题切换（深/浅）只改 uniform，不重建几何体与贴图 */
  useEffect(() => {
    if (!uniformRef.current) return;
    uniformRef.current.uInner.value = palette.inner;
    uniformRef.current.uRelief.value = palette.relief;
    uniformRef.current.uDeform.value = palette.deform;
    uniformRef.current.uStone.value.set(...palette.stone);
    uniformRef.current.uAmbient.value.set(...palette.ambient);
    uniformRef.current.uRim.value.set(...palette.rim);
    uniformRef.current.uGold.value.set(...palette.gold);
    uniformRef.current.uLight.value.set(...palette.light).normalize();
  }, [palette]);

  useEffect(() => {
    if (uniformRef.current) uniformRef.current.uState.value = state;
  }, [state]);

  /* 悬停可能来自球本身，也可能来自它下面的文字标签（两个入口都要亮） */
  useEffect(() => {
    if (mesh.current) mesh.current.userData.hovered = Boolean(hovered);
    /* 减弱动效时画布停在 demand，得手动要一帧 */
    invalidate();
  }, [hovered, expanding, invalidate]);

  useFrame((_, delta) => {
    const u = uniformRef.current;
    if (!u || !mesh.current) return;
    u.uTime.value += delta;
    /* 悬停 / 离开 / 展开都是插值过去的，不是瞬间切换 */
    const target = expanding ? 1.6 : mesh.current.userData.hovered ? 1 : 0;
    hover.current += (target - hover.current) * Math.min(1, delta * (expanding ? 7 : 6));
    u.uHover.value = hover.current;
    const s = slot.scale * (1 + hover.current * 0.06);
    mesh.current.scale.setScalar(s);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      position={slot.position}
      userData={{ worldId: planet.id }}
      /* 仅开发态：证明拾取真的命中了这颗球（生产不挂这个 handler） */
      onPointerDown={
        import.meta.env.DEV
          ? () => {
              gl.domElement.dataset.orbLastDown = planet.id;
            }
          : undefined
      }
      onPointerOver={(e) => {
        e.stopPropagation();
        if (mesh.current) mesh.current.userData.hovered = true;
        onHover?.(planet.id, true);
      }}
      onPointerOut={() => {
        if (mesh.current) mesh.current.userData.hovered = false;
        onHover?.(planet.id, false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        /* 开发态留痕：WebGL 里的命中无法用 DOM 断言验证，写个标记便于验收 */
        if (import.meta.env.DEV) gl.domElement.dataset.orbLastClick = planet.id;
        onSelect?.(planet, locked);
      }}
    />
  );
}

/* 归一化坐标 → 世界坐标（z=0 平面） */
function Field({ planets, slots, palette, orbPx, hoverId, expandingId, onHover, onSelect }) {
  const { viewport, size } = useThree();
  const radius = (orbPx / size.height) * viewport.height * 0.5;

  const placed = useMemo(
    () =>
      slots.map((s) => ({
        ...s,
        position: [(s.x - 0.5) * viewport.width, (0.5 - s.y) * viewport.height, 0],
      })),
    [slots, viewport.width, viewport.height]
  );

  return (
    <>
      {planets.map((planet, i) => {
        const slot = placed[i];
        if (!slot) return null;
        return (
          <Orb
            key={planet.id}
            planet={planet}
            slot={{ ...slot, scale: slot.scale * radius }}
            palette={palette}
            locked={Boolean(planet.locked)}
            hovered={hoverId === planet.id}
            expanding={expandingId === planet.id}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

/*
 * 渲染探针（仅开发态）。
 * WebGL 画面无法用 DOM 断言或截图可靠验证（本机预览的合成器不可靠），
 * 所以把真实的渲染统计写到 canvas 的 data-* 上 —— 一行 DOM 查询就能确认
 * 几何体确实被画出来了。生产环境零开销。
 */
function RenderProbe({ slots, orbPx }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const last = useRef(-Infinity);

  useFrame(({ clock }) => {
    if (!import.meta.env.DEV) return;
    /* 首帧必须写：demand 模式下可能只渲染这一帧 */
    if (clock.elapsedTime - last.current < 1) return;
    last.current = clock.elapsedTime;
    const cv = gl.domElement;
    cv.dataset.orbDrawCalls = String(gl.info.render.calls);
    cv.dataset.orbTriangles = String(gl.info.render.triangles);
  });

  /*
   * 像素取证（仅开发态）。
   * 未保留绘制缓冲的 WebGL 画布：toDataURL 读回来是空的，帧首 readPixels
   * 读到的也是已被清空的缓冲（实测全 0）。像素只能在**绘制刚结束**时读，
   * 也就是 scene.onAfterRender —— three 的渲染器本身没有这个回调。
   * 每颗球取中心 3×3 求均色写进 data-orbSamples：既证明球画在了槽位上、
   * 材质是石材色，也证明深/浅两套调色板真的改变了它。
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ctx = gl.getContext(); // gl 是渲染器，裸上下文在 getContext() 上
    const buf = new Uint8Array(3 * 3 * 4);
    const read = (w, h, px, py) => {
      const x = Math.max(0, Math.min(w - 3, Math.round(px) - 1));
      const y = Math.max(0, Math.min(h - 3, Math.round(py) - 1)); // WebGL 的 y 轴朝上
      ctx.readPixels(x, y, 3, 3, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < buf.length; i += 4) {
        r += buf[i];
        g += buf[i + 1];
        b += buf[i + 2];
      }
      return [Math.round(r / 9), Math.round(g / 9), Math.round(b / 9)];
    };
    let lastSample = -Infinity;
    const sample = () => {
      try {
        /* readPixels 会同步 GPU，别每帧都做 */
        const now = performance.now();
        if (now - lastSample < 400) return;
        lastSample = now;
        const w = gl.domElement.width;
        const h = gl.domElement.height;
        const scale = gl.getPixelRatio();
        /* 球心取「材质底色」，边缘取「边缘光／内光」——悬停主要改后者 */
        const centers = [];
        const rims = [];
        slots.forEach((s) => {
          const cx = s.x * w;
          const cy = (1 - s.y) * h;
          centers.push(read(w, h, cx, cy));
          rims.push(read(w, h, cx + (orbPx * scale * 0.5 * s.scale) * 0.78, cy));
        });
        gl.domElement.dataset.orbSamples = JSON.stringify(centers);
        gl.domElement.dataset.orbRimSamples = JSON.stringify(rims);
      } catch (err) {
        gl.domElement.dataset.orbSampleError = String(err).slice(0, 90);
      }
    };
    const prev = scene.onAfterRender;
    scene.onAfterRender = (renderer, ...rest) => {
      prev?.(renderer, ...rest);
      sample();
    };
    return () => {
      scene.onAfterRender = prev;
    };
  }, [gl, scene, slots, orbPx]);

  return null;
}

export default function StoneOrbCanvas({
  planets = [],
  slots = [],
  palette,
  orbPx = 88,
  hoverId = null,
  expandingId = null,
  paused = false,
  dpr = [1, 1.5],
  antialias = false,
  onReady,
  onContextLost,
  onHover,
  onSelect,
}) {
  /*
   * 上下文可能在**就绪之后**丢失（显存吃紧 / 设备休眠 / 页面开了太多
   * 画布）。那种情况下画布会变空白，而静态石雕兜底已经被隐藏 —— 用户看到的
   * 是一条空带。所以监听丢失事件，把兜底再露出来。
   */
  const handleCreated = (state) => {
    state.gl.domElement.addEventListener("webglcontextlost", () => onContextLost?.());
    onReady?.();
  };

  return (
    <Canvas
      /* 一个画布，五个球。注意：Canvas 的未知 props 会被 R3F 透传到外层 div，
         所以抗锯齿只能写在 gl 里，不能作为 Canvas 的属性传进来。 */
      frameloop={paused ? "demand" : "always"}
      dpr={dpr}
      gl={{ alpha: true, antialias, powerPreference: "low-power" }}
      camera={{ fov: 32, position: [0, 0, 4], near: 0.1, far: 20 }}
      onCreated={handleCreated}
      style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
    >
      <RenderProbe slots={slots} orbPx={orbPx} />
      <Field
        planets={planets}
        slots={slots}
        palette={palette}
        orbPx={orbPx}
        hoverId={hoverId}
        expandingId={expandingId}
        onHover={onHover}
        onSelect={onSelect}
      />
    </Canvas>
  );
}
