import React from 'react';
import { motion } from 'framer-motion';
import { Check, Volume2, RotateCcw, Trash2 } from 'lucide-react';
import { speakThai } from '@/lib/thaiSpeech';

const DIFFICULTY_STYLES = {
  beginner: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-600',
  intermediate: 'border-yellow-300/15 bg-yellow-300/10 text-yellow-600',
  advanced: 'border-orange-300/15 bg-orange-400/10 text-orange-600',
};

const DIFFICULTY_LABELS = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

export default function WrongNotebookItem({
  item,
  selectMode,
  selected,
  onToggleSelect,
  onRemove,
  onPractice,
}) {
  const speak = (text) => {
    speakThai(text, { rate: 0.75 });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, padding: 0 }}
      onClick={selectMode ? onToggleSelect : undefined}
      className={`rounded-2xl border bg-white/80 backdrop-blur-sm p-4 transition-all ${
        selectMode ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'border-thai-green/40 bg-thai-green/5 shadow-md'
          : 'border-thai-green/8 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Select checkbox */}
        {selectMode && (
          <div className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center mt-0.5 transition ${
            selected
              ? 'border-thai-green bg-thai-green text-white'
              : 'border-thai-green/20 bg-white'
          }`}>
            {selected && <Check className="w-3.5 h-3.5" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-thai text-xl font-bold text-thai-green">{item.thai_word}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); speak(item.thai_word); }}
              className="p-1.5 rounded-lg hover:bg-thai-ivory transition-all"
            >
              <Volume2 className="w-3.5 h-3.5 text-thai-green/60" />
            </button>
            {item.difficulty && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_STYLES[item.difficulty] || ''}`}>
                {DIFFICULTY_LABELS[item.difficulty] || item.difficulty}
              </span>
            )}
          </div>

          {item.pronunciation && item.pronunciation !== '—' && (
            <p className="text-sm text-thai-blue font-medium mb-0.5">[{item.pronunciation}]</p>
          )}

          <p className="text-sm text-muted-foreground">{item.chinese_meaning}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(item.category || item.book) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-thai-ivory/60 text-thai-green/70">
                {item.category || item.book}
              </span>
            )}
            {item.wrong_count > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                错误 {item.wrong_count} 次
              </span>
            )}
            {item.last_wrong_date && (
              <span className="text-[10px] text-muted-foreground">
                {item.last_wrong_date}
              </span>
            )}
          </div>
        </div>

        {!selectMode && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onPractice(item); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-thai-green/5 text-thai-green text-xs font-medium hover:bg-thai-green/10 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 再学
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(item); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> 移除
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
