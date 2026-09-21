// src/components/world/orbitControls.js
//
// =========================================================
// 星系的相机操控（纯函数，不碰 DOM / 不碰 three）
// =========================================================
//
// 为什么自己写而不用 @react-three/drei 的 OrbitControls：
//   drei 的 stats-gl 会带进**第二份 three 实例**，触发 three.js 的
//   "Multiple instances of Three.js" 警告（我为此把 drei 整个移除过，
//   见 GalaxyScene 的 SpaceDust 注释）。为了一个轨道相机把 176KB 的重复
//   three 拉回来不值——而且这里的需求比 OrbitControls 小得多：
//   拖动转、捏合/按钮缩、闲时自己缓漂、能回位。
//
// 拆成纯函数的好处：俯仰角夹紧、缩放边界、阻尼收敛、闲时漂移的淡入
// 这些最容易写错又最难在浏览器里观察的东西，可以在 .check-world.mjs 里
// 直接断言，不用开页面。
//
// 相机用**球坐标**描述：yaw 绕 Y、pitch 是仰角、distance 是到原点距离
// （原点就是中央恒星=路线锚点，所以 lookAt 永远是 (0,0,0)）。
// 默认值与改造前的固定机位 (0, 3.4, 7.2) 完全一致，所以接管那一刻画面不动。
// =========================================================

/* =========================================================
   常量
========================================================= */

/*
 * 默认机位 = 改造前那个固定机位（CameraDrift 的基准点）。
 * 从这里反算球坐标而不是手写小数：接管相机的那一帧必须**一分不差**地
 * 落在同一位置，否者用户进入页面会看到镜头抳一下。手写的 7.963 / 0.442
 * 会引入 0.006 的偏差（我一开始就是这么写的，被断言抓到了）。
 */
const DEFAULT_CAMERA_XYZ = [0, 3.4, 7.2];
const DEFAULT_DISTANCE = Math.hypot(...DEFAULT_CAMERA_XYZ);
export const ORBIT_DEFAULTS = {
  distance: DEFAULT_DISTANCE,
  /* asin(y / d)：反算仰角，sin(pitch)·distance 恰好等于 3.4 */
  pitch: Math.asin(DEFAULT_CAMERA_XYZ[1] / DEFAULT_DISTANCE),
  yaw: 0,
  /* 供断言/调试用：默认机位的笛卡尔坐标 */
  cameraXYZ: DEFAULT_CAMERA_XYZ,
};

export const ORBIT_LIMITS = {
  /* 不让相机钻到轨道平面下方（下面什么都看不到），也不让到正上方（轨道会退化成圆） */
  minPitch: 0.06,
  maxPitch: 1.32,
  /* 最近别穿进最内侧轨道（0% 时的内圈半径是 2.15），最远别把五颗星球推成一群小点 */
  minDistance: 4.6,
  maxDistance: 13.5,
  /* 拖动灵敏度：弧度 / 像素 */
  yawPerPx: 0.0062,
  pitchPerPx: 0.0042,
  /* 滚轮/按钮的单步缩放倍率 */
  zoomStep: 0.82,
  /* 拖了这么多像素才算「在转」，而不是「点了星球一下」 */
  dragThresholdPx: 6,
  /* 拖完之后多久内忽略星球的点击（避免松手瞬间误进课程） */
  suppressClickMs: 260,
  /* 停手多久后才重新开始闲时漂移（秒） */
  idleDelaySec: 4,
};

/* =========================================================
   状态
========================================================= */

export function createOrbitState(overrides = {}) {
  const base = { ...ORBIT_DEFAULTS, ...overrides };
  return {
    /* 当前值（每帧向 target 阻尼逼近） */
    yaw: base.yaw,
    pitch: clampPitch(base.pitch),
    distance: clampDistance(base.distance),
    /* 目标值（交互直接改这里） */
    targetYaw: base.yaw,
    targetPitch: clampPitch(base.pitch),
    targetDistance: clampDistance(base.distance),
    /* 交互元数据 */
    lastInputAt: 0,
    dragging: false,
    suppressClickUntil: 0,
  };
}

export const clampPitch = (v) =>
  Math.min(ORBIT_LIMITS.maxPitch, Math.max(ORBIT_LIMITS.minPitch, Number(v) || 0));

export const clampDistance = (v) =>
  Math.min(
    ORBIT_LIMITS.maxDistance,
    Math.max(ORBIT_LIMITS.minDistance, Number(v) || ORBIT_DEFAULTS.distance)
  );

/* =========================================================
   交互
========================================================= */

/**
 * 拖动 → 新的目标角度。
 *
 * 方向约定（"抓住场景拖"而不是"转动相机"）：
 *   向右拖 → yaw 减小 → 相机绕到左侧 → 场景看起来跟着手往右走
 *   向下拖 → pitch 增大 → 相机升高俯视 → 看起来把场景往下拉，露出顶部
 * 这是轨道相机的通行手感，反过来的话用户一上手就会觉得"方向不对"。
 */
export function applyDrag(state, dxPx, dyPx) {
  const next = {
    ...state,
    targetYaw: state.targetYaw - dxPx * ORBIT_LIMITS.yawPerPx,
    targetPitch: clampPitch(state.targetPitch + dyPx * ORBIT_LIMITS.pitchPerPx),
    lastInputAt: state.lastInputAt,
  };
  return next;
}

/** 缩放一步。factor < 1 是拉近。 */
export function applyZoom(state, factor) {
  const safe = Number(factor);
  if (!Number.isFinite(safe) || safe <= 0) return state;
  return {
    ...state,
    targetDistance: clampDistance(state.targetDistance * safe),
  };
}

/** 捏合：按两指距离的变化比例缩放（向外张开 = 拉近） */
export function applyPinch(state, startDistancePx, currentDistancePx) {
  if (!startDistancePx || !currentDistancePx) return state;
  return applyZoom(state, startDistancePx / currentDistancePx);
}

/** 回到默认机位（阻尼会把它动画回去，不是瞬间跳） */
export function resetOrbit(state) {
  return {
    ...state,
    targetYaw: 0,
    targetPitch: clampPitch(ORBIT_DEFAULTS.pitch),
    targetDistance: clampDistance(ORBIT_DEFAULTS.distance),
  };
}

/* =========================================================
   每帧推进
========================================================= */

/**
 * 帧率无关的阻尼：用 1 - e^(-λ·dt) 而不是固定系数，
 * 否则 120Hz 屏幕上的跟手感会比 60Hz 快一倍。
 */
export function damp(current, target, lambda, dt) {
  const t = 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, dt));
  return current + (target - current) * t;
}

/** 推进一帧，返回新的当前值（不改 target） */
export function stepOrbit(state, dt, { lambda = 7 } = {}) {
  return {
    ...state,
    yaw: damp(state.yaw, state.targetYaw, lambda, dt),
    pitch: damp(state.pitch, state.targetPitch, lambda, dt),
    distance: damp(state.distance, state.targetDistance, lambda, dt),
  };
}

/**
 * 闲时漂移：停手 idleDelaySec 秒后开始非常轻的呼吸，让画面不至于「死」。
 *
 * 关键点：漂移是**偏移量**而不是写进 target，所以用户一碰就立刻回到
 * 他自己选的角度，不会被漂移带偏；同时用 smoothstep 淡入，避免从静止
 * 切到漂移时「咯噔」跳一下。
 */
export function idleDrift({ idleSeconds = 0, reducedMotion = false }, elapsed = 0) {
  const none = { yawOffset: 0, pitchOffset: 0, distanceScale: 1 };
  if (reducedMotion) return none;
  if (idleSeconds < ORBIT_LIMITS.idleDelaySec) return none;

  const raw = Math.min(1, (idleSeconds - ORBIT_LIMITS.idleDelaySec) / 1.6);
  const fade = raw * raw * (3 - 2 * raw); // smoothstep
  return {
    yawOffset: Math.sin(elapsed * 0.09) * 0.16 * fade,
    pitchOffset: Math.sin(elapsed * 0.13) * 0.035 * fade,
    /* 极轻微的前后呼吸，1±0.7% 以内，肉眼几乎只感觉到“活着” */
    distanceScale: 1 + Math.sin(elapsed * 0.1) * 0.007 * fade,
  };
}

/** 球坐标 → 笛卡尔。yaw=0 时相机在 +Z（正对恒星） */
export function cameraPosition(yaw, pitch, distance) {
  const cp = Math.cos(pitch);
  return [
    Math.sin(yaw) * cp * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * cp * distance,
  ];
}

/** 现在能不能把星球的一次点击当成「选中」（拖动刚结束时要忽略） */
export function clickAllowed(state, now) {
  return now >= (state.suppressClickUntil || 0);
}

/** 拖动超过阈值才算真的在转 */
export function exceedsDragThreshold(movedPx) {
  return Math.abs(movedPx) >= ORBIT_LIMITS.dragThresholdPx;
}

/** 两个触点之间的距离（捏合用） */
export function pointerSpread(points) {
  const list = Array.from(points || []);
  if (list.length < 2) return 0;
  const [a, b] = list;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default {
  ORBIT_DEFAULTS,
  ORBIT_LIMITS,
  createOrbitState,
  clampPitch,
  clampDistance,
  applyDrag,
  applyZoom,
  applyPinch,
  resetOrbit,
  damp,
  stepOrbit,
  idleDrift,
  cameraPosition,
  clickAllowed,
  exceedsDragThreshold,
  pointerSpread,
};
