// backend/learnerProfile.js
//
// ============================================================
// 学习画像 → AI 老师的教学指令
// ============================================================
//
// 画像来源：user_profiles 表（AI 入学测试产物，见 routes/profile.js）。
// 之前 AI 老师只拿到前端顺手传的 { name, level: "Level 3", streak, mastered }，
// 缺三样最关键的信息：真实泰语等级（A0~C1）、目标场景、学习方式偏好。
//
// 本模块负责：
//   1. getUserProfile(userId)        —— 从 SQLite 读画像（无表/无行/出错都安全返回 null）
//   2. buildLearnerGuidance(profile) —— 把画像翻译成给 DeepSeek 的教学指令块：
//        · 等级      → 回复的泰语难度上限、可用的词汇/句型范围
//        · 目标场景  → 例句和对话往哪里倾斜
//        · 纠错重点  → 按等级该抓什么错（声调/拼写/句型/书面语），不该抓什么
//        · 学习方式  → 回复侧重听力/口语/阅读/视觉讲解
//        · 兴趣媒体  → 举例素材来源（泰剧/新闻/歌曲…）
//   3. quizDifficultyFor(level)      —— 词汇测验的默认难度档
//
// 所有函数都宽容降级：画像缺失 → 返回空串/中性值，行为与旧版一致。
// 数据库访问风格与项目一致：sqlite3 回调式，包一层 Promise。
// ============================================================

import db from "./database.js";

/** 读画像（Promise）；没有画像/出错时 resolve(null) */
export function getUserProfile(userId) {
  return new Promise((resolve) => {
    if (!userId) return resolve(null);

    db.get(
      `SELECT thai_level, learning_goal, professional_direction,
              media_interest, learning_style, target_scenario, test_score
       FROM user_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
      (err, row) => {
        if (err || !row) return resolve(null);

        const asArray = (value) =>
          String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

        resolve({
          thaiLevel: row.thai_level || null,
          learningGoal: row.learning_goal || null,
          professionalDirection: asArray(row.professional_direction),
          mediaInterest: asArray(row.media_interest),
          learningStyle: asArray(row.learning_style),
          targetScenario: row.target_scenario || "",
          testScore: Number(row.test_score || 0),
        });
      }
    );
  });
}

/* ============================================================
   一、等级 → 教学指令
   等级来自入学测试判定（A0~C1），比前端 "Level 3" 可靠得多
============================================================ */

const LEVEL_GUIDANCE = {
  A0: {
    thai: "只使用最基础的泰语词汇和 2-3 词短句，几乎每个泰语表达都要附罗马音和中文",
    script: "学生还在学字母与声调，涉及泰文书写时放慢，逐个音节拆解",
    correction: "不纠拼写细节，只纠最影响理解的声调/元音长短错误，且每次最多纠一个",
    vocab: "限制在最高频 300 词以内",
  },
  A1: {
    thai: "使用简单泰语句（每句不超过 8 词），词汇限于高频生活词，所有泰语都附罗马音",
    script: "可以展示完整泰文句子，但讲解时逐词标注含义",
    correction: "重点纠声调与元音长短，拼写错误只在影响辨识时提",
    vocab: "限制在最高频 500 词以内",
  },
  A2: {
    thai: "使用日常水平的泰语句（每句 8-15 词），可以出现常见句型，泰语附罗马音+中文",
    script: "正常展示泰文，讲解以句型组块为主而不是逐词",
    correction: "开始纠正明显语法错误（语序、量词、语气词 ครับ/ค่ะ 用错），一次不超过 2 个",
    vocab: "使用常用 1000 词范围内的词汇，生词要标注",
  },
  B1: {
    thai: "使用自然但不过快的泰语，可以出现复合句和常见习语，泰语附中文（罗马音可省略）",
    script: "正常展示泰文，可以讨论句子结构",
    correction: "纠正语法与用词不当，包括连接词、时体表达；可以解释为什么这样改",
    vocab: "可使用 2000-3000 词范围的词汇，包括书面常用词",
  },
  B2: {
    thai: "使用接近母语者日常语速的自然泰语，可以用地道表达和口语连读，中文翻译为主",
    script: "泰文为主，讲解可比较口语与书面差异",
    correction: "重点纠「语法对但不地道」的表达，介绍母语者会怎么说",
    vocab: "可使用专业领域词汇，鼓励做同义词辨析",
  },
  C1: {
    thai: "使用完全自然的泰语，包括惯用语、文体差异和言外之意，泰语为主中文为辅",
    script: "深入讨论文体、语域与修辞",
    correction: "只纠母语者真正不会犯的错误；多讨论表达的细微差别与社交合适度",
    vocab: "不设词汇范围限制，可讨论抽象与专业话题",
  },
};

const STYLE_GUIDANCE = {
  listening: "偏好听力学习：讲解时多描述「听起来是什么感觉」，鼓励先听后看文本",
  speaking: "偏好口语输出：每次回复结尾给一个开口跟读/回答的小任务",
  reading: "偏好阅读学习：可多给书面例句与文字讲解，用阅读材料举例",
  visual: "偏好视觉学习：善用结构化排版（分点、标注），泰文拆解要清晰",
};

/* 目标 / 方向 / 兴趣 id → 例句素材指引 */
const GOAL_CONTEXT = {
  major: "泰语专业学习：可引入语法术语与系统知识，例句可偏正式",
  travel: "泰国旅行：例句优先用机场、酒店、点餐、问路、购物场景",
  business: "商务工作：例句优先用会议、邮件、报价、接待场景，注意礼貌等级",
  study: "泰国留学：例句优先用课堂、选课、宿舍、小组讨论场景",
  drama: "泰剧影视：可引用剧集式对话，关注口语化表达与情绪语气",
  music: "泰语音乐：可用歌词举例，关注押韵与语调美感",
  culture: "泰国文化：多讲表达背后的文化逻辑（佛教、长幼秩序、社会距离）",
};

const MEDIA_CONTEXT = {
  drama: "泰剧",
  movie: "电影",
  song: "歌曲",
  variety: "综艺",
  news: "新闻",
  tiktok: "短视频",
  novel: "小说",
  food: "美食",
  travel: "旅行",
};

const DIRECTION_CONTEXT = {
  business: "商务泰语",
  academic: "学术泰语",
  tourism: "旅游服务泰语",
  news: "新闻泰语",
  newmedia: "新媒体泰语",
};

/**
 * 把画像翻译成教学指令块（追加到 system prompt 末尾）。
 * 没有画像时返回 ""（拼接空串等于无操作，行为与旧版一致）。
 */
export function buildLearnerGuidance(profile) {
  if (!profile?.thaiLevel) return "";

  const level = LEVEL_GUIDANCE[profile.thaiLevel] || LEVEL_GUIDANCE.A2;
  const lines = [];

  lines.push(`【学生入学测评画像（可信，优先级高于对话中临时推断的水平）】`);
  lines.push(
    `- 泰语等级：${profile.thaiLevel}。回复难度上限：${level.thai}。词汇范围：${level.vocab}。`
  );

  const goalText = GOAL_CONTEXT[profile.learningGoal] || "";
  if (profile.targetScenario || goalText) {
    lines.push(
      `- 目标场景：${profile.targetScenario || goalText}。例句与对话应向这些场景倾斜。`
    );
  }

  lines.push(`- 纠错重点：${level.correction}。`);

  const styles = (profile.learningStyle || [])
    .map((styleId) => STYLE_GUIDANCE[styleId])
    .filter(Boolean);
  if (styles.length) {
    lines.push(`- 学习方式：${styles.join("；")}。`);
  }

  const mediaNames = (profile.mediaInterest || [])
    .map((mediaId) => MEDIA_CONTEXT[mediaId])
    .filter(Boolean);
  const directionNames = (profile.professionalDirection || [])
    .map((directionId) => DIRECTION_CONTEXT[directionId])
    .filter(Boolean);

  if (mediaNames.length || directionNames.length) {
    lines.push(
      `- 兴趣素材：${[...mediaNames, ...directionNames].join("、")}。用这些类型的内容举例更能引起共鸣。`
    );
  }

  lines.push(`- 泰文展示：${level.script}。`);
  lines.push(
    `- 出题难度：给学生出练习题（词汇、填空、翻译）时，按 ${profile.thaiLevel} 等级选词：${
      level.vocab
    }。`
  );

  return lines.join("\n");
}

/* ============================================================
   二、词汇测验难度：等级 → 默认难度档
   词库 difficulty 取值：beginner / intermediate / advanced
============================================================ */

const LEVEL_TO_QUIZ = {
  A0: "beginner",
  A1: "beginner",
  A2: "intermediate",
  B1: "intermediate",
  B2: "advanced",
  C1: "advanced",
};

/** 没有画像/等级未知时返回 null（前端不干预，保持现有行为） */
export function quizDifficultyFor(profile) {
  return LEVEL_TO_QUIZ[profile?.thaiLevel] || null;
}

/* ============================================================
   三、画像合并：入学画像（可信）与前端运行时画像合并，后端字段优先
   给 recommend / plan 等已接收 profile 参数的接口增强用
============================================================ */

export function mergeProfileForPrompt(frontProfile, placementProfile) {
  if (!placementProfile) return frontProfile || {};

  return {
    ...(frontProfile || {}),
    thaiLevel: placementProfile.thaiLevel,
    learningGoal: placementProfile.learningGoal,
    professionalDirection: placementProfile.professionalDirection,
    mediaInterest: placementProfile.mediaInterest,
    learningStyle: placementProfile.learningStyle,
    targetScenario: placementProfile.targetScenario,
    testScore: placementProfile.testScore,
  };
}
