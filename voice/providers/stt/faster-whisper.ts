import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import type { ISTTProvider } from "../../interfaces/speech-to-text.ts";
import type { STTOptions, TranscriptionResult } from "../../types.ts";

export interface FasterWhisperConfig {
  /** Python executable (e.g. python, py, .venv/Scripts/python). */
  pythonExecutable: string;
  /** Path to voice/python/transcribe.py */
  scriptPath: string;
  /** Whisper model name (tiny, base, small, medium, large-v3, …). */
  model: string;
  device?: string;
  computeType?: string;
}

export interface PythonTranscriptJson {
  text?: string;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
  }>;
  ok?: boolean;
  error?: string;
}

/** Default path to bundled transcribe.py */
export function defaultTranscribeScriptPath(): string {
  return join(
    dirname(import.meta.path),
    "../../python/transcribe.py",
  );
}

/**
 * Faster-Whisper STT provider — local Python subprocess.
 *
 * Pipeline: WAV bytes → temp file → python transcribe.py → JSON stdout.
 * No Docker, no HTTP server.
 */
export class FasterWhisperProvider implements ISTTProvider {
  readonly id = "faster-whisper";
  readonly name = "Faster-Whisper (local Python)";

  constructor(private readonly config: FasterWhisperConfig) {}

  async transcribe(
    audio: Uint8Array,
    options?: STTOptions,
  ): Promise<TranscriptionResult> {
    const dir = await mkdtemp(join(tmpdir(), "openclaw-stt-"));
    const wavPath = join(dir, `audio.${options?.format ?? "wav"}`);

    try {
      await writeFile(wavPath, audio);
      await writeFile("debug-openclaw.wav", audio);
      const body = await this.runPython([
        "--audio",
        wavPath,
        "--model",
        this.config.model,
        "--device",
        this.config.device ?? "cpu",
        "--compute-type",
        this.config.computeType ?? "int8",
        ...(options?.language ? ["--language", options.language] : []),
      ]);
      return mapTranscript(body);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const body = await this.runPython(["--check"], { timeoutMs: 30_000 });
      return body.ok === true;
    } catch {
      return false;
    }
  }

  private async runPython(
    args: string[],
    options?: { timeoutMs?: number },
  ): Promise<PythonTranscriptJson> {
    const proc = Bun.spawn({
      cmd: [this.config.pythonExecutable, this.config.scriptPath, ...args],
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeout = options?.timeoutMs ?? 120_000;
    const exitCode = await Promise.race([
      proc.exited,
      Bun.sleep(timeout).then(() => {
        proc.kill();
        throw new Error(
          `Python STT timed out after ${timeout}ms. Try a smaller WHISPER_MODEL.`,
        );
      }),
    ]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new Error(
        `Faster-Whisper Python failed (exit ${exitCode}): ${stderr.trim() || stdout.trim() || "unknown error"}`,
      );
    }

    const line = stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!line) {
      throw new Error(
        `Faster-Whisper returned empty stdout. stderr: ${stderr.trim()}`,
      );
    }

    try {
      return JSON.parse(line) as PythonTranscriptJson;
    } catch {
      throw new Error(
        `Invalid JSON from Faster-Whisper: ${line.slice(0, 200)}`,
      );
    }
  }
}

function mapTranscript(body: PythonTranscriptJson): TranscriptionResult {
  if (body.ok === false) {
    throw new Error(body.error ?? "Faster-Whisper check failed");
  }

  return {
    text: (body.text ?? "").trim(),
    language: body.language,
    segments: body.segments?.map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text,
      confidence: s.avg_logprob,
    })),
  };
}
