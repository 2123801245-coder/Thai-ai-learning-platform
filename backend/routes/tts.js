// backend/routes/tts.js
// GET /api/tts?text=สวัสดี&rate=0.78&voice=th-TH-PremwadeeNeural&v=4
// 返回 audio/wav（首选 macOS say/Kanya，回退 Edge TTS；内存缓存）
//
// v 参数 = 音频格式版本（前端 getLocalTtsUrl 固定传 v=4，WAV 格式）。
// 带合法 v≥4 的请求允许浏览器/CDN 长缓存（immutable），消除重复播放
// 的重复下载卡顿；无 v 或旧版本的请求保持 no-store（格式切换期防旧缓存）。

import { Router } from "express";
import {
  synthesizeThai,
  ttsCacheGet,
  ttsCacheSet,
  getTtsHealth,
} from "../tts.js";

const router = Router();

// 前端 0.5~2 的数字语速 → prosody rate 百分比（0.78 → -22%）
function rateToProsody(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0 || n > 3) return "+0%";
  const percent = Math.round((n - 1) * 100);
  if (percent === 0) return "+0%";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

// 前端 0.5~2 的数字音调 → prosody pitch 百分比（1.15 → +15%）
function pitchToProsody(pitch) {
  const n = Number(pitch);
  if (!Number.isFinite(n) || n <= 0 || n > 3) return "+0%";
  const percent = Math.round((n - 1) * 100);
  if (percent === 0) return "+0%";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

/* GET /api/tts/health[?probe=1]
   平台能力 + 运行统计的自检端点。巡检服务器时先用它看真相，别靠听：
     · bins 全为 null  → 这台机器没有转换器，语音会以未限幅 MP3 发出（发燥）
     · stats.wavRetry/mp3Fallback > 0 → 转换不稳或完全不可用
     · ?probe=1 → 真跑一次合成，live.format 应为 wav、live.clipped 应为 false */
router.get("/tts/health", async (req, res) => {
  try {
    const health = await getTtsHealth({ probe: req.query.probe === "1" });
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/tts", async (req, res) => {
  const text = String(req.query.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "缺少 text 参数" });
  }
  if (Buffer.byteLength(text, "utf-8") > 12000) {
    return res.status(400).json({ error: "text 过长" });
  }

  const voice = String(req.query.voice || "th-TH-PremwadeeNeural").slice(0, 100);
  // engine=edge：强制神经语音路线（跳过 macOS say）；
  // engine=google：谷歌翻译 TTS（必须服务器能访问谷歌或配了 TTS_GOOGLE_BASE 中转，
  //   详见 backend/tts.js 的 synthesizeWithGoogle）。
  // 缓存 key 带 engine 前缀隔离，避免同文本的不同声源 WAV 互相命中。
  const engineReq = String(req.query.engine || "").trim().toLowerCase();
  const engine = engineReq === "edge" || engineReq === "google" ? engineReq : "";
  const cacheVoice = engine ? `${engine}:${voice}` : voice;
  // fmt=aac：返回 M4A/AAC（约 6KB/s，移动网络/微信 WebView 边下边播用）。
  // 默认 wav（24kHz PCM，48KB/s）——兼容性最保险。fmt 进缓存 key，
  // 两种格式互不污染，浏览器也各自缓存（URL 不同）。
  const format = String(req.query.fmt || "").trim().toLowerCase() === "aac" ? "aac" : "wav";
  const rate = rateToProsody(req.query.rate); // Edge prosody 格式（say 路线不使用）
  const rateNum = Number(req.query.rate) || 1; // say 路线数字语速
  const pitch = pitchToProsody(req.query.pitch); // Edge prosody 格式
  const pitchNum = Number(req.query.pitch) || 1; // say 路线数字音调

  // v 参数（音频格式版本，≥4 表示 WAV 时代）→ 允许浏览器/CDN 长缓存。
  // 低于 v4 / 无 v 的旧请求保持 no-store（防历史 MP3 旧缓存被误用）。
  const v = Number(req.query.v);
  const allowBrowserCache = Number.isInteger(v) && v >= 4;
  const cacheControl = allowBrowserCache
    ? "public, max-age=31536000, immutable"
    : "no-store";

  // 返回体可能是 WAV（正常）或原始 MP3（转换器全失败时的降级）——
  // 必须按实际字节标 MIME：helmet 带 X-Content-Type-Options: nosniff，
  // 把 MP3 标成 audio/wav 会被部分浏览器直接拒播。
  function audioHeaders(buf, extra) {
    // 三种容器都可能出现：RIFF/WAV（正常）、ISO-BMFF/M4A（fmt=aac）、
    // 裸 MP3（两个转换器都不可用时的降级）。MIME 必须跟实际字节一致：
    // helmet 带 nosniff，错标会被部分浏览器直接拒播。
    const isWav =
      buf.length > 4 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
    const isM4a = buf.length > 12 && buf.slice(4, 8).toString("latin1") === "ftyp";
    return {
      "Content-Type": isWav ? "audio/wav" : isM4a ? "audio/mp4" : "audio/mpeg",
      "X-TTS-Format": isWav ? "wav" : isM4a ? "m4a" : "mp3",
      "Cache-Control": cacheControl,
      ...extra,
    };
  }

  // 缓存命中直接返回（key 含 v，格式升级后旧缓存自动失效）
  const cached = ttsCacheGet(text, `${cacheVoice}|${format}`, rate, pitch, v);
  if (cached) {
    res.set(audioHeaders(cached, { "X-TTS-Cache": "hit" }));
    return res.send(cached);
  }

  try {
    const audio = await synthesizeThai(text, {
      voice,
      rate,
      rateNum,
      pitch,
      pitchNum,
      engine,
      format,
    });
    ttsCacheSet(text, `${cacheVoice}|${format}`, rate, pitch, v, audio);
    res.set(audioHeaders(audio, { "X-TTS-Cache": "miss" }));
    return res.send(audio);
  } catch (err) {
    console.error("[tts] 合成失败:", err.message);
    return res.status(502).json({ error: "语音合成失败：" + err.message });
  }
});

export default router;
