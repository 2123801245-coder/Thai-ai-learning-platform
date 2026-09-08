// Thai Context Intelligence 的首批人工校订示例。
// 这里只放有明确语境信息的表达；没有可靠数据的词条由 normalizeThaiContext 提供保守回退。

export const CONTEXT_TYPES = [
  "日常口语",
  "朋友",
  "恋爱",
  "正式",
  "书面",
  "网络",
  "商务",
  "文化",
  "俚语",
];

const relationships = {
  peer: "适合",
  intimate: "适合",
  elder: "谨慎",
  teacher: "谨慎",
  business: "适合",
  stranger: "适合",
};

export const THAI_CONTEXT_ENTRIES = [
  {
    thai: "ทั้ง ๆ ที่",
    coreMeaning: "明明……却…… / 尽管……却……",
    literalMeaning: "明明处在某种事实或条件下",
    naturalMeaning: "带有明显反差感：按理说应该这样，但事实却相反。",
    contexts: ["日常口语", "书面"],
    relationships,
    emotion: ["反差", "强调", "无奈"],
    formality: 2,
    politeness: 2,
    intimacy: 2,
    naturalness: { label: "Very Natural", note: "常见连接表达；正式写作也能使用。" },
    commonCollocations: ["ทั้ง ๆ ที่รู้", "ทั้ง ๆ ที่มีเวลา", "ทั้ง ๆ ที่บอกแล้ว"],
    similarExpressions: [
      { thai: "แม้ว่า...แต่...", difference: "更完整、更中性，适合清楚说明让步关系。" },
      { thai: "ถึงแม้ว่า...", difference: "偏“即使/尽管”，语气可以更正式。" },
      { thai: "แม้จะ...", difference: "后面直接接动词或状态，句子更紧凑。" },
    ],
    avoidedUsage: ["不要把它当作单独的“但是”；后面通常需要呈现反差结果。"],
    whyNotLiteral: "逐字翻译容易只记住“明明”，却忽略它负责把前后两个事实连接成反差。",
    culturalNotes: ["泰语常用这类连接表达把冲突说得更有层次，而不是只用强烈的否定。"],
    nativeExamples: [
      { thai: "ทั้ง ๆ ที่เหนื่อย แต่เขายังทำงานต่อ", chinese: "明明很累，他却还在继续工作。" },
    ],
  },
  {
    thai: "ใช่ว่า...",
    coreMeaning: "并不是说…… / 不代表……",
    literalMeaning: "并非是……",
    naturalMeaning: "用来温和地纠正对方的推论，先否定误解，再补充真正情况。",
    contexts: ["日常口语", "朋友", "正式"],
    relationships: { ...relationships, stranger: "谨慎" },
    emotion: ["澄清", "委婉", "克制"],
    formality: 3,
    politeness: 3,
    intimacy: 2,
    naturalness: { label: "Natural", note: "常见于解释、澄清和表达保留意见。" },
    commonCollocations: ["ใช่ว่าจะไม่...", "ใช่ว่าไม่อยากไป", "ใช่ว่าทำไม่ได้"],
    similarExpressions: [
      { thai: "ไม่ใช่ว่า...", difference: "更直接地说“不是说……”，语气通常更明确。" },
      { thai: "ไม่ได้หมายความว่า...", difference: "强调“并不意味着”，解释性更强。" },
    ],
    avoidedUsage: ["不适合在没有后续解释时单独丢出，容易让对方不知道你要澄清什么。"],
    whyNotLiteral: "这里的 ใช่ 不是简单的“是”。整体是在否定一种推论，同时降低直接反驳的冲击。",
    culturalNotes: ["在需要保留关系和面子的对话里，先缓和再澄清通常比直接说“你错了”自然。"],
    nativeExamples: [
      { thai: "ใช่ว่าผมไม่อยากไปนะ แต่วันนี้ติดงาน", chinese: "不是我不想去，只是今天有工作走不开。" },
    ],
  },
  {
    thai: "ไม่เป็นไร",
    coreMeaning: "没关系 / 没事 / 不用客气",
    literalMeaning: "不成为问题",
    naturalMeaning: "根据场景可以表示接受道歉、安慰别人，或回应感谢；语气取决于声音和关系。",
    contexts: ["日常口语", "朋友", "社交"],
    relationships: { ...relationships, business: "谨慎" },
    emotion: ["安慰", "体谅", "轻松"],
    formality: 2,
    politeness: 3,
    intimacy: 3,
    naturalness: { label: "Very Natural", note: "高频日常表达；具体含义必须结合上下文判断。" },
    commonCollocations: ["ไม่เป็นไรครับ", "ไม่เป็นไรค่ะ", "ไม่เป็นไรนะ"],
    similarExpressions: [
      { thai: "ไม่ต้องห่วง", difference: "更明确地表示“别担心”，不等同于回应感谢。" },
      { thai: "ยินดี", difference: "回应感谢时可以表示乐意，但不能覆盖所有“没关系”场景。" },
    ],
    avoidedUsage: ["严重事故或正式投诉中不要只用它草草带过，应先明确说明处理方式。"],
    whyNotLiteral: "中文的“没关系”常被当成固定答案，但泰语里它还可以是安慰或“不用客气”，不能脱离场景背。",
    culturalNotes: ["泰语交流重视缓和关系；这句话常让对话从道歉或感谢自然地回到轻松状态。"],
    nativeExamples: [
      { thai: "ขอโทษที่มาสายนะ", chinese: "不好意思我迟到了。" },
      { thai: "ไม่เป็นไรครับ", chinese: "没关系。" },
    ],
  },
  {
    thai: "กินข้าว",
    coreMeaning: "吃饭",
    literalMeaning: "吃米饭",
    naturalMeaning: "除了真正吃饭，也常被用来关心对方、开启寒暄，不一定是在盘问吃了哪一种饭。",
    contexts: ["日常口语", "朋友", "家人", "文化"],
    relationships: { ...relationships, business: "适合" },
    emotion: ["关心", "亲近", "寒暄"],
    formality: 1,
    politeness: 2,
    intimacy: 4,
    naturalness: { label: "Very Natural", note: "高频固定搭配；常见于问候和日常关心。" },
    commonCollocations: ["กินข้าวหรือยัง", "ไปกินข้าวกัน", "กินข้าวแล้ว"],
    similarExpressions: [
      { thai: "รับประทานอาหาร", difference: "更正式、更书面，不能随意替换日常寒暄。" },
      { thai: "ทานข้าว", difference: "较礼貌的“吃饭”，具体选择随关系和场合变化。" },
    ],
    avoidedUsage: ["不要把中文“你吃饭了吗”逐字套成正式场合的盘问；先判断关系和场景。"],
    whyNotLiteral: "ข้าว 的字面是“米饭”，但 กินข้าว 在泰语里已经整体化为“吃饭/用餐”。",
    culturalNotes: ["以吃饭问候对方是泰国日常社交中常见的关心方式，和中文的寒暄功能相近。"],
    nativeExamples: [
      { thai: "กินข้าวหรือยังครับ", chinese: "吃饭了吗？" },
    ],
  },
  {
    thai: "ไขว่คว้า",
    coreMeaning: "努力争取、追逐",
    literalMeaning: "伸手去抓住某样东西",
    naturalMeaning: "强调主动伸手争取机会或梦想，带有积极、执着的画面感。",
    contexts: ["书面", "正式", "励志"],
    relationships: { ...relationships, peer: "适合", intimate: "适合" },
    emotion: ["积极", "执着", "主动"],
    formality: 4,
    politeness: 2,
    intimacy: 1,
    naturalness: { label: "Natural in the right context", note: "演讲、文章和励志表达中自然；普通聊天可换成更简单的词。" },
    commonCollocations: ["ไขว่คว้าความฝัน", "ไขว่คว้าโอกาส", "ไขว่คว้าความสำเร็จ"],
    similarExpressions: [
      { thai: "หา", difference: "只是寻找，不突出主动争取和执着。" },
      { thai: "คว้า", difference: "抓住、夺取，动作感更直接，未必包含长期努力。" },
    ],
    avoidedUsage: ["日常买东西或普通寻找时使用会显得过于文学化。"],
    whyNotLiteral: "如果只记成“追求”，会漏掉它由“伸手抓取”带来的主动性和画面感。",
    culturalNotes: ["泰语励志语境常借具体动作表达抽象目标，学习时要同时记住画面和语气。"],
    nativeExamples: [
      { thai: "เราต้องไขว่คว้าโอกาสที่เข้ามา", chinese: "我们要主动抓住到来的机会。" },
    ],
  },
];

export const THAI_CONTEXT_OF_DAY = [
  "ทั้ง ๆ ที่",
  "ใช่ว่า...",
  "ไม่เป็นไร",
  "กินข้าว",
  "ไขว่คว้า",
];

export function findThaiContext(thai) {
  const value = String(thai || "").trim();
  return THAI_CONTEXT_ENTRIES.find((entry) => entry.thai === value) || null;
}
