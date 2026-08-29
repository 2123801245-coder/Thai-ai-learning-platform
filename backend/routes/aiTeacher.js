// backend/routes/aiTeacher.js
//
// AI 泰语老师（本地后端版）
//   POST /api/ai/teacher —— 聊天 / 发音 / 口语三种模式
//   使用 DeepSeek（OpenAI 兼容接口），复用与 translate.js 相同的环境变量：
//     DEEPSEEK_API_KEY   必填
//     DEEPSEEK_BASE_URL  可选，默认 https://api.deepseek.com
//     DEEPSEEK_MODEL     可选，默认 deepseek-chat
//
// 未配置 API Key 时返回 503 + 明确提示，前端展示引导信息。

import express from "express";
import dotenv from "dotenv";
import { authenticate } from "./auth.js";

dotenv.config();

const router = express.Router();

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const TIMEOUT_MS = 45000;

export function isAiTeacherEnabled() {
  return !!API_KEY;
}

/* ============================================================
   三模式系统提示词（中文解释为主，符合 AI 泰语老师人设）
============================================================ */

const SYSTEM_PROMPTS = {
  chat: `你叫「阿泰」，是 ThaiAI 学习平台的 AI 泰语老师，性格耐心、幽默、鼓励学生开口。
学生会用中文或泰语提问，或想和你聊泰语日常。

要求：
- 用中文回答为主，泰语表达自然地道。
- 回答尽量结构清晰：给出泰语表达 → 罗马音注音 → 中文意思 → 简短讲解（词汇/语法/用法）。
- 学生说泰语时，先温柔纠正错误（如果有），再给出更自然的说法，不要只打勾。
- 对话感要强：像真人老师一样追问、给场景、带学生练，不要一次倒完所有信息。
- 根据学生水平调整难度，学生水平低就多用简单句。
- 不要编造泰语词汇或语法。不确定时明确说明。
- 结尾可以问一个引导性的小问题，让学生继续练。`,

  pronunciation: `你是 ThaiAI 的 AI 泰语发音老师，专门帮中国学生纠正泰语发音。

学生输入一个泰语词或句子，请按以下结构分析：
1. 【音节划分】把泰文按音节用 "-" 隔开。
2. 【罗马音】给出带声调符号的罗马音（RTGS 风格，如 sà-wàt-dii）。
3. 【中文近似音】用中文谐音帮助学生理解，但注明只是近似。
4. 【声调】逐个音节标注声调（泰语五调：平声/低声/降声/高声/升声），并标出声调符号。
5. 【发音重点】指出长短元音、尾音、声调的关键点。
6. 【常见错误】中国学生容易读错的地方（如 r/l 混淆、尾音吞掉、声调不到位），逐条给纠正方法。

要求：全部用中文讲解，例子要具体，语气亲切专业。`,

  speaking: `你是 ThaiAI 的 AI 泰语口语陪练老师，性格亲切、像朋友一样。

学生想练口语表达（可能输入中文意思或想说的泰语）。请：
- 给出自然的泰语说法（1-2 种），附罗马音和中文意思。
- 说明这句话在什么场合用（正式/随意、对长辈/朋友），以及语气词（ครับ/ค่ะ/นะ/จ้า）的选择。
- 指出中国学生容易说成的中式泰语（如果有）。
- 给一个 2-3 句的迷你对话示例，让学生看到实际怎么用。
- 最后给学生一个跟读任务：让他把这句话说一遍，你负责听和纠正。

要求：实用、地道、鼓励为主，讲解简洁不啰嗦。`,
};

/* ============================================================
   DeepSeek 调用（OpenAI 兼容 chat completions）
============================================================ */

async function callDeepSeek(systemPrompt, userMessage) {
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
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1200,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek 返回内容为空");
    }

    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   POST /api/ai/teacher
   body: { message, action }   action: chat | pronunciation | speaking
============================================================ */

router.post("/teacher", authenticate, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const action = String(req.body?.action || "chat").trim();

    if (!message) {
      return res.status(400).json({
        error: "请输入要学习的内容",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        error: "输入内容不能超过 2000 个字符",
      });
    }

    if (!API_KEY) {
      return res.status(503).json({
        error: "AI 老师未配置",
        message:
          "管理员尚未配置 DEEPSEEK_API_KEY，AI 老师暂时不可用。",
      });
    }

    const systemPrompt =
      SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.chat;

    const response = await callDeepSeek(
      systemPrompt,
      message
    );

    return res.json({
      success: true,
      response,
    });
  } catch (err) {
    console.error("[aiTeacher] 调用失败:", err);

    const timeout =
      err?.name === "AbortError" ||
      /timeout|timed out|ETIMEDOUT/i.test(
        String(err?.message || "")
      );

    return res.status(502).json({
      error: timeout
        ? "AI 老师响应超时，请稍后再试"
        : "AI 老师暂时没有回应，请稍后再试",
    });
  }
});

export default router;
