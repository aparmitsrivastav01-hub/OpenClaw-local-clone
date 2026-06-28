import { existsSync } from "node:fs";
import type { ITTSProvider } from "./interfaces/text-to-speech.ts";
import type { VoiceConfig } from "./types.ts";

/** Human-readable startup line for the active TTS provider. */
export function formatTtsStartupLine(provider: ITTSProvider): string {
  switch (provider.id) {
    case "piper":
      return "[TTS] Provider: Piper (Local)";
    case "elevenlabs":
      return "[TTS] Provider: ElevenLabs";
    case "elevenlabs+piper":
      return "[TTS] Provider: ElevenLabs (Piper fallback)";
    case "none":
      return "[TTS] Provider: disabled (configure Piper or ElevenLabs)";
    default:
      return `[TTS] Provider: ${provider.name}`;
  }
}

export interface TtsValidationResult {
  warnings: string[];
  hints: string[];
}

/** Non-fatal TTS configuration checks for startup diagnostics. */
export function validateTtsSetup(config: VoiceConfig): TtsValidationResult {
  const warnings: string[] = [];
  const hints: string[] = [];

  const piperReady =
    !!config.piperPath &&
    !!config.piperVoiceModel &&
    existsSync(config.piperPath) &&
    existsSync(config.piperVoiceModel);

  if (config.tts === "piper" || config.tts === "elevenlabs") {
    if (!piperReady) {
      if (!config.piperPath || !config.piperVoiceModel) {
        warnings.push("PIPER_PATH / PIPER_VOICE_MODEL not set");
      } else if (!existsSync(config.piperPath)) {
        warnings.push(`Piper executable not found: ${config.piperPath}`);
      } else if (!existsSync(config.piperVoiceModel)) {
        warnings.push(`Piper voice model not found: ${config.piperVoiceModel}`);
      }
      hints.push("See PIPER_SETUP.md — download piper.exe and a .onnx voice model");
    }

    if (config.tts === "elevenlabs" && !config.elevenLabsApiKey) {
      hints.push("ELEVENLABS_API_KEY not set — will use Piper when configured");
    }
  }

  return { warnings, hints };
}
