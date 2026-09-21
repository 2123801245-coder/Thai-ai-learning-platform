// src/hooks/useMentorVoice.js
//
// =========================================================
// AI Speaking Room · 语音交互编排层
// =========================================================
//
// 职责：把四个真实能力编排成一条链，全部复用现有基建：
//
//   ① 转写    /api/speaking/transcribe（经 api/aiTeacher.transcribeSpeech）
//   ② 对话    /api/ai/teacher action=conversation（结构化 JSON：泰文+拼音+
//             中文+纠错；backend 注入学习画像与教师记忆）
//   ③ 播报    lib/thaiSpeech.speakThai（三级降级，项目统一 TTS）
//   ④ 评分    /api/speaking/analyze（Azure 发音评估，word 模式有免费额度）
//
// 状态机：idle → listening → thinking → speaking → idle
// 失败一律回 idle 并给出可读原因，绝不卡死。
//
// 波形电平走 CSS 变量（--lvl），每帧写 DOM，不触发 React 渲染。

import { useCallback, useEffect, useRef, useState } from "react";

import { askAiTeacher, transcribeSpeech } from "@/api/aiTeacher";
import { createAudioRecorder } from "@/lib/audioRecorder";
import { speakThai, stopThaiAudio } from "@/lib/thaiSpeech";
import { API_BASE_URL } from "@/lib/api";

const MAX_RECORD_MS = 15000;
const THAI_RUN = /[\u0E00-\u0E7F]+/g;

const pickText = (data) =>
  String(data?.text || data?.transcript || data?.result?.text || "").trim();

/* teacher conversation 返回的结构化 JSON（后端 res.json({ success, ...parsed })，
   字段：thai/roman/chinese/vocab/grammar/culturalNote/nextStage） */
function pickConversation(data) {
  const d = data?.data || data || {};
  const thai = String(d.thai || d.reply || d.message || "").trim();
  if (!thai) return null;
  return {
    thai,
    roman: String(d.roman || "").trim(),
    chinese: String(d.chinese || d.translation || "").trim(),
    correction: String(d.correction || d.feedback || d.grammar || "").trim(),
    vocab: Array.isArray(d.vocab) ? d.vocab.slice(0, 4) : [],
  };
}

export function useMentorVoice({ meterRef, sceneId, onExchange } = {}) {
  const [phase, setPhase] = useState("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [pronunciation, setPronunciation] = useState(null);

  const recorderRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const cancelSpeakRef = useRef(null);
  const phaseRef = useRef("idle");
  const aliveRef = useRef(true);
  /* 最近一轮对话（评分时传 target_text，用户读的就是老师刚说的那句） */
  const lastThaiRef = useRef("");

  const setPhaseSafe = useCallback((next) => {
    phaseRef.current = next;
    if (aliveRef.current) setPhase(next);
  }, []);

  const paintLevel = useCallback(() => {
    const el = meterRef?.current;
    const recorder = recorderRef.current;
    if (el && recorder) {
      const level = recorder.isRecording?.() ? recorder.getLevel?.() || 0 : 0;
      el.style.setProperty("--lvl", level.toFixed(3));
    }
    rafRef.current = requestAnimationFrame(paintLevel);
  }, [meterRef]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  };

  const stopLevelLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    meterRef?.current?.style.setProperty("--lvl", "0");
  };

  const reset = useCallback(() => {
    setHeard("");
    setReply(null);
    setError("");
    setPronunciation(null);
  }, []);

  /* =====================================================
     开始说：开麦 → listening
  ===================================================== */
  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;

    setError("");
    setHeard("");
    setReply(null);
    setPronunciation(null);

    if (!recorderRef.current) recorderRef.current = createAudioRecorder();

    try {
      await recorderRef.current.start();
    } catch {
      setError("麦克风没连上（权限或设备问题），可以用文字输入继续");
      setPhaseSafe("idle");
      return;
    }

    setPhaseSafe("listening");
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paintLevel);
    stopTimer();
    timerRef.current = setTimeout(() => voiceRef.current?.stop?.(), MAX_RECORD_MS);
  }, [paintLevel, setPhaseSafe]);

  /* =====================================================
     说完：停麦 → 转写 → 老师 conversation 回应 → 播报
     → 顺手发起发音评分
  ===================================================== */
  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current !== "listening") return;

    stopTimer();
    stopLevelLoop();

    let wav = null;
    try {
      wav = recorder.stop();
    } catch {
      wav = null;
    }

    if (!wav) {
      setError("这一段没录到声音，再试一次");
      setPhaseSafe("idle");
      return;
    }

    setPhaseSafe("thinking");

    try {
      const form = new FormData();
      form.append("audio", wav, "mentor.wav");
      form.append("language", "th-TH");
      const transcribed = await transcribeSpeech(form);
      const text = pickText(transcribed?.data);
      if (aliveRef.current) setHeard(text);

      const answer = await askAiTeacher({
        message:
          text || "ผมยังพูดไม่เก่ง ช่วยแนะนำประโยคสั้น ๆ ให้หน่อยครับ",
        action: "conversation",
        scene: sceneRef.current?.meta || {},
        stage: sceneRef.current?.stage || {},
      });

      const conv = pickConversation(answer?.data);
      if (!conv) {
        setPhaseSafe("idle");
        return;
      }
      if (aliveRef.current) setReply(conv);
      lastThaiRef.current = conv.thai;
      onExchange?.({ heard: text, reply: conv });

      setPhaseSafe("speaking");
      const thaiRun = conv.thai.match(THAI_RUN)?.join(" ") || conv.thai;
      cancelSpeakRef.current = speakThai(thaiRun, {
        rate: 0.78,
        onEnd: () => setPhaseSafe("idle"),
        onError: () => setPhaseSafe("idle"),
      });
    } catch (e) {
      const status = e?.response?.status;
      setError(
        status === 401
          ? "登录后老师才听得到你说话"
          : status === 429
            ? "今天的对话额度用完了，明天再来"
            : "没能把这段音频送出去，再试一次"
      );
      setPhaseSafe("idle");
    }
  }, [onExchange, sceneId, setPhaseSafe]);

  const voiceRef = useRef(null);
  voiceRef.current = { start, stop };

  /* 场景参数走 ref：start/stop 的 useCallback 依赖链不随场景切换重建 */
  const sceneRef = useRef({ meta: {}, stage: {} });
  sceneRef.current = { meta: sceneId ? { id: sceneId } : {}, stage: {} };

  /* 卸载清理：麦克风、计时器、TTS 全部收干净 */
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopTimer();
      stopLevelLoop();
      try {
        recorderRef.current?.stop?.();
      } catch {
        /* 已停 */
      }
      cancelSpeakRef.current?.();
      stopThaiAudio();
    };
  }, []);

  /* =====================================================
     发音评分：对「老师刚说的那句」录音并打分
     （word 模式有免费额度；失败静默——评分是加分项不是阻塞项）
  ===================================================== */
  const assessPronunciation = useCallback(async () => {
    const target = lastThaiRef.current;
    if (!target || phaseRef.current !== "idle") return;

    setAnalyzing(true);
    setPronunciation(null);

    const rec = createAudioRecorder();
    try {
      await rec.start();
      /* 录 4 秒固定窗口（读一句话足够），期间保持 listening 视觉 */
      setPhaseSafe("listening");
      await new Promise((r) => setTimeout(r, 4000));
      const wav = rec.stop();
      setPhaseSafe("thinking");

      if (!wav) throw new Error("no-audio");

      const form = new FormData();
      form.append("audio", wav, "assess.wav");
      form.append("target_text", target);
      form.append("mode", "word");
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/speaking/analyze`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(`http-${res.status}`);
      const data = await res.json();

      if (data?.source === "azure" && aliveRef.current) {
        setPronunciation({
          score: data.score ?? data.accuracy ?? 0,
          accuracy: Math.round(data.accuracy ?? data.score ?? 0),
          tone: data.tone ?? null,
          words: Array.isArray(data.words) ? data.words.slice(0, 6) : [],
        });
      } else {
        setError("发音评估服务这会儿不可用，稍后再试");
      }
      setPhaseSafe("idle");
    } catch {
      if (aliveRef.current) {
        setError("发音评估没成功（网络或额度问题），对话不受影响");
        setPhaseSafe("idle");
      }
    } finally {
      setAnalyzing(false);
    }
  }, [setPhaseSafe]);

  return {
    phase,
    heard,
    reply,
    error,
    analyzing,
    pronunciation,
    start,
    stop,
    reset,
    assessPronunciation,
  };
}

export default useMentorVoice;
