#!/usr/bin/env bun
/**
 * Voice module validation.
 *
 * Usage:
 *   bun scripts/validate-voice.ts --stt-only
 *   bun scripts/validate-voice.ts --stt-only --file test.wav
 *   bun scripts/validate-voice.ts
 *   bun scripts/validate-voice.ts --synthesize "Hello from OpenClaw"
 */

import chalk from "chalk";
import {
  createSttStack,
  createVoiceStack,
  validateSttStack,
  validateVoiceStack,
  loadVoiceConfig,
  formatTtsStartupLine,
  validateTtsSetup,
} from "../voice/index.ts";

const args = process.argv.slice(2);
const sttOnly = args.includes("--stt-only");
const synthesizeFlag = args.indexOf("--synthesize");
const synthesizeText =
  synthesizeFlag >= 0 ? args[synthesizeFlag + 1] : undefined;
const fileFlag = args.indexOf("--file");
const audioFile = fileFlag >= 0 ? args[fileFlag + 1] : undefined;

function pass(msg: string) {
  console.log(chalk.green("  ✓"), msg);
}

function fail(msg: string) {
  console.log(chalk.red("  ✗"), msg);
}

function info(msg: string) {
  console.log(chalk.dim("  ·"), msg);
}

async function validateSttOnly() {
  console.log(chalk.bold("\n🎙  OpenClaw Voice Validation (STT only)\n"));

  const config = loadVoiceConfig();
  info(`STT provider:  ${config.stt}`);
  info(`Python:        ${config.pythonExecutable ?? "python"}`);
  info(`Whisper model: ${config.whisperModel ?? "base"}`);
  if (config.dshowDevice) {
    info(`dshow device:  ${config.dshowDevice}`);
  }
  console.log();

  const stack = createSttStack({ config });
  pass(`STT stack created — ${stack.stt.name}`);

  console.log(chalk.bold("\n1. STT availability"));
  const available = await validateSttStack(stack);
  if (available) {
    pass(`${stack.stt.name} is reachable`);
  } else {
    fail(`${stack.stt.name} is not reachable`);
    info("Install: pip install -r voice/python/requirements.txt");
    info("Check:   python voice/python/transcribe.py --check");
    process.exit(1);
  }

  if (audioFile) {
    console.log(chalk.bold("\n2. File transcription"));
    try {
      const file = Bun.file(audioFile);
      if (!(await file.exists())) {
        fail(`File not found: ${audioFile}`);
        process.exit(1);
      }
      const audio = new Uint8Array(await file.arrayBuffer());
      const result = await stack.stt.transcribe(audio, { format: "wav" });
      pass(`Transcribed ${audio.byteLength} bytes`);
      console.log(chalk.bold("\nTranscript:"));
      console.log(result.text.trim() || chalk.dim("(empty)"));
      console.log();
    } catch (err) {
      fail(`Transcription failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else {
    info("Tip: bun scripts/validate-voice.ts --stt-only --file test.wav");
    info("Mic test: bun scripts/transcribe-mic.ts");
  }

  console.log(chalk.green.bold("\nSTT checks passed.\n"));
}

async function validateFull() {
  console.log(chalk.bold("\n🎙  OpenClaw Voice Validation\n"));

  const config = loadVoiceConfig();
  info(`STT provider:  ${config.stt}`);
  info(`TTS configured: ${config.tts}`);
  info(`Recorder:      ${config.recorder}`);
  info(`Playback:      ${config.playback}`);

  const ttsCheck = validateTtsSetup(config);
  for (const w of ttsCheck.warnings) info(`Warning: ${w}`);
  for (const h of ttsCheck.hints) info(h);
  console.log();

  console.log(chalk.bold("1. Voice stack creation"));
  let stack;
  try {
    stack = createVoiceStack({ config });
    pass(`Stack created — STT: ${stack.stt.name}`);
    console.log(chalk.dim(`  ${formatTtsStartupLine(stack.tts)}`));
  } catch (err) {
    fail(`Stack creation failed: ${err instanceof Error ? err.message : err}`);
    info("For STT-only checks: bun scripts/validate-voice.ts --stt-only");
    process.exit(1);
  }

  console.log(chalk.bold("\n2. Provider availability"));
  const { stt, tts } = await validateVoiceStack(stack);

  if (stt) {
    pass(`${stack.stt.name} STT is reachable`);
  } else {
    fail(`${stack.stt.name} STT is not reachable`);
    info("Install Python STT: pip install -r voice/python/requirements.txt");
  }

  if (tts) {
    pass(`${stack.tts.name} TTS is reachable`);
  } else {
    fail(`${stack.tts.name} TTS is not reachable`);
    info("Install Piper — see PIPER_SETUP.md");
    info("Or use --stt-only to skip TTS checks");
  }

  if (synthesizeText && tts) {
    console.log(chalk.bold("\n3. TTS synthesis test"));
    try {
      const result = await stack.tts.synthesize(synthesizeText);
      if (result.audio.byteLength === 0) {
        fail("Synthesis returned empty audio");
      } else {
        pass(
          `Synthesized ${result.audio.byteLength} bytes (${result.format})`,
        );
      }
    } catch (err) {
      fail(`Synthesis failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log();
  if (stt && tts) {
    console.log(chalk.green.bold("All voice checks passed.\n"));
  } else if (stt) {
    console.log(
      chalk.yellow.bold(
        "STT OK — TTS unavailable. Configure Piper or use --stt-only.\n",
      ),
    );
    process.exit(1);
  } else {
    console.log(chalk.yellow.bold("Some checks failed.\n"));
    process.exit(1);
  }
}

async function main() {
  if (sttOnly) {
    await validateSttOnly();
    return;
  }
  await validateFull();
}

main().catch((err) => {
  console.error(chalk.red("\nValidation error:"), err);
  process.exit(1);
});
