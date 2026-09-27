// ============================================================
// 逐句解析（双语精听）—— 直接读 y2a-auto 下载的原片与字幕
// ============================================================
//
// 数据来源：<Y2A_DOWNLOADS_DIR>/<taskId>/
//     video.mp4            原片，1920×1080（本地播放，不受 B 站外链 360P 限制）
//     metadata.json        yt-dlp 的原始信息（标题、原始频道、时长、分辨率）
//     video.th.srt         泰语字幕（ASR 产出，带伪影，需清洗）
//     translated_*.srt     中文字幕
//
// 为什么不把视频复制进仓库：y2a-auto 是上游流水线，随时会下新的视频；
// 直接读它的目录，数据永远跟最新一次下载一致，也不占两份磁盘。
// 目录可用 Y2A_DOWNLOADS_DIR 覆盖（部署时指向挂载进来的路径即可）。
//
// 「逐句」的质量取决于两步清洗，都是确定性的、不调 LLM：
//
//   1) 滚雪球伪影：这批 ASR 字幕的 cue 是**逐字增长**的 —— 后一条 cue 的
//      文本以前一条为前缀（甚至 10ms 的同文本重复）。不合并的话，一句话
//      会被切成一二十个碎片，逐句学习无从谈起。这里把这类 cue 并成一条：
//      文本取最长的那份，时间取并集。
//
//   2) 句边界：泰文没有句号，边界只能推断。用两个信号：
//        · 泰语 cue 之间 > 0.65s 的停顿（自然换气 / 断句处）
//        · **中文译文里出现的句末标点（。！？…）** —— 双语字幕在这里互相
//          帮忙：翻译是按句翻的，标点就是现成的句读。
//      另外给单句设了长度与时长上限，避免某个信号失灵时出现「一整段一句」。
//
// 输出给前端的是每句：{ i, start, end, th, zh }。
// 点句子跳转、单句循环、跟读都靠它 —— 没有额外依赖，也不需要联网。

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chatCompletion, resolveChatProvider } from "../aiProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 默认指向上游流水线的下载目录（仓库同级）；部署时用环境变量覆盖 */
const DEFAULT_DIR = path.resolve(__dirname, "../../../y2a-auto/downloads");
export const Y2A_DIR = process.env.Y2A_DOWNLOADS_DIR
  ? path.resolve(process.env.Y2A_DOWNLOADS_DIR)
  : DEFAULT_DIR;

/* taskId 就是流水线的任务 UUID，只允许这一种形状（防目录穿越） */
const TASK_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

const GAP_BREAK_MS = 650; // 泰语停顿超过它就断句
const MAX_SENTENCE_MS = 26000; // 单句上限：信号失灵时的保险
const MAX_SENTENCE_CHARS = 240;

/* AI 解析：磁盘缓存目录（<taskId>.json，不进 git —— 见 .gitignore） */
const AI_CACHE_DIR = path.resolve(__dirname, "../cache/bilingual");
const AI_BATCH_SIZE = 8; // 每次请求给模型几句（8 句一批，48 句 = 6 次请求）
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 120000;

// ============================================================
// SRT 解析
// ============================================================

function parseTimestamp(str) {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(str);
  if (!m) return null;
  const [, h, mm, s, ms] = m;
  return (
    Number(h) * 3600000 + Number(mm) * 60000 + Number(s) * 1000 + Number(ms)
  );
}

/** SRT 文本 → [{ start, end, text }]（毫秒；去掉 BOM、行内标签与样式指令） */
export function parseSrt(raw) {
  if (!raw) return [];
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const blocks = text.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) continue;
    const [from, to] = lines[timeIdx].split("-->");
    const start = parseTimestamp(from);
    const end = parseTimestamp(to);
    if (start == null || end == null) continue;
    /* 字幕换行只是排版：泰文与中文不分词（换行不该变成句子里的空格），
       只有两边都是拉丁字母/数字时才补一格空格。 */
    const body = lines
      .slice(timeIdx + 1)
      .map((l) => l.replace(/<[^>]+>/g, "").replace(/\{\\[^}]*\}/g, "").trim()) // <i>、{\an8}
      .filter(Boolean)
      .reduce((acc, line) => {
        if (!acc) return line;
        const glue = /[A-Za-z0-9]$/.test(acc) && /^[A-Za-z0-9]/.test(line);
        return acc + (glue ? " " : "") + line;
      }, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;
    cues.push({ start, end, text: dedupeRepeats(body) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

// ============================================================
// 清洗一：同一个片段被重复写了两遍
// ============================================================
// 这条流水线的翻译步骤有上下文窗口，输出里常出现同一片段连续出现两次：
//   現在你正站在一条船的中央現在你正站在一条船的中央一片無論望向...
//   你有没有试着回想一下，在你的你有没有试着回想一下，
// （第二种不是相邻重复：前缀「你有没有试着回想一下，」又被写了一遍，
//   中间隔着「在你的」。）
// 处理：找**最长的、在句中又出现一次的前缀**，把后面那次去掉。
// 宁可漏改也不误删 —— 所以要求重复片段至少 6 个字符。

export function dedupeRepeats(text) {
  if (!text) return text;
  const maxPrefix = Math.floor(text.length / 2);
  for (let len = maxPrefix; len >= 6; len -= 1) {
    const prefix = text.slice(0, len);
    const again = text.indexOf(prefix, len);
    if (again > 0) {
      return dedupeRepeats(prefix + text.slice(len, again) + text.slice(again + len));
    }
  }
  return text;
}

// ============================================================
// 清洗二：把「滚雪球」cue 合并成一条
// ============================================================

/**
 * 后一条 cue 是前一条的扩写（以前者为前缀）或完全重复 → 并成一条。
 * 文本取最长的那份，时间取并集；链式增长会一路并下去。
 */
export function collapseGrowing(cues) {
  const out = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (prev) {
      const same = cue.text === prev.text;
      const grows = cue.text.startsWith(prev.text);
      if (same || grows) {
        prev.end = Math.max(prev.end, cue.end);
        if (cue.text.length > prev.text.length) prev.text = cue.text;
        continue;
      }
    }
    out.push({ ...cue });
  }
  return out;
}

// ============================================================
// 切句：泰语停顿 + 中文句末标点，两个信号一起用
// ============================================================

const ZH_END = /[。！？…；]|\.\s*$/;

/** 句子末尾（含端点）落在哪个中文 cue 上 —— 中文标点就是泰语的句读 */
function zhEndsSentence(zhCues, atMs) {
  const hit = zhCues.find((c) => atMs >= c.start - 400 && atMs <= c.end + 400);
  return hit ? ZH_END.test(hit.text.trim()) : false;
}

export function splitSentences(thCues, zhCues) {
  const sentences = [];
  let cur = null;

  const flush = () => {
    if (!cur) return;
    const th = cur.parts.map((p) => p.text).join("");
    const zh = dedupeRepeats(cur.zhParts.join(""));
    if (th.trim()) {
      sentences.push({
        start: cur.start,
        end: cur.end,
        th: th.trim(),
        zh: zh.trim(),
      });
    }
    cur = null;
  };

  for (let i = 0; i < thCues.length; i += 1) {
    const cue = thCues[i];
    const prev = thCues[i - 1];

    if (cur) {
      const gap = cue.start - cur.end;
      const tooLong =
        cue.end - cur.start > MAX_SENTENCE_MS ||
        cur.parts.reduce((n, p) => n + p.text.length, 0) > MAX_SENTENCE_CHARS;
      /* 断句信号：停顿够久、上一句末尾落在中文句末标点上、或单句过长 */
      if (gap > GAP_BREAK_MS || zhEndsSentence(zhCues, cur.end) || tooLong) {
        flush();
      }
    }

    if (!cur) {
      cur = { start: cue.start, end: cue.end, parts: [], zhParts: [] };
    }
    /* 泰文连续书写，直接拼；中间若本来有空格（数字、拉丁词）也保留原样 */
    cur.parts.push({ text: cue.text });
    cur.end = Math.max(cur.end, cue.end);

    /* 覆盖到本 cue 的中文：多个中文 cue 会落在同一句上，而且短的往往是
       长的的一部分（“现在你正站在一条船的中央” vs 同句完整译文）——
       被包含的那些丢掉，只留真正补充信息的。 */
    const overlapping = zhCues.filter(
      (c) => c.end > cue.start - 200 && c.start < cue.end + 200
    );
    for (const z of overlapping) {
      if (cur.zhParts.includes(z.text)) continue;
      const covered = cur.zhParts.some((t) => t.includes(z.text));
      if (covered) continue;
      /* 新来的更长就把被它包住的旧片段挤掉 */
      cur.zhParts = cur.zhParts.filter((t) => !z.text.includes(t));
      cur.zhParts.push(z.text);
    }
  }

  flush();
  return sentences.map((s, i) => ({ i, ...s }));
}

// ============================================================
// 读一个任务目录
// ============================================================

function readIfExists(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function findTranslatedSrt(dir, taskId) {
  const candidates = [
    path.join(dir, `translated_${taskId}.srt`),
    path.join(dir, "translated.srt"),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  try {
    const hit = fs
      .readdirSync(dir)
      .find((f) => f.startsWith("translated") && f.endsWith(".srt"));
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

function readMeta(dir, taskId) {
  const raw = readIfExists(path.join(dir, "metadata.json")) ||
    readIfExists(path.join(dir, "video.info.json"));
  let info = {};
  try {
    info = raw ? JSON.parse(raw) : {};
  } catch {
    info = {};
  }
  return {
    taskId,
    youtubeId: info.id || null,
    title: info.title || taskId,
    channel: info.channel || info.uploader || null,
    channelUrl: info.channel_url || info.uploader_url || null,
    webpageUrl: info.webpage_url || null,
    duration: info.duration || null,
    resolution: info.resolution || null,
    thumbnail: `/videos/y2a/${taskId}.webp`,
    videoUrl: `/videos/y2a/${taskId}.mp4`,
  };
}

/* 解析结果缓存：key = taskId，按字幕文件 mtime 失效 */
const cache = new Map();

function taskPaths(taskId) {
  if (!TASK_ID_RE.test(taskId)) return null;
  const dir = path.join(Y2A_DIR, taskId);
  const thPath = path.join(dir, "video.th.srt");
  if (!fs.existsSync(thPath)) return null;
  return { dir, thPath, zhPath: findTranslatedSrt(dir, taskId) };
}

function loadTask(taskId) {
  const paths = taskPaths(taskId);
  if (!paths) return null;
  const { dir, thPath, zhPath } = paths;

  const stamp = `${fs.statSync(thPath).mtimeMs}:${
    zhPath ? fs.statSync(zhPath).mtimeMs : 0
  }`;
  const hit = cache.get(taskId);
  if (hit && hit.stamp === stamp) return hit.data;

  const meta = readMeta(dir, taskId);
  const thCues = collapseGrowing(parseSrt(readIfExists(thPath)));
  const zhCues = collapseGrowing(parseSrt(zhPath ? readIfExists(zhPath) : ""));

  const data = {
    ...meta,
    hasChinese: zhCues.length > 0,
    cueCount: thCues.length,
    sentences: splitSentences(thCues, zhCues),
  };
  cache.set(taskId, { stamp, data });
  return data;
}

/* 字幕指纹：AI 缓存按它失效（th mtime 与 zh mtime 拼接；th 缺失已在 taskPaths 拦下） */
function subtitleStamp(taskId) {
  const paths = taskPaths(taskId);
  if (!paths) return null;
  return `${fs.statSync(paths.thPath).mtimeMs}:${
    paths.zhPath ? fs.statSync(paths.zhPath).mtimeMs : 0
  }`;
}

/* 目录里所有“有原片”的任务（按修改时间新→旧） */
function listTasks() {
  let entries = [];
  try {
    entries = fs
      .readdirSync(Y2A_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && TASK_ID_RE.test(e.name));
  } catch {
    return [];
  }

  return entries
    .map((e) => {
      const dir = path.join(Y2A_DIR, e.name);
      const video = path.join(dir, "video.mp4");
      if (!fs.existsSync(video)) return null;
      const stat = fs.statSync(video);
      return {
        ...readMeta(dir, e.name),
        sizeMB: Math.round(stat.size / 1e6),
        updatedAt: stat.mtimeMs,
        hasSubtitles: fs.existsSync(path.join(dir, "video.th.srt")),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// ============================================================
// AI 逐句解析（重译 + 生词 + 语法）—— 走 aiProvider 统一出口
// ============================================================
//
// 字幕切句解决的是「句子怎么断」，AI 解决的是「句子怎么懂」：
//   · zh2   LLM 按上下文重译的中文（机翻 zh 仍保留，前端默认展示 zh2）
//   · vocab 每句 2~3 个生词：泰文 / 罗马音 / 词性 / 中文 / 例句
//   · grammar 一处最值得讲的语法点
//
// 成本与时延：48 句 × 每批 8 句 ≈ 6 次请求，首次生成约半分钟。
// 结果按 taskId 整片落盘（backend/cache/bilingual/<taskId>.json），
// 字幕文件变了才会失效重做 —— 同一视频只付一次钱。
//
// 生成是渐进的：每次请求只会补缺口（分批串行，每批之间让出事件循环），
// 前端轮询 /analysis 就能看到逐批填充的过程，不用等全部完成。

function aiCachePath(taskId) {
  return path.join(AI_CACHE_DIR, `${taskId}.json`);
}

function readAiCache(taskId) {
  try {
    return JSON.parse(fs.readFileSync(aiCachePath(taskId), "utf8"));
  } catch {
    return null;
  }
}

function writeAiCache(taskId, payload) {
  try {
    fs.mkdirSync(AI_CACHE_DIR, { recursive: true });
    fs.writeFileSync(aiCachePath(taskId), JSON.stringify(payload));
  } catch (e) {
    console.warn(`[bilingual] AI 缓存写入失败 ${taskId}:`, e?.message || e);
  }
}

/** 非空字符串才收（模型偶尔给 null / 空串 / 数字） */
function str(v) {
  const s = String(v ?? "").trim();
  return s && s !== "null" ? s : "";
}

/** 宽容 JSON：容忍 ```json 围栏与前后杂文（同 aiTeacher 的做法） */
function parseLooseJson(content) {
  let text = String(content || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildAnalysisPrompt(batch) {
  const list = batch
    .map((s) => `${s.i}. ${s.th}${s.zh ? `（参考机翻：${s.zh}）` : ""}`)
    .join("\n");
  return `你是泰语老师。下面是从一个视频字幕里切出来的泰语句子（可能带 ASR 错字），参考机翻仅供对照、往往生硬甚至串行。请逐句完成：

1. zh2：自然的中文翻译（口语化、通顺，修正机翻错误）。
2. vocab：2~3 个最值得学的生词/短语（挑实义词，别挑 ครับ/ค่ะ 这类礼貌词）。罗马音用 RTGS 风格并带声调（如 sà-wàt-dii）。
3. grammar：本句最值得讲的一个语法点（中文 1~2 句，说人话不堆术语；实在没有就写空字符串）。

句子列表：
${list}

必须只返回一个 JSON 对象（不要 markdown 围栏、不要其他文字），结构：
{"sentences":[{"i":句子编号,"zh2":"中文翻译","vocab":[{"th":"泰语词","pron":"罗马音","pos":"词性（动/名/形/副/短语等）","zh":"中文","example":"含该词的泰语短句"}],"grammar":"语法点或空串"}]}

sentences 必须覆盖上面列出的每一句，i 用原编号。泰语必须地道，绝不编造不确定的词。`;
}

/** 一批 → 解析结果按 i 对齐回填（模型漏掉的句子留空，下轮再补） */
async function enrichBatch(batch) {
  const raw = await chatCompletion(
    [
      { role: "system", content: "你是严谨的泰语教师，只输出 JSON。" },
      { role: "user", content: buildAnalysisPrompt(batch) },
    ],
    { temperature: 0.3, maxTokens: 2400, jsonMode: true, timeoutMs: AI_TIMEOUT_MS }
  );
  const parsed = parseLooseJson(raw);
  const byId = new Map();
  for (const item of Array.isArray(parsed?.sentences) ? parsed.sentences : []) {
    const id = Number(item?.i);
    if (Number.isInteger(id)) byId.set(id, item);
  }
  return batch.map((s) => {
    const hit = byId.get(s.i);
    if (!hit) return { i: s.i, zh2: "", vocab: [], grammar: "" };
    return {
      i: s.i,
      zh2: str(hit.zh2),
      vocab: (Array.isArray(hit.vocab) ? hit.vocab : [])
        .slice(0, 3)
        .map((v) => ({
          th: str(v?.th),
          pron: str(v?.pron),
          pos: str(v?.pos),
          zh: str(v?.zh),
          example: str(v?.example),
        }))
        .filter((v) => v.th && v.zh),
      grammar: str(hit.grammar),
    };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 同一 taskId 的并发请求共享同一次补齐过程（防止并发轮询重复花 LLM 钱） */
const inflight = new Map();

/**
 * 把整个视频的 AI 解析补齐（有缺口才调模型；磁盘缓存优先）。
 * @param {object} task    loadTask 的返回（含 sentences）
 * @param {string} stamp   字幕 mtime 指纹（缓存失效用）
 * @param {number} maxMs   最多跑多久（由请求方决定，防止轮询请求互相拖死）
 * @returns {Promise<{sentences, done, total, failed}>}
 */
async function ensureAnalysis(task, stamp, maxMs = 90_000) {
  const taskId = task.taskId;
  let payload = readAiCache(taskId);
  if (!payload || payload.stamp !== stamp) {
    payload = { stamp, model: resolveChatProvider()?.model || null, sentences: {} };
  }
  const store = payload.sentences || (payload.sentences = {});

  const pending = task.sentences.filter((s) => {
    const hit = store[s.i];
    return !hit || (!hit.zh2 && !hit.vocab.length && !hit.grammar);
  });
  const total = task.sentences.length;
  const doneAtStart = total - pending.length;

  const deadline = Date.now() + maxMs;
  let failed = 0;
  for (let i = 0; i < pending.length; i += AI_BATCH_SIZE) {
    if (Date.now() > deadline) break;
    const batch = pending.slice(i, i + AI_BATCH_SIZE);
    try {
      for (const row of await enrichBatch(batch)) {
        /* 只有真有内容才覆盖，避免一次失败把旧结果抹掉 */
        if (row.zh2 || row.vocab.length || row.grammar) store[row.i] = row;
      }
      writeAiCache(taskId, payload); // 每批落盘一次：中断也不浪费已生成的
    } catch (e) {
      failed += 1;
      console.warn(`[bilingual] AI 批次失败 ${taskId} #${batch[0].i}+:`, e?.message || e);
    }
    await sleep(300); // 批间小歇：别把上游打满
  }

  const sentences = task.sentences.map((s) => store[s.i] || { i: s.i, zh2: "", vocab: [], grammar: "" });
  const filled = sentences.filter((s) => s.zh2 || s.vocab.length || s.grammar).length;
  return { sentences, done: filled, total, failed };
}

// ============================================================
// 路由
// ============================================================

const router = express.Router();

/** 目录概况：前端用它把本地原片对到视频库的条目上（按 youtubeId 匹配） */
router.get("/", (req, res) => {
  const tasks = listTasks();
  res.json({
    dir: Y2A_DIR,
    exists: fs.existsSync(Y2A_DIR),
    count: tasks.length,
    tasks,
  });
});

router.get("/:taskId", (req, res) => {
  const data = loadTask(req.params.taskId);
  if (!data) {
    return res
      .status(404)
      .json({ error: "找不到这个任务的原片或字幕", taskId: req.params.taskId });
  }
  res.json(data);
});

/**
 * GET /:taskId/analysis —— AI 逐句解析（渐进生成）。
 * 返回 sentences 逐条附加 { zh2, vocab, grammar }，另有 done/total 供前端轮询。
 * 磁盘缓存命中时零成本秒回；有缺口时本次请求最多跑 AI_MAX_WORK_MS（默认 90s）
 * 补缺口，没补完的下一次轮询接着补。
 */
router.get("/:taskId/analysis", async (req, res) => {
  const data = loadTask(req.params.taskId);
  if (!data) {
    return res
      .status(404)
      .json({ error: "找不到这个任务的原片或字幕", taskId: req.params.taskId });
  }
  const stamp = subtitleStamp(req.params.taskId) || data.taskId;

  const wantsRefresh = ["1", "true"].includes(String(req.query.refresh || "").toLowerCase());
  const cached = readAiCache(req.params.taskId);
  const cachedOk = cached && cached.stamp === stamp && !wantsRefresh;
  const fullyDone = cachedOk
    ? data.sentences.every((s) => {
        const hit = cached.sentences?.[s.i];
        return hit && (hit.zh2 || hit.vocab?.length || hit.grammar);
      })
    : false;

  /* 全量命中：零成本直接回 */
  if (fullyDone) {
    const sentences = data.sentences.map(
      (s) => cached.sentences[s.i] || { i: s.i, zh2: "", vocab: [], grammar: "" }
    );
    return res.json({
      taskId: data.taskId,
      done: sentences.length,
      total: sentences.length,
      cached: true,
      sentences,
    });
  }

  if (!resolveChatProvider()) {
    return res.status(503).json({
      error: "AI 解析未配置：请设置 DEEPSEEK_API_KEY（或 AI_PROVIDER=agnes + AGNES_API_KEY）",
    });
  }

  try {
    const maxMs = Math.min(
      240_000,
      Math.max(10_000, Number(req.query.maxMs) || Number(process.env.AI_MAX_WORK_MS) || 90_000)
    );
    /* 已有同 taskId 的补齐在跑就搭车等它，不重复起一摊 */
    let run = inflight.get(req.params.taskId);
    if (!run) {
      run = ensureAnalysis(data, stamp, maxMs).finally(() =>
        inflight.delete(req.params.taskId)
      );
      inflight.set(req.params.taskId, run);
    }
    const result = await run;
    res.json({
      taskId: data.taskId,
      done: result.done,
      total: result.total,
      cached: false,
      failed: result.failed,
      sentences: result.sentences,
    });
  } catch (e) {
    res.status(502).json({
      error: "AI 解析失败",
      message: e?.message || String(e),
    });
  }
});

/** /videos/y2a/<taskId>.mp4 → <Y2A_DIR>/<taskId>/video.mp4（支持 Range） */
export function y2aVideoHandler(req, res) {
  const { taskId } = req.params;
  if (!TASK_ID_RE.test(taskId)) return res.status(400).end();
  const file = path.join(Y2A_DIR, taskId, "video.mp4");
  if (!file.startsWith(Y2A_DIR) || !fs.existsSync(file)) {
    return res.status(404).end();
  }
  res.sendFile(file);
}

/** 封面同理（yt-dlp 下的是 webp） */
export function y2aCoverHandler(req, res) {
  const { taskId } = req.params;
  if (!TASK_ID_RE.test(taskId)) return res.status(400).end();
  const file = path.join(Y2A_DIR, taskId, "video.webp");
  if (!file.startsWith(Y2A_DIR) || !fs.existsSync(file)) {
    return res.status(404).end();
  }
  res.sendFile(file);
}

export default router;
