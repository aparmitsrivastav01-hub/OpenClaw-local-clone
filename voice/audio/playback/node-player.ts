import type { IAudioPlayback } from "../../interfaces/audio-playback.ts";
import type { AudioFormat } from "../../types.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface NodePlayerConfig {
  /** ffplay executable path (default: "ffplay"). Falls back to ffmpeg pipe. */
  ffplayPath?: string;
}

/**
 * Node/Bun audio playback using ffplay (or ffmpeg fallback).
 *
 * Writes audio to a temp file and plays via subprocess.
 * Requires ffplay/ffmpeg on PATH.
 */
export class NodeAudioPlayback implements IAudioPlayback {
  readonly id = "node";

  private proc: ReturnType<typeof Bun.spawn> | null = null;

  constructor(private readonly config: NodePlayerConfig = {}) {}

  async play(audio: Uint8Array, format: AudioFormat): Promise<void> {
    await this.stop();

    const dir = await mkdtemp(join(tmpdir(), "openclaw-voice-"));
    const filePath = join(dir, `playback.${format}`);

    try {
      await writeFile(filePath, audio);

      const player = this.config.ffplayPath ?? "ffplay";
      this.proc = Bun.spawn({
        cmd: [player, "-nodisp", "-autoexit", "-loglevel", "quiet", filePath],
        stdout: "ignore",
        stderr: "ignore",
      });

      await this.proc.exited;
    } finally {
      this.proc = null;
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      await this.proc.exited.catch(() => {});
      this.proc = null;
    }
  }

  isPlaying(): boolean {
    return this.proc !== null;
  }
}
