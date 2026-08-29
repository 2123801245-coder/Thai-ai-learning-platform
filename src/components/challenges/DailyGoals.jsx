import React from 'react';
import { motion } from 'framer-motion';
import { Target, Check } from 'lucide-react';

export default function DailyGoals({ todayWords, dailyGoal }) {
  const goals = [
    { label: '学习10个单词', target: 10, current: todayWords },
    { label: '学习20个单词', target: 20, current: todayWords },
    { label: '完成今日目标', target: dailyGoal, current: todayWords },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-3xl border border-thai-green/8 bg-white/80 backdrop-blur-sm p-5 h-full"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-thai-gold/10 flex items-center justify-center">
          <Target className="w-4 h-4 text-thai-gold" />
        </div>
        <h3 className="font-heading font-bold text-thai-green">每日目标</h3>
      </div>
      <div className="space-y-3">
        {goals.map((goal, i) => {
          const completed = goal.current >= goal.target;
          const pct = Math.min(100, (goal.current / goal.target) * 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${completed ? 'bg-green-500' : 'bg-thai-ivory'}`}>
                {completed && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm ${completed ? 'text-thai-green line-through' : 'text-thai-green/80'}`}>{goal.label}</span>
                  <span className="text-xs text-muted-foreground">{goal.current}/{goal.target}</span>
                </div>
                <div className="h-1.5 bg-thai-ivory rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-thai-gold to-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}