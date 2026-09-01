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
  // ═══════════════════════════════════════
  // AI 情景模拟 — 沉浸式角色扮演
  // ═══════════════════════════════════════
  {
    id: "airport",
    title: "机场值机",
    subtitle: "曼谷素万那普机场",
    description: "在曼谷机场办理登机、过安检、找到登机口，体验泰国机场的真实流程。",
    icon: "Plane",
    sceneEmoji: "✈️",
    sceneTip: "泰国机场工作人员通常会说泰语和英语，但用泰语沟通会更亲切。记住机场常用词：เที่ยวบิน（航班）、บัตรโดยสาร（登机牌）。",
    roleplay: { character: "机场工作人员", role: "airport staff" },
    greeting: {
      thai: "สวัสดีครับ! ยินดีต้อนรับสู่สนามบินสุวรรณภูมิ ช่วยแสดงพาสปอร์ตกับตั๋วเครื่องบินด้วยครับ",
      roman: "sà-wàt-dii kráp! yin-dii tɔ̂ɔn-ráp sùu sà-nǎam-bin sù-wan-ná-phûum, chûay tâang pâat-bpòt kap tûua krʉ̌ng-bin dwóy kráp",
      chinese: "你好！欢迎来到素万那普机场，请出示护照和机票。",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "办理值机手续",
        suggestions: ["ขอเช็คอิน", "มีเที่ยวบินไปภูเก็ต", "ขอดูบัตรโดยสาร", "ขอบัตรนั่งริมหน้าต่าง"],
        responses: [
          {
            keywords: ["เช็คอิน", "check", "值机"],
            thai: "ได้เลยครับ! ขอพาสปอร์ตกับหมายเลขเที่ยวบินด้วยครับ คุณเดินทางไปไหนครับ",
            roman: "dâi loei kráp! khǎw pâat-bpòt kap mãai-lêe-aai thîiao-bin dwóy kráp, khun dəən-thaang pai nǎi kráp",
            chinese: "好的！请给我护照和航班号。您要去哪里？",
            vocab: [
              { th: "เช็คอิน", roman: "check-in", cn: "值机/登记" },
              { th: "หมายเลขเที่ยวบิน", roman: " mãai-lêe-aai thîiao-bin", cn: "航班号" },
              { th: "พาสปอร์ต", roman: "pâat-bpòt", cn: "护照" },
            ],
            grammar: "「ขอ」= 请给我…，是泰国最常用的礼貌请求词。ขอ + 名词 = 请给我某物。",
          },
          {
            keywords: ["ภูเก็ต", "phuket", "普吉"],
            thai: "เที่ยวบิน TG201 ไปภูเก็ตครับ ออกเดินทาง 14:30 น. ตอนนี้柜台เปิดแล้ว คุณมีกระเป๋าโหลดไหมครับ",
            roman: "thîiao-bin TG201 pai phûu-gèt kráp, àwk dəən-thaang 14:30 ní, tɔ̀ɔn-níi柜台 bəət láew, khun mii grà-bpaa lôod mái kráp",
            chinese: "TG201航班飞普吉，14:30出发。现在柜台已经开了，有行李要托运吗？",
            vocab: [
              { th: "ออกเดินทาง", roman: "àwk dəən-thaang", cn: "出发" },
              { th: "กระเป๋า", roman: "grà-bpaa", cn: "行李/包" },
              { th: "โหลด", roman: "lôod", cn: "托运" },
            ],
            grammar: "「น.」是泰语「นาฬิกา」的缩写，用于报时间。14:30 น. = 下午2点半。",
            culturalNote: "泰国机场安检时需要脱鞋和腰带，建议穿方便穿脱的鞋子。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "询问座位和行李",
        suggestions: ["ขอบัตรนั่งริมหน้าต่าง", "มีน้ำหนักเกิน", "ขอเปลี่ยนที่นั่ง", "ขอบัตรขึ้นเครื่อง"],
        responses: [
          {
            keywords: ["หน้าต่าง", "window", "窗口"],
            thai: "ได้เลยครับ! คุณนั่ง窗口Aครับ ใกล้หน้าต่างมองเห็นวิวสวยมาก น้ำหนักกระเป๋าเกินนะครับ กิโลเกิน 2 กิโล ต้องจ่ายเพิ่ม 600 บาท",
            roman: "dâi loei kráp! khun nâng windowA kráp, glàai nàa-dtàang mɔɔng hěn wíiwa sǔay mâak",
            chinese: "好的！您坐A靠窗位，靠近窗户可以看到漂亮风景。行李超重了，超2公斤需要加600泰铢。",
            vocab: [
              { th: "ริมหน้าต่าง", roman: "rim nàa-dtàang", cn: "靠窗" },
              { th: "น้ำหนักเกิน", roman: "nám-nàk gəən", cn: "超重" },
              { th: "จ่ายเพิ่ม", roman: "jài pə̂əm", cn: "加钱" },
            ],
            grammar: "「เกิน」= 超过/超出。น้ำหนักเกิน = 超重，时间เกิน = 超时。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "过安检",
        suggestions: ["ต้องถอดรองเท้า", "กระเป๋ามีโน้ตบุ๊ค", "ของเหลวต้องนำออกมา", "ขอบคุณครับ"],
        responses: [
          {
            keywords: ["ถอด", "shoes", "脱"],
            thai: "ครับ ต้องถอดรองเท้า สายรัดเข็มขัด และนำnotebook ออกจากกระเป๋าด้วยนะครับ ของเหลวต้องใส่ถุงziplockไม่เกิน100มล",
            roman: "kráp, dtông thòt rɔɔng-táe, sǎai-rák khěm-kàt láe nam notebook àwk jàak grà-bpaa dwóy ná kráp, khɔ̌ɔng-lěu dtông sài dûuk ziplock mâi gəən 100 m.l.",
            chinese: "是的，要脱鞋、解腰带，笔记本电脑要从包里拿出来。液体要装在ziplock袋里不超过100毫升。",
            vocab: [
              { th: "ถอด", roman: "thòt", cn: "脱（衣物）" },
              { th: "สายรัดเข็มขัด", roman: "sǎai-rák khěm-kàt", cn: "腰带" },
              { th: "ของเหลว", roman: "khɔ̌ɔng-lěu", cn: "液体" },
            ],
            grammar: "「ต้อง」= 必须/需要。是最常用的情态动词之一。ต้อง + 动词 = 必须做某事。",
            culturalNote: "泰国安检相对严格，电子设备和液体都要单独取出。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "找到登机口",
        suggestions: ["gate อยู่ตรงไหน", "ขึ้นเครื่องกี่โมง", "ขอบคุณครับ", "ลาก่อนครับ"],
        responses: [
          {
            keywords: ["gate", "登机口", "ขึ้นเครื่อง"],
            thai: "Gate อยู่ชั้น 2 ตรงป้ายไปทางซ้ายครับ ขึ้นเครื่อง 14:00 น. ควรไปถึงก่อน 30 นาทีนะครับ สนุกกับเที่ยวบินครับ!",
            roman: "Gate yùu chán sɔ̌ɔng trong paai taang sáai kráp, khʉ̌ng krʉ̌ung 14:00 ní, khuan pai thʉ̌ung gɔ̀awn sǎam-sìp naa-thíi ná kráp, sà-nùk khap thîiao-bin kráp!",
            chinese: "登机口在2楼，往左走看指示牌。14:00登机，建议提前30分钟到。祝旅途愉快！",
            vocab: [
              { th: "ชั้น", roman: "chán", cn: "楼层" },
              { th: "ก่อน", roman: "gɔ̀awn", cn: "之前/提前" },
              { th: "สนุก", roman: "sà-nùk", cn: "开心/愉快" },
            ],
            grammar: "「ควร」= 应该/最好。.should 是比「ต้อง」更柔和的建议语气。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ไม่เป็นไรครับ ลองพูดเป็นภาษาไทยอีกครั้งนะครับ! 机场里常用：ขอ... ด้วยครับ",
      roman: "mâi bpen-rai kráp, lɔɔng pûut bpen phaa-sǎa thai ìik kráng ná kráp!",
      chinese: "没关系，再试着用泰语说一次！机场里常用：请给我…",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "hotel",
    title: "酒店入住",
    subtitle: "曼谷精品酒店",
    description: "在泰国酒店办理入住、询问设施、请求服务，学习酒店场景的实用泰语。",
    icon: "Landmark",
    sceneEmoji: "🏨",
    sceneTip: "泰国酒店服务员通常会主动说泰语打招呼。入住时可以用「ขอเช็คอิน」，退房用「เช็คเอาท์」。",
    roleplay: { character: "酒店前台", role: "hotel receptionist" },
    greeting: {
      thai: "สวัสดีค่ะ! ยินดีต้อนรับสู่โรงแรมค่ะ มีอะไรให้ช่วยคะ จองห้องไว้แล้วใช่ไหมคะ",
      roman: "sà-wàt-dii ká! yin-dii tɔ̂ɔn-ráp sùu rohng-raem ká, mii à-rai hâi chûay ká, jɔ̌ɔng hɔ̌ɔng wái láew châi mái ká",
      chinese: "你好！欢迎来到酒店。有什么可以帮您的？已经预订了房间对吗？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "办理入住",
        suggestions: ["ขอเช็คอิน", "จองห้องไว้แล้ว", "ขอห้องวิวสวย", "มีสระว่ายน้ำไหม"],
        responses: [
          {
            keywords: ["เช็คอิน", "check", "จอง"],
            thai: "ค่ะ ขอพาสปอร์ตด้วยค่ะ คุณจองห้อง Deluxe วิวสระว่ายน้ำไว้ 3 คืน ใช่ไหมคะ ราคาคืนละ 2,500 บาท",
            roman: "ká, khǎw pâat-bpòt dwóy ká, khun jɔ̌ɔng hɔ̌ɔng Deluxe wíiwa sà-wâang-náam wái sǎam kʉn châi mái ká, raakaa kʉn lá 2,500 bàat",
            chinese: "好的，请给我护照。您预订了豪华泳池景房3晚对吗？每晚2500泰铢。",
            vocab: [
              { th: "ห้อง", roman: "hɔ̌ɔng", cn: "房间" },
              { th: "สระว่ายน้ำ", roman: "sà-wâang-náam", cn: "游泳池" },
              { th: "คืนละ", roman: "kʉn lá", cn: "每晚" },
            ],
            grammar: "「ละ」用在价格后面表示「每个」，如 คืนละ = 每晚，อันละ = 每个。",
            culturalNote: "泰国酒店一般下午2点入住、中午12点退房。提前入住可能需要加钱。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "询问酒店设施",
        suggestions: [" WiFi รหัสอะไร", "อาหารเช้ากี่โมง", "มีสปาไหม", "ขอยืมผ้าเช็ดตัว"],
        responses: [
          {
            keywords: ["wifi", "WiFi", "รหัส"],
            thai: "WiFi ชื่อ Hotel_Guest รหัสอยู่ในบัตรคีย์การ์ดค่ะ อาหารเช้าเสริฟ 6:30-10:00 ที่ห้องอาหารชั้น 1 ค่ะ",
            roman: "WiFi chʉʉ Hotel_Guest rá-kàt yùu nai bâat key card ká, aa-hǎan cháo sǎ-ríp 6:30-10:00 thîi hɔ̌ɔng aa-hǎan chán nʉ̀ng ká",
            chinese: "WiFi名是Hotel_Guest，密码在房卡上。早餐6:30-10:00在1楼餐厅。",
            vocab: [
              { th: "รหัส", roman: "rá-kàt", cn: "密码" },
              { th: "อาหารเช้า", roman: "aa-hǎan cháo", cn: "早餐" },
              { th: "ห้องอาหาร", roman: "hɔ̌ɔng aa-hǎan", cn: "餐厅" },
            ],
            grammar: "「ที่」= 在某处，是地点介词。ที่ห้องอาหาร = 在餐厅。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "请求客房服务",
        suggestions: ["ขอผ้าเช็ดตัวเพิ่ม", "สั่งอาหารไปห้อง", "ขอหมอนเพิ่ม", "น้ำหมดแล้ว"],
        responses: [
          {
            keywords: ["ผ้าเช็ดตัว", "towel", "毛巾"],
            thai: "ได้ค่ะ ส่งไปให้เลยค่ะ อีก 5 นาที ค่ะ ระหว่างรอ อยากสั่งอะไรไปทานในห้องไหมคะ มีเซ็ตอาหารไทยด้วยค่ะ",
            roman: "dâi ká, sùng pai hâi loei ká, ìik hâa naa-thíi ká, rá-wàang rǎw yàak sâng à-rai pai thaan nai hɔ̌ɔng mái ká, mii set aa-hǎan thai dwóy ká",
            chinese: "好的，马上给您送过去，5分钟内。等待的时候想点什么吃的吗？有泰式套餐。",
            vocab: [
              { th: "ผ้าเช็ดตัว", roman: "phâa khèt dtua", cn: "毛巾" },
              { th: "สั่ง", roman: "sâng", cn: "点/下单" },
              { th: "ในห้อง", roman: "nai hɔ̌ɔng", cn: "在房间里" },
            ],
            grammar: "「ระหว่าง」= 在…期间。ระหว่างรอ = 在等待的时候。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "退房",
        suggestions: ["เช็คเอาท์", "ขอบิล", "ขอเช็คเอาท์", "ขอบคุณมาก"],
        responses: [
          {
            keywords: ["เช็คเอาท์", "check out", "บิล"],
            thai: "ค่ะ บิลอยู่นี้ค่ะ รวม 7,500 บาท ค่ะ จ่ายเงินสดหรือบัตรเครดิตคะ ต้องการใบเสร็จไหมคะ",
            roman: "ká, bin yùu níi ká, ruam 7,500 bàat ká, jài ngəən sòt rá-rûe bâat credit ká, dtông-gaan baai-rèt mái ká",
            chinese: "好的，账单在这里，共7500泰铢。现金还是信用卡？需要收据吗？",
            vocab: [
              { th: "บิล", roman: "bin", cn: "账单" },
              { th: "ใบเสร็จ", roman: "baai-rèt", cn: "收据" },
              { th: "เงินสด", roman: "ngəən sòt", cn: "现金" },
            ],
            grammar: "「หรือ」= 或者，用于连接两个选项。จ่ายเงินสดหรือบัตร = 现金还是卡？",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ไม่เป็นไรค่ะ ลองพูดใหม่อีกครั้งนะคะ! 酒店里常用：ขอ... ด้วยค่ะ",
      roman: "mâi bpen-rai ká, lɔɔng pûut mài ìik kráng ná ká!",
      chinese: "没关系，再试一次！酒店里常用：请给我…",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "nightmarket",
    title: "夜市淘宝",
    subtitle: "曼谷拉差达火车夜市",
    description: "在泰国热闹的夜市里讨价还价、品尝小吃、购买纪念品，学习购物实用泰语。",
    icon: "ShoppingBag",
    sceneEmoji: "🌙",
    sceneTip: "泰国夜市砍价可以从开价的50-70%开始还，但不要太低以免不礼貌。微笑是砍价的最好武器！",
    roleplay: { character: "夜市摊主", role: "night market vendor" },
    greeting: {
      thai: "สวัสดีค่ะ! เดินดูอะไรดีคะ มีของสวยๆ เยอะเลยค่ะ ลองดูได้เลยนะคะ",
      roman: "sà-wàt-dii ká! dəən duu à-rai dii ká, mii khɔ̌ɔng sǔay-sǔay yəə loei ká, lɔɔng duu dâi loei ná ká",
      chinese: "你好！随便看看，有很多漂亮的东西哦！随便看。",
      speakRate: 0.75,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "看看想买什么",
        suggestions: ["ของนี้多少钱", "ลดได้ไหม", "มีสีอื่นไหม", "ขอจับได้ไหม"],
        responses: [
          {
            keywords: ["多少钱", "ราคา", "ราคาเท่าไหร่", "บาท"],
            thai: "อันนี้ 350 บาทค่ะ ลายสวยมากเลยนะคะ ทำมือนะคะ ไม่ใช่ของโรงงานค่ะ",
            roman: "an níi sǎam-mûn-háa-róii bàat ká, laai sǔay mâak loei ná ká, tham mʉ̌an ná ká, mâi châi khɔ̌ɔng rɔ́ng-gaan ká",
            chinese: "这个350泰铢，花纹很漂亮哦，手工做的，不是工厂货。",
            vocab: [
              { th: "ราคาเท่าไหร่", roman: "raakaa tâo-rài", cn: "多少钱" },
              { th: "ทำมือ", roman: "tham mʉ̌an", cn: "手工" },
              { th: "ของโรงงาน", roman: "khɔ̌ɔng rɔ́ng-gaan", cn: "工厂货" },
            ],
            grammar: "「ไม่ใช่」= 不是，是「不是」的正式说法。口语中也常用「ไม่ใช่」。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "开始砍价",
        suggestions: ["ลดหน่อยได้ไหม", "200 ได้ไหม", "300 ก็ได้", "ซื้อ 2 อัน"],
        responses: [
          {
            keywords: ["ลด", "ลดหน่อย", "200"],
            thai: "300 ลดให้เลยค่ะ ไม่ได้ลดมากกว่านี้แล้วนะคะ กำไรนิดเดียวเองค่ะ ซื้อเลยดีกว่าค่ะ",
            roman: "sǎam-mûn rót hâi loei ká, mâi dâi rót mâak gwàa níi láew ná ká, gaa-rùai nít-diao eeng ká, sʉ́ léu dii gwàa ká",
            chinese: "300泰铢给您最低了，不能再低了哦，就赚一点点。买吧！",
            vocab: [
              { th: "ลด", roman: "rót", cn: "打折/降价" },
              { th: "กำไร", roman: "gaa-rùai", cn: "利润" },
              { th: "ซื้อ", roman: "sʉ́", cn: "买" },
            ],
            grammar: "「เลย」= 就/直接，用于加强语气。ซื้อเลย = 就买吧（催促语气）。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "决定购买",
        suggestions: ["เอาอันนี้", "จ่ายเงินสด", "โอนได้ไหม", "ใส่ถุงหน่อย"],
        responses: [
          {
            keywords: ["เอา", "เอาอันนี้", "买"],
            thai: "เลือกได้เลยค่ะ! จ่ายเงินสดหรือโอนผ่านPromptPayคะ ใส่ถุงให้สวยๆ ด้วยนะคะ เอาถุงผ้าหรือถุงพลาสติกคะ",
            roman: "lʉ̌ak dâi loei ká! jài ngəən sòt rá-rûe õon pǎan PromptPay ká, sài thûuk hâi sǔay-sǔay dwóy ná ká, àw thûuk phǎa rá-rûe thûuk plà-sèt ká",
            chinese: "随便挑！现金还是PromptPay转账？给您装漂亮的袋子。要布袋还是塑料袋？",
            vocab: [
              { th: "เลือก", roman: "lʉ̌ak", cn: "挑选" },
              { th: "โอน", roman: "õon", cn: "转账" },
              { th: "ถุง", roman: "thûuk", cn: "袋子" },
            ],
            grammar: "「ผ่าน」= 通过。โอนผ่าน PromptPay = 通过PromptPay转账。",
            culturalNote: "PromptPay是泰国最常用的电子支付方式，几乎所有摊位都支持。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "结束购物",
        suggestions: ["ขอบคุณมาก", "อร่อยมาก", "จะกลับมาอีก", "ลาก่อนค่ะ"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "กลับมา"],
            thai: "ขอบคุณค่ะ! ขอบคุณที่อุดหนุนค่ะ ถ้าชอบก็กลับมาอีกนะคะ มีของใหม่ทุกสัปดาห์ค่ะ สนุกกับตลาดนัดนะคะ!",
            roman: "khàawp-khun ká! khàawp-khun thîi ùd-nûun ká, thâa chɔ̀ɔp gɔ̀o glàap maa ìik ná ká, mii khɔ̌ɔng mài thûuk sà-pà-dtii ká, sà-nùk khap dtà-làat-nát ná ká",
            chinese: "谢谢！谢谢光临。喜欢的话再来哦，每周有新品。逛夜市愉快！",
            vocab: [
              { th: "อุดหนุน", roman: "ùd-nûun", cn: "光顾/购买" },
              { th: "ทุกสัปดาห์", roman: "thûuk sà-pà-dtii", cn: "每周" },
            ],
            grammar: "「ถ้า...ก็...」= 如果…就…。ถ้าชอบก็กลับมา = 喜欢就再来。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถามราคานะคะ! เท่าไหร่ หรือ ลดได้ไหม",
      roman: "lɔɔng thaam raakaa ná ká! tâo-rài rá-rûe rót dâi mái",
      chinese: "试着问问价格吧！多少钱？能便宜吗？",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "taxi",
    title: "打车出行",
    subtitle: "曼谷出租车/Grab",
    description: "在泰国打出租车或叫Grab，告诉司机目的地、讨论路线和车费，学习交通实用泰语。",
    icon: "Briefcase",
    sceneEmoji: "🚕",
    sceneTip: "曼谷出租车起步价35泰铢。一定要要求司机打表（เปิดมิเตอร์）。用Grab更方便，价格透明。",
    roleplay: { character: "出租车司机", role: "taxi driver" },
    greeting: {
      thai: "สวัสดีครับ! จะไปไหนครับ ขึ้นรถเลยครับ",
      roman: "sà-wàt-dii kráp! jà pai nǎi kráp, khʉ̌ng rót loei kráp",
      chinese: "你好！要去哪里？上车吧。",
      speakRate: 0.78,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "告诉司机目的地",
        suggestions: ["ไปสนามบิน", "ไปสยามพารากอน", "เปิดมิเตอร์ด้วย", "ไปสยามครับ"],
        responses: [
          {
            keywords: ["ไป", "ไปสนามบิน", "ไปสยาม"],
            thai: "ได้เลยครับ! ไปสนามบินใช่ไหมครับ ระยะทางประมาณ 30 กม. ครับ เปิดมิเตอร์ให้เลยครับ",
            roman: "dâi loei kráp! pai sà-nǎam-bin châi mái kráp, rá-yaa-thaang bpa-raam 30 k.m. kráp, bəət meter hâi loei kráp",
            chinese: "好的！去机场对吧？大约30公里。给您打表。",
            vocab: [
              { th: "ระยะทาง", roman: "rá-yaa-thaang", cn: "距离" },
              { th: "เปิดมิเตอร์", roman: "bəət meter", cn: "打表" },
              { th: "กิโลเมตร", roman: "kílô-mêet", cn: "公里" },
            ],
            grammar: "「ระยะทาง」= 距离。「ประมาณ」= 大约。30 กม. = 30公里。",
            culturalNote: "如果司机不愿意打表，可以礼貌拒绝并换一辆车。Grab就没有这个问题。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "途中聊天",
        suggestions: ["ไปสนามบินกี่ชั่วโมง", "กรุงเทพรถติดมาก", "เคยไปประเทศไทยไหม", "อากาศดีมาก"],
        responses: [
          {
            keywords: ["กี่ชั่วโมง", "时间", "ติด", "堵车"],
            thai: "ถ้าไม่ติดรถ ประมาณ 40 นาทีครับ แต่ตอนนี้รถติดมาก อาจเป็นชั่วโมงเลยครับ กรุงเทพฯ รถติดช่วงเช้ากับเย็นครับ",
            roman: "thâa mâi tìt rót bpa-raam sìi-sìp naa-thíi kráp, dtàe tɔ̀ɔn-níi rót tìt mâak, àat bpen chûa-hɔɔn loei kráp, grung-têep rót tìt chûang cháo kap yēn kráp",
            chinese: "不堵车大约40分钟。但现在很堵，可能要一个小时。曼谷早晚高峰很堵。",
            vocab: [
              { th: "รถติด", roman: "rót tìt", cn: "堵车" },
              { th: "ชั่วโมง", roman: "chûa-hɔɔn", cn: "小时" },
              { th: "ช่วง", roman: "chûang", cn: "时段/期间" },
            ],
            grammar: "「อาจ」= 可能/也许。比「อาจจะ」更口语化。อาจ + 动词 = 可能会…",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "到达目的地",
        suggestions: ["จอดตรงไหน", "เท่าไหร่ครับ", "ไม่ต้องทอน", "ขอบคุณครับ"],
        responses: [
          {
            keywords: ["เท่าไหร่", "多少钱", "จอด"],
            thai: "ถึงแล้วครับ! มิเตอร์ 420 บาทครับ จอดตรงนี้ได้เลยครับ",
            roman: "thʉ̌ung láew kráp! meter sìi-hâa-róii bàat kráp, jɔ̀ɔt trong níi dâi loei kráp",
            chinese: "到了！计价器420泰铢。可以停这里。",
            vocab: [
              { th: "ถึง", roman: "thʉ̌ung", cn: "到达" },
              { th: "มิเตอร์", roman: "meter", cn: "计价器" },
              { th: "จอด", roman: "jɔ̀ɔt", cn: "停车" },
            ],
            grammar: "「แล้ว」在此表示「已经」的动作完成。ถึงแล้ว = 已经到了。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "付钱下车",
        suggestions: ["ขอบคุณครับ", "เก่งมาก", "ไม่ต้องทอน", "ลาก่อนครับ"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "ทอน"],
            thai: "ขอบคุณครับ! ขอบคุณที่ใช้บริการครับ ไม่ต้องทอนก็ได้ครับ ขอบคุณมากครับ!",
            roman: "khàawp-khun kráp! khàawp-khun thîi chái baw-ri-gaan kráp, mâi dtông thon gɔ̀o dâi kráp, khàawp-khun mâak kráp!",
            chinese: "谢谢！谢谢坐我的车。不用找了。非常感谢！",
            vocab: [
              { th: "บริการ", roman: "baw-ri-gaan", cn: "服务" },
              { th: "ทอน", roman: "thon", cn: "找零" },
            ],
            grammar: "「ไม่ต้อง」= 不用/不需要。不用找了 = ไม่ต้องทอน。泰国小费文化不强，但可以给司机凑整。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองบอกจุดหมายปลายทางเป็นภาษาไทยสิครับ! เช่น ไปสนามบิน หรือ ไปสยาม",
      roman: "lɔɔng bàawk jùt-mǎai plaai-thaang bpen phaa-sǎa thai sì kráp!",
      chinese: "试着用泰语说目的地！比如去机场或去暹罗。",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "convenience",
    title: "便利店购物",
    subtitle: "7-Eleven / Lawson",
    description: "在泰国7-Eleven便利店买东西、加热食物、付款结账，学习最日常的购物泰语。",
    icon: "ShoppingBag",
    sceneEmoji: "🏪",
    sceneTip: "泰国7-Eleven非常普及，几乎所有东西都能买到。店员会问「มีบัตร积分ไหม」(有积分卡吗)。",
    roleplay: { character: "便利店店员", role: "convenience store clerk" },
    greeting: {
      thai: "สวัสดีค่ะ! いらっしゃいませ มีอะไรให้ช่วยคะ",
      roman: "sà-wàt-dii ká! irasshaimase, mii à-rai hâi chûay ká",
      chinese: "你好！欢迎光临，有什么需要帮忙的吗？",
      speakRate: 0.80,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "找想买的东西",
        suggestions: ["ขอน้ำดื่ม", "มีบะหมี่สำเร็จรูปไหม", "ของร้อนอยู่ตรงไหน", "ขอซองบุหรี่"],
        responses: [
          {
            keywords: ["น้ำ", "น้ำดื่ม", "水"],
            thai: "มีค่ะ น้ำดื่มอยู่ช่องเย็นค่ะ มีน้ำเปล่า น้ำอัดลม น้ำผลไม้ค่ะ อยากได้แบบไหนคะ",
            roman: "mii ká, nám dʉ̌m yùu chɔ̂ɔng yen ká, mii nám plào nám àt-lom nám pǒn-lá-máii ká, yàak dâi bâep nǎi ká",
            chinese: "有的，饮用水在冷柜。有矿泉水、汽水、果汁。想要哪种？",
            vocab: [
              { th: "น้ำดื่ม", roman: "nám dʉ̌m", cn: "饮用水" },
              { th: "น้ำเปล่า", roman: "nám plào", cn: "矿泉水/白水" },
              { th: "น้ำอัดลม", roman: "nám àt-lom", cn: "汽水" },
            ],
            grammar: "「แบบ」= 种类/类型。อยากได้แบบไหน = 想要哪种？",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "加热食物",
        suggestions: ["ช่วยอุ่นให้หน่อย", "เข้าไมโครเวฟได้ไหม", "กี่วินาที", "ขอบคุณค่ะ"],
        responses: [
          {
            keywords: ["อุ่น", "加热", "ไมโครเวฟ", " microwave"],
            thai: "ได้ค่ะ เดี๋ยวอุ่นให้ค่ะ 放入ไมโครเวฟ 2 นาทีค่ะ รอแป๊บเดียวนะคะ ของร้อนอร่อยมากค่ะ",
            roman: "dâi ká, dǐao àn hâi ká, saang microwave sǎam naa-thíi ká, rǎw bpâep-diao ná ká, khɔ̌ɔng rɔ́ɔn a-rɔ̀i mâak ká",
            chinese: "好的，帮您加热。微波炉2分钟。稍等一下，热食很好吃哦。",
            vocab: [
              { th: "อุ่น", roman: "àn", cn: "加热" },
              { th: "ของร้อน", roman: "khɔ̌ɔng rɔ́ɔn", cn: "热食/热的东西" },
              { th: "แป๊บ", roman: "bpâep", cn: "一下/一会儿" },
            ],
            grammar: "「เดี๋ยว」= 等一下/马上。是非常口语化的表达。เดี๋ยวอุ่นให้ = 马上帮你加热。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "付款",
        suggestions: ["จ่ายเงินสด", "โอนได้ไหม", "มีถุงไหม", "ขอบัตร积分"],
        responses: [
          {
            keywords: ["จ่าย", "จ่ายเงิน", "เงินสด"],
            thai: "รวม 187 บาทค่ะ จ่ายเงินสดหรือโอนค่ะ มีบัตร积分ไหมคะ ใส่ถุงไหมคะ",
            roman: "ruambpai hâa-sìip-jèt bàat ká, jài ngəən sòt rá-rûe õon ká, mii bâat seek-kaan mái ká, sài thûuk mái ká",
            chinese: "一共187泰铢。现金还是转账？有积分卡吗？要袋子吗？",
            vocab: [
              { th: "รวม", roman: "ruam", cn: "一共/总共" },
              { th: "ถุง", roman: "thûuk", cn: "袋子" },
              { th: "积分", roman: "seek-kaan", cn: "积分" },
            ],
            grammar: "「รวม」= 总共/合计。รวม...บาท = 一共...泰铢。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "离开",
        suggestions: ["ขอบคุณค่ะ", "อร่อยมาก", "ไปก่อนค่ะ", "ราตรีสวัสดิ์"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "ไป"],
            thai: "ขอบคุณค่ะ! ไปก่อนนะคะ อร่อยๆ ค่ะ แล้วเจอกันค่ะ",
            roman: "khàawp-khun ká! pai gàawn ná ká, a-rɔ̀i-a-rɔ̀i ká, láew jəə gan ká",
            chinese: "谢谢！先走了哦。好吃好吃。下次见！",
            vocab: [
              { th: "ไปก่อน", roman: "pai gàawn", cn: "先走了" },
              { th: "แล้วเจอกัน", roman: "láew jəə gan", cn: "下次见" },
            ],
            grammar: "「ไปก่อน」= 先走了，是泰国人告别的常用说法。「ไปก่อนนะ」更亲切。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองถามหาของในร้านเป็นภาษาไทยสิค่ะ! เช่น ขอน้ำ หรือ ของร้อน",
      roman: "lɔɔng thaam hǎa khɔ̌ɔng nai rán bpen phaa-sǎa thai sì ká!",
      chinese: "试着用泰语问店员要东西！比如要水或热食。",
      vocab: [],
      grammar: "",
    },
  },

{
    id: "hospital",
    title: "医院看病",
    subtitle: "曼谷医院就诊",
    description: "在泰国医院挂号、描述病情、拿药，学习医疗场景的实用泰语。",
    icon: "MessageCircle",
    sceneEmoji: "🏥",
    sceneTip: "泰国医院通常分为门诊（_OPD）和急诊。看病前先挂号（ลงทะเบียน），描述症状时用「เจ็บ」（疼）或「ไม่สบาย」（不舒服）。",
    roleplay: { character: "医生/护士", role: "hospital staff" },
    greeting: {
      thai: "สวัสดีครับ/ค่ะ นั่งตรงนี้ครับ/ค่ะ มีอะไรไม่สบายครับ/ค่ะ",
      roman: "sà-wàt-dii kráp/ká, nâng trong níi kráp/ká, mii à-rai mâi sà-baai kráp/ká",
      chinese: "你好，坐这里。哪里不舒服？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "描述症状",
        suggestions: ["เจ็บหัว", "มีไข้", "เจ็บท้อง", "ไม่สบายมาก"],
        responses: [
          {
            keywords: ["เจ็บ", "pain", "疼"],
            thai: "เจ็บตรงไหนครับ/ค่ะ เจ็บมานานแล้วหรือยังครับ/ค่ะ มีไข้ด้วยไหมครับ",
            roman: "jèp trong nǎi kráp/ká, jèp maa naan láew rá-rûe yung kráp, mii khâai dwóy mái kráp",
            chinese: "哪里疼？疼多久了？有发烧吗？",
            vocab: [
              { th: "เจ็บ", roman: "jèp", cn: "疼/痛" },
              { th: "มีไข้", roman: "mii khâai", cn: "发烧" },
              { th: "มานาน", roman: "maa naan", cn: "很久了" },
            ],
            grammar: "「เจ็บ」= 疼/痛，是最常用的疼痛词。เจ็บ + 部位 = 哪里疼。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "检查身体",
        suggestions: ["วัดไข้", "ฟังเสียงหัวใจ", "ตรวจเลือด", "กินยาอะไร"],
        responses: [
          {
            keywords: ["ตรวจ", "exam", "检查"],
            thai: "หมอจะวัดไข้ให้ก่อนครับ 37.8 องศา นิดหน่อย มีไข้นะครับ ต้องกินยาลดไข้ด้วย",
            roman: "mɔ̌ɔ jà wát khâai hâi gɔ̀awn kráp, sǎam-sìip-jèt ponto sǎa, nít-nài, mii khâai ná kráp, dtông gin yaa lót khâai dwóy",
            chinese: "医生先量体温，37.8度，有点发烧。要吃退烧药。",
            vocab: [
              { th: "วัดไข้", roman: "wát khâai", cn: "量体温" },
              { th: "องศา", roman: "ɔng-sǎa", cn: "度（温度）" },
              { th: "ยาลดไข้", roman: "yaa lót khâai", cn: "退烧药" },
            ],
            grammar: "「ต้อง」= 必须/要。ต้องกินยา = 要吃药。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "拿药",
        suggestions: ["กินยาตอนไหน", "มีผลข้างเคียงไหม", "ต้องมาอีกไหม", "ขอบคุณหมอ"],
        responses: [
          {
            keywords: ["กิน", "eat", "吃药"],
            thai: "ยานี่กินหลังอาหารครับ วันละ 3 ครั้ง ครั้งละ 1 เม็ด ถ้า 3 วันไม่ดีขึ้นต้องมาหาหมอใหม่นะครับ",
            roman: "yaa nîi gin lǎng aa-hǎan kráp, wan lá sǎam kráng, kráng lá nèung mèt, thâa sǎam wan mâi dee khʉ̌ung dtông maa hǎa mɔ̌ɔ mài ná kráp",
            chinese: "这药饭后吃，每天3次，每次1粒。如果3天没好转要再来复诊。",
            vocab: [
              { th: "หลังอาหาร", roman: "lǎng aa-hǎan", cn: "饭后" },
              { th: "เม็ด", roman: "mèt", cn: "粒（药量词）" },
              { th: "ดีขึ้น", roman: "dee khʉ̌ung", cn: "好转" },
            ],
            grammar: "「หลัง」= 之后。หลังอาหาร = 饭后。「วันละ」= 每天。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "结束问诊",
        suggestions: ["ขอบคุณค่ะ", "จ่ายเงินที่ไหน", "กลับบ้านเลย", "จะพักผ่อน"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "จ่าย"],
            thai: "พักผ่อนเยอะๆ ดื่มน้ำเยอะๆ นะครับ จ่ายเงินที่เคาน์เตอร์ชั้น 1 ครับ สวัสดีครับ!",
            roman: "phàk-phɔ̀ɔn yə́-yə́, dʉ̀m nám yə́-yə́ ná kráp, jài ngəən thîi counter chán nʉ̀ng kráp, sà-wàt-dii kráp!",
            chinese: "多休息多喝水。到1楼柜台付款。再见！",
            vocab: [
              { th: "พักผ่อน", roman: "phàk-phɔ̀ɔn", cn: "休息" },
              { th: "เคาน์เตอร์", roman: "counter", cn: "柜台" },
              { th: "ชั้น", roman: "chán", cn: "楼层" },
            ],
            grammar: "「ที่」= 在某处。จ่ายเงินที่ = 在…付款。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองอธิบายอาการเป็นภาษาไทยครับ! เช่น ฉันเจ็บ... หรือ ฉันไม่สบาย...",
      roman: "lɔɔng à-tì-baan aa-gaan bpen phaa-sǎa thai kráp!",
      chinese: "试着用泰语描述症状！比如 我疼… 或 我不舒服…",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "bank",
    title: "银行办事",
    subtitle: "泰国银行柜台",
    description: "在泰国银行开户、换汇、转账，学习银行金融场景的实用泰语。",
    icon: "Briefcase",
    sceneEmoji: "🏦",
    sceneTip: "泰国主要银行有 Bangkok Bank、Kasikorn Bank、SCB 等。外国人可以用护照开户。换汇推荐 SuperRich。",
    roleplay: { character: "银行柜员", role: "bank clerk" },
    greeting: {
      thai: "สวัสดีครับ ต้องการอะไรครับ เปิดบัญชี หรือ ทำธุรกรรมอะไรครับ",
      roman: "sà-wàt-dii kráp, dtông-gaan à-rai kráp, bəət bpaan-jii rá-rûe tham tá-ruu-gaan à-rai kráp",
      chinese: "你好，需要什么？开户还是办业务？",
      speakRate: 0.72,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "办理业务",
        suggestions: ["เปิดบัญชี", "แลกเงิน", "โอนเงิน", "ถอนเงิน"],
        responses: [
          {
            keywords: ["เปิด", "open", "开户"],
            thai: "เปิดบัญชีใหม่ใช่ไหมครับ ขอพาสปอร์ตด้วยครับ จะเปิดบัญชีออมทรัพย์ หรือ กระแสรายวันครับ",
            roman: "bəət bpaan-jii mài châi mái kráp, khǎw pâat-bpòt dwóy kráp, jà bəət bpaan-jii ɔ̂ɔm-sáp rá-rûe kra-sà-raai-wan kráp",
            chinese: "开户对吗？请给我护照。要开储蓄账户还是活期账户？",
            vocab: [
              { th: "เปิดบัญชี", roman: "bəət bpaan-jii", cn: "开户" },
              { th: "ออมทรัพย์", roman: "ɔ̂ɔm-sáp", cn: "储蓄" },
              { th: "กระแสรายวัน", roman: "kra-sà-raai-wan", cn: "活期" },
            ],
            grammar: "「ครับ/ค่ะ」在服务场景中非常必要，不用会显得不礼貌。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "填写表格",
        suggestions: ["กรอกข้อมูลอะไร", "เซ็นต์ตรงไหน", "ใส่ลายเซ็น", "ขอดูแบบฟอร์ม"],
        responses: [
          {
            keywords: ["กรอก", "fill", "填"],
            thai: "กรอกชื่อ ที่อยู่ เบอร์โทรศัพท์ แล้วเซ็นต์ด้านล่างครับ ถ้ามีภาษาอังกฤษก็ได้ครับ",
            roman: "gràwk chʉʉ thîi-yùu bɛɛr-dtɔ-rá-sáp láew sêen dâan lǎang kráp, thâa mii phaa-sǎa ang-grìt gɔ̀o dâi kráp",
            chinese: "填写姓名、地址、电话，然后签下面。用英文也可以。",
            vocab: [
              { th: "กรอก", roman: "gràwk", cn: "填写" },
              { th: "ที่อยู่", roman: "thîi-yùu", cn: "地址" },
              { th: "เบอร์โทรศัพท์", roman: "bɛɛr-dtɔ-rá-sáp", cn: "电话" },
            ],
            grammar: "「แล้ว」= 然后。กรอก...แล้วเซ็นต์ = 填好...然后签。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "完成开户",
        suggestions: ["ขอดูบัตร", "ตั้งรหัส PIN", "ฝากเงิน", "ได้บัตรแล้ว"],
        responses: [
          {
            keywords: ["บัตร", "card", "卡"],
            thai: "บัตรเดบิตจะออกให้ภายใน 7 วัน ตอนนี้ใช้สมุดบัญชีไปก่อนครับ ตั้งรหัส PIN 6 หลักด้วยครับ",
            roman: "bâat-dee-bìt jà òk hâi bpaai-nai sǎam-jìt wan, tɔ̀ɔn-níi chái sà-mùt bpaan-jii bpai gɔ̀awn kráp, dtâng rá-kàt PIN hòk lák dwóy kráp",
            chinese: "借记卡7天内寄出，先用存折。设置6位PIN密码。",
            vocab: [
              { th: "บัตรเดบิต", roman: "bâat-dee-bìt", cn: "借记卡" },
              { th: "สมุดบัญชี", roman: "sà-mùt bpaan-jii", cn: "存折" },
              { th: "รหัส", roman: "rá-kàt", cn: "密码" },
            ],
            grammar: "「ภายใน」= 在…之内。ภายใน 7 วัน = 7天之内。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "结束",
        suggestions: ["ขอบคุณครับ", "จะไปแล้ว", "ฝากเงินเข้า", "ลาก่อนครับ"],
        responses: [
          {
            keywords: ["ขอบคุณ", "thank", "ไป"],
            thai: "ครับ เปิดบัญชีเรียบร้อยแล้วครับ ถ้ามีอะไรสงสัยโทรมาถามได้เลยครับ สวัสดีครับ!",
            roman: "kráp, bəət bpaan-jii rîap-rɔ́i láew kráp, thâa mii à-rai sǒng-sǎi taw maa thaam dâi loei kráp, sà-wàt-dii kráp!",
            chinese: "开户完成了。有问题随时打电话问。再见！",
            vocab: [
              { th: "เรียบร้อย", roman: "rîap-rɔ́i", cn: "完成了" },
              { th: "สงสัย", roman: "sǒng-sǎi", cn: "疑问" },
            ],
            grammar: "「เรียบร้อย」= 完成/好了。常用于表示某事已完成。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองบอกว่าต้องการอะไรเป็นภาษาไทยสิครับ! เช่น เปิดบัญชี หรือ แลกเงิน",
      roman: "lɔɔng bàawk wa dtông-gaan à-rai bpen phaa-sǎa thai sì kráp!",
      chinese: "试着用泰语说你要做什么！比如开户或换汇。",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "salon",
    title: "理发店",
    subtitle: "泰国理发/美容",
    description: "在泰国理发店剪发、染发、沟通发型，学习美容美发场景的实用泰语。",
    icon: "ShoppingBag",
    sceneEmoji: "💇",
    sceneTip: "泰国理发价格非常亲民。普通剪发约 100-200 泰铢。可以拿图片给理发师看。说「ตัด」= 剪。",
    roleplay: { character: "理发师", role: "hairdresser" },
    greeting: {
      thai: "สวัสดีค่ะ นั่งตรงนี้ค่ะ อยากทำอะไรคะ ตัดผม หรือ ทำสีคะ",
      roman: "sà-wàt-dii ká, nâng trong níi ká, yàak tham à-rai ká, dtàt pɔ̌m rá-rûe tham sǐi ká",
      chinese: "你好，坐这里。想做什么？剪发还是染发？",
      speakRate: 0.75,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "沟通需求",
        suggestions: ["ตัดสั้น", "ตัดยาวนิดหน่อย", "ทำสี", "สระผมด้วย"],
        responses: [
          {
            keywords: ["ตัด", "cut", "剪"],
            thai: "อยากตัดแบบไหนคะ ตัดสั้นมาก หรือ ตัดแค่ปลายผมคะ มีรูปแบบที่ชอบไหมคะ",
            roman: "yàak dtàt bâep nǎi ká, dtàt sǎn mâak rá-rûe dtàt khàe bplai pɔ̌m ká, mii rúu-pai bâep thîi chɔ̀ɔp mái ká",
            chinese: "想怎么剪？剪很短还是只修一下？有喜欢的图片吗？",
            vocab: [
              { th: "ตัด", roman: "dtàt", cn: "剪" },
              { th: "สั้น", roman: "sǎn", cn: "短" },
              { th: "ปลายผม", roman: "bplai pɔ̌m", cn: "发梢" },
            ],
            grammar: "「แบบ」= 样式/方式。ตัดแบบไหน = 怎么剪。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "开始理发",
        suggestions: ["สั้นมากไม่ได้", "ขอรูปให้ดู", "ตัดตรงนี้", "อย่าตัดมาก"],
        responses: [
          {
            keywords: ["สั้น", "short", "短"],
            thai: "ค่ะ จะตัดประมาณนี้นะคะ ลองดู镜子ค่ะ ถ้าอยากตัดเพิ่มอีกก็บอกได้เลยค่ะ",
            roman: "ká, jà dtàt bpa-raam níi ná ká, lɔɔng duu镜子 ká, thâa yàak dtàt pə̂əm ìik gɔ̀o bàawk dâi loei ká",
            chinese: "好的，大概剪到这里。看看镜子。还想再剪就说。",
            vocab: [
              { th: "ประมาณ", roman: "bpa-raam", cn: "大约" },
              { th: "เพิ่ม", roman: "pə̂əm", cn: "增加/再" },
            ],
            grammar: "「ลอง」= 试试/看看。ลองดู = 看看。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "洗头/造型",
        suggestions: ["สระผมแรงๆ", "ไม่ต้องนวด", "ไดร์ผมด้วย", "ขอยาวอีกนิด"],
        responses: [
          {
            keywords: ["สระ", "wash", "洗"],
            thai: "สระผมเสร็จแล้วค่ะ จะไดร์ให้พองๆ หรือ ตรงๆ คะ ใช้แชมพูอะไรคะ",
            roman: "sà pɔ̌m sèt láew ká, jà dryer hâi pɔng-pɔng rá-rûe trong-trong ká, chái shampoo à-rai ká",
            chinese: "洗好了。要吹蓬松还是直顺？用什么洗发水？",
            vocab: [
              { th: "สระผม", roman: "sà pɔ̌m", cn: "洗头" },
              { th: "ไดร์", roman: "dryer", cn: "吹" },
              { th: "พอง", roman: "pɔng", cn: "蓬松" },
            ],
            grammar: "「เสร็จ」= 完成。สระเสร็จ = 洗好了。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "付款",
        suggestions: ["เท่าไหร่", "จ่ายเงินสด", "โอนได้ไหม", "ขอบคุณค่ะ"],
        responses: [
          {
            keywords: ["เท่าไหร่", "price", "多少钱"],
            thai: "ตัด 200 สระ+ไดร์ 100 รวม 300 บาทค่ะ จ่ายเงินสดหรือโอนค่ะ",
            roman: "dtàt sǎang-hóii, sà+dryer nùung-hóii, ruam sǎam-hóii bàat ká, jài ngəən sòt rá-rûe õon ká",
            chinese: "剪发200，洗吹100，一共300泰铢。现金还是转账？",
            vocab: [
              { th: "รวม", roman: "ruam", cn: "总共" },
              { th: "สด", roman: "sòt", cn: "现金" },
            ],
            grammar: "泰语价格表达：数字 + บาท。200 = สองร้อย。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองบอกช่างทำผมเป็นภาษาไทยสิค่ะ! เช่น ตัดสั้น หรือ ทำสี",
      roman: "lɔɔng bàawk châng tham pɔ̌m bpen phaa-sǎa thai sì ká!",
      chinese: "试着用泰语跟理发师说！比如剪短或染发。",
      vocab: [],
      grammar: "",
    },
  },
  {
    id: "gym",
    title: "健身房",
    subtitle: "泰国健身房/运动",
    description: "在泰国健身房注册会员、使用器材、找教练，学习运动健身场景的实用泰语。",
    icon: "MessageCircle",
    sceneEmoji: "💪",
    sceneTip: "泰国健身房价格亲民。Basic Fit、Fitness First、Virgin Active 是连锁品牌。月卡约 1000-2000 泰铢。",
    roleplay: { character: "健身房教练", role: "gym trainer" },
    greeting: {
      thai: "สวัสดีครับ! ยินดีต้อนรับ คุณเคยมาออกกำลังกายที่นี่มาก่อนไหมครับ",
      roman: "sà-wàt-dii kráp! yin-dii tɔ̂ɔn-ráp, khun kəəi maa àwk gam-lang-gaae thîi nîi maa gɔ̀awn mái kráp",
      chinese: "你好！欢迎。之前来过这里健身吗？",
      speakRate: 0.75,
    },
    dialogueTree: [
      {
        stage: 1,
        prompt: "注册/询问",
        suggestions: ["สมัครสมาชิก", "ราคาเท่าไหร่", "มีเทรนเนอร์ไหม", "อยากลดน้ำหนัก"],
        responses: [
          {
            keywords: ["สมัคร", "register", "注册"],
            thai: "สมัครรายเดือน 1,500 บาท ไม่จำกัด หรือ แบบ 10 ครั้ง 800 บาท คุณอยากออกกำลังกายแบบไหนครับ",
            roman: "sà-mák raai-dʉ̂an nûng-phan-hâa-róii bàat, mâi jam-gàt rá-rûe bâep sìp kráng bpàa-róii bàat, khun yàak àwk gam-lang-gaae bâep nǎi kráp",
            chinese: "月卡1500泰铢不限次，或10次卡800泰铢。你想怎么健身？",
            vocab: [
              { th: "สมัครสมาชิก", roman: "sà-mák sà-maa-jìk", cn: "注册会员" },
              { th: "รายเดือน", roman: "raai-dʉ̂an", cn: "月付" },
              { th: "จำกัด", roman: "jam-gàt", cn: "限制" },
            ],
            grammar: "「แบบ」= 方式/类型。แบบ 10 ครั้ง = 10次的方式。",
          },
        ],
        nextStage: 2,
      },
      {
        stage: 2,
        prompt: "训练计划",
        suggestions: ["อยากลดพุง", "อยากกล้ามใหญ่", "วิ่งบนลู่วิ่ง", "ซื้อแพ็กเกจ"],
        responses: [
          {
            keywords: ["ลด", "lose", "减"],
            thai: "ถ้าอยากลดน้ำหนัก แนะนำให้ cardio 30 นาที แล้ว weight training 30 นาที ทุก 3 วันครับ",
            roman: "thâa yàak lót nám-nàk, náe-nam hâi cardio sǎam-sìp naa-thíi láew weight training sǎam-sìp naa-thíi thûk sǎam wan kráp",
            chinese: "想减重的话，建议有氧30分钟+力量训练30分钟，每3天一次。",
            vocab: [
              { th: "ลดน้ำหนัก", roman: "lót nám-nàk", cn: "减重" },
              { th: "แนะนำ", roman: "náe-nam", cn: "推荐" },
              { th: "ทุก", roman: "thûk", cn: "每" },
            ],
            grammar: "「ถ้า...แนะนำให้」= 如果…建议。是很自然的建议句型。",
          },
        ],
        nextStage: 3,
      },
      {
        stage: 3,
        prompt: "使用器材",
        suggestions: ["เครื่องนี้ใช้ยังไง", "ช่วยสอนหน่อย", "ยกน้ำหนัก", "พักก่อน"],
        responses: [
          {
            keywords: ["เครื่อง", "machine", "器材"],
            thai: "เครื่องนี้ปรับเบาะให้เหมาะกับคุณก่อน แล้วค่อยเพิ่มน้ำหนักทีละนิดครับ ถ้าเจ็บต้องหยุดเลยนะครับ",
            roman: "krʉ̂ang níi bpràn bpàw hâi mɔ̀p gap khun gɔ̀awn, láew gɔ̀oi pə̂əm nám-nàk thîi lá nìt kráp, thâa jèp dtông yùt loei ná kráp",
            chinese: "先调整座椅适合你，然后一点点加重量。如果疼要立刻停。",
            vocab: [
              { th: "เบาะ", roman: "bpàw", cn: "座椅" },
              { th: "น้ำหนัก", roman: "nám-nàk", cn: "重量" },
              { th: "หยุด", roman: "yùt", cn: "停止" },
            ],
            grammar: "「ทีละ」= 每次/逐一。ทีละนิด = 一点点。非常实用的渐进表达。",
          },
        ],
        nextStage: 4,
      },
      {
        stage: 4,
        prompt: "结束",
        suggestions: ["สนุกมาก", "เหนื่อยมาก", "จะมาอีก", "ขอบคุณครับ"],
        responses: [
          {
            keywords: ["สนุก", "fun", "开心"],
            thai: "เก่งมากครับ! ออกกำลังกายสม่ำเสมอนะครับ สัปดาห์ละ 3-4 ครั้ง แล้วจะเห็นผลภายใน 2 เดือนครับ!",
            roman: "gèng mâak kráp! àwk gam-lang-gaae sà-mám-sà-měn ná kráp, sà-pà-dtii lá sǎam-sìi kráng, láew jà hěn pǒn bpaai-nai sǎng-deuan kráp",
            chinese: "很棒！坚持锻炼，每周3-4次，2个月内会看到效果！",
            vocab: [
              { th: "สม่ำเสมอ", roman: "sà-mám-sà-měn", cn: "持续/坚持" },
              { th: "เห็นผล", roman: "hěn pǒn", cn: "看到效果" },
            ],
            grammar: "「สม่ำเสมอ」= 持续/经常。是坚持做某事的核心词。",
          },
        ],
        nextStage: null,
      },
    ],
    fallback: {
      thai: "ลองคุยเรื่องออกกำลังกายเป็นภาษาไทยสิครับ! เช่น อยากลดน้ำหนัก",
      roman: "lɔɔng khui rʉ̂ang àwk gam-lang-gaae bpen phaa-sǎa thai sì kráp!",
      chinese: "试着用泰语聊健身！比如想减肥。",
      vocab: [],
      grammar: "",
    },
  },
];

export const CONVERSATION_CONFIG = {
  maxStages: 4,
  typingDelay: { min: 800, max: 1800 },
  stageTransitionDelay: 300,
};
