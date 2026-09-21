// =========================================================
// 浏览器录音采集：Web Audio API → 16kHz / 16bit / mono PCM WAV
//
// Azure 发音评估要求 WAV/PCM/16kHz/mono，浏览器录音默认
// 采样率（如 48kHz），这里在编码时线性降采样到 16kHz。
// =========================================================

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

/* 线性降采样到目标采样率 */
function downsample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;

    const a = samples[idx] ?? 0;
    const b = samples[Math.min(idx + 1, samples.length - 1)] ?? 0;

    result[i] = a + (b - a) * frac;
  }

  return result;
}

export function createAudioRecorder() {
  let stream = null;
  let audioCtx = null;
  let source = null;
  let processor = null;
  let analyser = null;
  let levelBuf = null;
  let chunks = [];
  let recording = false;

  async function start() {
    if (recording) return;

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const w = /** @type {any} */ (window);

    const Ctx =
      w.AudioContext || w.webkitAudioContext;

    audioCtx = new Ctx();
    source = audioCtx.createMediaStreamSource(stream);

    /* ScriptProcessor（广泛兼容，buffer 4096） */
    processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      chunks.push(
        new Float32Array(
          event.inputBuffer.getChannelData(0)
        )
      );
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    /*
     * 实时电平（给首页那圈「老师正在听」的声波用）。
     * 只做可视化，不参与录音与评估：录音走上面的 ScriptProcessor。
     */
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    levelBuf = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);

    recording = true;
    return true;
  }

  /* 当前音量 0~1（RMS）。未录音时返回 0。 */
  function getLevel() {
    if (!analyser || !levelBuf) return 0;

    analyser.getByteTimeDomainData(levelBuf);

    let sum = 0;
    for (let i = 0; i < levelBuf.length; i += 1) {
      const v = (levelBuf[i] - 128) / 128;
      sum += v * v;
    }

    const rms = Math.sqrt(sum / levelBuf.length);

    /* 人声 RMS 常常在 0.02~0.25，乘 4 后再夹紧，读数才看得见 */
    return Math.min(1, rms * 4);
  }

  function stop() {
    if (!recording) return null;

    recording = false;

    try {
      processor?.disconnect();
      source?.disconnect();
      source?.disconnect(processor);
      analyser?.disconnect();
    } catch (e) {
      // ignore
    }

    analyser = null;
    levelBuf = null;

    try {
      audioCtx?.close();
    } catch (e) {
      // ignore
    }

    stream?.getTracks().forEach((track) => track.stop());

    if (chunks.length === 0) {
      chunks = [];
      return null;
    }

    /* 合并所有采样块 */
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    chunks = [];

    const sourceRate = audioCtx?.sampleRate || 48000;

    /* 16kHz 降采样 + WAV 编码 */
    const wav = encodeWav(
      downsample(merged, sourceRate, 16000),
      16000
    );

    return wav;
  }

  function isRecording() {
    return recording;
  }

  return { start, stop, isRecording, getLevel };
}
