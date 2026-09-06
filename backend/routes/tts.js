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

router.get("/tts", async (req, res) => {
  const text = String(req.query.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "缺少 text 参数" });
  }
  if (Buffer.byteLength(text, "utf-8") > 12000) {
    return res.status(400).json({ error: "text 过长" });
  }

  const voice = String(req.query.voice || "th-TH-PremwadeeNeural").slice(0, 100);
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

  // 缓存命中直接返回（key 含 v，格式升级后旧缓存自动失效）
  const cached = ttsCacheGet(text, voice, rate, pitch, v);
  if (cached) {
    res.set({
      "Content-Type": "audio/wav",
      "Cache-Control": cacheControl,
      "X-TTS-Cache": "hit",
    });
    return res.send(cached);
  }

  try {
    const audio = await synthesizeThai(text, { voice, rate, rateNum, pitch, pitchNum });
    ttsCacheSet(text, voice, rate, pitch, v, audio);
    res.set({
      "Content-Type": "audio/wav",
      "Cache-Control": cacheControl,
      "X-TTS-Cache": "miss",
    });
    return res.send(audio);
  } catch (err) {
    console.error("[tts] 合成失败:", err.message);
    return res.status(502).json({ error: "语音合成失败：" + err.message });
  }
});

export default router;
