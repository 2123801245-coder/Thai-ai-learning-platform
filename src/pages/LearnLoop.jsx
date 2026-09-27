import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  BookOpen,
  Grid3X3,
  Type,
  Braces,
  Play,
  Volume2,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  Target,
  Flame,
  Trophy,
  Loader2,
  CircleCheck,
  CircleX,
  ListChecks,
} from "lucide-react";
import {
  getAiTeacherRecommendation,
  getTodayLesson,
  saveTodayLesson,
  patchTodayLessonProgress,
} from "@/api/aiTeacher";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import {
  getSavedBookId,
  saveBookId,
  getVocabBooks,
  generateFillQuestions,
  fetchWrongBook,
} from "@/lib/wordBooks";
import { applyProfileDefaults } from "@/lib/profileDriven";
import { saveCustomLesson, clearCustomLesson, loadCustomLesson } from "@/lib/customLesson";
import { useUserProfile } from "@/lib/userProfile";
import { speakThaiWithLocal } from "@/lib/thaiSpeech";
import { useToast } from "@/components/ui/use-toast";

const STAGE = [
  { key: "learn", label: "学", en: "Learn", icon: BookOpen, desc: "AI 定制新课" },
  { key: "drill", label: "练", en: "Drill", icon: Grid3X3, desc: "词书开练" },
  { key: "quiz", label: "测", en: "Quiz", icon: ListChecks, desc: "今日小测" },
  { key: "review", label: "复习", en: "Review", icon: RefreshCw, desc: "到期复习" },
];

const SESSION_KEY = "thai_ai_learn_loop_today";

function wordId(w) {
  return (
    (w && (w.id || w._id || w.thai_word || w.thai)) || null
  );
}

export default function LearnLoop() {
  const navigate = useNavigate();
  const toast = useToast();
  const { progress, loading, recordKnown, recordUnknown, recordReviewKnown, recordReviewUnknown, reload } =
    useLearningProgress();

  const [session, setSession] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
      if (raw.date === today) return raw;
    } catch (e) {}
    return { date: new Date().toISOString().split("T")[0], learn: false, drill: false, quiz: false, review: false };
  });
  const mark = (key) => {
    setSession((prev) => {
      const next = { ...prev, [key]: true };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  // 词书
  const [bookId, setBookId] = useState(() => getSavedBookId() || "");
  const books = useMemo(() => getVocabBooks(), []);
  const bookWords = useMemo(() => {
    const b = books.find((x) => x.id === bookId) || books[0];
    return b ? b.words : [];
  }, [books, bookId]);

  /* 画像 → 默认词书：等级变化（或首次做完入学测试）时自动切换，
     用户自己选过且等级没变则保持不动，避免覆盖手选 */
  const { profile } = useUserProfile();
  const [bookNote, setBookNote] = useState("");

  useEffect(() => {
    const applied = applyProfileDefaults(profile, { books });
    if (!applied?.changed) return;

    setBookId(applied.id);
    setBookNote(
      applied.replaced
        ? `已按 ${profile.thaiLevel} 等级把默认词书换成「${applied.emoji} ${applied.name}」`
        : `已按 ${profile.thaiLevel} 等级设置默认词书「${applied.emoji} ${applied.name}」`
    );
  }, [profile, books]);

  // AI 推荐（学）
  const [rec, setRec] = useState(null);
  const [recommending, setRecommending] = useState(false);
  const [recError, setRecError] = useState("");
  /* 「接着上次练」恢复包（服务端存档，刷新/换设备后仍在）*/
  const [todaySaved, setTodaySaved] = useState(null);
  const [resuming, setResuming] = useState(false);

  const buildProfile = useCallback(() => {
    try {
      const user = JSON.parse(localStorage.getItem("thaiai_user") || "{}");
      const prog = JSON.parse(localStorage.getItem("thai_ai_learning_progress") || "{}");
      return {
        name: user.nickname || (user.email || "").split("@")[0] || "",
        level: prog.level_name || "",
        streak: prog.learning_streak || 0,
        mastered: prog.total_vocabulary || 0,
      };
    } catch (e) {
      return {};
    }
  }, []);

  const handleRecommend = useCallback(async () => {
    if (recommending) return;
    setRec(null);
    setRecError("");
    /* 换了主题= 上一节课作废：别让对话室还拿着旧课交接；
       服务端存档也一起作废（先本地清，接口慢慢同步） */
    clearCustomLesson();
    saveTodayLesson(null).catch(() => {});
    setRecommending(true);
    try {
      const res = await getAiTeacherRecommendation(buildProfile());
      setRec(res?.data?.recommend || null);
      if (!res?.data?.recommend) setRecError("暂时无法生成推荐，请稍后再试");
    } catch (err) {
      setRecError(err?.response?.data?.message || "推荐生成失败，请稍后再试");
    } finally {
      setRecommending(false);
    }
  }, [recommending, buildProfile]);

  /* 首次挂载：先问服务端今天有没有课 —— 有 → 出「接着上次练」恢复包（不自动生成新课，
     否则 handleRecommend 会把服务端存档清掉，恢复永远出不来）；
     没有 → 照旧自动定制新课。用户点「学一节新课」直接走 handleRecommend。 */
  useEffect(() => {
    if (loading) return;
    if (session.learn || loadCustomLesson()) return; // 本地已学/已交接，不拉恢复也不重复生成
    let alive = true;
    getTodayLesson()
      .then((res) => {
        const saved = res?.data?.data || null;
        if (!alive) return;
        if (saved?.lesson) {
          setTodaySaved(saved);
        } else {
          handleRecommend();
        }
      })
      .catch(() => {
        /* 服务端不可达（未登录/断网）：照旧自动生成，sessionStorage 交接不受影响 */
        if (alive) handleRecommend();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /* 「去 AI 老师练这节课」：把这节课交给对话室（sessionStorage），
     老师会拿到主题 / 例句 / 生词，接着这节课开口，而不是从零寒暄；
     同一节课落库到服务端，刷新/换设备后回访还能接着练 */
  const goLesson = () => {
    const lesson = saveCustomLesson(rec);
    if (lesson) {
      saveTodayLesson(lesson).catch(() => {});
    }
    mark("learn");
    navigate("/conversation?lesson=1");
  };

  /* 「这节课的词先去配对」：与 ② 练 板块同一个落点，也就同样记「已练」 */
  const goDrill = () => {
    mark("drill");
    navigate("/vocabulary?mode=match");
  };

  // 测（今日小测）
  const [quiz, setQuiz] = useState(null); // { questions, idx, answers[], done }
  useEffect(() => {
    if (quiz || session.quiz) return;
    let alive = true;
    (async () => {
      let wrong = null;
      try { wrong = await fetchWrongBook(); } catch (e) {}
      const pool = wrong?.words?.length ? wrong.words : bookWords.slice();
      const filler = generateFillQuestions({ words: pool }, 8);
      if (alive && filler.length) {
        setQuiz({ questions: filler, idx: 0, answers: [], done: false });
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookWords.length, session.quiz]);

  const answerQuiz = (correct) => {
    const q = quiz.questions[quiz.idx];
    const word = { id: q.blank, thai_word: q.blank, thai: q.blank, chinese: q.hint };
    if (correct) recordKnown(word);
    else recordUnknown(word);
    const answers = [...quiz.answers, correct];
    const nextIdx = quiz.idx + 1;
    if (nextIdx >= quiz.questions.length) {
      setQuiz({ ...quiz, answers, done: true });
      mark("quiz");
      reload();
    } else {
      setQuiz({ ...quiz, answers, idx: nextIdx });
    }
  };

  // 复习（到期复习，快速抽查）
  const [review, setReview] = useState(null); // { words, idx, revealed, knownCount, written }
  useEffect(() => {
    if (review || session.review) return;
    (async () => {
      let wrong = null;
      try { wrong = await fetchWrongBook(); } catch (e) {}
      const due = progress?.review_queue?.length ? progress.review_queue.slice(-10) : [];
      const source = wrong?.words?.length ? wrong.words : bookWords.slice();
      const pool = due.map((w) => ({ id: w.id, thai: w.id || "", chinese: w.chinese || "", roman: w.roman || "" }))
        .filter((w) => w.thai && w.chinese);
      const words = pool.length ? pool : source.slice(0, 6);
      if (words.length) setReview({ words, idx: 0, revealed: false, known: 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.review_queue?.length, bookWords.length, session.review]);

  const reviewAnswer = (known) => {
    const w = review.words[review.idx];
    const word = { id: w.id || w.thai, thai_word: w.thai, thai: w.thai, chinese: w.chinese, roman: w.roman };
    if (known) recordReviewKnown(word);
    else recordReviewUnknown(word);
    const knownCount = review.known + (known ? 1 : 0);
    const nextIdx = review.idx + 1;
    if (nextIdx >= review.words.length) {
      setReview({ ...review, idx: review.idx, revealed: false, known: knownCount, written: true });
      mark("review");
      reload();
    } else {
      setReview({ ...review, idx: nextIdx, revealed: false, known: knownCount });
    }
  };

  const speak = (t) => t && speakThaiWithLocal(t, { rate: 0.8 });

  const pct = Math.round((progress?.dailyProgress || 0) * 100);
  const correctQuiz = quiz?.answers.filter(Boolean).length ?? 0;

  if (loading) {
    return (
      <div className="page-enter mx-auto max-w-5xl px-4 py-24 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300/60" />
        <p className="mt-4 text-sm text-white/50">正在加载学习进度…</p>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-3 sm:px-0">
      {/* 顶部总览 */}
      <div className="premium-glass-strong rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-emerald-300/70">
              <Sparkles className="h-4 w-4" /> 今日学习闭环
            </div>
            <h1 className="mt-2 font-thai-serif text-3xl font-bold text-white">
            เรียน→ฝึก→ทดสอบ→ทบทวน<span className="text-emerald-300/70"> · 学练测复习</span>
            </h1>
            <p className="mt-1 text-sm text-white/40">
              今天完成一整套动作，泰语稳步进阶。
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className="flex items-center gap-1 text-2xl font-bold text-orange-300">
                <Flame className="h-5 w-5" /> {progress?.learning_streak || 0}
              </div>
              <div className="text-[10px] text-white/40">连续天</div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 text-2xl font-bold text-yellow-300">
                <Trophy className="h-5 w-5" /> {progress?.xp || 0}
              </div>
              <div className="text-[10px] text-white/40">XP · Lv.{progress?.level || 1}</div>
            </div>
            {/* 今日目标环 */}
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="url(#lg)"
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                />
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#e3b23c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-white">{pct}%</span>
                <span className="text-[8px] text-white/40">今日目标</span>
              </div>
            </div>
          </div>
        </div>

        {/* 阶段条 */}
        <div className="mt-6 grid grid-cols-4 gap-2">
          {STAGE.map((s, i) => {
            const Icon = s.icon;
            const done = session[s.key];
            const goTo = () => document.getElementById(`stage-${s.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            return (
              <button
                key={s.key}
                type="button"
                onClick={goTo}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                  done
                    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:border-emerald-300/25 hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {done && (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] text-black">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold">{s.label} · {s.en}</span>
                <span className="text-[8px] opacity-60">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ①　学：AI 定制新课 */}
      <section id="stage-learn" className="premium-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <BookOpen className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-white/90">①　学 · AI 定制新课</h2>
            {session.learn && <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-200">已学</span>}
          </div>
          <button
            type="button"
            onClick={handleRecommend}
            disabled={recommending}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 换个主题
          </button>
        </div>

        {recommending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-white/45">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> 正在根据你的画像定制专属课程…
          </div>
        ) : rec ? (
          <div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
              <div className="text-[10px] tracking-[0.18em] text-emerald-300/60">推荐主题</div>
              <div className="font-thai-serif text-lg font-semibold text-white">{rec.topic}</div>
              {rec.goal && <p className="mt-1 text-sm text-white/55">{rec.goal}</p>}
              {rec.tip && <p className="mt-2 text-xs text-emerald-200/60">{rec.tip}</p>}
              {Array.isArray(rec.vocab) && rec.vocab.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rec.vocab.slice(0, 6).map((v, i) => (
                    <span key={i} title={v?.cn || v?.meaning || ""} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70">
                      {v?.th || v?.thai}
                      {v?.roman && <span className="text-emerald-200/60">{v.roman}</span>}
                      <button type="button" onClick={() => speak(v?.th || v?.thai)} className="text-white/40 hover:text-emerald-200"><Volume2 className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 这节课不只是一个标题：例句与随堂练习都摊开，
                学生在这里就能先把课上完，再去和老师开口 */}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {Array.isArray(rec.sentences) && rec.sentences.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] tracking-[0.18em] text-emerald-300/60">跟读这 {Math.min(rec.sentences.length, 4)} 句</span>
                    <span className="text-[10px] text-white/30">点句子听发音</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {rec.sentences.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => speak(s?.th)}
                        className="block w-full rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.06]"
                      >
                        <span className="font-thai-serif text-sm leading-6 text-white/90">{s?.th}</span>
                        {s?.roman && <span className="ml-2 text-[10px] italic text-emerald-200/50">{s.roman}</span>}
                        {s?.cn && <span className="mt-0.5 block text-[11px] text-white/45">{s.cn}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(rec.exercise) && rec.exercise.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] tracking-[0.18em] text-emerald-300/60">随堂练习 {Math.min(rec.exercise.length, 3)} 题</span>
                    <span className="text-[10px] text-white/30">先自己做，再点开答案</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {rec.exercise.slice(0, 3).map((item, i) => (
                      <ExerciseItem key={i} item={item} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 学完不是结束：接下来去哪儿，两处都写清楚 */}
            <div className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-3">
              <div className="text-[10px] tracking-[0.18em] text-emerald-300/60">学完接着做什么</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={goLesson}
                  className="group flex items-start gap-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-3 text-left text-black transition hover:opacity-90"
                >
                  <Play className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      去 AI 老师练这节课 <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-black/60">
                      老师已拿到主题、例句和生词，会用它们带你开口
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={goDrill}
                  className="group flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.08]"
                >
                  <Grid3X3 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium text-white/85">
                      这节课的词先去配对 <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-white/40">
                      打开词汇配对练习（泰语 ↔ 中文速配）
                    </span>
                  </span>
                </button>
              </div>
              {rec.nextTopic && (
                <p className="mt-2 text-[11px] leading-5 text-white/35">
                  下一课方向：{rec.nextTopic}
                  <span className="ml-1 text-white/25">（想换个主题就点右上「换个主题」）</span>
                </p>
              )}
            </div>
          </div>
        ) : todaySaved ? (
          /* 服务端有今天的课（刷新 / 换设备回来的回访入口） */
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
            <div className="text-[10px] tracking-[0.18em] text-emerald-300/60">今天已有一节课</div>
            <div className="mt-1 font-thai-serif text-base font-semibold text-white">{todaySaved.lesson.topic}</div>
            {todaySaved.lesson.goal && <p className="mt-0.5 text-xs text-white/45">{todaySaved.lesson.goal}</p>}
            {/* 再定制失败时错误要说出来，不能静默停在这个块上 */}
            {recError && <p className="mt-2 text-[11px] text-yellow-200/70">{recError}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setResuming(true);
                  saveCustomLesson(todaySaved.lesson);
                  mark("learn");
                  navigate("/conversation?lesson=1");
                }}
                disabled={resuming}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {resuming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                接着上次练
              </button>
              <span className="text-[11px] text-white/35">
                已练 {todaySaved.doneCount || 0}/{todaySaved.lesson.sentences?.length || 0} 句
              </span>
              <button
                type="button"
                onClick={handleRecommend}
                disabled={recommending}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
              >
                {recommending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} 学一节新课
              </button>
            </div>
          </div>
        ) : session.learn ? (
          /* 今天已经学过一节：不能说「正在准备推荐…」把学生晾在转圈里，
             要告诉他这一节算数，以及接着该去哪（练 / 测，或再定制一节） */
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
            <div className="text-[10px] tracking-[0.18em] text-emerald-300/60">今天这一节已经学过</div>
            <p className="mt-1 text-sm leading-6 text-white/55">
              今天的定制课已记为「已学」。想再来一节就重新定制；不然就接着往下走闭环。
            </p>
            {/* 重新定制失败时错误要说出来，不能静默停在这个块上 */}
            {recError && <p className="mt-2 text-[11px] leading-5 text-yellow-200/70">{recError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRecommend}
                disabled={recommending}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> 再定制一节新课
              </button>
              <button
                type="button"
                onClick={goDrill}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/[0.1] px-3.5 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-400/[0.18]"
              >
                <Grid3X3 className="h-3.5 w-3.5" /> 接着练词汇 <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("stage-quiz")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              >
                <ListChecks className="h-3.5 w-3.5" /> 接着做今日小测
              </button>
            </div>
          </div>
        ) : (
          <div className="py-5 text-sm text-white/45">
            {recError ? (
              <span className="text-yellow-200/70">{recError}</span>
            ) : (
              <span>正在准备你的专属推荐…</span>
            )}
          </div>
        )}
      </section>

      {/* ②　练：词书开练 */}
      <section id="stage-drill" className="premium-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <Grid3X3 className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-white/90">②　练 · 词书开练</h2>
          {session.drill && <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-200">已练</span>}
        </div>

        <label className="mb-2 block text-xs text-white/40">当前词书</label>
        <select
          value={bookId}
          onChange={(e) => { setBookId(e.target.value); saveBookId(e.target.value); }}
          className="mb-4 w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/40"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id} className="bg-[#061513]">{b.emoji} {b.name}（{b.count} 词）</option>
          ))}
        </select>

        {bookNote && (
          <div className="mb-4 -mt-2 flex items-start gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2 text-[11px] leading-5 text-emerald-200/80">
            <span className="mt-0.5">🎯</span>
            <span className="min-w-0 flex-1">
              {bookNote}
              <span className="ml-1 text-emerald-200/40">（可在上方自行换回）</span>
            </span>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { to: "/vocabulary?mode=match", label: "词汇配对", icon: Grid3X3, desc: "泰 ↔ 中速配" },
            { to: "/vocabulary?mode=fill", label: "句子填空", icon: Type, desc: "选词填空" },
            { to: "/vocabulary?mode=segment", label: "分词练习", icon: Braces, desc: "句子里拆词" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.to}
                type="button"
                onClick={() => { mark("drill"); navigate(m.to); }}
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-left transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.08]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-emerald-300 transition group-hover:bg-emerald-400/15">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white/85">{m.label}</span>
                  <span className="block text-[11px] text-white/35">{m.desc}</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 text-white/25 group-hover:text-emerald-200" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ③　测：今日小测 */}
      <section id="stage-quiz" className="premium-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <ListChecks className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-white/90">③　测 · 今日小测</h2>
          {session.quiz && <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-200">✓ {correctQuiz}/{quiz?.questions?.length ?? 0}</span>}
        </div>

        {quiz?.done ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-5 text-center">
            <div className={`text-2xl font-bold ${correctQuiz >= Math.ceil((quiz.questions.length || 1) / 2) ? "text-emerald-300" : "text-yellow-300"}`}>
              {correctQuiz} / {quiz.questions.length}
            </div>
            <p className="mt-1 text-sm text-white/55">今日小测完成，答对已计入今日新词与 XP，答错的词已记入生词本。</p>
            <button
              type="button"
              onClick={() => { navigate("/wrong-notebook"); }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs text-white/80 transition hover:bg-white/[0.12]"
            >
              去生词本巩固 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : quiz ? (
          <div>
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>第 {quiz.idx + 1} / {quiz.questions.length} 题</span>
              <span>已对 {quiz.answers.filter(Boolean).length} / 已错 {quiz.answers.filter((a) => !a).length}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${((quiz.idx) / quiz.questions.length) * 100}%` }} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="font-thai-serif text-lg leading-8 text-white/90">{quiz.questions[quiz.idx].sentence}</div>
              <div className="mt-2 text-xs text-emerald-200/60">提示：{quiz.questions[quiz.idx].hint}</div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {quiz.questions[quiz.idx].options.map((opt, i) => {
                const q = quiz.questions[quiz.idx];
                const answered = quiz.answers.length > quiz.idx; // 已答则禁用（防连点）——此处不会发生，正常流程点一次即推进
                const isCorrect = opt === q.blank;
                return (
                  <button key={i} type="button" onClick={() => answerQuiz(isCorrect)} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white/85 transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.1]" disabled={answered}>
                    <span className="font-thai-serif">{opt}</span>
                    {isCorrect ? <Check className="h-4 w-4 text-emerald-300" /> : <X className="h-4 w-4 text-white/20" />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-5 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> 正在为你出题…
          </div>
        )}
      </section>

      {/* ④　复习：到期复习 */}
      <section id="stage-review" className="premium-glass rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <RefreshCw className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-white/90">④　复习 · 到期复习</h2>
          {session.review && <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-200">✓ 已复习</span>}
        </div>

        {review?.written ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-5 text-center">
            <div className="text-2xl font-bold text-emerald-300">✓ 完成</div>
            <p className="mt-1 text-sm text-white/55">本次复习 {review.words.length} 词，认识 {review.known} 个；答对的计入复习 XP，生词继续留在生词本。</p>
            <button type="button" onClick={() => { navigate("/wrong-notebook"); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs text-white/80 transition hover:bg-white/[0.12]">
              去错题本 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : review ? (
          <div>
            <div className="text-xs text-white/40">第 {review.idx + 1} / {review.words.length} 词 · {reviewWordsShort(review)}</div>
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center">
              <button type="button" onClick={() => speakTh(review)} className="inline-flex items-center gap-1 text-xs text-emerald-200/70 hover:text-emerald-100">
                <Volume2 className="h-4 w-4" /> {review.words[review.idx].thai}
              </button>
              {review.revealed ? (
                <div className="mt-2">
                  <div className="text-sm italic text-emerald-200/80">{review.words[review.idx].roman}</div>
                  <div className="text-base font-medium text-white/90">{review.words[review.idx].chinese}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-white/40">点击上方泰语词听发音，想好释义点「知道了」</div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setReview({ ...review, revealed: true })} className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs text-white/70 transition hover:bg-white/[0.12]">
                显示释义
              </button>
              {review.revealed && (
                <>
                  <button type="button" onClick={() => reviewAnswer(true)} className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90">
                    <CircleCheck className="h-3.5 w-3.5" /> 认识
                  </button>
                  <button type="button" onClick={() => reviewAnswer(false)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.14]">
                    <CircleX className="h-3.5 w-3.5" /> 不认识
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-5 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> 正在准备复习队列…
          </div>
        )}
      </section>
    </div>
  );
}

/* 随堂练习单题：参考答案默认收起 —— 先自己答一遍再对答案，
   否则练习沦为阅读；老师没给答案时也不撒谎 */
function ExerciseItem({ item, index }) {
  const [open, setOpen] = useState(false);
  const question = item?.question || "";
  if (!question) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[9px] font-bold text-emerald-200">
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 text-xs leading-5 text-white/75">{question}</p>
      </div>
      {item?.hint && !open && (
        <p className="mt-1 pl-6 text-[10px] leading-4 text-white/30">提示：{item.hint}</p>
      )}
      {open ? (
        <p className="mt-1.5 pl-6 font-thai-serif text-sm leading-6 text-emerald-100">
          {item?.answer || "（这道题老师没给参考答案）"}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 pl-6 text-[10px] font-semibold text-emerald-200/60 transition hover:text-emerald-100"
        >
          看参考答案
        </button>
      )}
    </div>
  );
}

// 辅助：复习词条短显示
function reviewWordsShort(review) {
  return review && review.words ? `${review.known}/${review.idx} 已对` : "";
}

// React 事件里用闭包：speakTh 读当前词
function speakTh(review) {
  const w = review?.words?.[review.idx];
  if (w?.thai) speakThaiWithLocal(w.thai, { rate: 0.8 });
}
