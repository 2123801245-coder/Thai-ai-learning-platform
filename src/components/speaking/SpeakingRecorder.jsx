
import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { speakThai, stopThaiAudio } from "@/lib/thaiSpeech";
import { createAudioRecorder } from "@/lib/audioRecorder";
import { API_BASE_URL } from "@/lib/api";

export default function SpeakingRecorder({
  words = [],
  mode = "word",
  onVipRequired,
  onResult,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  /* 后端 Azure 专业评测是否就绪（启动时探测一次） */
  const [azureReady, setAzureReady] = useState(false);

  /* 纯录音模式：浏览器识别不可用时，直接采集 WAV 走 Azure 评测 */
  const [recorderOnly, setRecorderOnly] = useState(false);

  /* 单词模式每日免费额度（非 VIP） */
  const [quota, setQuota] = useState(null);

  const recognitionRef = useRef(null);
  const finalTextRef = useRef("");
  const currentTargetRef = useRef("");
  const startTimeRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderOnlyRef = useRef(false);

  /* 评分上报：Azure 专业评分优先，本地估算延迟上报（1.5s 内 Azure 未到才用） */
  const azureReportedRef = useRef(false);
  const reportTimerRef = useRef(null);

  const reportScore = (payload) => {
    if (typeof onResult !== "function") return;
    onResult(payload);
  };

  const cancelPendingReport = () => {
    clearTimeout(reportTimerRef.current);
    reportTimerRef.current = null;
  };

  const current = words[currentIndex];

  /* =========================================================
     浏览器语音识别支持
  ========================================================= */

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition ||
        window.webkitSpeechRecognition
      : null;

  /* =========================================================
     探测后端 Azure 专业评测状态
  ========================================================= */

  useEffect(() => {
    let alive = true;

    fetch(`${API_BASE_URL}/speaking/health`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.azureConfigured) {
          setAzureReady(true);
        }
      })
      .catch(() => {
        /* 后端不可达时保持本地模式 */
      });

    return () => {
      alive = false;
    };
  }, []);

  /* =========================================================
     加载单词模式每日免费额度（非 VIP 显示剩余次数）
  ========================================================= */

  useEffect(() => {
    let alive = true;

    fetch(`${API_BASE_URL}/speaking/quota`, {
      headers: localStorage.getItem("token")
        ? {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }
        : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setQuota(d);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  /* =========================================================
     初始化 / 清理
  ========================================================= */

  useEffect(() => {
    return () => {
      cancelPendingReport();

      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }

      try {
        recorderRef.current?.stop();
      } catch (e) {
        // ignore
      }

      recorderRef.current = null;

      recorderOnlyRef.current = false;

      stopThaiAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     泰语标准发音
  ========================================================= */

  const speak = (text) => {
    if (!text) return;
    speakThai(text, { rate: 0.72 });
  };

  /* =========================================================
     当前单词自动播放
  ========================================================= */

  useEffect(() => {
    if (!current?.thai_word) return;

    const timer = setTimeout(() => {
      speak(current.thai_word);
    }, 450);

    return () => {
      clearTimeout(timer);
      stopThaiAudio();
    };
  }, [currentIndex]);

  /* =========================================================
     清理文本
  ========================================================= */

  const normalizeThai = (text = "") => {
    return text
      .normalize("NFC")
      .replace(/[.,!?;:"'“”‘’()[\]{}<>]/g, "")
      .replace(/\s+/g, "")
      .trim();
  };

  /* =========================================================
     计算本地发音匹配分数
     
     注意：
     浏览器 Speech Recognition 给我们的是“识别文字”，
     它不是专业声学发音评分。
     
     所以这里主要判断：
     
     目标：
     กิน
     
     用户：
     กิน
     
     → 高分
     
     用户：
     กา
     
     → 低分
  ========================================================= */

  const calculateScore = (target, spoken) => {
    const targetText = normalizeThai(target);
    const spokenText = normalizeThai(spoken);

    if (!targetText || !spokenText) {
      return 0;
    }

    if (targetText === spokenText) {
      return 100;
    }

    /* 完全包含 */

    if (
      spokenText.includes(targetText) ||
      targetText.includes(spokenText)
    ) {
      const ratio =
        Math.min(
          targetText.length,
          spokenText.length
        ) /
        Math.max(
          targetText.length,
          spokenText.length
        );

      return Math.round(75 + ratio * 20);
    }

    /* 字符级相似度 */

    const a = [...targetText];
    const b = [...spokenText];

    const matrix = Array.from(
      { length: a.length + 1 },
      () => Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) {
      matrix[i][0] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost =
          a[i - 1] === b[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance =
      matrix[a.length][b.length];

    const maxLength =
      Math.max(a.length, b.length);

    const similarity =
      1 - distance / maxLength;

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(similarity * 100)
      )
    );
  };

  /* =========================================================
     完整度：目标词被读出的字符比例
  ========================================================= */

  const calculateCompleteness = (
    target,
    spoken
  ) => {
    const t = normalizeThai(target);
    const s = normalizeThai(spoken);

    if (!t || !s) return 0;

    let matched = 0;

    for (const ch of t) {
      if (s.includes(ch)) matched++;
    }

    return Math.round((matched / t.length) * 100);
  };

  /* =========================================================
     流利度：按录音时长估算

     泰语单词平均每字符约 300ms（含音节停顿），
     加上首尾缓冲 900ms 得到“理想时长”。

     - 实际时长 ≈ 理想时长 → 语速自然，高分
     - 读得太快 → 适当扣分（可能吞音）
     - 读得太慢 → 多扣分（卡顿、犹豫）

     纯本地估算（无专业声学分析时的近似值）。
  ========================================================= */

  const calculateFluency = (
    target,
    elapsedMs
  ) => {
    const chars = normalizeThai(target).length;

    if (!chars || !elapsedMs || elapsedMs <= 0) {
      return 0;
    }

    const expectedMs = chars * 300 + 900;
    const ratio = expectedMs / elapsedMs;

    let score;

    if (ratio >= 1) {
      /* 读得快：最多扣 40 分 */
      score = 100 - Math.min(40, (ratio - 1) * 60);
    } else {
      /* 读得慢（卡顿）：最多扣 70 分 */
      score = 100 - Math.min(70, (1 - ratio) * 90);
    }

    return Math.max(30, Math.min(100, Math.round(score)));
  };

  /* =========================================================
     逐字对比（LCS）：找出漏读 / 多读的泰文字符
  ========================================================= */

  const diffThai = (target, spoken) => {
    const t = [...normalizeThai(target)];
    const s = [...normalizeThai(spoken)];

    const m = t.length;
    const n = s.length;

    /* 自底向上求 LCS 长度表 */

    const dp = Array.from(
      { length: m + 1 },
      () => Array(n + 1).fill(0)
    );

    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] =
          t[i] === s[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    /* 回溯标记差异 */

    const missing = [];
    const extra = [];
    let i = 0;
    let j = 0;

    while (i < m && j < n) {
      if (t[i] === s[j]) {
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        missing.push(t[i]);
        i++;
      } else {
        extra.push(s[j]);
        j++;
      }
    }

    while (i < m) missing.push(t[i++]);
    while (j < n) extra.push(s[j++]);

    return { missing, extra };
  };

  /* =========================================================
     生成本地反馈
  ========================================================= */

  const generateFeedback = (
    target,
    spoken,
    score,
    diff
  ) => {
    const normalizedSpoken =
      normalizeThai(spoken);

    if (!normalizedSpoken) {
      return {
        feedback:
          "没有清晰识别到你的泰语发音。",
        tips:
          "请靠近麦克风，大声、清晰地朗读一次。",
      };
    }

    /* 基于逐字对比的针对性建议 */

    let diffTip = "";

    if (diff?.missing?.length) {
      diffTip += `你漏读了「${diff.missing.join("")}」这几个字母；`;
    }

    if (diff?.extra?.length) {
      diffTip += `多读了「${diff.extra.join("")}」；`;
    }

    if (diffTip) {
      diffTip =
        `逐字对比：${diffTip}建议对照标准发音逐个字母对比，重点模仿缺失或多余的部分。`;
    }

    if (score >= 95) {
      return {
        feedback:
          `识别结果「${spoken}」与目标「${target}」高度一致，整体朗读非常准确。`,
        tips:
          "可以继续保持当前发音，并注意泰语声调、长短元音和语速。",
      };
    }

    if (score >= 85) {
      return {
        feedback:
          `识别结果「${spoken}」与目标「${target}」基本一致，发音整体不错。`,
        tips:
          diffTip ||
          "建议再听一遍标准发音，重点模仿声调和元音长短。",
      };
    }

    if (score >= 70) {
      return {
        feedback:
          `AI 识别到了「${spoken}」，与目标「${target}」存在一定差异。`,
        tips:
          diffTip ||
          "建议放慢速度，先准确模仿音节，再逐渐恢复正常语速。",
      };
    }

    return {
      feedback:
        `识别结果「${spoken}」与目标「${target}」差异较明显。`,
      tips:
        diffTip ||
        "建议先听标准发音 2～3 次，然后逐音节模仿，再重新朗读。",
    };
  };

  /* =========================================================
     开始录音 / 本地语音识别
  ========================================================= */

  /* =========================================================
     纯录音模式（浏览器识别不可用时的降级路径）
     直接用 Web Audio 采集 16kHz WAV，停止后上传 Azure 评测。
  ========================================================= */

  const startRecorderOnly = () => {
    setError(null);
    setResult(null);

    azureReportedRef.current = false;
    cancelPendingReport();

    recorderOnlyRef.current = true;
    setRecorderOnly(true);

    currentTargetRef.current =
      current?.thai_word || "";

    startTimeRef.current = Date.now();

    setRecording(true);
    setAnalyzing(false);

    try {
      recorderRef.current =
        createAudioRecorder();

      recorderRef.current
        .start()
        .catch(() => {
          recorderRef.current = null;

          recorderOnlyRef.current = false;
          setRecorderOnly(false);
          setRecording(false);

          setError(
            "无法访问麦克风，请在系统设置中允许麦克风权限后重试。"
          );
        });
    } catch (e) {
      console.error(
        "启动录音失败:",
        e
      );

      recorderRef.current = null;

      recorderOnlyRef.current = false;
      setRecorderOnly(false);
      setRecording(false);

      setError(
        "无法启动录音，请检查麦克风设备后重试。"
      );
    }
  };

  const startRecognition = () => {
    setError(null);
    setResult(null);

    azureReportedRef.current = false;
    cancelPendingReport();

    /* 浏览器识别不可用 → 降级为纯录音模式（走 Azure 评测） */

    if (!SpeechRecognition) {
      startRecorderOnly();
      return;
    }

    if (!current?.thai_word) {
      setError("当前没有可识别的泰语单词。");
      return;
    }

    try {
      const recognition =
        new SpeechRecognition();

      recognition.lang = "th-TH";

      /*
       * 连续识别
       */

      recognition.continuous = true;

      /*
       * 返回临时识别结果
       */

      recognition.interimResults = true;

      /*
       * 尽可能返回多个候选
       */

      recognition.maxAlternatives = 3;

      finalTextRef.current = "";
      currentTargetRef.current =
        current.thai_word;

      recognition.onstart = () => {
        setRecording(true);
        setAnalyzing(false);
        setError(null);
        startTimeRef.current = Date.now();

        /*
         * 并行启动 WAV 采集（供后端 Azure 专业评测）；
         * 失败不影响本地识别流程。
         */

        try {
          recorderRef.current = createAudioRecorder();
          recorderRef.current.start().catch(() => {
            recorderRef.current = null;
          });
        } catch (e) {
          recorderRef.current = null;
        }
      };

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {
          const resultItem =
            event.results[i];

          const transcript =
            resultItem[0]?.transcript || "";

          if (resultItem.isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText) {
          finalTextRef.current += finalText;
        }

        /*
         * 实时显示识别结果
         */

        const liveText =
          `${finalTextRef.current} ${interimText}`.trim();

        setResult((prev) => ({
          ...(prev || {}),
          liveTranscription: liveText,
        }));
      };

      recognition.onerror = (event) => {
        console.error(
          "SpeechRecognition error:",
          event
        );

        /*
         * 识别服务不可用（WebView / 网络受限）→ 降级为纯录音模式：
         * 录音采集已在 onstart 启动，保持继续录制，
         * 用户停止后直接上传 Azure 专业评测。
         */

        if (event.error === "network") {
          recorderOnlyRef.current = true;
          setRecorderOnly(true);
          setError(null);
          return;
        }

        setRecording(false);
        setAnalyzing(false);

        let message =
          "语音识别失败，请重试。";

        if (event.error === "not-allowed") {
          message =
            "麦克风权限被拒绝，请在浏览器设置中允许麦克风访问。";
        }

        if (event.error === "no-speech") {
          message =
            "没有检测到清晰的人声，请大声朗读。";
        }

        if (event.error === "audio-capture") {
          message =
            "无法访问麦克风，请检查麦克风设备。";
        }

        setError(message);

        /* 出错时停止录音采集 */

        try {
          recorderRef.current?.stop();
        } catch (e) {
          // ignore
        }

        recorderRef.current = null;
      };

      recognition.onend = () => {
        /*
         * 纯录音降级模式下，由用户点击停止触发上传，
         * 不在这里结束录音。
         */

        if (recorderOnlyRef.current) {
          return;
        }

        setRecording(false);

        /*
         * 如果用户主动停止，
         * onend 后执行最终评分
         */

        const spoken =
          finalTextRef.current.trim();

        const elapsedMs =
          startTimeRef.current
            ? Date.now() - startTimeRef.current
            : 0;

        if (spoken) {
          analyzeLocalResult(
            currentTargetRef.current,
            spoken,
            elapsedMs
          );
        }

        /*
         * 并行把录音上传后端做 Azure 专业评测；
         * 成功后覆盖本地结果，失败/未配置则保留本地。
         */

        uploadForAzureAssessment(
          currentTargetRef.current
        );
      };

      recognitionRef.current =
        recognition;

      recognition.start();
    } catch (error) {
      console.error(
        "启动本地语音识别失败，降级为纯录音模式:",
        error
      );

      recognitionRef.current = null;

      startRecorderOnly();
    }
  };

  /* =========================================================
     上传录音 → 后端 Azure 发音评估（专业声学评分）
     成功则覆盖本地结果；失败 / 未配置时静默降级。
  ========================================================= */

  const uploadForAzureAssessment = async (
    target
  ) => {
    if (!target) return;

    let wav = null;

    try {
      wav = recorderRef.current?.stop();
    } catch (e) {
      // ignore
    }

    recorderRef.current = null;

    if (!wav) return;

    try {
      const formData = new FormData();

      formData.append(
        "audio",
        wav,
        "speaking.wav"
      );

      formData.append(
        "target_text",
        target
      );

      formData.append("mode", mode);

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/speaking/analyze`,
        {
          method: "POST",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
          body: formData,
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      /* 只接受专业评分结果（本地降级结果不覆盖） */

      if (data.source !== "azure") return;      /* 声调估算：基于 Azure accuracy + 错误类型 */
      const mispronounced = (data.words || []).filter(w => w.errorType === "Mispronunciation").length;
      const totalWords = (data.words || []).length || 1;
      const toneBase = data.accuracy || data.score || 70;
      const tonePenalty = Math.round((mispronounced / totalWords) * 25);
      const tone = Math.max(20, Math.min(100, toneBase - tonePenalty));

      setResult((prev) => ({
        ...(prev || {}),
        source: "azure",
        transcription:
          data.transcription ||
          prev?.transcription ||
          "",
        score: data.score,
        dimensions: {
          accuracy: data.accuracy,
          completeness: data.completeness,
          fluency: data.fluency,
          tone,
        },
        words: data.words || [],
        feedback: data.feedback,
        tips: data.tips,
        coaching: generateCoaching(data.score, data.accuracy, data.fluency, data.completeness, tone, data.words || []),
      }));

      /* 专业评分到达：取消本地延迟上报，直接上报 Azure 分 */
      azureReportedRef.current = true;
      cancelPendingReport();
      reportScore({
        score: data.score,
        source: "azure",
        transcription: data.transcription || "",
      });

      setAnalyzing(false);
    } catch (e) {
      /* 降级：保留本地估算结果 */
      console.warn(
        "Azure 评测不可用，保留本地估算:",
        e
      );
    }
  };

  /* =========================================================
     停止识别
  ========================================================= */

  const stopRecognition = () => {
    /* 纯录音模式：直接停止采集并上传 Azure 评测 */

    if (recorderOnlyRef.current) {
      setAnalyzing(true);

      uploadForAzureAssessment(
        currentTargetRef.current
      ).finally(() => {
        recorderOnlyRef.current = false;
        setRecorderOnly(false);
        setRecording(false);
        setAnalyzing(false);
      });

      return;
    }

    if (!recognitionRef.current) {
      return;
    }

    setAnalyzing(true);

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error(
        "停止语音识别失败:",
        error
      );

      setRecording(false);
      setAnalyzing(false);
    }
  };

  /* =========================================================
     本地分析
  ========================================================= */

  const analyzeLocalResult = (
    target,
    spoken,
    elapsedMs = 0
  ) => {
    const accuracy = calculateScore(
      target,
      spoken
    );

    const completeness = calculateCompleteness(
      target,
      spoken
    );

    const fluency = calculateFluency(
      target,
      elapsedMs
    );

    /*
     * 综合分：发音 60% + 完整度 20% + 流利度 20%
     * （纯本地估算，非专业声学评分）
     */

    const score = Math.round(
      accuracy * 0.6 +
      completeness * 0.2 +
      fluency * 0.2
    );

    const diff = diffThai(target, spoken);

    const feedback =
      generateFeedback(
        target,
        spoken,
        score,
        diff
      );

    /* 声调估算：基于准确度和文本差异 */
    const toneBase = accuracy;
    const tonePenalty = diff ? Math.round(((diff.missing?.length || 0) + (diff.extra?.length || 0)) * 5) : 0;
    const tone = Math.max(20, Math.min(100, toneBase - tonePenalty));

    const dimensions = {
      accuracy,
      completeness,
      fluency,
      tone,
    };

    setResult({
      transcription: spoken,
      score,
      dimensions,
      diff,
      feedback: feedback.feedback,
      tips: feedback.tips,
      coaching: generateCoaching(score, accuracy, fluency, completeness, tone, []),
    });

    /* 本地估算延迟上报：1.5s 内没有 Azure 专业分到达才用本地分 */
    cancelPendingReport();
    reportTimerRef.current = setTimeout(() => {
      if (!azureReportedRef.current) {
        reportScore({
          score,
          source: "local",
          transcription: spoken,
        });
      }
    }, 1500);

    setAnalyzing(false);
  };

  /* =========================================================
     录音按钮
  ========================================================= */

  const handleRecording = () => {
    if (analyzing) return;

    if (recording) {
      stopRecognition();
      return;
    }

    /* 单词模式免费额度：非 VIP 剩余 0 时拦截，提示开通 VIP */

    if (
      mode === "word" &&
      quota &&
      quota.remainingToday === 0
    ) {
      if (onVipRequired) {
        onVipRequired();
      }
      return;
    }

    startRecognition();
  };

  /* 评分完成后刷新剩余次数（由上层注入回调） */

  useEffect(() => {
    if (result?.score === undefined) return;

    if (mode === "word" && quota) {
      fetch(`${API_BASE_URL}/speaking/quota`, {
        headers: localStorage.getItem("token")
          ? {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            }
          : undefined,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setQuota(d);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.score]);

  /* =========================================================
     切换单词
  ========================================================= */

  const goTo = (index) => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // ignore
    }

    recognitionRef.current = null;

    azureReportedRef.current = false;
    cancelPendingReport();

    recorderOnlyRef.current = false;
    setRecorderOnly(false);

    setRecording(false);
    setAnalyzing(false);
    setResult(null);
    setError(null);

    const nextIndex = Math.max(
      0,
      Math.min(
        index,
        words.length - 1
      )
    );

    setCurrentIndex(nextIndex);
  };

  const previous = () => {
    goTo(currentIndex - 1);
  };

  const next = () => {
    goTo(currentIndex + 1);
  };

  /* =========================================================
     重新练习
  ========================================================= */

  const retry = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // ignore
    }

    recognitionRef.current = null;

    azureReportedRef.current = false;
    cancelPendingReport();

    recorderOnlyRef.current = false;
    setRecorderOnly(false);

    finalTextRef.current = "";

    setRecording(false);
    setAnalyzing(false);
    setResult(null);
    setError(null);

    setTimeout(() => {
      if (current?.thai_word) {
        speak(current.thai_word);
      }
    }, 150);
  };

  /* =========================================================
     没有词汇
  ========================================================= */

  if (!words || words.length === 0) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.06]">
            <Mic className="h-7 w-7 text-emerald-300/50" />
          </div>

          <h2 className="text-lg font-bold text-white">
            暂无可练习词汇
          </h2>

          <p className="mt-2 text-sm text-white/35">
            请先添加一些泰语词汇，再开始口语练习。
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     当前进度
  ========================================================= */

  const progress =
    ((currentIndex + 1) /
      words.length) *
    100;

  const score =
    result?.score ?? null;

  const scoreLevel =
    score === null
      ? null
      : score >= 90
      ? {
          label: "非常棒",
          description: "识别结果与目标高度一致",
        }
      : score >= 80
      ? {
          label: "很好",
          description: "整体朗读比较准确",
        }
      : score >= 60
      ? {
          label: "继续加油",
          description: "还有一些地方可以调整",
        }
      : {
          label: "再练一次",
          description: "建议重新听标准发音",
        };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* =====================================================
          顶部标题
      ===================================================== */}

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/70">
              <Sparkles className="h-3.5 w-3.5" />
              THAI SPEAKING LAB
            </div>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              泰语口语练习
            </h2>

            <p className="mt-1 text-sm text-white/35">
              {azureReady
                ? "专业发音评测已就绪 · Azure 音素级声学评分"
                : "浏览器本地语音识别 · 无需上传录音"}
            </p>
          </div>

          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <div className="text-[10px] text-white/30">
              当前进度
            </div>

            <div className="mt-0.5 text-sm font-bold text-emerald-300">
              {currentIndex + 1}

              <span className="mx-1 text-white/20">
                /
              </span>

              {words.length}
            </div>
          </div>
        </div>

        {/* Progress */}

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-yellow-300"
            animate={{
              width: `${progress}%`,
            }}
            transition={{
              duration: 0.4,
            }}
          />
        </div>

        {/* 单词模式免费额度提示（非 VIP） */}

        {mode === "word" &&
          quota &&
          quota.remainingToday >= 0 && (
            <div
              className={`mt-3 flex items-center justify-between rounded-xl border px-3.5 py-2 ${
                quota.remainingToday === 0
                  ? "border-yellow-300/20 bg-yellow-300/[0.07]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className={`h-3.5 w-3.5 ${
                    quota.remainingToday === 0
                      ? "text-yellow-300"
                      : "text-emerald-300/70"
                  }`}
                />

                <span className="text-[11px] text-white/40">
                  {quota.remainingToday === 0 ? (
                    "今日免费次数已用完 · 开通 VIP 无限练习"
                  ) : (
                    <>
                      今日免费练习剩余{" "}
                      <b className="text-emerald-300">
                        {quota.remainingToday}
                      </b>{" "}
                      / {quota.freeWordDaily} 次
                    </>
                  )}
                </span>
              </div>

              {quota.remainingToday === 0 && (
                <button
                  onClick={() =>
                    onVipRequired &&
                    onVipRequired()
                  }
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-yellow-300 to-amber-400 px-3 py-1.5 text-[11px] font-bold text-[#172018] transition hover:-translate-y-0.5"
                >
                  <Crown className="h-3 w-3" />
                  开通 VIP
                </button>
              )}
            </div>
          )}
      </div>

      {/* =====================================================
          主卡片
      ===================================================== */}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{
            opacity: 0,
            y: 15,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: -10,
            scale: 0.98,
          }}
          transition={{
            duration: 0.25,
          }}
          className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-white/[0.035] shadow-2xl backdrop-blur-2xl"
        >
          {/* 背景光晕 */}

          <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-emerald-400/[0.08] blur-[100px]" />

          <div className="pointer-events-none absolute -right-32 top-20 h-72 w-72 rounded-full bg-yellow-300/[0.05] blur-[100px]" />

          <div className="relative p-6 sm:p-10">
            {/* =================================================
                单词
            ================================================= */}

            <div className="text-center">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className="rounded-full border border-yellow-300/10 bg-yellow-300/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-200/60">
                  {mode === "word"
                    ? "请朗读这个单词"
                    : mode === "sentence"
                    ? "请朗读这个句子"
                    : "请朗读这段短文"}
                </span>
              </div>

              <h1
                className={`font-thai font-black tracking-tight text-white ${
                  mode === "word"
                    ? "text-6xl sm:text-8xl"
                    : mode === "sentence"
                    ? "text-3xl leading-relaxed sm:text-5xl"
                    : "text-2xl leading-[2] sm:text-3xl"
                }`}
              >
                {current.thai_word}
              </h1>

              {current.pronunciation && (
                <p
                  className={`mt-4 font-medium text-emerald-300/80 ${
                    mode === "word" ? "text-base" : "text-xs sm:text-sm"
                  }`}
                >
                  [{current.pronunciation}]
                </p>
              )}

              {current.chinese_meaning && (
                <p className="mt-2 text-sm text-white/45">
                  {current.chinese_meaning}
                </p>
              )}

              {/* 标准发音 */}

              <button
                onClick={() =>
                  speak(current.thai_word)
                }
                className="group mx-auto mt-5 flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-400/[0.06] px-4 py-2 text-xs font-medium text-emerald-300/80 transition-all hover:border-emerald-300/20 hover:bg-emerald-400/[0.12] hover:text-emerald-200"
              >
                <Volume2 className="h-4 w-4 transition-transform group-hover:scale-110" />
                听标准发音
              </button>
            </div>

            {/* =================================================
                录音区域
            ================================================= */}

            <div className="mt-10 flex flex-col items-center">
              <div className="relative flex items-center justify-center">

                {/* 常驻呼吸光晕（AI 语音球） */}

                <motion.div
                  animate={{
                    scale: [1, 1.07, 1],
                    opacity: [0.3, 0.55, 0.3],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className={`absolute h-40 w-40 rounded-full blur-2xl ${
                    recording
                      ? "bg-red-400/25"
                      : "bg-emerald-400/25"
                  }`}
                />

                {/* 双旋转轨道环（常驻，极慢） */}

                <div
                  className={`ring-spin absolute h-32 w-32 rounded-full border ${
                    recording
                      ? "border-red-300/15"
                      : "border-emerald-300/15"
                  }`}
                />

                <div
                  className={`ring-spin-reverse absolute h-40 w-40 rounded-full border ${
                    recording
                      ? "border-red-300/10"
                      : "border-yellow-300/10"
                  }`}
                />

                {/* 录音声波波纹（雷达扩散，三层交错） */}

                <AnimatePresence>
                  {recording &&
                    [0, 1, 2].map((wave) => (
                      <motion.span
                        key={wave}
                        className={`absolute h-24 w-24 rounded-full border-2 ${
                          wave % 2 === 0
                            ? "border-red-300/50"
                            : "border-red-200/35"
                        }`}
                        initial={{ scale: 0.5, opacity: 0.7 }}
                        animate={{
                          scale: [0.5, 1.9],
                          opacity: [0.7, 0],
                        }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          delay: wave * 0.55,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                </AnimatePresence>

                {/* 核心语音球 */}

                <motion.button
                  whileHover={{
                    scale: analyzing ? 1 : 1.06,
                  }}
                  whileTap={{
                    scale: analyzing ? 1 : 0.93,
                  }}
                  onClick={handleRecording}
                  disabled={analyzing}
                  className={`
                    relative
                    z-10
                    flex
                    h-24
                    w-24
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-full
                    border
                    shadow-2xl
                    transition-all
                    duration-300
                    disabled:cursor-not-allowed
                    disabled:opacity-70
                    ${
                      analyzing
                        ? "border-yellow-200/40 bg-gradient-to-br from-yellow-300/80 to-amber-500 shadow-yellow-900/40"
                        : recording
                        ? "border-red-200/40 bg-gradient-to-br from-red-400 to-red-600 shadow-red-900/40"
                        : "border-emerald-200/30 bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-600 shadow-emerald-900/40"
                    }
                  `}
                >
                  {/* 球体内部高光 */}

                  <div
                    className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-transparent to-transparent ${
                      recording ? "opacity-50" : "opacity-40"
                    }`}
                  />

                  {/* 内部呼吸微光 */}

                  <motion.div
                    animate={
                      recording
                        ? { opacity: [0.2, 0.55, 0.2] }
                        : { opacity: [0.12, 0.32, 0.12] }
                    }
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="pointer-events-none absolute inset-3 rounded-full bg-white/10"
                  />

                  {analyzing ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  ) : recording ? (
                    <Square className="h-8 w-8 fill-white text-white" />
                  ) : (
                    <Mic className="h-9 w-9 text-white" />
                  )}

                  {/* AI 标识 */}

                  <span className="absolute bottom-1.5 right-2 text-[9px] font-black tracking-widest text-white/70">
                    AI
                  </span>
                </motion.button>
              </div>

              <p className="mt-7 text-sm font-medium text-white/50">
                {analyzing
                  ? "正在分析你的朗读..."
                  : recording
                  ? recorderOnly
                    ? "正在录音 · 点击停止"
                    : "正在识别 · 点击停止"
                  : "点击语音球开始朗读"}
              </p>

              {!recording &&
                !analyzing && (
                  <p className="mt-1 text-[11px] text-white/25">
                    {azureReady
                      ? "录音将上传至 Azure 做音素级声学评分"
                      : "泰语识别由浏览器完成，不上传录音"}
                  </p>
                )}
            </div>

            {/* =================================================
                实时识别
            ================================================= */}

            {result?.liveTranscription &&
              recording && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="mt-7 rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.04] p-4"
                >
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300/50">
                    实时识别
                  </div>

                  <p className="text-lg font-medium text-white/80">
                    {result.liveTranscription}
                  </p>
                </motion.div>
              )}

            {/* =================================================
                错误
            ================================================= */}

            {error && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="mt-7 flex items-start gap-3 rounded-2xl border border-red-400/10 bg-red-400/[0.06] p-4"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />

                <div>
                  <p className="text-sm font-medium text-red-200">
                    语音识别失败
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-red-200/50">
                    {error}
                  </p>
                </div>
              </motion.div>
            )}

            {/* =================================================
                分析结果
            ================================================= */}

            {result &&
              result.transcription && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 15,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="mt-8"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-300" />

                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-200/60">
                      {result.source === "azure"
                        ? "专业发音分析 · Azure 声学评测"
                        : "本地发音分析"}
                    </span>

                    {result.source === "azure" && (
                      <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                        专业评分
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    {/* 分数 */}

                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">

                      {/* 环形评分（进度环 + 数字滚动 + 终点光点） */}

                      <ScoreRing score={score} />

                      {scoreLevel && (
                        <div className="mt-3 text-center">
                          <p className="text-sm font-bold text-white">
                            {scoreLevel.label}
                          </p>

                          <p className="mt-0.5 text-[10px] text-white/30">
                            {scoreLevel.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 分析内容 */}

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">
                          {result.source === "azure"
                            ? "声学识别"
                            : "浏览器识别"}
                        </div>

                        <p className="text-sm font-medium text-white/75">
                          {result.transcription}
                        </p>
                      </div>

                      {result.feedback && (
                        <div className="rounded-2xl border border-emerald-300/[0.08] bg-emerald-400/[0.04] p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />

                            <span className="text-xs font-semibold text-emerald-200">
                              发音反馈
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-relaxed text-white/60">
                            {result.feedback}
                          </p>
                        </div>
                      )}

                      {/* 逐字对比：目标词逐字高亮（绿=读对 红=漏读），多读字单独提示 */}

                      {result.diff &&
                        (result.diff.missing.length > 0 ||
                          result.diff.extra.length > 0) && (
                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">
                              逐字对比
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {[
                                ...normalizeThai(
                                  current.thai_word
                                ),
                              ].map((ch, idx) => {
                                const missed =
                                  result.diff.missing.includes(
                                    ch
                                  );

                                return (
                                  <span
                                    key={idx}
                                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                                      missed
                                        ? "border border-red-300/30 bg-red-400/10 text-red-300"
                                        : "border border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-200"
                                    }`}
                                  >
                                    {ch}
                                  </span>
                                );
                              })}
                            </div>

                            {result.diff.extra.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                <span className="text-[10px] text-white/25">
                                  多读：
                                </span>

                                {result.diff.extra.map(
                                  (ch, idx) => (
                                    <span
                                      key={idx}
                                      className="flex h-6 w-6 items-center justify-center rounded-md border border-yellow-300/25 bg-yellow-300/[0.08] text-xs font-bold text-yellow-200"
                                    >
                                      {ch}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}

                      {result.tips && (
                        <div className="rounded-2xl border border-yellow-300/[0.08] bg-yellow-300/[0.035] p-4">
                          <p className="text-xs leading-relaxed text-yellow-100/50">
                            💡 {result.tips}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI 口语教练 — 雷达图 + 教练反馈 */}

                  <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
                    {/* 四维雷达 */}
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/25">
                        能力雷达
                      </div>
                      <SpeakingRadar dimensions={result.dimensions} />
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { label: "发音", val: result.dimensions?.accuracy },
                          { label: "声调", val: result.dimensions?.tone },
                          { label: "流利度", val: result.dimensions?.fluency },
                          { label: "完整度", val: result.dimensions?.completeness },
                        ].map((d) => (
                          <div key={d.label} className="flex items-center gap-1.5">
                            <span className="text-[9px] text-white/30">{d.label}</span>
                            <span className="text-[11px] font-bold text-emerald-300">{d.val ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-center text-[9px] text-white/20">
                        {result.source === "azure"
                          ? "Azure 声学评测"
                          : "本地估算"}
                      </div>
                    </div>

                    {/* 教练反馈 */}
                    <CoachingPanel coaching={result.coaching} score={score} />
                  </div>

                  <button
                    onClick={retry}
                    className="mx-auto mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/45 transition-all hover:bg-white/[0.08] hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    再练一次
                  </button>
                </motion.div>
              )}

            {/* =================================================
                例句
            ================================================= */}

            {mode === "word" &&
              current.example_thai && (
                <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                      例句
                    </span>

                    <button
                      onClick={() =>
                        speak(
                          current.example_thai
                        )
                      }
                      className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-emerald-300"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="font-thai text-sm leading-relaxed text-white/65">
                    {current.example_thai}
                  </p>

                  {current.example_chinese && (
                    <p className="mt-1 text-xs leading-relaxed text-white/25">
                      {current.example_chinese}
                    </p>
                  )}
                </div>
              )}

            {/* =================================================
                上下一个
            ================================================= */}

            <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-6">
              <button
                onClick={previous}
                disabled={
                  currentIndex === 0
                }
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-white/50 transition-all hover:bg-white/[0.08] hover:text-white] disabled:pointer-events-none disabled:opacity-20"
              >
                <ChevronLeft className="h-4 w-4" />
                上一个
              </button>

              <span className="text-[10px] text-white/20">
                {currentIndex + 1} /{" "}
                {words.length}
              </span>

              <button
                onClick={next}
                disabled={
                  currentIndex ===
                  words.length - 1
                }
                className="flex items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.06] px-4 py-2.5 text-xs font-medium text-emerald-300/70 transition-all hover:bg-emerald-400/[0.12] hover:text-emerald-200 disabled:pointer-events-none disabled:opacity-20"
              >
                下一个
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


/* =========================================================
   环形评分（SVG 进度环 + 数字滚动 + 终点光点）
========================================================= */

function ScoreRing({ score }) {
  const [display, setDisplay] = useState(0);

  const size = 108;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const color =
    score >= 90
      ? "#34d399"
      : score >= 80
      ? "#2dd4bf"
      : score >= 60
      ? "#fbbf24"
      : "#f87171";

  /* 数字滚动（easeOutCubic） */

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(score * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  /* 终点光点位置（svg 已逆时针旋转 90°） */

  const angle = (score / 100) * Math.PI * 2 - Math.PI / 2;
  const dotX = size / 2 + radius * Math.cos(angle);
  const dotY = size / 2 + radius * Math.sin(angle);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
      >
        {/* 底环 */}

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* 进度环（发光滑环） */}

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset:
              circumference * (1 - score / 100),
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 6px ${color}55)`,
          }}
        />
      </svg>

      {/* 中心数字 */}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-black tabular-nums"
          style={{ color }}
        >
          {display}
        </span>

        <span className="mt-0.5 text-[8px] font-bold tracking-widest text-white/25">
          SCORE
        </span>
      </div>

      {/* 终点光点 */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.3 }}
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: dotX,
          top: dotY,
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    </div>
  );
}


/* =========================================================
   评分维度标签（带微进度条）
========================================================= */

function DimensionChip({ label, value = null, pending = false }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div className="mt-1 text-base font-black text-white">
        {pending ? (
          <span className="text-[10px] font-medium text-yellow-200/50">
            待接入
          </span>
        ) : (
          <>
            {value ?? "—"}
            <span className="ml-0.5 text-[10px] text-white/25">
              分
            </span>
          </>
        )}
      </div>

      {/* 微进度条 */}

      {!pending && value !== null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-yellow-300"
          />
        </div>
      )}
    </div>
  );
}


/* =========================================================
   AI 口语教练 — 生成个性化教练反馈
========================================================= */

function generateCoaching(score, accuracy, fluency, completeness, tone, words) {
  const weakest = [
    { dim: "发音", val: accuracy },
    { dim: "声调", val: tone },
    { dim: "流利度", val: fluency },
    { dim: "完整度", val: completeness },
  ].sort((a, b) => a.val - b.val);

  const focusAreas = [];
  const tips = [];

  /* 最弱维度 */
  if (weakest[0].val < 70) {
    focusAreas.push({ label: weakest[0].dim, severity: "high", tip: `你的${weakest[0].dim}还有较大提升空间` });
  }
  if (weakest[1].val < 80) {
    focusAreas.push({ label: weakest[1].dim, severity: "medium", tip: `建议多练习${weakest[1].dim}` });
  }

  /* 逐字错误分析 */
  const mispronounced = words.filter(w => w.errorType === "Mispronunciation");
  const omitted = words.filter(w => w.errorType === "Omission");
  if (mispronounced.length > 0) {
    tips.push(`有 ${mispronounced.length} 个音素发音不准，建议逐个纠正标注错误的音。`);
  }
  if (omitted.length > 0) {
    tips.push(`有 ${omitted.length} 个音节被漏读，请放慢速度把每个音节读完整。`);
  }

  /* 综合评语 */
  let summary = "";
  if (score >= 90) {
    summary = "非常出色！你的发音接近母语水平，继续保持！";
  } else if (score >= 80) {
    summary = "很好！整体发音准确，注意细节可以更完美。";
  } else if (score >= 60) {
    summary = "不错的开始！多练习几次，你会越来越自然。";
  } else {
    summary = "别灰心！建议先听标准发音，然后逐句模仿。";
  }

  if (tone < 65) {
    tips.push("泰语有5个声调，声调不同意思完全不同。建议重点练习声调对比。");
  }
  if (fluency < 65) {
    tips.push("朗读时注意连贯性，不要一个字一个字地蹦，试着把词组连起来读。");
  }

  return { summary, focusAreas, tips, weakest: weakest[0] };
}


/* =========================================================
   AI 口语教练 — 评分雷达图（纯 SVG，无依赖）
========================================================= */

function SpeakingRadar({ dimensions }) {
  if (!dimensions) return null;

  const { accuracy = 0, tone = 0, fluency = 0, completeness = 0 } = dimensions;
  const dims = [
    { label: "发音", value: accuracy, angle: 0 },
    { label: "声调", value: tone, angle: 90 },
    { label: "流利度", value: fluency, angle: 180 },
    { label: "完整度", value: completeness, angle: 270 },
  ];

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 70;

  const getPoint = (angle, r) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 网格环 */}
        {rings.map((r, i) => (
          <polygon
            key={i}
            points={dims.map(d => `${getPoint(d.angle, maxR * r).x},${getPoint(d.angle, maxR * r).y}`).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* 轴线 */}
        {dims.map((d, i) => {
          const p = getPoint(d.angle, maxR);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
        })}

        {/* 数据多边形 */}
        <motion.polygon
          points={dims.map(d => `${getPoint(d.angle, maxR * (d.value / 100)).x},${getPoint(d.angle, maxR * (d.value / 100)).y}`).join(" ")}
          fill="rgba(52,211,153,0.15)"
          stroke="#34d399"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* 数据点 */}
        {dims.map((d, i) => {
          const p = getPoint(d.angle, maxR * (d.value / 100));
          return (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#34d399"
              stroke="#065f46"
              strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
            />
          );
        })}

        {/* 标签 */}
        {dims.map((d, i) => {
          const p = getPoint(d.angle, maxR + 18);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white/40 text-[9px] font-bold"
            >
              {d.label}
            </text>
          );
        })}

        {/* 数值 */}
        {dims.map((d, i) => {
          const p = getPoint(d.angle, maxR * (d.value / 100) + 12);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-emerald-300 text-[10px] font-black"
            >
              {d.value}
            </text>
          );
        })}
      </svg>
    </div>
  );
}


/* =========================================================
   AI 口语教练 — 教练反馈面板
========================================================= */

function CoachingPanel({ coaching, score }) {
  if (!coaching) return null;

  const scoreColor =
    score >= 90 ? "text-emerald-300" :
    score >= 80 ? "text-teal-300" :
    score >= 60 ? "text-yellow-300" : "text-red-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-4 space-y-3"
    >
      {/* 教练评语 */}
      <div className="rounded-2xl border border-emerald-300/[0.08] bg-emerald-400/[0.04] p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-xs font-bold text-emerald-200/70">AI 教练评语</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {coaching.summary}
        </p>
      </div>

      {/* 重点改进 */}
      {coaching.focusAreas.length > 0 && (
        <div className="rounded-2xl border border-yellow-300/[0.08] bg-yellow-300/[0.035] p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-yellow-200/50">
            🎯 重点改进
          </div>
          <div className="space-y-2">
            {coaching.focusAreas.map((area, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                  area.severity === "high" ? "bg-red-400" : "bg-yellow-400"
                }`} />
                <span className="text-xs text-white/50">
                  <b className="text-white/70">{area.label}</b> — {area.tip}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 建议 */}
      {coaching.tips.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">
            💡 练习建议
          </div>
          <div className="space-y-2">
            {coaching.tips.map((tip, i) => (
              <p key={i} className="text-xs leading-relaxed text-white/45">
                {i + 1}. {tip}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 最弱维度提示 */}
      {coaching.weakest && coaching.weakest.val < 75 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300/[0.06] bg-emerald-400/[0.03] px-4 py-3">
          <span className="text-lg">⚡</span>
          <p className="text-xs text-white/45">
            下次练习建议重点关注 <b className="text-emerald-300">{coaching.weakest.label}</b>（当前 {coaching.weakest.val} 分）
          </p>
        </div>
      )}
    </motion.div>
  );
}
