import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sparkles,
  Flame,
  BookOpen,
  Target,
  CalendarDays,
  ChevronRight,
  Zap,
  Volume2,
  Feather,
  Bell,
  Check,
  X,
  Play,
  Video,
  Clock3,
  Crown,
  AlarmClock,
  Mic,
  BarChart3,
  MessageCircle,
  Languages,
} from "lucide-react";

import { BangkokSkyline } from "@/components/common/ThaiDecor";

import { useNavigate } from "react-router-dom";

import AITeacher from "@/components/AITeacher";
import VipPanel from "@/components/common/VipPanel";
import {
  ThaiCorner,
  ThaiSectionDivider,
} from "@/components/common/ThaiDecor";
import {
  AIOrb,
  AnimatedNumber,
  StaggerGroup,
  StaggerItem,
} from "@/components/ui/premium";
import VocabularyCard from "@/components/VocabularyCard";
import ProgressDashboard from "@/components/ProgressDashboard";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { courses } from "@/data/courses";
import { getLessonsByCourseId } from "@/data/lessons";
import { getCourseStats, getCourseProgress } from "@/lib/courseProgress";
import { useAuth } from "@/lib/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import { speakThai } from "@/lib/thaiSpeech";
import { useFeatureFlag } from "@/lib/features";
import { adminGenerateCodes } from "@/api/auth";


const TOTAL_WORDS = 500;

const QUICK_PLANS = [
  { label: "月度", days: 30, price: 49 },
  { label: "季度", days: 90, price: 128 },
  { label: "年度", days: 365, price: 399 },
];



/* =========================================================
   今日一句泰语 · 泰语诗歌（原创诗句，无侵权风险）
========================================================= */

const DAILY_SENTENCES = [
  {
    thai: "สายน้ำไหลผ่านกาลเวลา\nใจเรายังอยู่ที่เดิม",
    chinese: "河水淌过悠悠时光，\n心仍停在最初的地方。",
    pronunciation: "sǎai-náam lǎi phàan kaa-laa-wee-laa · jai rao yang yùu thîi doem",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "ใบไม้ร่วงหล่นตามลม\nฤดูกาลหมุนเวียนสอนใจ",
    chinese: "落叶随风飘零，\n季节更替，教会人心。",
    pronunciation: "bai-máai rûuan lòn taam lom · rú-duu-gaan mùn-wian sɔ̌ɔn jai",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "แสงจันทร์ส่องยามค่ำคืน\nให้ใจที่เหนื่อยล้าได้พัก",
    chinese: "月光洒落夜晚，\n让疲惫的心得以安歇。",
    pronunciation: "sǎeng jan sɔ̀ɔng yaam khâm-khuen · hâi jai thîi nʉ̀ai-láa dâai phák",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "ทุกย่างก้าวคือบทเรียน\nทุกเช้าคือความหวังใหม่",
    chinese: "每一步都是功课，\n每一个清晨都是新的希望。",
    pronunciation: "thúk yâang kâao khʉʉ bòt-rian · thúk cháao khʉʉ khwaam-wǎng mài",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "ดั่งดอกไม้ในสวนใจ\nบานเสมอไม่รู้โรย",
    chinese: "如心园中的花朵，\n常开不败，永不凋零。",
    pronunciation: "dàng dɔ̀ɔk-máai nai sǔan jai · baan sà-məə mâi rúu rooy",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "ยิ้มวันนี้แม้ฝนพรำ\nโลกทั้งใบก็สดใส",
    chinese: "纵使细雨绵绵，\n今日一笑，全世界都明亮。",
    pronunciation: "yím wan níi máe fǒn phram · lôok tháng bai gɔ̂ sòt-sǎi",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "เวลาคือครูที่ใจเย็น\nสอนให้เรารู้จักรอ",
    chinese: "时间是位耐心的老师，\n教会我们如何等待。",
    pronunciation: "wee-laa khʉʉ khruu thîi jai yen · sɔ̌ɔn hâi rao rúu-jàk rɔɔ",
    category: "诗 · กวีนิพนธ์",
  },
  {
    thai: "ฝันของเรายังอยู่ไกล\nแต่ก้าวแรกเริ่มจากวันนี้",
    chinese: "梦想虽在远方，\n但第一步始于今天。",
    pronunciation: "fǎn khɔ̌ɔng rao yang yùu klai · tàe kâao rɛ̂ɛk rə̂əm jàak wan níi",
    category: "诗 · กวีนิพนธ์",
  },
];

/* =========================================================
   泰语小知识
========================================================= */

const THAI_TIPS = [
  {
    type: "🗣️",
    category: "日常表达",
    title: "ครับ、ค่ะ、นะ、จ๊ะ",
    content:
      "泰语非常常用语气词。男性常用ครับ，女性常用ค่ะ；นะ可以让语气更加柔和，จ๊ะ则常见于亲切、轻松的表达。",
    thai: "วันนี้ไปกินข้าวกันนะ",
    chinese: "今天一起去吃饭吧。",
  },
  {
    type: "📚",
    category: "语法知识",
    title: "กำลัง 表示“正在”",
    content:
      "กำลัง + 动词可以表示动作正在进行，相当于中文的“正在……”。",
    thai: "ผมกำลังเรียนภาษาไทยครับ",
    chinese: "我正在学习泰语。",
  },
  {
    type: "📚",
    category: "语法知识",
    title: "แล้ว 表示“已经”",
    content:
      "แล้ว通常放在动词后面，用来表示动作已经发生或完成。",
    thai: "ผมกินข้าวแล้วครับ",
    chinese: "我已经吃饭了。",
  },
  {
    type: "📚",
    category: "语法知识",
    title: "จะ 表示将来",
    content:
      "จะ + 动词，可以表示将要发生的事情、计划或者打算。",
    thai: "พรุ่งนี้ผมจะไปมหาวิทยาลัย",
    chinese: "明天我要去大学。",
  },
  {
    type: "📚",
    category: "语法知识",
    title: "ยัง 表示“还、仍然”",
    content:
      "ยัง常用于表示某种状态还在持续，也经常和ไม่搭配使用。",
    thai: "ผมยังไม่กินข้าวครับ",
    chinese: "我还没吃饭。",
  },
  {
    type: "🔊",
    category: "发音知识",
    title: "泰语有五个声调",
    content:
      "泰语共有五个声调：中调、低调、降调、高调和升调。声调不同，词义也可能发生变化。",
    thai: "มา",
    chinese: "来。",
  },
  {
    type: "🔊",
    category: "发音知识",
    title: "注意长短元音",
    content:
      "泰语中的元音有长短之分。学习新词时不能只记辅音，还要注意元音的长度。",
    thai: "กิน",
    chinese: "吃。",
  },
  {
    type: "🇹🇭",
    category: "文化知识",
    title: "พี่ 和 น้อง",
    content:
      "泰语非常重视年龄关系。พี่通常称呼比自己年长的人，น้อง通常称呼比自己年幼的人。",
    thai: "พี่ครับ ขอถามหน่อยครับ",
    chinese: "哥哥/姐姐，我想问一下。",
  },
  {
    type: "🇹🇭",
    category: "文化知识",
    title: "泰国人的礼貌表达",
    content:
      "ครับ、ค่ะ不仅仅是语法成分，也是泰语交流中非常重要的礼貌表达。",
    thai: "ขอบคุณครับ",
    chinese: "谢谢。",
  },
  {
    type: "⚠️",
    category: "易错知识",
    title: "不要完全按照中文语序翻译",
    content:
      "很多泰语表达不能逐字对应中文。常见搭配最好整体记忆，而不是一个词一个词地翻译。",
    thai: "กินข้าว",
    chinese: "吃饭。",
  },
  {
    type: "⚠️",
    category: "易错知识",
    title: "ครับ 和 คะ / ค่ะ 不要混用",
    content:
      "ครับ通常由男性使用；女性常使用ค่ะ或คะ。初学阶段很容易混淆。",
    thai: "สวัสดีครับ",
    chinese: "你好。（男性说法）",
  },
  {
    type: "💬",
    category: "口语知识",
    title: "ไม่เป็นไร 不只是“没关系”",
    content:
      "ไม่เป็นไร根据语境可以表示“没关系”“没事”“不用客气”等多种意思。",
    thai: "ไม่เป็นไรครับ",
    chinese: "没关系 / 没事。",
  },
  {
    type: "💬",
    category: "口语知识",
    title: "โอเค 很常见",
    content:
      "โอเค来自英语 OK，在泰国日常口语中非常常见，可以直接理解为“好的”“OK”。",
    thai: "โอเคครับ",
    chinese: "好的 / OK。",
  },
  {
    type: "💧",
    category: "民俗谚语",
    theme: "时机",
    title: "น้ำขึ้นให้รีบตัก · 水涨快舀",
    content:
      "字面是「水涨了要赶紧舀」，意思是机会来了要马上抓住，不要等它溜走。类似中文「趁热打铁」「机不可失」。",
    thai: "น้ำขึ้นให้รีบตัก",
    chinese: "水涨快舀——抓住时机，趁热打铁。",
  },
  {
    type: "🛠️",
    category: "民俗谚语",
    theme: "耐心",
    title: "ช้าๆ ได้พร้าเล่มงาม · 慢工出细活",
    content:
      "字面是「慢慢地磨，才能得到漂亮的柴刀」。意思是做事不要急躁，耐心打磨才能做好。类似中文「慢工出细活」「欲速则不达」。",
    thai: "ช้าๆ ได้พร้าเล่มงาม",
    chinese: "慢工出细活——欲速则不达。",
  },
  {
    type: "🐟",
    category: "民俗谚语",
    theme: "言行",
    title: "ปลาหมอตายเพราะปาก · 祸从口出",
    content:
      "字面是「攀鲈鱼死于自己的嘴」。警示说话要谨慎，很多祸事都因多嘴而起。类似中文「祸从口出」「言多必失」。",
    thai: "ปลาหมอตายเพราะปาก",
    chinese: "鱼死于嘴——祸从口出。",
  },
  {
    type: "🐮",
    category: "民俗谚语",
    theme: "教育",
    title: "รักวัวให้ผูก รักลูกให้ตี · 严是爱",
    content:
      "字面是「爱牛就要拴住它，爱孩子就要管教他」。意思是真正的爱要包含约束与教导。类似中文「严是爱，松是害」。",
    thai: "รักวัวให้ผูก รักลูกให้ตี",
    chinese: "爱牛需拴，爱子须教——严是爱，松是害。",
  },
  {
    type: "🌟",
    category: "民俗谚语",
    theme: "励志",
    title: "ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น · 天道酬勤",
    content:
      "泰国家喻户晓的励志谚语：「努力在哪里，成功就在哪里」。鼓励人们坚持不懈，与中文「天道酬勤」「功到自然成」异曲同工。",
    thai: "ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น",
    chinese: "努力在哪里，成功就在哪里——天道酬勤。",
  },
  {
    type: "🔥",
    category: "民俗谚语",
    theme: "时机",
    title: "ตีเหล็กเมื่อแดง · 趁热打铁",
    content:
      "字面是「铁要趁烧红的时候打」。意思是做事要抓住最佳时机，与中文「趁热打铁」完全对应。",
    thai: "ตีเหล็กเมื่อแดง",
    chinese: "趁热打铁——把握时机。",
  },
  {
    type: "🍋",
    category: "民俗谚语",
    theme: "耐心",
    title: "อดเปรี้ยวไว้กินหวาน · 先苦后甜",
    content:
      "字面是「忍住酸味，留着吃甜的」。劝人先吃苦后享福，忍耐必有回报。类似中文「先苦后甜」「吃得苦中苦，方为人上人」。",
    thai: "อดเปรี้ยวไว้กินหวาน",
    chinese: "先苦后甜——忍耐终有回报。",
  },
  {
    type: "👂",
    category: "民俗谚语",
    theme: "言行",
    title: "ฟังหูไว้หู · 耳听为虚",
    content:
      "字面是「听进一只耳朵，留一只耳朵作防备」。劝人不要轻信传言。类似中文「耳听为虚，眼见为实」。",
    thai: "ฟังหูไว้หู",
    chinese: "耳听为虚——传言不可轻信。",
  },
  {
    type: "🐘",
    category: "民俗谚语",
    theme: "言行",
    title: "เห็นช้างขี้ ขี้ตามช้าง · 盲目跟风",
    content:
      "字面是「看见大象拉屎，也跟着拉」。讽刺盲目从众、人云亦云。类似中文「随大流」「人云亦云」。",
    thai: "เห็นช้างขี้ ขี้ตามช้าง",
    chinese: "盲目跟风——人云亦云。",
  },
  {
    type: "🐘",
    category: "民俗谚语",
    theme: "言行",
    title: "ขี่ช้างจับตั๊กแตน · 杀鸡用牛刀",
    content:
      "字面是「骑着大象去捉蚱蜢」。比喻用大力气做小事，大材小用。类似中文「杀鸡焉用牛刀」。",
    thai: "ขี่ช้างจับตั๊กแตน",
    chinese: "骑象捉蚱蜢——大材小用。",
  },
  {
    type: "🎋",
    category: "民俗谚语",
    theme: "教育",
    title: "ไม้อ่อนดัดง่าย ไม้แก่ดัดยาก · 嫩竹易弯",
    content:
      "字面是「嫩竹容易弯，老竹难以弯」。比喻教育要趁早。类似中文「三岁看大，七岁看老」。",
    thai: "ไม้อ่อนดัดง่าย ไม้แก่ดัดยาก",
    chinese: "嫩竹易弯，老竹难折——教育趁早。",
  },
  {
    type: "🌊",
    category: "民俗谚语",
    theme: "真相",
    title: "น้ำลดตอผุด · 水落石出",
    content:
      "字面是「水退了，树桩就露出来」。比喻真相总会水落石出，谎言掩盖不了一时。类似中文「真相大白」「水落石出」。",
    thai: "น้ำลดตอผุด",
    chinese: "水落石出——真相终会大白。",
  },
  {
    type: "🕯️",
    category: "民俗谚语",
    theme: "真相",
    title: "ความจริงไม่ตาย · 真相不死",
    content:
      "字面是「真相不会死去」。意为事实永远存在，谎言终将被揭穿。类似中文「纸包不住火」。",
    thai: "ความจริงไม่ตาย",
    chinese: "真相不灭——纸包不住火。",
  },
  {
    type: "🌾",
    category: "民俗谚语",
    theme: "谦虚",
    title: "น้ำเต็มแก้ว · 水满则溢",
    content:
      "字面是「杯子满了水就会溢出」。比喻自满会招致损失，做人要留有余地。类似中文「满招损，谦受益」。",
    thai: "น้ำเต็มแก้ว",
    chinese: "水满则溢——满招损，谦受益。",
  },
  {
    type: "🌾",
    category: "民俗谚语",
    theme: "谦虚",
    title: "รวงข้าวที่สุกจะโน้มลง · 稻熟低头",
    content:
      "字面是「成熟的稻穗会低垂下来」。比喻真正有本事的人往往谦虚。类似中文「越饱满的稻穗越低头」。",
    thai: "รวงข้าวที่สุกจะโน้มลง",
    chinese: "稻熟低头——越是成熟越谦虚。",
  },
  {
    type: "👥",
    category: "民俗谚语",
    theme: "交友",
    title: "คบคนพาล พาลพาไปหาผิด · 近墨者黑",
    content:
      "字面是「与恶人为友，会被带向错误」。提醒交友要谨慎。类似中文「近朱者赤，近墨者黑」。",
    thai: "คบคนพาล พาลพาไปหาผิด",
    chinese: "近墨者黑——交友须谨慎。",
  },
  {
    type: "🍽️",
    category: "民俗谚语",
    theme: "交友",
    title: "เพื่อนกินหาง่าย เพื่อนตายหายาก · 患难见真情",
    content:
      "字面是「一起吃饭的朋友容易找，共患难的朋友难寻」。类似中文「酒肉朋友易得，患难之交难求」。",
    thai: "เพื่อนกินหาง่าย เพื่อนตายหายาก",
    chinese: "患难见真情——酒肉朋友易得。",
  },
  {
    type: "🏞️",
    category: "民俗谚语",
    theme: "交友",
    title: "น้ำพึ่งเรือ เสือพึ่งป่า · 相互依存",
    content:
      "字面是「水靠船行，虎靠林生」。比喻人与人互相依存、彼此成全。类似中文「人人为我，我为人人」。",
    thai: "น้ำพึ่งเรือ เสือพึ่งป่า",
    chinese: "水靠舟行，虎依林生——彼此依存。",
  },
  {
    type: "💞",
    category: "民俗谚语",
    theme: "交友",
    title: "รักยาวให้บั่น รักสั้นให้ต่อ · 细水长流",
    content:
      "字面是「要长久就要收敛，要短暂就放纵」。提醒感情需要克制经营，细水方能长流。",
    thai: "รักยาวให้บั่น รักสั้นให้ต่อ",
    chinese: "情长久需克制——细水长流。",
  },
  {
    type: "🐊",
    category: "民俗谚语",
    theme: "处世",
    title: "หนีเสือปะจระเข้ · 祸不单行",
    content:
      "字面是「躲开老虎又撞上鳄鱼」。比喻灾祸接踵而至。类似中文「躲过初一躲不过十五」「祸不单行」。",
    thai: "หนีเสือปะจระเข้",
    chinese: "躲过虎又逢鳄——祸不单行。",
  },
  {
    type: "🚪",
    category: "民俗谚语",
    theme: "处世",
    title: "เข้าตามตรอก ออกตามประตู · 循规蹈矩",
    content:
      "字面是「进来走巷子，出去走大门」。比喻做事要按规矩、光明正大。类似中文「按部就班」「循规蹈矩」。",
    thai: "เข้าตามตรอก ออกตามประตู",
    chinese: "有进有出守规矩——光明正大。",
  },
];

/* =========================================================
   谚语主题筛选元数据（图标 + 专属主题色，Tailwind 类必须静态）
========================================================= */

const THEME_META = {
  "全部": {
    icon: "✨",
    active:
      "border-yellow-300/40 bg-yellow-300/15 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.15)]",
  },
  "时机": {
    icon: "⏳",
    active:
      "border-amber-300/40 bg-amber-300/15 text-amber-200 shadow-[0_0_12px_rgba(252,211,77,0.18)]",
  },
  "耐心": {
    icon: "🛠️",
    active:
      "border-orange-300/40 bg-orange-300/15 text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.18)]",
  },
  "言行": {
    icon: "🗣️",
    active:
      "border-rose-300/40 bg-rose-300/15 text-rose-200 shadow-[0_0_12px_rgba(251,113,133,0.18)]",
  },
  "教育": {
    icon: "🎓",
    active:
      "border-violet-300/40 bg-violet-300/15 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.18)]",
  },
  "励志": {
    icon: "🌟",
    active:
      "border-lime-300/40 bg-lime-300/15 text-lime-200 shadow-[0_0_12px_rgba(163,230,53,0.18)]",
  },
  "真相": {
    icon: "🌊",
    active:
      "border-sky-300/40 bg-sky-300/15 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.18)]",
  },
  "谦虚": {
    icon: "🌾",
    active:
      "border-[#CB8DFF]/30 bg-[#CB8DFF]/10 text-[#CB8DFF] shadow-[0_0_12px_rgba(203,141,255,0.15)]",
  },
  "交友": {
    icon: "🤝",
    active:
      "border-pink-300/40 bg-pink-300/15 text-pink-200 shadow-[0_0_12px_rgba(244,114,182,0.18)]",
  },
  "处世": {
    icon: "🐊",
    active:
      "border-teal-300/40 bg-teal-300/15 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.18)]",
  },
};

/* =========================================================
   Home
========================================================= */

function LegacyHome() {
  const { user, token } = useAuth();
  const isVipUser = !!user?.isVip;
  const isAdmin = Boolean(user?.isAdmin || user?.is_admin || user?.role === "admin");
  const navigate = useNavigate();
  const aiTeacher = useFeatureFlag("aiTeacher");

  const { progress, loading } = useLearningProgress();

  const [isSpeaking, setIsSpeaking] = useState(false);

  /* =====================================================
     继续学习（有学习进度的课程）
  ===================================================== */

  const continueCourses = useMemo(() => {
    const published = courses.filter(
      (course) => course.status !== "coming"
    );

    return published
      .map((course) => {
        const lessons = getLessonsByCourseId(course.id);
        return {
          course,
          lessons,
          stats: getCourseStats(course.id, lessons),
          entry: getCourseProgress(course.id),
        };
      })
      .filter((item) => item.stats.progressPercent > 0)
      .sort((a, b) =>
        (b.entry?.updatedAt || "").localeCompare(
          a.entry?.updatedAt || ""
        )
      )
      .slice(0, 3);
  }, []);

  /* =====================================================
     推荐课程
  ===================================================== */

  const recommendedCourses = useMemo(
    () =>
      courses
        .filter((course) => course.levelKey === "basic")
        .slice(0, 3),
    []
  );

  /* =====================================================
     从上次位置继续学习
  ===================================================== */

  const resumeCourse = (item) => {
    const last = item.lessons.find(
      (lesson) => lesson.id === item.entry?.lastLessonId
    );

    if (isVipUser || last.free || !item.course.isVip) {
      navigate(`/course/${item.course.id}/lesson/${last.id}`);
    } else {
      navigate(`/course/${item.course.id}`);
    }
  };

  /* =====================================================
     消息中心
  ===================================================== */

  const [showNotifications, setShowNotifications] = useState(false);
  const [showVipPanel, setShowVipPanel] = useState(false);
  const [quickCodeDays, setQuickCodeDays] = useState(null);
  const [quickCodeBusy, setQuickCodeBusy] = useState(false);
  const [quickCodeMessage, setQuickCodeMessage] = useState("");

  const quickGenerateCode = async (days) => {
    setQuickCodeBusy(true);
    setQuickCodeDays(days);
    setQuickCodeMessage("");
    try {
      const response = await adminGenerateCodes({ count: 1, days, prefix: "THAI-VIP" });
      const code = response.data?.codes?.[0];
      if (!code) throw new Error("生成失败");
      await navigator.clipboard?.writeText(code);
      setQuickCodeMessage(`已生成 ${days} 天激活码并复制：${code}`);
    } catch (error) {
      setQuickCodeMessage(error?.response?.data?.message || "生成失败，请稍后重试");
    } finally {
      setQuickCodeBusy(false);
      setQuickCodeDays(null);
    }
  };

  /* =====================================================
     消息中心（真实：后端 notifications API）
  ===================================================== */

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);

  const formatNotifTime = (createdAt) => {
    if (!createdAt) return "";

    const t = new Date(
      String(createdAt).replace(" ", "T") + "Z"
    );
    if (Number.isNaN(t.getTime())) return "";

    const diff = Date.now() - t.getTime();

    if (diff < 60 * 1000) return "刚刚";
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    }
    if (diff < 24 * 60 * 60 * 1000) return "今天";
    if (diff < 48 * 60 * 60 * 1000) return "昨天";
    return `${t.getMonth() + 1}月${t.getDate()}日`;
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      setNotifications(
        (data.list || []).map((n) => ({
          ...n,
          unread: !n.isRead,
          time: formatNotifTime(n.createdAt),
        }))
      );
    } catch {
      // 网络异常时静默，保留现有列表
    } finally {
      setNotifLoading(false);
    }
  };

  // 挂载 + 60s 轮询

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开面板时刷新一次

  useEffect(() => {
    if (showNotifications) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  const unreadCount = notifications.filter(
    (item) => item.unread
  ).length;

  const markAllRead = async () => {
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      }))
    );

    try {
      await fetch(
        `${API_BASE_URL}/notifications/read-all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      // 忽略
    }
  };

  const markRead = async (id) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              unread: false,
            }
          : item
      )
    );

    try {
      await fetch(
        `${API_BASE_URL}/notifications/${id}/read`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      // 忽略
    }
  };

  const handleNotificationClick = (item) => {
    if (
      item.action === "vip" ||
      item.action === "news-quota-exhausted" ||
      item.action === "speaking-quota-exhausted"
    ) {
      setShowNotifications(false);
      markRead(item.id);
      setShowVipPanel(true);
      return;
    }

    markRead(item.id);

    if (item.link) {
      setShowNotifications(false);
      navigate(item.link);
    }
  };

  /* VIP 到期提醒：到期前 3 天在首页横幅（消息中心由后端同步推送） */

  const vipDaysLeft = useMemo(() => {
    if (!user?.vipExpiresAt) return null;

    const text =
      String(user.vipExpiresAt).replace(" ", "T") + "Z";
    const expiry = new Date(text);
    if (Number.isNaN(expiry.getTime())) return null;

    return Math.ceil(
      (expiry.getTime() - Date.now()) / 86400000
    );
  }, [user?.vipExpiresAt]);

  const vipExpiryReminder =
    isVipUser &&
    vipDaysLeft !== null &&
    vipDaysLeft >= 1 &&
    vipDaysLeft <= 3;

  const vipExpiryDate = useMemo(() => {
    if (!user?.vipExpiresAt) return "";

    const text =
      String(user.vipExpiresAt).replace(" ", "T") + "Z";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [user?.vipExpiresAt]);

  const streak = progress?.learning_streak || 0;

  /* =====================================================
     日期与时段问候（参考图右上角挂件）
  ===================================================== */

  const now = new Date();
  const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK_LABELS[now.getDay()]}`;
  const hour = now.getHours();
  const timeGreeting =
    hour >= 5 && hour < 11
      ? "早上好"
      : hour >= 11 && hour < 18
      ? "下午好"
      : "晚上好";
  const timeGreetingEmoji =
    hour >= 5 && hour < 11 ? "🌅" : hour >= 11 && hour < 18 ? "☀️" : "🌙";

  const totalVocabulary = Math.min(
    progress?.total_vocabulary || 0,
    TOTAL_WORDS
  );

  const accuracy = progress?.accuracy_rate || 0;

  const weeklyWords = useMemo(() => {
    const history = progress?.daily_history || [];

    return history
      .slice(-7)
      .reduce((sum, item) => {
        return sum + (Number(item.words) || 0);
      }, 0);
  }, [progress]);

  const vocabularyPercent = Math.min(
    Math.round((totalVocabulary / TOTAL_WORDS) * 100),
    100
  );

  /* =====================================================
     今日一句
  ===================================================== */

  const todaySentence = useMemo(() => {
    const today = new Date();

    const dateKey =
      today.getFullYear() +
      today.getMonth() +
      today.getDate();

    return DAILY_SENTENCES[
      Math.abs(dateKey) % DAILY_SENTENCES.length
    ];
  }, []);

  /* =====================================================
     播放今日一句
  ===================================================== */

  const speakCancelRef = useRef(null);

  const handleSpeakThai = () => {
    if (!todaySentence?.thai) return;

    if (isSpeaking) {
      speakCancelRef.current?.();
      setIsSpeaking(false);
      return;
    }

    speakCancelRef.current = speakThai(todaySentence.thai, {
      rate: 0.78,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  return (
    <div
      className="home-theme-root relative min-h-screen w-full text-white"
      style={{ background: '#0c1719' }}
    >
      <div className="home-theme-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.32, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="home-theme-image absolute inset-[-3%] bg-cover bg-center"
          style={{ backgroundImage: 'url(/site-bg-night.jpg)' }}
        />
        <div className="home-theme-vignette absolute inset-0" />
        <div className="home-theme-particles absolute inset-0" />
      </div>

      {/* =====================================================
          右上角消息按钮
      ===================================================== */}

      <div className="fixed right-6 top-5 z-[100]">

        <motion.button
          type="button"
          onClick={() =>
            setShowNotifications((value) => !value)
          }
          whileHover={{
            scale: 1.05,
          }}
          whileTap={{
            scale: 0.95,
          }}
          className="
            relative
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            border
            border-white/15
            bg-black/45
            shadow-xl
            shadow-black/20
            backdrop-blur-2xl
            transition-all
            hover:border-[#CB8DFF]/30
            hover:bg-white/[0.08]
          "
          aria-label="消息中心"
        >

          <Bell
            className={`h-5 w-5 transition-colors ${
              unreadCount > 0
                ? "text-yellow-300"
                : "text-white/70"
            }`}
          />

          {unreadCount > 0 && (
            <>
              <span
                className="
                  absolute
                  right-2
                  top-2
                  h-2.5
                  w-2.5
                  rounded-full
                  bg-red-400
                  shadow-[0_0_10px_rgba(248,113,113,0.8)]
                "
              />

              <span
                className="
                  absolute
                  right-[7px]
                  top-[7px]
                  h-3.5
                  w-3.5
                  animate-ping
                  rounded-full
                  bg-red-400/40
                "
              />
            </>
          )}
        </motion.button>

        {/* =================================================
            消息面板
        ================================================= */}

        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
              transition={{
                duration: 0.18,
              }}
              className="
                absolute
                right-0
                top-14
                w-[340px]
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-black/70
                shadow-2xl
                shadow-black/40
                backdrop-blur-2xl
              "
            >

              {/* 面板顶部 */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-white/[0.08]
                  px-5
                  py-4
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-xl
                      bg-[#CB8DFF]/10
                    "
                  >
                    <Bell className="h-4 w-4 text-[#CB8DFF]" />
                  </div>

                  <div>
                    <div className="font-semibold text-white">
                      消息中心
                    </div>

                    <div className="mt-0.5 text-[11px] text-white/35">
                      {unreadCount > 0
                        ? `${unreadCount} 条未读消息`
                        : "暂无未读消息"}
                    </div>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                  className="
                    rounded-lg
                    p-1.5
                    text-white/30
                    transition
                    hover:bg-white/[0.06]
                    hover:text-white/70
                  "
                >
                  <X className="h-4 w-4" />
                </button>

              </div>

              {/* 消息列表 */}

              <div className="max-h-[360px] overflow-y-auto">

                {notifLoading ? (
                  <div className="px-5 py-10 text-center">

                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#CB8DFF]" />

                    <div className="mt-3 text-sm text-white/60">
                      加载中…
                    </div>

                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">

                    <div className="text-3xl">
                      ✨
                    </div>

                    <div className="mt-3 text-sm text-white/60">
                      暂时没有消息
                    </div>

                  </div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={`
                        group
                        flex
                        w-full
                        gap-3
                        border-b
                        border-white/[0.05]
                        px-5
                        py-4
                        text-left
                        transition
                        hover:bg-white/[0.04]
                        ${
                          item.unread
                            ? "bg-[#CB8DFF]/[0.025]"
                            : ""
                        }
                      `}
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-white/[0.06]
                          bg-white/[0.035]
                          text-lg
                        "
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center justify-between gap-2">

                          <span className="truncate text-sm font-medium text-white/85">
                            {item.title}
                          </span>

                          {item.unread && (
                            <span
                              className="
                                h-2
                                w-2
                                shrink-0
                                rounded-full
                                bg-[#CB8DFF]
                              "
                            />
                          )}

                        </div>

                        <div className="mt-1 text-xs leading-5 text-white/40">
                          {item.content}
                        </div>

                        <div className="mt-2 text-[10px] text-white/25">
                          {item.type} · {item.time}
                        </div>

                      </div>

                    </button>
                  ))
                )}

              </div>

              {/* 面板底部 */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-t
                  border-white/[0.07]
                  px-5
                  py-3
                "
              >

                <button
                  type="button"
                  onClick={markAllRead}
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-xs
                    text-[#CB8DFF]/70
                    transition
                    hover:text-[#CB8DFF]
                  "
                >
                  <Check className="h-3.5 w-3.5" />
                  全部已读
                </button>

                <span className="text-[10px] text-white/20">
                  学习助手
                </span>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* =====================================================
          主体
      ===================================================== */}

      <div className="relative z-10 mx-auto max-w-[1500px] px-0 py-4 sm:px-0 sm:py-5 lg:px-0">
        {isAdmin && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-yellow-300/15 bg-black/60 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl"
          >
            <div className="mr-auto flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-300" />
              <div>
                <div className="text-xs font-semibold text-white/85">管理员快捷发码</div>
                <div className="text-[10px] text-white/35">人工收款后无需进入管理页，点击套餐即可生成并复制</div>
              </div>
            </div>
            {QUICK_PLANS.map((plan) => (
              <button
                key={plan.days}
                type="button"
                disabled={quickCodeBusy}
                onClick={() => quickGenerateCode(plan.days)}
                className="rounded-xl border border-yellow-300/20 bg-yellow-300/[0.08] px-3 py-2 text-[11px] font-semibold text-yellow-100 transition hover:-translate-y-0.5 hover:bg-yellow-300/[0.15] disabled:opacity-40"
              >
                {quickCodeBusy && quickCodeDays === plan.days ? "生成中…" : `${plan.label} ¥${plan.price}`}
              </button>
            ))}
            {quickCodeMessage && <span className="basis-full text-[11px] text-white/60">{quickCodeMessage}</span>}
          </motion.section>          )}

        {/* =====================================================
            欢迎 Hero

        ===================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: -20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
          }}
          className="
            group
            relative
            mb-5
            min-h-[340px]
            sm:min-h-[300px]
            overflow-hidden
            rounded-[30px]
            border
            border-white/[0.08]
            shadow-[0_20px_80px_rgba(0,0,0,0.3)]
            transition-all
            duration-500
            hover:border-white/[0.14]
          "
        >

          <img
            src="/thailand-hero-night.jpg"
            alt="ThaiAI 学习主题视觉"
            className={`
              absolute
              inset-0
              h-full
              w-full
              object-cover
              object-[72%_center]
              transition-all
              duration-[1500ms]
              ease-out
              group-hover:scale-[1.02]
              group-hover:brightness-110
            `}
          />

          {/* 泰式金线动态绘制（页面进入，L2 Cultural Motion） */}           <div className="gold-draw pointer-events-none absolute inset-x-12 top-5 z-30 h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent" />
           <div className="gold-draw pointer-events-none absolute inset-x-20 bottom-5 z-30 h-px bg-gradient-to-r from-transparent via-yellow-300/20 to-transparent" style={{ animationDelay: '0.4s' }} />

          {/* 泰式金线角饰（Hero 四角，极淡） */}

          <ThaiCorner
            className="z-30"
            size={30}
            color="rgba(245, 214, 123, 0.45)"
          />

          {/* 日期 + 时段问候挂件（参考图右上角） */}

          <div className="pointer-events-none absolute right-5 top-5 z-30 hidden items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 backdrop-blur-md sm:flex">
            <span className="text-sm font-semibold text-white/85">
              {dateText}
            </span>
            <span className="h-4 w-px bg-white/15" />
            <span className="flex items-center gap-1.5 text-xs text-yellow-200/80">
              <span>{timeGreetingEmoji}</span>
              {timeGreeting}，继续加油!
            </span>
          </div>

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-[#020c0e]/80
              via-[#041112]/50
              to-transparent
            "
          />

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-t
              from-[#030f10]/60
              via-transparent
              to-[#020c0e]/25
            "
          />

          {/* 深绿氛围光（佛像/寺庙区域） */}
          <div
            className="
              pointer-events-none
              absolute
              right-[15%]
              top-[20%]
              h-96
              w-96
              rounded-full
              bg-emerald-900/20
              blur-[100px]
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -left-20
              -top-20
              h-72
              w-72
              rounded-full
              bg-[#CB8DFF]/10
              blur-[80px]
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -right-16
              bottom-[-60px]
              h-64
              w-64
              rounded-full
              bg-yellow-300/[0.06]
              blur-[60px]
            "
          />

          <div
            className="
              relative
              z-10
              flex
              min-h-[320px]
              flex-col
              justify-between
              gap-6
              p-6
              sm:min-h-[280px]
              sm:p-7
              sm:p-8
              lg:flex-row
              lg:items-center
              lg:px-12
              lg:py-10
            "
          >

            {/* 左侧 */}

            <div className="max-w-2xl">

              <div
                className="
                  mb-4
                  flex
                  items-center
                  gap-2
                  text-xs
                  font-medium
                  tracking-[0.18em]
                  text-[#CB8DFF]
                "
              >

                <div
                  className="
                    flex
                    h-7
                    w-7
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-[#CB8DFF]/20
                    bg-[#CB8DFF]/10
                    backdrop-blur-md
                  "
                >
                  🇹🇭
                </div>

                <span>
                  THAI AI LEARNING SPACE
                </span>

              </div>

              <h1
                className="
                  font-thai-serif
                  text-4xl
                  font-black
                  leading-[1.05]
                  tracking-tight
                  text-white
                  sm:text-5xl
                  lg:text-[3.5rem]
                "
              >
                สวัสดีครับ，

                <span
                  className="
                    ml-2
                    bg-gradient-to-r
                    from-yellow-200
                    via-yellow-300
                    to-amber-400
                    bg-clip-text
                    text-transparent
                  "
                >
                  {user?.nickname || "朋友"}
                </span>
              </h1>

              <p
                className="
                  mt-4
                  max-w-xl
                  text-[15px]
                  leading-7
                  text-white/50
                  sm:text-base
                "
              >
                今天是你坚持学习泰语的{" "}
                <span className="font-bold text-yellow-300/90">
                  {loading ? "—" : streak}
                </span>{" "}
                天，继续保持这个节奏
              </p>

              <div
                className="
                  mt-6
                  inline-flex
                  items-center
                  gap-3
                  rounded-full
                  border
                  border-white/[0.08]
                  bg-white/[0.04]
                  px-5
                  py-2.5
                  backdrop-blur-md
                  transition-all
                  hover:bg-white/[0.07]
                  hover:border-white/[0.14]
                "
              >

                <Sparkles className="h-4 w-4 text-yellow-300/80" />

                <span className="text-sm tracking-wide text-white/60">
                  เรียนภาษาไทยทุกวันนะครับ
                </span>

              </div>

            </div>

            {/* =================================================
                AI 核心球体（泰国文化 × AI 主视觉）
            ================================================= */}

            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden shrink-0 lg:block"
            >
              <AIOrb size={220} />
            </motion.div>

            {/* =================================================
                透明学习状态
            ================================================= */}

            <motion.div
              whileHover={{
                y: -3,
                scale: 1.015,
              }}
              transition={{
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="
                group
                relative
                w-full
                shrink-0
                overflow-hidden
                rounded-[24px]
                sm:w-[calc(50%-0.75rem)]
                lg:w-[245px]
                border
                border-white/[0.08]
                bg-white/[0.03]
                p-5
                shadow-[0_8px_40px_rgba(0,0,0,0.08)]
                backdrop-blur-[18px]
                transition-all
                duration-300
                hover:border-white/[0.16]
                hover:bg-white/[0.05]
                hover:shadow-[0_12px_50px_rgba(0,0,0,0.12)]
                lg:w-[245px]
              "
            >

              <div
                className="
                  pointer-events-none
                  absolute
                  -right-10
                  -top-10
                  h-24
                  w-24
                  rounded-full
                  bg-yellow-300/[0.08]
                  blur-2xl
                "
              />

              <div className="relative flex items-center gap-4">

                <div
                  className="
                    flex
                    h-12
                    w-12
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-yellow-300/[0.14]
                    bg-yellow-300/[0.045]
                  "
                >
                  <Flame className="h-6 w-6 text-yellow-300" />
                </div>

                <div>

                  <div className="text-xs text-white/35">
                    学习状态
                  </div>

                  <div className="mt-1 text-lg font-bold text-white">
                    连续学习 {streak} 天
                  </div>

                </div>

              </div>

              <div
                className="
                  relative
                  mt-5
                  flex
                  items-center
                  justify-between
                  border-t
                  border-white/[0.07]
                  pt-4
                "
              >

                <span className="text-xs text-white/35">
                  {streak > 0
                    ? "保持这个节奏"
                    : "今天开始你的学习之旅"}
                </span>

                <div
                  className="
                    h-2
                    w-2
                    rounded-full
                    bg-[#CB8DFF]
                    shadow-[0_0_12px_rgba(52,211,153,0.8)]
                  "
                />

              </div>

            </motion.div>

          </div>

        </motion.div>

        {/* =====================================================
            移动端快捷入口
        ===================================================== */}

        <MobileQuickActions aiTeacher={aiTeacher} />

        {/* =====================================================
            VIP 到期提醒横幅
        ===================================================== */}

        {vipExpiryReminder && (
          <motion.button
            type="button"
            onClick={() => setShowVipPanel(true)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            whileHover={{ y: -2 }}
            className="
              mb-6
              flex
              w-full
              flex-wrap
              items-center
              gap-3
              sm:flex-nowrap
              sm:gap-4
              rounded-[22px]
              border
              border-yellow-300/25
              bg-gradient-to-r
              from-yellow-300/[0.12]
              via-amber-400/[0.08]
              to-yellow-300/[0.04]
              px-5
              py-4
              text-left
              shadow-[0_8px_30px_rgba(250,204,21,0.08)]
              transition-all
              hover:border-yellow-300/40
              hover:from-yellow-300/[0.16]
              hover:to-amber-400/[0.07]
            "
          >

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-2xl
                border
                border-yellow-300/25
                bg-yellow-300/[0.10]
              "
            >
              <AlarmClock className="h-5 w-5 text-yellow-300" />
            </div>

            <div className="min-w-0 flex-1">

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">

                <span className="text-sm font-bold text-yellow-200">
                  VIP 即将到期
                </span>

                <span
                  className="
                    rounded-full
                    border
                    border-yellow-300/25
                    bg-yellow-300/10
                    px-2
                    py-0.5
                    text-[10px]
                    font-semibold
                    text-yellow-200
                  "
                >
                  还剩 {vipDaysLeft} 天
                </span>

              </div>

              <p className="mt-0.5 truncate text-xs text-yellow-200/60">
                {vipExpiryDate
                  ? `您的 VIP 会员将于 ${vipExpiryDate} 到期，续费后可继续享受全部进阶内容`
                  : "您的 VIP 会员即将到期，续费后可继续享受全部进阶内容"}
              </p>

            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-3 py-2 text-xs font-bold text-[#172018] transition-transform hover:scale-[1.03] sm:px-4">
              <Crown className="h-3.5 w-3.5" />
              立即续费
            </div>

          </motion.button>
        )}

        {/* =====================================================
            学习数据 + AI 老师（中排，参考图布局）
        ===================================================== */}

        <div className="mb-6 grid items-stretch gap-5 lg:grid-cols-2">

          {/* 学习数据卡（2x2 指标） */}

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            whileHover={{ y: -2 }}
            className="group relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-[0_8px_40px_rgba(0,0,0,0.15)] sm:p-6"
          >

            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-teal-400/[0.05] blur-3xl transition-all duration-500 group-hover:bg-teal-400/[0.08]" />              <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                <BarChart3 className="h-4 w-4 text-[#CB8DFF]/80" />
                学习数据
              </div>

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex items-center gap-1 text-[11px] text-white/30 transition-colors duration-200 hover:text-[#CB8DFF]"
              >
                查看详细数据
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>

            <StaggerGroup className="mt-5 grid grid-cols-2 gap-3">

          <StaggerItem>
            <StatCard
              icon={Flame}
              title="连续学习"
              value={loading ? "—" : streak}
              unit="天"
              iconClass="text-yellow-300"
              description={
                streak > 0
                  ? "坚持得不错"
                  : "今天开始学习"
              }
            />
          </StaggerItem>

          <StaggerItem>
            <VocabularyStatCard
              value={loading ? 0 : totalVocabulary}
              total={TOTAL_WORDS}
              percent={vocabularyPercent}
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              icon={Target}
              title="平均正确率"
              value={loading ? "—" : accuracy}
              unit="%"
              iconClass="text-teal-300"
              description={
                accuracy >= 90
                  ? "表现非常好"
                  : accuracy >= 70
                  ? "继续保持"
                  : "多练几次就好"
              }
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              icon={CalendarDays}
              title="本周学习"
              value={loading ? "—" : weeklyWords}
              unit="词"
              iconClass="text-[#CB8DFF]"
              description="最近 7 天"
            />
          </StaggerItem>

            </StaggerGroup>

          </motion.div>

          {/* AI 老师（功能开关控制） */}

          {aiTeacher && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="relative overflow-hidden rounded-[28px] border border-[#CB8DFF]/10 bg-gradient-to-br from-[#CB8DFF]/[0.12] via-white/[0.04] to-[#CB8DFF]/[0.06] p-1 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl"
            >

              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-yellow-300/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#CB8DFF]/10 blur-3xl" />

              <div className="relative h-full rounded-[24px] bg-black/60 p-2 sm:p-3">
                <AITeacher />
              </div>

            </motion.div>
          )}

        </div>

        {/* =====================================================
            继续学习
        ===================================================== */}

        {continueCourses.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-6"
          >

            <div className="mb-4 flex items-end justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#CB8DFF] shadow-[0_0_10px_rgba(203,141,255,.7)]" />
                  <h2 className="text-lg font-bold text-white">
                    继续学习
                  </h2>
                </div>
                <p className="mt-1 text-xs text-white/30">
                  从上次停下的地方继续
                </p>
              </div>

            </div>

            <div className="flex gap-4 overflow-x-auto pb-3">

              {continueCourses.map((item, index) => (
                <div key={item.course.id} className="min-w-[300px] max-w-[320px]">
                  <ContinueCard
                    course={item.course}
                    stats={item.stats}
                    index={index}
                    onContinue={() => resumeCourse(item)}
                  />
                </div>
              ))}

            </div>

          </motion.section>
        )}

        {/* =====================================================
            推荐课程
        ===================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6"
        >

          <div className="mb-4 flex items-end justify-between">

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <h2 className="text-lg font-bold text-white">
                  推荐课程
                </h2>
              </div>
              <p className="mt-1 text-xs text-white/30">
                为你精选的泰语学习课程
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/course")}
              className="flex items-center gap-1 text-xs text-[#CB8DFF]/60 transition hover:text-emerald-200"
            >
              查看全部
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

          </div>

          <div className="mobile-scroll-x flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 xl:grid-cols-3">

            {recommendedCourses.map((course, index) => (
              <RecommendCard
                key={course.id}
                course={course}
                index={index}
                onOpen={() => navigate(`/course/${course.id}`)}
              />
            ))}

          </div>

        </motion.section>

        {/* =====================================================
            今日词汇 + 学习进度
        ===================================================== */}

        <ThaiSectionDivider className="mt-10 mb-6" />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          <motion.div
            initial={{
              opacity: 0,
              x: -20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              delay: 0.3,
              duration: 0.5,
            }}
            className="lg:col-span-3"
            id="vocab-card"
          >

            <DashboardCard
              title="今日词汇"
              subtitle="继续巩固你的泰语词汇"
              icon={BookOpen}
              onClick={() => navigate("/vocabulary")}
            >
              <VocabularyCard />
            </DashboardCard>

          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              x: 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              delay: 0.35,
              duration: 0.5,
            }}
            className="lg:col-span-2"
            id="progress"
          >

            <DashboardCard
              title="学习进度"
              subtitle="看看今天完成了多少"
              icon={Target}
            >
              <ProgressDashboard />
            </DashboardCard>

          </motion.div>

        </div>

        {/* =====================================================
            今日一句 + 泰语小知识
        ===================================================== */}

        <ThaiSectionDivider className="mt-10 mb-6" />

        <div className="mobile-scroll-x flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3">

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.4,
              duration: 0.6,
            }}
            className="min-w-[calc(100vw-2rem)] snap-start lg:min-w-0 lg:col-span-1"
          >
            <TodaySentenceCard
              sentence={todaySentence}
              isSpeaking={isSpeaking}
              onSpeak={handleSpeakThai}
            />
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.45,
              duration: 0.6,
            }}
            className="min-w-[calc(100vw-2rem)] snap-start lg:min-w-0 lg:col-span-1"
          >
            <HomePlanCard />
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.5,
              duration: 0.6,
            }}
            className="min-w-[calc(100vw-2rem)] snap-start lg:min-w-0 lg:col-span-1"
          >
            <ThaiTipCard />
          </motion.div>

        </div>

        {/* =====================================================
            口语练习入口（部分免费 · 部分 VIP）
        ===================================================== */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-5"
        >
          <button
            onClick={() => navigate("/speaking")}
            className="group relative w-full overflow-hidden rounded-[24px] border border-[#CB8DFF]/10 bg-gradient-to-r from-[#CB8DFF]/[0.10] via-white/[0.03] to-[#CB8DFF]/[0.06] p-5 text-left shadow-2xl backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[#CB8DFF]/20"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#CB8DFF]/[0.10] blur-3xl transition-all group-hover:bg-[#CB8DFF]/[0.16]" />

            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#CB8DFF]/20 bg-gradient-to-br from-[#CB8DFF]/[0.15] to-[#CB8DFF]/[0.08]">
                <Mic className="h-5 w-5 text-[#CB8DFF] transition-transform group-hover:scale-110" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-white">
                    口语练习
                  </p>

                  <span className="rounded-full border border-yellow-300/25 bg-yellow-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-yellow-200/85">
                    部分免费 · 部分 VIP
                  </span>
                </div>

                <p className="mt-1 text-xs text-white/35">
                  单词免费练习 · 句子 / 段落为 VIP 专属 · Azure 音素级评测
                </p>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0 text-white/20 transition-all group-hover:translate-x-0.5 group-hover:text-[#CB8DFF]" />
            </div>
          </button>
        </motion.div>

      </div>

      {/* =====================================================
          浮动按钮
      ===================================================== */}

      <motion.button
        onClick={() => navigate("/vocabulary")}
        initial={{
          scale: 0,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        transition={{
          delay: 0.6,
          type: "spring",
          stiffness: 200,
          damping: 20,
        }}
        whileHover={{
          scale: 1.1,
          boxShadow:
            "0 0 40px rgba(203, 141, 255, 0.3), 0 0 80px rgba(203, 141, 255, 0.1)",
        }}
        whileTap={{
          scale: 0.9,
        }}
        className="
          fixed
          bottom-[calc(5.75rem+env(safe-area-inset-bottom))]
          right-4
          sm:bottom-7
          sm:right-7
          z-40
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          border
          border-white/15
          bg-gradient-to-br
          from-[#CB8DFF]
          via-[#CB8DFF]/90
          to-teal-400
          shadow-xl
          shadow-[#CB8DFF]/25
          backdrop-blur-sm
          transition-all
          duration-300
        "
      >
        <Plus className="h-6 w-6 text-white" />
      </motion.button>

      {/* =====================================================
          VIP 激活面板（续费提醒点击直达）
      ===================================================== */}

      <VipPanel
        open={showVipPanel}
        onClose={() => setShowVipPanel(false)}
      />

    </div>
  );
}

/* =========================================================
   主页主题入口
   默认保留原主页；数字佛像主题改为参考图式沉浸式滚动主页
========================================================= */

export default function Home() {
  return <LegacyHome />;
}

/* =========================================================
   今日一句泰语
========================================================= */

/* =========================================================
   首页学习计划卡（读 Plan 页 localStorage 记录）
========================================================= */

const HOME_PLAN_TASKS = [
  { id: "vocab", title: "学习 10 个单词", icon: BookOpen },
  { id: "video", title: "观看 1 节视频", icon: Play },
  { id: "speaking", title: "完成 5 分钟口语", icon: Mic },
  { id: "chat", title: "进行 1 次 AI 对话", icon: MessageCircle },
];

function MobileQuickActions({ aiTeacher }) {
  const navigate = useNavigate();

  const actions = [
    { label: "课程", detail: "继续学", path: "/course", icon: BookOpen, tone: "emerald" },
    { label: "词汇", detail: "记单词", path: "/vocabulary", icon: Languages, tone: "teal" },
    { label: "口语", detail: "练发音", path: "/speaking", icon: Mic, tone: "gold" },
    ...(aiTeacher
      ? [{ label: "对话", detail: "和老师聊", path: "/conversation", icon: MessageCircle, tone: "blue" }]
      : [{ label: "计划", detail: "今日任务", path: "/plan", icon: Target, tone: "blue" }]),
  ];

  const toneClasses = {
    emerald: "border-emerald-300/15 bg-[#CB8DFF]/[0.08] text-emerald-200",
    teal: "border-teal-300/15 bg-teal-400/[0.08] text-teal-200",
    gold: "border-yellow-300/15 bg-yellow-300/[0.08] text-yellow-200",
    blue: "border-sky-300/15 bg-sky-400/[0.08] text-sky-200",
  };

  return (
    <section className="mb-5 md:hidden" aria-label="学习快捷入口">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-bold text-white">现在开始</p>
          <p className="mt-1 text-[11px] text-white/35">选择一个入口，马上进入学习</p>
        </div>
        <Zap className="h-4 w-4 text-yellow-300/70" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map(({ label, detail, path, icon: Icon, tone }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-1.5 py-3 text-center transition active:scale-[0.97]"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="w-full truncate text-xs font-semibold text-white/85">{label}</span>
            <span className="w-full truncate text-[9px] text-white/30">{detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function HomePlanCard() {
  const navigate = useNavigate();

  const [records, setRecords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("thai_ai_plan_v1")) || {};
    } catch {
      return {};
    }
  });

  const today = new Date().toISOString().split("T")[0];
  const todayDone = records[today] || {};
  const completed = HOME_PLAN_TASKS.filter(
    (task) => todayDone[task.id]
  ).length;
  const progress = Math.round(
    (completed / HOME_PLAN_TASKS.length) * 100
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6">

      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[#CB8DFF]/[0.07] blur-3xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Target className="h-4 w-4 text-yellow-300" />
          学习计划
        </div>

        <button
          type="button"
          onClick={() => navigate("/plan")}
          className="flex items-center gap-1 text-[11px] text-white/35 transition hover:text-[#CB8DFF]"
        >
          查看全部
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative mt-4 space-y-3">
        {HOME_PLAN_TASKS.map((task) => {
          const done = !!todayDone[task.id];
          const Icon = task.icon;

          return (
            <div key={task.id} className="flex items-center gap-3">

              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  done
                    ? "border-emerald-300/25 bg-[#CB8DFF]/[0.12]"
                    : "border-white/[0.08] bg-white/[0.04]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    done ? "text-[#CB8DFF]" : "text-white/45"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-xs ${
                      done ? "text-white/50 line-through" : "text-white/80"
                    }`}
                  >
                    {task.title}
                  </span>

                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-[#CB8DFF]/20 text-[#CB8DFF]"
                        : "border border-white/15 text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <div className="relative mt-auto pt-4">
        <div className="mb-2 flex items-center justify-between text-[10px]">
          <span className="text-white/30">今日完成</span>
          <span className="font-semibold text-yellow-300">
            {completed} / {HOME_PLAN_TASKS.length}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400"
          />
        </div>
      </div>

    </div>
  );
}

function TodaySentenceCard({
  sentence,
  isSpeaking,
  onSpeak,
}) {
  return (
    <div
      className="
        group
        relative
        h-full
        overflow-hidden
        rounded-[26px]
        border
        border-[#CB8DFF]/10
        bg-gradient-to-br
        from-[#CB8DFF]/[0.08]
        via-white/[0.035]
        to-yellow-300/[0.045]
        p-[1px]
        shadow-2xl
        shadow-black/20
        backdrop-blur-2xl
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -right-24
          -top-24
          h-64
          w-64
          rounded-full
          bg-[#CB8DFF]/10
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-24
          left-1/3
          h-56
          w-56
          rounded-full
          bg-yellow-300/[0.06]
          blur-3xl
        "
      />

      {/* 寺庙剪影（原创 SVG，夜幕下若隐若现） */}

      <BangkokSkyline
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-[0.16]"
        opacity={0.7}
      />

      <div
        className="
          relative
          flex
          h-full
          flex-col
          rounded-[25px]
          bg-[#071817]/80
          px-5
          py-5
          sm:px-7
          sm:py-6
        "
      >

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-yellow-300/15
                bg-yellow-300/[0.08]
              "
            >
              <Feather className="h-5 w-5 text-yellow-300" />
            </div>

            <div>

              <h2 className="font-semibold text-white">
                今日一句泰语
              </h2>

              <p className="mt-0.5 text-xs text-white/30">
                每天一句泰语诗，感受语言之美
              </p>

            </div>

          </div>

          <span
            className="
              rounded-full
              border
              border-yellow-300/10
              bg-yellow-300/[0.06]
              px-3
              py-1
              text-[10px]
              font-medium
              text-yellow-300/70
            "
          >
            {sentence.category}
          </span>

        </div>

        <div className="mt-6 flex flex-1 flex-col justify-center">

          {/* 诗题金饰：✦ + 两侧渐隐金线 */}

          <div
            className="
              mb-5
              flex
              items-center
              justify-center
              gap-3
            "
          >

            <span
              className="
                h-px
                w-12
                bg-gradient-to-r
                from-transparent
                to-yellow-300/40
              "
            />

            <span className="text-sm text-yellow-300/70">
              ✦
            </span>

            <span
              className="
                h-px
                w-12
                bg-gradient-to-l
                from-transparent
                to-yellow-300/40
              "
            />

          </div>

          {/* 泰语诗句：逐行呈现 */}

          <div className="space-y-1.5 text-center">

            {sentence.thai.split("\n").map((line, index) => (
              <div
                key={index}
                className="
                  font-thai-serif
                  text-2xl
                  font-semibold
                  leading-relaxed
                  tracking-[0.06em]
                  text-white
                  sm:text-[26px]
                "
              >
                {line}
              </div>
            ))}

          </div>

          {/* 读音提示 */}

          <div
            className="
              mt-4
              text-center
              text-[13px]
              italic
              tracking-wide
              text-[#CB8DFF]/75
            "
          >
            {sentence.pronunciation}
          </div>

          {/* 中文译文：细金分隔线 + 柔光字 */}

          <div
            className="
              mt-5
              border-t
              border-white/[0.06]
              pt-4
            "
          >

            {sentence.chinese.split("\n").map((line, index) => (
              <div
                key={index}
                className="
                  text-center
                  text-sm
                  leading-6
                  text-white/50
                "
              >
                {line}
              </div>
            ))}

          </div>

        </div>

        <div className="mt-6 flex justify-center">

          <motion.button
            type="button"
            onClick={onSpeak}
            whileHover={{
              scale: 1.04,
            }}
            whileTap={{
              scale: 0.96,
            }}
            className="
              group/speak
              flex
              items-center
              gap-2.5
              rounded-full
              border
              border-[#CB8DFF]/20
              bg-gradient-to-r
              from-[#CB8DFF]/15
              to-teal-400/10
              px-5
              py-2.5
              text-sm
              font-medium
              text-emerald-200
              shadow-lg
              shadow-emerald-950/20
              transition-all
              hover:border-emerald-300/35
              hover:bg-[#CB8DFF]/20
            "
          >

            {isSpeaking ? (
              <div className="flex items-center gap-1">

                <span className="flex items-end gap-[2px]">

                  <span className="h-3 w-[2px] animate-pulse rounded-full bg-emerald-300" />

                  <span
                    className="h-5 w-[2px] animate-pulse rounded-full bg-emerald-300"
                    style={{
                      animationDelay: "120ms",
                    }}
                  />

                  <span
                    className="h-3.5 w-[2px] animate-pulse rounded-full bg-emerald-300"
                    style={{
                      animationDelay: "240ms",
                    }}
                  />

                  <span
                    className="h-4 w-[2px] animate-pulse rounded-full bg-emerald-300"
                    style={{
                      animationDelay: "360ms",
                    }}
                  />

                </span>

                <span className="ml-1">
                  正在播放
                </span>

              </div>
            ) : (
              <>
                <Volume2
                  className="
                    h-4
                    w-4
                    transition-transform
                    group-hover/speak:scale-110
                  "
                />

                <span>
                  听发音
                </span>
              </>
            )}

          </motion.button>

        </div>

        <div className="mt-5 text-center text-[10px] text-white/20">
          点击播放，聆听诗句的韵律
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   泰语小知识
========================================================= */

function ThaiTipCard() {
  const [tipIndex, setTipIndex] = useState(() => {
    const today = new Date();

    return (
      (today.getFullYear() +
        today.getMonth() +
        today.getDate()) %
      THAI_TIPS.length
    );
  });

  const [isSpeaking, setIsSpeaking] = useState(false);

  // 谚语主题筛选：null = 全部（小知识 + 谚语），选中后只看该主题谚语
  const [activeTheme, setActiveTheme] = useState(null);

  const proverbThemes = useMemo(() => {
    const themes = [];

    THAI_TIPS.forEach((item) => {
      if (
        item.category === "民俗谚语" &&
        item.theme &&
        !themes.includes(item.theme)
      ) {
        themes.push(item.theme);
      }
    });

    return themes;
  }, []);

  const filteredTips = useMemo(() => {
    if (!activeTheme) return THAI_TIPS;

    return THAI_TIPS.filter(
      (item) => item.theme === activeTheme
    );
  }, [activeTheme]);

  // 切换主题时回到该主题第一条
  useEffect(() => {
    setTipIndex(0);
  }, [activeTheme]);

  const safeIndex =
    filteredTips.length > 0
      ? tipIndex % filteredTips.length
      : 0;

  const tip = filteredTips[safeIndex];

  const speakCancelRef = useRef(null);

  const handleNextTip = () => {
    speakCancelRef.current?.();
    setIsSpeaking(false);

    setTipIndex((current) => {
      return (
        (current + 1) %
        (filteredTips.length || 1)
      );
    });
  };

  const handleThemeChange = (theme) => {
    speakCancelRef.current?.();
    setIsSpeaking(false);
    setActiveTheme(theme);
  };

  const handleSpeak = () => {
    if (!tip?.thai) return;

    if (isSpeaking) {
      speakCancelRef.current?.();
      setIsSpeaking(false);
      return;
    }

    speakCancelRef.current = speakThai(tip.thai, {
      rate: 0.78,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  return (
    <motion.div
      whileHover={{
        y: -3,
      }}
      className="
        group
        relative
        h-full
        overflow-hidden
        rounded-[26px]
        border
        border-yellow-300/10
        bg-gradient-to-br
        from-yellow-400/[0.08]
        via-white/[0.035]
        to-emerald-400/[0.06]
        p-[1px]
        shadow-2xl
        shadow-black/20
        backdrop-blur-2xl
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -right-20
          -top-20
          h-56
          w-56
          rounded-full
          bg-yellow-300/10
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-20
          -left-20
          h-52
          w-52
          rounded-full
          bg-[#CB8DFF]/10
          blur-3xl
        "
      />

      <div
        className="
          relative
          flex
          h-full
          flex-col
          rounded-[25px]
          bg-[#071817]/85
          p-5
          sm:p-6
        "
      >

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-yellow-300/10
                bg-yellow-300/10
                text-lg
              "
            >
              🇹🇭
            </div>

            <div>

              <h2 className="font-semibold text-white">
                泰语小知识
              </h2>

              <p className="mt-0.5 text-xs text-white/30">
                每天了解一点泰语
              </p>

            </div>

          </div>

          <span
            className="
              shrink-0
              rounded-full
              border
              border-yellow-300/10
              bg-yellow-300/[0.06]
              px-2.5
              py-1
              text-[10px]
              font-medium
              text-yellow-300/80
            "
          >
            {tip.type} {tip.category}
            {tip.theme ? ` · ${tip.theme}` : ""}
          </span>

        </div>

        {/* 谚语主题筛选（横向滚动 chips） */}

        <div
          className="
            mt-4
            flex
            items-center
            gap-1.5
            overflow-x-auto
            pb-1
            [scrollbar-width:none]
          "
        >

          {["全部", ...proverbThemes].map(
            (theme) => {
              const active =
                theme === "全部"
                  ? activeTheme === null
                  : activeTheme === theme;

              const meta = THEME_META[theme] || {
                icon: "✨",
                active:
                  "border-yellow-300/40 bg-yellow-300/15 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.15)]",
              };

              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() =>
                    handleThemeChange(
                      theme === "全部" ? null : theme
                    )
                  }
                  className={`
                    flex
                    shrink-0
                    items-center
                    gap-1
                    rounded-full
                    border
                    px-2.5
                    py-1
                    text-[10px]
                    font-medium
                    transition-all
                    ${
                      active
                        ? meta.active
                        : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/20 hover:text-white/70"
                    }
                  `}
                >
                  <span className="text-[11px] leading-none">
                    {meta.icon}
                  </span>
                  {theme}
                </button>
              );
            }
          )}

        </div>

        <div className="mt-4 flex-1">

          <h3 className="text-lg font-bold text-white">
            {tip.title}
          </h3>

          <p className="mt-3 text-sm leading-6 text-white/50">
            {tip.content}
          </p>

          <div
            className="
              mt-4
              rounded-2xl
              border
              border-white/[0.06]
              bg-white/[0.035]
              p-4
            "
          >

            <div className="text-lg font-semibold tracking-wide text-emerald-200">
              {tip.thai}
            </div>

            <div className="mt-1.5 text-xs text-white/40">
              {tip.chinese}
            </div>

          </div>

        </div>

        <div className="mt-5 flex items-center justify-between">

          <button
            type="button"
            onClick={handleSpeak}
            className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-emerald-300/15
              bg-[#CB8DFF]/10
              px-4
              py-2
              text-xs
              text-emerald-200
              transition
              hover:border-[#CB8DFF]/30
              hover:bg-[#CB8DFF]/20
            "
          >

            <Volume2 className="h-4 w-4" />

            {isSpeaking
              ? "正在播放"
              : "听例句"}

          </button>

          <button
            type="button"
            onClick={handleNextTip}
            className="
              flex
              items-center
              gap-1
              text-xs
              text-white/35
              transition
              hover:text-yellow-300
            "
          >
            换一条

            <ChevronRight className="h-4 w-4" />
          </button>

        </div>

      </div>
    </motion.div>
  );
}

/* =========================================================
   继续学习卡片
========================================================= */

function ContinueCard({
  course,
  stats,
  index,
  onContinue,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-3xl border border-emerald-300/[0.10] bg-gradient-to-br from-[#CB8DFF]/[0.10] via-white/[0.035] to-teal-400/[0.06] p-5 backdrop-blur-xl"
    >

      {course.cover && (
        <div className="relative -m-5 mb-4 h-24 overflow-hidden">
          <img
            src={course.cover}
            alt={course.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071817]/90 via-[#071817]/20 to-transparent" />
        </div>
      )}

      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-300/[0.08] blur-3xl" />

      <div className="relative min-w-[280px] sm:min-w-0">

        <div className="flex items-start justify-between">

          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-white">
              {course.title}
            </h3>
            <p className="mt-1 text-xs text-white/35">
              已完成 {stats.completedCount} / {course.lessons} 节
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#CB8DFF]/10">
            <Video className="h-5 w-5 text-[#CB8DFF]" />
          </div>

        </div>

        <div className="mt-5">

          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="text-white/30">学习进度</span>
            <span className="font-semibold text-[#CB8DFF]">
              {stats.progressPercent}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.progressPercent}%` }}
              transition={{ duration: 0.8 }}
              className="h-full rounded-full bg-gradient-to-r from-[#CB8DFF] to-teal-300"
            />
          </div>

        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-400/20"
        >
          <Play className="h-4 w-4 fill-current" />
          继续学习
        </button>

      </div>

    </motion.div>
  );
}


/* =========================================================
   推荐课程卡片
========================================================= */

function RecommendCard({
  course,
  index,
  onOpen,
}) {
  const isVip = course.isVip === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className={`group relative min-w-[280px] overflow-hidden rounded-3xl border p-5 backdrop-blur-xl transition-all sm:min-w-0 ${
        isVip
          ? "border-yellow-300/[0.08] bg-gradient-to-br from-yellow-300/[0.04] via-white/[0.025] to-purple-400/[0.04] hover:bg-white/[0.05]"
          : "border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.055]"
      }`}
    >

      {course.cover && (
        <div className="relative -m-5 mb-4 h-24 overflow-hidden">
          <img
            src={course.cover}
            alt={course.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071817]/90 via-[#071817]/20 to-transparent" />
        </div>
      )}

      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#CB8DFF]/[0.06] blur-3xl" />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              isVip
                ? "border-yellow-300/10 bg-yellow-300/[0.06]"
                : "border-[#CB8DFF]/10 bg-[#CB8DFF]/[0.08]"
            }`}>
              {isVip ? (
                <Crown className="h-4 w-4 text-yellow-300/70" />
              ) : (
                <Video className="h-4 w-4 text-[#CB8DFF]" />
              )}
            </div>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/40">
              {course.category}
            </span>
          </div>

          <span className="text-[10px] text-white/25">
            {course.level}
          </span>

        </div>

        <h3 className="mt-5 text-lg font-bold text-white">
          {course.title}
        </h3>

        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-white/35">
          {course.description}
        </p>

        <div className="mt-5 flex items-center gap-4 text-xs text-white/25">
          <span className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" />
            {course.lessons} 节视频
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {course.duration}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
            isVip
              ? "border-yellow-300/10 bg-yellow-300/[0.05] text-yellow-100/60 hover:bg-yellow-300/[0.09] hover:text-yellow-100"
              : "border-white/[0.08] bg-white/[0.05] text-white/55 hover:bg-white/[0.09] hover:text-white"
          }`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {isVip ? "查看 VIP 课程" : "进入课程"}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

      </div>

    </motion.div>
  );
}

/* =========================================================
   普通数据卡片
========================================================= */

function StatCard({
  icon: Icon,
  title,
  value,
  unit,
  iconClass,
  description,
}) {
  return (
    <motion.div
      whileHover={{
        y: -4,
      }}
      transition={{
        duration: 0.25,
      }}
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-white/[0.045]
        p-4
        shadow-xl
        shadow-black/10
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-[#CB8DFF]/20
        hover:bg-white/[0.07]
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -right-10
          -top-10
          h-24
          w-24
          rounded-full
          bg-[#CB8DFF]/10
          blur-2xl
          opacity-0
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div
            className="
              rounded-xl
              border
              border-white/[0.06]
              bg-white/[0.06]
              p-2
            "
          >
            <Icon
              className={`h-5 w-5 ${iconClass}`}
            />
          </div>

          <span className="text-[11px] text-white/30">
            学习数据
          </span>

        </div>

        <div className="mt-4">

          <div className="text-xs text-white/45">
            {title}
          </div>

          <div className="mt-1 flex items-baseline gap-1">

            <span className="text-2xl font-bold tracking-tight">
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value
              )}
            </span>

            <span className="text-xs text-white/40">
              {unit}
            </span>

          </div>

          <div className="mt-1.5 text-[11px] text-white/30">
            {description}
          </div>

        </div>

      </div>
    </motion.div>
  );
}

/* =========================================================
   词汇统计卡片
========================================================= */

function VocabularyStatCard({
  value,
  total,
  percent,
}) {
  return (
    <motion.div
      whileHover={{
        y: -4,
      }}
      transition={{
        duration: 0.25,
      }}
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-white/[0.045]
        p-4
        shadow-xl
        shadow-black/10
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-[#CB8DFF]/20
        hover:bg-white/[0.07]
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -right-10
          -top-10
          h-24
          w-24
          rounded-full
          bg-[#CB8DFF]/10
          blur-2xl
          opacity-0
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div
            className="
              rounded-xl
              border
              border-white/[0.06]
              bg-white/[0.06]
              p-2
            "
          >
            <BookOpen className="h-5 w-5 text-[#CB8DFF]" />
          </div>

          <span className="text-[11px] text-white/30">
            {percent}%
          </span>

        </div>

        <div className="mt-4">

          <div className="text-xs text-white/45">
            已掌握词汇
          </div>

          <div className="mt-1 flex items-baseline gap-1">

            <span className="text-2xl font-bold tracking-tight">
              <AnimatedNumber value={value} />
            </span>

            <span className="text-xs text-white/40">
              / {total}
            </span>

          </div>

          <div
            className="
              mt-3
              h-1.5
              overflow-hidden
              rounded-full
              bg-white/[0.07]
            "
          >

            <motion.div
              initial={{
                width: 0,
              }}
              animate={{
                width: `${percent}%`,
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
              }}
              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-[#CB8DFF]
                via-teal-300
                to-yellow-300
              "
            />

          </div>

          <div
            className="
              mt-1.5
              flex
              items-center
              gap-1
              text-[11px]
              text-white/30
            "
          >

            <Zap className="h-3 w-3 text-yellow-300/70" />

            目标：500 词

          </div>

        </div>

      </div>
    </motion.div>
  );
}

/* =========================================================
   Dashboard 卡片
========================================================= */

function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  children,
  onClick = () => {},
}) {
  return (
    <div
      className="
        relative
        h-full
        overflow-hidden
        rounded-[26px]
        border
        border-white/10
        bg-white/[0.045]
        shadow-2xl
        shadow-black/20
        backdrop-blur-2xl
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-white/[0.08]
          px-5
          py-4
        "
      >

        <div className="flex items-center gap-3">

          <div
            className="
              rounded-xl
              bg-[#CB8DFF]/10
              p-2
            "
          >
            <Icon className="h-5 w-5 text-[#CB8DFF]" />
          </div>

          <div>

            <h2 className="font-semibold text-white">
              {title}
            </h2>

            <p className="text-xs text-white/35">
              {subtitle}
            </p>

          </div>

        </div>

        {onClick && (
          <button
            onClick={onClick}
            className="
              flex
              items-center
              gap-1
              text-xs
              text-[#CB8DFF]/80
              transition
              hover:text-yellow-300
            "
          >
            查看全部

            <ChevronRight className="h-4 w-4" />
          </button>
        )}

      </div>

      <div className="p-4">
        {children}
      </div>

    </div>
  );
}