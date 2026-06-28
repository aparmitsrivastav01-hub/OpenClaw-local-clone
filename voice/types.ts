/** Shared audio and voice types used across the voice module. */

/** Default microphone capture length for listen / transcribe-mic (ms). */
export const DEFAULT_RECORD_DURATION_MS = 5000;

export type AudioFormat = "wav" | "mp3" | "ogg" | "flac" | "pcm";

export interface AudioDevice {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface TranscriptionSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  segments?: TranscriptionSegment[];
}

export interface SynthesisResult {
  audio: Uint8Array;
  format: AudioFormat;
  durationMs?: number;
}

export interface RecordingResult {
  audio: Uint8Array;
  format: AudioFormat;
  durationMs: number;
}

export interface STTOptions {
  language?: string;
  /** Hint for expected audio format (defaults to provider preference). */
  format?: AudioFormat;
  sampleRate?: number;
}

export interface TTSOptions {
  voiceId?: string;
  speed?: number;
  format?: AudioFormat;
}

export interface RecordOptions {
  deviceId?: string;
  sampleRate?: number;
  maxDurationMs?: number;
  format?: AudioFormat;
}

export type STTProviderId =
  | "faster-whisper"
  | "whisper-cpp"
  | "openai-stt"
  | "deepgram";

export type TTSProviderId =
  | "elevenlabs"
  | "piper"
  | "openai-tts"
  | "cartesia"
  | "azure-speech";

export type RecorderId = "node" | "platform";

export type PlaybackId = "node" | "platform";

export interface VoiceConfig {
  stt: STTProviderId;
  tts: TTSProviderId;
  recorder: RecorderId;
  playback: PlaybackId;
  /** Python executable for local Faster-Whisper (default: python). */
  pythonExecutable?: string;
  /** Whisper model name (default: base). */
  whisperModel?: string;
  /** Override path to voice/python/transcribe.py */
  whisperScriptPath?: string;
  whisperDevice?: string;
  whisperComputeType?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  openaiApiKey?: string;
  deepgramApiKey?: string;
  azureSpeechKey?: string;
  azureSpeechRegion?: string;
  cartesiaApiKey?: string;
  /** Windows dshow device, e.g. `audio=Microphone (Realtek Audio)` */
  dshowDevice?: string;
  /** Piper TTS executable path (e.g., voice/piper/piper.exe). */
  piperPath?: string;
  /** Piper voice model path (e.g., voice/piper/voices/en_US-lessac-medium.onnx). */
  piperVoiceModel?: string;
}
