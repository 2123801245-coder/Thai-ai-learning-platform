// src/components/world/WorldCanvas.jsx
//
// =========================================================
// ThaiAI World · R3F 画布本体（**只能被懒加载**）
// =========================================================
//
// 这个文件单独存在的唯一原因：把 @react-three/fiber 与 three.js
// 挡在首页主包之外。
//
// 反例（改回去会踩的坑）：如果组件在顶层 `import { Canvas } from
// "@react-three/fiber"`，Rollup 就会把 three（压缩后 ~690KB / gzip 176KB）
// 静态挂进首页 chunk —— 用户还没看到 3D 就先下了 176KB。
// 现在 WorldStage 用 React.lazy 引入本文件，于是：
//   没进视口 / 没有 WebGL / ?world=static  → 一个字节都不下载
// =========================================================

import React, { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { registerWorldSnapshot } from "@/lib/worldSnapshot";

/*
 * 渲染探针（开发态）
 * ---------------------------------------------------------
 * WebGL 画布的内容无法用 DOM 断言或截图可靠验证：本机预览的截图只能抓
 * 首帧，而不设 preserveDrawingBuffer 时 readPixels 读到的是已清空的缓冲
 * ——两者都会给出假的「什么都没画」。这个探针把真实渲染统计写到 canvas
 * 的 data-* 上，任何一次验收都能用一行 DOM 查询确认几何体被画出来了。
 * 只在开发环境写入，生产零开销。
 */
function RenderProbe() {
  const gl = useThree((state) => state.gl);
  const last = useRef(0);

  useFrame(({ clock }) => {
    if (!import.meta.env.DEV) return;
    if (clock.elapsedTime - last.current < 1) return;
    last.current = clock.elapsedTime;
    const canvas = gl.domElement;
    canvas.dataset.drawCalls = String(gl.info.render.calls);
    canvas.dataset.triangles = String(gl.info.render.triangles);
    canvas.dataset.programs = String(gl.info.programs?.length ?? 0);
    canvas.dataset.worldgl = "live";
  });

  return null;
}

/*
 * 快照桥（给「分享成就卡」用）
 * ---------------------------------------------------------
 * preserveDrawingBuffer=false 时，缓冲在每次绘制后就被清掉，事后调用
 * toDataURL 只会得到一张全透明的图。所以这里先手动 render 一帧，**紧接着**
 * 同步取像素——中间不能有任何 await，否则浏览器可能已经清了缓冲。
 *
 * 登记而不是传 ref：分享卡在世界区、画布在英雄区，中间隔了好几层组件。
 */
function SnapshotBridge({ snapshotKey }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!snapshotKey) return undefined;
    return registerWorldSnapshot(snapshotKey, () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
  }, [snapshotKey, gl, scene, camera]);

  return null;
}

/**
 * @param {object}   props
 * @param {object}   props.camera       R3F camera 配置
 * @param {number[]} props.dpr          dpr 区间
 * @param {object}   props.glOptions    WebGL 参数
 * @param {string}   props.frameloop    always | demand | never
 * @param {string}   props.snapshotKey  登记到 worldSnapshot 的键（可空）
 * @param {Function} props.children     场景内容
 */
export default function WorldCanvas({
  camera,
  dpr,
  glOptions,
  frameloop,
  snapshotKey,
  children,
}) {
  return (
    <Canvas
      camera={camera}
      dpr={dpr}
      gl={glOptions}
      frameloop={frameloop}
      onCreated={({ gl }) => {
        /* 透明清屏色：让 CSS 背景（深空渐变）透出来，省一次全屏绘制 */
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <RenderProbe />
      <SnapshotBridge snapshotKey={snapshotKey} />
      {children}
    </Canvas>
  );
}
