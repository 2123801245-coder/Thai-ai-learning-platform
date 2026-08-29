// scripts/generate-lesson-audio.js
// 为课文生成泰语朗读音频文件（调用本地后端 /api/tts，输出 WAV）
//
// 用法：
//   node scripts/generate-lesson-audio.js                # 默认：新增的第 10~12 课
//   node scripts/generate-lesson-audio.js --lesson lesson-10   # 指定一课
//   node scripts/generate-lesson-audio.js --all          # 全部 12 课
//   node scripts/generate-lesson-audio.js --base http://localhost:3001/api
//
// 输出：
//   public/lessons/audio/<lessonId>/<n>.wav   每段一篇（n 从 1 开始）
//   public/lessons/audio/<lessonId>/full.wav  整篇课文（一段合成）
//
// 前置：后端已启动（npm run dev:backend 或 docker 后端），
//       页面播放器会优先使用这些本地文件，rate/pitch 非默认时才走在线 TTS。

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lessons } from "../src/data/courseTexts.js";

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

// 单次合成：text 过长时截断到后端上限（12000 字节）以内
async function synthesize(base, text) {
  const url = `${base}/tts?text=${encodeURIComponent(text)}&rate=1&pitch=1`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error("音频过短，疑似合成失败");
  return buf;
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

  console.log(`将生成 ${targets.length} 篇课文的音频 → ${OUT_ROOT}`);
  for (const lesson of targets) {
    const dir = join(OUT_ROOT, lesson.id);
    await mkdir(dir, { recursive: true });
    console.log(`\n【${lesson.number}】${lesson.title}（${lesson.id}，${lesson.text.length} 段）`);

    // 逐段合成
    for (let i = 0; i < lesson.text.length; i += 1) {
      const out = join(dir, `${String(i + 1).padStart(2, "0")}.wav`);
      try {
        const buf = await synthesize(args.base, lesson.text[i]);
        await writeFile(out, buf);
        console.log(`  ✓ 第 ${i + 1} 段 (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        console.error(`  ✗ 第 ${i + 1} 段失败: ${e.message}`);
      }
      // 给后端 say/Edge 一点喘息
      await new Promise((r) => setTimeout(r, 350));
    }

    // 整篇合成（逐段间用换行，单次调用）
    const fullText = lesson.text.join("\n");
    if (Buffer.byteLength(fullText, "utf-8") <= 12000) {
      try {
        const buf = await synthesize(args.base, fullText);
        await writeFile(join(dir, "full.wav"), buf);
        console.log(`  ✓ 整篇 full.wav (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        console.error(`  ✗ 整篇失败: ${e.message}`);
      }
    } else {
      console.warn("  - 整篇超长，跳过 full.wav");
    }
  }
  console.log("\n完成。文件位置：public/lessons/audio/<lessonId>/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
