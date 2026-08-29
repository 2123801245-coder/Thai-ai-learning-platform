// src/data/conversations.js
// ThaiAI 对话场景数据 v2 — 多轮对话树 + 分支 + 场景氛围

export const conversationScenes = [
  // ═══════════════════════════════════════
  // 日常交流
  // ═══════════════════════════════════════
  {
    id: "daily",
    title: "日常交流",
    subtitle: "基础问候与寒暄",
    description: "学习泰国人最常用的日常问候和寒暄方式，了解泰国人的社交礼仪。",
    icon: "MessageCircle",
    sceneEmoji: "🌅",
    sceneTip: "泰国人见面时双手合十行「wai」礼，微笑是最重要的社交语言。",
    greeting: {
      thai: "สวัสดีครับ! ยินดีที่ได้รู้จัก วันนี้อากาศดีมากเลยนะครับ",
      roman: "sà-wàt-dii kráp! yin-dii thîi dâai rúu-jàk, wan níi aa-gàat dii mâak loei ná kráp",
      chinese: "你好！很高兴认识你，今天天气真好啊！",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "AI 在等你打招呼",
        suggestions: ["สวัสดีครับ", "สวัสดีค่ะ", "hello", "你好"],
        responses: [
          {
            keywords: ["สวัสดี", "hello", "hi", "你好", "嗨"],
            thai: "สวัสดีครับ! สบายดีไหมครับ วันนี้ทำอะไรอยู่ครับ",
            roman: "sà-wàt-dii kráp! sà-baai-dii mái kráp, wan níi tham à-rai yùu kráp",
            chinese: "你好！最近好吗？今天在做什么呢？",
            vocab: [
              { th: "สบายดี", roman: "sà-baai-dii", cn: "好 / 舒适" },
              { th: "วันนี้", roman: "wan níi", cn: "今天" },
              { th: "ทำอะไร", roman: "tham à-rai", cn: "做什么" },
            ],
            grammar: "泰语问候常用「สบายดีไหม」，相当于中文「你好吗」。注意男性句尾加ครับ，女性加ค่ะ。",
            culturalNote: "泰国人非常注重礼貌，打招呼时即使不认识对方也要微笑和wai。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "分享一下你的近况",
        suggestions: ["สบายดีครับ", "เรียนภาษาไทย", "ไปเที่ยว", "ทำงาน"],
        responses: [
          {
            keywords: ["สบายดี", "ดี", "good", "fine"],
            thai: "ดีมากครับ! แล้ววันนี้มีแผนจะทำอะไรครับ ไปกินข้าวที่ไหนดีครับ",
            roman: "dii mâak kráp! láew wan níi mii phlaen jà tham à-rai kráp, pai kin khâao thîi nǎi dii kráp",
            chinese: "太好了！那今天打算做什么呢？去哪里吃饭好？",
            vocab: [
              { th: "แผน", roman: "phlaen", cn: "计划" },
              { th: "ไป", roman: "pai", cn: "去" },
            ],
            grammar: "「แล้ว」用于转换话题，相当于中文「那」、然后。很自然的口语连接词。",
          },
          {
            keywords: ["เรียน", "learn", "learn Thai"],
            thai: "เก่งมากครับ! ภาษาไทยยากไหมครับ ตอนนี้เรียนถึงบทไหนแล้วครับ",
            roman: "gèng mâak kráp! phaa-sǎa thai yàak mái kráp, tɔ̀ɔn-níi rian thǔng bòt nǎi láew kráp",
            chinese: "很厉害！泰语难吗？现在学到哪里了？",
            vocab: [
              { th: "เก่ง", roman: "gèng", cn: "厉害" },
              { th: "ยาก", roman: "yàak", cn: "难" },
            ],
            grammar: "「เก่งมาก」是对能力的赞美，泰国人很喜欢说「เก่ง」来鼓励别人。",
          },
          {
            keywords: ["ไปเที่ยว", "travel", "trip"],
            thai: "ไปเที่ยวที่ไหนมาครับ สวยไหมครับ ถ่ายรูปมาเยอะไหมครับ",
            roman: "pai thîiao thîi nǎi maa kráp, sǔay mái kráp, thâai rúu-pai yəə mái kráp",
            chinese: "去了哪里玩？漂亮吗？拍了很多照片吗？",
            vocab: [
              { th: "เที่ยว", roman: "thîiao", cn: "游玩" },
              { th: "สวย", roman: "sǔay", cn: "漂亮" },
            ],
            grammar: "「มา」放在动词后表示「已经做了某事」，如「ไปเที่ยวมา = 已经去玩过了」。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "聊聊泰国文化吧",
        suggestions: ["อาหารไทย", "วัฒนธรรม", "ประเทศไทย", "กรุงเทพ"],
        responses: [
          {
            keywords: ["อาหาร", "food"],
            thai: "อาหารไทยอร่อยมากเลยนะครับ! คุณชอบอะไรเป็นพิเศษครับ ต้มยำกุ้ง หรือ ผัดไทย",
            roman: "aa-hǎan thai a-rɔ̀i mâak loei ná kráp! khun chɔ̀ɔp à-rai bpen phá-sèt kráp, tôm-yam-kûng rʉ̌ʉ phàt-thai",
            chinese: "泰国菜非常好吃！你特别喜欢什么？冬阴功还是泰式炒粉？",
            vocab: [
              { th: "อร่อย", roman: "a-rɔ̀i", cn: "好吃" },
              { th: "ชอบ", roman: "chɔ̀ɔp", cn: "喜欢" },
              { th: "เป็นพิเศษ", roman: "bpen phá-sèt", cn: "特别" },
            ],
            grammar: "「เป็นพิเศษ」是「特别」的意思，放在名词后强调偏好。",
            culturalNote: "泰国人对食物非常热情，问「吃了吗」（กินข้าวหรือยัง）是最常见的问候方式。",
          },
          {
            keywords: ["วัฒนธรรม", "culture"],
            thai: "วัฒนธรรมไทยมีเสน่ห์มากเลยนะครับ โดยเฉพาะการไหว้ คุณรู้จักการไหว้ไหมครับ",
            roman: "wát-thá-ná-tham thai mii sà-nèh mâak loei ná kráp, dɔ̀ɔ-phɔ́-phàw kan wâi khun rúu-jàk kan wâi mái kráp",
            chinese: "泰国文化很有魅力呢！特别是合十礼。你知道wai礼吗？",
            vocab: [
              { th: "วัฒนธรรม", roman: "wát-thá-ná-tham", cn: "文化" },
              { th: "การไหว้", roman: "kan wâi", cn: "合十礼" },
            ],
            grammar: "「โดยเฉพาะ」表示「特别是」，用于强调。",
            culturalNote: "合十礼的高低表示尊敬程度。对同龄人手放在胸口，对长辈放鼻子高度，对僧侣放额头。",
          },
          {
            keywords: ["กรุงเทพ", "bangkok"],
            thai: "กรุงเทพฯ เป็นเมืองหลวงของไทย มีทั้งวัดสวยๆ และตลาดนัดชื่อดัง คุณเคยมากรุงเทพฯ ไหมครับ",
            roman: "grung-têep bpen meuang-lǎawng khɔ̌ɔng thai, mii táng wát sǔay-sǔay láe dtà-làat-nát chʉ̂ʉ dâang, khun kəəi maa grung-têep mái kráp",
            chinese: "曼谷是泰国的首都，有很多漂亮的寺庙和著名的水上市场。你来过曼谷吗？",
            vocab: [
              { th: "กรุงเทพฯ", roman: "grung-têep", cn: "曼谷" },
              { th: "วัด", roman: "wát", cn: "寺庙" },
              { th: "ตลาดนัด", roman: "dtà-làat-nát", cn: "集市" },
            ],
            grammar: "「เคย」表示「曾经」，是过去经历的标记词。คุณเคย...ไหม = 你曾经...吗？",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "准备告别吧",
        suggestions: ["ขอบคุณ", "ลาก่อน", "เจอกันใหม่", "สนุกมาก"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank"],
            thai: "ขอบคุณครับ! ดีใจที่ได้คุยกัน คุณพูดภาษาไทยเก่งขึ้นเรื่อยๆ นะครับ สู้ๆ ครับ!",
            roman: "khàawp-khun kráp! dii-jai thîi dâai khui gan, khun pûut phaa-sǎa thai gèng khʉ̌ʉn rʉ̌ʉai-rʉ̌ʉai ná kráp, súu-súu kráp!",
            chinese: "谢谢！很高兴和你聊天，你的泰语越来越好了一起加油！",
            vocab: [
              { th: "ดีใจ", roman: "dii-jai", cn: "高兴" },
              { th: "สู้ๆ", roman: "súu-súu", cn: "加油" },
            ],
            grammar: "「เก่งขึ้นเรื่อยๆ」表示越来越好，ขึ้น = 上升，เรื่อยๆ = 渐渐。",
          },
          {
            keywords: ["ลาก่อน", "bye", "再见"],
            thai: "ลาก่อนครับ เจอกันใหม่นะครับ อย่าลืมฝึกพูดภาษาไทยทุกวันนะครับ!",
            roman: "laa-kàawn kráp, jəə gan mài ná kráp, yàa lʉʉm fʉ̀k pûut phaa-sǎa thai thûk-wan ná kráp!",
            chinese: "再见！下次见，别忘了每天练习泰语哦！",
            vocab: [
              { th: "อย่าลืม", roman: "yàa lʉʉm", cn: "别忘了" },
              { th: "ทุกวัน", roman: "thûk-wan", cn: "每天" },
            ],
            grammar: "「อย่าลืม」= 别忘了，是非常实用的日常短语。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "น่าสนใจครับ! ลองบอกฉันเป็นภาษาไทยสิครับ เช่น สวัสดี สบายดี หรือ ขอบคุณ",
      roman: "nâa sǒn-jai kráp! lɔɔng bàawk chǎn bpen phaa-sǎa thai sì kráp",
      chinese: "有意思！试着用泰语跟我说吧。",
      vocab: [],
      grammar: "泰语核心句型：สวัสดี = 你好，ขอบคุณ = 谢谢，สบายดี = 很好。",
    },
  },

  // ═══════════════════════════════════════
  // 旅行泰语
  // ═══════════════════════════════════════
  {
    id: "travel",
    title: "旅行泰语",
    subtitle: "出行实用对话",
    description: "在泰国旅行时最实用的对话：问路、交通、酒店、紧急求助。",
    icon: "Plane",
    sceneEmoji: "✈️",
    sceneTip: "泰国出租车大多不打表，上车前先说「ไป...meter ไหม」可以避免被宰。",
    greeting: {
      thai: "ยินดีต้อนรับสู่ประเทศไทยครับ! คุณเดินทางมาถึงแล้วหรือครับ ต้องการอะไรช่วยไหมครับ",
      roman: "yin-dii tɔ̂ɔn-ráp sùu bprà-thêet thai kráp! khun dəən-thaang maa thʉ̌ng láew rʉ̌ʉ kráp, tɔ̂ng-kaan à-rai chûay mái kráp",
      chinese: "欢迎来到泰国！你已经到了吗？需要帮忙吗？",
      speakRate: 0.70,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "刚到泰国，你需要帮助",
        suggestions: ["ไปสนามบิน", "ช่วยด้วย", "แท็กซี่", "ฉันมาจากจีน"],
        responses: [
          {
            keywords: ["สนามบิน", "airport"],
            thai: "สนามบินสุวรรณภูมิอยู่ห่างจากที่นี่ประมาณ 30 กิโลเมตร คุณจะไปแท็กซี่หรือรถไฟฟ้าครับ",
            roman: "sà-nǎam-bin sù-wan-na-phuum yùu hâang jàak thîi nîi bprà-maan sǎam-sìp kílô-mêet, khun jà pai thák-sîi rʉ̌ʉ rót-fai fáa kráp",
            chinese: "素万那普机场离这里约30公里。你要坐出租车还是轻轨？",
            vocab: [
              { th: "สนามบิน", roman: "sà-nǎam-bin", cn: "机场" },
              { th: "แท็กซี่", roman: "thák-sîi", cn: "出租车" },
              { th: "รถไฟฟ้า", roman: "rót-fai fáa", cn: "轻轨/BTS" },
            ],
            grammar: "「จะ...หรือ」表示选择疑问，泰国交通主要有三种：แท็กซี่（出租车）、BTS（轻轨）、มอเตอร์ไซค์（摩托车）。",
          },
          {
            keywords: ["ช่วย", "help"],
            thai: "ไม่เป็นไรครับ ผมช่วยได้! คุณมีปัญหาอะไรครับ หลงทาง หรือต้องการข้อมูล",
            roman: "mâi bpen rai kráp, phǒm chûay dâi! khun mii pan-hǎa à-rai kráp, lǒng thaang rʉ̌ʉ tɔ̂ng-kaan khɔ̂ɔm-luun",
            chinese: "没关系！我可以帮你！你有什么问题？迷路了还是需要信息？",
            vocab: [
              { th: "ช่วย", roman: "chûay", cn: "帮忙" },
              { th: "ปัญหา", roman: "pan-hǎa", cn: "问题" },
            ],
            grammar: "「ช่วย + 动词 + ได้」表示「可以帮忙做某事」。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "告诉 AI 你要去哪里",
        suggestions: ["ไปวัดพระแก้ว", "ไปพัทยา", "ไปเชียงใหม่", "ไปตลาด"],
        responses: [
          {
            keywords: ["วัด", "temple"],
            thai: "วัดพระแก้วสวยมากครับ! แนะนำให้ไปตอนเช้าจะคนน้อยกว่า อย่าลืมใส่เสื้อมิดชิดนะครับ เพราะต้องถอดรองเท้า",
            roman: "wát phrá-gəəw sǔay mâak kráp! náe-nam hâi pai tɔ̀ɔn cháo jà khon náaw-iação, yàa lʉʉm sài sʉ̂a mít-chìt ná kráp",
            chinese: "玉佛寺非常漂亮！建议早上去人少，别忘了穿遮盖肩膀的衣服，因为要脱鞋。",
            vocab: [
              { th: "วัด", roman: "wát", cn: "寺庙" },
              { th: "แนะนำ", roman: "náe-nam", cn: "推荐" },
            ],
            grammar: "「แนะนำให้ + 动词」= 建议做某事。泰国寺庙有着装要求。",
            culturalNote: "进寺庙必须脱鞋，女士不能触碰僧侣。穿长裤或过膝裙即可。",
          },
          {
            keywords: ["เชียงใหม่", "พัทยา", "ไป"],
            thai: "ไปได้เลยครับ! จากกรุงเทพฯ ไปเชียงใหม่ประมาณ 1 ชั่วโมงเครื่องบิน หรือ 8 ชั่วโมงรถไฟ คุณชอบแบบไหนครับ",
            roman: "pai dâi loei kráp! jàak grung-têep pai chiiang-mài bprà-maan nʉ̀ng chûa-wing, khun chɔ̀ɔp baep nǎi kráp",
            chinese: "可以去！从曼谷到清迈坐飞机约1小时，火车约8小时。",
            vocab: [
              { th: "ชั่วโมง", roman: "chûa-moong", cn: "小时" },
            ],
            grammar: "「แบบไหน」= 哪种方式。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "谈谈交通费用",
        suggestions: ["เท่าไหร่", "ราคา", "แพงไหม", "จ่ายเงินยังไง"],
        responses: [
          {
            keywords: ["เท่าไหร่", "ราคา", "多少钱", "price", "แพง"],
            thai: "ราคาแตกต่างกันครับ แท็กซี่ประมาณ 200-300 บาท รถไฟฟ้าประมาณ 40-60 บาท แล้วแต่ระยะทางครับ",
            roman: "raa-khaa tàek-dtàang gàn kráp, thák-sîi bprà-maan yîi-sìip-sǎam-sìip baat, rót-fai fáa bprà-maan sìi-sìip hòk-sìip baat",
            chinese: "价格不一样。出租车约200-300泰铢，轻轨约40-60泰铢。",
            vocab: [
              { th: "ราคา", roman: "raa-khaa", cn: "价格" },
              { th: "บาท", roman: "baat", cn: "泰铢" },
              { th: "แพง", roman: "phaeng", cn: "贵" },
            ],
            grammar: "泰国货币单位是「บาท」（泰铢），1泰铢约0.2人民币。",
            culturalNote: "泰国路边摊一碗船面只要20-30泰铢（约4-6元），是最便宜的正餐。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "告别时记得感谢",
        suggestions: ["ขอบคุณมาก", "ลาก่อน", "สนุกมาก", "รักเมืองไทย"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank"],
            thai: "ยินดีครับ! หวังว่าจะช่วยได้นะครับ เที่ยวให้สนุกนะครับ แล้วก็อย่าลืมลองอาหารไทยข้างทางด้วยนะครับ!",
            roman: "yin-dii kráp! wǎng wâa jà chûay dâi ná kráp, thîiao hâi sà-nùk ná kráp!",
            chinese: "不客气！希望能帮到你。玩得开心哦！别忘了尝尝路边美食！",
            vocab: [
              { th: "เที่ยว", roman: "thîiao", cn: "游玩" },
              { th: "ข้างทาง", roman: "khâang thaang", cn: "路边" },
            ],
            grammar: "「ให้」在动词后表示「使...变得...」。",
          },
          {
            keywords: ["ลาก่อน", "bye", "再见"],
            thai: "ลาก่อนครับ ปลอดภัยนะครับ! หวังว่าจะได้เจอกันอีก สวัสดีครับ!",
            roman: "laa-kàawn kráp, plòt-phai ná kráp!",
            chinese: "再见，注意安全！",
            vocab: [],
            grammar: "",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถามผมเรื่องสนามบิน โรงแรม หรือร้านอาหารดูสิครับ!",
      roman: "lɔɔng thǎam phǒm rʉ̌ʉang sà-nǎam-bin róhng-raem rʉ̌ʉ ráan aa-hǎan duu sì kráp!",
      chinese: "试试问我关于机场、酒店或餐厅的问题！",
      vocab: [],
      grammar: "",
    },
  },

  // ═══════════════════════════════════════
  // 餐厅点餐
  // ═══════════════════════════════════════
  {
    id: "restaurant",
    title: "餐厅点餐",
    subtitle: "美食与点餐",
    description: "在泰国餐厅点餐、选口味、结账，体验泰国美食文化。",
    icon: "Utensils",
    sceneEmoji: "🍜",
    sceneTip: "泰国人吃饭用勺子和叉子（不用筷子），左手叉右手勺。",
    greeting: {
      thai: "สวัสดีครับ! ยินดีต้อนรับ นั่งตรงไหนดีครับ อยากทานอะไรเป็นพิเศษวันนี้",
      roman: "sà-wàt-dii kráp! yin-dii tɔ̂ɔn-ráp, nâng trong nǎi dii kráp, yàak thaan à-rai bpen phá-sèt wan níi",
      chinese: "你好！欢迎光临，今天特别想吃什么？",
      speakRate: 0.70,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "坐下后看看菜单",
        suggestions: ["ขอดูเมนู", "แนะนำหน่อย", "อร่อยที่สุด", "มีอะไรดี"],
        responses: [
          {
            keywords: ["เมนู", "menu"],
            thai: "ได้เลยครับ! นี่คือเมนูครับ เมนูแนะนำของร้านคือ ข้าวผัดกะเพรา และ ต้มยำกุ้ง ครับ",
            roman: "dâi loei kráp! nîi khʉʉ mee-nuu kráp",
            chinese: "好的！这是菜单。餐厅推荐菜是「打抛饭」和「冬阴功汤」。",
            vocab: [
              { th: "เมนู", roman: "mee-nuu", cn: "菜单" },
              { th: "แนะนำ", roman: "náe-nam", cn: "推荐" },
              { th: "ข้าวผัดกะเพรา", roman: "khâao-phàt gà-prao", cn: "打抛饭" },
              { th: "ต้มยำกุ้ง", roman: "tôm-yam-kûng", cn: "冬阴功汤" },
            ],
            grammar: "「คือ」是判断动词「是」，用于介绍或解释。",
          },
          {
            keywords: ["แนะนำ", "推荐", "好吃"],
            thai: "วันนี้แนะนำ ผัดไทย ครับ อร่อยมากเลยนะ แล้ว ส้มตำ ก็อร่อยเหมือนกัน ชอบเผ็ดไหมครับ",
            roman: "wan níi náe-nam phàt-thai kráp, a-rɔ̀i mâak loei ná, láew sǒm-dtam gɔ̀o a-rɔ̀i mʉ̌ʉan gàn",
            chinese: "今天推荐「泰式炒粉」，非常好吃！还有「木瓜沙拉」也不错。你喜欢辣吗？",
            vocab: [
              { th: "ผัดไทย", roman: "phàt-thai", cn: "泰式炒粉" },
              { th: "ส้มตำ", roman: "sǒm-dtam", cn: "木瓜沙拉" },
              { th: "เผ็ด", roman: "phèt", cn: "辣" },
            ],
            grammar: "注意泰国菜辣度可以要求：ไม่เผ็ด（不辣）、เผ็ดนิดหน่อย（微辣）。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "说明你的口味偏好",
        suggestions: ["ไม่เผ็ด", "เผ็ดมาก", "ไม่มีเนื้อวัว", "ขอไข่ดาว"],
        responses: [
          {
            keywords: ["ไม่เผ็ด", "不辣"],
            thai: "ได้เลยครับ ไม่เผ็ดสำหรับคุณครับ แล้วอยากใส่อะไรเพิ่มไหมครับ เช่น ไข่ดาว หรือ ข้าวเพิ่ม",
            roman: "dâi loei kráp, mâi phèt sǎm-ràp khun kráp",
            chinese: "好的，给你做不辣的。要加什么吗？比如煎蛋或加饭。",
            vocab: [
              { th: "ไข่ดาว", roman: "khài-daao", cn: "煎蛋" },
              { th: "เพิ่ม", roman: "bperm", cn: "增加" },
            ],
            grammar: "「สำหรับ」= 给/对于。",
          },
          {
            keywords: ["เนื้อ", "meat", "牛肉"],
            thai: "ไม่มีเนื้อวัวครับ ลอง ไก่ หรือ หมู ดูไหมครับ อร่อยเหมือนกันเลยนะ",
            roman: "mâi mii nʉ̌a wua kráp, lɔɔng gài rʉ̌ʉ mǔu duu mái kráp",
            chinese: "没有牛肉。试试鸡肉或猪肉？一样好吃。",
            vocab: [
              { th: "ไก่", roman: "gài", cn: "鸡" },
              { th: "หมู", roman: "mǔu", cn: "猪" },
            ],
            grammar: "佛教在泰国影响深远，很多泰国人吃素。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "菜来了，评价一下",
        suggestions: ["อร่อยมาก", "เผ็ดไปหน่อย", "สดมาก", "เท่าไหร่"],
        responses: [
          {
            keywords: ["อร่อย", "好吃"],
            thai: "ขอบคุณครับ! ดีใจที่ชอบ! ถ้ามาอีกครั้งลอง แกงเขียวหวาน ด้วยนะครับ",
            roman: "khàawp-khun kráp! dii-jai thîi chɔ̀ɔp!",
            chinese: "谢谢！很高兴你喜欢！下次来试试「绿咖喱」哦。",
            vocab: [
              { th: "แกงเขียวหวาน", roman: "gaeng kîaw-wǎan", cn: "绿咖喱" },
            ],
            grammar: "「จริงๆ」用于强调真实程度。",
          },
          {
            keywords: ["เผ็ด", "spicy", "辣"],
            thai: "ขอโทษครับ! เดี๋ยวให้เชฟลดความเผ็ดให้นะครับ หรือจะสั่ง ข้าวเปล่า มาช่วยกินคู่กันก็ได้ครับ",
            roman: "khǎaw-tôht kráp! dǐao hâi chef lót khwaam phèt hâi ná kráp",
            chinese: "对不起！我让厨师减辣，或者点一碗白饭配着吃也行。",
            vocab: [
              { th: "ข้าวเปล่า", roman: "khâao-plào", cn: "白饭" },
              { th: "ขอโทษ", roman: "khǎaw-tôht", cn: "对不起" },
            ],
            grammar: "「เดี๋ยวให้...」= 马上让...做。是餐厅中很地道的表达。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "准备结账走人",
        suggestions: ["เก็บเงิน", "ขอบคุณมาก", "จะมาอีก", "อร่อยที่สุด"],
        responses: [
          {
            keywords: ["เก็บเงิน", "买单", "จ่ายเงิน", "check"],
            thai: "ได้เลยครับ! ทั้งหมด 285 บาทครับ จ่ายเงินสดหรือบัตรเครดิตครับ",
            roman: "dâi loei kráp! táng-mòt yîi-sàam-sàam-hâi baat kráp",
            chinese: "好的！一共285泰铢。现金还是刷卡？",
            vocab: [
              { th: "ทั้งหมด", roman: "táng-mòt", cn: "总共" },
              { th: "เงินสด", roman: "ngəən sòt", cn: "现金" },
            ],
            grammar: "「เงินสด」= 现金，「บัตรเครดิต」= 信用卡。街头小摊通常只收现金。",
          },
          {
            keywords: ["ขอบคุณ", "thank"],
            thai: "ขอบคุณครับ! ยินดีต้อนรับครั้งหน้านะครับ ลาก่อน!",
            roman: "khàawp-khun kráp!",
            chinese: "谢谢！欢迎下次光临，再见！",
            vocab: [],
            grammar: "",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ได้เลยครับ! ลองสั่ง ข้าวผัด หรือ ต้มยำกุ้ง ได้นะครับ!",
      roman: "dâi loei kráp!",
      chinese: "好的！可以试试点炒饭或冬阴功汤。",
      vocab: [],
      grammar: "",
    },
  },

  // ═══════════════════════════════════════
  // 校园生活
  // ═══════════════════════════════════════
  {
    id: "campus",
    title: "校园生活",
    subtitle: "学校与学习",
    description: "模拟泰国大学校园场景：与同学交流、请教老师、参加社团。",
    icon: "GraduationCap",
    sceneEmoji: "🎓",
    sceneTip: "泰国大学的学年从6月开始。学生称老师为「อาจารย์」。",
    greeting: {
      thai: "สวัสดีครับ นักเรียน! วันนี้เรียนหนักไหมครับ มาตอนเช้ามากเลยนะ",
      roman: "sà-wàt-dii kráp, nák-rian! wan níi rian nàk mái kráp",
      chinese: "你好同学！今天课忙吗？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "和同学打招呼",
        suggestions: ["เรียนวิชาอะไร", "วันนี้มีเรียน", "เหนื่อยมาก", "สนุกดี"],
        responses: [
          {
            keywords: ["เรียน", "learn", "上课"],
            thai: "วันนี้มีวิชาคณิตศาสตร์ตอนเช้า แล้วก็ภาษาอังกฤษตอนบ่าย คุณล่ะครับ",
            roman: "wan níi mii wí-chaa khà-nít-sàat tɔ̀ɔn cháo, láew gɔ̀o phaa-sǎa ang-grìt tɔ̀ɔn bpài",
            chinese: "今天早上有数学课，下午有英语课。你呢？",
            vocab: [
              { th: "วิชา", roman: "wí-chaa", cn: "科目" },
              { th: "ตอนเช้า", roman: "tɔ̀ɔn cháo", cn: "早上" },
              { th: "ตอนบ่าย", roman: "tɔ̀ɔn bpài", cn: "下午" },
            ],
            grammar: "「แล้วก็」= 然后/还有。泰语时间词放在动词之后。",
          },
          {
            keywords: ["เหนื่อย", "累", "tired"],
            thai: "เหนื่อยเหมือนกันครับ! แต่เที่ยงนี้ไปกินข้าวที่โรงอาหารด้วยกันไหมครับ",
            roman: "nʉ̌ʉei mʉ̌ʉan gàn kráp!",
            chinese: "我也累！但中午一起去食堂吃饭好吗？",
            vocab: [
              { th: "โรงอาหาร", roman: "roong-aa-hǎan", cn: "食堂" },
            ],
            grammar: "「ด้วยกัน」= 一起。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "聊聊学习的事",
        suggestions: ["การบ้านเยอะ", "สอบยาก", "อาจารย์สอนดี", "ห้องสมุด"],
        responses: [
          {
            keywords: ["การบ้าน", "homework", "作业"],
            thai: "การบ้านภาษาไทยเยอะเหมือนกันครับ คุณทำการบ้านเสร็จหรือยังครับ",
            roman: "kaan-bâan phaa-sǎa thai yəə mʉ̌ʉan gàn kráp",
            chinese: "泰语作业也很多呢。你做完了吗？",
            vocab: [
              { th: "การบ้าน", roman: "kaan-bâan", cn: "作业" },
              { th: "เสร็จ", roman: "sèt", cn: "完成" },
            ],
            grammar: "「ถ้ายังไม่เสร็จ」= 如果还没完成。",
          },
          {
            keywords: ["สอบ", "exam", "考试"],
            thai: "สอบสัปดาห์หน้าเลยนะครับ! ผมก็ยังไม่ค่อยพร้อมเหมือนกัน ลองนัดติวกันไหมครับ",
            roman: "sàwp sàp-daa nâa loei ná kráp!",
            chinese: "下周就考试了！我也没太准备好。要不要约着一起复习？",
            vocab: [
              { th: "สอบ", roman: "sàwp", cn: "考试" },
              { th: "พร้อม", roman: "phrom", cn: "准备好" },
            ],
            grammar: "「นัดติว」= 约着补习/复习。ติว是从英文tutor音译来的。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "约吃饭或活动",
        suggestions: ["ไปกินข้าว", "ไปคาเฟ่", "ไปห้องสมุด", "เข้าชมรม"],
        responses: [
          {
            keywords: ["ข้าว", "กิน", "吃饭"],
            thai: "ไปโรงอาหารกันเลยครับ! วันนี้มี ข้าวมันไก่ กับ ข้าวกระเพรา ครับ ไปกัน!",
            roman: "pai roong-aa-hǎan gàn loei kráp!",
            chinese: "去食堂吧！今天有「海南鸡饭」和「打抛饭」。走！",
            vocab: [
              { th: "ข้าวมันไก่", roman: "khâao-man-gài", cn: "海南鸡饭" },
            ],
            grammar: "「เลย」在此处表示「干脆就...」。",
          },
          {
            keywords: ["คาเฟ่", "cafe", "咖啡"],
            thai: "ไปคาเฟ่ตรงข้ามมหาวิทยาลัยดีกว่า อร่อยมากเลยนะ!",
            roman: "pai kaa-féh trong khǎam maa-há-wít-tha-yaa-lai dii gwàa",
            chinese: "去大学对面的咖啡馆吧，非常好喝！",
            vocab: [
              { th: "มหาวิทยาลัย", roman: "maa-há-wít-tha-yaa-lai", cn: "大学" },
            ],
            grammar: "泰国的คาเฟ่文化非常兴盛。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "回教室前告别",
        suggestions: ["ขอบคุณ", "ไปเรียนกัน", "สนุกมาก", "แล้วเจอกัน"],
        responses: [
          {
            keywords: ["ไปเรียน", "上课"],
            thai: "ได้เลยครับ ไปเรียนกันเถอะ! ตั้งใจเรียนนะครับ แล้วเจอกันตอนพักเบรก!",
            roman: "dâi loei kráp, pai rian gàn tèr!",
            chinese: "走吧，去上课！好好学习，课间见！",
            vocab: [
              { th: "ตั้งใจ", roman: "tâng-jai", cn: "用心/专心" },
            ],
            grammar: "「เลย」+ 动词 + 「เถอะ」表示提议。",
          },
          {
            keywords: ["ขอบคุณ", "thank", "แล้วเจอกัน"],
            thai: "ไม่เป็นไรครับ! เป็นเพื่อนกันแล้ว สนุกที่ได้คุยครับ แล้วเจอกัน!",
            roman: "mâi bpen rai kráp!",
            chinese: "不客气！已经是朋友了，聊天很开心。再见！",
            vocab: [
              { th: "เพื่อน", roman: "phʉ̌ʉan", cn: "朋友" },
            ],
            grammar: "",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถามเรื่องเรียน หรือกิจกรรมในมหาวิทยาลัยดูสิครับ!",
      roman: "lɔɔng thǎam rʉ̌ʉang rian rʉ̌ʉ gag-jà-gam duu sì kráp!",
      chinese: "试试聊聊学习或大学活动吧！",
      vocab: [],
      grammar: "",
    },
  },

  // ═══════════════════════════════════════
  // 购物交流
  // ═══════════════════════════════════════
  {
    id: "shopping",
    title: "购物交流",
    subtitle: "市场与砍价",
    description: "在泰国市场购物、砍价、试穿，体验泰国独特的购物文化。",
    icon: "ShoppingBag",
    sceneEmoji: "🛍️",
    sceneTip: "泰国市场砍价是很正常的！一般可以从报价的 60%-70% 开始还。",
    greeting: {
      thai: "ยินดีต้อนรับครับ! ของเยอะมากเลยนะ อยากได้อะไรดีครับ",
      roman: "yin-dii tɔ̂ɔn-ráp kráp! khɔ̌ɔng yəə mâak loei ná, yàak dâai à-rai dii kráp",
      chinese: "欢迎光临！东西很多呢，想看点什么？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "看看想买什么",
        suggestions: ["เท่าไหร่", "ราคา多少", "ดูหน่อย", "มีสีอะไร"],
        responses: [
          {
            keywords: ["เท่าไหร่", "多少钱", "price", "ราคา"],
            thai: "อันนี้ราคา 350 บาทครับ ลดได้ครับ ถ้าซื้อหลายชิ้น",
            roman: "an níi raa-khaa sǎam-mʉ̌ʉng-hâi baat kráp",
            chinese: "这个350泰铢，如果买多件可以便宜。",
            vocab: [
              { th: "ซื้อ", roman: "sʉ́y", cn: "买" },
              { th: "ลด", roman: "lót", cn: "打折/降价" },
            ],
            grammar: "泰国市场砍价的标准开场。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "砍价环节",
        suggestions: ["ลดหน่อย", "200 ได้ไหม", "แพงไป", "ลดได้อีกไหม"],
        responses: [
          {
            keywords: ["ลด", "便宜", "200", "ถูก", "แพง"],
            thai: "200 บาทไม่ได้ครับ ทุนยังไม่ถึงเลย ให้ 280 ได้ไหมครับ ราคานี้จริงๆ แล้ว",
            roman: "yîi-sìip baat mâi dâi kráp, thun yáng mâi thʉ̌ng loei",
            chinese: "200泰铢不行哦，成本都不止。280可以吗？",
            vocab: [
              { th: "ทุน", roman: "thun", cn: "成本" },
            ],
            grammar: "泰国商家说「ทุนไม่ถึง」是表示已经很便宜了。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "成交或继续逛",
        suggestions: ["เอาตัวนี้", "ขอบคุณ", "ขอดูอีกหน่อย", "จ่ายเงิน"],
        responses: [
          {
            keywords: ["เอา", "要", "take"],
            thai: "ได้เลยครับ! จะห่อให้ จ่ายเงินสดหรือพร้อมเพย์ครับ",
            roman: "dâi loei kráp!",
            chinese: "好的！帮你包起来。现金还是PromptPay？",
            vocab: [
              { th: "เอา", roman: "ao", cn: "要" },
            ],
            grammar: "「เอา」在口语中表示「要」，非常常用的万能词。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "付款告别",
        suggestions: ["ขอบคุณ", "ถูกดี", "จะมาอีก", "ลาก่อน"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "จะมาอีก"],
            thai: "ขอบคุณครับ! ซื้อเก่งมากเลยนะ ครั้งหน้ามาใหม่นะครับ จะลดให้อีก!",
            roman: "khàawp-khun kráp! sʉ́y gèng mâak loei ná!",
            chinese: "谢谢！很会买东西呢。下次再来哦，再给你打折！",
            vocab: [
              { th: "ซื้อเก่ง", roman: "sʉ́y gèng", cn: "会买东西" },
            ],
            grammar: "「เก่ง」在泰语中用途极广，用来赞美各种能力。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถาม เท่าไหร่ หรือ ลดได้ไหม ดูสิครับ!",
      roman: "lɔɔng thǎam thâo-rài rʉ̌ʉ lót dâi mái duu sì kráp!",
      chinese: "试试问问「多少钱」或「能便宜吗」！",
      vocab: [],
      grammar: "",
    },
  },

  // ═══════════════════════════════════════
  // 文化体验
  // ═══════════════════════════════════════
  {
    id: "culture",
    title: "文化体验",
    subtitle: "传统与习俗",
    description: "深入了解泰国传统文化：节日、佛教、礼仪和生活方式。",
    icon: "Landmark",
    sceneEmoji: "🏯",
    sceneTip: "泰国被称为「สยามเมืองยิ้ม」（微笑之国），微笑是理解泰国文化的钥匙。",
    greeting: {
      thai: "สวัสดีครับ! วันนี้จะพาไปรู้จักวัฒนธรรมไทยครับ มีอะไรอยากรู้บ้างไหมครับ",
      roman: "sà-wàt-dii kráp! wan níi jà paa pai rúu-jàk wát-thá-ná-tham thai kráp",
      chinese: "你好！今天来了解泰国文化。有什么想了解的吗？",
      speakRate: 0.70,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "聊聊泰国文化",
        suggestions: ["วันสำคัญ", "วัฒนธรรม", "ศาสนา", "การไหว้"],
        responses: [
          {
            keywords: ["วันสำคัญ", "festival", "节日", "สงกรานต์"],
            thai: "วันสงกรานต์เป็นปีใหม่ไทย ตรงกับเดือนเมษายน ทุกคนจะเล่นน้ำกันสนุกมากเลยนะครับ",
            roman: "wan sǒng-graan bpen bpii-mài thai",
            chinese: "泼水节是泰国新年，在四月份。所有人都会玩水，非常开心。",
            vocab: [
              { th: "สงกรานต์", roman: "sǒng-graan", cn: "泼水节" },
              { th: "ลอยกระทง", roman: "loei krá-thong", cn: "水灯节" },
            ],
            grammar: "泰国最重要的节日：สงกรานต์（泼水节，4月）、ลอยกระทง（水灯节，11月）。",
            culturalNote: "泼水节（宋干节）是泰国新年，全泰国放假4天。",
          },
          {
            keywords: ["การไหว้", "ไหว้", "wai", "合十礼"],
            thai: "การไหว้เป็นส่วนหนึ่งของวัฒนธรรมไทยเลยนะครับ ไหว้พระ ไหว้ผู้ใหญ่ ไหว้เพื่อน แต่ละคนไม่เหมือนกัน",
            roman: "kan wâi bpen sùan nʉ̀ng khɔ̌ɔng wát-thá-ná-tham thai loei ná kráp",
            chinese: "合十礼是泰国文化的一部分。拜佛、拜长辈、拜朋友，每个人都不一样。",
            vocab: [
              { th: "ไหว้พระ", roman: "wâi phrá", cn: "拜佛" },
              { th: "ไหว้ผู้ใหญ่", roman: "wâi phûu-yài", cn: "拜长辈" },
            ],
            grammar: "双手合十的高度表示尊敬的程度。",
            culturalNote: "平辈手放胸口，对长辈手放鼻子，对僧侣手放额头，对国王手放额头并鞠躬。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "继续深入了解",
        suggestions: ["ศาสนาพุทธ", "พระ", "วัด", "นั่งสมาธิ"],
        responses: [
          {
            keywords: ["ศาสนา", "宗教", "พุทธ"],
            thai: "ประเทศไทยนับถือศาสนาพุทธเป็นหลัก วัดมีทุกจังหวัดเลยนะครับ คนไทยจะทำบุญทุกวันพระ",
            roman: "bprà-thêet thai náp-thʉʉ sà-tǎa-sǎa phút bpen lák",
            chinese: "泰国以佛教为主，每个省都有寺庙。泰国人在佛日会做功德。",
            vocab: [
              { th: "ศาสนาพุทธ", roman: "sà-tǎa-sǎa phút", cn: "佛教" },
              { th: "วัด", roman: "wát", cn: "寺庙" },
              { th: "ทำบุญ", roman: "tham-bun", cn: "做功德" },
            ],
            grammar: "「วันพระ」= 佛日（每月四天），虔诚的佛教徒会在这天吃素。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "告别",
        suggestions: ["ขอบคุณ", "รู้了很多", "สนุกมาก", "ลาก่อน"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank"],
            thai: "ยินดีครับ! วัฒนธรรมไทยมีอะไรมากมายเลยนะ ถ้าอยากรู้เพิ่มลองไปวัดด้วยตัวเองนะครับ!",
            roman: "yin-dii kráp!",
            chinese: "不客气！泰国文化还有很多。想了解更多可以亲自去寺庙看看！",
            vocab: [],
            grammar: "",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถามเรื่องวันสำคัญ การไหว้ หรือศาสนาพุทธดูสิครับ!",
      roman: "lɔɔng thǎam rʉ̌ʉang wan sǎm-khǎn duu sì kráp!",
      chinese: "试试聊聊节日、合十礼或佛教吧！",
      vocab: [],
      grammar: "",
    },
  },

  // ═══════════════════════════════════════
  // 职场泰语
  // ═══════════════════════════════════════
  {
    id: "workplace",
    title: "职场泰语",
    subtitle: "商务与工作",
    description: "学习泰国职场用语：面试、会议、邮件和商务礼仪。",
    icon: "Briefcase",
    sceneEmoji: "💼",
    sceneTip: "泰国职场非常注重层级关系，和上司说话要用「ครับ/ค่ะ」。",
    greeting: {
      thai: "สวัสดีครับ! ยินดีต้อนรับสู่บริษัทครับ คุณมาสัมภาษณ์งานใช่ไหมครับ",
      roman: "sà-wàt-dii kráp! yin-dii tɔ̂ɔn-ráp sùu baw-rí-sàt kráp",
      chinese: "你好！欢迎来到公司。你是来面试的吧？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "开始面试对话",
        suggestions: ["สวัสดีครับ", "ใช่ครับ", "ผมชื่อ", "มาสัมภาษณ์"],
        responses: [
          {
            keywords: ["ใช่", "ครับ", "สวัสดี", "yes", "hello"],
            thai: "ครับ แนะนำตัวหน่อยได้ไหมครับ บอกชื่อ ประสบการณ์ และเหตุผลที่อยากทำงานที่นี่",
            roman: "kráp, náe-nam dtua nɔ̀i dâi mái kráp",
            chinese: "好的，请自我介绍一下。",
            vocab: [
              { th: "แนะนำตัว", roman: "náe-nam dtua", cn: "自我介绍" },
              { th: "ประสบการณ์", roman: "bprà-sòp-gaan", cn: "经验" },
            ],
            grammar: "泰语面试常用词组。",
            culturalNote: "泰国面试时态度谦逊比能力展示更重要。表现出好学和团队精神。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "继续面试问答",
        suggestions: ["ผมทำงานได้", "เรียนภาษาไทย", "ทีมเวิร์คดี", "ขยันทำงาน"],
        responses: [
          {
            keywords: ["ทำงาน", "ทีม", "เรียน", "work"],
            thai: "ดีมากครับ! คุณพูดภาษาไทยได้ดีมาก ถ้าเข้ามาทำงานที่นี่ ต้องติดต่อกับลูกค้าไทยบ่อยๆ นะครับ",
            roman: "dii mâak kráp!",
            chinese: "很好！你的泰语说得很好。如果来这里工作，需要经常和泰国客户联系。",
            vocab: [
              { th: "ลูกค้า", roman: "lûuk-khá", cn: "客户" },
              { th: "บ่อยๆ", roman: "bɔ̀i-bɔ̀i", cn: "经常" },
            ],
            grammar: "「บ่อยๆ」= 经常/频繁。重复使用表示频率高。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "面试结束",
        suggestions: ["ขอบคุณ", "รอผล", "จะตั้งใจทำงาน", "ลาก่อน"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "ตั้งใจ"],
            thai: "ขอบคุณครับ! เราจะติดต่อกลับภายในสัปดาห์นี้ ขอให้โชคดีนะครับ!",
            roman: "khàawp-khun kráp!",
            chinese: "谢谢！我们会在本周内联系你。祝你好运！",
            vocab: [
              { th: "ภายใน", roman: "bpaai-nai", cn: "在...之内" },
              { th: "โชคดี", roman: "chôok-dii", cn: "好运" },
            ],
            grammar: "「ภายใน + 时间」= 在...之内。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองแนะนำตัวเป็นภาษาไทยสิครับ!",
      roman: "lɔɔng náe-nam dtua bpen phaa-sǎa thai sì kráp!",
      chinese: "试着用泰语自我介绍吧！",
      vocab: [],
      grammar: "",
    },
  },
];

// 通用对话进度配置
export const CONVERSATION_CONFIG = {
  maxStages: 4,
  typingDelay: { min: 800, max: 1800 },
  stageTransitionDelay: 300,
};
