// src/data/professionalTracks.js
//
// =========================================================
// 专业泰语模块 · 内容数据（单一数据源）
// =========================================================
//
// 五个专业方向 × 各自的内容板块（module）。
// 「不要设计成固定课程」：这里是可组合的内容板块池，
//   - 页面按方向展示板块，用户自由选择方向；
//   - 每个板块自带练习入口（现在就能练，不依赖视频课上线）；
//   - 部分板块关联真实课程（courseId），课程上线后自动升级为可上课。
//
// 方向 id 与入学画像 PROFESSIONAL_DIRECTIONS 一致（business/academic/
// tourism/news/newmedia），选择结果写回画像 + professional_courses 表。
// =========================================================

export const PROFESSIONAL_TRACKS = [
  {
    id: "business",
    emoji: "💼",
    title: "商务泰语",
    tagline: "把泰语变成职场竞争力",
    color: "sky",
    stageHint: "business", // 织入学习路线时使用的阶段 id
    modules: [
      {
        id: "biz-communication",
        title: "商务交流",
        level: "B1",
        lessons: 5,
        desc: "初次拜访、电话沟通、工作交接的高频表达与礼仪层级（ครับ/ค่ะ/ค่ะครับ 的分寸）",
        entry: "/conversation",
        entryLabel: "和 AI 老师练接待",
        courseId: "thai-business",
      },
      {
        id: "biz-meeting",
        title: "会议表达",
        level: "B1",
        lessons: 4,
        desc: "议程推进、发表意见、总结决议的句式框架，正式场合的委婉拒绝与追问",
        entry: "/corpus",
        entryLabel: "精听会议语料",
        courseId: "thai-business",
      },
      {
        id: "biz-email",
        title: "邮件写作",
        level: "B2",
        lessons: 4,
        desc: "开头称呼、正文结构、结尾敬语；泰语邮件的 ขอบคุณล่วงหน้า 文化",
        entry: "/conversation",
        entryLabel: "让 AI 改你的邮件",
      },
      {
        id: "biz-negotiation",
        title: "谈判语言",
        level: "B2",
        lessons: 5,
        desc: "报价、还价、让步与成交用语；「再考虑一下」背后泰国式的迂回表达",
        entry: "/conversation",
        entryLabel: "演练一轮谈判",
      },
      {
        id: "biz-culture",
        title: "企业文化",
        level: "B1",
        lessons: 3,
        desc: "等级观念、头衔称呼、职场佛教礼仪——在泰国公司活得自在的软知识",
        entry: "/culture",
        entryLabel: "读职场文化短文",
      },
    ],
  },

  {
    id: "academic",
    emoji: "🎓",
    title: "学术泰语",
    tagline: "读懂文献，讲得出观点",
    color: "violet",
    stageHint: "academic",
    modules: [
      {
        id: "aca-paper",
        title: "论文阅读",
        level: "C1",
        lessons: 5,
        desc: "摘要结构、连接词网络（ดังนั้น/อย่างไรก็ตาม）、长句拆解策略",
        entry: "/corpus/read",
        entryLabel: "精读一篇语料",
        courseId: "thai-grammar-advanced",
      },
      {
        id: "aca-vocab",
        title: "学术词汇",
        level: "B2",
        lessons: 6,
        desc: "书面语高频词与巴利梵语源学术词，口语词 → 书面词的升级对照",
        entry: "/vocabulary?book=vocab-学习",
        entryLabel: "刷学术词书",
      },
      {
        id: "aca-research",
        title: "研究表达",
        level: "C1",
        lessons: 4,
        desc: "描述方法、呈现数据、引用与转述；「研究表明」的泰语学术腔",
        entry: "/conversation",
        entryLabel: "和 AI 练研究陈述",
      },
      {
        id: "aca-presentation",
        title: "演讲训练",
        level: "B2",
        lessons: 4,
        desc: "开场、过渡、收尾模板与临场应答，学术报告的语速与停顿",
        entry: "/speaking-practice",
        entryLabel: "录一段报告开头",
      },
    ],
  },

  {
    id: "tourism",
    emoji: "🧳",
    title: "旅游服务泰语",
    tagline: "服务场景句句能用",
    color: "teal",
    stageHint: "travel",
    modules: [
      {
        id: "tou-hotel",
        title: "酒店",
        level: "A2",
        lessons: 5,
        desc: "预订、入住、退房、投诉与帮忙；酒店敬语与服务应答套路",
        entry: "/conversation",
        entryLabel: "练一遍入住对话",
        courseId: "thai-tourism",
      },
      {
        id: "tou-restaurant",
        title: "餐厅",
        level: "A2",
        lessons: 4,
        desc: "点单、推荐菜、口味询问、结账；带客人吃明白泰餐的实用句",
        entry: "/vocabulary?book=vocab-点餐泰语",
        entryLabel: "刷点餐词书",
        courseId: "thai-tourism",
      },
      {
        id: "tou-guide",
        title: "导游",
        level: "B1",
        lessons: 4,
        desc: "景点讲解框架、集合/提醒/ warning 表达，讲故事的泰语叙事节奏",
        entry: "/corpus/read",
        entryLabel: "读一篇导游词",
        courseId: "thai-tourism",
      },
      {
        id: "tou-customer",
        title: "客户交流",
        level: "B1",
        lessons: 3,
        desc: "需求确认、价格沟通、突发状况处理（改期/丢东西/看病陪同）",
        entry: "/conversation",
        entryLabel: "和 AI 演练突发状况",
      },
    ],
  },

  {
    id: "news",
    emoji: "📰",
    title: "新闻泰语",
    tagline: "听懂泰国在发生什么",
    color: "amber",
    stageHint: "news",
    modules: [
      {
        id: "news-reading",
        title: "新闻阅读",
        level: "B2",
        lessons: 5,
        desc: "标题压缩语法、导语五要素、常见新闻套语（รายงานว่า/ทั้งนี้）",
        entry: "/corpus/read",
        entryLabel: "读一篇新闻语料",
        courseId: "thai-news",
      },
      {
        id: "news-society",
        title: "社会话题",
        level: "B2",
        lessons: 4,
        desc: "交通、民生、教育、旅游政策的高频讨论词与立场表达",
        entry: "/corpus/listening",
        entryLabel: "精听社会新闻",
        courseId: "thai-news",
      },
      {
        id: "news-policy",
        title: "政策词汇",
        level: "C1",
        lessons: 4,
        desc: "政府机构名、政策动词（ประกาศ/มีผลบังคับ）、数字与日期读法",
        entry: "/vocabulary?book=vocab-政治泰语",
        entryLabel: "刷时政词书",
      },
    ],
  },

  {
    id: "newmedia",
    emoji: "📱",
    title: "新媒体泰语",
    tagline: "刷得懂梗，写得出文案",
    color: "pink",
    stageHint: "screen",
    modules: [
      {
        id: "nm-social",
        title: "社交平台表达",
        level: "B1",
        lessons: 4,
        desc: "评论、私信、直播弹幕的语言风格；泰网最常用的缩写与语气粒子",
        entry: "/corpus/listening",
        entryLabel: "精听一段短视频语料",
        courseId: "thai-listening",
      },
      {
        id: "nm-slang",
        title: "网络流行语",
        level: "B1",
        lessons: 5,
        desc: "จุกๆ/ความบันเทิง/ดราม่า 这类年更词汇的语义与使用边界",
        entry: "/vocabulary?book=vocab-日常",
        entryLabel: "刷日常口语词书",
      },
      {
        id: "nm-creation",
        title: "内容创作",
        level: "B2",
        lessons: 4,
        desc: "标题党公式、开头三秒钩子、文案节奏；把泰语写得好玩的技巧",
        entry: "/conversation",
        entryLabel: "让 AI 帮你改标题",
      },
    ],
  },
];

export const getTrackById = (id) =>
  PROFESSIONAL_TRACKS.find((track) => track.id === id) || null;

/** 全部板块数（供页面统计展示） */
export const TOTAL_MODULE_COUNT = PROFESSIONAL_TRACKS.reduce(
  (sum, track) => sum + track.modules.length,
  0
);
