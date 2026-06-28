import type { IAudioRecorder } from "../interfaces/audio-recorder.ts";
import type { IAudioPlayback } from "../interfaces/audio-playback.ts";
import type { ISTTProvider } from "../interfaces/speech-to-text.ts";
import type { ITTSProvider } from "../interfaces/text-to-speech.ts";
import type { VoiceConfig } from "../types.ts";
import { NodeAudioRecorder } from "./audio/recorder/node-recorder.ts";
import { NodeAudioPlayback } from "./audio/playback/node-player.ts";
import { createSTTProvider } from "./providers/stt/index.ts";
import { createTTSProvider } from "./providers/tts/index.ts";
import { loadVoiceConfig } from "./config.ts";

/** STT + recorder only — no TTS or playback required. */
export interface SttStack {
  stt: ISTTProvider;
  recorder: IAudioRecorder;
  config: VoiceConfig;
}

/** Fully wired voice stack — all four abstractions ready to use. */
export interface VoiceStack {
  stt: ISTTProvider;
  tts: ITTSProvider;
  recorder: IAudioRecorder;
  playback: IAudioPlayback;
  config: VoiceConfig;
}

export interface VoiceStackOptions {
  /** Override env-based config (useful for tests). */
  config?: VoiceConfig;
}

/** Create STT + recorder stack (Phase 1 — TTS not required). */
export function createSttStack(options?: VoiceStackOptions): SttStack {
  const config = options?.config ?? loadVoiceConfig();
  return {
    stt: createSTTProvider(config),
    recorder: createRecorder(config),
    config,
  };
}

/** Create the complete voice stack from environment or explicit config. */
export function createVoiceStack(options?: VoiceStackOptions): VoiceStack {
  const config = options?.config ?? loadVoiceConfig();

  return {
    stt: createSTTProvider(config),
    tts: createTTSProvider(config),
    recorder: createRecorder(config),
    playback: createPlayback(config),
    config,
  };
}

/** Validate STT provider reachability only. */
export async function validateSttStack(
  stack: SttStack,
): Promise<boolean> {
  return stack.stt.isAvailable();
}

function createRecorder(config: VoiceConfig): IAudioRecorder {
  switch (config.recorder) {
    case "node":
      return new NodeAudioRecorder({ dshowDevice: config.dshowDevice });
    case "platform":
      throw new Error(
        "Recorder 'platform' is not yet implemented. See voice/ROADMAP.md.",
      );
    default: {
      const _exhaustive: never = config.recorder;
      throw new Error(`Unknown recorder: ${_exhaustive}`);
    }
  }
}

function createPlayback(config: VoiceConfig): IAudioPlayback {
  switch (config.playback) {
    case "node":
      return new NodeAudioPlayback();
    case "platform":
      throw new Error(
        "Playback 'platform' is not yet implemented. See voice/ROADMAP.md.",
      );
    default: {
      const _exhaustive: never = config.playback;
      throw new Error(`Unknown playback: ${_exhaustive}`);
    }
  }
}

/** Validate that all providers in the stack are reachable. */
export async function validateVoiceStack(
  stack: VoiceStack,
): Promise<{ stt: boolean; tts: boolean }> {
  const [stt, tts] = await Promise.all([
    stack.stt.isAvailable(),
    stack.tts.isAvailable(),
  ]);
  return { stt, tts };
}
