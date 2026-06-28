import { join, dirname } from "node:path";
import type { VoiceConfig } from "./types.ts";

const DEFAULT_WHISPER_MODEL = "base";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Default Piper paths under voice/piper/ (see PIPER_SETUP.md). */
export function defaultPiperPaths(): {
  piperPath: string;
  piperVoiceModel: string;
} {
  const voiceRoot = dirname(import.meta.path);
  return {
    piperPath: join(voiceRoot, "piper", "piper.exe"),
    piperVoiceModel: join(
      voiceRoot,
      "piper",
      "voices",
      "en_US-lessac-medium.onnx",
    ),
  };
}

/** Load voice configuration from environment variables. */
export function loadVoiceConfig(): VoiceConfig {
  const piperDefaults = defaultPiperPaths();

  return {
    stt: parseSTTProvider(process.env.VOICE_STT_PROVIDER),
    tts: parseTTSProvider(process.env.VOICE_TTS_PROVIDER),
    recorder: parseRecorder(process.env.VOICE_RECORDER),
    playback: parsePlayback(process.env.VOICE_PLAYBACK),
    pythonExecutable:
      process.env.VOICE_PYTHON ??
      process.env.WHISPER_PYTHON ??
      (process.platform === "win32" ? "python" : "python3"),
    whisperModel: process.env.WHISPER_MODEL ?? DEFAULT_WHISPER_MODEL,
    whisperScriptPath: process.env.WHISPER_SCRIPT_PATH,
    whisperDevice: process.env.WHISPER_DEVICE ?? "cpu",
    whisperComputeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenLabsVoiceId:
      process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_ELEVENLABS_VOICE_ID,
    openaiApiKey: process.env.OPENAI_API_KEY,
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    azureSpeechKey: process.env.AZURE_SPEECH_KEY,
    azureSpeechRegion: process.env.AZURE_SPEECH_REGION,
    cartesiaApiKey: process.env.CARTESIA_API_KEY,
    dshowDevice: process.env.VOICE_DSHOW_DEVICE,
    piperPath: process.env.PIPER_PATH ?? piperDefaults.piperPath,
    piperVoiceModel:
      process.env.PIPER_VOICE_MODEL ?? piperDefaults.piperVoiceModel,
  };
}

function parseSTTProvider(
  value: string | undefined,
): VoiceConfig["stt"] {
  switch (value) {
    case "whisper-cpp":
    case "openai-stt":
    case "deepgram":
    case "faster-whisper":
      return value;
    default:
      return "faster-whisper";
  }
}

function parseTTSProvider(
  value: string | undefined,
): VoiceConfig["tts"] {
  switch (value) {
    case "piper":
    case "openai-tts":
    case "cartesia":
    case "azure-speech":
    case "elevenlabs":
      return value;
    default:
      return "piper";
  }
}

function parseRecorder(
  value: string | undefined,
): VoiceConfig["recorder"] {
  return value === "platform" ? "platform" : "node";
}

function parsePlayback(
  value: string | undefined,
): VoiceConfig["playback"] {
  return value === "platform" ? "platform" : "node";
}
