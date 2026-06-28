# openclaw

Local AI agent CLI (Agent / Plan / Ask modes) powered by [Ollama](https://ollama.com) and the Vercel AI SDK.

## Prerequisites

1. [Ollama](https://ollama.com) running locally (`ollama serve`)
2. Default model pulled: `ollama pull qwen3`
3. [Bun](https://bun.com)
4. **Voice (optional):** [FFmpeg](https://ffmpeg.org) on PATH; Piper for local TTS ([setup guide](PIPER_SETUP.md))

## Setup

```bash
bun install
cp .env.example .env   # optional — defaults work for local Ollama
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3` | Model name (must exist in `ollama list`) |
| `FIRECRAWL_API_KEY` | — | Optional web tools in Plan/Ask |
| `VOICE_ENABLED` | — | Set to `1` for microphone + speech output |
| `VOICE_TTS_PROVIDER` | `piper` | Local Piper TTS (default) |
| `PIPER_PATH` | `voice/piper/piper.exe` | Piper executable |
| `PIPER_VOICE_MODEL` | `voice/piper/voices/en_US-lessac-medium.onnx` | Piper ONNX voice |
| `ELEVENLABS_API_KEY` | — | Optional cloud TTS when `VOICE_TTS_PROVIDER=elevenlabs` |

**TTS behavior:** Piper is the default. ElevenLabs is optional; if the API key is missing or returns 401/402/403, OpenClaw falls back to Piper automatically without crashing.

## Run

```bash
bun run index.ts wakeup
```

Voice mode:

```bash
# After installing Piper (see PIPER_SETUP.md)
set VOICE_ENABLED=1
bun run index.ts wakeup
```

Startup logs include the active provider, for example:

```
[TTS] Provider: Piper (Local)
```

## Validate

```bash
bun scripts/validate-ollama.ts
bun scripts/validate-voice.ts --stt-only
bun scripts/validate-voice.ts --synthesize "Hello from OpenClaw"
```
