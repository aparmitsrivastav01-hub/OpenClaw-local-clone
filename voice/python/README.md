python voice/python/transcribe.py --check# OpenClaw Local Faster-Whisper (Python)

No Docker. No HTTP server. TypeScript invokes `transcribe.py` as a subprocess.

## Install

```bash
python -m pip install -r voice/python/requirements.txt
```

Windows (if `python` is the launcher):

```powershell
py -m pip install -r voice/python/requirements.txt
$env:VOICE_PYTHON = "py"
```

## Verify

```bash
python voice/python/transcribe.py --check
bun scripts/validate-voice.ts --stt-only
bun scripts/transcribe-mic.ts
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `VOICE_PYTHON` | `python` | Python executable |
| `WHISPER_MODEL` | `base` | Model name (`tiny`, `base`, `small`, …) |
| `WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | `int8` | e.g. `int8`, `float16` |
| `WHISPER_SCRIPT_PATH` | (bundled) | Override script path |
