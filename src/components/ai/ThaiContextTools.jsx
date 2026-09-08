import React from "react";
import { BookOpen, BriefcaseBusiness, Heart, MapPin, MessageCircle, Sparkles } from "lucide-react";

const TASKS = [
  { id: "explain", label: "Explain Like Thai", detail: "用泰国人的思维解释", icon: Sparkles },
  { id: "natural", label: "Make It Natural", detail: "改成自然表达", icon: MessageCircle },
  { id: "culture", label: "Explain the Culture", detail: "解释文化和关系", icon: BookOpen },
];

const PERSONAS = [
  { id: "bangkok", label: "曼谷年轻人", icon: MapPin },
  { id: "student", label: "泰国大学生", icon: BookOpen },
  { id: "office", label: "泰国职场", icon: BriefcaseBusiness },
  { id: "couple", label: "泰国情侣", icon: Heart },
];

const TONES = [
  { id: "casual", label: "随意" },
  { id: "natural", label: "自然" },
  { id: "polite", label: "礼貌" },
  { id: "formal", label: "正式" },
  { id: "very-formal", label: "非常正式" },
];

export default function ThaiContextTools({
  task,
  onTaskChange,
  tone,
  onToneChange,
  persona,
  onPersonaChange,
  compact = false,
}) {
  return (
    <div
      className={
        compact
          ? "relative z-20 mb-3 rounded-2xl border border-emerald-300/[0.1] bg-emerald-400/[0.035] p-3"
          : "relative z-20 mx-5 mt-3 rounded-2xl border border-emerald-300/[0.1] bg-emerald-400/[0.035] p-3 sm:mx-6"
      }
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-200/80">
        <Sparkles className="h-3.5 w-3.5" />
        Thai Context Intelligence
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {TASKS.map((item) => {
          const Icon = item.icon;
          const active = task === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTaskChange(item.id)}
              className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                active
                  ? "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-100"
                  : "border-white/[0.07] bg-white/[0.025] text-white/50 hover:border-emerald-300/20 hover:text-white/80"
              }`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? "text-emerald-300" : "text-white/35"}`} />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-white/35">{item.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-white/40">语气滑杆</span>
          <input
            aria-label="语气滑杆"
            type="range"
            min="0"
            max={TONES.length - 1}
            step="1"
            value={Math.max(0, TONES.findIndex((item) => item.id === tone))}
            onChange={(event) => onToneChange(TONES[Number(event.target.value)]?.id || "natural")}
            className="h-1.5 w-full cursor-pointer accent-emerald-400"
          />
          <span className="mt-1 flex justify-between text-[9px] text-white/30">
            {TONES.map((item) => <span key={item.id}>{item.label}</span>)}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-white/40">Thai Persona</span>
          <select
            aria-label="Thai Persona"
            value={persona}
            onChange={(event) => onPersonaChange(event.target.value)}
            className="h-9 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-xs text-white/75 outline-none transition focus:border-emerald-300/30"
          >
            {PERSONAS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
