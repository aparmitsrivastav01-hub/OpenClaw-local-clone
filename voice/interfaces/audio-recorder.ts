import type { AudioDevice, RecordOptions, RecordingResult } from "../types.ts";

/**
 * Audio recording contract.
 *
 * Captures microphone input as raw audio bytes.
 * Platform-specific implementations live under voice/audio/recorder/.
 */
export interface IAudioRecorder {
  readonly id: string;

  /** Begin capturing audio from the configured input device. */
  start(options?: RecordOptions): Promise<void>;

  /** Stop capture and return the recorded audio. */
  stop(): Promise<RecordingResult>;

  /** Whether a recording session is currently active. */
  isRecording(): boolean;

  /** Wait until capture finishes (e.g. ffmpeg `-t` elapsed). */
  waitUntilDone?(): Promise<void>;

  /** Optional: enumerate available input devices. */
  listDevices?(): Promise<AudioDevice[]>;
}
