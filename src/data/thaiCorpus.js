export const THAI_CORPUS_SCENES = [
  { id: "daily", label: "日常生活" },
  { id: "travel", label: "旅行出行" },
  { id: "food", label: "餐饮点餐" },
  { id: "work", label: "工作商务" },
  { id: "health", label: "健康医疗" },
  { id: "shopping", label: "购物服务" },
  { id: "social", label: "社交沟通" },
];

export const THAI_CORPUS_LEVELS = [
  { id: "beginner", label: "初级" },
  { id: "intermediate", label: "中级" },
  { id: "advanced", label: "高级" },
];

const rows = [
  ["daily-001", "วันนี้อากาศดีมากเลย", "wan-níi aa-gàat dii mâak loei", "今天天气真好", "daily", "beginner", ["อากาศ", "ดี"]],
  ["daily-002", "พรุ่งนี้เราต้องตื่นเช้า", "phrûng-níi rao tông tʉ̀ʉn cháo", "明天我们必须早起", "daily", "beginner", ["พรุ่งนี้", "ตื่นเช้า"]],
  ["daily-003", "ช่วยปิดไฟให้หน่อยได้ไหม", "chûai pìt fai hâi nòi dâai mái", "可以帮我关一下灯吗？", "daily", "beginner", ["ช่วย", "ปิดไฟ"]],
  ["daily-004", "เดี๋ยวฉันกลับมานะ", "dĭao chăn glàp maa ná", "我一会儿就回来", "daily", "beginner", ["เดี๋ยว", "กลับมา"]],
  ["daily-005", "ช่วงนี้ฉันกำลังฝึกพูดภาษาไทย", "chûang níi chăn gam-lang fʉ̀k phûut phaa-săa thai", "最近我正在练习说泰语", "daily", "intermediate", ["ช่วงนี้", "กำลังฝึก"]],
  ["daily-006", "ถ้าเหนื่อยก็พักก่อนได้นะ", "tâa nʉ̀ai gɔ̂ phák gɔ̀ɔn dâai ná", "如果累了就先休息吧", "daily", "intermediate", ["เหนื่อย", "พัก"]],
  ["daily-007", "ฉันยังไม่ค่อยชินกับอากาศร้อน", "chăn yang mâi kɔ̂i chin gàp aa-gàat rɔ́ɔn", "我还不太习惯炎热的天气", "daily", "intermediate", ["ยังไม่ค่อย", "ชิน"]],
  ["daily-008", "ขอเวลาคิดอีกสักครู่นะ", "kŏr way-laa khít ìik sàk khrûu ná", "请给我一点时间再想想", "daily", "intermediate", ["ขอเวลา", "คิด"]],
  ["travel-001", "สนามบินอยู่ไกลจากที่นี่ไหม", "sa-năam-bin yùu glai jàak thîi-nîi mái", "机场离这里远吗？", "travel", "beginner", ["สนามบิน", "ไกล"]],
  ["travel-002", "ช่วยเรียกแท็กซี่ให้หน่อยครับ", "chûai rîak thák-sîi hâi nòi khráp", "请帮我叫一辆出租车", "travel", "beginner", ["เรียก", "แท็กซี่"]],
  ["travel-003", "ฉันจองห้องพักไว้ในชื่อนี้", "chăn jɔɔng hông phák wái nai chʉ̂ʉ níi", "我用这个名字预订了房间", "travel", "intermediate", ["จอง", "ห้องพัก"]],
  ["travel-004", "รถไฟขบวนนี้ไปเชียงใหม่หรือเปล่า", "rót-fai khà-buan níi pai chiiang-mài rʉ̌ʉ plào", "这趟火车去清迈吗？", "travel", "intermediate", ["ขบวน", "เชียงใหม่"]],
  ["travel-005", "ถนนเส้นนี้ช่วงเย็นรถติดมาก", "thà-nŏn sên níi chûang yen rót-tìt mâak", "这条路傍晚很堵车", "travel", "intermediate", ["ถนน", "รถติด"]],
  ["food-001", "ขอเมนูหน่อยครับ", "kŏr mee-nuu nòi khráp", "请给我菜单", "food", "beginner", ["เมนู"]],
  ["food-002", "จานนี้เผ็ดมากไหมคะ", "jaan níi phèt mâak mái khá", "这道菜很辣吗？", "food", "beginner", ["จาน", "เผ็ด"]],
  ["food-003", "ไม่ใส่ผักชีได้ไหมครับ", "mâi sài phàk-chii dâai mái khráp", "可以不放香菜吗？", "food", "beginner", ["ไม่ใส่", "ผักชี"]],
  ["food-004", "ขอน้ำเปล่าอีกหนึ่งขวดครับ", "kŏr nám plào ìik nʉ̀ng khùat khráp", "请再给我一瓶白水", "food", "beginner", ["น้ำเปล่า", "ขวด"]],
  ["food-005", "รสชาตินี้กลมกล่อมและไม่เค็มเกินไป", "rót-châat níi glom-glòm láe mâi khem gəən-pai", "这个味道很协调，不会太咸", "food", "intermediate", ["รสชาติ", "กลมกล่อม"]],
  ["food-006", "คิดเงินด้วยครับ โต๊ะหมายเลขห้า", "khít ngoen dûai khráp tó máai-lêek hâa", "请结账，五号桌", "food", "beginner", ["คิดเงิน", "โต๊ะ"]],
  ["work-001", "วันนี้มีประชุมตอนเก้าโมงเช้า", "wan-níi mii bprà-chum tɔɔn gâo moong cháo", "今天早上九点开会", "work", "beginner", ["ประชุม", "โมงเช้า"]],
  ["work-002", "ช่วยส่งเอกสารฉบับล่าสุดให้ผมด้วยครับ", "chûai sòng èek-gà-săan chà-bàp lâa-sùt hâi pŏm dûai khráp", "请把最新版本的文件发给我", "work", "intermediate", ["เอกสาร", "ฉบับล่าสุด"]],
  ["work-003", "เราควรทบทวนรายละเอียดก่อนตัดสินใจ", "rao khuan thóp-thuan raai-lá-ìat gɔ̀ɔn tàt-sĭn-jai", "我们应该在决定前再检查细节", "work", "advanced", ["ทบทวน", "รายละเอียด"]],
  ["work-004", "กำหนดส่งงานถูกเลื่อนไปเป็นวันศุกร์", "gam-nòt sòng ngaan thùuk lʉ̂an pai bpen wan-sùk", "提交工作的截止日期改到星期五了", "work", "advanced", ["กำหนดส่ง", "เลื่อน"]],
  ["health-001", "วันนี้รู้สึกไม่ค่อยสบาย", "wan-níi rúu-sʉ̀k mâi kɔ̂i sà-baai", "今天感觉不太舒服", "health", "beginner", ["รู้สึก", "ไม่สบาย"]],
  ["health-002", "มีไข้หรือไอร่วมด้วยไหมครับ", "mii khâi rʉ̌ʉ ai rûam dûai mái khráp", "你还发烧或咳嗽吗？", "health", "intermediate", ["ไข้", "ไอ"]],
  ["health-003", "ควรรับประทานยาหลังอาหารทันที", "khuan ráp-bprà-thaan yaa lăng aa-hăan than-thii", "应该在饭后立即服药", "health", "advanced", ["รับประทานยา", "ทันที"]],
  ["shopping-001", "อันนี้ราคาเท่าไหร่ครับ", "an-níi raa-khaa tâo-rài khráp", "这个多少钱？", "shopping", "beginner", ["ราคา"]],
  ["shopping-002", "มีสีอื่นหรือขนาดใหญ่กว่านี้ไหม", "mii sĭi ʉ̀ʉn rʉ̌ʉ khà-nàat yài gwàa níi mái", "有其他颜色或更大尺寸的吗？", "shopping", "intermediate", ["ขนาด", "สีอื่น"]],
  ["shopping-003", "ถ้าซื้อสองชิ้นลดราคาได้ไหมคะ", "tâa sʉ́ʉ sŏng chín lót raa-khaa dâai mái khá", "买两件可以打折吗？", "shopping", "intermediate", ["ลดราคา", "ชิ้น"]],
  ["social-001", "ยินดีที่ได้รู้จักครับ", "yin-dii thîi dâai rúu-jàk khráp", "很高兴认识你", "social", "beginner", ["ยินดี", "รู้จัก"]],
  ["social-002", "ไม่ได้เจอกันนานเลยนะ", "mâi dâai jəə gan naan loei ná", "好久不见啊", "social", "beginner", ["ไม่ได้เจอกัน", "นาน"]],
  ["social-003", "ขอบคุณที่ช่วยเหลือกันมาตลอด", "kɔ̀ɔp-khun thîi chûai-lʉ̌a gan maa tà-lɔ̀ɔt", "谢谢你一直以来的帮助", "social", "intermediate", ["ช่วยเหลือ", "มาตลอด"]],
  ["social-004", "ไว้มีโอกาสค่อยนัดเจอกันใหม่นะ", "wái mii oo-gàat kɔ̂i nát jəə gan mài ná", "以后有机会再约见吧", "social", "intermediate", ["มีโอกาส", "นัดเจอ"]],
];

export const thaiCorpus = rows.map((row) => {
  const [id, thai, romanization, chinese, scene, level, keywords] = row;
  return {
    id: String(id),
    thai: String(thai),
    romanization: String(romanization),
    chinese: String(chinese),
    scene: String(scene),
    level: String(level),
    keywords: Array.isArray(keywords) ? keywords.map(String) : [],
  };
});

export function searchThaiCorpus({ query = "", scene = "all", level = "all" } = {}) {
  const normalized = query.trim().toLowerCase();
  return thaiCorpus.filter((item) => {
    const matchesScene = scene === "all" || item.scene === scene;
    const matchesLevel = level === "all" || item.level === level;
    const haystack = [item.thai, item.romanization, item.chinese, ...item.keywords].join(" ").toLowerCase();
    return matchesScene && matchesLevel && (!normalized || haystack.includes(normalized));
  });
}

export function getThaiCorpusStats() {
  return {
    total: thaiCorpus.length,
    scenes: THAI_CORPUS_SCENES.map((scene) => ({ ...scene, count: thaiCorpus.filter((item) => item.scene === scene.id).length })),
    levels: THAI_CORPUS_LEVELS.map((level) => ({ ...level, count: thaiCorpus.filter((item) => item.level === level.id).length })),
  };
}
