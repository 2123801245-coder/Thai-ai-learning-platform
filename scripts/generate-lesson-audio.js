// scripts/generate-lesson-audio.js
// 为课文生成泰语朗读音频文件（调用本地后端 /api/tts，engine=edge 神经语音）
//
// 用法：
//   node scripts/generate-lesson-audio.js                # 默认：新增的第 10~12 课
//   node scripts/generate-lesson-audio.js --lesson lesson-10   # 指定一课
//   node scripts/generate-lesson-audio.js --all          # 全部课文
//   node scripts/generate-lesson-audio.js --base http://localhost:3001/api
//
// 输出：
//   public/lessons/audio/<lessonId>/<n>.m4a   每段一篇（n 从 1 开始）
//   public/lessons/audio/<lessonId>/full.m4a  整篇课文（一段合成）
//
// 格式（2026-09：WAV → M4A/AAC）：
//   旧版输出未压缩 WAV（22.05kHz PCM，全站 84MB），移动网络边下边播卡顿。
//   现在统一：engine=edge 取 Edge 神经语音（th-TH-PremwadeeNeural，即线上
//   在线 TTS 的声源，替代 macOS say 机械音）→ ffmpeg 转 AAC 48kbps 单声道
//   +faststart（moov 前置，浏览器可秒开播），全站约 12MB。
//
// 前置：后端已启动（npm run server:dev 或 docker 后端），
//       页面播放器会优先使用这些本地文件，rate/pitch 非默认时才走在线 TTS。

import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lessons } from "../src/data/courseTexts.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "lessons", "audio");
const DEFAULT_BASE = "http://localhost:3001/api";

function parseArgs(argv) {
  const args = { lesson: null, all: false, base: DEFAULT_BASE };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--lesson") args.lesson = argv[++i];
    else if (a === "--all") args.all = true;
    else if (a === "--base") args.base = argv[++i];
  }
  return args;
}

// 单次合成：text 过长时截断到后端上限（12000 字节）以内。
// engine=edge 强制神经语音路线（本地 macOS 的 say 机械音不再进入课文音频）。
async function synthesize(base, text) {
  const url = `${base}/tts?text=${encodeURIComponent(text)}&rate=1&pitch=1&engine=edge&v=4`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error("音频过短，疑似合成失败");
  return buf;
}

// WAV（后端已限幅 0.80）→ M4A/AAC 48kbps 单声道 +faststart
async function toM4a(wavBuf, outPath) {
  const tag = Math.random().toString(36).slice(2, 10);
  const inPath = join("/tmp", `thaiai-gen-${tag}.wav`);
  await writeFile(inPath, wavBuf);
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-i", inPath,
        "-c:a", "aac", "-b:a", "48k", "-ar", "24000", "-ac", "1",
        "-movflags", "+faststart",
        outPath,
      ],
      { timeout: 60000 }
    );
  } finally {
    await rm(inPath, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const targets = args.all
    ? lessons
    : args.lesson
      ? lessons.filter((l) => l.id === args.lesson)
      : lessons.filter((l) => ["lesson-10", "lesson-11", "lesson-12"].includes(l.id));

  if (!targets.length) {
    console.error("未找到目标课文。可用 --lesson <id> 或 --all。");
    process.exit(1);
  }

  console.log(`将生成 ${targets.length} 篇课文的音频（Edge 神经语音 → M4A）→ ${OUT_ROOT}`);
  for (const lesson of targets) {
    const dir = join(OUT_ROOT, lesson.id);
    await mkdir(dir, { recursive: true });
    console.log(`\n【${lesson.number}】${lesson.title}（${lesson.id}，${lesson.text.length} 段）`);

    // 逐段合成
    for (let i = 0; i < lesson.text.length; i += 1) {
      const out = join(dir, `${String(i + 1).padStart(2, "0")}.m4a`);
      try {
        const buf = await synthesize(args.base, lesson.text[i]);
        await toM4a(buf, out);
        console.log(`  ✓ 第 ${i + 1} 段`);
      } catch (e) {
        console.error(`  ✗ 第 ${i + 1} 段失败: ${e.message}`);
      }
      // 给 Edge 合成一滴喘息
      await new Promise((r) => setTimeout(r, 350));
    }

    // 整篇合成（逐段间用换行，单次调用）
    const fullText = lesson.text.join("\n");
    if (Buffer.byteLength(fullText, "utf-8") <= 12000) {
      try {
        const buf = await synthesize(args.base, fullText);
        await toM4a(buf, join(dir, "full.m4a"));
        console.log(`  ✓ 整篇 full.m4a`);
      } catch (e) {
        console.error(`  ✗ 整篇失败: ${e.message}`);
      }
    } else {
      console.warn("  - 整篇超长，跳过 full.m4a");
    }
  }
  console.log("\n完成。文件位置：public/lessons/audio/<lessonId>/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
