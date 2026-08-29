import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, BookOpen } from 'lucide-react';

export default function Leaderboard({ leaderboard, currentUserId }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="rounded-3xl border border-thai-green/8 bg-white/80 p-8 text-center">
        <Trophy className="w-10 h-10 text-thai-gold/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">暂无排行榜数据</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-3xl border border-thai-green/8 bg-white/80 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b border-thai-green/5">
        <Trophy className="w-4 h-4 text-thai-gold" />
        <h3 className="font-heading font-bold text-thai-green">排行榜</h3>
      </div>
      <div className="divide-y divide-thai-green/5">
        {leaderboard.map((entry, i) => {
          const isMe = entry.user_id === currentUserId;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div key={entry.user_id || i} className={`flex items-center gap-3 px-5 py-3 ${isMe ? 'bg-thai-gold/5' : ''}`}>
              <span className="w-8 text-center font-bold text-sm text-thai-green/60">
                {medal || (i + 1)}
              </span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-thai-blue to-thai-green flex items-center justify-center text-white text-sm font-bold">
                {entry.avatar || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isMe ? 'text-thai-green' : 'text-thai-green/80'}`}>
                  {entry.user_name} {isMe && <span className="text-xs text-thai-gold">(我)</span>}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Flame className="w-3 h-3 text-thai-temple" />{entry.streak}天</span>
                  <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3 text-thai-blue" />{entry.total_words}词</span>
                </div>
              </div>
              <span className="text-sm font-bold text-thai-gold">{entry.points}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}