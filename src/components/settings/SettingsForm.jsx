import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Bell, Clock, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function SettingsForm({ initialSettings }) {
  const [dailyGoal, setDailyGoal] = useState(initialSettings?.daily_word_goal || 20);
  const [pushEnabled, setPushEnabled] = useState(initialSettings?.push_notifications || false);
  const [reminderTime, setReminderTime] = useState(initialSettings?.reminder_time || '20:00');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      if (initialSettings?.id) {
        await base44.entities.UserSettings.update(initialSettings.id, {
          daily_word_goal: dailyGoal,
          push_notifications: pushEnabled,
          reminder_time: reminderTime,
        });
      } else {
        await base44.entities.UserSettings.create({
          daily_word_goal: dailyGoal,
          push_notifications: pushEnabled,
          reminder_time: reminderTime,
        });
      }
      toast({ title: '设置已保存', description: '您的学习偏好已更新' });
    } catch (e) {
      toast({ title: '保存失败', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-thai-green/8 bg-white/80 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-thai-gold/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-thai-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-thai-green">每日学习目标</h3>
            <p className="text-xs text-muted-foreground">设置每天计划学习的单词数量</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input type="range" min="5" max="50" step="5" value={dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            className="flex-1 accent-thai-green" />
          <span className="text-2xl font-bold text-thai-green w-16 text-right">{dailyGoal} 词</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-thai-green/8 bg-white/80 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-thai-blue/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-thai-blue" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thai-green">推送通知提醒</h3>
              <p className="text-xs text-muted-foreground">开启后每天提醒您学习</p>
            </div>
          </div>
          <button onClick={() => setPushEnabled(!pushEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-thai-green' : 'bg-thai-ivory'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </motion.div>

      {pushEnabled && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl border border-thai-green/8 bg-white/80 backdrop-blur-sm p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-thai-temple/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-thai-temple" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thai-green">学习提醒时间</h3>
              <p className="text-xs text-muted-foreground">选择每天接收提醒的时间点</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-thai-green/10 bg-white text-thai-green text-sm focus:outline-none focus:ring-2 focus:ring-thai-gold/30" />
            <span className="text-sm text-muted-foreground">每天 {reminderTime} 提醒</span>
          </div>
        </motion.div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-thai-green to-emerald-700 text-white font-medium shadow-md hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}