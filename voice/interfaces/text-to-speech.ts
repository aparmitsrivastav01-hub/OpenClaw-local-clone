import type { SynthesisResult, TTSOptions } from "../types.ts";

/**
 * Text-to-Speech provider contract.
 *
 * Implementations: Piper (default, local), ElevenLabs (optional cloud),
 * OpenAI TTS, Cartesia, Azure Speech (planned).
 * Swap providers via factory — agent logic never imports a concrete TTS class.
 */
export interface ITTSProvider {
  readonly id: string;
  readonly name: string;

  /** Synthesize speech from text. Returns encoded audio bytes. */
  synthesize(text: string, options?: TTSOptions): Promise<SynthesisResult>;

  /** Health check — returns true when the provider is reachable and ready. */
  isAvailable(): Promise<boolean>;
}
