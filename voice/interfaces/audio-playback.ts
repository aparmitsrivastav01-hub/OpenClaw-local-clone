import type { AudioFormat } from "../types.ts";

/**
 * Audio playback contract.
 *
 * Plays encoded audio bytes through the system output device.
 * Platform-specific implementations live under voice/audio/playback/.
 */
export interface IAudioPlayback {
  readonly id: string;

  /** Play audio bytes and resolve when playback completes. */
  play(audio: Uint8Array, format: AudioFormat): Promise<void>;

  /** Stop any in-progress playback immediately. */
  stop(): Promise<void>;

  /** Whether audio is currently playing. */
  isPlaying(): boolean;
}
