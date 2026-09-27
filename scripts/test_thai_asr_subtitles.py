#!/usr/bin/env python3
"""thai_asr_subtitles.py 的自测（离线，不消耗任何 API 额度）

覆盖：
  1. 纯函数：时间戳格式、泰语断句、respace、时间轴收尾、CER、内置归并
  2. 静音切分（真实 ffmpeg + 合成音频）
  3. 端到端：本地 stub 服务扮演 OpenAI 兼容 ASR + 翻译网关，
     通过 main() 完整跑一遍「抽音频 → 识别 → subtitle_refine 归并 →
     贴空格 → 断句 → 翻译 → 写 vtt/srt/report」，并校验产物格式

跑法：
    python3 scripts/test_thai_asr_subtitles.py
    # 或：python3 -m unittest discover -s scripts -p "test_thai_asr_subtitles.py"
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import thai_asr_subtitles as tas  # noqa: E402

TH_TEXT = "สวัสดีครับ ยินดีต้อนรับ สู่บทเรียนภาษาไทย วันนี้เราจะมาเรียนรู้ไปด้วยกัน"
SEGMENTS = [
    {"start": 0.0, "end": 2.6, "text": "สวัสดีครับ ยินดีต้อนรับ"},
    {"start": 2.8, "end": 6.4, "text": "สู่บทเรียนภาษาไทย วันนี้เราจะมาเรียนรู้ไปด้วยกัน"},
]

HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


# ---------------------------------------------------------------- stub 服务


class _StubHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # 静音
        return

    def _send(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)

        if self.path.endswith("/audio/transcriptions"):
            if b"verbose_json" in body:
                self._send({"text": TH_TEXT, "segments": SEGMENTS})
            else:
                # 单切片模式（Azure 同款调用形态）：返回带空格的泰语
                self._send({"text": "สวัสดีครับ"})
            return

        if self.path.endswith("/chat/completions"):
            data = json.loads(body.decode("utf-8"))
            prompt = str((data.get("messages") or [{}])[-1].get("content") or "")
            pairs = re.findall(r"^(\d+)\.\s*(.+)$", prompt, re.M)
            mapping = {num: f"中文{num}" for num, _ in pairs}
            self._send({"choices": [{"message": {"content": json.dumps(mapping, ensure_ascii=False)}}]})
            return

        self._send({"error": "not found"}, status=404)


class StubServer:
    def __init__(self) -> None:
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), _StubHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self) -> str:
        self.thread.start()
        host, port = self.httpd.server_address[:2]
        return f"http://{host}:{port}/v1"

    def __exit__(self, *exc) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


def make_test_audio(path: Path) -> None:
    """3s 音 + 1s 静音 + 3s 音，用于静音切分测试。"""
    ffmpeg = shutil.which("ffmpeg")
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
        "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono:d=1",
        "-f", "lavfi", "-i", "sine=frequency=660:duration=3",
        "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 生成测试音频失败：{proc.stderr[:300]}")


class EnvGuard(unittest.TestCase):
    """测试期间清掉真实密钥环境变量，确保绝不误打真实 API。"""

    ENV_KEYS = ("SPEECH_KEY", "SPEECH_REGION", "SPEECH_ENDPOINT", "TRANSCRIBE_API_URL",
                "TRANSCRIBE_API_KEY", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "DEEPSEEK_API_KEY")

    def setUp(self) -> None:
        self._saved = {key: os.environ.pop(key, None) for key in self.ENV_KEYS}

    def tearDown(self) -> None:
        for key, value in self._saved.items():
            if value is not None:
                os.environ[key] = value


# ---------------------------------------------------------------- 纯函数


class TestHelpers(unittest.TestCase):
    def test_timestamps(self):
        self.assertEqual(tas.srt_ts(0), "00:00:00,000")
        self.assertEqual(tas.srt_ts(3661.5), "01:01:01,500")
        self.assertEqual(tas.vtt_ts(0), "00:00.000")
        self.assertEqual(tas.vtt_ts(65.25), "01:05.250")
        self.assertEqual(tas.vtt_ts(3725.5), "01:02:05.500")

    def test_strip_and_collapse(self):
        self.assertEqual(tas.strip_ws("สวัสดี ครับ\n"), "สวัสดีครับ")
        self.assertEqual(tas.collapse_ws("  สวัสดี   ครับ  "), "สวัสดี ครับ")

    def test_cer_identical_and_partial(self):
        same = tas.cer("สวัสดีครับ", "สวัสดีครับ")
        self.assertEqual(same["cer"], 0.0)
        partial = tas.cer("สวัสดีครับ", "สวัสดี")
        self.assertEqual(partial["edits"], 4)
        self.assertAlmostEqual(partial["cer"], 0.4, places=6)

    def test_split_long_cues_keeps_text_and_bounds(self):
        text = "สวัสดีครับ ยินดีต้อนรับสู่บทเรียนภาษาไทย วันนี้เราจะมาเรียนรู้ไปด้วยกันกับอาจารย์"
        cues = [{"start": 0.0, "end": 10.0, "text": text}]
        out = tas.split_long_cues(cues, max_len=20)
        self.assertGreater(len(out), 1)
        for cue in out:
            # 允许 +2 的超长：断句点会避让组合符号，不拆散泰语音节
            self.assertLessEqual(tas.cue_norm_len(cue["text"]), 22)
        self.assertEqual("".join(tas.strip_ws(c["text"]) for c in out), tas.strip_ws(text))
        for prev, cur in zip(out, out[1:]):
            self.assertLessEqual(prev["end"], cur["start"] + 1e-9)
        self.assertAlmostEqual(out[0]["start"], 0.0, places=6)
        self.assertAlmostEqual(out[-1]["end"], 10.0, places=6)

    def test_split_prefers_spaces(self):
        text = "หนึ่ง สอง สาม สี่ ห้า หก เจ็ด แปด เก้า สิบ"
        out = tas.split_long_cues([{"start": 0, "end": 10, "text": text}], max_len=12)
        for cue in out:
            self.assertFalse(cue["text"].startswith(" "), f"cue 以空格开头：{cue['text']!r}")
            self.assertFalse(cue["text"].endswith(" "), f"cue 以空格结尾：{cue['text']!r}")

    def test_split_never_breaks_before_combining_mark(self):
        # 硬切时绝不能把声调/元音符号与基辅音拆到两条字幕
        text = "กำ" * 12 + " " + "กี้" * 6
        out = tas.split_long_cues([{"start": 0, "end": 10, "text": text}], max_len=7)
        self.assertGreater(len(out), 2)
        for cue in out:
            self.assertNotIn(cue["text"][0], tas.THAI_COMBINING,
                             f"字幕以组合符号开头：{cue['text']!r}")
            # 避开组合符号带来的轻微超长是允许的（宁可略长，也不拆散音节）
            self.assertLessEqual(tas.cue_norm_len(cue["text"]), 9)
        self.assertEqual("".join(tas.strip_ws(c["text"]) for c in out), tas.strip_ws(text))

    def test_respace_roundtrip(self):
        words = ["สวัสดีครับ", "ยินดีต้อนรับ", "สู่บทเรียนภาษาไทย"]
        stripped = "".join(words)
        self.assertEqual(tas.respace(stripped, words), " ".join(words))

    def test_respace_never_changes_characters(self):
        # 不论词序对不对得上，都只能动空格，绝不能改字
        cases = [
            ("สวัสดีครับ", ["ภาษาไทย", "สวัสดี"]),
            ("สวัสดีครับยินดีต้อนรับ", ["สวัสดีครับ", "ยินดีต้อนรับ"]),
            ("ข้อความที่ไม่ได้อยู่ในรายการคำ", ["หนึ่ง", "สอง"]),
            ("สวัสดีครับ", []),
        ]
        for text, words in cases:
            with self.subTest(text=text):
                self.assertEqual(tas.strip_ws(tas.respace(text, words)), tas.strip_ws(text))

    def test_respace_falls_back_when_alignment_drifts(self):
        text = "ข้อความนี้ไม่ตรงกับคำใดในรายการเลยสักคำ"
        self.assertEqual(tas.respace(text, ["หนึ่ง", "สอง"]), text)

    def test_respace_does_not_split_unmatched_runs(self):
        # 未匹配的字符必须留在同一段里，不能被逐字粘空格
        out = tas.respace("สวัสดีครับ", ["ภาษาไทย", "สวัสดี"])
        self.assertNotIn("ค ร", out)

    def test_tidy_cues_no_overlap(self):
        cues = [
            {"start": 5.0, "end": 5.1, "text": "หนึ่ง"},
            {"start": 5.05, "end": 6.0, "text": "สอง"},
            {"start": 6.0, "end": 6.02, "text": "สาม"},
        ]
        out = tas.tidy_cues(cues)
        self.assertEqual(len(out), 3)
        for prev, cur in zip(out, out[1:]):
            self.assertLess(prev["end"], cur["start"])
        for cue in out:
            self.assertGreaterEqual(cue["end"] - cue["start"], 0.6 - 1e-9)

    def test_builtin_merge_dedupes_rolling_captions(self):
        cues = [
            {"start": 0.0, "end": 4.0, "text": "ยินดีต้อนรับสู่บทเรียน"},
            {"start": 4.0, "end": 8.0, "text": "สู่บทเรียนภาษาไทย"},
        ]
        merged = tas.builtin_merge(cues)
        self.assertEqual(len(merged), 1)
        self.assertEqual(tas.strip_ws(merged[0]["text"]), "ยินดีต้อนรับสู่บทเรียนภาษาไทย")
        self.assertEqual(merged[0]["end"], 8.0)

    def test_is_usable_key_rejects_placeholders(self):
        # 与 backend/aiProvider.js 的 isUsableKey 同口径
        self.assertFalse(tas.is_usable_key(""))
        self.assertFalse(tas.is_usable_key("你的真实密钥"))
        self.assertFalse(tas.is_usable_key("sk-在你的env里填入真实key"))
        self.assertFalse(tas.is_usable_key("short"))
        self.assertFalse(tas.is_usable_key("has space in it 1234567"))
        self.assertTrue(tas.is_usable_key("sk-" + "a1b2c3d4e5f6g7h8i9j0"))

    def test_key_problem_messages(self):
        self.assertEqual(tas.key_problem(""), "未配置")
        self.assertIn("占位符", tas.key_problem("你的真实密钥"))
        self.assertIn("长度异常", tas.key_problem("abc"))
        self.assertEqual(tas.key_problem("sk-" + "a" * 30), "")

    def test_render_vtt_and_srt(self):
        cues = [{"start": 0.0, "end": 2.0, "text": "สวัสดี ครับ", "zh": "你好"}]
        vtt = tas.render_vtt(cues)
        self.assertTrue(vtt.startswith("WEBVTT\n"))
        self.assertIn("00:00.000 --> 00:02.000", vtt)
        self.assertIn("สวัสดี ครับ", vtt)
        zh_vtt = tas.render_vtt(cues, "zh")
        self.assertIn("你好", zh_vtt)
        self.assertNotIn("สวัสดี", zh_vtt)
        bi = tas.render_bilingual_srt(cues)
        self.assertIn("สวัสดี ครับ\n你好", bi)


# ---------------------------------------------------------------- 静音切分


@unittest.skipUnless(HAVE_FFMPEG, "需要 ffmpeg / ffprobe")
class TestSilenceSegments(unittest.TestCase):
    def test_two_speech_segments(self):
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "tone.wav"
            make_test_audio(wav)
            duration = tas.probe_duration(wav)
            self.assertGreater(duration, 6.0)
            segments = tas.silence_segments(wav, duration=duration)
            self.assertGreaterEqual(len(segments), 2)
            self.assertLess(segments[0][0], 0.3)
            for start, end in segments:
                self.assertGreater(end, start)

    def test_max_segment_splits_long_speech(self):
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "long.wav"
            ffmpeg = shutil.which("ffmpeg")
            subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi",
                            "-i", "sine=frequency=440:duration=25", str(wav)], check=True)
            segments = tas.silence_segments(wav, duration=tas.probe_duration(wav), max_seg=20.0)
            self.assertTrue(all(end - start <= 20.0 + 1e-6 for start, end in segments))
            self.assertGreaterEqual(len(segments), 2)


# ---------------------------------------------------------------- 端到端


@unittest.skipUnless(HAVE_FFMPEG, "需要 ffmpeg / ffprobe")
class TestEndToEnd(EnvGuard):
    def _read_vtt(self, path: Path) -> list[tuple[float, float, str]]:
        text = path.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("WEBVTT"), "VTT 必须以 WEBVTT 开头")
        cues = []
        for match in re.finditer(r"^(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2})\.(\d{3})\n(.+)$",
                                 text, re.M):
            mm1, ss1, ms1, mm2, ss2, ms2, body = match.groups()
            cues.append((int(mm1) * 60 + int(ss1) + int(ms1) / 1000,
                         int(mm2) * 60 + int(ss2) + int(ms2) / 1000,
                         body))
        return cues

    def test_native_segments_and_translation(self):
        with tempfile.TemporaryDirectory() as tmp, StubServer() as base_url:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep1.wav"
            make_test_audio(audio)
            out_dir = tmp_path / "subtitles"

            code = tas.main([
                str(audio), "--id", "ep1", "--out-dir", str(out_dir),
                "--engine", "openai", "--asr-base-url", base_url, "--asr-model", "whisper-1",
                "--translate-base-url", base_url, "--translate-api-key", "stub-" + "0" * 24,
                "--translate-model", "stub-model", "--max-len", "30",
            ])
            self.assertEqual(code, 0)

            th_vtt = out_dir / "ep1.th.vtt"
            zh_vtt = out_dir / "ep1.zh.vtt"
            bi = out_dir / "ep1.bilingual.srt"
            report_path = out_dir / "ep1.report.json"
            for path in (th_vtt, zh_vtt, bi, report_path):
                self.assertTrue(path.is_file(), f"缺少产物 {path}")

            cues = self._read_vtt(th_vtt)
            self.assertGreaterEqual(len(cues), 2)
            for (_, prev_end, _), (cur_start, _, _) in zip(cues, cues[1:]):
                self.assertLessEqual(prev_end, cur_start + 1e-6)
            for _, _, body in cues:
                self.assertLessEqual(tas.cue_norm_len(body), 30)
            # 泰语词间空格必须保留（学习场景），且文字与识别结果一致
            self.assertTrue(any(" " in body.strip() for _, _, body in cues), "泰语空格被吃掉了")
            joined = "".join(tas.strip_ws(body) for _, _, body in cues)
            self.assertEqual(joined, tas.strip_ws(TH_TEXT))

            zh_cues = self._read_vtt(zh_vtt)
            self.assertEqual(len(zh_cues), len(cues))
            self.assertTrue(all(re.search(r"[\u4e00-\u9fff]", body) for _, _, body in zh_cues))

            bi_text = bi.read_text(encoding="utf-8")
            self.assertIn("สวัสดี", bi_text)
            self.assertIn("中文1", bi_text)

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertTrue(report["ok"])
            self.assertEqual(report["engine"].startswith("openai"), True)
            self.assertEqual(report["refine"], "subtitle_refine.refine_cues")
            self.assertGreaterEqual(report["cues_final"], 2)
            self.assertEqual(report["translate"]["filled"], report["cues_final"])

    def test_silence_mode_slices(self):
        with tempfile.TemporaryDirectory() as tmp, StubServer() as base_url:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep2.wav"
            make_test_audio(audio)
            out_dir = tmp_path / "subtitles"

            code = tas.main([
                str(audio), "--id", "ep2", "--out-dir", str(out_dir), "--no-translate",
                "--engine", "openai", "--asr-base-url", base_url, "--segment-mode", "silence",
            ])
            self.assertEqual(code, 0)
            report = json.loads((out_dir / "ep2.report.json").read_text(encoding="utf-8"))
            self.assertTrue(report["ok"])
            self.assertEqual(report["segments"], report["cues_raw"])
            self.assertGreaterEqual(report["segments"], 2)
            self.assertFalse((out_dir / "ep2.zh.vtt").exists(), "未翻译时不应生成中文轨")
            cues = self._read_vtt(out_dir / "ep2.th.vtt")
            self.assertGreaterEqual(len(cues), 1)
            for _, _, body in cues:
                self.assertIn("สวัสดี", body)

    def test_refine_off_uses_builtin(self):
        with tempfile.TemporaryDirectory() as tmp, StubServer() as base_url:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep3.wav"
            make_test_audio(audio)
            out_dir = tmp_path / "subtitles"
            code = tas.main([
                str(audio), "--id", "ep3", "--out-dir", str(out_dir), "--no-translate",
                "--engine", "openai", "--asr-base-url", base_url, "--refine", "off",
            ])
            self.assertEqual(code, 0)
            report = json.loads((out_dir / "ep3.report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["refine"], "builtin")
            self.assertGreaterEqual(report["cues_final"], 1)

    def test_mock_engine_offline(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep4.wav"
            make_test_audio(audio)
            out_dir = tmp_path / "subtitles"
            code = tas.main([
                str(audio), "--id", "ep4", "--out-dir", str(out_dir),
                "--engine", "mock", "--no-translate",
            ])
            self.assertEqual(code, 0)
            report = json.loads((out_dir / "ep4.report.json").read_text(encoding="utf-8"))
            self.assertGreaterEqual(report["cues_final"], 1)
            self.assertTrue((out_dir / "ep4.bilingual.srt").is_file())

    def test_reference_cer_report(self):
        with tempfile.TemporaryDirectory() as tmp, StubServer() as base_url:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep5.wav"
            make_test_audio(audio)
            ref = tmp_path / "ref.txt"
            ref.write_text(TH_TEXT, encoding="utf-8")
            out_dir = tmp_path / "subtitles"
            code = tas.main([
                str(audio), "--id", "ep5", "--out-dir", str(out_dir), "--no-translate",
                "--engine", "openai", "--asr-base-url", base_url, "--reference", str(ref),
            ])
            self.assertEqual(code, 0)
            report = json.loads((out_dir / "ep5.report.json").read_text(encoding="utf-8"))
            self.assertIn("cer", report)
            self.assertAlmostEqual(report["cer"]["cer"], 0.0, places=6)

    def test_dry_run_recognizes_but_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp, StubServer() as base_url:
            tmp_path = Path(tmp)
            audio = tmp_path / "ep6.wav"
            make_test_audio(audio)
            out_dir = tmp_path / "subtitles"
            code = tas.main([
                str(audio), "--id", "ep6", "--out-dir", str(out_dir), "--dry-run",
                "--engine", "openai", "--asr-base-url", base_url,
            ])
            self.assertEqual(code, 0, "dry-run 必须跑通识别（不能因为不写文件就跳过 ASR）")
            self.assertFalse(out_dir.exists(), "dry-run 不应写任何文件")

    def test_engine_missing_config_fails_loudly(self):
        with tempfile.TemporaryDirectory() as tmp:
            audio = Path(tmp) / "x.wav"
            make_test_audio(audio)
            with self.assertRaises(SystemExit):
                tas.main([str(audio), "--engine", "azure", "--speech-key", "", "--speech-region", ""])


if __name__ == "__main__":
    unittest.main(verbosity=2)
