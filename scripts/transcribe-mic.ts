#!/usr/bin/env bun
/**
 * Phase 1: Microphone → Faster-Whisper → transcript
 *
 * Usage:
 *   bun scripts/transcribe-mic.ts
 *   bun scripts/transcribe-mic.ts --duration 5
 *
 * Requires:
 *   - ffmpeg on PATH
 *   - Python + faster-whisper: pip install -r voice/python/requirements.txt
 *   - Windows: optional VOICE_DSHOW_DEVICE (see ffmpeg -list_devices true -f dshow -i dummy)
 */

import chalk from "chalk";
import { transcribeFromMicrophone } from "../voice/mic-transcribe.ts";
import { DEFAULT_RECORD_DURATION_MS } from "../voice/types.ts";

function parseDurationMs(args: string[]): number {
  const flag = args.indexOf("--duration");
  if (flag < 0) return DEFAULT_RECORD_DURATION_MS;
  const value = args[flag + 1];
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.error(chalk.red("Invalid --duration value. Example: --duration 5"));
    process.exit(1);
  }
  return Math.round(seconds * 1000);
}

async function main() {
  const args = process.argv.slice(2);
  const durationMs = parseDurationMs(args);
  const seconds = durationMs / 1000;

  console.log(chalk.bold("\nRecording..."));
  console.log(
    chalk.dim(`  Speak now (${seconds}s). Press Ctrl+C to cancel.\n`),
  );

  try {
    const result = await transcribeFromMicrophone({ durationMs });
    const text = result.text.trim();

    console.log(chalk.bold("Transcript:"));
    console.log(text || chalk.dim("(empty)"));
    console.log();
  } catch (err) {
    console.error(
      chalk.red("\nTranscription failed:"),
      err instanceof Error ? err.message : err,
    );
    console.log(chalk.dim(`
  Setup checklist:
    1. pip install -r voice/python/requirements.txt
    2. python voice/python/transcribe.py --check
    3. ffmpeg on PATH (winget install Gyan.FFmpeg)
    4. Windows mic: ffmpeg -list_devices true -f dshow -i dummy
       then set VOICE_DSHOW_DEVICE=Microphone (Your Device Name)
`));
    process.exit(1);
  }
}

main();
