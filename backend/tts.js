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
import { existsSync } from "fs";
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
// 96kbps 是稳定且质量较好的选择，48kHz 格式连接不稳定。
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

// 转换器路径：绝不能只写 "ffmpeg" 依赖 PATH。后端常由 GUI/nohup/服务脚本
// 启动，PATH 可能只有 /usr/bin:/bin（实测本机就是这样）——那样 ffmpeg 会 ENOENT，
// 转换静默失败后直接返回未限幅的原始 Edge MP3（听感发燥、且响应头写着 wav）。
const AFCONVERT_BIN = "/usr/bin/afconvert"; // macOS 系统自带，绝对路径最稳
const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  "/opt/homebrew/bin/ffmpeg", // Apple Silicon Homebrew
  "/usr/local/bin/ffmpeg", // Intel Homebrew
  "/usr/bin/ffmpeg",
].filter(Boolean);

function resolveFfmpeg() {
  for (const p of FFMPEG_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return "ffmpeg"; // 都不在 → 交给 PATH（Docker 镜像里装的就是这种）
}

// 转换结果有效性校验：必须是真的 RIFF/WAV 且能定位到 PCM 数据块。
// afconvert 偶发写出不可用文件、ffmpeg 被 SIGKILL 等情况都靠这一步拦住。
function isUsableWav(buf) {
  return (
    buf &&
    buf.length > 1024 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    findPcmOffset(buf) > 0
  );
}

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
  // engine=edge：强制走神经语音路线（跳过 say）。用于预生成课文音频等
  // 需要「与线上在线 TTS 同一声源」的场景。
  // engine=google：走谷歌翻译 TTS（必须由服务器中转，见 synthesizeWithGoogle）。
  const engine =
    options.engine === "edge" || options.engine === "google"
      ? options.engine
      : "auto";

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
  // format=aac：限幅后的音频再编码成 M4A/AAC（移动端体积优化，见 convertToAac）。
  // 默认 wav。注意：这是「所有声源共用」的后处理，say 路线也不能绕过——
  // 否则 macOS 上 rate≥0.9 的请求会一边被前端标成 fmt=aac、一边拿到 WAV。
  const format = options.format === "aac" ? "aac" : "wav";

  if (engine === "auto" && pitchNum === 1 && rateNum >= 0.9) {
    try {
      return maybeEncodeAac(await synthesizeWithSay(clean, rateNum), format);
    } catch (err) {
      console.warn("[tts] say 合成失败，回退 Edge:", err.message);
    }
  } else if (pitchNum !== 1 || rateNum < 0.9) {
    console.log(
      `[tts] ${rateNum < 0.9 ? `慢速(${rateNum})` : `非默认音调(${pitchNum})`}，走 Edge prosody`
    );
  }

  // 2) 谷歌翻译 TTS 路线（仅显式指定时）：服务器代拉，客户端在国内也能用
  if (engine === "google") {
    return maybeEncodeAac(
      await toWavWithRetry(
        () => synthesizeWithGoogle(clean, { slow: rateNum < 0.9 }),
        "谷歌"
      ),
      format
    );
  }

  // 3) Edge 神经语音路线（默认备用）
  return maybeEncodeAac(
    await toWavWithRetry(() => synthesizeMp3(clean, { voice, rate, pitch }), "Edge"),
    format
  );
}

/* 谷歌翻译 TTS（非官方 translate_tts 接口）——只能由服务器中转。

   为什么必须中转：translate.google.com / translate.googleapis.com 在大陆网络不可达，
   浏览器直连一定失败（前端 speakThaiWithGoogle 只是历史兜底，实际命中率极低）。
   客户端只请求我们自己的 /api/tts，由服务器去取——能否取到取决于「服务器所在网络」：

   · 服务器在墙外（香港/日本等）：直连即可，用默认 base。
   · 服务器在大陆：机房出口同样被墙，直连必然失败。此时必须把 TTS_GOOGLE_BASE
     指向你自己的境外中转（例：TTS_GOOGLE_BASE=https://relay.example.com，
     中转把 /translate_tts?... 原样转发给 translate.googleapis.com）。
     没配中转时该路线会直接报错，上游会按 502 返回，不会拖垮默认路线。

   另两个硬约束：① tw-ob 接口每请求只接受约 200 字符，超了直接报错，
   这里按 180 字符切段后拼接（拼接处可能有极短的断续，长句慎用）；
   ② 输出是 64kbps/24kHz 单声道 MP3，音质与带宽都不如 Edge 神经语音，
   建议只当备用声源，不要当主力。 */
const GOOGLE_TTS_MAX_CHARS = 180;
const GOOGLE_TTS_HOSTS = ["https://translate.googleapis.com", "https://translate.google.com"];

function googleTtsBases() {
  const relay = String(process.env.TTS_GOOGLE_BASE || "").trim().replace(/\/+$/, "");
  return relay ? [relay] : GOOGLE_TTS_HOSTS;
}

// 按 180 字符切段：优先在空格/换行处断开，避免把词切两半（泰语词间无空格，
// 兜底硬切——Google 对任意片段都能合成，只是接缝处可能听得出停顿）
function splitGoogleText(text) {
  const chars = [...text];
  const out = [];
  let rest = chars;
  while (rest.length > GOOGLE_TTS_MAX_CHARS) {
    let cut = -1;
    for (let i = GOOGLE_TTS_MAX_CHARS; i > GOOGLE_TTS_MAX_CHARS - 40 && i > 0; i -= 1) {
      if (rest[i] === " " || rest[i] === "\n") {
        cut = i;
        break;
      }
    }
    if (cut <= 0) cut = GOOGLE_TTS_MAX_CHARS;
    out.push(rest.slice(0, cut).join("").trim());
    rest = rest.slice(cut);
  }
  const tail = rest.join("").trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

async function synthesizeWithGoogle(text, { slow = false } = {}) {
  const parts = splitGoogleText(text);
  const buffers = [];

  for (const part of parts) {
    const query =
      "?ie=UTF-8&client=tw-ob&tl=th" +
      `&ttsspeed=${slow ? "0.24" : "1"}` +
      `&q=${encodeURIComponent(part)}`;

    let lastErr = null;
    let got = null;
    for (const base of googleTtsBases()) {
      try {
        const res = await fetch(`${base}/translate_tts${query}`, {
          headers: { "User-Agent": USER_AGENT, Referer: "https://translate.google.com/" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        // Google 失败时会返回很短的 HTML 错误页/空体，用长度做一道粗筛
        if (buf.length < 512) throw new Error(`返回内容过短（${buf.length}B）`);
        got = buf;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!got) {
      throw new Error(`谷歌 TTS 取音失败：${lastErr ? lastErr.message : "未知错误"}`);
    }
    buffers.push(got);
  }

  return Buffer.concat(buffers);
}

/* 把「合成 MP3」与「转 WAV + 限幅」解耦：转换失败时重新合成一次再转。

   为什么需要这一层：实测 afconvert 会拒收约 1/3 的 Edge 分片流
   （"Couldn't open input file ('dta?')"，同样长度的两份流一份能转一份不能，
   与具体分片有关），而回退的原始 MP3 没有经过峰值限幅——听感发燥，
   且与 WAV 采样率不同。宁可多花一次合成，也不要回退成未限幅 MP3。

   极端情况下两个转换器都不行 → 返回原始 MP3，由路由层按实际字节标 audio/mpeg
   （不能一律标 audio/wav：helmet 带 nosniff，错标 MIME 会被部分浏览器拒播）。 */
async function toWavWithRetry(makeMp3, label) {
  ttsStats.synthTotal += 1;
  let mp3 = await makeMp3();
  try {
    return await convertToWav(mp3);
  } catch (err) {
    ttsStats.wavRetry += 1;
    console.warn(
      `[tts] ${label} 转 WAV 失败（afconvert/ffmpeg 都没产出可用 WAV），重新合成一次:`,
      err.message
    );
  }
  try {
    mp3 = await makeMp3();
    return await convertToWav(mp3);
  } catch (err) {
    ttsStats.mp3Fallback += 1;
    console.warn(
      `[tts] ${label} 重试后仍无法转 WAV，回退未限幅原始 MP3（按 audio/mpeg 返回）:`,
      err.message
    );
    return mp3;
  }
}

/* 把已限幅的 WAV 再编码成 M4A/AAC（48kbps 单声道）——移动端体积优化。

   为什么需要：动态 TTS 返回的是 24kHz 未压缩 WAV = 48KB/s，一句话 5 秒就
   240KB；4G/微信 WebView 里边下边播容易卡（课文音频早就为同样原因统一
   换成 M4A/AAC 48kbps，移动端解码兼容性有现成验证）。AAC 48kbps 约 6KB/s，
   体积降到 1/8。

   顺序：先限幅（PCM 域）再编码，绝不把未限幅音频编码后发出去。
   两个转换器都失败 → 抛错，由 maybeEncodeAac 回退返回 WAV（功能不受影响，
   只是文件大）；极端情况下连 WAV 都没有（已是 MP3 降级）→ 直接返回 MP3。 */
async function convertToAac(wavBuf) {
  const tag = crypto.randomBytes(8).toString("hex");
  const inPath = join(tmpdir(), `thaiai-aac-${tag}.wav`);
  const outPath = join(tmpdir(), `thaiai-aac-${tag}.m4a`);
  try {
    await writeFile(inPath, wavBuf);
    try {
      await execFileAsync(
        AFCONVERT_BIN,
        ["-f", "m4af", "-d", "aac", "-b", "48000", inPath, outPath],
        { timeout: 20000 }
      );
      const out = await readFile(outPath).catch(() => null);
      if (!isUsableM4a(out)) throw new Error("afconvert 产出不可用");
      return out;
    } catch (e) {
      console.warn("[tts] afconvert 转 AAC 失败，改用 ffmpeg:", e.message);
    }
    await execFileAsync(
      resolveFfmpeg(),
      [
        "-y", "-i", inPath,
        "-c:a", "aac",
        "-b:a", "48k",
        "-ac", "1",
        "-movflags", "+faststart",
        outPath,
      ],
      { timeout: 30000 }
    );
    const out = await readFile(outPath).catch(() => null);
    if (!isUsableM4a(out)) throw new Error("ffmpeg 产出不可用");
    return out;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

// M4A 粗校验：ISO-BMFF 文件第 4~8 字节是 'ftyp'（与 RIFF 的 'RIFF' 同位）
function isUsableM4a(buf) {
  return (
    buf &&
    buf.length > 512 &&
    buf.slice(4, 8).toString("latin1") === "ftyp"
  );
}

async function maybeEncodeAac(audio, format) {
  if (format !== "aac") return audio;
  // 已经是 MP3 降级（转换器全不可用）→ 没有 WAV 可编，直接返回，别把事情搞糟
  if (!isUsableWav(audio)) return audio;
  try {
    const m4a = await convertToAac(audio);
    ttsStats.aacEncoded += 1;
    return m4a;
  } catch (err) {
    ttsStats.aacFailed += 1;
    console.warn("[tts] AAC 编码失败，回退 WAV（体积大但可播）:", err.message);
    return audio;
  }
}

/* 把文本分包合成 Edge 神经语音，返回拼接后的 MP3。
   内含连接级重试与 403 时钟偏移校正；提取成函数是为了在
   「转换失败 → 重新合成一次」的重试路径里复用。 */
async function synthesizeMp3(clean, { voice, rate, pitch }) {
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

  return Buffer.concat(outputs);
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
    let wav = null;
    try {
      await execFileAsync(
        AFCONVERT_BIN,
        ["-f", "WAVE", "-d", "LEI16@24000", inPath, outPath],
        { timeout: 20000 }
      );
      wav = await readFile(outPath).catch(() => null);
      // afconvert 对 Edge 的分片 MP3 偶发拒收（实测约 1/3：同名同长文件一份能转
      // 一份报 "Couldn't open input file"）——不能只看退出码，必须验证产物。
      if (!isUsableWav(wav)) {
        console.warn("[tts] afconvert 产出不可用（长度/魔数校验不通过），改用 ffmpeg");
        wav = null;
      }
    } catch (e) {
      console.warn("[tts] afconvert 不可用，改用 ffmpeg 转 WAV:", e.message);
    }

    if (!wav) {
      // afconvert 不可用（Linux 容器）或产物不可用 → ffmpeg 兜底
      // 优化参数：44.1kHz 采样率 + 轻度低通滤波去高频噪声
      const ffmpegBin = resolveFfmpeg();
      await execFileAsync(
        ffmpegBin,
        [
          "-y", "-i", inPath,
          "-af", "lowpass=f=12000,aresample=44100",
          "-ac", "1",
          "-ar", "44100",
          "-c:a", "pcm_s16le",
          outPath,
        ],
        { timeout: 30000 }
      );
      wav = await readFile(outPath).catch(() => null);
      if (!isUsableWav(wav)) {
        throw new Error(`音频转换失败：${ffmpegBin} 也未能产出可用 WAV`);
      }
    }
    // Edge 的 MP3 响度极满（实测峰值 1.000、多处削波，听感发燥带“电音”），
    // 解码成 WAV 后仍会削波。这里做纯 PCM 增益衰减：峰值超过 0.80 就整体
    // 压到 0.80，消除削波爆音；峰值未超则原样返回（say 路线不受影响）。
    return applyWavPeakLimit(wav, 0.80);
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

// 缓存 key 含音频格式版本（v）：格式升级后旧缓存自动失效，
// 避免新版请求命中旧格式（如历史 MP3→WAV 切换）的缓存字节。
function cacheKey(text, voice, rate, pitch, version) {
  return `${voice}|${rate}|${pitch}|v${version || 0}|${text}`;
}

export function ttsCacheGet(text, voice, rate, pitch, version) {
  return cache.get(cacheKey(text, voice, rate, pitch, version)) || null;
}

export function ttsCacheSet(text, voice, rate, pitch, version, buf) {
  const key = cacheKey(text, voice, rate, pitch, version);
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// ----------------------------------------------------------------
// 运行时能力与统计（供 GET /api/tts/health 巡检）
// ----------------------------------------------------------------

/* 各平台的退化点不一样，而退化以前都是静默的：
   · macOS 开发机：afconvert 一定在（偶发拒收由 ffmpeg 接住）
   · Linux 容器：没有 afconvert，全靠镜像里的 ffmpeg（缺了就直接发原始 MP3）
   · Windows：两者都没有 → 必定发原始 MP3
   把这些计数暴露出来，才能「全平台都搞好」而不是靠耳朵猜。 */
export const ttsStats = {
  synthTotal: 0, // 实际走合成+转换的次数
  wavRetry: 0, // 首次转 WAV 失败、重新合成过的次数（>0 说明平台依赖不稳）
  mp3Fallback: 0, // 最终只能返回未限幅原始 MP3 的次数（>0 必须查平台依赖）
  aacEncoded: 0, // 成功编码 M4A/AAC 的次数
  aacFailed: 0, // AAC 编码失败回退 WAV 的次数
};

function toolchainSnapshot() {
  const ffmpegResolved = resolveFfmpeg();
  return {
    platform: `${process.platform}/${process.arch}`,
    bins: {
      afconvert: existsSync(AFCONVERT_BIN) ? AFCONVERT_BIN : null,
      // null = 常见绝对路径都没命中，只能指望 PATH（容器内就是这种）
      ffmpeg: ffmpegResolved === "ffmpeg" ? null : ffmpegResolved,
      say: existsSync("/usr/bin/say") ? "/usr/bin/say" : null,
    },
    google: { relay: Boolean(process.env.TTS_GOOGLE_BASE) },
    stats: { ...ttsStats },
    cache: { size: cache.size, max: CACHE_MAX },
  };
}

/* 平台能力快照。probe=true 时真跑一次完整链路（合成→转 WAV→限幅），
   这样「这台机器到底行不行」不用靠猜：返回格式应为 wav，peak 应 ≤0.80。 */
export async function getTtsHealth({ probe = false } = {}) {
  const snapshot = toolchainSnapshot();
  if (!probe) return snapshot;

  const t0 = Date.now();
  try {
    const buf = await synthesize("สวัสดีครับ", {
      engine: "edge", // 固定走 Edge：这才是生产默认声源
      rate: "-28%",
      rateNum: 0.72,
      format: "wav",
    });
    const isWav = isUsableWav(buf);
    let peak = null;
    if (isWav) {
      const start = findPcmOffset(buf);
      let max = 0;
      for (let i = start; i + 1 < buf.length; i += 2) {
        const v = Math.abs(buf.readInt16LE(i));
        if (v > max) max = v;
      }
      peak = Number((max / 32768).toFixed(3));
    }
    snapshot.live = {
      ok: isWav,
      ms: Date.now() - t0,
      bytes: buf.length,
      format: isWav ? "wav" : isUsableM4a(buf) ? "m4a" : "mp3（降级：转换器不可用）",
      peak,
      // 限幅目标是 0.80；>0.85 说明限幅没跑完，发出去就是发燥的原始音量
      clipped: peak === null ? null : peak > 0.85,
    };
  } catch (err) {
    snapshot.live = { ok: false, ms: Date.now() - t0, error: err.message };
  }
  return snapshot;
}

export { synthesize as synthesizeThai };
