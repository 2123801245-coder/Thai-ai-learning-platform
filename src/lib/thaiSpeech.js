// src/lib/thaiSpeech.js
//
// 统一的泰语发音工具。
//
// 播放优先级（按可靠性）：
//   1. speechSynthesis（浏览器/系统泰语语音，离线可用）——
//      用 warmUpSpeech 实测是否可用（部分 WebView 有语音列表但永不发声）
//   2. 本地后端 /api/tts（macOS say Kanya / Edge TTS 代理，返回 WAV）——
//      经由 audioManager 单实例 + Blob 缓存播放
//   3. Google TTS 直连（translate.google.com / translate.googleapis.com）——
//      最终兜底，同样走 audioManager 单实例
//
// 工具细节：
//   - 显式挑选泰语语音（精确 th-TH 优先，其次 th 前缀）
//   - 播放 2.5 秒仍未开始（无声环境）→ 自动切换下一层
//   - 用户主动中断（切题/重播 cancel）不触发降级

import {
  playThaiAudio,
  stopThaiAudio as managerStopThaiAudio,
  stopExternalAudio,
  registerExternalAudio,
} from "./audioManager";
import { API_BASE_URL } from "@/lib/api";

let voicesCache = [];
let listeningVoicesChanged = false;

// speechSynthesis 可用状态：unknown / works / broken
// 由 warmUpSpeech 在首次用户交互时实测得出，避免每次白等 2.5s
let synthesisState = "unknown";

/* 挑选泰语语音（精确 th-TH 优先，其次 th 前缀） */
export function getThaiVoice() {
  refreshVoices();

  return (
    voicesCache.find(
      (voice) => (voice.lang || "").toLowerCase() === "th-th"
    ) ||
    voicesCache.find((voice) =>
      (voice.lang || "").toLowerCase().startsWith("th")
    ) ||
    null
  );
}

/* 是否有可用的泰语语音 */
export function hasThaiVoice() {
  return !!getThaiVoice();
}

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    voicesCache = voices;
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();

  // 语音列表异步加载完成后刷新缓存
  if (!listeningVoicesChanged) {
    window.speechSynthesis.addEventListener?.(
      "voiceschanged",
      refreshVoices
    );
    listeningVoicesChanged = true;
  }
}

/* 用 speechSynthesis 播放（显式选择泰语语音） */
function speakThaiWithSynthesis(text, options = {}) {
  const { rate = 0.75, pitch = 1, onStart, onEnd, onError } = options;

  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    onError?.(new Error("speechSynthesis 不可用"));
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = rate;
  utterance.pitch = pitch;

  const voice = getThaiVoice();
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (event) => onError?.(event);

  window.speechSynthesis.speak(utterance);
}

/* 生成本地后端 /api/tts 的完整 URL（speakThaiWithLocal 与课文朗读器共用，
   保证版本号与参数一致，避免缓存旧音频）。rate/pitch 均为数字：
   rate 0.5~2（0.65 慢速 / 0.78 常速 / 1.0 快速），pitch 0.5~2（1 为标准）。 */
export function getLocalTtsUrl(text, rate = 0.75, pitch = 1) {
  return (
    `${API_BASE_URL}/tts?text=${encodeURIComponent(text)}` +
    `&rate=${encodeURIComponent(rate)}` +
    `&pitch=${encodeURIComponent(pitch)}` +
    "&v=4"
  );
}

/* 让外部音频元素（如课文逐段朗读器）接入统一播放管理：
   - 停掉当前正在播放的模块音频（防止叠音）
   - 之后任何 playThaiAudio（单词/句子播放）都会先停掉它
   返回同一 audio 便于链式调用 */
export function registerActiveAudio(audio) {
  const unregister = registerExternalAudio(() => {
    try {
      audio.pause();
      audio.removeAttribute("src");
    } catch (e) {
      // ignore
    }
  });
  // 保持旧 API：返回 audio 便于链式调用；组件卸载时自动解绑由
  // registerExternalAudio 返回的函数负责，这里只透传引用
  audio._thaiaiUnregisterExternal = unregister;
  return audio;
}

/* 统一停止：同时停掉浏览器 speechSynthesis、管理器在线音频与外部音频。
   组件卸载/切题/清空对话等场景用它代替裸 speechSynthesis.cancel()——
   实际发声的可能是本地 Kanya WAV，只 cancel 浏览器语音停不掉它。 */
export function stopThaiAudio() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }
  managerStopThaiAudio();
}

/* 本地后端 /api/tts（Edge TTS 代理，国内可达）——经由 audioManager
   单实例播放：首次直连开播（保留手势链），后台转 Blob 缓存，重复点击即播。 */
export function speakThaiWithLocal(text, options = {}) {
  const { rate = 0.75, pitch = 1, onStart, onEnd, onError } = options;

  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      onError?.(new Error("无 window"));
      resolve(false);
      return;
    }
    playThaiAudio(getLocalTtsUrl(text, rate, pitch), {
      directFirst: true,
      onStart: () => {
        onStart?.();
      },
      onEnd: () => {
        onEnd?.();
        resolve(true);
      },
      onError: (err) => {
        onError?.(err);
        resolve(false);
      },
    });
  });
}

/* Google TTS 域名列表（translate.google.com 在大陆网络常不可达，
   换 translate.googleapis.com 重试一次） */
const GOOGLE_TTS_HOSTS = [
  "https://translate.google.com/translate_tts",
  "https://translate.googleapis.com/translate_tts",
];

/* 用 Google Translate TTS 音频播放（网络环境下的最后兜底）——
   经由 audioManager 单实例，同一时间不会与本地音频重叠。
   translate.google.com 在大陆网络常不可达，失败后自动换
   translate.googleapis.com 再试一次（仅一次）。 */
export function speakThaiWithGoogle(text, options = {}) {
  const { onStart, onEnd, onError } = options;

  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      onError?.(new Error("无 window"));
      resolve(false);
      return;
    }

    const q = encodeURIComponent(text);
    const attempt = (hostIndex) => {
      if (hostIndex >= GOOGLE_TTS_HOSTS.length) {
        onError?.(new Error("在线语音播放失败（可能离线）"));
        resolve(false);
        return;
      }
      playThaiAudio(
        GOOGLE_TTS_HOSTS[hostIndex] + "?ie=UTF-8&client=tw-ob&tl=th&q=" + q,
        {
          directFirst: true,
          onStart: () => onStart?.(),
          onEnd: () => {
            onEnd?.();
            resolve(true);
          },
          onError: () => {
            // 当前域名失败 → 换下一个域名重试（最多一次换域）
            attempt(hostIndex + 1);
          },
        }
      );
    };

    attempt(0);
  });
}

/* 预热：解锁浏览器的 speechSynthesis 并实测它是否真的能发声
   （Chrome 要求“用户先与页面交互”才能合成语音；部分 WebView
   即使有语音列表也永不启动——实测区分，可用则跳过 2.5s 等待）

   注意：绝不能在这里调用 speechSynthesis.cancel()——
   首次交互时用户可能紧接着就点了发音按钮，cancel 会连用户
   的语音一起取消，并让 speakThai 的挂起计时器被“canceled”
   错误清掉，导致无声。静音测试句让它自然结束即可。 */
export function warmUpSpeech() {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    synthesisState = "broken";
    return;
  }

  try {
    // 触发语音列表加载（Chrome 首次返回空，交互后再返回）
    window.speechSynthesis.getVoices();

    if (synthesisState !== "unknown") return;

    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;

    let done = false;
    const decide = (works) => {
      if (done) return;
      done = true;
      synthesisState = works ? "works" : "broken";
    };

    utterance.onstart = () => decide(true);
    utterance.onerror = () => decide(false);
    utterance.onend = () => decide(false);

    window.speechSynthesis.speak(utterance);

    // 400ms 内未启动 → 判定为不可用
    setTimeout(() => decide(false), 400);
  } catch (e) {
    synthesisState = "broken";
  }
}

/*
 * 统一入口：播放一段泰语。
 * 返回一个 cancel 函数（组件卸载/切题时调用，避免串音）。
 *
 * 带短防抖窗口：页面挂载时多个练习组件（听写/听音选词/互译）
 * 会同时自动播放同一题，若三路齐发会互相打断、短暂叠音——
 * 听感就是杂音。120ms 窗口内合并请求，只播最后一次；快速连点
 * 不同词/句则各自立即播（audioManager 单实例保证不叠音）。
 */

let speakDebounceTimer = null;
let speakDebounceCancel = null;

export function speakThai(text, options = {}) {
  if (!text) return () => {};

  if (speakDebounceTimer) {
    clearTimeout(speakDebounceTimer);
    speakDebounceTimer = null;
    speakDebounceCancel?.(); // 取消上一次尚未开始的播放
  }

  let cancelled = false;
  let activeCancel = () => {};

  speakDebounceTimer = setTimeout(() => {
    speakDebounceTimer = null;
    if (cancelled) return;
    activeCancel = doSpeakThai(text, options);
  }, 120);

  const cancel = () => {
    cancelled = true;
    if (speakDebounceTimer) {
      clearTimeout(speakDebounceTimer);
      speakDebounceTimer = null;
    }
    activeCancel?.();
  };

  speakDebounceCancel = cancel;
  return cancel;
}

function doSpeakThai(text, options = {}) {
  if (!text) return () => {};

  // 任何新播放开始前：先停掉管理器在线音频 + 课文朗读器等外部音频，
  // 保证同一时间只有一个泰语音频在响（防叠音）
  managerStopThaiAudio();
  stopExternalAudio();

  // 本地 /api/tts 失败 → Google TTS 兜底
  const playLocalThenGoogle = () => {
    speakThaiWithLocal(text, {
      ...options,
      onError: () => {
        speakThaiWithGoogle(text, options);
      },
    });
  };

  // 检测是否通过域名访问（非 localhost/127.0.0.1）
  const isRemoteAccess = typeof window !== "undefined" &&
    !window.location.hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/);

  // 设备本地泰语语音（系统自带 Thai 语音包）是否已被 warmUpSpeech 实测可发声、
  // 且当前设备确实存在泰语语音（iPhone/macOS 的 Kanya、Android 的泰语 TTS）。
  // 满足时优先用本地语音：零网络依赖、无 Edge MP3→WAV 压缩噪声（即“电音”）、
  // 不卡顿；不满足（未知/无声 WebView/无泰语语音）才回退服务器 /api/tts。
  const deviceVoiceReady = hasThaiVoice() && synthesisState === "works";

  // 远程访问：设备本地语音可靠才用本地；其余情况直接走服务器（避免 2.5s 空等）
  if (isRemoteAccess && !deviceVoiceReady) {
    playLocalThenGoogle();
    return () => {};
  }

  // 已确认 speechSynthesis 不可用 → 直接用本地层
  if (synthesisState === "broken") {
    playLocalThenGoogle();
    return () => {};
  }

  // 已确认可用 → 只用 speechSynthesis（仅限本地开发）
  if (synthesisState === "works") {
    // 先停掉管理器在线音频，避免与系统语音叠音
    managerStopThaiAudio();
    speakThaiWithSynthesis(text, options);
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }

  // 未知：先试 speechSynthesis，2.5 秒未启动 → 本地层 → Google
  let started = false;
  let settled = false;

  const hangTimer = setTimeout(() => {
    if (!started && !settled) {
      settled = true;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      playLocalThenGoogle();
    }
  }, 2500);

  speakThaiWithSynthesis(text, {
    ...options,
    onStart: () => {
      started = true;
      clearTimeout(hangTimer);
      options.onStart?.();
    },
    onEnd: () => {
      clearTimeout(hangTimer);
      options.onEnd?.();
    },
    onError: (event) => {
      clearTimeout(hangTimer);
      options.onError?.(event);

      // 用户主动中断（切题/重播会 cancel 旧语音）不触发降级
      const errorCode = event?.error;
      if (
        !settled &&
        errorCode !== "interrupted" &&
        errorCode !== "canceled"
      ) {
        settled = true;
        playLocalThenGoogle();
      }
    },
  });

  // 返回取消函数：中断当前合成/音频（不回退）
  return () => {
    settled = true;
    clearTimeout(hangTimer);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    managerStopThaiAudio();
  };
}

/* ============================================================
   从混合文本中提取泰语片段（用于朗读 AI 回复的泰语部分）
   返回最长的泰语片段；无泰语返回空串
============================================================ */
export function extractThaiText(text) {
  const matches =
    String(text || "").match(
      /[\u0E00-\u0E7F][\u0E00-\u0E7F\s\u0E31\u0E34-\u0E3A\u0E47-\u0E4E.,!?;:()'\-]*/g
    ) || [];
  const cleaned = matches
    .map((m) => m.trim())
    .filter((m) => m.length >= 2);
  if (cleaned.length === 0) return "";
  return cleaned.sort((a, b) => b.length - a.length)[0];
}
