import type { ITTSProvider } from "../../interfaces/text-to-speech.ts";
import type { SynthesisResult, TTSOptions } from "../../types.ts";

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  /** Base URL override (default: https://api.elevenlabs.io). */
  baseUrl?: string;
  modelId?: string;
}

/** Thrown when ElevenLabs returns a billing/auth HTTP error (fallback-eligible). */
export class ElevenLabsApiError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`ElevenLabs synthesis failed (${status}): ${detail}`);
    this.name = "ElevenLabsApiError";
  }
}

/** HTTP statuses that should trigger fallback to local TTS. */
export function isElevenLabsFallbackStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 403;
}

export function isElevenLabsRecoverableError(err: unknown): boolean {
  if (err instanceof ElevenLabsApiError) {
    return isElevenLabsFallbackStatus(err.status);
  }
  if (err instanceof Error) {
    return /ElevenLabs synthesis failed \((401|402|403)\)/.test(err.message);
  }
  return false;
}

/**
 * ElevenLabs TTS provider (optional cloud backend).
 *
 * Piper is the default local provider. ElevenLabs is used only when
 * VOICE_TTS_PROVIDER=elevenlabs and ELEVENLABS_API_KEY is set.
 */
export class ElevenLabsProvider implements ITTSProvider {
  readonly id = "elevenlabs";
  readonly name = "ElevenLabs";

  private readonly baseUrl: string;
  private readonly modelId: string;

  constructor(private readonly config: ElevenLabsConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.elevenlabs.io";
    this.modelId = config.modelId ?? "eleven_multilingual_v2";
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<SynthesisResult> {
    const voiceId = options?.voiceId ?? this.config.voiceId;
    const url = `${this.baseUrl}/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.config.apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: options?.speed ?? 1.0,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ElevenLabsApiError(response.status, detail);
    }

    const buffer = await response.arrayBuffer();
    return {
      audio: new Uint8Array(buffer),
      format: "mp3",
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/v1/user`;
      const response = await fetch(url, {
        headers: { "xi-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
