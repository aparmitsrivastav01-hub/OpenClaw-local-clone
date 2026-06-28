import type { IAudioRecorder } from "../../interfaces/audio-recorder.ts";
import type { AudioDevice, RecordOptions, RecordingResult } from "../../types.ts";
import { resolveDshowDevice } from "./dshow-device.ts";

export interface NodeRecorderConfig {
  /** ffmpeg executable path (default: "ffmpeg"). */
  ffmpegPath?: string;
  /** Default sample rate in Hz. */
  sampleRate?: number;
  /** Windows dshow device, e.g. audio=Microphone (Realtek Audio) */
  dshowDevice?: string;
}

/**
 * Node/Bun audio recorder using ffmpeg for cross-platform mic capture.
 *
 * Requires ffmpeg installed and available on PATH.
 * Windows: uses dshow; macOS: avfoundation; Linux: pulse.
 */
export class NodeAudioRecorder implements IAudioRecorder {
  readonly id = "node";

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private chunks: Uint8Array[] = [];
  private startedAt = 0;
  private currentFormat: RecordingResult["format"] = "wav";
  private currentSampleRate = 16000;
  private readerDone: Promise<void> | null = null;

  constructor(private readonly config: NodeRecorderConfig = {}) {}

  async start(options?: RecordOptions): Promise<void> {
    if (this.proc) {
      throw new Error("Recording already in progress");
    }

    this.currentSampleRate = options?.sampleRate ?? this.config.sampleRate ?? 16000;
    this.currentFormat = options?.format ?? "wav";
    this.chunks = [];
    this.startedAt = Date.now();

    const ffmpeg = this.config.ffmpegPath ?? "ffmpeg";
    const args = buildFfmpegArgs(
      this.currentSampleRate,
      options?.deviceId,
      this.config.dshowDevice,
      options?.maxDurationMs,
    );
    console.log(`[NodeAudioRecorder.start] ffmpeg=${ffmpeg}, args=${args.join(" ")}`);
    console.log(`[NodeAudioRecorder.start] dshowDevice=${this.config.dshowDevice}`);

    this.proc = Bun.spawn({
      cmd: [ffmpeg, ...args],
      stdout: "pipe",
      stderr: "pipe",
    });

    if (!this.proc.stdout) {
      throw new Error("Failed to start ffmpeg recorder — no stdout pipe");
    }

    console.log("[NodeAudioRecorder.start] ffmpeg process spawned, PID=", this.proc.pid);

    const reader = this.proc.stdout.getReader();
    this.readerDone = (async () => {
      try {
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[NodeAudioRecorder.start] Reader done, total bytes=${totalBytes}`);
            break;
          }
          if (value) {
            this.chunks.push(value);
            totalBytes += value.length;
          }
        }
      } catch (err) {
        console.log("[NodeAudioRecorder.start] Reader error:", err);
        // Recording stopped — expected
      }
    })();
  }

  /** Wait until ffmpeg finishes (e.g. after `-t` duration) or recording is stopped. */
  async waitUntilDone(): Promise<void> {
    if (!this.proc) return;
    await this.proc.exited;
    if (this.readerDone) await this.readerDone;
  }

  async stop(): Promise<RecordingResult> {
    if (!this.proc) {
      throw new Error("No recording in progress");
    }

    console.log("[NodeAudioRecorder.stop] Stopping recorder...");
    const proc = this.proc;
    if (proc.exitCode === null) {
      console.log("[NodeAudioRecorder.stop] Killing ffmpeg process...");
      proc.kill();
    }
    console.log("[NodeAudioRecorder.stop] Waiting for process exit...");
    await proc.exited;
    console.log(`[NodeAudioRecorder.stop] Process exited with code=${proc.exitCode}`);
    
    // Capture stderr for debugging
    if (proc.stderr) {
      const stderr = await new Response(proc.stderr).text();
      if (stderr.trim()) {
        console.log(`[NodeAudioRecorder.stop] ffmpeg stderr: ${stderr}`);
      }
    }
    
    if (this.readerDone) await this.readerDone;
    this.proc = null;
    this.readerDone = null;

    const totalLength = this.chunks.reduce((n, c) => n + c.length, 0);
    console.log(`[NodeAudioRecorder.stop] Total audio bytes collected: ${totalLength}`);
    
    const audio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];

    const result = {
      audio,
      format: this.currentFormat,
      durationMs: Date.now() - this.startedAt,
    };
    console.log(`[NodeAudioRecorder.stop] Returning recording: ${result.audio.length} bytes, ${result.durationMs}ms`);
    return result;
  }

  isRecording(): boolean {
    return this.proc !== null;
  }

  async listDevices(): Promise<AudioDevice[]> {
    return [{ id: "default", name: "Default Microphone", isDefault: true }];
  }
}

function buildFfmpegArgs(
  sampleRate: number,
  deviceId?: string,
  dshowDevice?: string,
  maxDurationMs?: number,
): string[] {
  const platform = process.platform;
  const durationSec =
    maxDurationMs && maxDurationMs > 0
      ? String(Math.ceil(maxDurationMs / 1000))
      : undefined;

  if (platform === "win32") {
    const device = deviceId ?? resolveDshowDevice(dshowDevice);
    const args = ["-f", "dshow", "-i", device];
    if (durationSec) args.push("-t", durationSec);
    args.push(
      "-ar", String(sampleRate),
      "-ac", "1",
      "-f", "wav",
      "pipe:1",
    );
    return args;
  }

  if (platform === "darwin") {
    const device = deviceId ?? ":0";
    const args = ["-f", "avfoundation", "-i", device];
    if (durationSec) args.push("-t", durationSec);
    args.push(
      "-ar", String(sampleRate),
      "-ac", "1",
      "-f", "wav",
      "pipe:1",
    );
    return args;
  }

  const device = deviceId ?? "default";
  const args = ["-f", "pulse", "-i", device];
  if (durationSec) args.push("-t", durationSec);
  args.push(
    "-ar", String(sampleRate),
    "-ac", "1",
    "-f", "wav",
    "pipe:1",
  );
  return args;
}
