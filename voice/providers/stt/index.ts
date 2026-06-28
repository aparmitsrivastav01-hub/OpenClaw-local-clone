import type { ISTTProvider } from "../../interfaces/speech-to-text.ts";
import type { VoiceConfig } from "../../types.ts";
import {
  FasterWhisperProvider,
  defaultTranscribeScriptPath,
} from "./faster-whisper.ts";

export type { FasterWhisperProvider, FasterWhisperConfig } from "./faster-whisper.ts";

/** Create an STT provider from configuration. Throws for unimplemented providers. */
export function createSTTProvider(config: VoiceConfig): ISTTProvider {
  switch (config.stt) {
    case "faster-whisper":
      return new FasterWhisperProvider({
        pythonExecutable: config.pythonExecutable ?? "python",
        scriptPath: config.whisperScriptPath ?? defaultTranscribeScriptPath(),
        model: config.whisperModel ?? "base",
        device: config.whisperDevice,
        computeType: config.whisperComputeType,
      });
    case "whisper-cpp":
      throw new Error(
        "STT provider 'whisper-cpp' is not yet implemented. See voice/ROADMAP.md.",
      );
    case "openai-stt":
      throw new Error(
        "STT provider 'openai-stt' is not yet implemented. See voice/ROADMAP.md.",
      );
    case "deepgram":
      throw new Error(
        "STT provider 'deepgram' is not yet implemented. See voice/ROADMAP.md.",
      );
    default: {
      const _exhaustive: never = config.stt;
      throw new Error(`Unknown STT provider: ${_exhaustive}`);
    }
  }
}
