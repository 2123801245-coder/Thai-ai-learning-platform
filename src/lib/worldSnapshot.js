// src/lib/worldSnapshot.js
//
// =========================================================
// WebGL 画布快照登记层
// =========================================================
//
// 「分享成就卡」要带上真实的守护者形象，也就是 3D 画布里的那一帧。
// 但 R3F 默认 preserveDrawingBuffer=false（这是对的：为了一张偶尔才用的
// 分享图，让每个用户每次渲染都多占一块显存与一次拷贝是不划算的）。
//
// 所以快照必须**在 render 之后、缓冲被清掉之前**同步读取。做法是：画布
// 组件把自己暴露成一个函数登记到这里，需要时由外部调用——那一刻先手动
// render 一帧，紧接着 toDataURL。
//
// 为什么用登记表而不是 ref：
//   英雄区在首页顶部，分享卡在世界区很下面的位置，两者之间隔了好几层
//   组件；靠 ref 传递要穿透 WorldHero → WorldStage → WorldCanvas 与
//   Home 的整个渲染树，还得处理「懒加载还没挂载」。登记表让两边解耦，
//   而且天然支持「没有 WebGL / 还没加载」时优雅返回 null。
//
// 快照只是锦上添花：拿不到时成图逻辑会自己画一个程序化的守护者，
// 静态模式与低端设备一样能生成成就卡。
// =========================================================

const registry = new Map();

/**
 * 登记一个快照函数。
 * @param {string}   key 形如 "guardian"
 * @param {Function} fn  () => string | null（返回 dataURL）
 * @returns {Function} 取消登记的清理函数
 */
export function registerWorldSnapshot(key, fn) {
  if (!key || typeof fn !== "function") return () => {};
  registry.set(key, fn);
  return () => {
    /* 只在仍然是自己的时候删除：避免后挂载的画布先卸载时把新的干掉 */
    if (registry.get(key) === fn) registry.delete(key);
  };
}

/** 这个 key 现在有没有可用的画布 */
export function hasWorldSnapshot(key) {
  return registry.has(key);
}

/**
 * 抓一帧。任何失败（没有画布、上下文丢失、跨域污染）都返回 null，
 * 由调用方回退到程序化绘制——绝不把异常抛到 UI 层。
 *
 * @param {string} key
 * @returns {string|null} dataURL
 */
export function captureWorldSnapshot(key) {
  const fn = registry.get(key);
  if (typeof fn !== "function") return null;
  try {
    const result = fn();
    return typeof result === "string" && result.startsWith("data:image") ? result : null;
  } catch {
    return null;
  }
}
