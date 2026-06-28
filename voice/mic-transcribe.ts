import type { ISTTProvider } from "./interfaces/speech-to-text.ts";
import type { TranscriptionResult, VoiceConfig } from "./types.ts";
import { DEFAULT_RECORD_DURATION_MS } from "./types.ts";
import { loadVoiceConfig } from "./config.ts";
import { NodeAudioRecorder } from "./audio/recorder/node-recorder.ts";
import { createSTTProvider } from "./providers/stt/index.ts";

export interface MicTranscribeOptions {
  /** Recording length in milliseconds (default: 5000). */
  durationMs?: number;
  config?: VoiceConfig;
  stt?: ISTTProvider;
}

/**
 * Phase 1 pipeline: microphone → Faster-Whisper → transcript.
 * Does not use createVoiceStack() or TTS.
 */
export async function transcribeFromMicrophone(
  options?: MicTranscribeOptions,
): Promise<TranscriptionResult> {
  const config = options?.config ?? loadVoiceConfig();
  const stt = options?.stt ?? createSTTProvider(config);
  const recorder = new NodeAudioRecorder({ dshowDevice: config.dshowDevice });
  const durationMs = options?.durationMs ?? DEFAULT_RECORD_DURATION_MS;

  const available = await stt.isAvailable();
  if (!available) {
    throw new Error(
      `STT provider "${stt.name}" is not reachable. ` +
        `Start Faster-Whisper at ${config.fasterWhisperUrl ?? "http://127.0.0.1:9000"} ` +
        `(e.g. docker run -p 9000:9000 hwdsl2/whisper-server)`,
    );
  }

  await recorder.start({
    sampleRate: 16000,
    format: "wav",
    maxDurationMs: durationMs,
  });

  await recorder.waitUntilDone();
  const recording = await recorder.stop();

  if (recording.audio.byteLength === 0) {
    throw new Error(
      "No audio captured. Check ffmpeg is installed and the microphone device is correct " +
        "(set VOICE_DSHOW_DEVICE on Windows).",
    );
  }

  return stt.transcribe(recording.audio, { format: recording.format });
}
