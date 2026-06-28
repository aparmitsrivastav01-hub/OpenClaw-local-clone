import type { ITTSProvider } from "../../interfaces/text-to-speech.ts";
import type { SynthesisResult, TTSOptions } from "../../types.ts";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PiperConfig {
  /** Path to Piper executable (e.g., voice/piper/piper.exe or piper). */
  executablePath: string;
  /** Path to Piper voice model ONNX file (e.g., voice/piper/voices/en_US-lessac-medium.onnx). */
  modelPath: string;
}

/**
 * Piper TTS provider - fully local neural text-to-speech.
 *
 * Uses the Piper command-line tool to synthesize speech from text.
 * Piper runs locally with ONNX models, no API calls or billing required.
 *
 * Installation:
 * - Download Piper from https://github.com/rhasspy/piper
 * - Download voice models from https://huggingface.co/rhasspy/piper-voices
 *
 * Environment variables:
 * - PIPER_PATH: Path to piper executable
 * - PIPER_VOICE_MODEL: Path to .onnx voice model
 */
export class PiperProvider implements ITTSProvider {
  readonly id = "piper";
  readonly name = "Piper";

  constructor(private readonly config: PiperConfig) {
    if (!config.executablePath) {
      throw new Error("Piper executable path is required");
    }
    if (!config.modelPath) {
      throw new Error("Piper voice model path is required");
    }
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<SynthesisResult> {
    // Validate inputs
    if (!text || !text.trim()) {
      throw new Error("Cannot synthesize empty text");
    }

    // Validate executable exists
    if (!existsSync(this.config.executablePath)) {
      throw new Error(
        `Piper executable not found at: ${this.config.executablePath}`,
      );
    }

    // Validate model exists
    if (!existsSync(this.config.modelPath)) {
      throw new Error(
        `Piper voice model not found at: ${this.config.modelPath}`,
      );
    }

    // Generate temp file path for output
    const tempFile = join(tmpdir(), `piper-${Date.now()}.wav`);

    try {
      // Invoke Piper executable
      await this.runPiper(text, tempFile);

      // Read generated audio file
      const audioBuffer = await readFile(tempFile);
      const audio = new Uint8Array(audioBuffer);

      // Clean up temp file
      await unlink(tempFile).catch(() => {
        // Ignore cleanup errors
      });

      return {
        audio,
        format: "wav",
      };
    } catch (error) {
      // Clean up temp file on error
      await unlink(tempFile).catch(() => {
        // Ignore cleanup errors
      });
      throw error;
    }
  }

  private async runPiper(text: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["--model", this.config.modelPath, "--output_file", outputFile];

      const piper = spawn(this.config.executablePath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderr = "";

      piper.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      piper.stdin?.write(text, "utf8", (writeErr) => {
        if (writeErr) {
          reject(new Error(`Failed to write text to Piper stdin: ${writeErr.message}`));
          return;
        }
        piper.stdin?.end();
      });

      piper.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Piper synthesis failed (exit code ${code}): ${stderr || "Unknown error"}`,
            ),
          );
        }
      });

      piper.on("error", (error) => {
        reject(new Error(`Failed to spawn Piper: ${error.message}`));
      });
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check executable exists
      if (!existsSync(this.config.executablePath)) {
        return false;
      }

      // Check model exists
      if (!existsSync(this.config.modelPath)) {
        return false;
      }

      // Try to run Piper with --help to verify it works
      return new Promise((resolve) => {
        const piper = spawn(this.config.executablePath, ["--help"], {
          stdio: ["ignore", "ignore", "ignore"],
        });

        piper.on("close", (code) => {
          resolve(code === 0);
        });

        piper.on("error", () => {
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          piper.kill();
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  }
}
