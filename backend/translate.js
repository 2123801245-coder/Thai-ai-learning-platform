// backend/translate.js
//
// 泰语新闻翻译模块（DeepSeek API）
//
//   - 把 ThaiPBS 新闻的标题 + 导语翻译成简体中文，并生成罗马音注音
//     （RTGS 风格、带声调符号，与 src/data/thaiCorpus.js 的注音风格一致）。
//   - 使用 DeepSeek（国内可达、便宜）OpenAI 兼容接口，一次调用批量处理多条。
//   - 未配置 DEEPSEEK_API_KEY 或调用失败时优雅降级：原样返回 items，
//     不阻塞新闻展示。
//
// 环境变量：
//   DEEPSEEK_API_KEY   必填，DeepSeek API key（https://platform.deepseek.com）
//   DEEPSEEK_BASE_URL  可选，默认 https://api.deepseek.com
//   DEEPSEEK_MODEL     可选，默认 deepseek-chat

import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const BATCH_SIZE = 5; // 每批条数，控制单次响应长度
const TIMEOUT_MS = 60000;

export function isTranslateEnabled() {
  return !!API_KEY;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   单批翻译：把 chunk 里的 title/lede 翻成中文 + 罗马音
   成功返回 [ {zh_title, zh_lede, roman_title, roman_lede}, ... ]（与输入同序）
   失败返回 null（调用方按原样保留）
============================================================ */

async function translateChunk(chunk) {
  const payload = chunk.map((it) => ({
    id: it.id,
    title: it.title,
    lede: it.lede || "",
  }));

  const systemPrompt = `你是资深泰语教学专家，精通泰语→简体中文翻译与泰语罗马音注音。

任务：把给定的泰语新闻「标题 + 导语」翻译成简体中文，并生成罗马音注音。

罗马音注音要求：
- 使用 RTGS 风格的拉丁字母转写，标注声调符号（如 níi、mâak、khráp、săi），
  风格与常见泰语教材一致。
- 词与词之间用空格分隔。
- 泰语固有词按读音转写，外来语保留其罗马拼写风格（如 อินโดนีเซีย → indoonii-sia 或印度尼西亚的泰语读音转写均可，取最接近实际读音的写法）。

输出要求：
- 只输出一个 JSON 对象，不要任何额外文字或 Markdown 代码块标记。
- JSON 结构必须是：{"items":[{"id":"...","zh_title":"...","zh_lede":"...","roman_title":"...","roman_lede":"..."}]}
- 数组顺序与输入完全一致。
- 输入中 lede 为空字符串时，对应输出 zh_lede、roman_lede 也必须是空字符串。
- zh_title / zh_lede 使用简体中文，自然、通顺、符合新闻语体。`;

  const userPrompt = `请翻译以下泰语新闻：\n${JSON.stringify(payload, null, 2)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 返回为空");
    const parsed = JSON.parse(content);
    const list = parsed?.items || [];
    if (!Array.isArray(list) || list.length !== chunk.length) {
      throw new Error(`DeepSeek 返回条数不符: ${list.length} != ${chunk.length}`);
    }
    return chunk.map((it, i) => {
      const row = list.find((r) => r && (r.id === it.id || i === list.indexOf(r))) || {};
      return {
        zh_title: (row.zh_title || "").trim(),
        zh_lede: (row.zh_lede || "").trim(),
        roman_title: (row.roman_title || "").trim(),
        roman_lede: (row.roman_lede || "").trim(),
      };
    });
  } catch (err) {
    console.error(`[translate] 批量翻译失败: ${err.name === "AbortError" ? "超时" : err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   批量翻译整组新闻（分批 + 失败重试一次 + 逐批合并）
   返回新的 items 数组（带 zh / roman 字段）；无法翻译的条目保持原样。
============================================================ */

export async function translateNewsBatch(items) {
  if (!isTranslateEnabled() || !Array.isArray(items) || !items.length) {
    return items;
  }

  const out = [...items];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    let result = await translateChunk(chunk);
    if (!result) {
      await sleep(1200); // 短暂等待后重试一次
      result = await translateChunk(chunk);
    }
    if (result) {
      for (let j = 0; j < chunk.length; j++) {
        const r = result[j];
        if (r) {
          out[i + j] = {
            ...out[i + j],
            zh_title: r.zh_title,
            zh_lede: r.zh_lede,
            roman_title: r.roman_title,
            roman_lede: r.roman_lede,
          };
        }
      }
      console.log(`[translate] 第 ${i / BATCH_SIZE + 1} 批翻译完成`);
    }
  }
  return out;
}
