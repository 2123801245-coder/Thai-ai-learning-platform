import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, X, Keyboard, BookOpen } from "lucide-react";
import {
  highConsonants,
  midConsonants,
  lowConsonants,
  vowels,
  tones,
  digits,
  specialChars,
} from "../data/thaiAlphabet";
import { speakThai } from "@/lib/thaiSpeech";

/* ── 分类标签 ── */
const tabs = [
  { id: "all", label: "全部" },
  { id: "high", label: "高辅音" },
  { id: "mid", label: "中辅音" },
  { id: "low", label: "低辅音" },
  { id: "vowels", label: "元音" },
  { id: "tones", label: "声调" },
  { id: "digits", label: "数字" },
  { id: "special", label: "特殊字符" },
];

/* ── 朗读泰语（复用全站 speakThai：speechSynthesis → 本地 TTS → Google 兜底） ── */
function speak(text) {
  if (!text) return;
  speakThai(text, { rate: 0.8 });
}

/* ── 详情面板 ── */
function DetailPanel({ item, type, onClose }) {
  if (!item) return null;

  const isConsonant = type === "consonant";
  const isVowel = type === "vowel";
  const isTone = type === "tone";
  const isDigit = type === "digit";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4"
    >
      {/* 关闭按钮 */}
      <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white/80">
        <X size={16} />
      </button>

      {/* 主字母 */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-purple-500/20 flex items-center justify-center text-4xl font-bold text-purple-300">
          {isTone ? item.symbol : item.letter || item.thai || item.arabic}
        </div>
        <div>
          <div className="text-white/60 text-sm">{isConsonant ? "辅音字母" : isVowel ? "元音" : isTone ? "声调符号" : isDigit ? "泰文数字" : "特殊字符"}</div>
          <div className="text-white text-lg font-medium">{isTone ? item.tone : item.romanization || item.tone}</div>
        </div>
      </div>

      {/* 详情信息 */}
      <div className="space-y-3 text-sm">
        {isConsonant && (
          <>
            <div className="flex items-center gap-2 text-white/60">
              <Keyboard size={14} />
              <span>键盘键位：<span className="text-white font-mono">{item.keyboard || "—"}</span></span>
            </div>
            {item.note && <div className="text-yellow-400/70 text-xs">⚠ {item.note}</div>}
          </>
        )}

        {isVowel && (
          <div className="text-white/60">
            位置：<span className="text-white">{item.position}</span>
          </div>
        )}

        {isDigit && (
          <div className="text-white/60">
            阿拉伯数字：<span className="text-white font-mono text-lg">{item.arabic}</span>
          </div>
        )}

        {!isConsonant && !isVowel && !isDigit && !isTone && (
          <div className="text-white/60">
            名称：<span className="text-white">{item.name}</span>
            {item.meaning && (
              <span className="block mt-1 text-white/40 text-xs">含义：{item.meaning}</span>
            )}
          </div>
        )}

        {isTone && (
          <div className="text-white/60">
            名称：<span className="text-white">{item.name}</span>
          </div>
        )}
      </div>

      {/* 示例词 */}
      {(item.example || item.thai) && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="text-white/40 text-xs mb-2">示例词</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl text-purple-300 font-medium">{item.example || item.thai}</span>
            <button
              onClick={() => speak(item.example || item.thai)}
              className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 hover:bg-purple-500/30 transition"
            >
              <Volume2 size={14} />
            </button>
          </div>
          {item.exampleRoman && (
            <div className="text-white/50 text-xs mt-1">{item.exampleRoman}</div>
          )}
          {item.exampleMeaning && item.exampleMeaning !== "—" && (
            <div className="text-white/40 text-xs mt-1">释义：{item.exampleMeaning}</div>
          )}
        </div>
      )}

      {/* 发音按钮 */}
      <button
        onClick={() => speak(item.letter || item.example || item.thai)}
        className="w-full h-10 rounded-xl bg-purple-500/20 text-purple-300 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-500/30 transition"
      >
        <Volume2 size={15} /> 发音
      </button>
    </motion.div>
  );
}

/* ── 卡片 ── */
function AlphabetCard({ item, type, onClick, isActive }) {
  const displayLetter = item.symbol || item.letter || item.thai || item.arabic;
  const subtitle = item.tone || item.romanization || item.name || "";

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative w-full aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-200
        ${isActive
          ? "bg-purple-500/30 border-purple-400/50 shadow-lg shadow-purple-500/10"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
        }
      `}
    >
      <span className="text-2xl sm:text-3xl text-white font-medium leading-none">{displayLetter}</span>
      <span className="text-[10px] text-white/40 leading-tight">{subtitle}</span>
      {item.keyboard && (
        <span className="absolute top-1.5 right-1.5 text-[9px] text-white/20 font-mono bg-white/5 px-1 rounded">
          {item.keyboard}
        </span>
      )}
    </motion.button>
  );
}

/* ── 主页面 ── */
export default function ThaiAlphabet() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const handleSelect = (item, type) => {
    setSelectedItem(item);
    setSelectedType(type);
  };

  // 合并所有辅音
  const allConsonants = [
    ...highConsonants.map((c) => ({ ...c, _type: "high" })),
    ...midConsonants.map((c) => ({ ...c, _type: "mid" })),
    ...lowConsonants.map((c) => ({ ...c, _type: "low" })),
  ];

  const filteredItems = (() => {
    switch (activeTab) {
      case "high":
        return allConsonants.filter((c) => c._type === "high");
      case "mid":
        return allConsonants.filter((c) => c._type === "mid");
      case "low":
        return allConsonants.filter((c) => c._type === "low");
      case "vowels":
        return vowels;
      case "tones":
        return tones;
      case "digits":
        return digits;
      case "special":
        return specialChars;
      default:
        return [
          ...allConsonants,
          ...vowels,
          ...tones,
          ...digits,
          ...specialChars,
        ];
    }
  })();

  const getTypeForItem = (item) => {
    if (item._type) return "consonant";
    if (item.position) return "vowel";
    if (item.symbol) return "tone";
    if (item.arabic) return "digit";
    if (item.name && item.meaning) return "special";
    return "consonant";
  };

  return (
    <div className="flex h-full">
      {/* 左侧：列表 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* 标题 */}
        <div>
          <h1 className="text-2xl font-bold text-white">泰语字母表</h1>
          <p className="text-white/40 text-sm mt-1">点击字母查看详情和发音</p>
        </div>

        {/* 标签 */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-purple-500/30 text-purple-300 border border-purple-400/30"
                  : "bg-white/5 text-white/50 border border-white/[0.06] hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 网格 */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {filteredItems.map((item, i) => (
            <AlphabetCard
              key={`${item.letter || item.thai || item.arabic}-${i}`}
              item={item}
              type={getTypeForItem(item)}
              onClick={() => handleSelect(item, getTypeForItem(item))}
              isActive={selectedItem === item}
            />
          ))}
        </div>
      </div>

      {/* 右侧：详情面板 */}
      <div className="hidden lg:block p-4 pr-6">
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <DetailPanel
              key={JSON.stringify(selectedItem)}
              item={selectedItem}
              type={selectedType}
              onClose={() => setSelectedItem(null)}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-80 h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center text-center p-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <BookOpen size={24} className="text-white/20" />
              </div>
              <p className="text-white/30 text-sm">点击左侧字母查看详情</p>
              <p className="text-white/20 text-xs mt-1">包含发音、键位和示例词</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
