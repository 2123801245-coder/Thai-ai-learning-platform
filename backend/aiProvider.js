// backend/aiProvider.js
//
// ============================================================
// 所有「大模型」AI 调用的唯一出口
// ============================================================
//
// 改动前：每个文件各自读 DEEPSEEK_API_KEY / BASE_URL / MODEL，
// 于是出现三种「断了但没人知道」的状态：
//
//   1. .env 没加载 → key 为空 → 接口 503（或静默不翻译）
//   2. 换了网关（.env 里配了 AI_API_KEY / AI_BASE_URL / AI_MODEL）
//      但没有任何代码读这三个变量 → 配置形同虚设
//   3. 占位符 key（如「你的xxxKEY」）被当成真 key → 请求发出去才 401
//
// 现在统一走这里：
//   - resolveChatProvider()   选一个可用提供方（DeepSeek / Agnes 网关 / 自定义）
//   - chatCompletion()        OpenAI 兼容 chat completions，错误信息能直接定位
//   - aiServicesStatus()      所有 AI 服务的配置自检（不打印任何密钥）
//
// 提供方优先级：
//   1. 环境变量 AI_PROVIDER 显式指定（"deepseek" | "agnes" | "auto"）
//   2. 否则按注册顺序自动挑选「有可用 key」的提供方
//
// 认不认一个 key 由 isUsableKey() 判断：空、太短、含中文（占位符）
// 一律视为「未配置」，而不是发出去等 401。

import { describeEnvSources } from "./env.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60000;

/* ============================================================
   提供方注册表（全部是 OpenAI 兼容接口）
============================================================ */

const PROVIDERS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    keyVars: ["DEEPSEEK_API_KEY"],
    baseUrlVars: ["DEEPSEEK_BASE_URL"],
    defaultBaseUrl: "https://api.deepseek.com",
    modelVars: ["DEEPSEEK_MODEL"],
    defaultModel: "deepseek-chat",
    docs: "https://platform.deepseek.com",
  },
  {
    id: "agnes",
    label: "Agnes 网关",
    // AGNES_API_KEY 是规范名；AI_API_KEY 是历史别名（早期 .env 里用的就是它）
    keyVars: ["AGNES_API_KEY", "AI_API_KEY"],
    baseUrlVars: ["AGNES_BASE_URL", "AI_BASE_URL"],
    defaultBaseUrl: "https://apihub.agnes-ai.com/v1",
    modelVars: ["AGNES_MODEL", "AI_MODEL"],
    defaultModel: "agnes-2.0-flash",
    docs: "https://apihub.agnes-ai.com",
  },
];

/* ============================================================
   key 可用性判断
============================================================ */

const PLACEHOLDER_WORDS =
  /(你的|请填|填入|替换|placeholder|your[_-]?key|xxx|todo|changeme)/i;

/**
 * 这个 key 看起来是真的吗？
 * - 空 / 少于 20 字符 → 否（真 key 都远长于此）
 * - 含中文 → 否（.env 里的「你的xxxKEY」这类占位符）
 * - 含 placeholder 类词 → 否
 */
export function isUsableKey(key) {
  const value = String(key || "").trim();
  if (value.length < 20) return false;
  if (/[\u4e00-\u9fff]/.test(value)) return false;
  if (PLACEHOLDER_WORDS.test(value)) return false;
  return true;
}

function firstNonEmpty(value, vars, fallback) {
  if (value) return value;
  for (const name of vars) {
    const v = process.env[name];
    if (v && String(v).trim()) return String(v).trim();
  }
  return fallback;
}

function providerKeyFromEnv(provider) {
  for (const name of provider.keyVars) {
    const raw = process.env[name];
    if (raw && String(raw).trim()) {
      return { key: String(raw).trim(), varName: name };
    }
  }
  return { key: "", varName: provider.keyVars[0] };
}

/* ============================================================
   解析：当前用哪个提供方
============================================================ */

/** 所有提供方的配置状态（含不可用的原因，不含密钥） */
export function listChatProviders() {
  const forced = String(process.env.AI_PROVIDER || "auto").trim().toLowerCase();

  return PROVIDERS.map((provider) => {
    const { key, varName } = providerKeyFromEnv(provider);
    const usable = isUsableKey(key);
    const baseUrl = firstNonEmpty("", provider.baseUrlVars, provider.defaultBaseUrl).replace(/\/+$/, "");
    const model = firstNonEmpty("", provider.modelVars, provider.defaultModel);

    let reason = "";
    if (!key) reason = `未配置 ${provider.keyVars.join(" / ")}`;
    else if (!usable) reason = `${varName} 仍是占位符或长度异常`;

    return {
      id: provider.id,
      label: provider.label,
      configured: usable,
      keyVar: varName,
      baseUrl,
      model,
      reason,
      selected: false,
    };
  }).map((entry) => ({
    ...entry,
    selected: forced !== "auto" ? entry.id === forced && entry.configured : false,
  }));
}

/** 选中的提供方；没有可用提供方时返回 null */
export function resolveChatProvider(preferredId) {
  const forced = String(preferredId || process.env.AI_PROVIDER || "auto").trim().toLowerCase();

  if (forced && forced !== "auto") {
    const provider = PROVIDERS.find((p) => p.id === forced);
    if (!provider) return null;
    const { key, varName } = providerKeyFromEnv(provider);
    if (!isUsableKey(key)) return null;
    return {
      id: provider.id,
      label: provider.label,
      apiKey: key,
      keyVar: varName,
      baseUrl: firstNonEmpty("", provider.baseUrlVars, provider.defaultBaseUrl).replace(/\/+$/, ""),
      model: firstNonEmpty("", provider.modelVars, provider.defaultModel),
    };
  }

  // auto：按注册顺序取第一个可用者
  for (const provider of PROVIDERS) {
    const { key, varName } = providerKeyFromEnv(provider);
    if (!isUsableKey(key)) continue;
    return {
      id: provider.id,
      label: provider.label,
      apiKey: key,
      keyVar: varName,
      baseUrl: firstNonEmpty("", provider.baseUrlVars, provider.defaultBaseUrl).replace(/\/+$/, ""),
      model: firstNonEmpty("", provider.modelVars, provider.defaultModel),
    };
  }

  return null;
}

/* ============================================================
   错误类型：把「为什么断了」说清楚
============================================================ */

export class AiServiceError extends Error {
  constructor(message, { provider, status, body, kind } = {}) {
    super(message);
    this.name = "AiServiceError";
    this.provider = provider || null;
    this.status = status || null;
    this.body = body || "";
    this.kind = kind || "upstream"; // config | timeout | upstream
  }

  toJSON() {
    return {
      error: this.message,
      provider: this.provider,
      status: this.status,
      kind: this.kind,
      detail: this.body ? String(this.body).slice(0, 200) : undefined,
    };
  }
}

/* ============================================================
   chat completions（唯一出口）
============================================================ */

/**
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} options temperature / maxTokens / jsonMode / timeoutMs / provider
 * @returns {Promise<string>} 模型回复正文
 */
export async function chatCompletion(messages, options = {}) {
  const {
    temperature = 0.8,
    maxTokens = 1200,
    jsonMode = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    provider: preferredId,
  } = options;

  const provider = resolveChatProvider(preferredId);
  if (!provider) {
    throw new AiServiceError(
      "AI 服务未配置：请设置 DEEPSEEK_API_KEY（或 AI_PROVIDER=agnes + AGNES_API_KEY）",
      { kind: "config" }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiServiceError(
        `${provider.label} HTTP ${res.status}：${body.slice(0, 200) || "无响应正文"}`,
        { provider: provider.id, status: res.status, body }
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiServiceError(`${provider.label} 返回内容为空`, {
        provider: provider.id,
      });
    }
    return String(content).trim();
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    if (err?.name === "AbortError") {
      throw new AiServiceError(`${provider.label} 请求超时（${timeoutMs}ms）`, {
        provider: provider.id,
        kind: "timeout",
      });
    }
    throw new AiServiceError(`${provider.label} 调用失败：${err?.message || err}`, {
      provider: provider.id,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   所有 AI 服务的配置自检（不含密钥；probe=true 时做真实连通性探测）
============================================================ */

function speechStatus() {
  const key = process.env.SPEECH_KEY || "";
  const region = process.env.SPEECH_REGION || "";
  const endpoint = process.env.SPEECH_ENDPOINT || "";
  const configured = isUsableKey(key) && Boolean(region || endpoint);
  return {
    id: "speech",
    label: "Azure 发音评估 / 语音识别",
    provider: "azure",
    configured,
    // region 不是秘密；key 只报长度
    endpoint: endpoint || (region ? `https://${region}.api.cognitive.microsoft.com` : ""),
    keyVar: "SPEECH_KEY",
    reason: configured
      ? ""
      : !key
        ? "未配置 SPEECH_KEY"
        : !isUsableKey(key)
          ? "SPEECH_KEY 仍是占位符或长度异常"
          : "未配置 SPEECH_REGION（或 SPEECH_ENDPOINT）",
  };
}

function ttsStatus() {
  return {
    id: "tts",
    label: "泰语语音合成（Edge TTS 协议）",
    provider: "edge-tts",
    configured: true, // 无需密钥
    endpoint: "wss://speech.platform.bing.com",
    reason: "",
  };
}

function transcribeStatus() {
  const url = process.env.TRANSCRIBE_API_URL || "";
  return {
    id: "transcribe",
    label: "外部转写兜底（可选）",
    provider: url ? "custom" : null,
    configured: Boolean(url),
    endpoint: url,
    keyVar: "TRANSCRIBE_API_URL",
    reason: url ? "" : "未配置 TRANSCRIBE_API_URL（口语评测走 Azure，此为可选兜底）",
  };
}

export function aiServicesStatus() {
  const provider = resolveChatProvider();
  const providers = listChatProviders();
  const forced = String(process.env.AI_PROVIDER || "auto").trim().toLowerCase();

  return {
    ok: Boolean(provider),
    env: describeEnvSources(),
    aiProvider: forced,
    chat: {
      id: "chat",
      label: "AI 对话 / 出题 / 讲解",
      configured: Boolean(provider),
      provider: provider?.id || null,
      providerLabel: provider?.label || null,
      keyVar: provider?.keyVar || null,
      baseUrl: provider?.baseUrl || null,
      model: provider?.model || null,
      reason: provider
        ? ""
        : "没有可用的模型提供方：请配置 DEEPSEEK_API_KEY，或 AI_PROVIDER=agnes + AGNES_API_KEY",
    },
    translate: {
      id: "translate",
      label: "新闻 AI 翻译",
      configured: Boolean(provider),
      provider: provider?.id || null,
      model: provider?.model || null,
      reason: provider ? "" : "同 AI 对话（共用同一个模型出口）",
    },
    providers,
    speech: speechStatus(),
    tts: ttsStatus(),
    transcribe: transcribeStatus(),
  };
}

/** 真实连通性探测：会发一个极小的请求，用于「一键自检」 */
export async function probeAiServices() {
  const status = aiServicesStatus();
  const results = {};

  // 1) 大模型
  if (status.chat.configured) {
    const t0 = Date.now();
    try {
      const reply = await chatCompletion(
        [{ role: "user", content: "回复两个字：正常" }],
        { maxTokens: 8, temperature: 0, timeoutMs: 20000 }
      );
      results.chat = { ok: true, ms: Date.now() - t0, sample: reply.slice(0, 40) };
    } catch (err) {
      results.chat = { ok: false, ms: Date.now() - t0, error: err.message };
    }
  } else {
    results.chat = { ok: false, error: status.chat.reason };
  }

  // 2) Azure Speech（换 token 是最轻的验证）
  if (status.speech.configured) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${status.speech.endpoint}/sts/v1.0/issueToken`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": process.env.SPEECH_KEY },
        signal: AbortSignal.timeout(15000),
      });
      const token = res.ok ? await res.text() : "";
      results.speech = {
        ok: res.ok && token.length > 0,
        ms: Date.now() - t0,
        status: res.status,
        error: res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 160),
      };
    } catch (err) {
      results.speech = { ok: false, ms: Date.now() - t0, error: err.message };
    }
  } else {
    results.speech = { ok: false, error: status.speech.reason };
  }

  return { ...status, probe: results };
}
