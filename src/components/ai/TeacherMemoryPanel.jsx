// src/components/ai/TeacherMemoryPanel.jsx
//
// =========================================================
// 老师记忆面板（「老师记得你」）
// =========================================================
//
// 原 MentorRoom 内嵌的 MemoryPanel，随房间合并抽成独立组件，
// 由 Conversation（合并后的 AI 对话室）使用。
//
// 数据：/ai/teacher/memory（读取时后端会把入学画像同步成记忆）
// 写入：/ai/teacher/memory/items（用户口述 → goal 类型）
// 分组结构是 [{ type, meta, items }] 数组（兼容老式对象）。

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Sparkles, X } from "lucide-react";

import {
  addAiTeacherMemoryItem,
  getAiTeacherMemory,
} from "@/api/aiTeacher";
import { MEMORY_PANEL_TYPES } from "@/lib/mentorScenes";

export default function TeacherMemoryPanel({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getAiTeacherMemory()
      .then((res) => {
        if (alive) setData(res?.data || null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const groupsRaw = data?.groups || [];
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw
    : Object.entries(groupsRaw).map(([type, items]) => ({ type, items }));
  const hasMemory = !!data?.hasMemory;

  const tellTeacher = async () => {
    const content = note.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      /* 用户口述的长期信息 → goal 类型（影响教学方向，重要度最高） */
      const res = await addAiTeacherMemoryItem({ type: "goal", content });
      const savedGroups = res?.data?.groups;
      if (savedGroups) {
        setData((prev) => ({
          ...(prev || {}),
          groups: savedGroups,
          hasMemory: true,
        }));
      }
      setNote("");
    } catch {
      /* 静默：记忆是辅助功能 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full shrink-0 rounded-2xl border border-white/[0.08] bg-[#050807]/60 p-4 backdrop-blur-2xl lg:w-[300px]"
      aria-label="老师对你的记忆"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">
          <Brain className="h-3.5 w-3.5" />
          老师记得你
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-white/30 transition hover:text-white/70"
          aria-label="收起记忆面板"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-[11.5px] text-white/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在回想…
        </p>
      ) : hasMemory ? (
        <div className="mt-3 space-y-2.5">
          {MEMORY_PANEL_TYPES.map(({ id, label, emoji }) => {
            const group = groups.find((g) => g.type === id);
            const items = group?.items || [];
            if (!items.length) return null;
            return (
              <div key={id}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                  {emoji} {label}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((it) => (
                    <li
                      key={it.id || it.content}
                      className="text-[11.5px] leading-relaxed text-white/70"
                    >
                      · {it.content}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] leading-relaxed text-white/45">
          老师还没记住关于你的事。聊几句之后 TA 会自动记住你的目标、薄弱点和兴趣——也可以直接告诉 TA。
        </p>
      )}

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="直接告诉老师：比如「我下学期要去清迈交换」"
          className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-2 text-[11.5px] text-white/85 outline-none transition placeholder:text-white/25 focus:border-emerald-300/40"
        />
        <button
          type="button"
          onClick={tellTeacher}
          disabled={!note.trim() || saving}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/15 py-1.5 text-[11.5px] font-bold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          让老师记住这件事
        </button>
      </div>
    </motion.aside>
  );
}
