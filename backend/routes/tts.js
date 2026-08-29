// backend/routes/tts.js
// GET /api/tts?text=สวัสดี&rate=0.78&voice=th-TH-PremwadeeNeural
// 返回 audio/wav（首选 macOS say/Kanya，回退 Edge TTS；内存缓存）

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

  // 缓存命中直接返回
  const cached = ttsCacheGet(text, voice, rate, pitch);
  if (cached) {
    res.set({
      "Content-Type": "audio/wav",
      // 不能开浏览器缓存：输出格式曾从 MP3 改为 WAV，旧缓存会导致
      // 已访问过该 URL 的浏览器继续拿旧 MP3（无法解码）。
      // 内存缓存（tts.js）已承担去重，HTTP 层无需再缓存。
      "Cache-Control": "no-store",
      "X-TTS-Cache": "hit",
    });
    return res.send(cached);
  }

  try {
    const audio = await synthesizeThai(text, { voice, rate, rateNum, pitch, pitchNum });
    ttsCacheSet(text, voice, rate, pitch, audio);
    res.set({
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
      "X-TTS-Cache": "miss",
    });
    return res.send(audio);
  } catch (err) {
    console.error("[tts] 合成失败:", err.message);
    return res.status(502).json({ error: "语音合成失败：" + err.message });
  }
});

export default router;
