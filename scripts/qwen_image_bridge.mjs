#!/usr/bin/env node
/**
 * Qwen-Image → 本机 ComfyUI 桥接（零依赖，Node 18+）
 *
 * 分工：qwen-image-gen skill 负责改写提示词并产出 {rewritten_prompt, wh_ratio}；
 * 本脚本只做落地——
 *   wh_ratio + 像素预算 → 实际 width/height（按 --size-step 取整，默认 16，范围 256–2048）
 *   → 打补丁到 API 格式工作流 → 提交 /prompt → 轮询 /history
 *   → 下载原图 + 落盘参数记录（原提示词、实际提交文本、尺寸、种子、模板摘要）
 *
 * 用法：
 *   node scripts/qwen_image_bridge.mjs --rewrite rewrite.json
 *   node scripts/qwen_image_bridge.mjs --prompt "A serene golden Thai temple…" --ratio 9:16
 *   node scripts/qwen_image_bridge.mjs --rewrite rewrite.json --dry-run
 *   node scripts/qwen_image_bridge.mjs --self-test
 *
 * 参数：
 *   --rewrite FILE      skill 产出的改写 JSON（含 rewritten_prompt / wh_ratio）
 *   --prompt TEXT       直接给最终提示词（与 --rewrite 二选一）
 *   --ratio A:B         覆盖 JSON 里的 wh_ratio，如 9:16、2:3
 *   --megapixels N      像素预算，默认 1（16GB 机型建议 ≤1.5）
 *   --width/--height    显式画布，覆盖比例换算（A/B 对照用）
 *   --exact-ratio       要求画幅比例完全等于 wh_ratio（会偏离像素预算；默认允许 0.5% 偏差换更准的像素预算）
 *   --size-step N       画幅取整步长，默认 16（Qwen VAE 下采样 8，留一档余量）；8/16/32/64 可选
 *   --seed N            默认随机；记录在文件名与参数里
 *   --steps N --cfg N --sampler NAME --scheduler NAME   覆盖模板采样参数
 *   --negative TEXT     覆盖负向提示词
 *   --preset NAME       工作流预设：turbo（默认，6 步 viggle LoRA）/ edit（参考图编辑）/ official（12 步 KSampler）
 *   --reference FILE    编辑用的参考图（PNG/JPEG）；给了它且没指定预设时自动走 edit
 *   --resolution N      参考图重采样边长（32 的倍数），默认按 --megapixels 换算；0 = 保持参考图原尺寸
 *   --template FILE     指定工作流（API 格式，或前端图——会自动转 API 格式）
 *   --save-api PATH     把转好的 API 格式图写出到该路径，方便复核/复用
 *   --unet FILE         换底模，如 qwen-image-2.1-official-Q4_K_M.gguf
 *   --clip FILE         换文本编码器，如 qwen3vl_8b_w4a8.safetensors（5.9G，省内存）
 *   --vae FILE --lora FILE
 *   --out DIR           落盘目录，默认 scripts/output/qwen-image
 *   --name SLUG         文件名前缀，默认取 --rewrite 的文件名
 *   --host URL          ComfyUI 地址，默认 http://127.0.0.1:8188
 *   --timeout-ms N      等待出图上限，默认 1800000（30 分钟）
 *   --no-preflight      跳过模型文件预检
 *   --dry-run           只打印尺寸与补丁，不提交
 *   --json              以 JSON 输出结果（机器可读）
 *   --self-test         离线自测（尺寸换算 + 打补丁），不连服务
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();

const DEFAULT_HOST = process.env.COMFYUI_HOST || 'http://127.0.0.1:8188';
const DEFAULT_OUT = process.env.QWEN_IMAGE_OUT || path.join(SCRIPT_DIR, 'output', 'qwen-image');

const SIZE_STEP_DEFAULT = 16;
const SIZE_STEPS = [8, 16, 32, 64];
const SIZE_MIN = 256;
const SIZE_MAX = 2048;
const RATIO_TOLERANCE = 0.03; // 换算后的比例偏差容忍度（自测用）
const RATIO_DEADBAND = 0.005; // 比例误差 ≤0.5% 视为达标，额度内优先贴住像素预算

// class_type → 模型文件字段名（预检用）
const MODEL_FIELDS = {
  UnetLoaderGGUF: 'unet_name',
  CLIPLoader: 'clip_name',
  VAELoader: 'vae_name',
  LoraLoader: 'lora_name',
  ViggleTurboLora: 'lora_name',
  CheckpointLoaderSimple: 'ckpt_name',
};

// 工作流预设：默认走 viggle turbo（6 步），--preset official 回到 12 步 KSampler
const PRESETS = {
  turbo: { template: 'qwen-2.1-viggle-6step.json', label: 'viggle turbo LoRA，默认 6 步（SamplerCustomAdvanced）' },
  official: { template: 'qwen-image-2.1-official.api.json', label: '官方量化底模，12 步 KSampler' },
  edit: { template: 'qwen-2.1-viggle-6step-edit.json', label: '参考图编辑（同一条 turbo 链路 + 参考图进文本编码器）' },
};
const DEFAULT_PRESET = 'turbo';
const WORKFLOWS_DIR = process.env.COMFY_WORKFLOWS || path.join(HOME, 'ComfyUI', 'user', 'default', 'workflows');

const USAGE = fs
  .readFileSync(fileURLToPath(import.meta.url), 'utf8')
  .split('*/')[0]
  .replace(/^#![^\n]*\n/, '')
  .replace(/^\/\*\*?/, '')
  .split('\n')
  .map((l) => l.replace(/^\s?\*?\s?/, ''))
  .join('\n')
  .trim();

// ---------------------------------------------------------------- 基础工具

function die(msg, code = 2) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function warn(msg) {
  console.error(`· ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const num = (v, name, { min = -Infinity, max = Infinity, int = true } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n)) die(`参数 ${name} 不是数字：${v}`);
  if (n < min || n > max) die(`参数 ${name} 超出范围 [${min}, ${max}]：${n}`);
  if (int && !Number.isInteger(n)) die(`参数 ${name} 必须是整数：${n}`);
  return n;
};

const ARG_KEYS = {
  rewrite: 'rewrite',
  prompt: 'prompt',
  ratio: 'ratio',
  megapixels: 'megapixels',
  width: 'width',
  height: 'height',
  seed: 'seed',
  steps: 'steps',
  cfg: 'cfg',
  sampler: 'sampler',
  scheduler: 'scheduler',
  preset: 'preset',
  reference: 'reference',
  resolution: 'resolution',
  clip: 'clip',
  vae: 'vae',
  lora: 'lora',
  'save-api': 'saveApi',
  'size-step': 'sizeStep',
  negative: 'negative',
  template: 'template',
  unet: 'unet',
  out: 'out',
  name: 'name',
  host: 'host',
  'timeout-ms': 'timeoutMs',
  'skill-dir': 'skillDir',
};
const FLAG_KEYS = {
  'dry-run': 'dryRun',
  json: 'json',
  'self-test': 'selfTest',
  'no-preflight': 'noPreflight',
  'exact-ratio': 'exactRatio',
  help: 'help',
  h: 'help',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) die(`无法识别的参数：${a}`);
    const eq = a.indexOf('=');
    if (eq !== -1) {
      assign(args, a.slice(2, eq), a.slice(eq + 1));
      continue;
    }
    const key = a.slice(2);
    if (FLAG_KEYS[key]) {
      args[FLAG_KEYS[key]] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) die(`参数 --${key} 缺值`);
    assign(args, key, next);
    i++;
  }
  return args;
}

function assign(args, key, value) {
  if (FLAG_KEYS[key]) return void (args[FLAG_KEYS[key]] = value !== 'false');
  const dest = ARG_KEYS[key];
  if (!dest) die(`未知参数 --${key}（--help 查看用法）`);
  args[dest] = value;
}

// ------------------------------------------------------- 比例 → 实际宽高

function parseRatio(str, name = '比例') {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) die(`${name} 格式应为 A:B，收到「${str}」`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!(a > 0 && b > 0)) die(`${name} 必须是正数：${str}`);
  return a / b;
}

const snapStep = (n, step) => Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n / step) * step));

/**
 * 在 32 倍数、256–2048 的网格上挑画幅。
 * 默认：比例误差 ≤0.5% 就算达标，额度内优先贴住像素预算（16GB 机型像素越省越稳）；
 * exactRatio：比例优先，允许明显超出像素预算，供下游硬要精确画幅的场合。
 */
function mapSize(ratioStr, megapixels, { exactRatio = false, step = SIZE_STEP_DEFAULT } = {}) {
  const ratio = parseRatio(ratioStr, 'wh_ratio');
  const target = megapixels * 1e6;
  let best = null;
  for (let w = SIZE_MIN; w <= SIZE_MAX; w += step) {
    const hRaw = w / ratio;
    if (hRaw < SIZE_MIN) continue;
    if (hRaw > SIZE_MAX) break;
    const h = snapStep(hRaw, step);
    const ratioErr = Math.abs(Math.log(w / h / ratio));
    const mpErr = Math.abs(Math.log((w * h) / target));
    const ratioTerm = exactRatio
      ? ratioErr * 1e6
      : ratioErr <= RATIO_DEADBAND
        ? 0
        : 1000 * (ratioErr - RATIO_DEADBAND);
    const score = ratioTerm + mpErr;
    if (!best || score < best.score) best = { width: w, height: h, score, ratioErr };
  }
  if (!best) die(`无法为比例 ${ratioStr} 找到合法画幅`);
  return {
    requestedRatio: ratioStr,
    width: best.width,
    height: best.height,
    megapixels: +((best.width * best.height) / 1e6).toFixed(3),
    actualRatio: +(best.width / best.height).toFixed(4),
    ratioDeviation: +(Math.abs(best.width / best.height - ratio) / ratio).toFixed(4),
    exact: best.ratioErr <= 1e-6,
    step,
    snapped: true,
  };
}

// ----------------------------------------------------------- 工作流打补丁

function assertApiGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new Error('模板结构不对：既不是 API 格式对象，也没有 .prompt');
  }
  if (graph.nodes && Array.isArray(graph.nodes)) {
    throw new Error('这是前端图（nodes/links）格式，提交 /prompt 需要 API 格式；请在 ComfyUI 里「导出 (API)」');
  }
  return graph;
}

const TEXT_NODE_RE = /TextEncode|CLIPTextEncode/;

/** ComfyUI 前端图（nodes/links）→ /prompt 认的 API 格式 */
function frontendToApi(frontend) {
  const nodes = frontend.nodes || [];
  const links = new Map((frontend.links || []).map((l) => [l[0], l]));
  const api = {};
  const notes = [];
  for (const node of nodes) {
    if (node.mode === 2 || node.mode === 4) {
      notes.push(`节点 #${node.id} ${node.type} 是静音/旁路（mode=${node.mode}），已跳过`);
      continue;
    }
    const inputs = {};
    const widgets = (Array.isArray(node.widgets_values) ? node.widgets_values : []).filter(
      (v) => v === null || typeof v !== 'object'
    );
    let wi = 0;
    for (const inp of node.inputs || []) {
      if (inp.link != null) {
        const l = links.get(inp.link);
        if (!l) throw new Error(`节点 #${node.id} 的输入 ${inp.name} 指向不存在的链接 ${inp.link}`);
        inputs[inp.name] = [String(l[1]), l[2]];
      } else if (wi < widgets.length) {
        inputs[inp.name] = widgets[wi++];
      }
    }
    if (wi < widgets.length) {
      notes.push(`节点 #${node.id} ${node.type} 多出 ${widgets.length - wi} 个控件值（${JSON.stringify(widgets.slice(wi))}），未写入`);
    }
    api[String(node.id)] = { class_type: node.type, inputs };
  }
  if (!Object.keys(api).length) throw new Error('前端图里没有可用节点');
  return { graph: api, notes };
}

/** 读工作流：.api.json（裸图或 {prompt:…}）直接返回，前端图先转换 */
function loadGraph(templatePath) {
  if (!fs.existsSync(templatePath)) die(`找不到工作流模板：${templatePath}`);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  } catch (e) {
    die(`模板不是合法 JSON：${e.message}`);
  }
  const inner = parsed && parsed.prompt && typeof parsed.prompt === 'object' ? parsed.prompt : parsed;
  if (inner && Array.isArray(inner.nodes) && Array.isArray(inner.links)) {
    try {
      const { graph, notes } = frontendToApi(inner);
      return { graph, converted: true, notes };
    } catch (e) {
      die(`前端图转 API 格式失败：${e.message}`);
    }
  }
  try {
    return { graph: assertApiGraph(inner), converted: false, notes: [] };
  } catch (e) {
    die(e.message);
  }
}

/** 按职责认节点，不写死 ID：KSampler 链与 SamplerCustomAdvanced 链都能走 */
function rolesOf(graph) {
  const ids = Object.keys(graph);
  const clsOf = (id) => graph[id].class_type || '';
  const find = (re) => ids.find((id) => re.test(clsOf(id)));
  return {
    ids,
    clsOf,
    latentId: find(/^Empty/),
    classicSamplerId: find(/^KSampler(Advanced)?$/),
    customSamplerId: find(/^SamplerCustom(Advanced)?$/),
    guiderId: find(/Guider$/),
    noiseId: find(/^RandomNoise$/),
    selectId: find(/^KSamplerSelect$/),
    sigmaId: find(/Sigmas$|^BasicScheduler$/),
    saveId: find(/^SaveImage$|^PreviewImage$/),
  };
}

// TextEncodeQwenImage21 用 prompt/negative_prompt，CLIPTextEncode 用 text
function pickTextField(node, prefer, exclude = []) {
  const names = Object.keys(node.inputs || {});
  for (const p of prefer) {
    if (!exclude.includes(p) && names.includes(p) && typeof node.inputs[p] === 'string') return p;
  }
  return (
    names.find(
      (n) => typeof node.inputs[n] === 'string' && !exclude.includes(n) && !['clip', 'device', 'type', 'latent', 'vae'].includes(n)
    ) || null
  );
}

/** turbo sigma 表：尾部固定 0.875/0.75/0.5/0.25，头部均分到 1.0（与 viggle_turbo.py 的注释一致） */
function turboSchedule(steps) {
  const tail = [0.875, 0.75, 0.5, 0.25];
  const headCount = steps - tail.length;
  if (headCount < 1) return null;
  const head = Array.from({ length: headCount }, (_, i) => +(1 - (i * 0.125) / headCount).toFixed(4));
  return [...head, ...tail].join(', ');
}

const sigmaCount = (str) => String(str).split(',').filter((s) => s.trim() !== '').length;

function patchGraph(graph, opts) {
  const r = rolesOf(graph);
  if (!r.latentId) die('模板里找不到 Empty*Latent 节点，无法设置画幅');
  const samplerId = r.classicSamplerId || r.customSamplerId;
  if (!samplerId) die('模板里既没有 KSampler 也没有 SamplerCustomAdvanced，不知道该把画幅交给谁');
  const sampler = graph[samplerId];
  const isClassic = !!r.classicSamplerId;
  const linkId = (node, input) => (node?.inputs?.[input]?.[0] ?? null);

  // 正向文本：KSampler.positive 或 BasicGuider.conditioning
  const condId = isClassic ? linkId(sampler, 'positive') : linkId(graph[r.guiderId], 'conditioning');
  const condNode = condId ? graph[condId] : null;
  if (!condNode || !TEXT_NODE_RE.test(condNode.class_type || '')) {
    die(isClassic ? '无法从 KSampler.positive 找到文本编码节点' : '无法从 BasicGuider.conditioning 找到文本编码节点');
  }
  const positiveField = pickTextField(condNode, ['text', 'prompt']);
  if (!positiveField) die(`文本节点 ${condNode.class_type} 里没有可写的字符串字段`);

  let negative = null;
  const negLink = isClassic ? linkId(sampler, 'negative') : null;
  if (negLink && graph[negLink] && TEXT_NODE_RE.test(graph[negLink].class_type || '')) {
    negative = { id: negLink, field: pickTextField(graph[negLink], ['text', 'negative']) };
  } else {
    // 同一个节点同时带 negative_prompt（TextEncodeQwenImage21）
    const f = pickTextField(condNode, ['negative_prompt'], [positiveField]);
    if (f && /negative/i.test(f)) negative = { id: condId, field: f };
  }

  const seedNodeId = r.noiseId || (isClassic ? samplerId : null);
  const seedField = r.noiseId ? 'noise_seed' : 'seed';
  const sigmaNode = r.sigmaId ? graph[r.sigmaId] : null;
  const hasSchedule = !!(sigmaNode && 'nodes' in (sigmaNode.inputs || {}));
  const stepsNode = isClassic && 'steps' in sampler.inputs ? samplerId : sigmaNode && 'steps' in (sigmaNode.inputs || {}) ? r.sigmaId : null;
  const stepsField = isClassic ? 'steps' : 'steps';

  const before = {
    width: graph[r.latentId].inputs.width,
    height: graph[r.latentId].inputs.height,
    seed: seedNodeId ? graph[seedNodeId].inputs[seedField] : null,
    steps: stepsNode ? graph[stepsNode].inputs[stepsField] : null,
    schedule: hasSchedule ? sigmaNode.inputs.nodes : null,
    cfg: isClassic ? sampler.inputs.cfg : null,
    sampler: isClassic ? sampler.inputs.sampler_name : r.selectId ? graph[r.selectId].inputs.sampler_name : null,
  };

  graph[r.latentId].inputs.width = opts.width;
  graph[r.latentId].inputs.height = opts.height;
  if ('batch_size' in graph[r.latentId].inputs) graph[r.latentId].inputs.batch_size = 1;
  graph[condId].inputs[positiveField] = opts.prompt;
  if (negative && opts.negative != null) graph[negative.id].inputs[negative.field] = opts.negative;
  if (seedNodeId) graph[seedNodeId].inputs[seedField] = opts.seed;

  if (opts.steps != null) {
    if (hasSchedule) {
      const schedule = turboSchedule(opts.steps);
      if (schedule) sigmaNode.inputs.nodes = schedule;
      else warn(`turbo 的 sigma 表只支持 5–8 步（收到 ${opts.steps}），保留模板里的 schedule`);
    } else if (stepsNode) {
      graph[stepsNode].inputs[stepsField] = opts.steps;
    } else {
      warn('这条链路没有可写步数的节点，--steps 被忽略');
    }
  }
  if (opts.sampler != null) {
    if (isClassic) sampler.inputs.sampler_name = opts.sampler;
    else if (r.selectId) graph[r.selectId].inputs.sampler_name = opts.sampler;
  }
  if (opts.cfg != null) {
    if (isClassic && 'cfg' in sampler.inputs) sampler.inputs.cfg = opts.cfg;
    else warn('这条链路用 BasicGuider，没有 cfg 可调；--cfg 被忽略');
  }
  if (opts.scheduler != null) {
    if (isClassic && 'scheduler' in sampler.inputs) sampler.inputs.scheduler = opts.scheduler;
    else warn('schedule 由 sigma 节点决定，--scheduler 被忽略');
  }
  if (r.saveId && opts.prefix) graph[r.saveId].inputs.filename_prefix = opts.prefix;

  const models = {};
  for (const node of Object.values(graph)) {
    const field = MODEL_FIELDS[node.class_type];
    if (field && node.inputs && typeof node.inputs[field] === 'string') models[node.class_type] = node.inputs[field];
  }

  const schedule = hasSchedule ? sigmaNode.inputs.nodes : null;
  const sampling = {
    seed: seedNodeId ? graph[seedNodeId].inputs[seedField] : null,
    steps: schedule ? sigmaCount(schedule) : stepsNode ? graph[stepsNode].inputs[stepsField] : null,
    cfg: isClassic ? sampler.inputs.cfg : null,
    sampler: isClassic ? sampler.inputs.sampler_name : r.selectId ? graph[r.selectId].inputs.sampler_name : null,
    scheduler: isClassic ? sampler.inputs.scheduler : schedule ? 'ViggleTurboSigmas(dynamic shift)' : null,
    denoise: isClassic ? sampler.inputs.denoise : null,
    schedule,
  };

  return {
    ids: {
      latentId: r.latentId,
      samplerId,
      guiderId: r.guiderId || null,
      noiseId: r.noiseId || null,
      sigmaId: r.sigmaId || null,
      selectId: r.selectId || null,
      saveId: r.saveId || null,
      positiveId: condId,
      positiveField,
      negativeId: negative?.id || null,
      negativeField: negative?.field || null,
    },
    mode: isClassic ? 'KSampler' : 'SamplerCustomAdvanced',
    before,
    models,
    sampling,
  };
}

// --------------------------------------------------------------- HTTP 层

async function httpJson(url, { timeoutMs = 20000, ...init } = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function preflight(host, graph) {
  const checks = [];
  for (const node of Object.values(graph)) {
    const field = MODEL_FIELDS[node.class_type];
    if (field && node.inputs && typeof node.inputs[field] === 'string') {
      checks.push({ cls: node.class_type, field, value: node.inputs[field] });
    }
  }
  for (const c of checks) {
    const { ok, status, data } = await httpJson(`${host}/object_info/${encodeURIComponent(c.cls)}`, { timeoutMs: 10000 });
    if (!ok) die(`预检失败：GET /object_info/${c.cls} → HTTP ${status}`);
    const options = data?.[c.cls]?.input?.required?.[c.field]?.[0];
    if (Array.isArray(options) && !options.includes(c.value)) {
      die(`ComfyUI 里没有这个模型文件：${c.cls}.${c.field} = ${c.value}\n可用：\n  - ${options.join('\n  - ')}`);
    }
  }
  return checks;
}

function describeError(data) {
  const lines = [];
  if (data?.error) {
    if (typeof data.error === 'string') lines.push(data.error);
    else lines.push(`${data.error.type || 'error'}: ${data.error.message || ''}`.trim());
    const details = data.error.details || data.error.extra_info;
    if (details) lines.push(`  ${details}`);
  }
  for (const [nodeId, info] of Object.entries(data?.node_errors || {})) {
    lines.push(`  节点 ${nodeId}（${info.class_type || '?'}）：${(info.errors || []).map((e) => e.message || e.extra_info).join('；')}`);
  }
  return lines.join('\n') || JSON.stringify(data).slice(0, 500);
}

async function submit(host, graph, clientId) {
  const { ok, status, data } = await httpJson(`${host}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: clientId }),
    timeoutMs: 60000,
  });
  if (!ok || !data?.prompt_id) die(`提交失败（HTTP ${status}）：\n${describeError(data)}`, 3);
  return data.prompt_id;
}

async function waitForImage(host, promptId, timeoutMs, onTick) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { ok, data } = await httpJson(`${host}/history/${promptId}`, { timeoutMs: 15000 });
    if (ok && data && data[promptId]) {
      const entry = data[promptId];
      const images = Object.values(entry.outputs || {})
        .flatMap((o) => o.images || [])
        .filter((i) => i.type !== 'temp');
      const messages = entry.status?.messages || [];
      const errorMsg = messages.find(([type]) => type === 'execution_error')?.[1];
      if (errorMsg) {
        die(`ComfyUI 执行出错：${errorMsg.exception_type || ''} ${errorMsg.exception_message || ''}`, 3);
      }
      if (entry.status?.status_str === 'error') die('ComfyUI 报错结束（未拿到图）', 3);
      if (!images.length) die('任务结束但没有输出图像', 3);
      return { image: images[0], entry, elapsedMs: Date.now() - started };
    }
    onTick?.(Date.now() - started);
    await sleep(1500);
  }
  die(`等待超时（${Math.round(timeoutMs / 1000)}s）。任务可能还在跑：prompt_id=${promptId}，可查 ${host}/history/${promptId}`, 3);
}

async function download(host, image, destPath) {
  const qs = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder || '',
    type: image.type || 'output',
  });
  const res = await fetch(`${host}/view?${qs}`, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) die(`下载原图失败：HTTP ${res.status}`, 3);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf;
}

// ------------------------------------------------------- 参考图（编辑模式）

/** 从文件头读尺寸：只认 PNG / JPEG（编辑模式的参考图必需知道比例） */
function readImageSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * ComfyUI 自己的算法（comfy_extras/nodes_qwen.py）：参考图被缩放到接近 resolution² 像素，
 * 保持自身比例、边长取 32 的倍数；resolution=0 表示按参考图原尺寸取整。
 */
function editLatentSize(dims, resolution) {
  const ratio = dims.width / dims.height;
  const r = resolution > 0 ? resolution : Math.round(Math.max(dims.width, dims.height) / 32) * 32;
  const width = Math.max(32, Math.round(Math.sqrt(r * r * ratio) / 32) * 32);
  const height = Math.max(32, Math.round(Math.sqrt((r * r) / ratio) / 32) * 32);
  return {
    width,
    height,
    resolution: r,
    megapixels: +((width * height) / 1e6).toFixed(3),
    actualRatio: +(width / height).toFixed(4),
    ratioDeviation: +(Math.abs(width / height - ratio) / ratio).toFixed(4),
  };
}

async function uploadImage(host, filePath) {
  const fd = new FormData();
  fd.append('image', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  fd.append('overwrite', 'true');
  const res = await fetch(`${host}/upload/image`, { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) });
  if (!res.ok) die(`上传参考图失败：HTTP ${res.status}`, 3);
  const data = await res.json().catch(() => null);
  if (!data?.name) die('上传参考图失败：返回里没有文件名', 3);
  return { ...data, value: data.subfolder ? `${data.subfolder}/${data.name}` : data.name };
}

/**
 * 编辑模式接线：参考图进 LoadImage；按官方节点说明，采样用的 latent 必须是
 * TextEncodeQwenImage21 的 latent 输出（“第一张参考图尺寸的空 latent”），
 * 否则采样尺寸与参考图不一致会把编辑结果带偏。
 */
function applyEditMode(graph, opts) {
  const r = rolesOf(graph);
  const loadId = r.ids.find((id) => /^LoadImage/.test(r.clsOf(id)));
  if (!loadId) die('编辑工作流里找不到 LoadImage 节点，接不上 --reference');
  const textNode = graph[opts.textNodeId];
  if (!textNode || !('resolution' in (textNode.inputs || {}))) {
    die(`${textNode?.class_type || '文本节点'} 没有 resolution 输入，无法控制参考图重采样尺寸`);
  }
  const sampler = graph[opts.samplerId];
  const before = { image: graph[loadId].inputs.image, resolution: textNode.inputs.resolution, latentImage: sampler.inputs.latent_image };
  graph[loadId].inputs.image = opts.referenceValue;
  textNode.inputs.resolution = opts.resolution;
  sampler.inputs.latent_image = [String(opts.textNodeId), 2];
  return { loadId, before, textNodeId: opts.textNodeId, resolution: opts.resolution, rewiredLatentTo: `#${opts.textNodeId}.latent` };
}

// ------------------------------------------------------ skill 包版本摘要

async function readSkillBundle(explicitDir) {
  const candidates = [
    explicitDir,
    process.env.QWEN_SKILL_DIR,
    path.join(HOME, '.codex', 'skills', 'qwen-image-gen'),
    path.join(SCRIPT_DIR, '..', 'skills', 'qwen-image-gen'),
  ].filter(Boolean);
  for (const dir of candidates) {
    const core = path.join(dir, 'runtime', 'core.mjs');
    if (!fs.existsSync(core)) continue;
    try {
      const mod = await import(pathToFileURL(core).href);
      const bundle = mod.loadSkillBundle(dir);
      return { id: bundle.id, version: bundle.version, digest: bundle.digest, dir };
    } catch (e) {
      return { dir, error: e.message };
    }
  }
  return null;
}

// ---------------------------------------------------------------- 自测

function selfTest() {
  const cases = [
    ['1:1', 1],
    ['9:16', 1],
    ['2:3', 1],
    ['3:4', 1],
    ['16:9', 1],
    ['4:5', 0.6],
    ['9:16', 2.4],
    ['1:1', 0.6, 32],
  ];
  let failed = 0;
  const table = [];
  for (const [ratio, mp, step] of cases) {
    const s = mapSize(ratio, mp, { step: step || SIZE_STEP_DEFAULT });
    const target = mp * 1e6;
    const px = (s.width * s.height) / target;
    const checks = [
      [s.width % s.step === 0 && s.height % s.step === 0, `尺寸是 ${s.step} 的倍数`],
      [s.width >= SIZE_MIN && s.width <= SIZE_MAX && s.height >= SIZE_MIN && s.height <= SIZE_MAX, '在 256–2048 内'],
      [s.ratioDeviation <= RATIO_TOLERANCE, `比例偏差 ≤${RATIO_TOLERANCE * 100}%`],
      [px <= 1.1 && px >= 0.85, '像素预算 −15%…+10%'],
    ];
    const bad = checks.filter(([ok]) => !ok).map(([, name]) => name);
    if (bad.length) failed++;
    const pxLabel = `${px >= 1 ? '+' : ''}${((px - 1) * 100).toFixed(1)}%`;
    table.push(
      `${bad.length ? '✗' : '✓'} ${String(ratio).padEnd(5)} @${mp}MP${s.step !== SIZE_STEP_DEFAULT ? ` step${s.step}` : ''} → ${s.width}×${s.height}（${s.megapixels}MP / 预算 ${pxLabel}，实ratio ${s.actualRatio}）${bad.length ? ' — ' + bad.join('、') : ''}`
    );
  }

  // 精确比例模式：9:16 必须落在真正的 9:16 画幅上
  const exact = mapSize('9:16', 1, { exactRatio: true });
  const exactOk = exact.ratioDeviation === 0 && exact.exact;
  table.push(`${exactOk ? '✓' : '✗'} --exact-ratio 9:16 @1MP → ${exact.width}×${exact.height}（${exact.megapixels}MP，偏差 ${(exact.ratioDeviation * 100).toFixed(2)}%）`);
  if (!exactOk) failed++;

  // 转置对称：9:16 与 16:9 应互为转置
  const portrait = mapSize('9:16', 1, { exactRatio: true });
  const landscape = mapSize('16:9', 1, { exactRatio: true });
  const symmetric =
    (portrait.width === landscape.height && portrait.height === landscape.width) ||
    Math.abs(portrait.width / portrait.height - 9 / 16) <= RATIO_TOLERANCE;
  table.push(`${symmetric ? '✓' : '✗'} 9:16 / 16:9 转置一致 → ${portrait.width}×${portrait.height} / ${landscape.width}×${landscape.height}`);
  if (!symmetric) failed++;

  // 打补丁：用合成的最小 API 图验证字段真的被写进去
  const synthetic = {
    '1': { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'x.gguf' } },
    '2': { class_type: 'EmptySD3LatentImage', inputs: { width: 768, height: 768, batch_size: 4 } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: 'old positive' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: 'old negative' } },
    '5': {
      class_type: 'KSampler',
      inputs: { seed: 1, steps: 12, cfg: 2.5, sampler_name: 'euler', scheduler: 'simple', positive: ['3', 0], negative: ['4', 0] },
    },
    '6': { class_type: 'SaveImage', inputs: { filename_prefix: 'qwen' } },
  };
  const info = patchGraph(synthetic, { width: 736, height: 1312, prompt: 'new', seed: 42, steps: 8, prefix: 'a/b' });
  const patchOk =
    synthetic['2'].inputs.width === 736 &&
    synthetic['2'].inputs.height === 1312 &&
    synthetic['2'].inputs.batch_size === 1 &&
    synthetic['3'].inputs.text === 'new' &&
    synthetic['5'].inputs.seed === 42 &&
    synthetic['5'].inputs.steps === 8 &&
    synthetic['6'].inputs.filename_prefix === 'a/b' &&
    info.models.UnetLoaderGGUF === 'x.gguf' &&
    info.before.width === 768;
  table.push(`${patchOk ? '✓' : '✗'} 打补丁：画幅/正向文本/种子/步数/前缀/模型识别`);
  if (!patchOk) failed++;

  // 前端图 → API 格式，并且能直接在 SamplerCustomAdvanced 链路上打补丁
  const frontend = {
    nodes: [
      { id: 1, type: 'UnetLoaderGGUF', mode: 0, widgets_values: ['x.gguf'], inputs: [{ name: 'unet_name', link: null, widget: true }] },
      {
        id: 2,
        type: 'CLIPLoader',
        mode: 0,
        widgets_values: ['c.safetensors', 'qwen_image', 'default'],
        inputs: [
          { name: 'clip_name', link: null, widget: true },
          { name: 'type', link: null, widget: true },
          { name: 'device', link: null, widget: true },
        ],
      },
      {
        id: 3,
        type: 'EmptyLatentImage',
        mode: 0,
        widgets_values: [768, 768, 1],
        inputs: [
          { name: 'width', link: null, widget: true },
          { name: 'height', link: null, widget: true },
          { name: 'batch_size', link: null, widget: true },
        ],
      },
      {
        id: 4,
        type: 'TextEncodeQwenImage21',
        mode: 0,
        widgets_values: ['p', '', 1024],
        inputs: [
          { name: 'clip', link: 1, type: 'CLIP' },
          { name: 'prompt', link: null, widget: true },
          { name: 'negative_prompt', link: null, widget: true },
          { name: 'resolution', link: null, widget: true },
        ],
      },
      {
        id: 5,
        type: 'BasicGuider',
        mode: 0,
        widgets_values: [],
        inputs: [
          { name: 'model', link: null, type: 'MODEL' },
          { name: 'conditioning', link: 2, type: 'CONDITIONING' },
        ],
      },
      {
        id: 6,
        type: 'ViggleTurboSigmas',
        mode: 0,
        widgets_values: ['1.0, 0.9375, 0.875, 0.75, 0.5, 0.25'],
        inputs: [
          { name: 'latent', link: 3, type: 'LATENT' },
          { name: 'nodes', link: null, widget: true },
        ],
      },
      { id: 7, type: 'RandomNoise', mode: 0, widgets_values: [777], inputs: [{ name: 'noise_seed', link: null, widget: true }] },
      { id: 8, type: 'KSamplerSelect', mode: 0, widgets_values: ['euler'], inputs: [{ name: 'sampler_name', link: null, widget: true }] },
      {
        id: 9,
        type: 'SamplerCustomAdvanced',
        mode: 0,
        widgets_values: [],
        inputs: [
          { name: 'noise', link: 4, type: 'NOISE' },
          { name: 'guider', link: 5, type: 'GUIDER' },
          { name: 'sampler', link: 6, type: 'SAMPLER' },
          { name: 'sigmas', link: 7, type: 'SIGMAS' },
          { name: 'latent_image', link: 8, type: 'LATENT' },
        ],
      },
      {
        id: 10,
        type: 'SaveImage',
        mode: 0,
        widgets_values: ['qwen'],
        inputs: [
          { name: 'images', link: 9, type: 'IMAGE' },
          { name: 'filename_prefix', link: null, widget: true },
        ],
      },
      { id: 11, type: 'MutedThing', mode: 2, widgets_values: [], inputs: [] },
    ],
    links: [
      [1, 2, 0, 4, 0, 'CLIP'],
      [2, 4, 0, 5, 1, 'CONDITIONING'],
      [3, 3, 0, 6, 0, 'LATENT'],
      [4, 7, 0, 9, 0, 'NOISE'],
      [5, 5, 0, 9, 1, 'GUIDER'],
      [6, 8, 0, 9, 2, 'SAMPLER'],
      [7, 6, 0, 9, 3, 'SIGMAS'],
      [8, 3, 0, 9, 4, 'LATENT'],
      [9, 9, 0, 10, 0, 'IMAGE'],
    ],
  };
  const convFailures = [];
  try {
    const { graph: convertedGraph, notes: convNotes } = frontendToApi(frontend);
    const turboInfo = patchGraph(convertedGraph, { width: 512, height: 512, prompt: 'new', seed: 5, steps: 7, prefix: 'p' });
    const convChecks = [
      ['guider 链接还原', convertedGraph['9'].inputs.guider[0] === '5'],
      ['positive 字段写入', convertedGraph['4'].inputs.prompt === 'new'],
      ['画幅写入', convertedGraph['3'].inputs.width === 512],
      ['noise_seed 写入', convertedGraph['7'].inputs.noise_seed === 5],
      ['sigma 表按 7 步重算', convertedGraph['6'].inputs.nodes === '1, 0.9583, 0.9167, 0.875, 0.75, 0.5, 0.25'],
      ['保存前缀写入', convertedGraph['10'].inputs.filename_prefix === 'p'],
      ['采样链识别为 custom', turboInfo.mode === 'SamplerCustomAdvanced'],
      ['步数取自 sigma 表', turboInfo.sampling.steps === 7],
      ['静音节点被跳过', !convertedGraph['11'] && convNotes.some((n) => n.includes('#11'))],
    ];
    for (const [name, ok] of convChecks) if (!ok) convFailures.push(name);
  } catch (e) {
    convFailures.push(`抛错 ${e.message}`);
  }
  table.push(
    `${convFailures.length ? '✗' : '✓'} 前端图转 API 格式 + turbo 链路打补丁（BasicGuider 条件/noise_seed/sigma 表/静音节点）${convFailures.length ? ' — ' + convFailures.join('、') : ''}`
  );
  if (convFailures.length) failed++;

  // 编辑模式：参考图进 LoadImage、resolution 控制重采样、采样 latent 改为跟随参考图
  const editGraph = {
    '1': { class_type: 'LoadImage', inputs: { image: 'old.png' } },
    '2': {
      class_type: 'TextEncodeQwenImage21',
      inputs: { clip: ['3', 0], prompt: 'old', negative_prompt: '', resolution: 1024, images: { image_1: ['1', 0] } },
    },
    '3': { class_type: 'CLIPLoader', inputs: { clip_name: 'c', type: 'qwen_image', device: 'default' } },
    '4': { class_type: 'BasicGuider', inputs: { model: ['5', 0], conditioning: ['2', 0] } },
    '5': {
      class_type: 'SamplerCustomAdvanced',
      inputs: { noise: ['6', 0], guider: ['4', 0], sampler: ['7', 0], sigmas: ['8', 0], latent_image: ['9', 0] },
    },
    '6': { class_type: 'RandomNoise', inputs: { noise_seed: 1 } },
    '7': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '8': { class_type: 'ViggleTurboSigmas', inputs: { latent: ['9', 0], nodes: '1.0, 0.9375, 0.875, 0.75, 0.5, 0.25' } },
    '9': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  };
  const editFailures = [];
  try {
    const editPatch = patchGraph(editGraph, { width: 768, height: 1376, prompt: '改成白瓷杯', seed: 9, steps: 6, prefix: 'e' });
    const applied = applyEditMode(editGraph, {
      referenceValue: 'ref-512x912.png',
      resolution: 1024,
      samplerId: editPatch.ids.samplerId,
      textNodeId: editPatch.ids.positiveId,
    });
    const predicted = editLatentSize({ width: 512, height: 912 }, 1024);
    const fakePng = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(fakePng, 0);
    fakePng.writeUInt32BE(512, 16);
    fakePng.writeUInt32BE(912, 20);
    const tmp = path.join(os.tmpdir(), 'qwen-bridge-size-check.png');
    fs.writeFileSync(tmp, fakePng);
    const parsed = readImageSize(tmp);
    fs.unlinkSync(tmp);

    if (editGraph['1'].inputs.image !== 'ref-512x912.png') editFailures.push('参考图未写进 LoadImage');
    if (editGraph['2'].inputs.resolution !== 1024) editFailures.push('resolution 未写入');
    if (editGraph['2'].inputs.prompt !== '改成白瓷杯') editFailures.push('编辑提示词未写入');
    if (editGraph['5'].inputs.latent_image[0] !== '2' || editGraph['5'].inputs.latent_image[1] !== 2) {
      editFailures.push('采样 latent 未改为跟随参考图');
    }
    if (applied.rewiredLatentTo !== '#2.latent') editFailures.push('接线返回值不对');
    if (predicted.width !== 768 || predicted.height !== 1376) {
      editFailures.push(`editLatentSize 期望 768×1376，得到 ${predicted.width}×${predicted.height}`);
    }
    if (!parsed || parsed.width !== 512 || parsed.height !== 912) editFailures.push('PNG 尺寸解析失败');
    if (editPatch.sampling.steps !== 6) editFailures.push(`步数期望 6，得到 ${editPatch.sampling.steps}`);
  } catch (e) {
    editFailures.push(`抛错 ${e.message}`);
  }
  table.push(
    `${editFailures.length ? '✗' : '✓'} 编辑模式接线（参考图进 LoadImage / resolution / latent 跟随参考图 / 512×912→768×1376）${editFailures.length ? ' — ' + editFailures.join('、') : ''}`
  );
  if (editFailures.length) failed++;

  console.log(table.join('\n'));
  console.log(failed ? `\n✗ 自测失败 ${failed} 项` : '\n✓ 自测全部通过');
  process.exit(failed ? 1 : 0);
}

// ------------------------------------------------------------------ 主流程

const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.rewrite && !args.prompt && !args.selfTest)) {
  console.log(USAGE);
  process.exit(0);
}
if (args.selfTest) selfTest();

// 1) 输入
let rewriteJson = null;
let prompt = typeof args.prompt === 'string' ? args.prompt : '';
let followReference = false;
if (args.rewrite) {
  const p = path.resolve(args.rewrite);
  if (!fs.existsSync(p)) die(`找不到改写文件：${p}`);
  try {
    rewriteJson = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    die(`改写文件不是合法 JSON：${e.message}`);
  }
  followReference = !!rewriteJson.ratio_follow;
  prompt = String(rewriteJson.rewritten_prompt ?? '');
  if (!prompt.trim()) die('rewritten_prompt 为空');
}

// 2) 尺寸
const ratio = args.ratio || rewriteJson?.wh_ratio || '1:1';
const sizeStep = args.sizeStep != null ? num(args.sizeStep, '--size-step', { min: 8, max: 64 }) : SIZE_STEP_DEFAULT;
if (!SIZE_STEPS.includes(sizeStep)) die(`--size-step 只能是 ${SIZE_STEPS.join(' / ')}`);
const megapixels = num(args.megapixels ?? 1, '--megapixels', { min: 0.1, max: 4, int: false });
const resolution =
  args.resolution != null
    ? num(args.resolution, '--resolution', { min: 0, max: 4096 })
    : snapStep(Math.sqrt(megapixels * 1e6), 32);
const editing = !!args.reference || followReference;
if (followReference && !args.reference) {
  die('改写文件要的是编辑模式（ratio_follow 跟随参考图），需要 --reference 给出参考图路径（或用 --ratio 强制改走文生图）');
}
let referenceSize = null;
if (args.reference) {
  const refPath = path.resolve(args.reference);
  if (!fs.existsSync(refPath)) die(`找不到参考图：${refPath}`);
  referenceSize = readImageSize(refPath);
  if (!referenceSize) die('读不出参考图尺寸（只支持 PNG / JPEG）：先把它转成 PNG 再试');
}
if (megapixels > 1.5) warn(`提示：${megapixels}MP 在 16GB 机型上可能很慢或触发内存交换`);

let size;
if (editing) {
  size = {
    requestedRatio: `${referenceSize.width}:${referenceSize.height}`,
    ...editLatentSize(referenceSize, resolution),
    source: 'reference',
    step: 32,
    exact: true,
    snapped: false,
    explicit: false,
  };
  const wanted = rewriteJson?.wh_ratio;
  if (wanted) {
    const wantedRatio = parseRatio(wanted, 'wh_ratio');
    const refRatio = referenceSize.width / referenceSize.height;
    if (Math.abs(wantedRatio - refRatio) / refRatio > RATIO_TOLERANCE) {
      warn(`改写文件建议 ${wanted}，但编辑链路只能随参考图比例（${referenceSize.width}×${referenceSize.height}）出图；已按参考图走`);
    }
  }
} else if (args.width != null || args.height != null) {
  if (args.width == null || args.height == null) die('--width 与 --height 必须同时给');
  const width = snapStep(num(args.width, '--width', { min: 1 }), sizeStep);
  const height = snapStep(num(args.height, '--height', { min: 1 }), sizeStep);
  size = {
    requestedRatio: ratio,
    width,
    height,
    megapixels: +((width * height) / 1e6).toFixed(3),
    actualRatio: +(width / height).toFixed(4),
    ratioDeviation: +(Math.abs(width / height - parseRatio(ratio, 'wh_ratio')) / parseRatio(ratio, 'wh_ratio')).toFixed(4),
    exact: +(width / height).toFixed(4) === +parseRatio(ratio, 'wh_ratio').toFixed(4),
    step: sizeStep,
    snapped: width !== Number(args.width) || height !== Number(args.height),
    explicit: true,
  };
} else {
  if (!args.ratio && !rewriteJson?.wh_ratio) warn('未给出 wh_ratio，按 1:1 处理');
  size = { ...mapSize(ratio, megapixels, { exactRatio: !!args.exactRatio, step: sizeStep }), explicit: false };
}

// 3) 工作流
const presetName = args.preset || (editing ? 'edit' : DEFAULT_PRESET);
const preset = PRESETS[presetName];
if (!preset) die(`--preset 只能是 ${Object.keys(PRESETS).join(' / ')}`);
if (editing && presetName !== 'edit') die(`--reference 需要编辑预设（--preset edit），当前是 ${presetName}`);
const templatePath = path.resolve(
  args.template || process.env.COMFY_TEMPLATE || path.join(WORKFLOWS_DIR, preset.template)
);
const templateBuf = fs.readFileSync(templatePath, 'utf8');
const templateSha = sha256(templateBuf);
const { graph, converted, notes } = loadGraph(templatePath);
for (const n of notes) warn(n);

// 模型文件替换：--unet / --clip / --vae / --lora
const MODEL_FLAGS = {
  unet: ['UnetLoaderGGUF', 'unet_name'],
  clip: ['CLIPLoader', 'clip_name'],
  vae: ['VAELoader', 'vae_name'],
  lora: ['ViggleTurboLora', 'lora_name'],
};
for (const [flag, [cls, field]] of Object.entries(MODEL_FLAGS)) {
  if (!args[flag]) continue;
  const node = Object.values(graph).find((n) => n.class_type === cls);
  if (!node) die(`模板里没有 ${cls} 节点，--${flag} 用不上`);
  node.inputs[field] = args[flag];
}

if (args.saveApi) {
  const dest = path.resolve(args.saveApi);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({ prompt: graph }, null, 1));
  console.log(`[0/5] 导出      API 格式图已写入 ${dest}`);
}

const seed = args.seed != null ? num(args.seed, '--seed', { min: 0, max: 2 ** 31 - 1 }) : crypto.randomInt(1, 2 ** 31 - 1);
const slug = String(args.name || (args.rewrite ? path.basename(args.rewrite).replace(/\.[^.]+$/, '') : 'qwen'))
  .replace(/[^\w\u4e00-\u9fa5.-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'qwen';

const patch = patchGraph(graph, {
  width: size.width,
  height: size.height,
  prompt,
  seed,
  steps: args.steps != null ? num(args.steps, '--steps', { min: 1, max: 200 }) : null,
  cfg: args.cfg != null ? num(args.cfg, '--cfg', { min: 0, max: 100, int: false }) : null,
  sampler: args.sampler || null,
  scheduler: args.scheduler || null,
  negative: args.negative ?? null,
  prefix: `qwen-bridge/${slug}`,
});

const sampleLine =
  `${patch.sampling.steps} 步 / ${patch.sampling.cfg != null ? `cfg ${patch.sampling.cfg} / ` : ''}` +
  `${patch.sampling.sampler} / ${patch.sampling.scheduler}`;
const host = (args.host || DEFAULT_HOST).replace(/\/+$/, '');

// 3.5) 编辑模式：参考图上传 + 接线
let editInfo = null;
if (editing) {
  const refPath = path.resolve(args.reference);
  const refBuf = fs.readFileSync(refPath);
  editInfo = {
    path: refPath,
    bytes: refBuf.length,
    sha256: sha256(refBuf),
    format: referenceSize.format,
    width: referenceSize.width,
    height: referenceSize.height,
    resolution,
    uploadedAs: null,
    applied: null,
  };
  if (args.dryRun) {
    editInfo.applied = applyEditMode(graph, {
      referenceValue: path.basename(refPath),
      resolution,
      samplerId: patch.ids.samplerId,
      textNodeId: patch.ids.positiveId,
    });
    warn(`--dry-run：参考图未上传，图上先按文件名 ${path.basename(refPath)} 占位`);
  } else {
    const up = await uploadImage(host, refPath);
    editInfo.uploadedAs = up.value;
    editInfo.applied = applyEditMode(graph, {
      referenceValue: up.value,
      resolution,
      samplerId: patch.ids.samplerId,
      textNodeId: patch.ids.positiveId,
    });
  }
}

if (args.dryRun) {
  const report = {
    preset: presetName,
    size,
    reference: editInfo,
    chain: patch.mode,
    sampling: patch.sampling,
    models: patch.models,
    template: { path: templatePath, sha256: templateSha, convertedFromFrontend: converted },
    nodes: patch.ids,
    prompt,
  };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    if (editInfo) {
      console.log(
        `参考图    ${editInfo.path}（${editInfo.width}×${editInfo.height}，resolution ${editInfo.resolution}）→ 预计输出 ${size.width}×${size.height}（${size.megapixels}MP）`
      );
      console.log(`          采样 latent 改为 #${editInfo.applied.textNodeId}.latent（原 ${JSON.stringify(editInfo.applied.before.latentImage)}）`);
    }
    console.log(`比例      ${size.requestedRatio} → ${size.width}×${size.height}（${size.megapixels}MP，实际 ${size.actualRatio}，偏差 ${(size.ratioDeviation * 100).toFixed(2)}%，step ${size.step}）`);
    console.log(`采样      ${sampleLine} / seed ${seed}`);
    console.log(`模板      ${templatePath}${converted ? '（前端图 → API 格式）' : ''}`);
    console.log(`           sha256 ${templateSha.slice(0, 16)}…  链路 ${patch.mode}`);
    console.log(`           节点 ${JSON.stringify(patch.ids)}`);
    console.log(`模型      ${Object.values(patch.models).join(' / ')}`);
    console.log(`提示词    ${prompt.length} 字：${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}`);
    console.log('（--dry-run：未提交）');
  }
  process.exit(0);
}

// 4) 服务与预检
const stats = await httpJson(`${host}/system_stats`, { timeoutMs: 5000 }).catch(() => null);
if (!stats?.ok) die(`连不上 ComfyUI（${host}）：确认它正在运行，或用 --host 指定地址`, 3);
const comfyVersion = stats.data?.system?.comfyui_version ?? null;
console.log(`[1/5] 服务      ComfyUI ${comfyVersion ?? '未知版本'} @ ${host}`);
console.log(`      预设      ${presetName}（${preset.label}）${converted ? '，模板由前端图转换' : ''}`);
if (editInfo) {
  console.log(
    `      参考图    ${path.basename(editInfo.path)}（${editInfo.width}×${editInfo.height}）→ 上传为 ${editInfo.uploadedAs}，resolution ${editInfo.resolution}，采样 latent 取 #${editInfo.applied.textNodeId}.latent`
  );
}

if (!args.noPreflight) {
  await preflight(host, graph);
  console.log(`[2/5] 预检      ${Object.entries(patch.models).map(([k, v]) => `${k}=${v}`).join('，')}`);
} else {
  console.log('[2/5] 预检      已跳过');
}

console.log(
  `[3/5] 尺寸      ${size.requestedRatio}${size.explicit ? '（显式画布）' : ` @${args.megapixels ?? '1'}MP`} → ${size.width}×${size.height}` +
    `（${size.megapixels}MP，偏差 ${(size.ratioDeviation * 100).toFixed(2)}%，step ${size.step}）/${sampleLine}/seed ${seed}`
);

// 5) 提交 → 等待 → 落盘
const clientId = `qwen-bridge-${process.pid}-${Date.now()}`;
const promptId = await submit(host, graph, clientId);
console.log(`[4/5] 提交      prompt_id=${promptId}，等待出图…`);
const t0 = Date.now();
let lastTick = 0;
const { image, elapsedMs } = await waitForImage(host, promptId, num(args.timeoutMs ?? 1800000, '--timeout-ms', { min: 10000 }), (el) => {
  if (el - lastTick >= 10000) {
    lastTick = el;
    process.stdout.write(`      已等 ${Math.round(el / 1000)}s…\n`);
  }
});

const outDir = path.resolve(args.out || DEFAULT_OUT);
fs.mkdirSync(outDir, { recursive: true });
const base = `${slug}-${size.width}x${size.height}-s${seed}`;
let destPath = path.join(outDir, `${base}.png`);
for (let i = 2; fs.existsSync(destPath); i++) destPath = path.join(outDir, `${base}-${i}.png`);
const buf = await download(host, image, destPath);
const fileSha = sha256(buf);

const skillBundle = await readSkillBundle(args.skillDir);
const sidecar = {
  generatedAt: new Date().toISOString(),
  preset: presetName,
  chain: patch.mode,
  reference: editInfo,
  skillBundle,
  input: rewriteJson ?? null,
  submittedPrompt: prompt,
  size,
  sampling: { ...patch.sampling, seed },
  models: patch.models,
  workflow: {
    template: { path: templatePath, sha256: templateSha, convertedFromFrontend: converted },
    nodeIds: patch.ids,
    templateValuesBefore: patch.before,
    promptId,
    clientId,
    comfyui: { host, version: comfyVersion },
  },
  result: {
    file: destPath,
    bytes: buf.length,
    sha256: fileSha,
    comfyuiOriginal: image,
  },
  elapsedMs: elapsedMs ?? Date.now() - t0,
  submitToFirstImageMs: Date.now() - t0,
};
const sidecarPath = destPath.replace(/\.png$/, '.json');
fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));

if (args.json) {
  console.log(JSON.stringify(sidecar, null, 2));
} else {
  console.log(`[5/5] 落盘      ${destPath}（${(buf.length / 1024).toFixed(0)} KB，sha256 ${fileSha.slice(0, 12)}…）`);
  console.log(`      参数      ${sidecarPath}`);
  console.log(`      耗时      出图 ${(elapsedMs / 1000).toFixed(1)}s，全程 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (skillBundle?.version) console.log(`      规则      ${skillBundle.id} v${skillBundle.version} digest ${String(skillBundle.digest).slice(0, 12)}…`);
  else console.log(`      规则      ${skillBundle?.error ? `读取失败：${skillBundle.error}` : '未找到 qwen-image-gen 包（可用 --skill-dir 指定，摘要会记进参数）'}`);
}
