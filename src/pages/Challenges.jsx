import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import StreakCard from '@/components/challenges/StreakCard';
import DailyGoals from '@/components/challenges/DailyGoals';
import Leaderboard from '@/components/challenges/Leaderboard';
import { useLearningProgress } from '@/hooks/useLearningProgress';
import { base44 } from '@/api/base44Client';

export default function Challenges() {
  const { progress, loading } = useLearningProgress();
  const [lbData, setLbData] = useState({ leaderboard: [], current_user_id: null });
  const [lbLoading, setLbLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const lbRes = await base44.functions.invoke('getLeaderboard', {});
        setLbData(lbRes.data || { leaderboard: [], current_user_id: null });
        const s = await base44.entities.UserSettings.list('-created_date', 1);
        setSettings(s?.[0] || null);
      } catch (e) {
        // ignore
      } finally {
        setLbLoading(false);
      }
    };
    load();
  }, []);

  const points = (progress?.total_vocabulary || 0) * 10 + (progress?.learning_streak || 0) * 50 + (progress?.accuracy_rate || 0) * 5;
  const rankIdx = lbData.leaderboard.findIndex(e => e.user_id === lbData.current_user_id);
  const rankNum = rankIdx >= 0 ? rankIdx + 1 : '—';

  return (
    <div className="min-h-screen bg-gradient-to-b from-thai-ivory via-white to-thai-cream/20">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 md:pb-7 space-y-5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-thai-green">学习挑战赛</h1>
          <p className="text-sm text-muted-foreground mt-0.5">坚持每日学习，登上排行榜</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StreakCard streak={loading ? 0 : progress?.learning_streak || 0} points={points} rank={rankNum} />
          <div className="lg:col-span-2">
            <DailyGoals todayWords={loading ? 0 : progress?.today_words || 0} dailyGoal={settings?.daily_word_goal || 20} />
          </div>
        </div>
        {lbLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-thai-ivory border-t-thai-green rounded-full animate-spin"></div>
          </div>
        ) : (
          <Leaderboard leaderboard={lbData.leaderboard} currentUserId={lbData.current_user_id} />
        )}
      </main>
    </div>
  );
}