import type { STTOptions, TranscriptionResult } from "../types.ts";

/**
 * Speech-to-Text provider contract.
 *
 * Implementations: Faster-Whisper via local Python (initial), Whisper.cpp, OpenAI STT, Deepgram (planned).
 * Swap providers via factory — agent logic never imports a concrete STT class.
 */
export interface ISTTProvider {
  readonly id: string;
  readonly name: string;

  /** Transcribe raw audio bytes to text. */
  transcribe(
    audio: Uint8Array,
    options?: STTOptions,
  ): Promise<TranscriptionResult>;

  /** Health check — returns true when the provider is reachable and ready. */
  isAvailable(): Promise<boolean>;
}
