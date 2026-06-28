#!/usr/bin/env python3
"""
Local Faster-Whisper transcription for OpenClaw.

Writes a single JSON object to stdout:
  { "text": "...", "language": "en", "segments": [...] }

Usage:
  python transcribe.py --check
  python transcribe.py --audio path/to/audio.wav [--model base] [--language en]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Reconfigure stdout/stderr to UTF-8 to handle Unicode on Windows
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def emit(payload: dict) -> None:
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


def run_check() -> int:
    try:
        from faster_whisper import WhisperModel  # noqa: F401

        emit({"ok": True})
        return 0
    except Exception as exc:
        emit({"ok": False, "error": str(exc)})
        return 1


def run_transcribe(
    audio_path: str,
    model_name: str,
    language: str | None,
    device: str,
    compute_type: str,
) -> int:
    from faster_whisper import WhisperModel

    path = Path(audio_path)
    if not path.is_file():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        return 1
    print(f"MODEL={model_name}, device={device}, compute_type={compute_type}", file=sys.stderr)
    print(f"Audio file: {path}, size={path.stat().st_size} bytes", file=sys.stderr)
    
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        print("Model loaded successfully", file=sys.stderr)
    except Exception as e:
        print(f"Failed to load model: {e}", file=sys.stderr)
        emit({"ok": False, "error": f"Model load failed: {e}"})
        return 1
    
    try:
        segments_iter, info = model.transcribe(
            str(path),
            language=language if language else None,
            vad_filter=False,
        )
        print(f"Transcription started, detected language: {info.language}, probability: {info.language_probability}", file=sys.stderr)
    except Exception as e:
        print(f"Transcription failed: {e}", file=sys.stderr)
        emit({"ok": False, "error": f"Transcription failed: {e}"})
        return 1

    segments_list = []
    text_parts: list[str] = []
    segment_count = 0
    for segment in segments_iter:
        segment_count += 1
        text_parts.append(segment.text)
        segments_list.append(
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "avg_logprob": segment.avg_logprob,
            }
        )
    
    print(f"Processed {segment_count} segments", file=sys.stderr)
    full_text = "".join(text_parts).strip()
    print(f"Full text length: {len(full_text)}", file=sys.stderr)

    emit(
        {
            "text": full_text,
            "language": info.language,
            "segments": segments_list,
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenClaw Faster-Whisper STT")
    parser.add_argument("--check", action="store_true", help="Verify faster-whisper import")
    parser.add_argument("--audio", help="Path to WAV (or ffmpeg-supported) audio file")
    parser.add_argument("--model", default="base", help="Whisper model size/name")
    parser.add_argument("--language", default=None, help="BCP-47 language code (optional)")
    parser.add_argument("--device", default="cpu", help="cpu or cuda")
    parser.add_argument("--compute-type", default="int8", dest="compute_type")
    args = parser.parse_args()

    if args.check:
        return run_check()

    if not args.audio:
        print("--audio is required unless using --check", file=sys.stderr)
        return 1

    try:
        return run_transcribe(
            args.audio,
            args.model,
            args.language,
            args.device,
            args.compute_type,
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
