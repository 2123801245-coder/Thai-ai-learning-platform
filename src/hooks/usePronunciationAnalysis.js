import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function usePronunciationAnalysis() {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const targetTextRef = useRef('');

  const startRecording = async (targetText) => {
    setError(null);
    setResult(null);
    targetTextRef.current = targetText || '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await analyzeAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const analyzeAudio = async (blob) => {
    setAnalyzing(true);
    try {
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('analyzePronunciation', {
        audio_url: file_url,
        target_text: targetTextRef.current,
      });
      setResult(res.data);
    } catch (e) {
      setError('分析失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { recording, analyzing, result, error, startRecording, stopRecording, reset };
}