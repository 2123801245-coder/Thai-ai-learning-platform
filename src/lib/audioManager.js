// src/lib/audioManager.js
//
// 全站统一泰语播放管理器（HTMLAudio 单实例方案）。
//
// 为什么需要它：
//   - 旧的实现每次点击都 new Audio() + appendChild，快速连点会产生大量
//     实例与重复请求；这里全站只允许一个在线播放实例。
//   - 首次播放用直连 URL（保留用户手势链，iOS Safari/微信 WebView 兼容），
//     同时后台把音频转成 Blob URL 缓存——之后同一文本点击即播（零网络）。
//   - 同一 URL 的并发请求只发一次（in-flight 去重），重复文本不会重复下载。
//   - 播放/停止/报错都有明确回调与状态广播，组件可据此渲染按钮状态。
//
// 原则：完整文件 → HTMLAudio → 播放。不做 AudioContext / decodeAudioData /
// MediaSource / 实时拼接。慢速由服务端 rate 参数完成（保音调），本层不改
// playbackRate（那样会连音调一起变，毁泰语声调）。

let audioEl = null; // 全站唯一在线播放实例（惰性创建）
let docBodyReady = false;

// 当前活动播放的信息（用于停止旧播放/回调广播）
let current = null; // { url, token, onStart, onEnd, onError }

// 播放序列号：每次发起/停止都自增，异步回调凭它判断自己是否已被取代
let playToken = 0;

// 外部音频（LessonText 课文朗读器等）——管理器开始播放前先停掉它，
// 反向由 registerExternalAudio 的调用方在启动前停止管理器（防叠音）。
let externalStop = null;

// ---------- Blob 缓存 ----------
const blobCache = new Map(); // url -> blobUrl（LRU）
const inflight = new Map(); // url -> Promise<blobUrl|null>（并发去重）
const CACHE_MAX = 120;

// 状态订阅者（组件可借此实现按钮 loading/playing 状态）
const stateListeners = new Set();

// ---------- 工具 ----------

function ensureAudio() {
  if (audioEl) return audioEl;
  try {
    audioEl = new Audio();
    audioEl.preload = "auto";
    // 挂到 DOM 可提高部分 WebView/浏览器的播放成功率
    if (typeof document !== "undefined") {
      document.body.appendChild(audioEl);
      docBodyReady = true;
    }
  } catch (e) {
    // Audio 构造失败（极老环境）——返回 null 由调用方兜底
    audioEl = null;
  }
  return audioEl;
}

function setState(next) {
  const snapshot = {
    url: current?.url || null,
    state: next,
  };
  for (const fn of stateListeners) {
    try {
      fn(snapshot);
    } catch (e) {
      // 订阅者异常不得影响播放
    }
  }
}

export function subscribeAudioState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function getAudioState() {
  return {
    url: current?.url || null,
    state: current ? "playing" : "idle",
  };
}

// 缓存淘汰：满了先踢最旧（Map 迭代顺序 = 插入顺序）
function cacheBlobUrl(url, blobUrl) {
  const prev = blobCache.get(url);
  if (prev && prev !== blobUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch (e) {
      // ignore
    }
  }
  blobCache.set(url, blobUrl);
  if (blobCache.size > CACHE_MAX) {
    const oldest = blobCache.keys().next().value;
    const oldBlob = blobCache.get(oldest);
    blobCache.delete(oldest);
    if (oldBlob) {
      try {
        URL.revokeObjectURL(oldBlob);
      } catch (e) {
        // ignore
      }
    }
  }
}

// 抓取 url → Blob URL。失败返回 null（调用方回退直连 URL，仍走 HTTP 缓存）。
// 同一 URL 的并发调用共享同一次 fetch。
function fetchBlobUrl(url) {
  const cached = blobCache.get(url);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(url)) return inflight.get(url);

  const p = (async () => {
    try {
      if (typeof fetch !== "function") return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      if (typeof URL === "undefined" || !URL.createObjectURL) return null;
      const blobUrl = URL.createObjectURL(blob);
      cacheBlobUrl(url, blobUrl);
      return blobUrl;
    } catch (e) {
      // fetch 失败（CORS/断网等）——回退直连，不影响本次播放
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, p);
  return p;
}

// ---------- 错误分类 ----------

export function classifyAudioError(err) {
  const name = err && err.name;
  switch (name) {
    case "NotAllowedError":
      return "浏览器阻止了自动播放，请先点击页面任意位置再试";
    case "AbortError":
      return ""; // 被主动停止/替换，不是错误
    case "NotSupportedError":
      return "当前浏览器不支持该音频格式，请尝试更换浏览器";
    case "NetworkError":
      return "网络异常，音频加载失败，请重试";
    default:
      return err && err.message ? err.message : "音频播放失败，请重试";
  }
}

// 手动停止在线音频（保留直连/缓存 URL，下次点击立即重播）
export function stopThaiAudio() {
  playToken += 1; // 使所有进行中的异步回调失效
  const active = current;
  current = null;
  const el = audioEl;
  if (el) {
    try {
      el.pause();
      el.removeAttribute("src");
      el.load(); // 释放当前资源（WAV/MP3 解码器），避免内存驻留
      el.currentTime = 0;
    } catch (e) {
      // ignore
    }
  }
  if (active?.onEnd) {
    try {
      active.onEnd();
    } catch (e) {
      // ignore
    }
  }
  setState("idle");
}

// 停止外部音频（课文朗读器等）
export function stopExternalAudio() {
  if (externalStop) {
    const fn = externalStop;
    externalStop = null;
    try {
      fn();
    } catch (e) {
      // ignore
    }
  }
}

// LessonText 挂载时把自己的 audio 注册为“外部音频”：
// 之后任何 playThaiAudio 都会先停朗读器（防叠音）。
// 返回解绑函数。
export function registerExternalAudio(stopFn) {
  // 先停掉正在播放的在线音频（与旧 registerActiveAudio 语义一致）
  stopThaiAudio();
  externalStop = stopFn;
  return () => {
    if (externalStop === stopFn) externalStop = null;
  };
}

/**
 * 播放一个完整音频 URL。
 * @param {string} url          音频地址（本地 /api/tts 或 Google TTS）
 * @param {object} [opts]
 *   - onStart / onEnd / onError：播放生命周期回调（UI 状态用）
 *   - directFirst：默认 true——先用直连 URL 同步开播（保留手势链），
 *     后台再补 Blob 缓存；为 false 则等待缓存就绪再播
 * @returns {() => void} cancel：主动停止本次播放
 */
export function playThaiAudio(url, opts = {}) {
  const { onStart, onEnd, onError, directFirst = true } = opts;
  const el = ensureAudio();
  if (!el) {
    onError?.(new Error("当前环境不支持音频播放"));
    return () => {};
  }

  const token = ++playToken;

  // 先停旧播放（同一实例、currentTime 归零、通知旧 onEnd 以复位旧按钮 UI）
  const active = current;
  if (active && active.url !== url) {
    // 不同音频：让旧组件的 onEnd 复位（旧按钮恢复默认态）
    try {
      el.pause();
    } catch (e) {
      // ignore
    }
    if (active.onEnd) {
      try {
        active.onEnd();
      } catch (e) {
        // ignore
      }
    }
  }
  // 相同 URL 连点 = 重播：直接继续下面的重启逻辑即可

  current = { url, token, onStart, onEnd, onError };

  let settled = false;
  let cancelRequested = false;

  // 只负责“起播”这一步：设 src + play。已有 blob 缓存则直接用 blob（秒播），
  // 否则直连 URL（HTTP/服务端缓存已保证首次也不慢）。
  const tryPlay = (src) => {
    if (cancelRequested || token !== playToken) return;
    try {
      el.src = src;
      el.currentTime = 0;
      el.play().then(
        () => {
          if (cancelRequested || token !== playToken) return; // 已被取代
          if (!settled) {
            settled = true;
            setState("playing");
            current?.onStart?.();
          }
        },
        (err) => {
          if (cancelRequested || token !== playToken) return; // 主动取消，非错误
          const msg = classifyAudioError(err);
          if (msg) {
            current?.onError?.(new Error(msg));
          }
          // AbortError（主动停止类）不报错
          setState("idle");
        }
      );
    } catch (err) {
      if (cancelRequested || token !== playToken) return;
      const msg = classifyAudioError(err);
      current?.onError?.(new Error(msg || "播放失败"));
      setState("idle");
    }
  };

  // 事件：自然播完 / 加载失败
  el.onended = () => {
    if (cancelRequested || token !== playToken) return;
    const activeNow = current;
    current = null;
    setState("idle");
    activeNow?.onEnd?.();
  };
  el.onerror = () => {
    if (cancelRequested || token !== playToken) return;
    const activeNow = current;
    current = null;
    setState("idle");
    if (!el.src) return;
    activeNow?.onError?.(new Error(classifyAudioError(new Error("audio 加载失败"))));
  };

  // 停止任何外部音频（朗读器），避免叠音
  stopExternalAudio();

  // 关键：已有 blob 缓存 → 直接用它（真正“第二次点击即播”）。
  // 没有缓存 → 直连 URL 立即开播（保留用户手势链，iOS/WebView 兼容），
  // 同时后台把同一 URL 转成 Blob 缓存供下次使用。
  // 注意：绝不把正在播放的 audio.src 热换成 blob（那会中断重播，听成断续）。
  const cached = blobCache.get(url);
  if (cached) {
    tryPlay(cached);
    return () => {
      cancelRequested = true;
      if (token === playToken) stopThaiAudio();
    };
  }

  if (directFirst) {
    // ① 立即直连开播（手势链内，不打断）
    tryPlay(url);
    // ② 后台预取转 blob，仅写入缓存，不触碰正在播放的 src
    fetchBlobUrl(url);
  } else {
    // 等缓存就绪再播（用于预加载已完成、确定要播的场景）
    fetchBlobUrl(url).then((blobUrl) => {
      tryPlay(blobUrl || url);
    });
  }

  return () => {
    cancelRequested = true;
    // 只有自己是当前播放才执行停止动作
    if (token === playToken) {
      stopThaiAudio();
    }
  };
}

// 切歌语义：同 URL 正在播 → 停止；否则播放
export function toggleThaiAudio(url, opts = {}) {
  if (current?.url === url) {
    stopThaiAudio();
    return () => {};
  }
  return playThaiAudio(url, opts);
}

// ---------- 预加载 ----------

const preloadQueue = [];
let preloadActive = 0;
const PRELOAD_CONCURRENCY = 2;
let preloadTimer = null;

function pumpPreload() {
  if (preloadActive >= PRELOAD_CONCURRENCY || preloadQueue.length === 0) return;
  const url = preloadQueue.shift();
  preloadActive += 1;
  fetchBlobUrl(url)
    .catch(() => null)
    .finally(() => {
      preloadActive -= 1;
      pumpPreload();
    });
}

function schedulePreload() {
  if (preloadTimer) return;
  // 交给空闲期执行，避免与首屏渲染/其它网络抢带宽
  const idle = typeof window !== "undefined" && window.requestIdleCallback;
  const run = () => {
    preloadTimer = null;
    if (typeof navigator !== "undefined" && navigator.connection?.saveData) {
      preloadQueue.length = 0; // 用户开启省流量模式 → 不预加载
      return;
    }
    pumpPreload();
  };
  if (idle) {
    preloadTimer = window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    preloadTimer = setTimeout(run, 500);
  }
}

/**
 * 预加载一批音频 URL（仅缓存，不播放）。
 * 上限/去重由 fetchBlobUrl + queue 去重保证，不会造成请求风暴。
 */
export function preloadThaiAudio(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  for (const url of list) {
    if (!url) continue;
    if (blobCache.has(url) || inflight.has(url)) continue; // 已有/进行中
    if (preloadQueue.includes(url)) continue;
    preloadQueue.push(url);
    if (preloadQueue.length > 300) preloadQueue.shift(); // 硬上限
  }
  schedulePreload();
}
