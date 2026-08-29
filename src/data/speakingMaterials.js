// src/data/speakingMaterials.js
// =========================================================
// ThaiAI 口语练习素材库（句子 / 段落模式）
// =========================================================
// 说明：
// 1. 全部为原创编写（或来自日常通用表达），不复制任何教材课文原文，
//    无侵权风险。
// 2. 字段与单词模式对齐：thai_word（朗读目标）/ pronunciation（发音提示）/
//    chinese_meaning（中文释义），SpeakingRecorder 无需改造即可渲染。
// 3. 句子模式面向「句型跟读」，段落模式面向「连读与语感」，
//    难度从初级到中级递进。
// =========================================================

// =========================================================
// 句子模式（20 句 · 覆盖问候/自我介绍/日常/情感/学习）
// =========================================================

export const speakingSentences = [
  {
    id: "s-01",
    thai_word: "สวัสดีครับ ผมชื่อธนา",
    pronunciation: "sà-wàt-dii khráp phǒm chʉ̂ʉ thá-naa",
    chinese_meaning: "你好，我叫塔纳。",
    category: "自我介绍",
  },
  {
    id: "s-02",
    thai_word: "ยินดีที่ได้รู้จักคุณ",
    pronunciation: "yin-dii thîi dâi rúu-jàk khun",
    chinese_meaning: "很高兴认识您。",
    category: "自我介绍",
  },
  {
    id: "s-03",
    thai_word: "ฉันมาจากประเทศจีน",
    pronunciation: "chǎn maa-jàak prà-thêet ciin",
    chinese_meaning: "我来自中国。",
    category: "自我介绍",
  },
  {
    id: "s-04",
    thai_word: "วันนี้คุณสบายดีไหม",
    pronunciation: "wan-níi khun sà-baai-dii mǎi",
    chinese_meaning: "今天你好吗？",
    category: "问候",
  },
  {
    id: "s-05",
    thai_word: "ขอบคุณมากสำหรับความช่วยเหลือ",
    pronunciation: "khàawp-khun mâak sǎm-ràp khwaam-chûai-lʉ̌ʉa",
    chinese_meaning: "非常感谢您的帮助。",
    category: "礼貌用语",
  },
  {
    id: "s-06",
    thai_word: "ขอโทษครับ ผมมาสาย",
    pronunciation: "khǎaw-thôot khráp phǒm maa-sǎai",
    chinese_meaning: "对不起，我迟到了。",
    category: "礼貌用语",
  },
  {
    id: "s-07",
    thai_word: "อาหารไทยรสชาติอร่อยมาก",
    pronunciation: "aa-hǎan thai rót-châat à-ròi mâak",
    chinese_meaning: "泰国菜非常好吃。",
    category: "日常",
  },
  {
    id: "s-08",
    thai_word: "ผมชอบเรียนภาษาไทย",
    pronunciation: "phǒm châawp rian phaa-sǎa thai",
    chinese_meaning: "我喜欢学泰语。",
    category: "学习",
  },
  {
    id: "s-09",
    thai_word: "พรุ่งนี้เราจะไปเที่ยวทะเลกัน",
    pronunciation: "phrûng-níi rao jà bpai thîao thá-lee kan",
    chinese_meaning: "明天我们一起去海边玩吧。",
    category: "计划",
  },
  {
    id: "s-10",
    thai_word: "อากาศวันนี้ร้อนมาก",
    pronunciation: "aa-gàat wan-níi rɔ́ɔn mâak",
    chinese_meaning: "今天天气很热。",
    category: "天气",
  },
  {
    id: "s-11",
    thai_word: "ร้านนี้อยู่ใกล้สถานีรถไฟฟ้า",
    pronunciation: "ráan níi yùu klâi sà-thǎa-nii rót-fai-fáa",
    chinese_meaning: "这家店离轻轨站很近。",
    category: "问路",
  },
  {
    id: "s-12",
    thai_word: "ช่วยบอกทางไปสนามบินหน่อยได้ไหม",
    pronunciation: "chûay bàawk thaang bpai sà-nǎam-bin nɔ̀i dâi mǎi",
    chinese_meaning: "能告诉我去机场的路吗？",
    category: "问路",
  },
  {
    id: "s-13",
    thai_word: "หน้าร้อนอากาศแบบนี้ชอบทานข้าวเหนียวมะม่วง",
    pronunciation: "nâa-rɔ́ɔn aa-gàat bàep níi châawp thaan khâao-nǐao má-mûang",
    chinese_meaning: "这种热天我喜欢吃芒果糯米饭。",
    category: "饮食",
  },
  {
    id: "s-14",
    thai_word: "เรามาเรียนภาษาไทยที่กรุงเทพฯ",
    pronunciation: "rao maa rian phaa-sǎa thai thîi krung-thêep",
    chinese_meaning: "我们来曼谷学泰语。",
    category: "学习",
  },
  {
    id: "s-15",
    thai_word: "ผมรู้สึกว่าภาษาไทยไม่ยากเกินไป",
    pronunciation: "phǒm rúu-sʉ̀k wâa phaa-sǎa thai mâi yâak kooe-n bpai",
    chinese_meaning: "我觉得泰语不是太难。",
    category: "学习",
  },
  {
    id: "s-16",
    thai_word: "ตอนเย็นเราจะไปเดินตลาดนัด",
    pronunciation: "tɔɔn-yen rao jà bpai dooen dtà-làat-nát",
    chinese_meaning: "晚上我们去逛夜市。",
    category: "日常",
  },
  {
    id: "s-17",
    thai_word: "ฉันคิดถึงบ้านมาก",
    pronunciation: "chǎn khít-thʉ̌ŋ bâan mâak",
    chinese_meaning: "我很想家。",
    category: "情感",
  },
  {
    id: "s-18",
    thai_word: "เพื่อนของฉันเป็นคนใจดี",
    pronunciation: "phʉ̂an khǎawng chǎn bpen khon jai-dii",
    chinese_meaning: "我的朋友是个好心人。",
    category: "情感",
  },
  {
    id: "s-19",
    thai_word: "เวลาฝนตก เราควรพกร่มไปด้วย",
    pronunciation: "wee-laa fǒn dtòk rao khuan phók rôm bpai dûai",
    chinese_meaning: "下雨天我们应该带伞。",
    category: "建议",
  },
  {
    id: "s-20",
    thai_word: "ทุกวันผมตื่นเช้าเพื่อไปออกกำลังกาย",
    pronunciation: "thúk-wan phǒm dtʉ̀ʉn cháaw phʉ̂a bpai àawk-gam-lang-gaai",
    chinese_meaning: "我每天早起去锻炼。",
    category: "日常",
  },
];

// =========================================================
// 段落模式（6 段 · 2-3 句原创短文，适合连读练习）
// =========================================================

export const speakingParagraphs = [
  {
    id: "p-01",
    thai_word:
      "สวัสดีครับ ผมชื่อธนา มาจากประเทศจีน ตอนนี้เรียนภาษาไทยที่กรุงเทพฯ ครับ",
    pronunciation:
      "sà-wàt-dii khráp phǒm chʉ̂ʉ thá-naa maa-jàak prà-thêet ciin tɔɔn-níi rian phaa-sǎa thai thîi krung-thêep khráp",
    chinese_meaning: "你好，我叫塔纳，来自中国，现在在曼谷学泰语。",
    category: "自我介绍",
  },
  {
    id: "p-02",
    thai_word:
      "วันอาทิตย์เราชอบไปตลาดนัด ซื้อผลไม้สดและกินอาหารข้างทาง อร่อยและราคาไม่แพง",
    pronunciation:
      "wan-aa-thít rao châawp bpai dtà-làat-nát sʉ́ʉ phǒn-lá-mái sòt lɛ́ kin aa-hǎan khâang-thaang à-ròi lɛ́ raa-khaa mâi phɛɛng",
    chinese_meaning: "周日我们喜欢去夜市，买新鲜水果、吃路边摊，又好吃又不贵。",
    category: "日常",
  },
  {
    id: "p-03",
    thai_word:
      "การเรียนภาษาไทยต้องฝึกทุกวัน ฟังเพลงไทย ดูซีรีส์ และพูดกับเพื่อน วิธีนี้ทำให้เก่งเร็ว",
    pronunciation:
      "kaan-rian phaa-sǎa thai tɔ̂ŋ fʉ̀k thúk-wan faŋ phleeŋ thai duu sii-rìi lɛ́ phûut kàp phʉ̂an wí-thii níi tham-hâi kèng reo",
    chinese_meaning: "学泰语要每天练习：听泰语歌、看剧、跟朋友说，这样学得快。",
    category: "学习",
  },
  {
    id: "p-04",
    thai_word:
      "กรุงเทพฯ เป็นเมืองที่น่าสนใจมาก มีวัดสวยๆ ตลาดใหญ่ และอาหารอร่อย นักท่องเที่ยวชอบมาเที่ยวที่นี่",
    pronunciation:
      "krung-thêep bpen mʉʉang thîi nâa-sǒn-jai mâak mii wát sǔai-sǔai dtà-làat yài lɛ́ aa-hǎan à-ròi nák-thɔ̂ŋ-thîao châawp maa thîao thîi nîi",
    chinese_meaning: "曼谷是一座很有意思的城市，有漂亮的寺庙、大市场和美食，游客都喜欢来这里。",
    category: "城市",
  },
  {
    id: "p-05",
    thai_word:
      "หน้าฝนเมืองไทยมีฝนตกบ่อย เราควรพกร่มติดตัว และดูแลสุขภาพด้วย เพราะอากาศเปลี่ยนง่าย",
    pronunciation:
      "nâa-fǒn mʉʉang thai mii fǒn tòk bɔ̀i rao khuan phók rôm dtìt-tuua lɛ́ duu-lɛɛ sùk-kà-phâap dûai phrɔ́ aa-gàat plìian ngâai",
    chinese_meaning: "泰国的雨季经常下雨，我们应该随身带伞，也要注意健康，因为天气容易变。",
    category: "天气",
  },
  {
    id: "p-06",
    thai_word:
      "เพื่อนที่ดีคือคนที่คอยให้กำลังใจเรา เวลาเราท้อ เราควรขอบคุณเขาทุกครั้ง",
    pronunciation:
      "phʉ̂an thîi dii kʉʉ khon thîi khɔɔi hâi gam-lang-jai rao wee-laa rao thɔ́ɔ rao khuan khàawp-khun khǎo thúk-khráng",
    chinese_meaning: "好朋友是总给我们鼓励的人，当我们气馁时，应该每次都感谢他。",
    category: "情感",
  },
];
