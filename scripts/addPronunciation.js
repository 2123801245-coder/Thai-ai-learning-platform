#!/usr/bin/env node
/**
 * 泰语读音自动补全脚本
 * 使用音节字典为缺少读音的词条自动生成罗马音
 */
import { readFileSync, writeFileSync } from 'fs';

// ============================================================
// 泰语音节字典（常见音节→罗马音映射）
// ============================================================
const SYLLABLE_DICT = {
  // 单辅音音节
  'กร': 'gwn',
  'กล': 'gl',
  'กอ': 'go',
  'กิ': 'gi',
  'กู': 'guu',
  'กี': 'gii',
  'กา': 'gaa',
  'กั': 'ga',
  'กุ': 'gu',
  'ก็': 'gaw',
  'เก': 'ge',
  'แก': 'gae',
  'โก': 'go',
  '.gpu': 'gpu',
  'ข': 'kaw',
  'ขอ': 'khaw',
  'ขอ': 'khaw',
  'ขว': 'kwa',
  'คว': 'kwa',
  'ค': 'kaw',
  'คิ': 'ki',
  'คี': 'kii',
  'คา': 'khaa',
  'คั': 'kha',
  'คุ': 'khu',
  'คู': 'khuu',
  'เค': 'khe',
  'เง': 'nge',
  'ง': 'ngaw',
  'จ': 'jaw',
  'จอ': 'jaw',
  'จิ': 'ji',
  'จี': 'jii',
  'จู': 'juu',
  'ฉ': 'chaw',
  'ช': 'chaw',
  'ชิ': 'chi',
  'ชี': 'chii',
  'ชุ': 'chu',
  'ซ': 'saw',
  'ฌ': 'chaw',
  'ญ': 'yaw',
  'ฎ': 'daw',
  'ฏ': 'taw',
  'ฐ': 'taw',
  'ฑ': 'taw',
  'ฒ': 'taw',
  'ณ': 'naw',
  'ด': 'daw',
  'ดิ': 'di',
  'ดี': 'dii',
  'ดู': 'duu',
  'ต': 'dtaw',
  'ติ': 'dti',
  'ตี': 'dtii',
  'ตู': 'dtuu',
  'ถ': 'taw',
  'ถิ': 'ti',
  'ท': 'taw',
  'ทิ': 'ti',
  'ที': 'tii',
  'ธ': 'taw',
  'น': 'naw',
  'นิ': 'ni',
  'นี': 'nii',
  'บ': 'baw',
  'บิ': 'bi',
  'ป': 'bpaw',
  'ปิ': 'bpi',
  'ปู': 'bpuu',
  'ผ': 'paw',
  'ฝ': 'faw',
  'พ': 'paw',
  'พิ': 'pi',
  'พี': 'pii',
  'ฟ': 'faw',
  'ภ': 'paw',
  'ม': 'maw',
  'มิ': 'mi',
  'มี': 'mii',
  'มุ': 'mu',
  'ย': 'yaw',
  'ยิ': 'yi',
  'ร': 'raw',
  'ริ': 'ri',
  'รี': 'rii',
  'ล': 'law',
  'ลิ': 'li',
  'ลี': 'lii',
  'ลู': 'luu',
  'ว': 'waw',
  'วิ': 'wi',
  'ศ': 'saw',
  'ษ': 'saw',
  'ส': 'saw',
  'สิ': 'si',
  'สี': 'sii',
  'ห': 'haw',
  'หิ': 'hi',
  'อ': 'aw',
  'ฮ': 'haw',

  // 常用双音节
  'สวัสดี': 'sà-wàt-dii',
  'ขอบคุณ': 'kòp-kun',
  'ยินดี': 'yin-dii',
  'สบาย': 'sà-baai',
  'ดีใจ': 'dii-jai',
  'เสียใจ': 'sǐa-jai',
  'รัก': 'rák',
  'เกลียด': 'glìat',
  'ชอบ': 'chôop',
  'ชัง': 'chang',
  'โกรธ': 'krôht',
  'หัวเราะ': 'hǔa-rɔ̀',

  // 复合词前缀
  'นัก': 'nák',
  'การ': 'gaan',
  'เรื่อง': 'rêuang',
  'ข้อ': 'khɔ̂ɔ',
  'ค่า': 'khâa',
  'เงิน': 'ngern',
  'บ้าน': 'bâan',
  'เมือง': 'meuang',
  'โรง': 'roong',
  'หน้า': 'nâa',
  'หลัง': 'lǎng',
  'ข้าง': 'khâang',
  'บน': 'bon',
  'ล่าง': 'lâang',
  'ใน': 'nai',
  'นอก': 'nɔ̀ɔk',
  'กลาง': 'glaang',
  'ข้าง': 'khâang',
  'ซ้าย': 'sáai',
  'ขวา': 'khǎa',
  'หน้า': 'nâa',
  'หลัง': 'lǎng',
  'ล่าง': 'lâang',
  'บน': 'bon',
  'ข้าง': 'khâang',
  'ตรง': 'trong',
  'เดิน': 'dern',
  'วิ่ง': 'wîng',
  'นั่ง': 'nâng',
  'ยืน': 'yuen',
  'ลุก': 'lúk',
  'นอน': 'nawn',
  'นอน': 'nawn',
  'ตื่น': 'têun',
  'กิน': 'gin',
  'ดื่ม': 'dèum',
  'ทำ': 'tam',
  'ไป': 'pai',
  'มา': 'maa',
  'อยู่': 'yûu',
  'ได้': 'dâai',
  'จะ': 'jà',
  'แล้ว': 'léaw',
  'ไม่': 'mâi',
  'ยัง': 'yang',
  'เคย': 'koei',
  'เคย': 'koei',
  'เกือบ': 'gèuap',
  'พอ': 'paw',
  'มาก': 'mâak',
  'น้อย': 'nói',
  'ดี': 'dii',
  'ร้าย': 'rái',
  'สวย': 'sǔai',
  'หล่อ': 'lɔ̀ɔ',
  'สูง': 'sǔung',
  'เตี้ย': 'dtîa',
  'อ้วน': 'ûan',
  'ผอม': 'pɔ̌ɔm',
  'เร็ว': 'reo',
  'ช้า': 'cháa',
  'เร็ว': 'reo',
  'ใหม่': 'mài',
  'เก่า': 'gào',
  'เย็น': 'yen',
  'ร้อน': 'rɔ́ɔn',
  'หนาว': 'nǎo',
  'ฝน': 'fǒn',
  'แดด': 'dàet',
  'ลม': 'lom',
  'น้ำ': 'nám',
  'ไฟ': 'fai',
  'ดิน': 'din',
  'หิน': 'hǐn',
  'ทราย': 'saai',
  'ป่า': 'bpàa',
  'เขา': 'kǎo',
  'แม่น้ำ': 'mɛ̂ɛ-nám',
  'ทะเล': 'ta-lɛɛ',
  'เกาะ': 'gòr',
  'คลอง': 'klawng',
  'สะพาน': 'sà-paan',
  'ถนน': 'ta-nǒn',
  'ทาง': 'tǎang',
  'ช่อง': 'chɔ̌ɔng',
  'ทางเท้า': 'tǎang-táo',
  'ไหล่ทาง': 'lài-tǎang',
  'ป้าย': 'bpâai',
  'ไฟแดง': 'fai-daeng',
  'ไฟเขียว': 'fai-kǐao',
  'ไฟเหลือง': 'fai-lǔeang',
  'จอด': 'jòt',
  'จอดรถ': 'jòt-rót',
  'จอดรถ': 'jòt-rót',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'ขับ': 'khàp',
  'ขับรถ': 'khàp-rót',
  'หยุด': 'yút',
  'หยุดรถ': 'yút-rót',
  'ถอย': 'tɔ̀i',
  'ถอยหลัง': 'tɔ̀i-lǎng',
  'ตรงไป': 'trong-pai',
  'เปลี่ยน': 'plìan',
  'เปลี่ยนเลน': 'plìan-len',
  'แซง': 'sàeng',
  'ขับช้า': 'khàp-cháa',
  'ขับเร็ว': 'khàp-reo',
  'ทางยกระดับ': 'tǎang-yók-grà-dàp',
  'ทางด่วน': 'tǎang-dùan',
  'ทางด่วนพิเศษ': 'tǎang-dùan-pà-sèet',
  'ถนนลาดยาง': 'ta-nǒn-lâat-yaang',
  'ถนนลูกรัง': 'ta-nǒn-luuk-rang',
  'เกาะกลางถนน': 'gòr-glaang-ta-nǒn',
  'ป้ายหยุด': 'bpâai-yút',
  'ป้ายจราจร': 'bpâai-jà-raa-jon',
  'ป้ายจอดรถ': 'bpâai-jòt-rót',
  'ป้ายห้าม': 'bpâai-hâam',
  'ป้ายทางเดียว': 'bpâai-tǎang-diao',
  'ป้ายกลับรถ': 'bpâai-glàp-rót',
  'ป้ายเลี้ยว': 'bpâai-lîao',
  'ป้ายตรง': 'bpâai-trong',
  'ป้ายไฟ': 'bpâai-fai',
  'ป้ายจำกัดความเร็ว': 'bpâai-jàm-gàt-kwaam-reo',
  'แผนที่ถนน': 'pǎen-tîi-ta-nǒn',
  'เวลาเดินทาง': 'wee-laa-dern-tǎang',
  'ความเร็วสูง': 'kwaam-reo-sǔung',
  'ความเร็วต่ำ': 'kwaam-reo-dtâm',
  'ช่องทางซ้าย': 'chɔ̌ɔng-tǎang-sáai',
  'ช่องทางขวา': 'chɔ̌ɔng-tǎang-khǎa',
  'ช่องทางตรง': 'chɔ̌ɔng-tǎang-trong',
  'ช่องทางกลับรถ': 'chɔ̌ɔng-tǎang-glàp-rót',
  'เลี้ยวซ้าย': 'lîao-sáai',
  'เลี้ยวขวา': 'lîao-khǎa',
  'จอดรถข้างทาง': 'jòt-rót-khâang-tǎang',
  'จอดรถในลาน': 'jòt-rót-nai-laan',
  'จอดรถชั่วคราว': 'jòt-rót-chûa-khraaw',
  'ห้ามจอด': 'hâam-jòt',
  'ห้ามจอดรถ': 'hâam-jòt-rót',
  'เสียค่าจอด': 'sǐa-khâa-jòt',
  'ค่าทางด่วน': 'khâa-tǎang-dùan',
  'เช็คน้ำมัน': 'chêek-nám-man',
  'เช็คลมยาง': 'chêek-lom-yaang',
  'เติมลมยาง': 'dter-m-lom-yaang',
  'เปลี่ยนน้ำมันเครื่อง': 'plìan-nám-man-krêuang',
  'เปลี่ยนหลอดไฟ': 'plìan-lôht-fai',
  'ซ่อมเครื่องยนต์': 'sɔ̌ɔm-krêuang-yon',
  'ซ่อมแอร์': 'sɔ̌ɔm-ae',
  'ซ่อมกระจก': 'sɔ̌ɔm-grà-jòk',
  'ซ่อมไฟ': 'sɔ̌ɔm-fai',
  'ทำความสะอาดรถ': 'tam-sà-at-kà-raam-rót',
  'ดูดฝุ่นรถ': 'dûut-fùn-rót',
  'ขัดสี': 'khàt-sǐi',
  'เคลือบสี': 'khleuap-sǐi',
  'ติดฟิล์ม': 'dtìt-film',
  'ติดสติกเกอร์': 'dtìt-sticker',
  'เปลี่ยนป้ายทะเบียน': 'plìan-bpâai-tà-bian',
  'ต่อภาษี': 'dtɔ̀ɔ-paa-sǐi',
  'ต่อประกัน': 'dtɔ̀ɔ-bprà-gan',
  'ตรวจสภาพรถ': 'drûat-sà-pâap-rót',
  'ทำประกัน': 'tam-bprà-gan',
  'เคลมประกัน': 'khlaem-bprà-gan',
  'ถนนลื่น': 'ta-nǒn-lèun',
  'ถนนเปียก': 'ta-nǒn-bpìak',
  'ถนนแห้ง': 'ta-nǒn-hɛ̌ng',
  'ถนนมืด': 'ta-nǒn-mèut',
  'ถนนสว่าง': 'ta-nǒn-sà-wâang',
  'ถนนขรุขระ': 'ta-nǒn-khà-ru-khá-rá',
  'ถนนราบเรียบ': 'ta-nǒn-raap-bîap',
  'รถบัส': 'rót-bus',
  'รถตู้': 'rót-tûu',
  'รถแท็กซี่': 'rót-têek-sîi',
  'รถไฟฟ้า': 'rót-fai-fáa',
  'รถไฟใต้ดิน': 'rót-fai-dtâi-din',
  'เรือเร็ว': 'rěua-reo',
  'เฮลิคอปเตอร์': 'helicopter',
  'ไฟแดง': 'fai-daeng',
  'ไฟเขียว': 'fai-kǐao',
  'ไฟเหลือง': 'fai-lǔeang',
  'จอดรถ': 'jòt-rót',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'จอด': 'jòt',
  'จอด': 'jòt',
};

// ============================================================
// 泰语单字辅音→罗马音
// ============================================================
const THAI_CONSONANT_MAP = {
  'ก': 'g', 'ข': 'kh', 'ค': 'kh', 'ง': 'ng',
  'จ': 'j', 'ฉ': 'ch', 'ช': 'ch', 'ซ': 's',
  'ญ': 'y', 'ด': 'd', 'ต': 'dt', 'ถ': 't',
  'ท': 't', 'ธ': 't', 'น': 'n', 'บ': 'b',
  'ป': 'bp', 'ผ': 'ph', 'ฝ': 'f', 'พ': 'ph',
  'ฟ': 'f', 'ภ': 'ph', 'ม': 'm', 'ย': 'y',
  'ร': 'r', 'ล': 'l', 'ว': 'w', 'ศ': 's',
  'ษ': 's', 'ส': 's', 'ห': 'h', 'อ': '',
  'ฮ': 'h',
};

const THAI_VOWEL_MAP = {
  'ะ': 'a', 'ั': 'a', 'า': 'aa', 'ำ': 'am',
  'ิ': 'i', 'ี': 'ii', 'ุ': 'u', 'ู': 'uu',
  'เ': 'e', 'แ': 'ae', 'โ': 'o', 'ใ': 'ai',
  'ไ': 'ai', 'ๅ': 'aa',
};

const THAI_TONE_MARKERS = ['่', '้', '๊', '๋'];

function syllabize(word) {
  // Simple syllabizer: break word into syllables based on vowel positions
  const syllables = [];
  let current = '';
  let hasVowel = false;

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    current += ch;

    if (THAI_VOWEL_MAP[ch] || ch === 'ะ' || ch === 'า') {
      hasVowel = true;
    }

    // Check if next char starts a new syllable
    if (hasVowel && i < word.length - 1) {
      const next = word[i + 1];
      // If next is a consonant and we have a vowel, end syllable
      if (THAI_CONSONANT_MAP[next] && !THAI_TONE_MARKERS.includes(next)) {
        // Check if it's a final consonant or start of new syllable
        if ('กขงดตนบปスタッ'.includes(ch) || THAI_TONE_MARKERS.includes(ch)) {
          syllables.push(current);
          current = '';
          hasVowel = false;
        } else if (THAI_VOWEL_MAP[next] || next === 'เ' || next === 'แ' || next === 'โ' || next === 'ไ' || next === 'ใ') {
          // Next is a vowel start, this consonant belongs to next syllable
          syllables.push(current);
          current = '';
          hasVowel = false;
        }
      }
    }
  }

  if (current) syllables.push(current);
  return syllables;
}

function generateRomanization(word) {
  // First try full word lookup
  if (SYLLABLE_DICT[word]) return SYLLABLE_DICT[word];

  // Try syllable-by-syllable
  const syllables = syllabize(word);
  if (syllables.length > 1) {
    const parts = syllables.map(s => {
      if (SYLLABLE_DICT[s]) return SYLLABLE_DICT[s];
      return simpleRomanize(s);
    });
    return parts.join('-');
  }

  return simpleRomanize(word);
}

function simpleRomanize(word) {
  let result = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (THAI_TONE_MARKERS.includes(ch)) continue;

    if (THAI_CONSONANT_MAP[ch] !== undefined) {
      result += THAI_CONSONANT_MAP[ch];
    } else if (THAI_VOWEL_MAP[ch]) {
      result += THAI_VOWEL_MAP[ch];
    } else if (ch === 'ะ') {
      result += 'a';
    } else if (ch === 'ร' && i > 0) {
      result += 'r';
    } else if (ch === 'ล') {
      result += 'l';
    } else if (ch === 'ว') {
      result += 'w';
    } else if (ch === 'น') {
      result += 'n';
    } else if (ch === 'ม') {
      result += 'm';
    } else if (ch === 'ย') {
      result += 'y';
    }
  }
  return result || word;
}

// ============================================================
// 主函数
// ============================================================
function addPronunciation() {
  console.log('📖 读取词库...');
  const content = readFileSync('src/data/vocabAllBooks.js', 'utf8');
  const match = content.match(/export const vocabAllBooks = (\[[\s\S]*?\]);/);
  const data = JSON.parse(match[1]);

  let updated = 0;
  const fixed = data.map(entry => {
    if (entry.pronunciation && entry.pronunciation !== '—' && entry.pronunciation !== '-') {
      return entry;
    }

    const pron = generateRomanization(entry.word);
    updated++;

    return {
      ...entry,
      pronunciation: pron,
      source: entry.source === 'fixed-v2' ? 'fixed-v3' : entry.source,
    };
  });

  console.log(`✅ 补全读音: ${updated} 条`);

  // Verify
  const stillMissing = fixed.filter(e => !e.pronunciation || e.pronunciation === '—');
  console.log(`⚠️  仍缺读音: ${stillMissing.length} 条`);
  if (stillMissing.length > 0) {
    stillMissing.slice(0, 10).forEach(e => console.log('  -', e.word));
  }

  // Write
  const output = `// 自动生成 - 泰语词库 v3 (补全读音)
// 生成时间: ${new Date().toISOString()}
// 共 ${fixed.length} 条词条

export const vocabAllBooks = ${JSON.stringify(fixed, null, 0)};

// 词书统计
export const BOOK_STATS = ${JSON.stringify(
    (() => {
      const stats = {};
      fixed.forEach(e => {
        if (!stats[e.category]) stats[e.category] = { count: 0, beginner: 0, intermediate: 0, advanced: 0 };
        stats[e.category].count++;
        stats[e.category][e.difficulty]++;
      });
      return stats;
    })(),
    null,
    2
  )};
`;

  writeFileSync('src/data/vocabAllBooks.js', output, 'utf8');
  console.log(`\n✅ 已写入 src/data/vocabAllBooks.js`);
}

addPronunciation();
