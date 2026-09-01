// backend/tts.js
//
// 泰语在线合成（Edge TTS / Microsoft 神经语音）
// ----------------------------------------------------------------// 背景：本项目最初用浏览器 speechSynthesis + Google TTS 兜底，
// 但在中国网络环境下 Google 被墙、部分 WebView 的 speechSynthesis
// 无法出声。Edge TTS（speech.platform.bing.com）在国内可达且支持
// 高质量泰语神经语音（th-TH-NiwatNeural 等），作为统一兜底。
//
// 协议参考 edge-tts（MIT）：https://github.com/rany2/edge-tts
// - Sec-MS-GEC = SHA256(5分钟窗口的 Windows FILETIME 刻度 + token)，大写 hex
// - 连接带 MUID cookie；文本按 4096 字节分包
// - 连接不稳定（GFW 概率性 TLS 重置），内置重试 + 403 时钟偏移补偿
//
// 输出：Edge 只接受 MP3 格式（其他格式一律 1007 拒绝），但部分 WebView
// （本项目的预览内核）对 Edge 的 24kHz MP3 流解析失败——<audio> 报 code 3/4、
// decodeAudioData 只能解出 0.1s。实测这些环境可正常解码标准 PCM WAV，
// 因此合成后用 macOS 自带 afconvert 转成 WAV 再返回（缓存存 WAV）。


import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink, writeFile } from "fs/promises";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`;
const WIN_EPOCH = 11644473600; // seconds between 1601-01-01 and 1970-01-01

const WSS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

// 输出格式：MP3（audio-24khz-96kbitrate-mono-mp3）。
// 注意：Edge 服务端只接受 MP3 格式（其他格式一律 1007 拒绝）；
// 码率必须用 96kbps——默认 48kbps 的压缩噪声明显（高频能量高 3.4 倍，
// 听感发闷、带“电音”），96kbps 干净很多。
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

const MAX_TEXT_BYTES = 4096; // edge-tts 的分包上限（UTF-8 字节）
const MAX_TOTAL_TEXT_BYTES = 12000;
const MAX_CONNECT_ATTEMPTS = 5;
const CONNECT_TIMEOUT_MS = 12000;
const RECEIVE_TIMEOUT_MS = 45000;

// 时钟偏移（秒），403 时根据服务端 Date 头校正
let clockSkewSeconds = 0;

function windowsTickWindow() {
  let ticks = Date.now() / 1000 + WIN_EPOCH + clockSkewSeconds;
  ticks -= ticks % 300; // 5 分钟窗口
  return Math.round(ticks * 1e7);
}

function generateSecMsGec() {
  const str = `${windowsTickWindow()}${TRUSTED_CLIENT_TOKEN}`;
  return crypto
    .createHash("sha256")
    .update(str, "ascii")
    .digest("hex")
    .toUpperCase();
}

function parseRfc2616Date(dateStr) {
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? t / 1000 : null;
}

function dateToStr() {
  return new Date()
    .toUTCString()
    .replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function removeIncompatibleChars(s) {
  return [...s]
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31)) {
        return " ";
      }
      return ch;
    })
    .join("");
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 扫描 WAV 缓冲里 PCM 数据的起始位置：RIFF 头部里找 "data" 子块标记，
// PCM 数据从 "data" + 4 字节长度字段之后开始（标准头部共 44 字节）
function findPcmOffset(buf) {
  for (let i = 12; i < buf.length - 8; i += 1) {
    if (
      buf[i] === 0x64 && // d
      buf[i + 1] === 0x61 && // a
      buf[i + 2] === 0x74 && // t
      buf[i + 3] === 0x61 // a
    ) {
      return i + 8;
    }
  }
  return -1;
}

// 按 4096 UTF-8 字节分包，优先在换行/空格处断开，避免切断多字节字符
function splitText(text) {
  const buf = Buffer.from(text, "utf-8");
  const chunks = [];
  let rest = buf;
  while (rest.length > MAX_TEXT_BYTES) {
    let cut = rest.lastIndexOf(0x0a, MAX_TEXT_BYTES - 1); // \n
    if (cut < 0) cut = rest.lastIndexOf(0x20, MAX_TEXT_BYTES - 1); // space
    if (cut < 0) cut = MAX_TEXT_BYTES;
    // 回退到合法 UTF-8 边界
    while (cut > 0 && (rest[cut] & 0xc0) === 0x80) cut -= 1;
    if (cut <= 0) cut = MAX_TEXT_BYTES;
    chunks.push(rest.slice(0, cut).toString("utf-8"));
    rest = rest.slice(cut);
  }
  if (rest.length > 0) chunks.push(rest.toString("utf-8"));
  return chunks;
}

function synthesizeChunk(text, { voice, rate, pitch }) {
  return new Promise((resolve, reject) => {
    const url =
      `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
      `&ConnectionId=${crypto.randomUUID().replace(/-/g, "")}` +
      `&Sec-MS-GEC=${generateSecMsGec()}` +
      `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const headers = {
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "Sec-WebSocket-Version": "13",
      "User-Agent": USER_AGENT,
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": `muid=${crypto.randomBytes(16).toString("hex").toUpperCase()};`,
    };

    const ws = new WebSocket(url, {
      headers,
      handshakeTimeout: CONNECT_TIMEOUT_MS,
      perMessageDeflate: true,
    });

    const chunks = [];
    let audioBytes = 0;
    let settled = false;
    let connectTimer = null;

    const cleanup = () => {
      try {
        ws.removeAllListeners();
        ws.terminate();
      } catch (e) {
        // ignore
      }
    };

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      cleanup();
      if (err) reject(err);
      else resolve({ audio: Buffer.concat(chunks), bytes: audioBytes });
    };

    connectTimer = setTimeout(() => {
      finish(new Error("连接超时"));
    }, CONNECT_TIMEOUT_MS + 5000);

    ws.on("open", () => {
      clearTimeout(connectTimer);
      const ts = dateToStr();
      ws.send(
        `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"${OUTPUT_FORMAT}"}}}}\r\n`
      );
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='th-TH'>` +
        `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${crypto.randomUUID().replace(/-/g, "")}\r\n` +
          `Content-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`
      );
    });

    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        const s = data.toString();
        if (s.includes("Path:turn.start")) {
          chunks.length = 0;
          audioBytes = 0;
        } else if (s.includes("Path:turn.end")) {
          if (audioBytes === 0) {
            finish(new Error("服务未返回音频"));
          } else {
            finish(null);
          }
        }
      } else {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        if (2 + headerLen + 2 > buf.length) return;
        const headerText = buf.slice(2, 2 + headerLen).toString();
        const body = buf.slice(2 + headerLen + 2);
        if (headerText.includes("Path:audio") && body.length > 0) {
          if (audioBytes > 0) {
            // WAV：每个音频消息都是完整 RIFF 文件，后续块剥掉头部只留 PCM，
            // 与第一块的 RIFF 头拼接成单个合法 WAV
            const pcmOffset = findPcmOffset(body);
            if (pcmOffset > 0 && pcmOffset < body.length) {
              chunks.push(body.slice(pcmOffset));
              audioBytes += body.length - pcmOffset;
              return;
            }
          }
          chunks.push(body);
          audioBytes += body.length;
        }
      }
    });

    ws.on("unexpected-response", (req, res) => {
      const status = res.statusCode || 0;
      res.resume();
      const err = new Error(`服务拒绝：HTTP ${status}`);
      err.status = status;
      err.serverDate = res.headers && res.headers.date;
      finish(err);
    });

    ws.on("error", (e) => {
      finish(new Error(`连接失败：${e.message || "未知错误"}`));
    });

    ws.on("close", (code) => {
      if (!settled) {
        finish(new Error(`连接提前关闭（code ${code}）`));
      }
    });
  });
}

// 合成整段文本。
// 首选 macOS 本地 `say -v Kanya`：系统自带泰语语音（与浏览器 speechSynthesis
// 同一声源），AIFF→WAV 为无损 PCM 转换，无网络依赖、无 MP3 解码歧义。
// 实测远比 Edge MP3 链干净（无削波、基频周期相关 1.00 vs 0.90、无压缩噪声）。
// 失败（非 macOS / 无 Kanya）时回退 Edge TTS（96kbps → afconvert 转 WAV）。
async function synthesize(text, options = {}) {
  const voice = options.voice || "th-TH-PremwadeeNeural"; // Edge 备用声源
  const rate = options.rate || "+0%"; // Edge prosody 格式
  const pitch = options.pitch || "+0%"; // Edge prosody 格式
  const rateNum = Number(options.rateNum) || 1; // say 用的数字语速
  const pitchNum = Number(options.pitchNum) || 1; // say 用的数字音调（0.5~2.0）

  const clean = removeIncompatibleChars(String(text || ""));
  if (!clean.trim()) throw new Error("文本为空");

  const totalBytes = Buffer.byteLength(clean, "utf-8");
  if (totalBytes > MAX_TOTAL_TEXT_BYTES) {
    throw new Error(`文本过长（${totalBytes} 字节，上限 ${MAX_TOTAL_TEXT_BYTES}）`);
  }

  // 1) macOS `say` 路线（首选）——仅限「默认音调且非慢速」：
  //    · say 不支持音调参数（-p 在多数 macOS 版本不存在）→ 非默认音调走 Edge
  //    · say 在 <155wpm 进入平读模式（实测声调起伏 CV 0.206→0.137，五声调被压扁），
  //      且 155~175wpm 字节级相同（say 自身钳制到自然语速）→ 慢速档（rate < 0.9）
  //      走 Edge prosody（-30% 真变慢且神经语音保声调）
  if (pitchNum === 1 && rateNum >= 0.9) {
    try {
      return await synthesizeWithSay(clean, rateNum);
    } catch (err) {
      console.warn("[tts] say 合成失败，回退 Edge:", err.message);
    }
  } else if (pitchNum !== 1 || rateNum < 0.9) {
    console.log(
      `[tts] ${rateNum < 0.9 ? `慢速(${rateNum})` : `非默认音调(${pitchNum})`}，走 Edge prosody`
    );
  }

  // 2) Edge TTS 路线（备用）
  const parts = splitText(clean);
  const outputs = [];

  for (const part of parts) {
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
      try {
        const result = await synthesizeChunk(part, { voice, rate, pitch });
        outputs.push(result.audio);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        // 403：根据服务端 Date 校正时钟偏移后重试
        if (err.status === 403 && err.serverDate) {
          const serverUnix = parseRfc2616Date(err.serverDate);
          if (serverUnix) {
            clockSkewSeconds = serverUnix - Date.now() / 1000;
          }
        }
        if (attempt === MAX_CONNECT_ATTEMPTS) {
          throw new Error(`泰语语音合成失败（已重试 ${attempt} 次）：${lastErr.message}`);
        }
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  }

  const mp3 = Buffer.concat(outputs);

  // 转成标准 PCM WAV（WebView 兼容），失败时回退返回原始 MP3
  try {
    return await convertToWav(mp3);
  } catch (err) {
    console.warn("[tts] afconvert 转 WAV 失败，回退 MP3:", err.message);
    return mp3;
  }
}

/* macOS `say -v Kanya` 合成泰语 → AIFF → afconvert 转标准 PCM WAV。
   Kanya 是系统自带泰语语音，AIFF→WAV 是无损 PCM 转换，绝无解码歧义。

   语速（重要）：say 在 ≤152wpm 时进入「平读」模式——实测同一句
   "ข้าวใหม่ปลามันไหม" 的声调起伏比从 5.32 骤降到 1.56，五声调几乎
   被抹平（这正是“音调变化不明显”的根因）。因此下限设为 155wpm，
   保证任何学习语速都落在自然语调区，声调清晰可辨；
   rateNum 1.0 用系统默认（≈175wpm）。
   注意：say 不支持音调参数（-p 不存在），音调控制由 Edge prosody 承担。
   临时文件用完即删。 */
async function synthesizeWithSay(text, rateNum) {
  const tag = crypto.randomBytes(8).toString("hex");
  const aiffPath = join(tmpdir(), `thaiai-say-${tag}.aiff`);
  const wavPath = join(tmpdir(), `thaiai-say-${tag}.wav`);
  try {
    const wpm = Math.max(155, Math.round(175 * (Number.isFinite(rateNum) ? rateNum : 1)));
    const args = ["-v", "Kanya"];
    // 显式传语速（仅当非默认值）：<155 已由上限钳制；>175 的快档必须显式
    // 传入，否则 say 用默认速度（之前的 `wpm < 175` 条件导致快档失效）
    if (wpm !== 175) args.push("-r", String(wpm));
    args.push(text, "-o", aiffPath);
    await execFileAsync("say", args, { timeout: 30000 });
    await execFileAsync(
      "afconvert",
      ["-f", "WAVE", "-d", "LEI16@22050", aiffPath, wavPath],
      { timeout: 20000 }
    );
    return await readFile(wavPath);
  } finally {
    await unlink(aiffPath).catch(() => {});
    await unlink(wavPath).catch(() => {});
  }
}

/* 用 macOS afconvert 把 MP3 转成标准 PCM WAV（LEI16@24kHz 单声道）。
   afconvert 是 macOS 自带工具，零额外依赖；WebView 对标准 WAV 的解码
   可靠性远高于 Edge 的 24kHz MP3 流。临时文件用完即删。

   Linux 部署（Docker）没有 afconvert，回退到 ffmpeg（镜像里已安装）做
   同样的 MP3→PCM WAV 转换——否则线上会直接把原始 MP3 返回给浏览器
   （无 WAV 化、无限幅，压缩噪声即“电音”）。两个转换器都失败才回退 MP3。 */
async function convertToWav(mp3Buffer) {
  const tag = crypto.randomBytes(8).toString("hex");
  const inPath = join(tmpdir(), `thaiai-tts-${tag}.mp3`);
  const outPath = join(tmpdir(), `thaiai-tts-${tag}.wav`);
  try {
    await writeFile(inPath, mp3Buffer);
    try {
      await execFileAsync(
        "afconvert",
        ["-f", "WAVE", "-d", "LEI16@24000", inPath, outPath],
        { timeout: 20000 }
      );
    } catch (e) {
      // afconvert 不存在（Linux 容器）或转换失败 → ffmpeg 兜底
      console.warn("[tts] afconvert 不可用，改用 ffmpeg 转 WAV:", e.message);
      await execFileAsync(
        "ffmpeg",
        ["-y", "-i", inPath, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", outPath],
        { timeout: 30000 }
      );
    }
    const wav = await readFile(outPath);
    // Edge 的 MP3 响度极满（实测峰值 1.000、多处削波，听感发燥带“电音”），
    // 解码成 WAV 后仍会削波。这里做纯 PCM 增益衰减：峰值超过 0.85 就整体
    // 压到 0.85，消除削波爆音；峰值未超则原样返回（say 路线不受影响）。
    return applyWavPeakLimit(wav, 0.85);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

/* 对标准 PCM16 WAV 做峰值限幅：遍历 data 块求峰值，超过 target 时
   整体乘增益（target/peak），低于则不动。零依赖、保持 RIFF 头部不变。 */
function applyWavPeakLimit(wavBuf, target) {
  const dataStart = findPcmOffset(wavBuf);
  if (dataStart <= 0 || dataStart + 2 > wavBuf.length) return wavBuf;

  // 16 位 PCM：data 长度须为偶数
  const dataLen = wavBuf.length - dataStart;
  const sampleCount = Math.floor(dataLen / 2);
  if (sampleCount < 1) return wavBuf;

  let peak = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const off = dataStart + i * 2;
    const v = wavBuf.readInt16LE(off);
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }

  // 峰值未超目标 → 原样返回（保持 say 路线的原始响度）
  if (peak <= target * 32767) return wavBuf;

  const gain = (target * 32767) / peak;
  for (let i = 0; i < sampleCount; i += 1) {
    const off = dataStart + i * 2;
    const v = Math.round(wavBuf.readInt16LE(off) * gain);
    wavBuf.writeInt16LE(v < -32768 ? -32768 : v > 32767 ? 32767 : v, off);
  }
  return wavBuf;
}

// ----------------------------------------------------------------
// 内存缓存（410 个生词会被反复播放，命中即秒回）
// ----------------------------------------------------------------

const cache = new Map();
const CACHE_MAX = 500;

function cacheKey(text, voice, rate, pitch) {
  return `${voice}|${rate}|${pitch}|${text}`;
}

export function ttsCacheGet(text, voice, rate, pitch) {
  return cache.get(cacheKey(text, voice, rate, pitch)) || null;
}

export function ttsCacheSet(text, voice, rate, pitch, buf) {
  const key = cacheKey(text, voice, rate, pitch);
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export { synthesize as synthesizeThai };
