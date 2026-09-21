// backend/routes/aiTeacher.js
//
// AI 泰语老师（本地后端版）
//   POST /api/ai/teacher —— 聊天 / 发音 / 口语三种模式
//   GET  /api/ai/status  —— 所有 AI 服务配置自检（?probe=1 做真实连通性探测）
//
// 模型调用不再写死 DeepSeek：统一走 backend/aiProvider.js，
// 由它挑选可用提供方（DeepSeek / Agnes 网关 / 任何 OpenAI 兼容网关）：
//
//   AI_PROVIDER=auto|deepseek|agnes     默认 auto（有可用 key 的第一个）
//   DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL
//   AGNES_API_KEY（别名 AI_API_KEY）/ AGNES_BASE_URL（别名 AI_BASE_URL）
//
// 占位符 key（如「你的xxxKEY」）会被识别为「未配置」，直接返回 503 +
// 具体原因，而不是等上游 401。

import express from "express";
import "../env.js";
import db from "../database.js";
import { authenticate } from "./auth.js";
import { getQuotaSetting } from "./features.js";
import { createNotification } from "./notifications.js";
import { buildContextSystemPrompt } from "../contextPrompts.js";
import {
  buildLearnerGuidance,
  getUserProfile,
  mergeProfileForPrompt,
} from "../learnerProfile.js";

import {
  aiServicesStatus,
  chatCompletion,
  probeAiServices,
  resolveChatProvider,
} from "../aiProvider.js";

import {
  MANUAL_IMPORTANCE,
  applyMemoryExtract,
  buildMemoryPrompt,
  deleteMemoryItem,
  groupMemoryItems,
  legacyToMemoryItems,
  listMemoryItems,
  loadMemoryForPrompt,
  memorySummary,
  replaceMemoryType,
  toLegacyMemory,
  upsertMemoryItem,
} from "../aiMemory.js";

const router = express.Router();

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 45000;

export function isAiTeacherEnabled() {
  return Boolean(resolveChatProvider());
}

/* ============================================================
   AI 老师免费对话额度
   （免费用户每日限 N 次对话，VIP 无限。）
   优先级：设置中心管理员配置 > 环境变量 AI_TEACHER_FREE_DAILY > 默认 10
============================================================ */

function getFreeChatDaily() {
  return getQuotaSetting(
    "aiTeacherFreeDaily",
    Number(process.env.AI_TEACHER_FREE_DAILY) || 10
  );
}

function isVipActive(user) {
  if (!user || !user.is_vip) return false;
  if (!user.vip_expires_at) return false;
  const expiry = new Date(String(user.vip_expires_at).replace(" ", "T") + "Z");
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}

function todayBangkok() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function getChatUsage(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT message_count FROM ai_teacher_usage WHERE user_id = ? AND usage_date = ?",
      [userId, todayBangkok()],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.message_count : 0);
      }
    );
  });
}

function incrementChatUsage(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ai_teacher_usage (user_id, usage_date, message_count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, usage_date)
       DO UPDATE SET message_count = message_count + 1`,
      [userId, todayBangkok()],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function getVipUser(userId) {
  return new Promise((resolve) => {
    db.get("SELECT is_vip, vip_expires_at FROM users WHERE id = ?", [userId], (err, row) =>
      err ? resolve(null) : resolve(row || null)
    );
  });
}

async function quotaPayload(userId) {
  const used = await getChatUsage(userId);
  const freeChatDaily = await getFreeChatDaily();
  const vipUser = await getVipUser(userId);
  return {
    freeChatDaily,
    usedToday: used,
    remainingToday: Math.max(0, freeChatDaily - used),
    isVip: isVipActive(vipUser),
  };
}

/* ============================================================
   学生长期记忆（跨会话）
   记住学生名字/水平/兴趣/常见错误，每次对话注入 system prompt
============================================================ */

/*
 * 长期记忆已升级为「分类条目」（见 backend/aiMemory.js）：
 *   一条记忆一行，带 memory_type / importance / hits。
 * 这里保留两个兼容函数，让旧的调用点（plan / recommend / 个人中心）
 * 不用一次性改完：
 *   - getAiMemory(userId)      → 旧的扁平结构（由分类记忆推导）
 *   - saveAiMemory(userId, m)  → 把旧结构写回分类记忆
 * 新代码请直接用 loadAiMemory(userId) 拿到「条目 + 注入提示词」。
 */

async function getAiMemory(userId) {
  const { legacy } = await loadMemoryForPrompt(userId);
  return legacy && Object.keys(legacy).length ? legacy : null;
}

/** 读记忆（含入学画像同步）：条目 / 分组 / 提示词 / 旧结构 / 摘要 */
async function loadAiMemory(userId) {
  return loadMemoryForPrompt(userId);
}

/* 旧字段 → 分类类型（个人中心表单仍用旧字段名） */
const FIELD_TO_TYPE = {
  studentName: "profile",
  genderHint: "profile",
  level: "profile",
  goals: "goal",
  interests: "interest",
  weaknesses: "weakness",
  mistakes: "error",
  habits: "habit",
  preferences: "preference",
};

/**
 * 用旧的扁平结构写入分类记忆。
 * 只替换「本次请求真正动过的那几类」——用户没改的类型保持原样
 * （与升级前「只更新传进来的字段」语义一致）。
 */
async function saveAiMemory(userId, memory = {}, touchedTypes = null) {
  const items = legacyToMemoryItems(memory);
  const byType = new Map();
  for (const item of items) {
    if (!byType.has(item.type)) byType.set(item.type, []);
    byType.get(item.type).push(item.content);
  }

  const targetTypes = touchedTypes ? [...touchedTypes] : [...byType.keys()];

  for (const type of targetTypes) {
    await replaceMemoryType(userId, type, byType.get(type) || [], {
      source: "manual",
      importance: MANUAL_IMPORTANCE[type] || 3,
    });
  }

  const saved = await listMemoryItems(userId);
  return toLegacyMemory(saved);
}

/**
 * 构建带学生画像 + 长期记忆的 system prompt。
 *
 * memory 既可以是 loadAiMemory() 返回的记忆上下文（推荐，含分类提示词），
 * 也可以是一块旧的扁平对象（向后兼容，自动转成分类提示词）。
 */
function buildTeacherSystemPrompt(action, profile, memory, learnerGuidance = "") {
  const base = SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.chat;
  const parts = [base];

  const profileLines = [];
  if (profile?.name) profileLines.push(`名字：${profile.name}`);
  if (profile?.level) profileLines.push(`当前水平：${profile.level}`);
  if (profile?.streak) profileLines.push(`连续学习：${profile.streak} 天`);
  if (profile?.mastered) profileLines.push(`已掌握词汇：约 ${profile.mastered} 词`);
  if (profileLines.length > 0) {
    parts.push(
      `【学生画像】\n${profileLines.join("，")}\n请根据学生水平调整讲解深度：水平低多用简单句、多重复、少一次讲太多；水平高可以多讲地道表达和细微差别。`
    );
  }

  /* 长期记忆（分类条目，按重要度排序后注入） */
  const memoryPrompt = memory?.prompt
    ? memory.prompt
    : buildMemoryPrompt(legacyToMemoryItems(memory || {}).map((item, i) => ({
        ...item,
        id: `legacy-${i}`,
        importance: MANUAL_IMPORTANCE[item.type] || 3,
        hits: 1,
        updatedAt: null,
      })));
  if (memoryPrompt) parts.push(memoryPrompt);

  /* 入学测评画像 → 教学指令（等级难度上限 / 目标场景 / 纠错重点 / 学习方式）。
     放在画像与长期记忆之后、最接近 user 消息的位置：指令优先级最高 */
  if (learnerGuidance) {
    parts.push(learnerGuidance);
  }

  return parts.join("\n\n");
}

/*
 * 每 5 轮对话后，用 DeepSeek 提取「分类记忆条目」入库（异步，失败不影响主对话）。
 *
 * 五类内容对应产品要求：目标 / 习惯 / 薄弱点 / 错误记录 / 兴趣内容，
 * 身份信息（名字、性别线索、水平）单独归到 profile 类。
 * 重要度由模型给（1~5），没给就用该类型的默认值；同一条重复出现时
 * 命中次数 +1，排序会自动上浮（见 aiMemory.upsertMemoryItem）。
 */
async function summarizeAndSaveMemory(userId, history) {
  try {
    const existing = await listMemoryItems(userId);
    const system = `你是 AI 泰语老师「阿泰」的记忆系统。下面是学生说过的话，请提取值得长期记住的信息。

必须只返回一个 JSON 对象（不要输出任何其他文字，不要 markdown 围栏），结构如下：
{
  "studentName": "学生名字（未提到则 null）",
  "genderHint": "性别线索：男写\"男性（用ครับ）\"，女写\"女性（用ค่ะ）\"，未知 null",
  "level": "水平评估：beginner / elementary / intermediate / advanced",
  "goals": ["学习目标，如：准备去清迈交换、想看懂泰剧不生词"],
  "interests": ["兴趣内容，如：泰剧、泰国美食、拍短视频"],
  "habits": ["学习习惯，如：习惯晚上学、喜欢用追剧素材练听力"],
  "weaknesses": ["薄弱点，如：声调容易混乱、长句听不懂"],
  "errors": ["反复出现的具体错误，如：把 ครับ 用在句末无论性别"],
  "preferences": ["讲解偏好，如：希望先给例句再讲语法"]
}

重要度规则（想强调的就写成对象，其余写成字符串即可）：
- 影响教学方向的信息（目标、薄弱点）用 {"content":"...","importance":5}
- 一般偏好与兴趣用字符串即可（默认 3 分）

示例输出（只示例，实际按对话内容）：
{"studentName":"李明","genderHint":"男性（用ครับ）","level":"beginner","goals":[{"content":"准备泰国交换","importance":5}],"interests":["泰剧","泰国美食"],"habits":["喜欢晚上学习"],"weaknesses":[{"content":"声调容易混淆","importance":5}],"errors":[],"preferences":[]}

已有记忆（避免重复，只输出新增或需要更正的）：${JSON.stringify(
      existing.map((i) => ({ type: i.type, content: i.content }))
    )}
规则：只保留长期有效的重要信息；与已有记忆冲突时以新信息为准；没有新信息就全部输出空值。`;

    // 只传学生消息（assistant 回复不参与记忆提取，避免格式干扰）
    const userOnly = history
      .filter((h) => h?.role === "user")
      .slice(-15)
      .map((h) => ({
        role: "user",
        content: String(h?.content || "").slice(0, 500),
      }));
    const messages = [{ role: "system", content: system }, ...userOnly];
    // 不用 json_object（历史是纯文本，模型更容易模仿输出格式），靠 few-shot + 宽容解析
    const raw = await callDeepSeekMessages(messages, 0.2, 700);
    const parsed = parseRawJson(raw);
    if (parsed && typeof parsed === "object") {
      const added = await applyMemoryExtract(userId, parsed, { source: "ai" });
      if (added > 0) {
        console.log(`[aiTeacher] 记忆更新：user ${userId} +${added} 条`);
      }
    }
  } catch (e) {
    // 记忆总结失败不影响主对话（打日志便于排查）
    console.warn("[aiTeacher] 记忆总结失败:", e?.message || e);
  }
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
   对话练习（conversation）—— 结构化自由对话
   返回严格 JSON：thai/roman/chinese/vocab/grammar/culturalNote/nextStage
============================================================ */

function buildConversationSystemPrompt(scene, stage) {
  const sceneTitle = scene?.title || "日常交流";
  const sceneDesc = scene?.description || "";
  const sceneTip = scene?.sceneTip || "";
  const stagePrompt = stage?.prompt || "";
  const roleplay = scene?.roleplay || null;
  const charLine = roleplay ? `\n【角色扮演】你正在扮演「${roleplay.character}」。请完全沉浸在这个角色中，用符合角色身份的语气和行为来回应。例如：机场工作人员要专业礼貌、餐厅服务员要热情周到、出租车司机要随和健谈、夜市摊主要亲切会砍价。` : "";
  return `你叫「阿泰」，是 ThaiAI 学习平台的 AI 泰语老师。学生正在「对话练习」页面和你进行场景化自由对话。

【当前场景】${sceneTitle}${sceneDesc ? " - " + sceneDesc : ""}
${sceneTip ? "【场景提示】" + sceneTip : ""}${charLine}
${stagePrompt ? "【当前对话目标】" + stagePrompt : ""}

要求：
- 用泰语回复为主，泰语必须自然地道，符合当前场景。
- 必须返回【严格 JSON】，不要输出任何 JSON 之外的文字，不要用 markdown 代码围栏。
- JSON 结构（所有字段必须有）：
{
  "thai": "泰语回复（1-3 句，自然口语）",
  "roman": "整句罗马音注音（RTGS 风格，带声调符号如 sà-wàt-dii）",
  "chinese": "整句中文翻译",
  "vocab": [{"th": "生词", "roman": "注音", "cn": "中文", "example": "含该词的短句（可选）"}],
  "grammar": "本句语法/用法讲解（中文，1-2 句；没有可留空字符串）",
  "culturalNote": "相关泰国文化小知识（中文，1-2 句；没有可留空字符串）",
  "nextStage": true 或 false
}
- vocab 只列 1-3 个最有教学价值的新词，避免重复已有词汇。
- 判断 nextStage：当学生已经自然完成当前对话目标、且对话可以进入下一话题时返回 true（对话推进）；学生还在练习当前话题时返回 false。
- 学生说中文时，先给出对应的泰语表达再继续对话；学生说泰语时，先纠正明显错误（如果有），再自然接话。
- **错误纠正**：学生说泰语时，如果发现发音拼写错误、语法错误或用词不当，在回复开头先简短纠正（如「你说的是 X，正确是 Y」），然后再继续对话。纠正要温和鼓励，不要打击信心。
- **沉浸式对话**：如果场景有角色扮演，你就是那个角色。用角色的视角和语气对话，不要跳出角色。例如你是餐厅服务员，就用服务员的方式招呼客人、推荐菜品、下单结账。
- 保持人设：耐心、幽默、鼓励，像真人老师一样追问，不要一次倒完所有信息。
- 不要编造泰语词汇，不确定时在 chinese 里说明。`;
}

/* 通用 JSON 提取：返回原始对象（不经过字段白名单），供记忆总结等使用 */
function parseRawJson(content) {
  let text = String(content || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("未找到 JSON 对象");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  return parsed && typeof parsed === "object" ? parsed : null;
}

/* 根据学生画像 + 长期记忆生成定制推荐的 system prompt */
function buildRecommendSystemPrompt(profile, memory) {
  const lines = [];
  if (profile?.name) lines.push(`名字：${profile.name}`);
  if (profile?.level) lines.push(`当前水平：${profile.level}`);
  if (memory?.level) lines.push(`老师评估水平：${memory.level}`);
  if (memory?.interests?.length) lines.push(`兴趣：${memory.interests.slice(0, 5).join("、")}`);
  if (memory?.goals?.length) lines.push(`目标：${memory.goals.slice(0, 3).join("、")}`);
  if (memory?.mistakes?.length) lines.push(`常见错误：${memory.mistakes.slice(0, 4).join("；")}`);
  if (memory?.weaknesses?.length) lines.push(`薄弱点：${memory.weaknesses.slice(0, 4).join("；")}`);
  if (memory?.habits?.length) lines.push(`学习习惯：${memory.habits.slice(0, 3).join("、")}`);
  const profileDesc = lines.length ? lines.join("\n") : "新学生，暂无画像（请按初学者对待）";
  return `你是 ThaiAI 的 AI 泰语老师「阿泰」。请根据学生的画像和学习档案，生成一份贴合其兴趣、匹配其水平的泰语定制课程与配套练习。

【学生画像】
${profileDesc}

必须只返回一个 JSON 对象（不要任何其他文字，不要 markdown 围栏），结构如下：
{
  "topic": "课程主题（中文，一句话，贴合学生兴趣与目标）",
  "goal": "本节课达成目标（中文，1-2 句）",
  "vocab": [{"th":"泰语词","roman":"罗马音","cn":"中文"}],
  "sentences": [{"th":"泰语句子","roman":"罗马音","cn":"中文"}],
  "exercise": [{"question":"题目","answer":"参考答案（泰语）","hint":"提示（中文）"}],
  "tip": "针对学生常见错误的一句温馨提示（中文）",
  "nextTopic": "下一课建议主题（中文）"
}

要求：
- vocab 给 5-7 个与主题相关且符合水平的词；sentences 给 3-4 句主题例句。
- exercise 给 3 道随堂练习（可泰语挖空或中文问句，答案用泰语）。
- 难度严格匹配水平：beginner 用最简单高频短句；elementary/intermediate 适当加入地道表达。
- 主题务必贴合学生兴趣与目标，不要跑题。
- 泰语必须地道自然，绝不编造；tip 要结合学生常见错误，先鼓励再纠正。`;
}

/* 解析推荐课程的 JSON（宽容提取，缺失字段给默认值） */
function parseRecommendJson(content) {
  const raw = parseRawJson(content);
  return {
    topic: String(raw.topic || "").trim(),
    goal: String(raw.goal || "").trim(),
    vocab: Array.isArray(raw.vocab) ? raw.vocab.slice(0, 7) : [],
    sentences: Array.isArray(raw.sentences) ? raw.sentences.slice(0, 5) : [],
    exercise: Array.isArray(raw.exercise) ? raw.exercise.slice(0, 4) : [],
    tip: String(raw.tip || "").trim(),
    nextTopic: String(raw.nextTopic || "").trim(),
  };
}

/* 根据学生画像 + 长期记忆 + 当日进度 生成个性化每日学习计划 */
function buildPlanSystemPrompt(profile, memory) {
  const lines = [];
  if (profile?.name) lines.push(`名字：${profile.name}`);
  if (profile?.level) lines.push(`当前水平：${profile.level}`);
  if (profile?.streak) lines.push(`已连续学习：${profile.streak} 天`);
  if (profile?.mastered) lines.push(`已掌握词汇：约 ${profile.mastered} 词`);
  if (memory?.level) lines.push(`老师评估水平：${memory.level}`);
  if (memory?.interests?.length) lines.push(`兴趣：${memory.interests.slice(0, 5).join("、")}`);
  if (memory?.goals?.length) lines.push(`目标：${memory.goals.slice(0, 3).join("、")}`);
  if (memory?.mistakes?.length) lines.push(`常见错误：${memory.mistakes.slice(0, 4).join("；")}`);
  if (memory?.preferences?.length) lines.push(`偏好：${memory.preferences.slice(0, 4).join("、")}`);
  if (memory?.weaknesses?.length) lines.push(`薄弱点：${memory.weaknesses.slice(0, 3).join("；")}`);
  if (memory?.habits?.length) lines.push(`学习习惯：${memory.habits.slice(0, 3).join("、")}`);
  const profileDesc = lines.length ? lines.join("\n") : "新学生，尚无画像（请按初学者、对泰语文化和美食旅行感兴趣对待）";
  return `你是 ThaiAI 的 AI 泰语老师「阿泰」。请根据学生的画像、常见错误与学习进度，生成一份贴合其兴趣、匹配其水平的「今日学习计划」，作为学生每天的练习清单。

【学生画像】
${profileDesc}

必须只返回一个 JSON 对象（不要任何其他文字，不要 markdown 围栏），结构如下：
{
  "focus": "今日学习主题（中文，1 句话，贴合学生兴趣）",
  "tasks": [
    {"id":"vocab","title":"学习 10 个新词","description":"围绕今天主题的词汇","goal":"10 词"},
    {"id":"review","title":"复习 5 个错题","description":"巩固易错词","goal":"5 词"},
    {"id":"video","title":"观看 1 节视频","description":"对应水平的课程","goal":"1 节"},
    {"id":"speaking","title":"开口 5 分钟","description":"跟着句子练发音","goal":"5 分钟"},
    {"id":"chat","title":"和 AI 老师聊一次","description":"用今天的主题自由对话","goal":"1 次"}
  ],
  "tip": "结合学生常见错误的一句提示（中文，先鼓励再纠正）"
}

要求：
- 生成 4-6 个任务；id 只能从以下取值（每个任务尽量不同）：vocab(新词)、review(错题/生词本复习)、video(课程)、speaking(口语)、chat(AI对话)、listening(听力)、reading(阅读)。
- 任务的 title/description/goal 要显式体现本篇某个现实量（如 5 词、1 节、5 分钟），便于学生对照完成。
- 难度严格匹配水平：beginner 用小量高频任务；中高阶适当提升量并加入听说/阅读。
- 至少保留 vocab 与 speaking 两类基础任务。
- tip 要结合学生常见错误，语气温暖、自然。`;
}

/* 解析个性化计划的 JSON */
function parsePlanJson(content) {
  const raw = parseRawJson(content || "{}");
  const allowed = ["vocab", "review", "video", "speaking", "chat", "listening", "reading"];
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .filter((t) => t && allowed.includes(String(t.id).trim()))
        .slice(0, 6)
        .map((t) => ({
          id: String(t.id).trim(),
          title: String(t.title || "").trim(),
          description: String(t.description || "").trim(),
          goal: String(t.goal || "").trim(),
        }))
    : [];
  return {
    focus: String(raw.focus || "").trim(),
    tasks,
    tip: String(raw.tip || "").trim(),
  };
}

/* 从 DeepSeek 回复中提取 JSON（容忍 ```json 围栏与前后杂文） */
function parseJsonResponse(content) {
  let text = String(content || "").trim();
  // 去掉 markdown 代码围栏
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // 提取第一个 { ... } 块
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 未返回 JSON 结构");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    thai: String(parsed.thai || "").trim(),
    roman: String(parsed.roman || "").trim(),
    chinese: String(parsed.chinese || "").trim(),
    vocab: Array.isArray(parsed.vocab) ? parsed.vocab : [],
    grammar: parsed.grammar ? String(parsed.grammar).trim() : "",
    culturalNote: parsed.culturalNote ? String(parsed.culturalNote).trim() : "",
    nextStage: parsed.nextStage === true,
  };
}

/* 模型调用（支持完整 messages 数组）—— 统一走 aiProvider，
   自动挑选可用提供方、识别占位符 key、把上游错误说得能定位 */
async function callDeepSeekMessages(messages, temperature = 0.8, maxTokens = 1200, jsonMode = false) {
  return chatCompletion(messages, {
    temperature,
    maxTokens,
    jsonMode,
    timeoutMs: TIMEOUT_MS,
  });
}

/* ============================================================
   单轮对话调用（OpenAI 兼容 chat completions）
============================================================ */

async function callDeepSeek(systemPrompt, userMessage) {
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.7, maxTokens: 1200, timeoutMs: TIMEOUT_MS }
  );
}

/* ============================================================
   GET /api/ai/status
   所有 AI 服务的配置自检（不返回任何密钥，只报「配没配 / 用哪个模型」）。
   ?probe=1 会真实发一次极小请求，验证上游能不能连通。
   前端「AI 服务状态」面板与运维排查都用这个。
============================================================ */

router.get("/status", async (req, res) => {
  try {
    const wantProbe = ["1", "true", "yes"].includes(
      String(req.query.probe || "").toLowerCase()
    );
    const status = wantProbe ? await probeAiServices() : aiServicesStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: "AI 服务自检失败",
      message: err?.message || String(err),
    });
  }
});

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

    if (!resolveChatProvider()) {
      return res.status(503).json({
        error: "AI 老师未配置",
        message:
          "AI 服务未配置：请设置 DEEPSEEK_API_KEY（或 AI_PROVIDER=agnes + AGNES_API_KEY）。",
        ai: aiServicesStatus().chat,
      });
    }

    // ── 免费对话配额：非 VIP 每日限 N 次，VIP 无限 ──
    const vipUser = await getVipUser(req.userId);
    const isVip = isVipActive(vipUser);
    if (!isVip && action !== "recommend") {
      const used = await getChatUsage(req.userId);
      const freeChatDaily = await getFreeChatDaily();
      if (used >= freeChatDaily) {
        /* 每日免费额度用尽提醒（同 key 去重：更新原通知而非堆积） */
        createNotification({
          userId: req.userId,
          type: "额度提醒",
          title: "今日 AI 老师免费次数已用完",
          content: `今日免费对话 ${freeChatDaily} 次已用完，开通 VIP 即可无限与 AI 老师对话`,
          icon: "🧑‍🏫",
          action: "ai-teacher-quota-exhausted",
          key: "ai-teacher-quota-exhausted",
        });
        return res.status(429).json({
          message: `今日免费对话次数已用完（${freeChatDaily} 次），开通 VIP 即可无限练习`,
          used,
          limit: freeChatDaily,
          limitExceeded: true,
        });
      }
    }

    // ── plan：按学生画像 + 记忆生成个性化今日学习计划（轻量免费，不消耗配额）──
    if (action === "plan") {
      const frontProfile = req.body?.profile || {};
      const placement = await getUserProfile(req.userId);
      const profile = mergeProfileForPrompt(frontProfile, placement);
      const memory = (await loadAiMemory(req.userId)).legacy;
      const systemPrompt = [
        buildPlanSystemPrompt(profile, memory),
        buildLearnerGuidance(placement),
      ]
        .filter(Boolean)
        .join("\n\n");
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请为我生成一份今日学习计划。" },
      ];

      let raw = null;
      let plan = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          raw = await callDeepSeekMessages(messages, attempt === 0 ? 0.7 : 0.4, 1400, true);
          plan = parsePlanJson(raw);
          break;
        } catch (attemptErr) {
          if (attempt === 1) throw attemptErr;
        }
      }
      if (!plan || !plan.tasks || plan.tasks.length === 0) {
        throw new Error("AI 未返回有效学习计划");
      }
      return res.json({ success: true, plan });
    }

    // ── recommend：根据学生画像定制推荐课程与练习（轻量免费，不消耗配额）──
    if (action === "recommend") {
      const frontProfile = req.body?.profile || {};
      const placement = await getUserProfile(req.userId);
      const profile = mergeProfileForPrompt(frontProfile, placement);
      const memory = (await loadAiMemory(req.userId)).legacy;
      const systemPrompt = [
        buildRecommendSystemPrompt(profile, memory),
        buildLearnerGuidance(placement),
      ]
        .filter(Boolean)
        .join("\n\n");
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请为我生成一份定制课程。" },
      ];

      let raw = null;
      let rec = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          raw = await callDeepSeekMessages(messages, attempt === 0 ? 0.7 : 0.4, 1600, true);
          rec = parseRecommendJson(raw);
          break;
        } catch (attemptErr) {
          if (attempt === 1) throw attemptErr;
        }
      }
      if (!rec) throw new Error("AI 未返回有效推荐内容");

      return res.json({ success: true, recommend: rec });
    }

    // ── conversation：场景化自由对话（结构化 JSON 输出）──
    if (action === "conversation") {
      const scene = req.body?.scene || {};
      const stage = req.body?.stage || {};
      const history = Array.isArray(req.body?.history)
        ? req.body.history.slice(-8)
        : [];

      /* 入学画像 → 对话难度与纠错重点（老师只说学生等级内的话） */
      const placement = await getUserProfile(req.userId);
      const systemPrompt = [
        buildConversationSystemPrompt(scene, stage),
        buildLearnerGuidance(placement),
      ]
        .filter(Boolean)
        .join("\n\n");
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({
          role: h?.role === "user" ? "user" : "assistant",
          content: String(h?.content || "").slice(0, 500),
        })),
        { role: "user", content: message },
      ];

      // json_object 模式强制 JSON 输出；模型偶发网络抖动/非 JSON 时重试一次
      let raw = null;
      let parsed = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          raw = await callDeepSeekMessages(messages, attempt === 0 ? 0.8 : 0.4, 1000, true);
          parsed = parseJsonResponse(raw);
          break;
        } catch (attemptErr) {
          if (attempt === 1) throw attemptErr;
        }
      }

      // 兜底：极端情况下仍无 JSON，把原始回复作为泰语文本包装（保证对话不中断）
      if (!parsed || !parsed.thai) {
        if (raw && raw.trim().length > 0) {
          parsed = {
            thai: raw.trim().slice(0, 300),
            roman: "",
            chinese: "",
            vocab: [],
            grammar: "",
            culturalNote: "",
            nextStage: false,
          };
        } else {
          throw new Error("AI 未返回有效泰语回复");
        }
      }

      // 成功才扣减
      if (!isVip) {
        await incrementChatUsage(req.userId).catch(() => {});
      }

      return res.json({ success: true, ...parsed });
    }

    // ── context：Thai Context Intelligence（Explain Like Thai / Make It Natural / Explain the Culture）
    if (action === "context") {
      const profile = req.body?.profile || {};
      const options = {
        task: req.body?.task,
        tone: req.body?.tone,
        persona: req.body?.persona,
      };
      const history = Array.isArray(req.body?.history)
        ? req.body.history.slice(-12)
        : [];
      const memory = await loadAiMemory(req.userId);

      const systemPrompt = `${buildContextSystemPrompt(options)}\n\n学生画像：${JSON.stringify(
        profile
      )}${memory.prompt ? `\n\n${memory.prompt}` : ""}`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({
          role: h?.role === "user" ? "user" : "assistant",
          content: String(h?.content || "").slice(0, 500),
        })),
        { role: "user", content: message },
      ];

      const response = await callDeepSeekMessages(messages, 0.7, 1400);

      // 成功返回才扣减（超时/失败不浪费用户次数）
      if (!isVip) {
        await incrementChatUsage(req.userId).catch(() => {});
      }

      return res.json({ success: true, response });
    }

    // ── chat / pronunciation / speaking：注入学生画像 + 长期记忆 + 多轮历史 ──
    const frontProfile = req.body?.profile || {};
    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-12)
      : [];

    /* 入学测评画像（后端 SQLite）+ 前端运行时画像合并：等级/场景/方式以后端为准 */
    const placement = await getUserProfile(req.userId);
    const profile = mergeProfileForPrompt(frontProfile, placement);
    // 分类长期记忆（顺带把入学画像同步进来）→ 注入 system prompt
    const memory = await loadAiMemory(req.userId);
    const systemPrompt = buildTeacherSystemPrompt(
      action,
      profile,
      memory,
      buildLearnerGuidance(placement)
    );

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h?.role === "user" ? "user" : "assistant",
        content: String(h?.content || "").slice(0, 1000),
      })),
      { role: "user", content: message },
    ];

    const response = await callDeepSeekMessages(messages, 0.7, 1200);

    // 成功返回才扣减（超时/失败不浪费用户次数）
    if (!isVip) {
      await incrementChatUsage(req.userId).catch(() => {});
    }

    // 每 5 轮对话后异步总结并更新学生长期记忆（不阻塞回复）
    const userMsgCount =
      history.filter((h) => h?.role === "user").length + 1;
    if (userMsgCount >= 5 && userMsgCount % 5 === 0) {
      summarizeAndSaveMemory(
        req.userId,
        [
          ...history.map((h) => ({
            role: h?.role === "user" ? "user" : "assistant",
            content: String(h?.content || ""),
          })),
          { role: "user", content: message },
        ]
      ).catch(() => {});
    }

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

/* ============================================================
   GET /api/ai/teacher/memory
   分类长期记忆（「老师记得你」面板）

   返回：
     items    分类条目 [{ id, type, content, importance, source, hits, ... }]
     groups   按类型分组（前端直接渲染）
     memory   旧版扁平结构（向后兼容老组件）
     summary  一句话摘要
     顺便把入学测试画像同步成记忆（幂等，测试刚做完就生效）
============================================================ */

router.get("/teacher/memory", authenticate, async (req, res) => {
  try {
    const memory = await loadAiMemory(req.userId);
    res.json({
      success: true,
      memory: memory.legacy,
      items: memory.items,
      groups: memory.grouped,
      hasMemory: memory.hasMemory,
      summary: memory.summary,
    });
  } catch (error) {
    console.error("[aiTeacher] memory error:", error);
    res.status(500).json({ message: "查询记忆失败" });
  }
});

/* ============================================================
   POST /api/ai/teacher/memory/items
   新增/更新一条分类记忆（用户直接告诉老师要记住的事）
   body: { type, content, importance? }
============================================================ */

router.post("/teacher/memory/items", authenticate, async (req, res) => {
  try {
    const type = String(req.body?.type || "").trim();
    const content = String(req.body?.content || "").trim();

    if (!content) {
      return res.status(400).json({ message: "请填写要记住的内容" });
    }

    const item = await upsertMemoryItem(req.userId, {
      type,
      content,
      // 没指定重要度时用手写默认值（与旧表单保存同一张表），
      // 否则会落到该类型的 AI 默认值（goal 会被压低一档）。
      importance: req.body?.importance ?? MANUAL_IMPORTANCE[type],
      source: "manual",
    });

    if (!item) {
      return res.status(400).json({ message: "记忆类型无效或内容为空" });
    }

    const items = await listMemoryItems(req.userId);
    res.json({
      success: true,
      item,
      items,
      groups: groupMemoryItems(items),
      summary: memorySummary(items),
      hasMemory: items.length > 0,
      memory: toLegacyMemory(items),
    });
  } catch (error) {
    console.error("[aiTeacher] 新增记忆失败:", error);
    res.status(500).json({ message: "保存记忆失败" });
  }
});

/* ============================================================
   DELETE /api/ai/teacher/memory/items/:id
   删除一条记忆（用户觉得记错了/不该记）
============================================================ */

router.delete("/teacher/memory/items/:id", authenticate, async (req, res) => {
  try {
    const removed = await deleteMemoryItem(req.userId, req.params.id);
    const items = await listMemoryItems(req.userId);
    res.json({
      success: true,
      removed,
      items,
      groups: groupMemoryItems(items),
      summary: memorySummary(items),
      hasMemory: items.length > 0,
      memory: toLegacyMemory(items),
    });
  } catch (error) {
    console.error("[aiTeacher] 删除记忆失败:", error);
    res.status(500).json({ message: "删除记忆失败" });
  }
});

/* ============================================================
   PUT /api/ai/teacher/memory
   用户手动修正 AI 老师记住的学生画像（个人中心查看/编辑）
   body: { memory: { studentName?, genderHint?, level?, interests?, goals?, mistakes?, preferences? } }
   - 只更新传进来的字段；数组按 ,/，/、 拆分
   - 传空字符串 / 空数组 → 清空该项
============================================================ */

router.put("/teacher/memory", authenticate, async (req, res) => {
  try {
    const update =
      req.body?.memory && typeof req.body.memory === "object"
        ? req.body.memory
        : {};
    const current = (await getAiMemory(req.userId)) || {};

    const clean = {};

    const scalar = ["studentName", "genderHint"];
    for (const key of scalar) {
      if (key in update) {
        clean[key] = String(update[key] ?? "").trim() || null;
      }
    }

    if ("level" in update) {
      clean.level = ["beginner", "elementary", "intermediate", "advanced"].includes(
        String(update.level)
      )
        ? String(update.level)
        : null;
    }

    const arrays = ["interests", "goals", "mistakes", "preferences"];
    for (const key of arrays) {
      if (key in update) {
        const raw = Array.isArray(update[key])
          ? update[key]
          : String(update[key] ?? "").split(/[，,、]/);
        clean[key] = raw
          .map((v) => String(v).trim())
          .filter(Boolean)
          .slice(0, 10);
      }
    }

    const merged = { ...current, ...clean };

    // 去掉空值：允许用户“清空”某项
    const final = {};
    for (const key of Object.keys(merged)) {
      const v = merged[key];
      if (v == null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      final[key] = v;
    }

    /* 只替换「本次表单真正提交过的类型」——没改的类型保持原样 */
    const touchedTypes = new Set();
    for (const key of Object.keys(update)) {
      const type = FIELD_TO_TYPE[key];
      if (type) touchedTypes.add(type);
    }

    const memory = await saveAiMemory(
      req.userId,
      final,
      touchedTypes.size ? touchedTypes : null
    );
    const items = await listMemoryItems(req.userId);

    res.json({
      success: true,
      memory,
      items,
      groups: groupMemoryItems(items),
      summary: memorySummary(items),
      hasMemory: items.length > 0,
    });
  } catch (error) {
    console.error("[aiTeacher] 保存记忆失败:", error);
    res.status(500).json({ message: "保存记忆失败" });
  }
});

/* ============================================================
   GET /api/ai/teacher/quota
   今日 AI 老师免费对话额度
============================================================ */

router.get("/teacher/quota", authenticate, async (req, res) => {
  try {
    res.json(await quotaPayload(req.userId));
  } catch (error) {
    console.error("[aiTeacher] quota error:", error);
    res.status(500).json({ message: "查询额度失败" });
  }
});

export default router;
