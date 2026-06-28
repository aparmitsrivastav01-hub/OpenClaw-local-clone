import type { ITTSProvider } from "../../interfaces/text-to-speech.ts";
import type { VoiceConfig } from "../../types.ts";
import {
  ElevenLabsProvider,
  isElevenLabsRecoverableError,
} from "./elevenlabs.ts";
import { FallbackTTSProvider, NoOpTTSProvider } from "./fallback.ts";
import { PiperProvider } from "./piper.ts";

export type { ElevenLabsProvider, ElevenLabsConfig } from "./elevenlabs.ts";
export type { PiperProvider, PiperConfig } from "./piper.ts";
export { FallbackTTSProvider, NoOpTTSProvider } from "./fallback.ts";

function tryCreatePiper(config: VoiceConfig): PiperProvider | null {
  if (!config.piperPath || !config.piperVoiceModel) return null;
  try {
    return new PiperProvider({
      executablePath: config.piperPath,
      modelPath: config.piperVoiceModel,
    });
  } catch {
    return null;
  }
}

function tryCreateElevenLabs(config: VoiceConfig): ElevenLabsProvider | null {
  if (!config.elevenLabsApiKey?.trim()) return null;
  return new ElevenLabsProvider({
    apiKey: config.elevenLabsApiKey,
    voiceId: config.elevenLabsVoiceId ?? "21m00Tcm4TlvDq8ikWAM",
  });
}

/**
 * Create a TTS provider from configuration.
 *
 * Default: Piper (local). ElevenLabs is optional; missing keys or 401/402/403
 * responses fall back to Piper without crashing the voice stack.
 */
export function createTTSProvider(config: VoiceConfig): ITTSProvider {
  const piper = tryCreatePiper(config);
  const elevenlabs = tryCreateElevenLabs(config);

  switch (config.tts) {
    case "piper": {
      if (piper) return piper;
      if (elevenlabs) {
        console.warn(
          "[TTS] Piper not configured — falling back to ElevenLabs (cloud)",
        );
        return elevenlabs;
      }
      console.warn(
        "[TTS] No TTS provider configured — speech output disabled (text responses still work)",
      );
      return new NoOpTTSProvider();
    }

    case "elevenlabs": {
      if (elevenlabs && piper) {
        return new FallbackTTSProvider(
          "elevenlabs+piper",
          "ElevenLabs (Piper fallback)",
          elevenlabs,
          piper,
          isElevenLabsRecoverableError,
        );
      }
      if (elevenlabs) return elevenlabs;
      if (piper) {
        console.warn(
          "[TTS] ELEVENLABS_API_KEY missing — using Piper (Local)",
        );
        return piper;
      }
      console.warn(
        "[TTS] ElevenLabs unavailable and Piper not configured — speech output disabled",
      );
      return new NoOpTTSProvider();
    }

    case "openai-tts":
      throw new Error(
        "TTS provider 'openai-tts' is not yet implemented. See voice/ROADMAP.md.",
      );
    case "cartesia":
      throw new Error(
        "TTS provider 'cartesia' is not yet implemented. See voice/ROADMAP.md.",
      );
    case "azure-speech":
      throw new Error(
        "TTS provider 'azure-speech' is not yet implemented. See voice/ROADMAP.md.",
      );
    default: {
      const _exhaustive: never = config.tts;
      throw new Error(`Unknown TTS provider: ${_exhaustive}`);
    }
  }
}
