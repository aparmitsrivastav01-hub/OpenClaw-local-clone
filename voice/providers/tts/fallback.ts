import type { ITTSProvider } from "../../interfaces/text-to-speech.ts";
import type { SynthesisResult, TTSOptions } from "../../types.ts";

/** TTS provider that tries a primary backend, then falls back on recoverable errors. */
export class FallbackTTSProvider implements ITTSProvider {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly primary: ITTSProvider,
    private readonly fallback: ITTSProvider,
    private readonly shouldFallback: (err: unknown) => boolean,
  ) {}

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<SynthesisResult> {
    try {
      return await this.primary.synthesize(text, options);
    } catch (err) {
      if (!this.shouldFallback(err)) throw err;
      console.warn(
        `[TTS] ${this.primary.name} unavailable — falling back to ${this.fallback.name}`,
      );
      return await this.fallback.synthesize(text, options);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (await this.primary.isAvailable()) return true;
    return this.fallback.isAvailable();
  }
}

/** No-op TTS — returns empty audio so voice mode can continue without speech output. */
export class NoOpTTSProvider implements ITTSProvider {
  readonly id = "none";
  readonly name = "Disabled";

  async synthesize(
    _text: string,
    _options?: TTSOptions,
  ): Promise<SynthesisResult> {
    return { audio: new Uint8Array(), format: "wav" };
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
