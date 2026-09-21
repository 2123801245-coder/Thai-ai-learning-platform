// src/components/world/WorldStage.jsx
//
// =========================================================
// ThaiAI World · WebGL 承载层（不含 three，可安全被首页直接引用）
// =========================================================
//
// 全世界共用一个渲染策略，任何 3D 场景（英雄守护者 / 学习星系）都套在这里：
//
//   1. 懒挂载    —— 进入视口附近才创建 WebGL 上下文，离开就卸掉。
//                    首页有多个板块，绝不能一打开就开好几个 GL 上下文。
//   2. 离屏暂停  —— 不在视口 / 标签页隐藏时把 frameloop 切成 "never"，
//                    手机滚动时不会因为后台还在画而掉帧、掉电。
//   3. 自适应画质—— 移动端 dpr 上限 1.5、不抗锯齿、粒子砍到 1/3；
//                    桌面端可到 2。低核心数设备按移动端处理。
//   4. 减弱动效  —— 系统开了「减弱动态效果」时只画一帧静态画面
//                    （frameloop="demand"），动画代码原样保留但不跑。
//   5. 无 WebGL   —— 探测失败（老设备 / 关掉硬件加速）或 URL 带
//                    ?world=static 时回退到静态画面，内容与入口一个不少。
//
// ⚠️ 本文件**不允许** import "@react-three/fiber" 或 "three"。
// 画布本体在 WorldCanvas.jsx 里，由 React.lazy 引入——这样 three.js
// （gzip ~176KB）只在实际要画 3D 时才下载，不拖累首页。
//
// 设计取舍：全站只有两个 WebGL 画布（英雄 + 星系），技能树用 SVG、
// 博物馆用 CSS 3D 透视——它们在手机上比 WebGL 更清晰也更省电。
// =========================================================

import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

/* 画布单独成 chunk：不真的画 3D 就一个字节都不下载 three */
const WorldCanvas = lazy(() => import("./WorldCanvas"));

/* =========================================================
   设备能力探测
========================================================= */

/**
 * WebGL 可用性探测。
 *
 * 「可用」的结论永久缓存（它不会自己变假）；**「不可用」的结论只缓存
 * 两秒**。原因：上下文创建会因为「同一页面刚建过好几个 GL 上下文 / 显存
 * 短暂吃紧」而瞬时失败，这跟「设备真的不支持」是两件完全不同的事。
 * 把阴性结论永久钉死，等于让这些用户此后整个会话都停在静态模式，且只能
 * 靠刷新自救——我就是在一次连续预览里撞上了这个现象（当时页面里两个
 * 画布都消失了，几秒后手动建上下文却又完全正常）。
 */
let webglSupport = null;
let lastNegativeAt = 0;
const NEGATIVE_TTL_MS = 2000;

export function hasWebGL() {
  if (webglSupport === true) return true;
  if (typeof document === "undefined") return false;
  if (webglSupport === false && Date.now() - lastNegativeAt < NEGATIVE_TTL_MS) {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    webglSupport = Boolean(gl);
    if (webglSupport) {
      /* 探测完立刻释放，不然会占着一个上下文名额 */
      const lose = gl?.getExtension?.("WEBGL_lose_context");
      lose?.loseContext?.();
    } else {
      lastNegativeAt = Date.now();
    }
  } catch {
    webglSupport = false;
    lastNegativeAt = Date.now();
  }
  return webglSupport;
}

const prefersReducedMotion = () => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/*
 * 强制静态模式的开关：URL 加 ?world=static 就只用静态画面。
 * 两个用处：① 低端设备/显卡驱动异常时的逃生口；② 让静态回退**可被验证**
 * （否则现场没有「没有 WebGL」的机器，就没法证明回退是对的）。
 */
const forcedStatic = () => {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("world") === "static";
  } catch {
    return false;
  }
};

/* 观察器失声时的宽限期：这么久还没任何回调就乐观挂载（见 useInView） */
const OBSERVER_GRACE_MS = 1200;

/* 静态兜底的恢复重试：间隔与次数都写得克制（别把低端设备一直拖在探测里） */
const RECOVERY_INTERVAL_MS = 1500;
const RECOVERY_ATTEMPTS = 5;

const STATIC_QUALITY = {
  tier: "static",
  dpr: 1,
  particles: 0,
  antialias: false,
  reducedMotion: true,
};

/**
 * 画质档位。返回的参数直接喂给画布与场景内部。
 *
 * tier: "high"   桌面 / 高性能 → dpr≤2、粒子全量、抗锯齿开
 *       "low"    移动 / 低核心 → dpr≤1.5、粒子 1/3、抗锯齿关
 *       "static" 无 WebGL / 减弱动效 / ?world=static → 只画静态帧
 */
/** 按设备能力算画质档位（抽出来是为了能在瞬时失败后重算一次） */
function computeQuality() {
  if (typeof window === "undefined") return STATIC_QUALITY;
  if (forcedStatic()) return STATIC_QUALITY;

  const reduced = prefersReducedMotion();
  const cores = navigator.hardwareConcurrency || 4;
  const mobile =
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent) ||
    cores <= 4;

  if (!hasWebGL()) return STATIC_QUALITY;

  return mobile
    ? { tier: "low", dpr: 1.5, particles: 90, antialias: false, reducedMotion: reduced }
    : { tier: "high", dpr: 2, particles: 260, antialias: true, reducedMotion: reduced };
}

export function useWorldQuality() {
  const [quality, setQuality] = useState(computeQuality);

  /* 用户在系统里切换「减弱动效」时实时跟随 */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => {
      setQuality((prev) => ({ ...prev, reducedMotion: event.matches }));
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  /*
   * 静态兜底的档位是**写进 state 的**，所以就算之后 WebGL 又好了，也不会
   * 自己恢复。这里给它重算机会：只对「不是用户主动要静态、也不是系统
   * 减弱动效」的情况生效，避免跟用户意图打架。
   *
   * ⚠️ 必须是**有界重试**，不能只试一次：上下文创建会间歇性地失败（同一
   * 页面里刚反复建过好几个 GL 上下文时尤其容易），而只试一次的话，碰上
   * 一次失败就永久停在静态模式——`quality.tier` 不变，这个 effect 也不会
   * 再跑。我就是这样在预览里撞上的：WebGL 明明可用（手动建上下文两次都
   * 成功），但星系就是不挂载画布，一眼看不出原因。
   */
  useEffect(() => {
    if (quality.tier !== "static") return undefined;
    if (forcedStatic() || prefersReducedMotion()) return undefined;

    let attempt = 0;
    const timer = setInterval(() => {
      attempt += 1;
      if (hasWebGL()) {
        clearInterval(timer);
        setQuality(computeQuality());
        return;
      }
      if (attempt >= RECOVERY_ATTEMPTS) clearInterval(timer);
    }, RECOVERY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [quality.tier]);

  return quality;
}

/* =========================================================
   视口 / 可见性
========================================================= */

/** 元素是否在视口附近（用于懒挂载） */
export function useInView(ref, { rootMargin = "200px" } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    let answered = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        answered = true;
        setInView(entry.isIntersecting);
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);

    /*
     * 兜底：观察器可能**一次回调都不发**（我在预览的 webview 里实测到过：
     * `new IntersectionObserver(...).observe(el)` 等 1.5 秒没有任何回调，
     * 且页面可见、元素确实在视口内）。
     *
     * 后果不是“延迟加载”，而是**整个世界永久停在静态兜底上**——用户没有
     * 报错、没有提示，就是永远看不到 3D。所以等一小会儿还没消息就乐观
     * 挂载：宁可多画一个画布，也不能因为一个不作声的观察器把体验锁死。
     * 之后观察器真的回调了，仍然以它为准（不看就暂停，离屏照旧释放）。
     */
    const timer = setTimeout(() => {
      if (!answered) setInView(true);
    }, OBSERVER_GRACE_MS);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, rootMargin]);

  return inView;
}

/** 标签页是否可见（隐藏时停渲染） */
function useDocumentVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/* =========================================================
   WorldStage
========================================================= */

/**
 * @param {object}    props
 * @param {Function}  props.children   场景内容（R3F 元素），可传函数拿 quality
 * @param {object}    props.camera     R3F camera 配置
 * @param {string}    props.className  画布容器类名
 * @param {string}    props.rootMargin 提前挂载距离
 * @param {boolean}   props.once       首次进入后常驻（离开只暂停，不重建设备上下文）
 * @param {string}    props.snapshotKey 登记快照的键（分享成就卡用，见 lib/worldSnapshot.js）
 * @param {ReactNode} props.fallback   无 WebGL / 减弱动效时的替代画面
 * @param {ReactNode} props.loading    画布 chunk 加载中的占位
 */
export default function WorldStage({
  children,
  camera,
  className = "",
  rootMargin = "250px",
  once = false,
  snapshotKey = null,
  fallback = null,
  loading = null,
  style,
}) {
  const wrapRef = useRef(null);
  const quality = useWorldQuality();
  const inView = useInView(wrapRef, { rootMargin });
  const docVisible = useDocumentVisible();

  const [everMounted, setEverMounted] = useState(false);
  useEffect(() => {
    if (inView) setEverMounted(true);
  }, [inView]);

  const staticMode = quality.tier === "static";
  /* once：第一次进视口就常驻（离开只是暂停，不重建设备上下文） */
  const shouldMount = once ? everMounted : inView;
  const pause = !inView || !docVisible;

  const canvasCamera = useMemo(
    () => camera || { position: [0, 0.6, 6], fov: 38, near: 0.1, far: 100 },
    [camera]
  );

  const glOptions = useMemo(
    () => ({
      antialias: quality.antialias,
      powerPreference: "high-performance",
      alpha: true,
      /*
       * 手机上看不必要的缓冲就关，省显存。
       * 注意：不设 preserveDrawingBuffer —— 它会让浏览器额外保留一份帧缓冲，
       * 在部分环境下会拖慢合成，甚至建不出上下文。
       */
      preserveDrawingBuffer: false,
      stencil: false,
      depth: true,
    }),
    [quality.antialias]
  );

  /* 离屏或标签页隐藏 → 完全停止渲染循环；
     减弱动效 → 只画一帧（内容仍然完整可见） */
  const frameloop = quality.reducedMotion
    ? "demand"
    : pause
      ? "never"
      : "always";

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={style}>
      {staticMode || !shouldMount ? (
        /* 静态模式 / 还没进视口：先给静态画面，避免白屏与 Layout Shift */
        fallback
      ) : (
        <Suspense fallback={loading || fallback}>
          <WorldCanvas
            camera={canvasCamera}
            dpr={[1, quality.dpr]}
            glOptions={glOptions}
            frameloop={frameloop}
            snapshotKey={snapshotKey}
          >
            {typeof children === "function" ? children({ quality }) : children}
          </WorldCanvas>
        </Suspense>
      )}
    </div>
  );
}
