// src/lib/learningPath.js
//
// =========================================================
// AI Learning Path Engine
// =========================================================
//
// 输入：学习画像（等级 / 目标 / 专业方向 / 兴趣媒体 / 学习方式）
// 输出：一条只属于这个用户的分阶段学习路线
//
//   等级 A2 + 目标「泰国留学」+ 兴趣「泰剧」
//     → 基础泰语精读 → 校园交流 → 泰剧精听 → 泰国文化 → 学术泰语
//
//    等级 A0 + 目标「商务工作」
//     → 拼读地基 → 基础泰语精读 → 商务泰语 → 商务口语输出
//
// 设计要点：
//  1. 阶段模板池（STAGE_LIBRARY）+ 规则装配（assembleStages），
//     不是所有用户走同一条线；不同画像的主题阶段不同。
//  2. 每个阶段「连现有课程系统」：能对上课程的就带 courseId（用真实课程标题 /
//     课时数 / 时长），课程还没上线的阶段同时给出「现在就能做」的动作入口，
//     所以路线今天就可执行，不需要等视频。
//  3. 进度、当前阶段、剩余时间都从真实数据算：
//     - 课程阶段读 courseProgress（课时完成 → 进度百分比）
//     - 剩余天数 = 剩余课时 × 单节时长 ÷ 画像每日可投入分钟数
//  4. 无画像 → 返回 null，页面自行降级（不猜、不给假路线）。
//
// 不改动任何 course 数据：只读 courses / getCourseLessons，
// 课程状态（coming / learning）照样透传，前端据此标「制作中」。
// =========================================================

import { courses, getCourseById, getCourseLessons } from "@/data/courses";
import { getTrackById } from "@/data/professionalTracks";
import { getCourseCertificate, getCourseStats } from "@/lib/courseProgress";
import { getSelectedTracks } from "@/lib/professionalTracks";
import {
  getLevelMeta,
  goalEmoji,
  goalTitle,
  optionById,
  recommendBooks,
  styleSkills,
} from "@/lib/placement";
import { recommendCourses } from "@/lib/profileDriven";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* =========================================================
   一、阶段模板池
   =========================================================
   每个阶段：
     id        阶段标识（稳定，可用于埋点 / 完成记录）
     title     阶段名（有课程时用课程标题，保证与课程页一致）
     desc      这个阶段干什么
     courseId  关联课程（null = 纯练习阶段）
     to / cta  现在就能执行的入口（不依赖课程是否上线）
     hours     预计投入小时数（课程优先用课程 duration，其次按课时估）
     match     命中画像时的说明（why：goal / direction / media / level）
========================================================= */

const STAGE_LIBRARY = {
  /* ---- 固定打底阶段 ---- */

  script: {
    id: "script",
    title: "拼读地基：字母与声调",
    desc: "中高低辅音、元音位置、五个声调规则。零基础先把「读得准」拿到手，后面背词会快一倍。",
    courseId: "thai-spelling",
    to: "/alphabet",
    cta: "进入字母表",
    hours: 6,
  },

  core: {
    id: "core",
    title: "基础泰语精读 14 课",
    desc: "每课「听音频 → 跟读 → 中泰对照 → 课后练习」，学完点亮一节点，两周搭起语法骨架。",
    courseId: "thai-basic-reader",
    to: "/course/thai-basic-reader",
    cta: "开始第 1 课",
    hours: 12,
  },

  /* ---- 目标（learningGoal）驱动 ---- */

  campus: {
    id: "campus",
    title: "校园交流",
    desc: "选课、问路、小组讨论、跟老师请假：把留学/交换每天要用的句子练成条件反射。",
    courseId: "thai-conversation",
    to: "/lesson/lesson-6",
    cta: "练校园场景",
    hours: 8,
  },

  travel: {
    id: "travel",
    title: "旅行实战泰语",
    desc: "机场、酒店、点餐、购物、问路五大场景，配合泰语旅游沟通课逐场景过关。",
    courseId: "thai-tourism",
    to: "/conversation",
    cta: "找 AI 老师演练",
    hours: 8,
  },

  business: {
    id: "business",
    title: "商务泰语",
    desc: "会议、报价、邮件跟进、谈判用语，先补商务词汇再上场景演练。",
    courseId: "thai-business",
    to: "/vocabulary?book=vocab-经济泰语",
    cta: "刷商务词汇",
    hours: 10,
  },

  academic: {
    id: "academic",
    title: "学术泰语",
    desc: "书面语、长句结构、复句连接词与论文常用表达，配合进阶语法课与本地语料精听。",
    courseId: "thai-grammar-advanced",
    to: "/corpus",
    cta: "进入语料库",
    hours: 10,
  },

  /* ---- 专业方向（Thai Professional Hub 选择驱动）---- */

  tourism: {
    id: "tourism",
    title: "旅游服务泰语",
    desc: "酒店、餐厅、导游、客户交流四个板块：服务场景敬语与实际状况处理，练完直接能用在对客沟通里。",
    courseId: "thai-tourism",
    to: "/professional",
    cta: "打开旅游服务板块",
    hours: 9,
  },

  newmedia: {
    id: "newmedia",
    title: "新媒体泰语",
    desc: "社交平台表达、网络流行语、内容创作三个板块：学会泰网的真实说法，写得出会上头的文案。",
    courseId: "thai-listening",
    to: "/professional",
    cta: "打开新媒体板块",
    hours: 8,
  },

  /* ---- 兴趣媒体（mediaInterest）驱动 ---- */

  drama: {
    id: "drama",
    title: "泰剧精听",
    desc: "挑一段台词做逐句精听 + 跟读，抓口语化表达、语气词和连读；台词比课本更接近真实语速。",
    courseId: "thai-listening",
    to: "/corpus/listening",
    cta: "现在精听一段",
    hours: 8,
  },

  screen: {
    id: "screen",
    title: "影视综艺精听",
    desc: "用电影与综艺片段练「听懂大意 → 抓细节」，重点是不同说话人的口音与语速。",
    courseId: "thai-listening",
    to: "/corpus/listening",
    cta: "现在精听一段",
    hours: 8,
  },

  song: {
    id: "song",
    title: "泰语歌曲跟唱",
    desc: "一首歌拆成 10 个高频表达，跟唱练语调与节奏，歌词是最好的声调训练材料。",
    courseId: null,
    to: "/corpus",
    cta: "打开语料库",
    hours: 5,
  },

  news: {
    id: "news",
    title: "新闻泰语",
    desc: "从标题到导语逐层读新闻，积累书面表达与时政词汇，同步练快语速听力。",
    courseId: "thai-news",
    to: "/corpus/read",
    cta: "读一篇新闻",
    hours: 10,
  },

  tiktok: {
    id: "tiktok",
    title: "短视频真语速",
    desc: "1~2 分钟的短视频信息密度高、语速快，适合练「抓关键词」的听力策略。",
    courseId: "thai-listening",
    to: "/corpus/listening",
    cta: "现在精听一段",
    hours: 6,
  },

  food: {
    id: "food",
    title: "美食泰语",
    desc: "菜单、点单、口味描述、街头小吃词汇一次打包，边点单边练口语。",
    courseId: null,
    to: "/vocabulary?book=vocab-食物泰语",
    cta: "刷美食词汇",
    hours: 5,
  },

  reading: {
    id: "reading",
    title: "泰语长文精读",
    desc: "小说与长篇文本精读，练长句拆解与文学化表达，配合生词本沉淀词汇。",
    courseId: null,
    to: "/lessons",
    cta: "精读一篇课文",
    hours: 6,
  },

  /* ---- 通用与收尾 ---- */

  culture: {
    id: "culture",
    title: "泰国文化与语言",
    desc: "节日、礼仪、称呼与社交潜规则。很多泰语表达只有放进文化里才说得得体。",
    courseId: "thai-culture",
    to: "/culture",
    cta: "读文化短文",
    hours: 6,
  },

  output: {
    id: "output",
    title: "口语输出打磨",
    desc: "把学过的东西说出来：录音 → 音素级评测 → 重录，再和 AI 老师做整段对话。",
    courseId: null,
    to: "/speaking-practice",
    cta: "开始练口语",
    hours: 8,
  },
};

/* =========================================================
   二、画像 → 主题阶段（差异化核心）
   =========================================================
   优先级：学习目标 > 兴趣媒体 > 专业方向
   （先解决「为什么学」，再用兴趣维持动力，最后才是专业化）

   每条规则：[阶段 id, 命中字段, 命中值]
========================================================= */

const GOAL_RULES = {
  major: [], // 泰语专业：专业化阶段放在收尾（见 GOAL_TAIL_RULES）
  travel: ["travel"],
  business: ["business"],
  study: ["campus"],
  drama: ["drama"],
  music: ["song"],
  culture: ["culture"],
};

/* 目标决定「路线收尾阶段」（放在主题与兴趣之后，作为专业化终点） */
const GOAL_TAIL_RULES = {
  major: ["academic"],
  study: ["academic"],
};

const MEDIA_RULES = {
  drama: ["drama"],
  movie: ["screen"],
  variety: ["screen"],
  song: ["song"],
  news: ["news"],
  tiktok: ["tiktok"],
  novel: ["reading"],
  food: ["food"],
  travel: ["travel"],
};

const DIRECTION_RULES = {
  business: ["business"],
  academic: ["academic"],
  tourism: ["tourism"],
  news: ["news"],
  newmedia: ["newmedia"],
};

/*
  Thai Professional Hub 里主动选中的方向 → 路线阶段。
  与 DIRECTION_RULES（入学测试画像）分开：
    - 画像方向是「测试推出来的」，只是建议；
    - Hub 选择是用户明确表态的，必须真的进入路线（不参与主题数量淘汰）。
*/
const TRACK_STAGE_RULES = {
  business: "business",
  academic: "academic",
  tourism: "tourism",
  news: "news",
  newmedia: "newmedia",
};

/**
 * 用户主动选择（或画像推导）的专业方向 id 列表。
 * 顺序：Professional Hub 的选择优先，其次是入学测试的专业方向。
 * 两者都只是 id，去重后限定在 TRACK_STAGE_RULES 支持的方向里。
 */
export function getProfessionalTrackIds(profile) {
  let local = [];

  try {
    local = getSelectedTracks();
  } catch (error) {
    local = [];
  }

  const fromProfile = Array.isArray(profile?.professionalDirection)
    ? profile.professionalDirection
    : [];

  return [...new Set([...local, ...fromProfile])].filter(
    (id) => !!TRACK_STAGE_RULES[id]
  );
}

/**
 * 装配阶段列表（内部的差异化逻辑，导出仅为便于测试）。
 * 返回 [{ template, why, source }]
 */
export function assembleStages(profile) {
  const level = getLevelMeta(profile?.thaiLevel);
  const isBeginner = ["A0", "A1"].includes(level.id);
  const detail = profile?.testDetail || {};
  const sectionScores = detail.sectionScores || {};

  /* 命中清单：按 目标 → 媒体 → 方向 排，附「为什么」文案 */
  const hits = [];

  const goal = profile?.learningGoal;
  if (goal && GOAL_RULES[goal]) {
    hits.push({
      stages: GOAL_RULES[goal],
      why: `目标：${goalTitle(goal) || goal}`,
      source: "goal",
    });
  }

  for (const mediaId of profile?.mediaInterest || []) {
    if (!MEDIA_RULES[mediaId]) continue;
    hits.push({
      stages: MEDIA_RULES[mediaId],
      why: `兴趣：${optionById(mediaId, "media")?.title || mediaId}`,
      source: "media",
    });
  }

  for (const directionId of profile?.professionalDirection || []) {
    if (!DIRECTION_RULES[directionId]) continue;
    hits.push({
      stages: DIRECTION_RULES[directionId],
      why: `专业方向：${optionById(directionId, "directions")?.title || directionId}`,
      source: "direction",
    });
  }

  const picked = [];
  const seenStages = new Set();
  /* 同一门课只进路线一次（多个兴趣可能指向同一门课，避免重复阶段） */
  const seenCourses = new Set();

  const take = (stageId, why, source = "auto") => {
    const template = STAGE_LIBRARY[stageId];
    if (!template || seenStages.has(stageId)) return;

    if (template.courseId) {
      if (seenCourses.has(template.courseId)) return;
      seenCourses.add(template.courseId);
    }

    seenStages.add(stageId);
    picked.push({ template, why, source });
  };

  /* ① 打底：零基础先过拼读；A0/A1 或拼读板块明显薄弱的也补 */
  const scriptWeak =
    (sectionScores.letters?.total
      ? sectionScores.letters.correct / sectionScores.letters.total
      : 1) < 0.6 ||
    (sectionScores.tones?.total
      ? sectionScores.tones.correct / sectionScores.tones.total
      : 1) < 0.6;

  if (isBeginner || scriptWeak) take("script", "零基础先过拼读关");

  /* ② 主线永远是基础精读课（唯一已上线的真实课程） */
  take("core", "");

  /* ②′ 专业方向：用户在 Thai Professional Hub 主动选择的，必须真的进路线，
        不参与后面的主题数量淘汰（否则「选了方向却没进路线」） */
  for (const trackId of getProfessionalTrackIds(profile)) {
    const stageId = TRACK_STAGE_RULES[trackId];
    if (!stageId) continue;
    const track = getTrackById(trackId);
    take(
      stageId,
      `专业方向：${track?.title || trackId}（你在专业 Hub 的选择）`,
      "track"
    );
  }

  /* ③ 主题阶段：按「目标 → 兴趣 → 专业方向」顺序取，最多再补 2 个
        （前两个阶段负责差异化，后面留给通用结构阶段） */
  const themeBudget = picked.length + 2;

  for (const hit of hits) {
    if (picked.length >= themeBudget) break;
    for (const stageId of hit.stages) {
      if (picked.length >= themeBudget) break;
      if (stageId === "core") continue; // core 已在 ② 占位
      take(stageId, hit.why);
    }
  }

  /* ④ 结构补齐：阶段太少（冷门组合，如只选了「综艺」）时补文化阶段，
        保证路线有 4 个阶段、节奏完整 */
  if (picked.length < 4) take("culture", "语言背后的文化底色");

  /* ⑤ 目标收尾阶段（留学/专业 → 学术泰语）放最后，作为专业化终点 */
  for (const stageId of GOAL_TAIL_RULES[goal] || []) {
    if (picked.length >= 5) break;
    take(stageId, `目标：${goalTitle(goal) || goal}`);
  }

  /* ⑥ 还有位置就补口语输出 */
  if (picked.length < 5) take("output", "");

  return picked.slice(0, 5);
}

/* =========================================================
   三、阶段完成状态
   =========================================================
   两种来源：
     1) 能对上真实课时的课程阶段 → 读 courseProgress（自动，最准）
     2) 还没有课时数据的阶段（课程制作中/纯练习阶段）→ 用户手动标记完成
        （否则这类阶段会永远停在「待开始」，路线走不下去）

   手动标记缓存在 localStorage，登录后仍以本地为准（后端暂无阶段级字段）。
========================================================= */

const PATH_STATE_KEY = "thai_ai_learning_path_v1";

function readPathState() {
  try {
    const raw = localStorage.getItem(PATH_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      done: parsed?.done && typeof parsed.done === "object" ? parsed.done : {},
      updatedAt: parsed?.updatedAt || null,
    };
  } catch (error) {
    return { done: {}, updatedAt: null };
  }
}

function writePathState(state) {
  try {
    localStorage.setItem(PATH_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    /* 隐私模式等场景下静默失败：路线主流程仍可用 */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PATH_STATE_CHANGE_EVENT));
  }
}

/** 阶段完成状态变更事件（卡片订阅后自动刷新） */
export const PATH_STATE_CHANGE_EVENT = "thai-ai-learning-path-change";

/** 手动标记某阶段完成（课程阶段也可用，作为「已经会了」的快捷方式） */
export function markStageComplete(stageId) {
  if (!stageId) return;
  const state = readPathState();
  state.done[stageId] = new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  writePathState(state);
}

/** 撤销手动标记 */
export function unmarkStageComplete(stageId) {
  if (!stageId) return;
  const state = readPathState();
  delete state.done[stageId];
  state.updatedAt = new Date().toISOString();
  writePathState(state);
}

/** 清空全部手动标记（重做入学测试时可用） */
export function resetPathState() {
  writePathState({ done: {}, updatedAt: new Date().toISOString() });
}

/** 阶段是否已被手动标记完成 */
export function isStageManuallyDone(stageId) {
  return !!readPathState().done[stageId];
}

/* =========================================================
   四、阶段 → 课程数据 / 进度 / 时长
========================================================= */

/** 从课程 duration 文案（"约 3 小时"）解析小时数，失败返回 null */
function parseCourseHours(course) {
  const text = String(course?.duration || "");
  const match = text.match(/([\d.]+)\s*小时/);
  if (match) return Number(match[1]);

  const minutes = text.match(/([\d.]+)\s*分钟/);
  if (minutes) return Number(minutes[1]) / 60;

  return null;
}

/** 阶段预计投入小时：优先课程真实时长，其次按课时估，最后用模板值 */
function estimateHours(template, course, lessonCount) {
  const fromCourse = parseCourseHours(course);
  if (fromCourse) return fromCourse;

  if (lessonCount > 0) return Math.max(2, Math.round(lessonCount * 0.6 * 10) / 10);

  return template.hours || 5;
}

/**
 * 读取一个阶段的进度。
 *   课程阶段：courseProgress（课时完成 → 百分比）
 *   练习阶段 / 课程未上线：只能靠手动标记
 * measurable=false 表示这个阶段无法被系统自动量化（UI 会给出手动标记入口）
 */
function readStageProgress(template) {
  const manual = isStageManuallyDone(template.id);

  if (!template.courseId) {
    return {
      progress: manual ? 100 : 0,
      completedCount: 0,
      lessonCount: 0,
      done: manual,
      manual,
      measurable: false,
    };
  }

  const course = getCourseById(template.courseId);
  const lessons = getCourseLessons(template.courseId) || [];
  const stats = getCourseStats(template.courseId, lessons);
  const certificate = getCourseCertificate(template.courseId);

  /* 只有「已上线且真有课时」的课程才能被自动量化；
     制作中的课程即使有占位课时（旧版 flower.mp4 占位），也不拿它的进度当真 */
  const published = !!course && course.status !== "coming";
  const measurable = published && lessons.length > 0;

  const autoDone = !!certificate || (measurable && stats.progressPercent >= 100);

  return {
    progress: manual ? 100 : measurable ? stats.progressPercent : 0,
    completedCount: measurable ? stats.completedCount : 0,
    lessonCount: measurable ? lessons.length : 0,
    done: manual || autoDone,
    manual,
    measurable,
    lastLessonId: stats.lastLessonId,
  };
}

/* =========================================================
   五、主入口
========================================================= */

/**
 * 生成个人学习路线。
 *
 * @param {object|null} profile 学习画像（normalizeProfile 后的形状）
 * @returns {object|null} 无画像时返回 null（调用方自行降级）
 */
export function generateLearningPath(profile) {
  if (!profile?.thaiLevel) return null;

  const level = getLevelMeta(profile.thaiLevel);
  const assembled = assembleStages(profile);
  const minutesPerDay = Math.max(5, level.minutesPerDay || 15);

  /* ---- 1) 逐个阶段补课程信息、进度、时长 ---- */
  let cursorDay = 0;

  const stages = assembled.map(({ template, why, source }, index) => {
    const course = template.courseId ? getCourseById(template.courseId) : null;
    const progressInfo = readStageProgress(template);

    /* 专业方向阶段把内容板块一并带出来，卡片可直接展示「这个阶段含哪几个板块」 */
    const track = source === "track" ? getTrackById(template.id) : null;

    const hours = estimateHours(template, course, progressInfo.lessonCount);
    const remainingHours = Math.max(0, hours * (1 - progressInfo.progress / 100));
    const estDays = progressInfo.done
      ? 0
      : Math.max(1, Math.ceil((remainingHours * 60) / minutesPerDay));

    const dayFrom = cursorDay + 1;
    const dayTo = cursorDay + estDays;
    cursorDay = dayTo;

    return {
      /* 与课程系统对齐的字段 */
      id: template.id,
      // 阶段名用「学习目标」的说法（校园交流 / 泰剧精听），
      // 具体上课用的是哪个课程由 courseTitle 承载
      title: template.title,
      courseTitle: course?.title || null,
      courseId: template.courseId || null,
      courseStatus: course?.status || null,
      available: course ? course.status !== "coming" : true,
      isVip: course?.isVip ?? false,
      category: course?.category || null,
      lessonCount: progressInfo.lessonCount,

      /* 展示与执行 */
      desc: template.desc,
      to: template.to,
      cta: template.cta,
      why: why || "",
      source: source || "auto",
      trackEmoji: track?.emoji || null,
      modules: track
        ? track.modules.map((module) => ({
            id: module.id,
            title: module.title,
            level: module.level || null,
            lessons: Number(module.lessons) || 0,
            entry: module.entry,
            entryLabel: module.entryLabel,
          }))
        : [],

      /* 进度与时间 */
      progress: progressInfo.progress,
      completedCount: progressInfo.completedCount,
      done: progressInfo.done,
      measurable: progressInfo.measurable,
      manual: progressInfo.manual,
      hours,
      estDays,
      window: estDays > 0 ? `第 ${dayFrom}~${dayTo} 天` : "已完成",
      index,
    };
  });

  /* ---- 2) 当前 / 下一阶段 ---- */
  const currentIndex = stages.findIndex((stage) => !stage.done);
  const current = currentIndex >= 0 ? stages[currentIndex] : null;
  const next = currentIndex >= 0 ? stages[currentIndex + 1] || null : null;

  /* ---- 3) 剩余时间与预计完成 ---- */
  const totalDays = stages.reduce((sum, stage) => sum + stage.estDays, 0);
  const doneCount = stages.filter((stage) => stage.done).length;

  const eta =
    totalDays > 0
      ? new Date(Date.now() + totalDays * MS_PER_DAY)
      : null;

  const etaLabel = eta
    ? totalDays >= 14
      ? `约 ${Math.max(1, Math.round(totalDays / 7))} 周 · 预计 ${eta.getMonth() + 1} 月 ${eta.getDate()} 日`
      : `约 ${totalDays} 天 · 预计 ${eta.getMonth() + 1} 月 ${eta.getDate()} 日`
    : "已完成全部阶段";

  /* ---- 4) 推荐课程（复用画像排序，保证与首页推荐一致） ---- */
  const recommendedCourses = recommendCourses(profile, courses, 3);

  return {
    level,
    goal: goalTitle(profile.learningGoal),
    goalEmoji: goalEmoji(profile.learningGoal),
    scenario: profile.targetScenario || "",

    stages,
    current,
    next,

    doneCount,
    stageCount: stages.length,
    progressPercent: stages.length
      ? Math.round((doneCount / stages.length) * 100)
      : 0,

    totalDays,
    eta,
    etaLabel,

    daily: {
      words: level.wordsPerDay,
      minutes: level.minutesPerDay,
      focus: level.focus,
    },

    books: recommendBooks(profile).map((book) => ({
      id: book.id,
      name: book.name,
      emoji: book.emoji,
      count: book.count,
    })),

    skills: styleSkills(profile.learningStyle),
    recommendedCourses,

    /* 已并入路线的专业方向（Thai Professional Hub 的选择） */
    professionalTracks: getProfessionalTrackIds(profile)
      .map((id) => getTrackById(id))
      .filter(Boolean)
      .map((track) => ({
        id: track.id,
        title: track.title,
        emoji: track.emoji,
        tagline: track.tagline,
        moduleCount: track.modules.length,
        stageId: TRACK_STAGE_RULES[track.id] || null,
      })),
  };
}

/**
 * 阶段进度徽标文案（页面直接用，避免各处重复判断）。
 */
export function stageStatusLabel(stage) {
  if (!stage) return "";
  if (stage.manual) return "已标记完成";
  if (stage.done) return "已完成";
  if (stage.progress > 0) return `进行中 ${stage.progress}%`;
  return "待开始";
}

export { STAGE_LIBRARY };
