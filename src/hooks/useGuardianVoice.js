// src/hooks/useGuardianVoice.js
//
// =========================================================
// 首页守护者 · 与老师说话（真实链路，不是动画）
// =========================================================
//
// 三个状态全部由真实事件驱动，没有一个是假的：
//
//   listening  麦克风真的开着（audioRecorder 的 AnalyserNode 给出真实电平，
//              波形条读的就是这个值）
//   thinking   真的在等两个请求：/speaking/transcribe（Azure 转写）
//              → /ai/teacher（action=speaking，老师回应）
//   speaking   浏览器真的在读老师的泰语回复
//
// 失败路径一律回到 idle 并把原因说出来（麦克风没权限 / 转写失败 / 网络），
// 不留下「按钮转圈但永远不会结束」的状态。
//
// 转写用项目已有的 16kHz mono WAV 录音器（Azure 要的格式），不是随便录一段。

import { useCallback, useEffect, useRef, useState } from "react";

import { askAiTeacher, transcribeSpeech } from "@/api/aiTeacher";
import { createAudioRecorder } from "@/lib/audioRecorder";
import { speakThai } from "@/lib/thaiSpeech";

/* 单次最长录音：忘了松手也不会一直录下去 */
const MAX_RECORD_MS = 15000;

/* 泰文片段（回复里可能中泰混排，只读泰文那部分） */
const THAI_RUN = /[\u0E00-\u0E7F]+/g;

const pickText = (data) =>
  String(
    data?.text ||
      data?.transcript ||
      data?.result?.text ||
      ""
  ).trim();

const pickReply = (data) =>
  String(
    data?.reply ||
      data?.message ||
      data?.content ||
      data?.data?.reply ||
      ""
  ).trim();

export function useGuardianVoice({ meterRef } = {}) {
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | speaking
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const cancelSpeakRef = useRef(null);
  const phaseRef = useRef("idle");
  const aliveRef = useRef(true);

  const setPhaseSafe = useCallback((next) => {
    phaseRef.current = next;
    if (aliveRef.current) setPhase(next);
  }, []);

  /* 电平 → CSS 变量（不触发 React 重渲染，声波是每帧画的） */
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

  /* =====================================================
     开始说：开麦 → listening
  ===================================================== */

  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;

    setError("");
    setHeard("");
    setReply("");

    if (!recorderRef.current) {
      recorderRef.current = createAudioRecorder();
    }

    try {
      await recorderRef.current.start();
    } catch (e) {
      setError("麦克风没连上（权限或设备问题），也可以用文字和老师聊");
      setPhaseSafe("idle");
      return;
    }

    setPhaseSafe("listening");
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paintLevel);

    stopTimer();
    timerRef.current = setTimeout(() => {
      voiceRef.current?.stop?.();
    }, MAX_RECORD_MS);
  }, [paintLevel, setPhaseSafe]);

  /* =====================================================
     说完：停麦 → 转写 → 老师回应 → 读出来
  ===================================================== */

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;

    if (!recorder || phaseRef.current !== "listening") return;

    stopTimer();
    stopLevelLoop();

    let wav = null;
    try {
      wav = recorder.stop();
    } catch (e) {
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
      form.append("audio", wav, "guardian.wav");
      form.append("language", "th-TH");

      const transcribed = await transcribeSpeech(form);
      const text = pickText(transcribed?.data);

      if (aliveRef.current) setHeard(text);

      const answer = await askAiTeacher({
        message:
          text || "ผมยังพูดไม่เก่ง ช่วยแนะนำประโยคสั้น ๆ ให้หน่อยครับ",
        action: "speaking",
      });

      const said = pickReply(answer?.data);

      if (aliveRef.current) setReply(said);

      if (!said) {
        setPhaseSafe("idle");
        return;
      }

      setPhaseSafe("speaking");

      const thaiRun = said.match(THAI_RUN)?.join(" ") || "";
      const speakText = thaiRun || said;

      cancelSpeakRef.current = speakThai(speakText, {
        rate: 0.82,
        onEnd: () => setPhaseSafe("idle"),
        onError: () => setPhaseSafe("idle"),
      });
    } catch (e) {
      const status = e?.response?.status;
      setError(
        status === 401
          ? "登录后老师才听得到你说话"
          : status === 429
            ? "今天的额度用完了，明天再来"
            : "没能把这段音频送出去，再试一次"
      );
      setPhaseSafe("idle");
    }
  }, [setPhaseSafe]);

  const voiceRef = useRef(null);
  voiceRef.current = { start, stop };

  /* 卸载：全部收干净（麦克风绝不能留在开着） */
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopTimer();
      stopLevelLoop();
      cancelSpeakRef.current?.();
      try {
        recorderRef.current?.stop?.();
      } catch (e) {
        // ignore
      }
      recorderRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setError("");
    setHeard("");
    setReply("");
  }, []);

  return { phase, heard, reply, error, start, stop, reset };
}

export default useGuardianVoice;
