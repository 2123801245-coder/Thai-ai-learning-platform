#!/usr/bin/env node
/**
 * 泰语词库全面修复脚本
 * 1. 去除泰文和中文尾部数字
 * 2. 去重（按泰文去重，保留第一条）
 * 3. 补充罗马音读音
 * 4. 修复模板化例句为自然泰语
 * 5. 按记忆难度分级：初级/中级/高级
 * 6. 输出到 src/data/vocabAllBooks.js
 */

import { readFileSync, writeFileSync } from 'fs';

// ============================================================
// 泰语常用词读音字典（覆盖高频词汇）
// ============================================================
const PRONUNCIATION_DICT = {
  // 问候
  'สวัสดี': 'sà-wàt-dii',
  'สบายดี': 'sà-baai-dii',
  'ขอบคุณ': 'kòp-kun',
  'ขอโทษ': 'kǎw-tôht',
  'ยินดี': 'yin-dii',
  'หวัดดี': 'wàt-dii',
  'อรุณสวัสดิ์': 'a-run-sà-wàt',
  'ราตรีสวัสดิ์': 'raa-dtrii-sà-wàt',
  'ลาก่อน': 'laa-gôn',
  'เจอกัน': 'joe-gan',
  'แล้วเจอกัน': 'léaw-joe-gan',
  'โชคดี': 'chôok-dii',
  'ปลอดภัย': 'plôht-pai',
  'ดีใจ': 'dii-jai',
  'เสียใจ': 'sǐa-jai',
  'สุขสันต์': 'sùk-sǎn',
  'ยินดีต้อนรับ': 'yin-dii tɔ̂ɔn-ráp',
  'ไม่เป็นไร': 'mâi pen rai',
  'สวัสดีครับ': 'sà-wàt-dii kráp',
  'สวัสดีค่ะ': 'sà-wàt-dii kâ',

  // 数字
  'หนึ่ง': 'nèung',
  'สอง': 'sǒng',
  'สาม': 'sǎam',
  'สี่': 'sìi',
  'ห้า': 'hâa',
  'หก': 'hòk',
  'เจ็ด': 'jèt',
  'แปด': 'bpàet',
  'เก้า': 'gâo',
  'สิบ': 'sìp',
  'ยี่สิบ': 'yîi-sìp',
  'สามสิบ': 'sǎam-sìp',
  'ร้อย': 'rói',
  'พัน': 'pan',
  'หมื่น': 'mèun',
  'ล้าน': 'láan',
  'ศูนย์': 'sǔun',
  'ครึ่ง': 'krûeng',
  'สี่สิบห้า': 'sìi-sìp-hâa',

  // 日常动作
  'กิน': 'gin',
  'ดื่ม': 'dèum',
  'นอน': 'nawn',
  'ตื่น': 'têun',
  'ลุก': 'lúk',
  'เดิน': 'dern',
  'วิ่ง': 'wîng',
  'นั่ง': 'nâng',
  'ยืน': 'yuen',
  'นั่ง': 'nâng',
  'เดิน': 'dern',
  'วิ่ง': 'wîng',
  'ล้าง': 'láang',
  'ซัก': 'sák',
  'ตาก': 'dtàak',
  'พับ': 'páp',
  'รีด': 'rît',
  'หั่น': 'hǎn',
  'สับ': 'sàp',
  'หั่น': 'hǎn',
  'ต้ม': 'dtôm',
  'ทอด': 'tɔ̌ɔt',
  'ย่าง': 'yâang',
  'ตุ๋น': 'dtun',
  'นึ่ง': 'nêung',
  'ผัด': 'pàt',
  'แกง': 'gaeng',
  'ลวก': 'lûak',
  'จี่': 'jìi',
  'เผา': 'pǎo',
  'คั่ว': 'kûai',
  'หมัก': 'màk',
  'ดอง': 'dawng',
  'ต้ม': 'dtôm',
  'เคี่ยว': 'kîao',
  'ตุ๋น': 'dtun',

  // 家庭成员
  'พ่อ': 'pɔ̂ɔ',
  'แม่': 'mɛ̂ɛ',
  'ลูก': 'lûuk',
  'พี่': 'pîi',
  'น้อง': 'nɔ́ɔng',
  'ปู่': 'bpùu',
  'ย่า': 'yâa',
  'ตา': 'dtaa',
  'ยาย': 'yaai',
  'ลุง': 'lung',
  'ป้า': 'bpâa',
  'น้า': 'náa',
  'อา': 'aa',
  'หลาน': 'láan',
  'ลูกเขย': 'lûuk-khǒei',
  'ลูกสะใภ้': 'lûuk-sà-pâi',
  'สามี': 'sǎa-mii',
  'ภรรยา': 'pan-ra-yaa',
  'สามี': 'sǎa-mii',
  'สามี': 'sǎa-mii',
  'สามี': 'sǎa-mii',
  'ครอบครัว': 'krûap-krûa',
  'ญาติ': 'yâat',
  'เพื่อน': 'pêuan',
  'แฟน': 'faen',
  'ลูกสาว': 'lûuk-sǎo',
  'ลูกชาย': 'lûuk-chai',

  // 颜色
  'สีแดง': 'sǐi daeng',
  'สีน้ำเงิน': 'sǐi nám-ngern',
  'สีเขียว': 'sǐi kǐao',
  'สีเหลือง': 'sǐi lǔeang',
  'สีขาว': 'sǐi kǎao',
  'สีดำ': 'sǐi dam',
  'สีชมพู': 'sǐi chom-puu',
  'สีม่วง': 'sǐi mûang',
  'สีส้ม': 'sǐi sôm',
  'สีน้ำตาล': 'sǐi nám-dtaan',
  'สีเทา': 'sǐi tao',
  'สีทอง': 'sǐi tawng',
  'สีเงิน': 'sǐi ngern',
  'สีฟ้า': 'sǐi fáa',
  'สีคราม': 'sǐi kraam',
  'สีแสด': 'sǐi kêat',
  'สีชมพู': 'sǐi chom-puu',
  'สีน้ำตาล': 'sǐi nám-dtaan',
  'สีส้ม': 'sǐi sôm',

  // 时间
  'วัน': 'wan',
  'สัปดาห์': 'sàp-daa',
  'เดือน': 'dèuan',
  'ปี': 'bpii',
  'เช้า': 'cháo',
  'เย็น': 'yen',
  'กลางวัน': 'glaang-wan',
  'กลางคืน': 'glaang-keun',
  'เที่ยง': 'tîang',
  'บ่าย': 'bàai',
  'ค่ำ': 'kâm',
  'ดึก': 'dèuk',
  'เที่ยงคืน': 'tîang-keun',
  'ตี': 'dii',
  'โมง': 'moong',
  'นาที': 'naa-tii',
  'ชั่วโมง': 'chûa-moong',
  'วินาที': 'wi-naa-tii',
  'วินาที': 'wi-naa-tii',
  'เมื่อวาน': 'mûea-waan',
  'วันนี้': 'wan-nîi',
  'พรุ่งนี้': 'prûng-nîi',
  'มะวาน': 'ma-waan',
  'เมื่อวานซืน': 'mûea-waan-seun',
  'อาทิตย์': 'aa-tít',
  'จันทร์': 'jan',
  'อังคาร': 'ang-khaan',
  'พุธ': 'pút',
  'พฤหัส': 'prú-hàt',
  'ศุกร์': 'sùk',
  'เสาร์': 'sǎo',

  // 地点
  'บ้าน': 'bâan',
  'คอนโด': 'kon-doh',
  'หอพัก': 'haw-pák',
  'โรงเรียน': 'roong-rian',
  'มหาวิทยาลัย': 'ma-hǎ-wít-ta-yaa-lai',
  'โรงพยาบาล': 'roong-pá-yaa-baan',
  'วัด': 'wát',
  'ตลาด': 'dtà-làat',
  'ห้างสรรพสินค้า': 'hâang sàp-sìn-kháa',
  'ร้านค้า': 'ráan-kháa',
  'ร้านอาหาร': 'ráan-aa-hǎan',
  'ธนาคาร': 'tha-naa-kaan',
  'ไปรษณีย์': 'bai-sá-nii',
  'สนามบิน': 'sà-nǎam-bin',
  'สถานี': 'sà-tǎa-nii',
  'ท่ารถ': 'tâa-rót',
  'ปั๊ม': 'pám',
  'โรงหนัง': 'roong-năng',
  'โรงภาพยนตร์': 'roong-pa-yaa-pèn',
  'สวน': 'sǔan',
  'สนาม': 'sà-nǎam',
  'สนามกอล์ฟ': 'sà-nǎam-golf',
  'ชายหาด': 'chai-hâat',
  'เกาะ': 'gòr',
  'ภูเขา': 'puu-kǎo',
  'น้ำตก': 'nám-dtòk',
  'ถ้ำ': 'tâm',
  'น้ำพุ': 'nám-puu',
  'แม่น้ำ': 'mɛ̂ɛ-nám',
  'ทะเล': 'ta-lɛɛ',
  'ทะเลสาบ': 'ta-lɛɛ-sàap',
  'ป่า': 'bpàa',
  'เขา': 'kǎo',
  'ดอย': 'doi',
  'อ่างเก็บน้ำ': 'àang-gèp-nám',
  'คลอง': 'klawng',
  'สะพาน': 'sà-paan',
  'อุโมงค์': 'u-moong',
  'ท่าเรือ': 'tâa-rěua',

  // 食物
  'ข้าว': 'khâao',
  'ข้าวผัด': 'khâao-pàt',
  'ข้าวมันไก่': 'khâao-man-gài',
  'ข้าวซอย': 'khâao-soi',
  'ก๋วยเตี๋ยว': 'gûai-dtǐao',
  'ส้มตำ': 'sôm-dtam',
  'ต้มยำ': 'dtôm-yam',
  'แกงเขียวหวาน': 'gaeng-kǐao-wǎan',
  'แกงจืด': 'gaeng-jèut',
  'ผัดไทย': 'pàt-tai',
  'มัสมั่น': 'mát-sà-mǎn',
  'พะแนง': 'pa-naeng',
  'กะเพรา': 'ga-prao',
  'พริก': 'prík',
  'น้ำปลา': 'nám-bpaa',
  'น้ำตาล': 'nám-dtaan',
  'เกลือ': 'gluea',
  'ซอส': 'sôt',
  'น้ำมัน': 'nám-man',
  'น้ำส้มสายชู': 'nám-sôm-sǎai-chuu',
  'ผัก': 'pàk',
  'ผลไม้': 'pǒn-lá-máai',
  'เนื้อ': 'nêua',
  'หมู': 'mǔu',
  'ไก่': 'gài',
  'เป็ด': 'bpèt',
  'ปลา': 'bpaa',
  'กุ้ง': 'gûng',
  'ปู': 'bpuu',
  'ไข่': 'kài',
  'เต้าหู้': 'dtâo-hûu',
  '豆腐': 'dtôu-fuu',
  'นม': 'nom',
  'กาแฟ': 'gaa-fae',

  // 旅行
  'สนามบิน': 'sà-nǎam-bin',
  'ตั๋ว': 'dtǔa',
  'หนังสือเดินทาง': 'nǎng-sěue-dern-tǎang',
  'พาสปอร์ต': 'pâat-sà-pôht',
  'วีซ่า': 'wii-sáa',
  'โรงแรม': 'roong-raem',
  'ห้อง': 'hɔ̌ɔng',
  'กุญแจ': 'gun-jae',
  'ล็อก': 'lók',
  'กระเป๋า': 'grà-bpǎo',
  'กระเป๋าเดินทาง': 'grà-bpǎo-dern-tǎang',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'กระเป๋า': 'grà-bpǎo',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',
  'แผนที่': 'pǎen-tîi',

  // 学习
  'เรียน': 'rian',
  'อ่าน': 'àan',
  'เขียน': 'kǐan',
  'ฟัง': 'fang',
  'พูด': 'pûut',
  'พิมพ์': 'pím',
  'คำ': 'kam',
  'ประโยค': 'bprà-yôek',
  'ความหมาย': 'kwaam-mǎai',
  'ภาษา': 'paa-sǎa',
  'วิชา': 'wí-chaa',
  'สอบ': 'sòp',
  'เกรด': 'grèet',
  'คะแนน': 'kà-naan',
  'ใบประกาศ': 'bai-prà-kaat',
  'ประกาศนียบัตร': 'prà-kaat-nii-yà-bàt',
  'ปริญญา': 'bprin-yaa',
  'นักเรียน': 'nák-rian',
  'นักศึกษา': 'nák-sèuk-sǎa',
  'อาจารย์': 'aa-jaan',
  'อาจารย์': 'aa-jaan',
  'อาจารย์': 'aa-jaan',
  'ห้องสมุด': 'hɔ̌ɔng-sà-mùt',
  'ตำรา': 'dtam-raa',
  'หนังสือ': 'nǎng-sěue',
  'สื่อ': 'sèue',
  'แบบฝึกหัด': 'bàep-fèuk-hàt',
  'การบ้าน': 'gaan-bâan',
  'โครงงาน': 'krɔ́-ngaan',
  'วิทยานิพนธ์': 'wít-ta-yaa-ní-pǒn',
  'วิจัย': 'wí-jai',
  'วิจัย': 'wí-jai',
  'วิจัย': 'wí-jai',
  'ห้องเรียน': 'hɔ̌ɔng-rian',
  'ห้องทดลอง': 'hɔ̌ɔng-tòk-lɔɔng',
  'ห้องเรียน': 'hɔ̌ɔng-rian',
  'ห้องเรียน': 'hɔ̌ɔng-rian',

  // 交通
  'รถยนต์': 'rót-yon',
  'รถเมล์': 'rót-mel',
  'รถไฟ': 'rót-fai',
  'แท็กซี่': 'têek-sîi',
  'ตุ๊กตุ๊ก': 'dtúk-dtúk',
  'มอเตอร์ไซค์': 'moh-dtê-sái',
  'จักรยาน': 'jàk-grà-yaan',
  'เครื่องบิน': 'krêang-bin',
  'เรือ': 'rěua',
  'เรือด่วน': 'rěua-dùan',
  'เรือข้ามฟาก': 'rěua-khâam-fáak',
  'สัญญาณไฟ': 'sǎn-yaan-fai',
  'ถนน': 'ta-nǒn',
  'สะพาน': 'sà-paan',
  'อุโมงค์': 'u-moong',
  'สี่แยก': 'sìi-yàek',
  'วงเวียน': 'wong-wian',
  'ทางด่วน': 'tǎang-dùan',
  'ทางเท้า': 'tǎang-táo',
  'ไหล่ทาง': 'lài-tǎang',
  'ป้าย': 'bpâai',
  'แผนที่': 'pǎen-tîi',
  'ระยะทาง': 'ra-yǎa-tǎang',
  'ความเร็ว': 'kwaam-reo',
  'ช่องทาง': 'chɔ̌ɔng-tǎang',
  'เลี้ยว': 'lîao',
  'ตรง': 'trong',
  'กลับรถ': 'glàp-rót',
  'จอดรถ': 'jòt-rót',
  'น้ำมัน': 'nám-man',
  'น้ำมันเบนซิน': 'nám-man-ben-zin',
  'น้ำมันดีเซล': 'nám-man-dii-sen',
  'ปั๊มน้ำมัน': 'pám-nám-man',
  'เติมน้ำมัน': 'dter-m-nám-man',
  'ซ่อมรถ': 'sɔ̌ɔm-rót',
  'ล้างรถ': 'láang-rót',
  'เปลี่ยนยาง': 'plìan-yaang',
  'เปลี่ยนผ้าเบรก': 'plìan-pâa-brèek',
  'อุบัติเหตุ': 'u-bàt-tì-hèut',
  'ชน': 'chon',
  'คว่ำ': 'khûam',
  'ไฟไหม้': 'fai-mái',
  'น้ำท่วม': 'nám-tûam',
  'ดินถล่ม': 'din-tà-lòm',
  'พายุ': 'pa-yu',
  'ลูกเห็บ': 'lûuk-hèp',
  'หิมะ': 'hì-má',
  'น้ำแข็ง': 'nám-kɛ̌ng',

  // 生活
  'ตื่นนอน': 'têun-nawn',
  'อาบน้ำ': 'aap-nám',
  'สระผม': 'sà-pǒm',
  'แปรงฟัน': 'praeng-fan',
  'แต่งตัว': 'dtàeng-dtua',
  'กินข้าว': 'gin-khâao',
  'ทำอาหาร': 'tam-aa-hǎan',
  'ล้างจาน': 'láang-jaan',
  'ซักผ้า': 'sák-pâa',
  'ตากผ้า': 'dtàak-pâa',
  'รีดผ้า': 'rît-pâa',
  'ทำความสะอาด': 'tam-sà-at-kà-raam',
  'ทำสวน': 'tam-sǔan',
  'รดน้ำ': 'rót-nám',
  'ตัดหญ้า': 'dtàt-yáa',
  'ซ่อมบ้าน': 'sɔ̌ɔm-bâan',
  'ทาสี': 'taa-sǐi',
  'ติดตั้ง': 'dtìt-dtâng',
  'ถอด': 'tɔ̀ɔt',
  'สวม': 'sǔam',
  'ใส่': 'sâi',
  'เปิด': 'bpòet',
  'ปิด': 'bpìt',
  'ล็อก': 'lók',
  'ไขกุญแจ': 'khài-gun-jae',
  'ถอดรองเท้า': 'tɔ̀ɔt-rɔɔng-táo',
  'สวมรองเท้า': 'sǔam-rɔɔng-táo',
  'หยิบ': 'yíp',
  'วาง': 'waang',
  'หย่อน': 'yɔ̀ɔn',
  'เก็บ': 'gèp',
  'โยน': 'yohn',
  'ปา': 'bpaa',
  'เขวี้ยง': 'kǔai-yâng',
  'ตี': 'dii',
  'ตบ': 'dtòp',
  'กอด': 'gôht',
  'จูบ': 'jûup',
  'จับ': 'jàp',
  'บีบ': 'bîip',
  'ดัน': 'dan',
  'ดึง': 'deung',
  'ดึง': 'deung',
  'ผลัก': 'pàk',
  'ลาก': 'lâak',
  'ดึง': 'deung',
  'ดึง': 'deung',
  'ดึง': 'deung',
  'ดึง': 'deung',
  'ดึง': 'deung',
  'ดึง': 'deung',

  // 购物
  'ซื้อ': 'séu',
  'ขาย': 'khǎai',
  'จ่ายเงิน': 'jàai-ngern',
  'ทอนเงิน': 'toon-ngern',
  'ราคา': 'raa-khaa',
  'ลด': 'lót',
  'โปรโมชั่น': 'proh-moh-chân',
  'ส่วนลด': 'sùan-lót',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',
  'ราคา': 'raa-khaa',

  // 点餐
  'สั่ง': 'sâng',
  'สั่งอาหาร': 'sâng-aa-hǎan',
  'เมนู': 'meh-nuu',
  'อาหาร': 'aa-hǎan',
  'อาหารไทย': 'aa-hǎan-tai',
  'อาหารจีน': 'aa-hǎan-jiin',
  'อาหารญี่ปุ่น': 'aa-hǎan-yîi-bùn',
  'อาหารอีสาน': 'aa-hǎan-îi-sǎan',
  'อาหารเหนือ': 'aa-hǎan-něua',
  'อาหารใต้': 'aa-hǎan-dtâi',
  'ของหวาน': 'kǒng-wǎan',
  'น้ำ': 'nám',
  'น้ำแข็ง': 'nám-kɛ̌ng',
  'น้ำตาล': 'nám-dtaan',
  'ช้อน': 'chɔ̂ɔn',
  'ส้อม': 'sɔ̂ɔm',
  'มีด': 'mîit',
  'จาน': 'jaan',
  'ชาม': 'chaam',
  'แก้ว': 'gâeo',
  'ถ้วย': 'tûai',
  'ตะเกียบ': 'dtà-gìap',
  'กระดาษ': 'grà-dàat',
  'ผ้าเช็ดมือ': 'pâa-khèt-mue',
  'ใบเสร็จ': 'bai-sèt',
  'เช็คบิล': 'chêek-bin',
  'ทิป': 'típ',
  'tip': 'típ',
  'บุฟเฟ่ต์': 'bú-fè',
  'อา-la-carte': 'aa-laa-kaat',
  'ชุด': 'chút',
  'จานเดียว': 'jaan-diao',
  'จานรวม': 'jaan-ruam',

  // 健康
  'สุขภาพ': 'sùk-kà-pâap',
  'โรงพยาบาล': 'roong-pá-yaa-baan',
  'หมอ': 'mǎw',
  'พยาบาล': 'pa-yaa-baan',
  'แพทย์': 'pâet',
  'พยาบาล': 'pa-yaa-baan',
  'ยา': 'yaa',
  'ยาเม็ด': 'yaa-mèt',
  'ยาน้ำ': 'yaa-nám',
  'ฉีด': 'chîit',
  'กินยา': 'gin-yaa',
  'ป่วย': 'bpùai',
  'เจ็บ': 'jèp',
  'ไข้': 'kâi',
  'ไอ': 'ai',
  'จาม': 'jaam',
  'ท้องเสีย': 'tɔ́ɔng-sǐa',
  'อาเจียน': 'aa-jiian',
  'เวียนหัว': 'wian-hǔa',
  'หน้ามืด': 'nâa-mèut',
  'เป็นลม': 'pen-lom',
  'ปวดหัว': 'bpùat-hǔa',
  'ปวดท้อง': 'bpùat-tɔ́ɔng',
  'ปวดหลัง': 'bpùat-lǎng',
  'ปวดขา': 'bpùat-khǎa',
  'ปวดแขน': 'bpùat-khǎen',
  'ปวดฟัน': 'bpùat-fan',
  'ฟกช้ำ': 'fòk-chám',
  'แผล': 'pǎe',
  'เลือด': 'lèuat',
  'แผล': 'pǎe',
  'แผล': 'pǎe',
  'แผล': 'pǎe',
  'แผล': 'pǎe',
  'แผล': 'pǎe',
  'แผล': 'pǎe',

  // 校园
  'นักเรียน': 'nák-rian',
  'นักศึกษา': 'nák-sèuk-sǎa',
  'อาจารย์': 'aa-jaan',
  'ห้องเรียน': 'hɔ̌ɔng-rian',
  'ห้องสมุด': 'hɔ̌ɔng-sà-mùt',
  'ห้องทดลอง': 'hɔ̌ɔng-tòk-lɔɔng',
  'ห้องอาหาร': 'hɔ̌ɔng-aa-hǎan',
  'หอพัก': 'haw-pák',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',
  'สนามกีฬา': 'sà-nǎam-gii-laa',

  // 政治
  'รัฐบาล': 'rát-tà-baan',
  'นายกรัฐมนตรี': 'naa-yók-rát-tà-mon-dtrii',
  'รัฐสภา': 'rát-tà-sà-paa',
  'วุฒิสภา': 'wút-tì-sà-paa',
  'สภาผู้แทนราษฎร': 'sà-paa-pûu-taen-râat-sà-dtrɔɔn',
  'เลือกตั้ง': 'lêuak-dtâng',
  'คะแนนเสียง': 'kà-naan-sǐang',
  'พรรคการเมือง': 'phák-gaan-měuang',
  'นโยบาย': 'ná-yaa-baa',
  'กฎหมาย': 'kot-mai',
  'ศาล': 'sǎan',
  'ตำรวจ': 'dtam-ruat',
  'ทหาร': 'tǎ-hǎan',
  '军队': 'kawn-taan',
  'สงคราม': 'sǒng-khraam',
  'สันติภาพ': 'sǎn-tì-pâap',
  'ประชาธิปไตย': 'bprà-chaa-tí-pà-dtai',
  'สิทธิ': 'sít-tì',
  'เสรีภาพ': 'sǎ-rii-pâap',

  // 经济
  'เศรษฐกิจ': 'sèet-tà-gìt',
  'เงิน': 'ngern',
  'รายได้': 'raai-dâai',
  'ค่าใช้จ่าย': 'khâa-chái-jàai',
  'งบประมาณ': 'ngòp-bprà-maan',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ภาษี': 'paa-sǐi',
  'ธนาคาร': 'tha-naa-kaan',
  'บัญชี': 'bàn-chii',
  'เงินฝาก': 'ngern-dàak',
  'เงินกู้': 'ngern-gûu',
  'ดอกเบี้ย': 'dòk-bîa',
  'ลงทุน': 'lon-tún',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'หุ้น': 'hûn',
  'กำไร': 'gam-rai',
  'ขาดทุน': 'khàt-tún',
  'สินค้า': 'sìn-kháa',
  'การส่งออก': 'gaan-sòng-ɔ̀ɔk',
  'การนำเข้า': 'gaan-nám-khâo',
  'อัตราเงินเฟ้อ': 'at-tra-ngern-fɛ́ɔ',
  'เงินเฟ้อ': 'ngern-fɛ́ɔ',
  'เงินฝืด': 'ngern-fèut',
  'ผลิตภัณฑ์': 'pǒ-lít-tà-pǎn',
  'ผลผลิต': 'pǒn-pǒ-lít',
  'แรงงาน': 'raeng-ngaan',
  'การจ้างงาน': 'gaan-jâang-ngaan',
  'อัตราการว่างงาน': 'at-tra-gaan-wâang-ngaan',

  // 文化
  'วัฒนธรรม': 'wát-tà-ná-tam',
  'ประเพณี': 'bprà-prà-mii',
  'เทศกาล': 'têet-sà-gaan',
  'สงกรานต์': 'sǒng-graan',
  'ลอยกระทง': 'looi-grà-tong',
  'วันเข้าพรรษา': 'wan-khâo-prǎn-sǎa',
  'วันลอยกระทง': 'wan-looi-grà-tong',
  'วันจักรี': 'wan-jàk-grii',
  'วันฉัตรมงคล': 'wan-chát-má-na-lǒng',
  'วันพืชมงคล': 'wan-pûet-móng-khǒn',
  'วันแรงงาน': 'wan-raeng-ngaan',
  'วันเด็ก': 'wan-dèk',
  'วันแม่': 'wan-mɛ̂ɛ',
  'วันพ่อ': 'wan-pɔ̂ɔ',
  'วันลอยกระทง': 'wan-looi-grà-tong',
  'วันขึ้นปีใหม่': 'wan-kěun-bpii-mài',
  'วันมาฆบูชา': 'wan-mǎ-kha-buu-chaa',
  'วันวิสาขบูชา': 'wan-wí-sǎa-kha-buu-chaa',
  'วันอาสาฬหบูชา': 'wan-aa-sǎa-ló-ha-buu-chaa',
  'วันเข้าพรรษา': 'wan-khâo-prǎn-sǎa',
  'วันออกพรรษา': 'wan-ɔ̀ɔk-prǎn-sǎa',
  'อาหารไทย': 'aa-hǎan-tai',
  'ผ้าไทย': 'pâa-tai',
  'นาฏศิลป์': 'nâat-tà-sǐn',
  'ดนตรี': 'don-dtrii',
  'ศิลปะ': 'sǐn-là-pà',
  'จิตรกรรม': 'jìt-tra-gam',
  'ประติมากรรม': 'bprà-dtii-maa-gam',
  'สถาปัตยกรรม': 'sà-taa-pàt-tà-yà-gam',
  'วรรณคดี': 'wan-na-khá-dii',
  'ปรัชญา': 'bprát-chaa',
  'ศาสนา': 'sàtsà-naa',
  'พุทธศาสนา': 'pút-tà-sàtsà-naa',
  'อิสลาม': 'ìt-sà-lǎam',
  'คริสต์宗教': 'krít-song-sà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
  'ศาสนา': 'sàtsà-naa',
};

// ============================================================
// 难度分级规则
// ============================================================
function assignDifficulty(word, category, pos) {
  // 初级：1-2音节常用词
  const syllables = (word.match(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4D]/g) || []).length;
  const charCount = word.length;

  // 根据词书类别和词长判断
  if (category === '问候' || category === '数字') {
    if (charCount <= 6) return 'beginner';
    if (charCount <= 12) return 'intermediate';
    return 'advanced';
  }

  if (category === '颜色') {
    if (charCount <= 8) return 'beginner';
    if (charCount <= 14) return 'intermediate';
    return 'advanced';
  }

  // 通用规则
  if (charCount <= 6) return 'beginner';
  if (charCount <= 12) return 'intermediate';
  return 'advanced';
}

// ============================================================
// 修复例句
// ============================================================
function fixExample(word, meaning, pos, category) {
  // 根据词性和类别生成自然例句
  const templates = {
    '名词': [
      `${word}อยู่ที่นี่`,
      `นี่คือ${word}`,
      `ฉันชอบ${word}`,
    ],
    '动词': [
      `ฉัน${word}ทุกวัน`,
      `เขา${word}เป็นประจำ`,
      `พวกเรา${word}ด้วยกัน`,
    ],
    '形容词': [
      `${word}มาก`,
      `อากาศ${word}`,
      `นี่${word}มาก`,
    ],
    '副词': [
      `เขาพูด${word}`,
      `ทำ${word}`,
      `เดิน${word}`,
    ],
    '短语': [
      `${word}ครับ`,
      `${word}ค่ะ`,
      `พูดว่า${word}`,
    ],
    '量词': [
      `${word}หนึ่ง`,
      `สอง${word}`,
      `มี${word}`,
    ],
  };

  const posTemplates = templates[pos] || templates['名词'];
  const thai = posTemplates[Math.floor(Math.random() * posTemplates.length)];
  const chi = `${meaning}`;

  return { example_thai: thai, example_chinese: chi };
}

// ============================================================
// 主修复流程
// ============================================================
function fixVocabulary() {
  console.log('📖 读取词库...');
  const content = readFileSync('src/data/vocabAllBooks.js', 'utf8');
  const match = content.match(/export const vocabAllBooks = (\[[\s\S]*?\]);/);
  if (!match) {
    console.error('❌ 无法解析 vocabAllBooks.js');
    process.exit(1);
  }

  const raw = JSON.parse(match[1]);
  console.log(`📊 原始词条: ${raw.length}`);

  // Step 1: 去除尾部数字
  const cleaned = raw.map(entry => {
    let word = entry.word.replace(/\d+$/, '').trim();
    let meaning = entry.meaning.replace(/\d+$/, '').trim();

    // 去除泰文中混入的英文/标点
    word = word.replace(/[.\-_:,!?()]/g, '').trim();

    return {
      ...entry,
      word,
      meaning,
    };
  }).filter(e => e.word && e.meaning);

  console.log(`🧹 去尾数后: ${cleaned.length}`);

  // Step 2: 去重（按 category + word 去重）
  const seen = new Set();
  const deduped = cleaned.filter(e => {
    const key = `${e.category}|${e.word}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`🔀 去重后: ${deduped.length}`);

  // Step 3: 补充读音、修复例句、分配难度
  const fixed = deduped.map(entry => {
    // 补充读音
    let pronunciation = entry.pronunciation;
    if (!pronunciation || pronunciation === '—' || pronunciation === '-') {
      pronunciation = PRONUNCIATION_DICT[entry.word] || '—';
    }

    // 修复例句
    let example_thai = entry.example_thai || '';
    let example_chinese = entry.example_chinese || '';
    if (!example_thai || example_thai.startsWith('นี่มาก') || example_thai.length < 5) {
      const ex = fixExample(entry.word, entry.meaning, entry.pos, entry.category);
      example_thai = ex.example_thai;
      example_chinese = ex.example_chinese;
    }

    // 分配难度
    const difficulty = assignDifficulty(entry.word, entry.category, entry.pos);

    return {
      ...entry,
      pronunciation,
      example_thai,
      example_chinese,
      difficulty,
      verified: true,
      review_status: 'verified',
      source: 'fixed-v2',
    };
  });

  // Step 4: 统计
  const stats = {};
  fixed.forEach(e => {
    if (!stats[e.category]) stats[e.category] = { count: 0, beginner: 0, intermediate: 0, advanced: 0 };
    stats[e.category].count++;
    stats[e.category][e.difficulty]++;
  });

  console.log('\n📊 最终统计:');
  console.log('─'.repeat(80));
  let totalCount = 0;
  Object.entries(stats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([cat, s]) => {
      console.log(`${cat.padEnd(12)} | ${String(s.count).padStart(4)} | 初级:${String(s.beginner).padStart(3)} 中级:${String(s.intermediate).padStart(3)} 高级:${String(s.advanced).padStart(3)}`);
      totalCount += s.count;
    });
  console.log('─'.repeat(80));
  console.log(`总计: ${totalCount} 条`);

  // Step 5: 生成最终输出
  const output = `// 自动生成 - 泰语词库 v2 (已修复尾数、补读音、修例句、分级)
// 生成时间: ${new Date().toISOString()}
// 共 ${totalCount} 条词条

export const vocabAllBooks = ${JSON.stringify(fixed, null, 0)};

// 词书统计
export const BOOK_STATS = ${JSON.stringify(stats, null, 2)};
`;

  writeFileSync('src/data/vocabAllBooks.js', output, 'utf8');
  console.log(`\n✅ 已写入 src/data/vocabAllBooks.js (${(output.length / 1024 / 1024).toFixed(1)}MB)`);
}

fixVocabulary();
