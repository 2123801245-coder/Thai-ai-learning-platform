import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';

export default function StreakCard({ streak, points, rank }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-gradient-to-br from-thai-green to-emerald-700 p-6 text-white relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full"></div>
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-thai-gold/10 rounded-full"></div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-thai-gold-light" />
          <span className="text-sm font-medium text-thai-gold-light">连胜纪录</span>
        </div>
        <div className="flex items-end gap-2 mb-4">
          <span className="text-5xl font-bold">{streak}</span>
          <span className="text-lg text-white/70 mb-1.5">天</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-thai-gold-light" />
              <span className="text-xs text-white/60">积分</span>
            </div>
            <span className="text-xl font-bold">{points}</span>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-thai-gold-light" />
              <span className="text-xs text-white/60">排名</span>
            </div>
            <span className="text-xl font-bold">#{rank}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}