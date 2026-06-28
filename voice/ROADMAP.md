# Voice Module — Integration Roadmap

This document tracks planned provider implementations and integration milestones. Each item is designed to require **only provider replacement** — no changes to agent logic, `VoiceSession`, or orchestrators.

---

## Phase 1 — Foundation (Current)

| Item | Status | Notes |
|---|---|---|
| Provider interfaces (`ISTTProvider`, `ITTSProvider`, `IAudioRecorder`, `IAudioPlayback`) | Done | `voice/interfaces/` |
| Faster-Whisper STT provider | Done | Local Python subprocess (`voice/python/transcribe.py`) |
| ElevenLabs TTS provider | Done | REST API |
| Node audio recorder (ffmpeg) | Done | Cross-platform mic capture |
| Node audio playback (ffplay) | Done | Temp-file subprocess playback |
| `VoiceSession` orchestrator | Done | Record → STT → callback → TTS → play |
| `createVoiceStack()` factory | Done | Env-based provider wiring |
| Architecture documentation | Done | `voice/ARCHITECTURE.md` |
| Validation script | Done | `scripts/validate-voice.ts` |

---

## Phase 2 — Additional STT Providers

### Whisper.cpp

| Field | Detail |
|---|---|
| Provider ID | `whisper-cpp` |
| File | `voice/providers/stt/whisper-cpp.ts` |
| Integration | Local HTTP server (whisper.cpp server mode) or subprocess CLI |
| Env vars | `WHISPER_CPP_URL`, `WHISPER_CPP_MODEL` |
| Effort | Medium — similar HTTP pattern to Faster-Whisper |

**Steps:**
1. Create `WhisperCppProvider implements ISTTProvider`
2. Add `"whisper-cpp"` case to `createSTTProvider()`
3. Add env vars to `.env.example`
4. Add validation check in `scripts/validate-voice.ts`

### OpenAI STT (Whisper API)

| Field | Detail |
|---|---|
| Provider ID | `openai-stt` |
| File | `voice/providers/stt/openai-stt.ts` |
| Integration | OpenAI `/v1/audio/transcriptions` REST API |
| Env vars | `OPENAI_API_KEY` (shared with future OpenAI TTS) |
| Effort | Low — standard REST, same multipart pattern as Faster-Whisper |

**Steps:**
1. Create `OpenAISTTProvider implements ISTTProvider`
2. Reuse multipart upload logic from `FasterWhisperProvider`
3. Point at `https://api.openai.com/v1/audio/transcriptions`

### Deepgram

| Field | Detail |
|---|---|
| Provider ID | `deepgram` |
| File | `voice/providers/stt/deepgram.ts` |
| Integration | Deepgram REST or WebSocket streaming API |
| Env vars | `DEEPGRAM_API_KEY` |
| Effort | Medium — supports streaming for lower latency (future enhancement) |

**Steps:**
1. Create `DeepgramProvider implements ISTTProvider`
2. Start with REST batch mode; add streaming variant later
3. Consider `DeepgramStreamingProvider` as a separate class implementing an extended interface

---

## Phase 3 — Additional TTS Providers

### Piper (Local)

| Field | Detail |
|---|---|
| Provider ID | `piper` |
| File | `voice/providers/tts/piper.ts` |
| Integration | Local HTTP server or subprocess (piper-tts) |
| Env vars | `PIPER_URL`, `PIPER_VOICE` |
| Effort | Medium — enables fully offline voice stack |

**Steps:**
1. Create `PiperProvider implements ITTSProvider`
2. HTTP POST text → receive WAV bytes
3. Set `VOICE_TTS_PROVIDER=piper` for local-only deployment

### OpenAI TTS

| Field | Detail |
|---|---|
| Provider ID | `openai-tts` |
| File | `voice/providers/tts/openai-tts.ts` |
| Integration | OpenAI `/v1/audio/speech` REST API |
| Env vars | `OPENAI_API_KEY`, `OPENAI_TTS_VOICE` |
| Effort | Low — simple JSON POST → audio bytes |

### Cartesia

| Field | Detail |
|---|---|
| Provider ID | `cartesia` |
| File | `voice/providers/tts/cartesia.ts` |
| Integration | Cartesia REST/WebSocket API |
| Env vars | `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID` |
| Effort | Medium — WebSocket streaming for real-time synthesis |

### Azure Speech

| Field | Detail |
|---|---|
| Provider ID | `azure-speech` |
| File | `voice/providers/tts/azure-speech.ts` |
| Integration | Azure Cognitive Services Speech SDK or REST |
| Env vars | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| Effort | Medium — SDK adds dependency; REST keeps zero-dep approach |

---

## Phase 4 — OpenClaw Integration

These steps wire voice into the existing CLI/Telegram without modifying agent internals.

| Item | File | Description |
|---|---|---|
| Voice CLI mode | `modes/voice/orchestrator.ts` | `runVoiceMode()` — voice loop using `VoiceSession` + existing agent |
| Wakeup menu entry | `tui/wakeup.ts` | Add "Voice" option alongside CLI/Telegram |
| CLI sub-mode | `modes/cli.ts` | Optional: add Voice to sub-mode select |
| Telegram voice messages | `modes/telegram/handlers.ts` | Download voice note → STT → agent → TTS reply |
| Voice-aware tools | `modes/voice/voice-tools.ts` | Optional `transcribe_audio` / `speak_text` agent tools |

**Integration pattern (no agent changes):**

```typescript
// modes/voice/orchestrator.ts (future)
export async function runVoiceMode() {
  const stack = createVoiceStack();
  const session = createVoiceSession(stack);
  const agent = buildExistingAgent(); // reuses getAgentModel(), createAgentTools(), etc.

  while (true) {
    const { input, output } = await session.conversationTurn(async (text) => {
      const result = await agent.generate({ prompt: text });
      return result.text ?? "";
    });
    if (!input) break; // silence or cancel
  }
}
```

---

## Phase 5 — Production Hardening

| Item | Priority | Notes |
|---|---|---|
| Streaming STT (partial transcription) | High | Lower perceived latency for long utterances |
| Streaming TTS (sentence-chunked playback) | High | Start speaking before full response is generated |
| Voice activity detection (VAD) | Medium | Auto-detect end of speech instead of manual stop |
| Wake word detection | Low | "Hey Jarvis" trigger via Porcupine or similar |
| Audio device enumeration | Medium | Per-platform ffmpeg device listing |
| Error recovery / fallback providers | Medium | Auto-fallback STT/TTS if primary unavailable |
| Platform-native recorder/playback | Low | `platform` recorder/playback IDs for mobile/embedded |
| Unit tests for provider interfaces | Medium | Mock providers for session logic testing |

---

## Provider Matrix

| Provider | Type | Status | Local/Cloud | Latency | Quality |
|---|---|---|---|---|---|
| Faster-Whisper | STT | **Implemented** | Local | Medium | High |
| Whisper.cpp | STT | Planned | Local | Medium | High |
| OpenAI STT | STT | Planned | Cloud | Low | High |
| Deepgram | STT | Planned | Cloud | Low | High |
| ElevenLabs | TTS | **Implemented** | Cloud | Medium | Very High |
| Piper | TTS | Planned | Local | Low | Good |
| OpenAI TTS | TTS | Planned | Cloud | Low | High |
| Cartesia | TTS | Planned | Cloud | Very Low | High |
| Azure Speech | TTS | Planned | Cloud | Low | High |

---

## Migration Scenarios

### Cloud → Fully Local

```env
VOICE_STT_PROVIDER=faster-whisper    # or whisper-cpp
VOICE_TTS_PROVIDER=piper
VOICE_PYTHON=python
WHISPER_MODEL=base
PIPER_URL=http://127.0.0.1:5000
```

No code changes. Agent logic untouched.

### Faster-Whisper → Deepgram (better accuracy, cloud)

```env
VOICE_STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your-key
```

No code changes. Agent logic untouched.

### ElevenLabs → OpenAI TTS (cost optimization)

```env
VOICE_TTS_PROVIDER=openai-tts
OPENAI_API_KEY=your-key
OPENAI_TTS_VOICE=alloy
```

No code changes. Agent logic untouched.
