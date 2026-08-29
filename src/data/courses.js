// src/data/courses.js

// =========================================================
// ThaiAI 课程数据
// =========================================================
//
// 课程状态：
// learning  → 正在学习
// available → 免费可学习
// vip       → VIP课程
// coming    → 即将上线
//
// isVip：
// false → 免费课程
// true  → VIP课程
//
// 后续新增课程，只需要在这里增加数据。
// Course.jsx / CourseDetail.jsx / Lesson.jsx 不需要重新设计。
//
// 封面图（可选）：在课程对象里加 cover 字段，如
//   cover: "/covers/daily-thai.jpg"
// 图片放到 public/covers/ 目录，课程卡会自动显示实景封面；
// 不填则回退到抽象渐变封面（泰文字母 + 金色音波）。
// =========================================================


export const courses = [

  // =========================================================
  // 免费基础课程
  // =========================================================

  {
    id: "thai-pronunciation",

    title: "泰语发音入门",

    description:
      "从零开始掌握泰语元音、辅音、声调与基本拼读规则",

    progress: 72,

    lessons: 8,

    completed: 6,

    duration: "约 2 小时",

    level: "基础",

    levelKey: "basic",

    category: "基础",

    color: "emerald",

    status: "learning",

    isVip: false,
  },


  {
    id: "thai-spelling",

    title: "泰语基础拼读",

    description:
      "掌握泰语拼读方法，逐渐做到看到泰文就能正确读出来",

    progress: 0,

    lessons: 7,

    completed: 0,

    duration: "约 2 小时",

    level: "基础",

    levelKey: "basic",

    category: "基础",

    color: "teal",

    status: "available",

    isVip: false,
  },


  {
    id: "daily-thai",

    title: "日常泰语表达",

    description:
      "学习生活中最常用的泰语表达与实用句型，开始真正开口交流",

    progress: 0,

    lessons: 8,

    completed: 0,

    duration: "约 2.5 小时",

    level: "基础",

    levelKey: "basic",

    category: "口语",

    color: "yellow",

    status: "available",

    isVip: false,
  },


  // =========================================================
  // VIP 进阶课程
  // =========================================================

  {
    id: "thai-pronunciation-advanced",

    title: "泰语发音规则",

    description:
      "深入掌握声调、音节结构以及复杂发音规律",

    progress: 0,

    lessons: 8,

    completed: 0,

    duration: "约 2.5 小时",

    level: "进阶",

    levelKey: "advanced",

    category: "发音",

    color: "blue",

    status: "vip",

    isVip: true,
  },


  {
    id: "thai-grammar-advanced",

    title: "泰语进阶语法",

    description:
      "系统学习泰语核心语法结构和真实交流中的常见句型",

    progress: 0,

    lessons: 10,

    completed: 0,

    duration: "约 4 小时",

    level: "进阶",

    levelKey: "advanced",

    category: "语法",

    color: "purple",

    status: "vip",

    isVip: true,
  },


  {
    id: "thai-listening",

    title: "泰语听力训练",

    description:
      "通过真实泰语对话与不同语速训练听力理解能力",

    progress: 0,

    lessons: 8,

    completed: 0,

    duration: "约 3 小时",

    level: "进阶",

    levelKey: "advanced",

    category: "听力",

    color: "blue",

    status: "vip",

    isVip: true,
  },


  {
    id: "thai-conversation",

    title: "泰语真实会话",

    description:
      "进入真实生活场景，训练更加自然的泰语交流能力",

    progress: 0,

    lessons: 9,

    completed: 0,

    duration: "约 3.5 小时",

    level: "进阶",

    levelKey: "advanced",

    category: "口语",

    color: "orange",

    status: "vip",

    isVip: true,
  },


  {
    id: "thai-culture",

    title: "泰国文化与语言",

    description:
      "了解泰国社会文化、礼仪与语言表达背后的文化逻辑",

    progress: 0,

    lessons: 6,

    completed: 0,

    duration: "约 2 小时",

    level: "进阶",

    levelKey: "advanced",

    category: "文化",

    color: "purple",

    status: "vip",

    isVip: true,
  },


  // =========================================================
  // 未来课程
  // =========================================================

  {
    id: "thai-tourism",

    title: "泰语旅游沟通",

    description:
      "机场、酒店、餐厅、购物和旅行中的实用泰语",

    progress: 0,

    lessons: 0,

    completed: 0,

    duration: "即将上线",

    level: "进阶",

    levelKey: "advanced",

    category: "场景",

    color: "emerald",

    status: "coming",

    isVip: true,
  },


  {
    id: "thai-news",

    title: "泰语新闻阅读",

    description:
      "通过真实泰语新闻提升阅读速度、词汇量和信息理解能力",

    progress: 0,

    lessons: 0,

    completed: 0,

    duration: "即将上线",

    level: "高级",

    levelKey: "advanced",

    category: "阅读",

    color: "blue",

    status: "coming",

    isVip: true,
  },


  {
    id: "thai-business",

    title: "商务泰语",

    description:
      "学习职场、商务沟通以及正式场合中的泰语表达",

    progress: 0,

    lessons: 0,

    completed: 0,

    duration: "即将上线",

    level: "高级",

    levelKey: "advanced",

    category: "商务",

    color: "orange",

    status: "coming",

    isVip: true,
  },


  {
    id: "thai-diplomacy",

    title: "外交泰语",

    description:
      "面向正式交流、国际事务和外交场景的泰语训练",

    progress: 0,

    lessons: 0,

    completed: 0,

    duration: "即将上线",

    level: "高级",

    levelKey: "advanced",

    category: "外交",

    color: "purple",

    status: "coming",

    isVip: true,
  },

];


// =========================================================
// 已发布课程
// =========================================================
//
// 排除“即将上线”的课程。
// 用于课程大厅展示。
// =========================================================

export const publishedCourses =
  courses.filter(
    (course) =>
      course.status !== "coming"
  );


// =========================================================
// 基础课程
// =========================================================

export const basicCourses =
  courses.filter(
    (course) =>
      course.levelKey === "basic"
  );


// =========================================================
// 进阶课程
// =========================================================

export const advancedCourses =
  courses.filter(
    (course) =>
      course.levelKey === "advanced"
  );


// =========================================================
// VIP课程
// =========================================================

export const vipCourses =
  courses.filter(
    (course) =>
      course.isVip === true
  );


// =========================================================
// 免费课程
// =========================================================

export const freeCourses =
  courses.filter(
    (course) =>
      course.isVip === false
  );


// =========================================================
// 正在学习
// =========================================================

export const learningCourses =
  courses.filter(
    (course) =>
      course.status === "learning"
  );


// =========================================================
// 即将上线
// =========================================================

export const comingCourses =
  courses.filter(
    (course) =>
      course.status === "coming"
  );


// =========================================================
// 根据 ID 获取课程
// =========================================================

export const getCourseById = (
  id
) =>
  courses.find(
    (course) =>
      course.id === id
  );


// =========================================================
// 根据状态获取课程
// =========================================================

export const getCoursesByStatus = (
  status
) =>
  courses.filter(
    (course) =>
      course.status === status
  );


// =========================================================
// 根据分类获取课程
// =========================================================

export const getCoursesByCategory = (
  category
) =>
  courses.filter(
    (course) =>
      course.category === category
  );


// =========================================================
// 判断课程是否免费
// =========================================================

export const isFreeCourse = (
  course
) =>
  course?.isVip === false;


// =========================================================
// 判断课程是否 VIP
// =========================================================

export const isVipCourse = (
  course
) =>
  course?.isVip === true;


// =========================================================
// 判断课程是否即将上线
// =========================================================

export const isComingCourse = (
  course
) =>
  course?.status === "coming";


// =========================================================
// 判断课程是否可以进入
// =========================================================
//
// 免费课程：可以
// VIP课程：需要 VIP
// coming：不可以
//
// 这里只做基础判断。
// 真正的用户 VIP 权限以后接 Auth / Base44。
// =========================================================

export const canEnterCourse = (
  course,
  isVipUser = false
) => {

  if (!course) {
    return false;
  }

  if (
    course.status === "coming"
  ) {
    return false;
  }

  if (
    course.isVip &&
    !isVipUser
  ) {
    return false;
  }

  return true;
};


// =========================================================
// 获取课程统计
// =========================================================

export const courseStats = {

  total:
    courses.length,

  published:
    publishedCourses.length,

  basic:
    basicCourses.length,

  advanced:
    advancedCourses.length,

  free:
    freeCourses.length,

  vip:
    vipCourses.length,

  learning:
    learningCourses.length,

  coming:
    comingCourses.length,
};