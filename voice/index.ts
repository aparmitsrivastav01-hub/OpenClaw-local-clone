// ── Public API ──────────────────────────────────────────────────────────────

export {
  DEFAULT_RECORD_DURATION_MS,
} from "./types.ts";

export type {
  AudioFormat,
  AudioDevice,
  TranscriptionResult,
  TranscriptionSegment,
  SynthesisResult,
  RecordingResult,
  STTOptions,
  TTSOptions,
  RecordOptions,
  STTProviderId,
  TTSProviderId,
  RecorderId,
  PlaybackId,
  VoiceConfig,
} from "./types.ts";

export type {
  ISTTProvider,
  ITTSProvider,
  IAudioRecorder,
  IAudioPlayback,
} from "./interfaces/index.ts";

export { loadVoiceConfig, defaultPiperPaths } from "./config.ts";
export { formatTtsStartupLine, validateTtsSetup } from "./tts-info.ts";
export {
  createVoiceStack,
  createSttStack,
  validateVoiceStack,
  validateSttStack,
  type VoiceStack,
  type SttStack,
  type VoiceStackOptions,
} from "./factory.ts";

export { transcribeFromMicrophone, type MicTranscribeOptions } from "./mic-transcribe.ts";

export {
  VoiceSession,
  createVoiceSession,
  type VoiceSessionOptions,
} from "./session/voice-session.ts";

// ── Provider factories (for direct use / testing) ───────────────────────────

export { createSTTProvider } from "./providers/stt/index.ts";
export { createTTSProvider } from "./providers/tts/index.ts";
export { FasterWhisperProvider } from "./providers/stt/faster-whisper.ts";
export { ElevenLabsProvider } from "./providers/tts/elevenlabs.ts";
export { PiperProvider } from "./providers/tts/piper.ts";

// ── Audio implementations ───────────────────────────────────────────────────

export { NodeAudioRecorder } from "./audio/recorder/node-recorder.ts";
export { NodeAudioPlayback } from "./audio/playback/node-player.ts";
