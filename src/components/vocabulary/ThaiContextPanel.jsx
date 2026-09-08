import React, { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Heart,
  Lightbulb,
  MessageCircle,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatContextLevel,
  normalizeThaiContext,
} from "@/lib/thaiContext";

const RELATIONSHIP_LABELS = {
  适合: "text-emerald-300",
  谨慎: "text-yellow-200",
  不建议: "text-red-300",
  待补充: "text-white/35",
};

function ContextTag({ children, tone = "emerald" }) {
  const toneClass = tone === "gold"
    ? "border-yellow-300/20 bg-yellow-300/[0.08] text-yellow-200"
    : "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}>
      {children}
    </span>
  );
}

function ContextSection({ icon: Icon, title, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/70">
        <Icon className="h-3.5 w-3.5 text-emerald-300" />
        {title}
      </div>
      {children}
    </section>
  );
}

function ContextMeter({ label, value }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="text-white/45">{label}</span>
        <span className="font-mono text-emerald-200/80">{formatContextLevel(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-yellow-300"
          style={{ width: `${Number.isFinite(Number(value)) ? Math.max(0, Math.min(5, Number(value))) * 20 : 0}%` }}
        />
      </div>
    </div>
  );
}

export default function ThaiContextPanel({ open, onOpenChange, word }) {
  const context = useMemo(() => normalizeThaiContext(word || {}), [word]);
  const hasCuratedData = context.source === "curated" || context.source === "entry";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-white/10 bg-[#081715]/95 p-0 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl">
        <div className="relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.12] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-yellow-300/[0.08] blur-3xl" />

          <DialogHeader className="relative">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/75">
              <Sparkles className="h-3.5 w-3.5" />
              Thai Context Intelligence
            </div>
            <DialogTitle className="font-thai text-3xl font-black text-white sm:text-4xl">
              {context.thai || word?.thai_word || "泰语表达"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-white/45">
              {context.coreMeaning || "这条表达的结构化语境资料正在补充。"}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ContextTag>{hasCuratedData ? "已校订语境" : "基础词条"}</ContextTag>
              {context.contexts.map((item) => (
                <ContextTag key={item} tone="gold">{item}</ContextTag>
              ))}
              {context.emotion.map((item) => (
                <ContextTag key={item}>{item}</ContextTag>
              ))}
            </div>

            <ContextSection icon={MessageCircle} title="Native Feeling · 泰国人听起来的感觉">
              <p className="text-sm leading-6 text-white/75">
                {context.naturalMeaning || "暂无人工校订说明。"}
              </p>
              {context.literalMeaning && (
                <p className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-white/40">
                  字面感觉：{context.literalMeaning}
                </p>
              )}
            </ContextSection>

            <div className="grid gap-3 sm:grid-cols-2">
              <ContextSection icon={Users} title="Relationship · 对谁说">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {context.relationships.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-white/50">{item.label}</span>
                      <span className={`shrink-0 ${RELATIONSHIP_LABELS[item.status] || "text-white/45"}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </ContextSection>

              <ContextSection icon={Scale} title="语气位置">
                <div className="space-y-3">
                  <ContextMeter label="随意 → 正式" value={context.formality} />
                  <ContextMeter label="中性 → 礼貌" value={context.politeness} />
                  <ContextMeter label="疏离 → 亲密" value={context.intimacy} />
                </div>
              </ContextSection>
            </div>

            {context.naturalness && (
              <ContextSection icon={Heart} title="Naturalness · 自然度">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-emerald-200">
                    {context.naturalness.label || "待补充"}
                  </span>
                  <span className="text-xs text-white/45">
                    {context.naturalness.note || "暂无人工校订说明，不展示虚构百分比。"}
                  </span>
                </div>
              </ContextSection>
            )}

            {context.commonCollocations.length > 0 && (
              <ContextSection icon={BookOpen} title="常见搭配 · Learn by Context">
                <div className="flex flex-wrap gap-2">
                  {context.commonCollocations.map((item) => (
                    <span key={item} className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 font-thai text-sm text-emerald-100/80">
                      {item}
                    </span>
                  ))}
                </div>
              </ContextSection>
            )}

            {context.similarExpressions.length > 0 && (
              <ContextSection icon={ArrowRight} title="相近表达 · 不只是同义词">
                <div className="space-y-2">
                  {context.similarExpressions.map((item) => (
                    <div key={`${item.thai}-${item.difference}`} className="flex gap-3 rounded-xl bg-black/15 px-3 py-2.5">
                      <span className="shrink-0 font-thai text-sm text-yellow-200">{item.thai}</span>
                      <span className="text-xs leading-5 text-white/50">{item.difference}</span>
                    </div>
                  ))}
                </div>
              </ContextSection>
            )}

            <ContextSection icon={Lightbulb} title="Why Not Translate Literally?">
              <p className="text-sm leading-6 text-white/70">
                {context.whyNotLiteral || "暂无直译风险说明。遇到没有校订资料的词条，请结合例句和关系场景判断。"}
              </p>
              {context.avoidedUsage.length > 0 && (
                <div className="mt-3 rounded-xl border border-yellow-300/15 bg-yellow-300/[0.05] p-3 text-xs leading-5 text-yellow-100/75">
                  <strong className="font-semibold text-yellow-200">使用提醒：</strong>
                  <ul className="mt-1 space-y-1">
                    {context.avoidedUsage.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              )}
            </ContextSection>

            {context.nativeExamples.length > 0 && (
              <ContextSection icon={MessageCircle} title="Natural Example · 自然例句">
                <div className="space-y-3">
                  {context.nativeExamples.map((item, index) => (
                    <div key={`${item.thai}-${index}`}>
                      <p className="font-thai text-base leading-7 text-emerald-100/90">{item.thai}</p>
                      {item.chinese && <p className="mt-1 text-xs leading-5 text-white/40">{item.chinese}</p>}
                    </div>
                  ))}
                </div>
              </ContextSection>
            )}

            {context.culturalNotes.length > 0 && (
              <ContextSection icon={Sparkles} title="Cultural Note · 文化提示">
                <ul className="space-y-2 text-xs leading-5 text-white/55">
                  {context.culturalNotes.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </ContextSection>
            )}

            {!hasCuratedData && (
              <p className="px-1 text-[11px] leading-5 text-white/30">
                这条内容来自旧词库。ThaiAI 不会用缺失字段推断“泰国人使用率”或关系结论；完成人工校订后，该面板会自动显示更完整的语境信息。
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
