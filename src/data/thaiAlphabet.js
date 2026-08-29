/**
 * 泰语字母表数据
 * 包含辅音(高/中/低)、元音、声调、数字、特殊字符
 * 注：罗马音只使用单码位字符（无组合变音符号），避免显示乱码
 */

// ── 辅音 ──
export const highConsonants = [
  { letter: "ข", romanization: "khoɔ", keyboard: "K", example: "ไข่", exampleMeaning: "蛋", exampleRoman: "khai" },
  { letter: "ฃ", romanization: "khoɔ", keyboard: "", example: "ฃวด", exampleMeaning: "瓶子", exampleRoman: "khuat", note: "已废弃" },
  { letter: "ฉ", romanization: "choɔ", keyboard: "C", example: "ฉัน", exampleMeaning: "我", exampleRoman: "chan" },
  { letter: "ถ", romanization: "toɔ", keyboard: "T", example: "ถุง", exampleMeaning: "袋子", exampleRoman: "thung" },
  { letter: "ผ", romanization: "phoɔ", keyboard: "P", example: "ผู้", exampleMeaning: "人/位", exampleRoman: "phuu" },
  { letter: "ฝ", romanization: "foɔ", keyboard: "F", example: "ฝัน", exampleMeaning: "梦", exampleRoman: "fan" },
  { letter: "ศ", romanization: "soɔ", keyboard: "S", example: "ศิลปะ", exampleMeaning: "艺术", exampleRoman: "silap-pa" },
  { letter: "ษ", romanization: "soɔ", keyboard: "S", example: "ฤๅษี", exampleMeaning: "仙人", exampleRoman: "rue-sii" },
  { letter: "ส", romanization: "soɔ", keyboard: "S", example: "สวย", exampleMeaning: "漂亮", exampleRoman: "suay" },
  { letter: "ฬ", romanization: "loɔ", keyboard: "L", example: "จุฬา", exampleMeaning: "风筝", exampleRoman: "ju-laa" },
  { letter: "ญ", romanization: "yoɔ", keyboard: "Y", example: "หญิง", exampleMeaning: "女", exampleRoman: "ying" },
];

export const midConsonants = [
  { letter: "ก", romanization: "koɔ", keyboard: "D", example: "ไก่", exampleMeaning: "鸡", exampleRoman: "kai" },
  { letter: "จ", romanization: "joɔ", keyboard: "J", example: "จาน", exampleMeaning: "盘子", exampleRoman: "jaan" },
  { letter: "ฎ", romanization: "doɔ", keyboard: "", example: "ชฎา", exampleMeaning: "皇冠", exampleRoman: "cha-daa" },
  { letter: "ฏ", romanization: "toɔ", keyboard: "", example: "ปฏัก", exampleMeaning: "矛", exampleRoman: "pa-tak" },
  { letter: "ด", romanization: "doɔ", keyboard: "D", example: "เด็ก", exampleMeaning: "孩子", exampleRoman: "dek" },
  { letter: "ต", romanization: "toɔ", keyboard: "T", example: "ตา", exampleMeaning: "眼睛/外公", exampleRoman: "taa" },
  { letter: "บ", romanization: "boɔ", keyboard: "B", example: "บ้าน", exampleMeaning: "家", exampleRoman: "baan" },
  { letter: "ป", romanization: "bpoɔ", keyboard: "P", example: "ปาก", exampleMeaning: "嘴", exampleRoman: "bpaak" },
  { letter: "อ", romanization: "oɔ", keyboard: "O", example: "อยู่", exampleMeaning: "在/住", exampleRoman: "yuu" },
  { letter: "ฮ", romanization: "hoɔ", keyboard: "H", example: "ฮา", exampleMeaning: "好笑", exampleRoman: "haa" },
];

export const lowConsonants = [
  { letter: "ค", romanization: "khoɔ", keyboard: "K", example: "ควาย", exampleMeaning: "水牛", exampleRoman: "khwaai" },
  { letter: "ฅ", romanization: "khoɔ", keyboard: "", example: "ฅน", exampleMeaning: "人", exampleRoman: "khon", note: "已废弃" },
  { letter: "ฆ", romanization: "khoɔ", keyboard: "K", example: "ระฆัง", exampleMeaning: "钟", exampleRoman: "ra-khang" },
  { letter: "ง", romanization: "ngoɔ", keyboard: "", example: "งู", exampleMeaning: "蛇", exampleRoman: "nguu" },
  { letter: "ช", romanization: "choɔ", keyboard: "C", example: "ช้าง", exampleMeaning: "大象", exampleRoman: "chaang" },
  { letter: "ซ", romanization: "soɔ", keyboard: "S", example: "โซ่", exampleMeaning: "链子", exampleRoman: "soo" },
  { letter: "ฌ", romanization: "choɔ", keyboard: "C", example: "เฌอ", exampleMeaning: "树", exampleRoman: "choe" },
  { letter: "ญ", romanization: "yoɔ", keyboard: "Y", example: "ญาติ", exampleMeaning: "亲戚", exampleRoman: "yat" },
  { letter: "ฑ", romanization: "toɔ", keyboard: "T", example: "มณโฑ", exampleMeaning: "人名", exampleRoman: "ma-na-thoo" },
  { letter: "ฒ", romanization: "toɔ", keyboard: "T", example: "ผู้เฒ่า", exampleMeaning: "老人", exampleRoman: "phuu-thao" },
  { letter: "ณ", romanization: "noɔ", keyboard: "N", example: "ใน", exampleMeaning: "在…里面", exampleRoman: "nai" },
  { letter: "ท", romanization: "toɔ", keyboard: "T", example: "ที่", exampleMeaning: "地方", exampleRoman: "thii" },
  { letter: "ธ", romanization: "toɔ", keyboard: "T", example: "ธง", exampleMeaning: "旗", exampleRoman: "thong" },
  { letter: "น", romanization: "noɔ", keyboard: "N", example: "น้ำ", exampleMeaning: "水", exampleRoman: "nam" },
  { letter: "พ", romanization: "phoɔ", keyboard: "P", example: "พ่อ", exampleMeaning: "爸爸", exampleRoman: "phoo" },
  { letter: "ฟ", romanization: "foɔ", keyboard: "F", example: "ฟัน", exampleMeaning: "牙", exampleRoman: "fan" },
  { letter: "ภ", romanization: "phoɔ", keyboard: "P", example: "ภาษา", exampleMeaning: "语言", exampleRoman: "phaa-saa" },
  { letter: "ม", romanization: "moɔ", keyboard: "M", example: "มือ", exampleMeaning: "手", exampleRoman: "mue" },
  { letter: "ย", romanization: "yoɔ", keyboard: "Y", example: "ยิ้ม", exampleMeaning: "微笑", exampleRoman: "yim" },
  { letter: "ร", romanization: "roɔ", keyboard: "R", example: "ร้อน", exampleMeaning: "热", exampleRoman: "roon" },
  { letter: "ล", romanization: "loɔ", keyboard: "L", example: "ลม", exampleMeaning: "风", exampleRoman: "lom" },
  { letter: "ว", romanization: "woɔ", keyboard: "W", example: "วัน", exampleMeaning: "天/日", exampleRoman: "wan" },
  { letter: "ฮ", romanization: "hoɔ", keyboard: "H", example: "ฮา", exampleMeaning: "好笑", exampleRoman: "haa" },
];

// ── 元音 ──
export const vowels = [
  { letter: "–ะ", romanization: "a", position: "短元音", example: "กะ", exampleMeaning: "估计", exampleRoman: "ga" },
  { letter: "–า", romanization: "aa", position: "长元音", example: "กา", exampleMeaning: "乌鸦", exampleRoman: "gaa" },
  { letter: "–ิ", romanization: "i", position: "上元音", example: "กิ", exampleMeaning: "—", exampleRoman: "gi" },
  { letter: "–ี", romanization: "ii", position: "上元音", example: "กี", exampleMeaning: "—", exampleRoman: "gii" },
  { letter: "–ึ", romanization: "ue", position: "上元音", example: "กึ", exampleMeaning: "—", exampleRoman: "gue" },
  { letter: "–ื", romanization: "uee", position: "上元音", example: "กือ", exampleMeaning: "—", exampleRoman: "guee" },
  { letter: "–ุ", romanization: "u", position: "下元音", example: "กุ", exampleMeaning: "—", exampleRoman: "gu" },
  { letter: "–ู", romanization: "uu", position: "下元音", example: "กู", exampleMeaning: "—", exampleRoman: "guu" },
  { letter: "เ–ะ", romanization: "e", position: "前元音", example: "เกะ", exampleMeaning: "削", exampleRoman: "ge" },
  { letter: "เ–", romanization: "ee", position: "前元音", example: "เก", exampleMeaning: "弯", exampleRoman: "gee" },
  { letter: "แ–ะ", romanization: "ae", position: "前元音", example: "แกะ", exampleMeaning: "羊", exampleRoman: "gae" },
  { letter: "แ–", romanization: "aee", position: "前元音", example: "แก", exampleMeaning: "你/老", exampleRoman: "gae" },
  { letter: "โ–ะ", romanization: "o", position: "后元音", example: "โกะ", exampleMeaning: "—", exampleRoman: "go" },
  { letter: "โ–", romanization: "oo", position: "后元音", example: "โก", exampleMeaning: "—", exampleRoman: "goo" },
  { letter: "เ–าะ", romanization: "o", position: "后元音", example: "กาะ", exampleMeaning: "岛", exampleRoman: "go" },
  { letter: "–อ", romanization: "oɔ", position: "后元音", example: "กอ", exampleMeaning: "—", exampleRoman: "goɔ" },
  { letter: "เ–อะ", romanization: "e", position: "央元音", example: "เกอะ", exampleMeaning: "—", exampleRoman: "ge" },
  { letter: "เ–อ", romanization: "ee", position: "央元音", example: "เกอ", exampleMeaning: "—", exampleRoman: "gee" },
  // 复合元音
  { letter: "เ–ียะ", romanization: "ia", position: "复合元音", example: "เกียะ", exampleMeaning: "—", exampleRoman: "gia" },
  { letter: "เ–ีย", romanization: "iia", position: "复合元音", example: "เกีย", exampleMeaning: "—", exampleRoman: "gii-a" },
  { letter: "เ–ือะ", romanization: "uea", position: "复合元音", example: "เกือะ", exampleMeaning: "—", exampleRoman: "guea" },
  { letter: "เ–ือ", romanization: "ueea", position: "复合元音", example: "เกือ", exampleMeaning: "几乎", exampleRoman: "guuea" },
  { letter: "–ัวะ", romanization: "ua", position: "复合元音", example: "กัวะ", exampleMeaning: "—", exampleRoman: "gua" },
  { letter: "–ัว", romanization: "uua", position: "复合元音", example: "กัว", exampleMeaning: "害怕", exampleRoman: "guua" },
];

// ── 声调 ──
export const tones = [
  { symbol: "่", name: "เอก", tone: "第1声(低平)", romanization: "mai ek", example: "ก่า", meaning: "故意" },
  { symbol: "้", name: "โท", tone: "第2声(降调)", romanization: "mai tho", example: "ก้า", meaning: "(语气词)" },
  { symbol: "๊", name: "ตรี", tone: "第3声(高平)", romanization: "mai tri", example: "ก๊า", meaning: "(语气词)" },
  { symbol: "๋", name: "จัตวา", tone: "第4声(升调)", romanization: "mai jattawa", example: "ก๋า", meaning: "(方言)" },
];

// ── 数字 ──
export const digits = [
  { arabic: "0", thai: "๐", romanization: "suun" },
  { arabic: "1", thai: "๑", romanization: "neung" },
  { arabic: "2", thai: "๒", romanization: "saawng" },
  { arabic: "3", thai: "๓", romanization: "saam" },
  { arabic: "4", thai: "๔", romanization: "sii" },
  { arabic: "5", thai: "๕", romanization: "haa" },
  { arabic: "6", thai: "๖", romanization: "hok" },
  { arabic: "7", thai: "๗", romanization: "jet" },
  { arabic: "8", thai: "๘", romanization: "bpaaet" },
  { arabic: "9", thai: "๙", romanization: "gao" },
];

// ── 特殊字符 ──
export const specialChars = [
  { letter: "ก์", name: "不发音标记", romanization: "karan", meaning: "使辅音不发音" },
  { letter: "ฯ", name: "缩写标记", romanization: "pai-yan-noi", meaning: "表示缩写" },
  { letter: "ฯลฯ", name: "等等", romanization: "lai-lai", meaning: "等等、以及其他" },
  { letter: "฿", name: "泰铢", romanization: "baat", meaning: "泰国货币单位" },
];
