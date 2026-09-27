#!/usr/bin/env python3
"""泰语字幕流水线（Thai ASR → 断句规范化 → 中泰双语 VTT）

把一个音频/视频文件（或一个目录）变成 ThaiAI 播放器直接可用的字幕：

    <id>.th.vtt        泰语字幕（LessonVideo 的 subtitleUrlTh）
    <id>.zh.vtt        中文字幕（LessonVideo 的 subtitleUrl）
    <id>.th.srt        泰语 SRT（可交给 subtitle_refine.py 手工过一遍）
    <id>.bilingual.srt 中泰对照 SRT（人工校对用，两条文本同屏）
    <id>.report.json   本次运行的报告（分段/字数/耗时/CER）

设计要点
--------
1. **时间轴靠静音切分，不依赖引擎给词级时间戳。**
   本机实测：Azure 泰语短音频 REST 可用，但 fast transcription 在 eastasia
   不可用、REST 也不返回词级时间戳；Qwen3 的词级时间戳来自 ForcedAligner，
   而它**不支持泰语**。所以统一做法是：先用 ffmpeg silencedetect 把音频切成
   语音段，逐段识别，段落边界 + 引擎返回的 offset/duration 作为 cue 时间，
   长句再按泰语空格/标点断句并按字数比例分配时间。
2. **泰语词间空格会保留。** 根目录的 subtitle_refine.py 在做归并时会把空白
   全部删掉（_normalized_text），所以这里在归并之后用识别得到的词序把空格
   重新贴回去（respace），并校验「贴完的紧凑文本必须与原文完全一致」，不一致
   就回退不贴，绝不改动文字本身。
3. **引擎可插拔**：azure / openai / qwen3 / mock，见 README 段落的说明。

用法示例
--------
    # 最省事：直接用 .env 里的 Azure 语音密钥（eastasia 已验证可识别泰语）
    python3 scripts/thai_asr_subtitles.py lesson-01.mp4 --id lesson-01

    # 自建 Qwen3-ASR（Apache-2.0，官方支持泰语）在本机/服务器上跑
    python3 scripts/thai_asr_subtitles.py ep1.wav --engine qwen3 --id ep1

    # 任何 OpenAI 兼容的 /audio/transcriptions（whisper.cpp / faster-whisper）
    python3 scripts/thai_asr_subtitles.py ep1.wav --engine openai \\
        --asr-base-url http://127.0.0.1:8080/v1 --asr-model whisper-1

    # 只跑机制不联网（CI / 自测）
    python3 scripts/thai_asr_subtitles.py ep1.wav --engine mock

    # 顺便量一版泰语识别 CER（有参考文本时）
    python3 scripts/thai_asr_subtitles.py ep1.wav --reference ep1.script.txt

依赖：ffmpeg / ffprobe（必需）、Python 3.9+（只用标准库）。
Qwen3 引擎额外需要：pip install -U qwen-asr（+ torch / GPU）。

许可提醒：Qwen3-ASR 是 Apache-2.0、Typhoon 是 CC-BY-4.0；网易 Confucius4-R2T2
的权重是自定义许可，明确禁止用其输出改进其他 AI 模型，做数据闭环前先看许可。
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------- 路径 / 常量

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_OUT_DIR = REPO_ROOT / "backend" / "subtitles"
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".flv", ".ts"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".aiff", ".aif", ".wma"}
MEDIA_EXT = VIDEO_EXT | AUDIO_EXT

AZURE_TICKS = 10_000_000  # Azure 用 100ns 为单位

# 句末/断句标点（泰语常用的只有 ๆ 和少量借来的西文标点）
SENTENCE_END = frozenset("。！？!?…ๆ")
BREAK_AFTER = frozenset("。！？!?；;…ๆ，,、：: ")

# 泰语组合符号（声调符号、上/下加元音、์ 等）：断句绝不能落在它们前面，
# 否则会出现「基辅音在上一句、声调符号在下一句」的坏字幕。
THAI_COMBINING = frozenset(
    "\u0e31\u0e34\u0e35\u0e36\u0e37\u0e38\u0e39\u0e3a"
    "\u0e47\u0e48\u0e49\u0e4a\u0e4b\u0e4c\u0e4d\u0e4e"
)

log = logging.getLogger("thai_asr_subtitles")


# ---------------------------------------------------------------- 小工具


def die(msg: str, code: int = 2) -> "NoReturn":  # type: ignore[valid-type]
    log.error(msg)
    raise SystemExit(code)


def which_ffmpeg() -> Tuple[str, str]:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg:
        die("找不到 ffmpeg（macOS: brew install ffmpeg；Debian/Ubuntu: apt install ffmpeg）")
    return ffmpeg, (ffprobe or "")


def run(cmd: Sequence[str], *, timeout: int = 3600) -> subprocess.CompletedProcess:
    return subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout)


def strip_ws(text: str) -> str:
    """去掉所有空白与零宽字符，用于比较/计数（与 subtitle_refine 的口径一致）。"""
    cleaned = unicodedata.normalize("NFC", str(text or ""))
    cleaned = cleaned.replace("\u200b", "").replace("\ufeff", "")
    return re.sub(r"\s+", "", cleaned)


def collapse_ws(text: str) -> str:
    """把连续空白压成单个空格（保留词间空格，泰语学习场景要留着）。"""
    cleaned = unicodedata.normalize("NFC", str(text or ""))
    cleaned = cleaned.replace("\u200b", "").replace("\ufeff", "")
    return re.sub(r"\s+", " ", cleaned).strip()


def to_sec(value: Any) -> float:
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return 0.0
    return seconds if seconds > 0 else 0.0


def srt_ts(seconds: float) -> str:
    total_ms = int(round(max(0.0, seconds) * 1000))
    hh, rem = divmod(total_ms, 3_600_000)
    mm, rem = divmod(rem, 60_000)
    ss, ms = divmod(rem, 1000)
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"


def vtt_ts(seconds: float) -> str:
    """仓库现有 backend/subtitles/*.vtt 用的是 MM:SS.mmm（不满 1 小时）。"""
    total_ms = int(round(max(0.0, seconds) * 1000))
    hh, rem = divmod(total_ms, 3_600_000)
    mm, rem = divmod(rem, 60_000)
    ss, ms = divmod(rem, 1000)
    if hh:
        return f"{hh:02d}:{mm:02d}:{ss:02d}.{ms:03d}"
    return f"{mm:02d}:{ss:02d}.{ms:03d}"


def parse_ts(text: str) -> float:
    """兼容 SRT(,) 与 VTT(.) 两种时间戳。"""
    raw = str(text or "").strip().replace(",", ".")
    parts = raw.split(":")
    try:
        if len(parts) == 3:
            hh, mm, ss = parts
            return int(hh) * 3600 + int(mm) * 60 + float(ss)
        if len(parts) == 2:
            mm, ss = parts
            return int(mm) * 60 + float(ss)
        return float(raw)
    except ValueError:
        return 0.0


def render_srt(cues: Sequence[Dict[str, Any]], text_key: str = "text") -> str:
    blocks = []
    for idx, cue in enumerate(cues, start=1):
        body = str(cue.get(text_key) or cue.get("text") or "").strip()
        if not body:
            continue
        blocks.append(f"{idx}\n{srt_ts(cue['start'])} --> {srt_ts(cue['end'])}\n{body}")
    return "\n\n".join(blocks) + "\n" if blocks else ""


def render_bilingual_srt(cues: Sequence[Dict[str, Any]]) -> str:
    blocks = []
    for idx, cue in enumerate(cues, start=1):
        th = str(cue.get("text") or "").strip()
        zh = str(cue.get("zh") or "").strip()
        if not th and not zh:
            continue
        body = "\n".join(x for x in (th, zh) if x)
        blocks.append(f"{idx}\n{srt_ts(cue['start'])} --> {srt_ts(cue['end'])}\n{body}")
    return "\n\n".join(blocks) + "\n" if blocks else ""


def render_vtt(cues: Sequence[Dict[str, Any]], text_key: str = "text") -> str:
    lines = ["WEBVTT", ""]
    for cue in cues:
        body = str(cue.get(text_key) or cue.get("text") or "").strip()
        if not body:
            continue
        lines.append(f"{vtt_ts(cue['start'])} --> {vtt_ts(cue['end'])}")
        lines.append(body)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def cue_norm_len(text: str) -> int:
    return len(strip_ws(text))


# ---------------------------------------------------------------- 泰语断句


def _raw_index_for_norm(raw: str, norm_index: int) -> int:
    """把「去空白后的第 n 个字符」映射回 raw 中的下标（并避开组合符号）。"""
    if norm_index <= 0:
        return 0
    seen = 0
    cut = len(raw)
    for idx, ch in enumerate(raw):
        if ch.isspace():
            continue
        seen += 1
        if seen == norm_index:
            cut = idx + 1
            break
    while cut < len(raw) and raw[cut] in THAI_COMBINING:
        cut += 1
    return cut


def _guard_combining(raw: str, cut: int) -> int:
    """把切分点后移到组合符号之后，避免把声调/元音符号与基辅音拆散。"""
    while 0 < cut < len(raw) and raw[cut] in THAI_COMBINING:
        cut += 1
    return cut



def _best_break(raw: str, max_len: int) -> int:
    """返回不超过 max_len（按去空白字数）的最佳切分下标：空格 > 标点 > 硬切。"""
    space_cut = 0
    punct_cut = 0
    for idx, ch in enumerate(raw):
        if cue_norm_len(raw[:idx]) > max_len:
            break
        if ch == " ":
            space_cut = idx + 1
        elif ch in BREAK_AFTER:
            punct_cut = idx + 1
    if space_cut:
        return space_cut
    if punct_cut:
        return punct_cut
    return _raw_index_for_norm(raw, max_len)


def split_long_cues(cues: Sequence[Dict[str, Any]], max_len: int) -> List[Dict[str, Any]]:
    """长 cue 按泰语空格/标点断句，时间按字数比例分配。"""
    out: List[Dict[str, Any]] = []
    for cue in cues:
        raw = collapse_ws(cue.get("text") or "")
        start, end = float(cue["start"]), float(cue["end"])
        if not raw or cue_norm_len(raw) <= max_len or end <= start:
            out.append({"start": start, "end": end, "text": raw, **{k: v for k, v in cue.items() if k not in {"start", "end", "text"}}})
            continue

        pieces: List[str] = []
        rest = raw
        guard = 0
        while cue_norm_len(rest) > max_len and guard < 500:
            guard += 1
            cut = _best_break(rest, max_len)
            if cut <= 0:
                cut = len(rest)
            cut = _guard_combining(rest, cut)
            if cut <= 0:
                cut = len(rest)
            pieces.append(rest[:cut].strip())
            rest = rest[cut:].strip()
        if rest:
            pieces.append(rest)
        pieces = [p for p in pieces if p]
        if not pieces:
            out.append({"start": start, "end": end, "text": raw})
            continue

        weights = [max(1, cue_norm_len(p)) for p in pieces]
        total = sum(weights)
        duration = end - start
        acc = 0
        for piece, weight in zip(pieces, weights):
            p_start = start + duration * (acc / total)
            acc += weight
            p_end = start + duration * (acc / total)
            out.append({"start": p_start, "end": p_end, "text": piece})
    return out


def respace(thai_text: str, words: Sequence[str]) -> str:
    """用识别得到的词序把空格贴回被 subtitle_refine 抹掉的泰语文本。

    安全性（两道闸）：
      1. 贴完的紧凑文本必须与输入逐字一致，否则原样返回；
      2. 对不上的字符占比过高（> 30%）说明词序已漂移，同样原样返回。
    无论哪条闸触发，都只影响空格，绝不改动文字本身。
    """
    joined = strip_ws(thai_text)
    if not joined or not words:
        return thai_text

    tokens: List[str] = []
    pending = ""
    pos = 0
    word_idx = 0
    unmatched = 0
    while pos < len(joined):
        matched = False
        for skip in range(0, 3):
            cand_idx = word_idx + skip
            if cand_idx >= len(words):
                break
            cand = words[cand_idx]
            if cand and joined.startswith(cand, pos):
                if pending:
                    tokens.append(pending)
                    pending = ""
                tokens.append(cand)
                word_idx = cand_idx + 1
                pos += len(cand)
                matched = True
                break
        if not matched:
            pending += joined[pos]
            unmatched += 1
            pos += 1
    if pending:
        tokens.append(pending)

    spaced = " ".join(tokens).strip()
    if strip_ws(spaced) != joined:
        log.debug("respace 校验失败（文字不一致），保留原文")
        return thai_text
    if unmatched > max(4, int(len(joined) * 0.3)):
        log.debug("respace 词序漂移（%d/%d 字符未匹配），保留原文", unmatched, len(joined))
        return thai_text
    return spaced


def tidy_cues(cues: List[Dict[str, Any]], *, min_dur: float = 0.6, gap: float = 0.02) -> List[Dict[str, Any]]:
    """时间轴收尾：单调、不重叠、条目不短于 min_dur。"""
    ordered = sorted((dict(c) for c in cues if strip_ws(c.get("text"))), key=lambda c: c["start"])
    out: List[Dict[str, Any]] = []
    for cue in ordered:
        start = max(0.0, float(cue["start"]))
        end = max(start + 0.05, float(cue["end"]))
        if out and start < out[-1]["end"]:
            start = out[-1]["end"] + gap if start <= out[-1]["end"] else start
            end = max(end, start + 0.05)
        if end - start < min_dur:
            end = start + min_dur
        cue["start"], cue["end"] = start, end
        out.append(cue)
    return out


# ---------------------------------------------------------------- CER


def _cer_norm(text: str) -> str:
    text = strip_ws(text)
    text = re.sub(r"[^\w\u0E00-\u0E7F]", "", text)
    return text.lower()


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(reference: str, hypothesis: str) -> Dict[str, float]:
    ref, hyp = _cer_norm(reference), _cer_norm(hypothesis)
    if not ref:
        return {"cer": 0.0, "ref_chars": 0, "hyp_chars": len(hyp), "edits": len(hyp)}
    dist = levenshtein(ref, hyp)
    return {"cer": dist / len(ref), "ref_chars": len(ref), "hyp_chars": len(hyp), "edits": dist}


# ---------------------------------------------------------------- HTTP


def http_json(url: str, payload: Dict[str, Any], headers: Dict[str, str], *, timeout: int = 300) -> Any:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def http_multipart(
    url: str,
    fields: Dict[str, str],
    file_field: str,
    file_path: Path,
    headers: Dict[str, str],
    *,
    timeout: int = 300,
) -> Any:
    boundary = f"----thaiasr{uuid.uuid4().hex}"
    chunks: List[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(f"{value}\r\n".encode())
    mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    chunks.append(f"--{boundary}\r\n".encode())
    chunks.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'.encode()
    )
    chunks.append(f"Content-Type: {mime}\r\n\r\n".encode())
    chunks.append(file_path.read_bytes())
    chunks.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(chunks)

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", "replace")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"text": raw}


# ---------------------------------------------------------------- 音频


def extract_wav(source: Path, dest: Path) -> None:
    ffmpeg, _ = which_ffmpeg()
    proc = run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "pcm_s16le", str(dest)]
    )
    if proc.returncode != 0:
        die(f"ffmpeg 抽音频失败：{proc.stderr.strip()[:400]}")


def probe_duration(path: Path) -> float:
    _, ffprobe = which_ffmpeg()
    if ffprobe:
        proc = run([ffprobe, "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", str(path)])
        if proc.returncode == 0:
            return to_sec(proc.stdout.strip())
    ffmpeg, _ = which_ffmpeg()
    proc = run([ffmpeg, "-i", str(path)])
    match = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", proc.stderr or "")
    if match:
        hh, mm, ss = match.groups()
        return int(hh) * 3600 + int(mm) * 60 + float(ss)
    return 0.0


def slice_wav(wav: Path, start: float, end: float, dest: Path) -> None:
    ffmpeg, _ = which_ffmpeg()
    dur = max(0.05, end - start)
    proc = run([ffmpeg, "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}",
                "-i", str(wav), "-c:a", "pcm_s16le", str(dest)])
    if proc.returncode != 0:
        die(f"ffmpeg 切片失败：{proc.stderr.strip()[:300]}")


def silence_segments(
    wav: Path,
    *,
    duration: float,
    noise_db: float = -35.0,
    min_silence: float = 0.45,
    min_seg: float = 0.5,
    pad: float = 0.12,
    max_seg: float = 10.0,
) -> List[Tuple[float, float]]:
    """用 silencedetect 找语音段；返回 [(start, end), ...]（秒）。"""
    ffmpeg, _ = which_ffmpeg()
    proc = run([ffmpeg, "-i", str(wav), "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}",
                "-f", "null", "-"])
    text = proc.stderr or ""
    starts = [to_sec(m) for m in re.findall(r"silence_start:\s*([\d.]+)", text)]
    ends = [to_sec(m) for m in re.findall(r"silence_end:\s*([\d.]+)", text)]

    speech: List[Tuple[float, float]] = []
    cursor = 0.0
    for idx, s_start in enumerate(starts):
        if s_start > cursor + 0.05:
            speech.append((cursor, s_start))
        cursor = ends[idx] if idx < len(ends) else duration
    if duration > cursor + 0.05:
        speech.append((cursor, duration))
    if not speech:
        speech = [(0.0, duration)]

    # 过短片段并入相邻
    merged: List[Tuple[float, float]] = []
    for seg in speech:
        if merged and (seg[1] - seg[0]) < min_seg:
            prev = merged[-1]
            merged[-1] = (prev[0], seg[1])
        else:
            merged.append(seg)

    padded: List[Tuple[float, float]] = []
    for idx, (s_start, s_end) in enumerate(merged):
        lo = max(0.0, s_start - (pad if idx else 0.0))
        hi = min(duration, s_end + pad)
        if padded and lo < padded[-1][1]:
            lo = padded[-1][1]
        if hi - lo >= 0.05:
            padded.append((lo, hi))

    # 超长语音段（无静音/连续朗读）均分，避免单次请求过长
    capped: List[Tuple[float, float]] = []
    for s_start, s_end in padded:
        span = s_end - s_start
        if span <= max_seg:
            capped.append((s_start, s_end))
            continue
        pieces = int(span // max_seg) + 1
        step = span / pieces
        for i in range(pieces):
            capped.append((s_start + i * step, s_start + (i + 1) * step))
    return capped


# ---------------------------------------------------------------- 引擎


@dataclass
class SegmentResult:
    text: str
    spaced: str = ""
    offset: float = 0.0
    duration: float = 0.0
    raw: Dict[str, Any] = field(default_factory=dict)


class Engine:
    name = "base"
    native_segments = False
    def available(self) -> Tuple[bool, str]:
        return True, ""

    def transcribe(self, wav: Path, *, language: str, timeout: int = 300) -> SegmentResult:
        raise NotImplementedError

    def transcribe_native(self, wav: Path, *, language: str, timeout: int = 300) -> List[Dict[str, Any]]:
        raise NotImplementedError


class AzureEngine(Engine):
    """Azure 语音识别短音频 REST（用现有 SPEECH_KEY / SPEECH_REGION）。

    实测：eastasia + th-TH 可用；不返回词级时间戳，但 detailed 里的 Offset/Duration
    可用于收紧 cue 边界，NBest.ITN 带泰语分词空格（学习场景更有用）。
    """

    name = "azure"

    def __init__(self, key: str, region: str = "", endpoint: str = "") -> None:
        self.key = key or ""
        self.region = region or ""
        self.endpoint = (endpoint or (f"https://{region}.api.cognitive.microsoft.com" if region else "")).rstrip("/")

    def available(self) -> Tuple[bool, str]:
        if not self.key:
            return False, "未配置 SPEECH_KEY"
        if not self.endpoint:
            return False, "未配置 SPEECH_REGION 或 SPEECH_ENDPOINT"
        return True, ""

    def transcribe(self, wav: Path, *, language: str = "th-TH", timeout: int = 300) -> SegmentResult:
        url = (
            f"{self.endpoint.replace('https://', 'https://')}"
            .replace("api.cognitive.microsoft.com", "stt.speech.microsoft.com")
            + f"/speech/recognition/conversation/cognitiveservices/v1?language={language}&format=detailed"
        )
        req = urllib.request.Request(url, data=wav.read_bytes(), method="POST")
        req.add_header("Ocp-Apim-Subscription-Key", self.key)
        req.add_header("Content-Type", "audio/wav; codecs=audio/pcm; samplerate=16000")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))

        status = str(data.get("RecognitionStatus") or "")
        display = collapse_ws(data.get("DisplayText") or "")
        best = (data.get("NBest") or [{}])[0] or {}
        spaced = collapse_ws(best.get("ITN") or best.get("Lexical") or display)
        offset = to_sec(data.get("Offset")) / AZURE_TICKS
        duration = to_sec(data.get("Duration")) / AZURE_TICKS
        if status != "Success" or not display:
            return SegmentResult(text="", spaced="", raw=data)
        return SegmentResult(text=display, spaced=spaced or display, offset=offset, duration=duration, raw=data)


class OpenAICompatibleEngine(Engine):
    """任何 OpenAI 兼容的 /audio/transcriptions（whisper.cpp server / faster-whisper 等）。"""

    name = "openai"
    native_segments = True

    def __init__(self, base_url: str, api_key: str = "", model: str = "whisper-1") -> None:
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key or ""
        self.model = model or "whisper-1"

    def available(self) -> Tuple[bool, str]:
        if not self.base_url:
            return False, "未配置 --asr-base-url"
        return True, ""

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def transcribe(self, wav: Path, *, language: str = "th", timeout: int = 300) -> SegmentResult:
        data = http_multipart(
            f"{self.base_url}/audio/transcriptions",
            {"model": self.model, "language": language, "response_format": "json"},
            "file",
            wav,
            self._headers(),
            timeout=timeout,
        )
        text = collapse_ws(data.get("text") if isinstance(data, dict) else data)
        return SegmentResult(text=strip_ws(text), spaced=text, raw=data if isinstance(data, dict) else {})

    def transcribe_native(self, wav: Path, *, language: str = "th", timeout: int = 300) -> List[Dict[str, Any]]:
        data = http_multipart(
            f"{self.base_url}/audio/transcriptions",
            {
                "model": self.model,
                "language": language,
                "response_format": "verbose_json",
                "timestamp_granularities[]": "segment",
            },
            "file",
            wav,
            self._headers(),
            timeout=timeout,
        )
        segments = (data or {}).get("segments") if isinstance(data, dict) else None
        if not segments:
            return []
        out = []
        for seg in segments:
            text = collapse_ws(seg.get("text"))
            if text:
                out.append({"start": to_sec(seg.get("start")), "end": to_sec(seg.get("end")),
                            "text": strip_ws(text), "spaced": text})
        return out


class Qwen3LocalEngine(Engine):
    """本机/服务器上的 Qwen3-ASR（Apache-2.0，官方支持泰语）。

    时间轴同样由静音切分提供（Qwen3 的词级时间戳依赖 ForcedAligner，而它不支持泰语）。
    需要：pip install -U qwen-asr（GPU 推荐，CPU 可跑但慢）。
    """

    name = "qwen3"

    def __init__(self, model: str = "Qwen/Qwen3-ASR-1.7B", device: str = "cuda:0", use_vllm: bool = False) -> None:
        self.model_id = model
        self.device = device
        self.use_vllm = use_vllm
        self._model = None

    def available(self) -> Tuple[bool, str]:
        try:
            import qwen_asr  # noqa: F401
        except Exception as exc:  # pragma: no cover - 依赖环境
            return False, f"未安装 qwen-asr（pip install -U qwen-asr）：{exc}"
        return True, ""

    def _load(self):
        if self._model is not None:
            return self._model
        from qwen_asr import Qwen3ASRModel  # type: ignore

        kwargs: Dict[str, Any] = {"max_inference_batch_size": 8, "max_new_tokens": 1024}
        if self.use_vllm:
            self._model = Qwen3ASRModel.LLM(model=self.model_id, gpu_memory_utilization=0.7, **kwargs)
        else:
            import torch  # type: ignore

            self._model = Qwen3ASRModel.from_pretrained(
                self.model_id, dtype=torch.bfloat16, device_map=self.device, **kwargs
            )
        return self._model

    def transcribe(self, wav: Path, *, language: str = "Thai", timeout: int = 600) -> SegmentResult:
        model = self._load()
        results = model.transcribe(audio=str(wav), language=language)
        item = results[0] if isinstance(results, (list, tuple)) and results else results
        text = collapse_ws(getattr(item, "text", "") or "")
        return SegmentResult(text=strip_ws(text), spaced=text, raw={"language": getattr(item, "language", None)})


class MockEngine(Engine):
    """离线自测用：不联网、不出网，产出确定的泰语句子。"""

    name = "mock"
    SAMPLE = [
        "สวัสดีครับ",
        "ยินดีต้อนรับสู่บทเรียนภาษาไทย",
        "วันนี้เราจะมาเรียนรู้ไปด้วยกัน",
        "ฟังและพูดตามได้เลยครับ",
        "ถ้ามีคำศัพท์ใหม่ ๆ ให้จดไว้ก่อน",
    ]

    def __init__(self, seed: int = 0) -> None:
        self.seed = seed

    def transcribe(self, wav: Path, *, language: str = "th", timeout: int = 10) -> SegmentResult:
        text = self.SAMPLE[self.seed % len(self.SAMPLE)]
        self.seed += 1
        return SegmentResult(text=strip_ws(text), spaced=text, offset=0.1, duration=1.2, raw={"mock": True})


# ---------------------------------------------------------------- 翻译

# 与后端 backend/aiProvider.js 的 isUsableKey() 同口径：占位符/非 ASCII 一律视为没配
PLACEHOLDER_HINTS = ("your_api_key", "your-api-key", "placeholder", "changeme", "在此", "填入", "替换")


def is_usable_key(value: str, *, min_len: int = 16) -> bool:
    text = str(value or "").strip()
    if len(text) < min_len:
        return False
    try:
        text.encode("ascii")
    except UnicodeEncodeError:
        return False  # 中文占位符会卡在这里（HTTP 头只能 latin-1）
    if any(ch.isspace() for ch in text):
        return False
    low = text.lower()
    return not any(hint in low or hint in text for hint in PLACEHOLDER_HINTS)


def key_problem(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return "未配置"
    try:
        text.encode("ascii")
    except UnicodeEncodeError:
        return "仍是占位符（含非 ASCII 字符）"
    if len(text) < 16:
        return f"长度异常（{len(text)} 字符）"
    if any(ch.isspace() for ch in text):
        return "含空白字符"
    return ""


class Translator:
    """用项目现有的 OpenAI 兼容网关做中译（AI_BASE_URL / AI_API_KEY，或 DEEPSEEK_API_KEY）。"""

    def __init__(self, base_url: str, api_key: str, model: str, *, timeout: int = 120, label: str = "") -> None:
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key or ""
        self.model = model or ""
        self.timeout = timeout
        self.label = label or "translator"
        self.used = False
        self.broken = False
        self.last_error = ""

    def available(self) -> Tuple[bool, str]:
        if not self.base_url:
            return False, "未配置翻译 base_url"
        problem = key_problem(self.api_key)
        if problem:
            return False, f"翻译密钥不可用（{problem}）"
        if not self.model:
            return False, "未配置翻译模型"
        return True, ""

    def _chat(self, prompt: str) -> str:
        if self.broken:
            raise RuntimeError(self.last_error or "翻译已中止")
        data = http_json(
            f"{self.base_url}/chat/completions",
            {
                "model": self.model,
                "temperature": 0,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是泰语教学网站的字幕译者。只输出要求的格式，不要解释、不要加标点以外的内容。",
                    },
                    {"role": "user", "content": prompt},
                ],
            },
            {"Authorization": f"Bearer {self.api_key}"},
            timeout=self.timeout,
        )
        self.used = True
        return str(((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()

    @staticmethod
    def _parse(raw: str, expected: int) -> Dict[int, str]:
        out: Dict[int, str] = {}
        try:
            start, end = raw.find("{"), raw.rfind("}")
            if start >= 0 and end > start:
                obj = json.loads(raw[start : end + 1])
                for key, value in obj.items():
                    try:
                        out[int(str(key).strip())] = str(value).strip()
                    except (TypeError, ValueError):
                        continue
        except json.JSONDecodeError:
            pass
        if not out:
            for line in raw.splitlines():
                match = re.match(r"^\s*(?:[-*]\s*)?(\d+)\s*[.、:：)\]]\s*(.+?)\s*$", line)
                if match:
                    out[int(match.group(1))] = match.group(2).strip()
        del expected
        return out

    def translate(self, texts: Sequence[str], *, batch_size: int = 20) -> List[str]:
        results: List[str] = ["" for _ in texts]
        for start in range(0, len(texts), batch_size):
            if self.broken:
                break
            chunk = list(texts[start : start + batch_size])
            numbered = "\n".join(f"{idx + 1}. {text}" for idx, text in enumerate(chunk))
            prompt = (
                "把下面每条泰语字幕翻译成自然的简体中文（面向中文泰语学习者，直译优先、不要意译发挥）。\n"
                "严格输出 JSON 对象：键是序号，值是一句中文，不加任何解释。\n\n" + numbered
            )
            try:
                mapping = self._parse(self._chat(prompt), len(chunk))
            except Exception as exc:
                # 鉴权/网络类问题：中止并只报一次，不再逐条刷警告
                self.broken = True
                self.last_error = f"{type(exc).__name__}: {exc}"
                log.warning("翻译中止（%s）：%s", self.label, self.last_error)
                break
            missing = [idx for idx, _ in enumerate(chunk) if not mapping.get(idx + 1)]
            for idx, _ in enumerate(chunk):
                if mapping.get(idx + 1):
                    results[start + idx] = mapping[idx + 1]
            if not missing or len(missing) > len(chunk) / 2:
                continue
            for idx in missing:  # 只有少量缺失时才逐条重试
                try:
                    single = self._parse(
                        self._chat("把这条泰语字幕翻译成简体中文，只输出译文：\n" + chunk[idx]), 1
                    )
                    results[start + idx] = single.get(1, "") or next(iter(single.values()), "")
                except Exception as exc:
                    self.broken = True
                    self.last_error = f"{type(exc).__name__}: {exc}"
                    log.warning("翻译中止（%s）：%s", self.label, self.last_error)
                    break
        return results


# ---------------------------------------------------------------- 流水线


@dataclass
class PipelineConfig:
    engine: Engine
    engine_label: str
    language: str
    aws_language: str = ""
    max_len: int = 30
    refine: str = "auto"
    segment_mode: str = "auto"
    noise_db: float = -35.0
    min_silence: float = 0.45
    min_seg: float = 0.5
    pad: float = 0.12
    max_seg: float = 10.0
    translator: Optional[Translator] = None
    reference: str = ""
    keep_temp: bool = False
    dry_run: bool = False
    timeout: int = 300
    thai_text: str = "spaced"


def load_subtitle_refine():
    """优先复用仓库根目录的 subtitle_refine.py（它未入库，缺失时不报错）。"""
    try:
        import subtitle_refine  # type: ignore

        return subtitle_refine
    except Exception:
        return None


def builtin_merge(cues: List[Dict[str, Any]], *, merge_gap: float = 0.35, max_chars: int = 400) -> List[Dict[str, Any]]:
    """subtitle_refine 缺失时的兜底归并：去重 + 滚动重叠去重 + 小间隙合并。"""
    merged: List[Dict[str, Any]] = []
    for cue in sorted((dict(c) for c in cues), key=lambda c: c["start"]):
        text = collapse_ws(cue.get("text"))
        if not text:
            continue
        cur = {"start": float(cue["start"]), "end": float(cue["end"]), "text": text,
               "spaced": collapse_ws(cue.get("spaced") or text)}
        if not merged:
            merged.append(cur)
            continue
        prev = merged[-1]
        prev_norm, cur_norm = strip_ws(prev["text"]), strip_ws(cur["text"])
        if cur_norm == prev_norm:
            prev["end"] = max(prev["end"], cur["end"])
            continue
        overlap = 0
        for size in range(min(len(prev_norm), len(cur_norm)), 0, -1):
            if prev_norm[-size:] == cur_norm[:size]:
                overlap = size
                break
        if overlap >= max(6, int(len(cur_norm) * 0.45)) or overlap == len(cur_norm):
            delta = prev["spaced"] + cur["spaced"][overlap:] if overlap < len(cur["spaced"]) else prev["spaced"]
            if len(strip_ws(delta)) <= max_chars:
                prev["text"] = delta
                prev["spaced"] = delta
                prev["end"] = max(prev["end"], cur["end"])
                continue
        if cur["start"] - prev["end"] <= merge_gap:
            combined = prev["spaced"] + " " + cur["spaced"]
            if len(strip_ws(combined)) <= max_chars:
                prev["text"] = combined
                prev["spaced"] = combined
                prev["end"] = max(prev["end"], cur["end"])
                continue
        merged.append(cur)
    return merged


def process_one(source: Path, out_dir: Path, cfg: PipelineConfig, *, job_id: str = "") -> Dict[str, Any]:
    started = time.time()
    file_id = job_id or source.stem
    report: Dict[str, Any] = {
        "input": str(source),
        "id": file_id,
        "engine": cfg.engine_label,
        "language": cfg.language,
        "outputs": {},
        "warnings": [],
    }

    with tempfile.TemporaryDirectory(prefix="thai-asr-") as tmp:
        tmp_dir = Path(tmp)
        wav = tmp_dir / f"{file_id}.16k.wav"
        extract_wav(source, wav)
        duration = probe_duration(wav)
        report["audio_duration"] = round(duration, 3)
        if duration <= 0:
            report["warnings"].append("无法读取音频时长，时间轴可能不准")

        segments: List[Tuple[float, float]] = []
        words: List[str] = []
        cues: List[Dict[str, Any]] = []

        native_used = False
        if cfg.segment_mode in ("auto", "engine") and getattr(cfg.engine, "native_segments", False):
            try:
                native = cfg.engine.transcribe_native(wav, language=cfg.aws_language or cfg.language, timeout=cfg.timeout)
            except Exception as exc:
                native = []
                report["warnings"].append(f"引擎原生时间戳失败，改用静音切分：{exc}")
            if native:
                native_used = True
                for seg in native:
                    cues.append(seg)
                    words.extend(
                        w for w in collapse_ws(seg.get("spaced") or seg.get("text")).split() if strip_ws(w)
                    )

        if not native_used:
            if duration <= 0:
                die("音频时长为 0，无法切分")
            segments = silence_segments(
                wav,
                duration=duration,
                noise_db=cfg.noise_db,
                min_silence=cfg.min_silence,
                min_seg=cfg.min_seg,
                pad=cfg.pad,
                max_seg=cfg.max_seg,
            )
            report["segments"] = len(segments)
            if any((end - start) >= cfg.max_seg - 1e-6 for start, end in segments):
                report["warnings"].append(
                    f"存在超过 {cfg.max_seg:g}s 的连续语音，已均分成小块：这些块的句内时间轴是按字数比例估算的"
                )
            if len(segments) == 1:
                report["warnings"].append("整段无静音：时间轴为按字数比例估算，建议人工微调")
            empty_segments = 0
            for idx, (seg_start, seg_end) in enumerate(segments):
                piece = tmp_dir / f"seg{idx:04d}.wav"
                slice_wav(wav, seg_start, seg_end, piece)
                try:
                    result = cfg.engine.transcribe(piece, language=cfg.aws_language or cfg.language, timeout=cfg.timeout)
                except urllib.error.HTTPError as exc:
                    detail = ""
                    try:
                        detail = exc.read().decode("utf-8", "replace")[:200]
                    except Exception:
                        pass
                    report["warnings"].append(f"第 {idx} 段识别失败 HTTP {exc.code} {detail}")
                    continue
                except Exception as exc:
                    report["warnings"].append(f"第 {idx} 段识别失败：{exc}")
                    continue
                if not strip_ws(result.text):
                    empty_segments += 1
                    continue
                for word in (result.spaced or result.text).split():
                    if strip_ws(word):
                        words.append(strip_ws(word))
                start = seg_start + (result.offset if result.duration else 0.0)
                end = start + (result.duration or (seg_end - seg_start))
                cues.append({
                    "start": max(seg_start, start),
                    "end": min(seg_end + cfg.pad, end) if result.duration else seg_end,
                    "text": result.spaced or result.text,
                    "spaced": result.spaced or result.text,
                })
                if cfg.keep_temp:
                    out_dir.mkdir(parents=True, exist_ok=True)
                    piece.rename(out_dir / f"{file_id}.seg{idx:04d}.wav")
            if empty_segments:
                report["empty_segments"] = empty_segments
                report["warnings"].append(
                    f"{empty_segments} 个语音段没有识别结果（可能是噪声段或识别超时），已跳过"
                )

        report["cues_raw"] = len(cues)
        if not cues:
            report["ok"] = False
            report["warnings"].append("没有识别到任何文本（检查语言/引擎配置）")
            report["elapsed"] = round(time.time() - started, 2)
            return report

        # 1) 归并（复用仓库的 subtitle_refine.py；max_len 放大，交给后面的泰语断句）
        refine_mod = load_subtitle_refine()
        merged: List[Dict[str, Any]]
        if cfg.refine != "off" and refine_mod is not None:
            try:
                parsed = [{"start": c["start"], "end": c["end"], "text": c["spaced"]} for c in cues]
                refined = refine_mod.refine_cues(parsed, max_len=max(cfg.max_len * 8, 200), merge_gap=0.35, logger=log)
                merged = [{"start": c["start"], "end": c["end"], "text": c["text"], "spaced": c["text"]} for c in refined]
                report["refine"] = "subtitle_refine.refine_cues"
            except Exception as exc:
                report["warnings"].append(f"subtitle_refine 归并失败，改用内置归并：{exc}")
                merged = builtin_merge(cues)
                report["refine"] = "builtin(fallback)"
        else:
            merged = builtin_merge(cues)
            report["refine"] = "builtin" if cfg.refine == "off" else "builtin(subtitle_refine 缺失)"
        report["cues_merged"] = len(merged)

        # 2) 把泰语词间空格贴回去（refine 会把空白全删掉）
        spaced_words = words or [w for c in merged for w in collapse_ws(c.get("spaced")).split()]
        spaced_words = [strip_ws(w) for w in spaced_words if strip_ws(w)]
        for cue in merged:
            cue["text"] = respace(cue["text"], spaced_words)

        # 3) 泰语断句 + 时间轴收尾
        split = split_long_cues(merged, cfg.max_len)
        final = tidy_cues(split)
        report["cues_final"] = len(final)
        report["chars"] = sum(cue_norm_len(c["text"]) for c in final)
        report["avg_cue_chars"] = round(report["chars"] / len(final), 1) if final else 0
        report["speech_ratio"] = (
            round(sum(c["end"] - c["start"] for c in final) / duration, 3) if duration else None
        )
        if report["speech_ratio"] is not None and report["speech_ratio"] < 0.45:
            report["warnings"].append(
                f"识别只覆盖约 {report['speech_ratio'] * 100:.0f}% 的音频时长，可能有漏句"
                "（可调 --noise-db / --min-silence，或换引擎复核）"
            )

        # 4) 中文翻译
        if cfg.translator is not None and not cfg.dry_run:
            ok, reason = cfg.translator.available()
            if ok:
                zh = cfg.translator.translate([c["text"] for c in final])
                filled = 0
                for cue, text in zip(final, zh):
                    cue["zh"] = text
                    filled += 1 if text else 0
                report["translate"] = {
                    "provider": cfg.translator.label,
                    "model": cfg.translator.model,
                    "filled": filled,
                    "total": len(final),
                }
                if cfg.translator.last_error:
                    report["translate"]["error"] = cfg.translator.last_error
                    report["warnings"].append(
                        f"翻译中止（{cfg.translator.last_error}）：中文轨不完整，修好出口后重跑本文件"
                    )
                elif filled < len(final):
                    report["warnings"].append(f"{len(final) - filled} 条未翻译（留空，可重跑）")
            else:
                report["translate"] = {"skipped": reason}
                report["warnings"].append(f"未翻译：{reason}")

        # 5) CER
        if cfg.reference:
            report["cer"] = cer(cfg.reference, "".join(strip_ws(c["text"]) for c in final))

        # 6) 落盘
        if cfg.dry_run:
            report["ok"] = True
            report["elapsed"] = round(time.time() - started, 2)
            return report

        out_dir.mkdir(parents=True, exist_ok=True)
        th_vtt = out_dir / f"{file_id}.th.vtt"
        th_srt = out_dir / f"{file_id}.th.srt"
        bi_srt = out_dir / f"{file_id}.bilingual.srt"
        th_vtt.write_text(render_vtt(final, "text"), encoding="utf-8")
        th_srt.write_text(render_srt(final, "text"), encoding="utf-8")
        bi_srt.write_text(render_bilingual_srt(final), encoding="utf-8")
        report["outputs"]["th_vtt"] = str(th_vtt)
        report["outputs"]["th_srt"] = str(th_srt)
        report["outputs"]["bilingual_srt"] = str(bi_srt)

        if any(c.get("zh") for c in final):
            zh_vtt = out_dir / f"{file_id}.zh.vtt"
            zh_vtt.write_text(render_vtt(final, "zh"), encoding="utf-8")
            report["outputs"]["zh_vtt"] = str(zh_vtt)

        report_path = out_dir / f"{file_id}.report.json"
        report["outputs"]["report"] = str(report_path)

    report["ok"] = True
    report["elapsed"] = round(time.time() - started, 2)
    try:
        Path(report["outputs"]["report"]).write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        report["warnings"].append(f"报告写入失败：{exc}")
    return report


# ---------------------------------------------------------------- CLI


def build_engine(args: argparse.Namespace) -> Tuple[Engine, str]:
    engine = (args.engine or "auto").lower()
    env = os.environ
    if engine == "auto":
        if env.get("SPEECH_KEY") and (env.get("SPEECH_REGION") or env.get("SPEECH_ENDPOINT")):
            engine = "azure"
        elif args.asr_base_url:
            engine = "openai"
        elif shutil.which("ffmpeg"):
            engine = "mock"
        else:
            die("无法自动选择引擎：请显式指定 --engine")

    if engine == "azure":
        inst = AzureEngine(
            key=args.speech_key or env.get("SPEECH_KEY", ""),
            region=args.speech_region or env.get("SPEECH_REGION", ""),
            endpoint=args.speech_endpoint or env.get("SPEECH_ENDPOINT", ""),
        )
        label = f"azure({inst.endpoint or 'unset'})"
    elif engine == "openai":
        inst = OpenAICompatibleEngine(
            base_url=args.asr_base_url or env.get("TRANSCRIBE_API_URL", ""),
            api_key=args.asr_api_key or env.get("TRANSCRIBE_API_KEY", ""),
            model=args.asr_model,
        )
        label = f"openai({inst.base_url or 'unset'})"
    elif engine == "qwen3":
        inst = Qwen3LocalEngine(model=args.qwen_model, device=args.qwen_device, use_vllm=args.qwen_vllm)
        label = f"qwen3({args.qwen_model})"
    elif engine == "mock":
        inst = MockEngine()
        label = "mock"
    else:
        die(f"未知引擎：{engine}")
        raise AssertionError  # pragma: no cover

    ok, reason = inst.available()
    if not ok:
        die(f"引擎 {engine} 不可用：{reason}")
    return inst, label


def build_translator(args: argparse.Namespace) -> Optional[Translator]:
    if args.no_translate:
        return None
    env = os.environ

    if args.translate_base_url or args.translate_api_key or args.translate_model:
        candidates = [(args.translate_base_url, args.translate_api_key, args.translate_model, "命令行参数")]
    else:
        candidates = [
            (env.get("AI_BASE_URL", ""), env.get("AI_API_KEY", ""), env.get("AI_MODEL", ""),
             "AI_BASE_URL / AI_API_KEY"),
            (env.get("DEEPSEEK_BASE_URL", "") or "https://api.deepseek.com/v1",
             env.get("DEEPSEEK_API_KEY", ""),
             env.get("DEEPSEEK_MODEL", "") or "deepseek-chat",
             "DEEPSEEK_API_KEY"),
        ]

    rejected: List[str] = []
    for base_url, api_key, model, label in candidates:
        if not base_url:
            rejected.append(f"{label}：未配置 base_url")
            continue
        problem = key_problem(api_key)
        if problem:
            rejected.append(f"{label}：密钥{problem}")
            continue
        if not model:
            rejected.append(f"{label}：未配置模型")
            continue
        if rejected:
            log.warning("翻译已跳过不可用的候选：%s", "；".join(rejected))
        if model and "deepseek" in (base_url or "") and "agnes" in model:
            model = "deepseek-chat"  # 换到 DeepSeek 域名时别沿用别的网关的模型名
        return Translator(base_url, api_key, model, timeout=args.translate_timeout, label=label)

    log.warning("未配置可用的翻译出口，跳过中文轨：%s", "；".join(rejected) or "无候选")
    return None


def collect_inputs(paths: Sequence[str]) -> List[Path]:
    files: List[Path] = []
    for raw in paths:
        path = Path(raw).expanduser()
        if path.is_dir():
            for item in sorted(path.rglob("*")):
                if item.is_file() and item.suffix.lower() in MEDIA_EXT:
                    files.append(item)
        elif path.is_file():
            files.append(path)
        else:
            die(f"找不到输入：{path}")
    return files


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="thai_asr_subtitles.py",
        description="泰语音频/视频 → 泰语 + 中文双语 VTT 字幕（供 ThaiAI 播放器直接使用）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("inputs", nargs="+", help="音频/视频文件或目录")
    parser.add_argument("--id", default="", help="输出文件名（仅单文件输入时有效）")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help=f"输出目录（默认 {DEFAULT_OUT_DIR}）")
    parser.add_argument("--engine", default="auto", choices=["auto", "azure", "openai", "qwen3", "mock"])
    parser.add_argument("--language", default="", help="引擎语言参数（默认 azure: th-TH，其余: th/Thai）")
    parser.add_argument("--max-len", type=int, default=30, help="单条字幕最大字数（默认 30）")
    parser.add_argument("--refine", default="auto", choices=["auto", "on", "off"],
                        help="是否用仓库的 subtitle_refine.py 做归并（off=只用内置归并）")
    parser.add_argument("--segment-mode", default="auto", choices=["auto", "silence", "engine"],
                        help="时间轴来源：silence=静音切分；engine=引擎原生时间戳")
    parser.add_argument("--noise-db", type=float, default=-35.0, help="静音判定阈值（默认 -35dB）")
    parser.add_argument("--min-silence", type=float, default=0.45, help="判定为停顿的最短静音（默认 0.45s）")
    parser.add_argument("--pad", type=float, default=0.12, help="语音段前后留白（默认 0.12s）")
    parser.add_argument("--max-segment", type=float, default=10.0, help="单次请求最长音频秒数（默认 20s）")
    parser.add_argument("--thai-text", default="spaced", choices=["spaced", "display"],
                        help="泰语文本形态：spaced=保留词间空格（学习友好，默认）")

    parser.add_argument("--speech-key", default="", help="Azure 语音密钥（默认读 SPEECH_KEY）")
    parser.add_argument("--speech-region", default="", help="Azure 区域（默认读 SPEECH_REGION）")
    parser.add_argument("--speech-endpoint", default="", help="Azure 端点（默认读 SPEECH_ENDPOINT）")
    parser.add_argument("--asr-base-url", default="", help="OpenAI 兼容 ASR 服务（默认读 TRANSCRIBE_API_URL）")
    parser.add_argument("--asr-api-key", default="", help="OpenAI 兼容 ASR 密钥（默认读 TRANSCRIBE_API_KEY）")
    parser.add_argument("--asr-model", default="whisper-1", help="ASR 模型名")
    parser.add_argument("--qwen-model", default="Qwen/Qwen3-ASR-1.7B", help="Qwen3-ASR 模型 id")
    parser.add_argument("--qwen-device", default="cuda:0", help="Qwen3-ASR 设备（CPU 用 cpu）")
    parser.add_argument("--qwen-vllm", action="store_true", help="Qwen3-ASR 用 vLLM 后端")
    parser.add_argument("--timeout", type=int, default=300, help="单次识别请求超时秒数")

    parser.add_argument("--no-translate", action="store_true", help="不生成中文轨")
    parser.add_argument("--translate-base-url", default="", help="翻译网关（默认 AI_BASE_URL）")
    parser.add_argument("--translate-api-key", default="", help="翻译密钥（默认 AI_API_KEY / DEEPSEEK_API_KEY）")
    parser.add_argument("--translate-model", default="", help="翻译模型（默认 AI_MODEL）")
    parser.add_argument("--translate-timeout", type=int, default=120)

    parser.add_argument("--reference", default="", help="泰语参考文本文件，用于计算 CER")
    parser.add_argument("--keep-temp", action="store_true", help="保留切片 wav 到输出目录")
    parser.add_argument("--dry-run", action="store_true",
                        help="跑完整识别与断句，但不翻译、不写文件（想先看断句/字数时用）")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )

    files = collect_inputs(args.inputs)
    if not files:
        die("没有找到可处理的音频/视频文件")
    if args.id and len(files) > 1:
        die("--id 只能用于单个输入文件")

    engine, label = build_engine(args)
    translator = build_translator(args)
    out_dir = Path(args.out_dir).expanduser()
    language = args.language or ("th-TH" if engine.name == "azure" else "Thai")

    reference = ""
    if args.reference:
        ref_path = Path(args.reference)
        if not ref_path.is_file():
            die(f"参考文本不存在：{ref_path}")
        reference = ref_path.read_text(encoding="utf-8", errors="replace")

    cfg = PipelineConfig(
        engine=engine,
        engine_label=label,
        language=language,
        max_len=args.max_len,
        refine=args.refine,
        segment_mode=args.segment_mode,
        noise_db=args.noise_db,
        min_silence=args.min_silence,
        pad=args.pad,
        max_seg=args.max_segment,
        translator=translator,
        reference=reference,
        keep_temp=args.keep_temp,
        dry_run=args.dry_run,
        timeout=args.timeout,
        thai_text=args.thai_text,
    )

    failures = 0
    for idx, source in enumerate(files, start=1):
        log.info("[%d/%d] %s", idx, len(files), source.name)
        try:
            report = process_one(source, out_dir, cfg, job_id=args.id)
        except SystemExit:
            raise
        except Exception as exc:
            failures += 1
            log.error("处理失败 %s：%s", source.name, exc)
            continue
        if not report.get("ok"):
            failures += 1
            log.error("识别为空：%s（%s）", source.name, "；".join(report.get("warnings") or []) or "无文本")
            continue
        info = [f"段 {report.get('cues_raw', 0)}→{report.get('cues_final', 0)}",
                f"{report.get('chars', 0)} 字"]
        if report.get("cer"):
            info.append(f"CER {report['cer']['cer'] * 100:.2f}%")
        if report.get("elapsed"):
            info.append(f"{report['elapsed']}s")
        log.info("  ✓ %s", " / ".join(info))
        for warning in report.get("warnings") or []:
            log.warning("  ! %s", warning)
        if report.get("outputs", {}).get("th_vtt"):
            log.info("  → %s", report["outputs"]["th_vtt"])
            log.info("  课程数据写：subtitleUrlTh: \"/subtitles/%s.th.vtt\"", report["id"])
            if report["outputs"].get("zh_vtt"):
                log.info("              subtitleUrl:   \"/subtitles/%s.zh.vtt\"", report["id"])

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
