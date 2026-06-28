import type { IAudioRecorder } from "../interfaces/audio-recorder.ts";
import type { IAudioPlayback } from "../interfaces/audio-playback.ts";
import type { ISTTProvider } from "../interfaces/speech-to-text.ts";
import type { ITTSProvider } from "../interfaces/text-to-speech.ts";
import {
  DEFAULT_RECORD_DURATION_MS,
  type RecordOptions,
  type STTOptions,
  type TTSOptions,
} from "../types.ts";

export interface VoiceSessionOptions {
  stt?: STTOptions;
  tts?: TTSOptions;
  record?: RecordOptions;
}

/**
 * Voice session — orchestrates record → STT → (callback) → TTS → play.
 *
 * This is the plug-in layer. It accepts a text-processing callback
 * (e.g. an existing agent orchestrator) without modifying agent internals.
 *
 * Usage:
 * ```ts
 * const session = new VoiceSession(stack);
 * await session.conversationTurn(async (userText) => {
 *   const result = await agent.generate({ prompt: userText });
 *   return result.text ?? "";
 * });
 * ```
 */
export class VoiceSession {
  constructor(
    private readonly stt: ISTTProvider,
    private readonly tts: ITTSProvider,
    private readonly recorder: IAudioRecorder,
    private readonly playback: IAudioPlayback,
  ) {}

  /** Record from microphone and transcribe to text. */
  async listen(options?: VoiceSessionOptions): Promise<string> {
    const durationMs =
      options?.record?.maxDurationMs ?? DEFAULT_RECORD_DURATION_MS;
    console.log(`[VoiceSession.listen] Starting recording (duration=${durationMs}ms)...`);

    try {
      await this.recorder.start({
        ...options?.record,
        maxDurationMs: durationMs,
      });
      console.log("[VoiceSession.listen] Recorder started");
    } catch (err) {
      console.error("[VoiceSession.listen] Failed to start recorder:", err);
      return ""; // Return empty to trigger retry
    }

    if (
      "waitUntilDone" in this.recorder &&
      typeof this.recorder.waitUntilDone === "function"
    ) {
      console.log("[VoiceSession.listen] Waiting for recorder.waitUntilDone()...");
      await this.recorder.waitUntilDone();
      console.log("[VoiceSession.listen] Recorder waitUntilDone() completed");
    } else {
      console.log(`[VoiceSession.listen] Sleeping for ${durationMs + 300}ms...`);
      await Bun.sleep(durationMs + 300);
      console.log("[VoiceSession.listen] Sleep completed");
    }

    console.log("[VoiceSession.listen] Stopping recorder...");
    let recording;
    try {
      recording = await this.recorder.stop();
      console.log(`[VoiceSession.listen] Recording stopped: audio length=${recording.audio.length} bytes, format=${recording.format}, duration=${recording.durationMs}ms`);
    } catch (err) {
      console.error("[VoiceSession.listen] Failed to stop recorder:", err);
      return ""; // Return empty to trigger retry
    }

    if (recording.audio.length === 0) {
      console.warn("[VoiceSession.listen] WARNING: Recording produced no audio data!");
      return ""; // Return empty to trigger retry
    }

    console.log("[VoiceSession.listen] Starting transcription...");
    let result;
    try {
      result = await this.stt.transcribe(recording.audio, {
        format: recording.format,
        ...options?.stt,
      });
      console.log(`[VoiceSession.listen] Transcription result: "${result.text}" (language=${result.language})`);
    } catch (err) {
      console.error("[VoiceSession.listen] Transcription failed:", err);
      return ""; // Return empty to trigger retry
    }
    return result.text;
  }

  /** Synthesize text and play through speakers. */
  async speak(text: string, options?: VoiceSessionOptions): Promise<void> {
    try {
      const synthesis = await this.tts.synthesize(text, options?.tts);
      if (!synthesis.audio.length) return;
      await this.playback.play(synthesis.audio, synthesis.format);
    } catch (error) {
      console.error("[VoiceSession.speak] Error during TTS synthesis or playback:", error);
      // Don't throw - allow conversation to continue even if audio fails
    }
  }

  /**
   * Full voice turn: listen → process text via callback → speak response.
   *
   * The callback is where OpenClaw agent logic plugs in — no changes
   * to ToolLoopAgent, orchestrators, or Ollama integration required.
   */
  async conversationTurn(
    processText: (userText: string) => Promise<string>,
    options?: VoiceSessionOptions,
  ): Promise<{ input: string; output: string }> {
    const input = await this.listen(options);
    if (!input.trim()) {
      return { input: "", output: "" };
    }
    const output = await processText(input);
    if (output.trim()) {
      await this.speak(output, options);
    }
    return { input, output };
  }

  /** Stop any in-progress playback or recording. */
  async abort(): Promise<void> {
    await Promise.all([
      this.playback.stop(),
      this.recorder.isRecording() ? this.recorder.stop().catch(() => {}) : Promise.resolve(),
    ]);
  }
}

/** Convenience factory — builds a VoiceSession from a VoiceStack. */
export function createVoiceSession(stack: {
  stt: ISTTProvider;
  tts: ITTSProvider;
  recorder: IAudioRecorder;
  playback: IAudioPlayback;
}): VoiceSession {
  return new VoiceSession(
    stack.stt,
    stack.tts,
    stack.recorder,
    stack.playback,
  );
}
