// backend/scripts/generate-subtitles.mjs
//
// 根据 src/data/lessons.js 的课程数据，为每一节课生成
// 中泰双语 WebVTT 字幕文件：
//   backend/subtitles/<lessonId>.zh.vtt   （中文）
//   backend/subtitles/<lessonId>.th.vtt   （泰语）
//
// 运行：node backend/scripts/generate-subtitles.mjs
// 说明：当前为示例字幕（与示例视频配套）。以后换成真实字幕时，
//       直接替换 backend/subtitles/ 下的文件即可，字段结构不变。

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { lessonData } from "../../src/data/lessons.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "subtitles");

fs.mkdirSync(outDir, { recursive: true });

// 每条字幕的时长（秒）与起始时间
const CUE_LENGTH = 5;
const CUE_STARTS = [0, 5, 10, 15, 20, 25, 30];

// 中文字幕（按课程序号插入课程标题 / 简介，让每课内容不同）
function zhCues(lesson) {
  return [
    `欢迎学习《${lesson.title}》`,
    `本课主题：${lesson.description}`,
    "请跟着视频学习，注意泰语的发音与语调。",
    "遇到生词可以暂停，并打开「词汇」页复习。",
    "坚持每天练习，泰语水平会稳步提升。",
    "本视频为示例内容，用于学习体验。",
    "学得不错，我们下一课再见！",
  ];
}

// 泰语字幕（示例跟读内容，与中文字幕时间轴一致）
const thCues = [
  "สวัสดีครับ ยินดีต้อนรับสู่บทเรียนภาษาไทย",
  "วันนี้เราจะมาเรียนรู้ไปด้วยกัน",
  "ฟังและพูดตามได้เลยครับ",
  "ถ้ามีคำศัพท์ใหม่ ๆ ให้จดไว้ก่อน",
  "ฝึกทุกวัน ความสามารถจะดีขึ้นเรื่อย ๆ",
  "คลิปนี้เป็นตัวอย่างสำหรับการเรียน",
  "เจอกันใหม่ในบทเรียนถัดไปครับ",
];

function toVtt(cues) {
  const pad = (n) => String(n).padStart(2, "0");
  const ts = (s) =>
    `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}.${String(
      Math.floor((s % 1) * 1000)
    ).padStart(3, "0")}`;

  const lines = ["WEBVTT", ""];

  CUE_STARTS.forEach((start, i) => {
    const end = start + CUE_LENGTH;
    lines.push(`${ts(start)} --> ${ts(end)}`);
    lines.push(cues[i] ?? cues[cues.length - 1]);
    lines.push("");
  });

  return lines.join("\n");
}

let count = 0;

for (const lessons of Object.values(lessonData)) {
  for (const lesson of lessons) {
    const zhFile = path.join(outDir, `${lesson.id}.zh.vtt`);
    const thFile = path.join(outDir, `${lesson.id}.th.vtt`);

    fs.writeFileSync(zhFile, toVtt(zhCues(lesson)));
    fs.writeFileSync(thFile, toVtt(thCues));

    count += 2;
  }
}

console.log(`已生成 ${count} 个字幕文件 → ${outDir}`);
